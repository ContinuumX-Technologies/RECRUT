import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { json, urlencoded } from 'express';
import multer from 'multer';
import { MediaRecord } from '@prisma/client';
import { runYoloAnalysis } from './services/yoloService';
import { AIShadowService } from './services/aiShadowService'; // [FIX]: Import the service
import { ResumeService } from './services/resume.service';
import { prisma } from './lib/prisma';
import {
  hashPassword,
  verifyPassword,
  signToken,
  authMiddleware,
  requireRole,
  AuthRequest,
} from './lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import aiRoutes from "../src/routes/aiQuestion.routes";
import judgeRoutes from "../src/routes/judge.routes";
import verifyRoutes from "../src/routes/verify.routes";
import previewRoutes from "../src/routes/preview.routes";

const execAsync = promisify(exec);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

app.use(
  cors({
    origin: "http://localhost:5173", // frontend
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.use(json({ limit: '10mb' }));
app.use(urlencoded({ extended: true }));
app.use("/api/admin", aiRoutes);
app.use("/api/judge", judgeRoutes);
app.use("/api/admin", verifyRoutes);
app.use("/api/admin", previewRoutes);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage (uses UPLOAD_DIR)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  },
});
const upload = multer({ storage });


// Serve uploads (for admin review)
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

// ======================
// Health check
// ======================
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// ======================
// Auth: register / login / me
// ======================

// Register
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, candidateId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password, role required' });
    }
    if (!['CANDIDATE', 'INTERVIEWER'].includes(role)) {
      return res.status(400).json({ error: 'invalid_role' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'email_taken' });

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        candidateId: role === 'CANDIDATE' ? candidateId || null : null,
      },
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        candidateId: user.candidateId,
      },
    });
  } catch (e) {
    console.error('register error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email, password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'invalid_credentials' });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'invalid_credentials' });

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        candidateId: user.candidateId,
      },
    });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Current user
app.get('/api/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    candidateId: user.candidateId,
  });
});

// ======================
// Candidate: self interviews (/api/me/interviews)
// ======================
app.get('/api/me/interviews', authMiddleware, requireRole('CANDIDATE'), async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const where = {
    OR: [
      { candidateEmail: user.email },
      user.candidateId ? { candidateId: user.candidateId } : undefined,
    ].filter(Boolean) as any[],
    status: { not: 'cancelled' },
  };

  const interviews = await prisma.interview.findMany({
    where,
    orderBy: { scheduledAt: 'asc' },
    include: { template: true },
  });

  res.json(
    interviews.map((iv: any) => ({
      id: iv.id,
      candidateName: iv.candidateName,
      candidateEmail: iv.candidateEmail,
      candidateId: iv.candidateId,
      status: iv.status,
      scheduledAt: iv.scheduledAt,
      template: iv.template
        ? {
          id: iv.template.id,
          name: iv.template.name,
          role: iv.template.role,
          level: iv.template.level,
        }
        : null,
    }))
  );
}
);

// ======================
// Interview config (for candidate client)
// ======================
app.get('/api/interviews/:id/config', async (req: Request, res: Response) => {
  const { id } = req.params;
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: { template: true },
  });

  if (!interview) return res.status(404).json({ error: 'Not found' });

  const tpl = interview.template;
  // PRIORITY: Use customConfig if set, otherwise fallback to template config
  const cfg = (interview.customConfig as any) || (tpl?.config as any) || {};

  const defaultProctor = {
    heartbeatMs: 5000,
    frameIntervalMs: 5000,
    focusLossThreshold: 3,
  };

  const proctorConfig = cfg.proctor || defaultProctor;
  const questions = Array.isArray(cfg.questions) ? cfg.questions : [];

  res.json({
    // ... existing response fields
    id: interview.id,
    candidateName: interview.candidateName,
    status: interview.status,
    questions,       // Now serves dynamic questions
    proctorConfig,
  });
});

// ======================
// Proctor events / media uploads
// ======================

// Events (focus changes, fullscreen, YOLO warnings, etc.)
app.post('/api/interviews/:id/events', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, payload } = req.body || {};

  if (!type) return res.status(400).json({ error: 'type required' });

  await prisma.proctorEvent.create({
    data: {
      interviewId: id,
      type,
      payload: payload || {},
    },
  });

  res.json({ ok: true });
});

// Video upload (webcam recording chunks)
app.post('/api/interviews/:id/video', upload.single('video'), async (req: Request, res: Response) => {
  const { id } = req.params; // This is the interviewId
  if (!req.file) return res.status(400).json({ error: 'video required' });

  // Use absolute path for the Python script
  const absolutePath = req.file.path;
  const relPath = path.relative(process.cwd(), absolutePath);

  const record = await prisma.mediaRecord.create({
    data: {
      interviewId: id,
      type: 'video',
      path: relPath,
      yoloProcessed: false, // Will update shortly
    },
  });

  // Notify that upload happened
  await prisma.proctorEvent.create({
    data: {
      interviewId: id,
      type: 'video_chunk_uploaded',
      payload: { mediaId: record.id, path: relPath },
    },
  });

  // Respond to client immediately (don't make them wait for YOLO)
  res.json({ ok: true, path: relPath, id: record.id });

  // Trigger YOLO in "background"
  runYoloAnalysis(absolutePath, id)
    .then(async (result) => {
      if (result.error) {
        console.error('[YOLO] Script reported error:', result.error);
        return;
      }

      const { summary, events } = result;

      // Update MediaRecord
      await prisma.mediaRecord.update({
        where: { id: record.id },
        data: {
          yoloProcessed: true,
          yoloSummary: summary,
        },
      });

      // Create ProctorEvents
      if (Array.isArray(events)) {
        for (const ev of events) {
          await prisma.proctorEvent.create({
            data: {
              interviewId: id,
              type: ev.type,
              payload: ev.payload,
            },
          });
        }
      }
      console.log(`[YOLO] Processed media ${record.id}`);
    })
    .catch((err) => {
      console.error('[YOLO] Execution failed:', err);
    });
}
);

// Audio upload (answers)
app.post('/api/interviews/:id/audio', upload.single('audio'), async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'audio required' });

  const relPath = path.relative(process.cwd(), req.file.path);

  const record = await prisma.mediaRecord.create({
    data: {
      interviewId: id,
      type: 'audio',
      path: relPath,
    },
  });

  await prisma.proctorEvent.create({
    data: {
      interviewId: id,
      type: 'audio_answer_uploaded',
      payload: { mediaId: record.id, path: relPath },
    },
  });

  // Respond first to keep UI snappy
  res.json({ ok: true, path: relPath, id: record.id });

  // [FIX] Trigger AI Shadow Analysis in background
  AIShadowService.processAnswer(id, record.id, req.file.path)
    .then((analysis) => {
      if (analysis) {
        console.log(`[AIShadow] Analyzed answer ${record.id}. Score: ${analysis.score}`);
      }
    })
    .catch(err => {
      console.error(`[AIShadow] Error processing ${record.id}:`, err);
    });
}
);

// ======================
// Admin interview details (for review)
// ======================
app.get('/api/admin/interviews/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      template: true,
      proctorEvents: { orderBy: { createdAt: 'asc' } },
      mediaRecords: true,
    },
  });
  if (!interview) return res.status(404).json({ error: 'Not found' });
  res.json(interview);
});

// ======================
// Admin: templates (INTERVIEWER only)
// ======================

// Create a new interview template
app.post('/api/admin/templates', authMiddleware, requireRole('INTERVIEWER'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, role, level, description, config } = req.body;

    if (!name || !role || !level) {
      return res.status(400).json({ error: 'name, role, level required' });
    }

    const tpl = await prisma.interviewTemplate.create({
      data: {
        name,
        role,
        level,
        description: description || '',
        config: config || {},
      },
    });

    res.json(tpl);
  } catch (e) {
    console.error('Create template error', e);
    res.status(500).json({ error: 'internal_error' });
  }
}
);

// Delete an interview template (INTERVIEWER only)
app.delete('/api/admin/templates/:id',authMiddleware,requireRole('INTERVIEWER'),async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      // 1️⃣ Check if template exists
      const template = await prisma.interviewTemplate.findUnique({
        where: { id },
      });

      if (!template) {
        return res.status(404).json({ error: 'template_not_found' });
      }

      // 2️⃣ Check if template is used by any interviews
      const usageCount = await prisma.interview.count({
        where: { templateId: id },
      });

      if (usageCount > 0) {
        return res.status(409).json({
          error: 'template_in_use',
          message: 'Cannot delete template. It is used by existing interviews.',
          interviewsUsingTemplate: usageCount,
        });
      }

      // 3️⃣ Safe to delete
      await prisma.interviewTemplate.delete({
        where: { id },
      });

      res.json({
        ok: true,
        message: 'Template deleted successfully',
      });
    } catch (e) {
      console.error('Delete template error', e);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);


// Search candidates (by name, email, or candidateId)
app.get('/api/admin/candidates', authMiddleware, requireRole('INTERVIEWER'), async (req: AuthRequest, res: Response) => {
  const q = String(req.query.query || '').trim();
  if (!q) return res.json([]);

  const candidates = await prisma.user.findMany({
    where: {
      role: 'CANDIDATE',
      OR: [
        { name: { contains: q } },   // Removed mode: 'insensitive'
        { email: { contains: q } },  // Removed mode: 'insensitive'
        { candidateId: { contains: q } },
      ],
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  res.json(
    candidates.map((c: any) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      candidateId: c.candidateId,
    }))
  );
}
);

// List templates
app.get('/api/admin/templates', authMiddleware, requireRole('INTERVIEWER'), async (_req: AuthRequest, res: Response) => {
  const templates = await prisma.interviewTemplate.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json(templates);
}
);

// Get a single template
app.get('/api/admin/templates/:id', authMiddleware, requireRole('INTERVIEWER'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tpl = await prisma.interviewTemplate.findUnique({
    where: { id },
  });
  if (!tpl) return res.status(404).json({ error: 'not_found' });
  res.json(tpl);
}
);

// ======================
// Admin: interviews (INTERVIEWER only)
// ======================

// Schedule an interview
app.post('/api/admin/interviews', authMiddleware, requireRole('INTERVIEWER'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      candidateName,
      candidateEmail,
      candidateId, // registration / employee id
      templateId,
      scheduledAt,
    } = req.body;

    if (!candidateName || !candidateEmail || !templateId || !candidateId) {
      return res.status(400).json({
        error:
          'candidateName, candidateEmail, candidateId, templateId required',
      });
    }

    const dt = scheduledAt ? new Date(scheduledAt) : null;

    const interview = await prisma.interview.create({
      data: {
        candidateName,
        candidateEmail,
        candidateId,
        templateId,
        scheduledAt: dt,
        status: 'scheduled',
        interviewerId: req.user!.id,
      },
    });

    res.json(interview);
  } catch (e) {
    console.error('Schedule interview error', e);
    res.status(500).json({ error: 'internal_error' });
  }
}
);

// List interviews (for admin dashboard)
app.get('/api/admin/interviews', authMiddleware, requireRole('INTERVIEWER'), async (_req: AuthRequest, res: Response) => {
  const interviews = await prisma.interview.findMany({
    orderBy: { createdAt: 'desc' },
    include: { template: true },
  });
  res.json(interviews);
}
);

// Update the 'Update interview' endpoint (approx line 370)
app.put('/api/admin/interviews/:id', authMiddleware, requireRole('INTERVIEWER'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    candidateName,
    candidateEmail,
    candidateId,
    templateId,
    scheduledAt,
    status,
    customConfig, // Capture this from body
  } = req.body;

  try {
    const dt = scheduledAt ? new Date(scheduledAt) : null;

    const iv = await prisma.interview.update({
      where: { id },
      data: {
        candidateName,
        candidateEmail,
        candidateId,
        templateId,
        scheduledAt: dt,
        status,
        customConfig: customConfig ?? undefined, // Update if provided
      },
    });
    res.json(iv);
  } catch (e) {
    console.error('update interview error', e);
    res.status(500).json({ error: 'internal_error' });
  }
}
);

// Delete an interview
app.delete('/api/admin/interviews/:id', authMiddleware, requireRole('INTERVIEWER'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    // Attempt to delete the interview from the database
    // Note: Ensure your Prisma Schema has 'onDelete: Cascade' for relations 
    // (MediaRecords, ProctorEvents) or this might fail if data exists.
    await prisma.interview.delete({
      where: { id },
    });

    res.json({ ok: true, message: 'Interview deleted successfully' });
  } catch (e: any) {
    console.error('Delete interview error', e);
    
    // P2025 is the Prisma error code for "Record to delete does not exist"
    if (e.code === 'P2025') {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    res.status(500).json({ error: 'internal_error' });
  }
});

// ======================
// Candidate: by candidateId (legacy / optional)
// ======================
app.get('/api/candidates/:candidateId/interviews', async (req: Request, res: Response) => {
  const { candidateId } = req.params;

  const interviews = await prisma.interview.findMany({
    where: {
      candidateId,
      status: { not: 'cancelled' },
    },
    orderBy: { scheduledAt: 'asc' },
    include: {
      template: true,
    },
  });

  res.json(
    interviews.map((iv: any) => ({
      id: iv.id,
      candidateName: iv.candidateName,
      candidateEmail: iv.candidateEmail,
      candidateId: iv.candidateId,
      status: iv.status,
      scheduledAt: iv.scheduledAt,
      template: iv.template
        ? {
          id: iv.template.id,
          name: iv.template.name,
          role: iv.template.role,
          level: iv.template.level,
        }
        : null,
    }))
  );
}
);

// ======================
// YOLO worker endpoints
// ======================

// List unprocessed video media records
app.get('/api/worker/yolo/pending', async (req: Request, res: Response) => {
  const limit = Number(req.query.limit || 10);

  const videos = await prisma.mediaRecord.findMany({
    where: {
      type: 'video',
      yoloProcessed: false,
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  res.json(
    videos.map((v: MediaRecord) => ({
      id: v.id,
      interviewId: v.interviewId,
      path: v.path,
    }))
  );
});

// YOLO worker posts summary + events for a single mediaId
app.post('/api/worker/yolo/result/:mediaId', async (req: Request, res: Response) => {
  const { mediaId } = req.params;
  const { summary, events } = req.body || {};

  const media = await prisma.mediaRecord.findUnique({
    where: { id: mediaId },
  });

  if (!media) {
    return res.status(404).json({ error: 'media_not_found' });
  }

  await prisma.mediaRecord.update({
    where: { id: mediaId },
    data: {
      yoloProcessed: true,
      yoloSummary: summary || {},
    },
  });

  if (Array.isArray(events)) {
    for (const ev of events) {
      await prisma.proctorEvent.create({
        data: {
          interviewId: media.interviewId,
          type: ev.type || 'yolo_event',
          payload: ev.payload || {},
        },
      });
    }
  }

  res.json({ ok: true });
}
);

// Recent alerts for a candidate (YOLO / proctor warnings)
app.get('/api/interviews/:id/alerts', async (req: Request, res: Response) => {
  const { id } = req.params;
  const lookbackMs = 30_000;
  const since = new Date(Date.now() - lookbackMs);

  const events = await prisma.proctorEvent.findMany({
    where: {
      interviewId: id,
      createdAt: { gte: since },
      type: {
        in: [
          // Legacy events (keep if needed)
          'yolo_phone_detected',
          'yolo_multiple_people_detected',
          'yolo_forbidden_objects_detected',

          // NEW: Events from process_video.py
          'proctor_face_mismatch',      // <-- Handles Face Verification Warning
          'proctor_forbidden_object',   // <-- Handles Object Detection Warning
          'proctor_phone_detected',
          'proctor_multiple_people'
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  if (!events.length) {
    return res.json({ hasWarning: false });
  }

  const ev = events[0];
  const payload: any = ev.payload || {};

  res.json({
    hasWarning: true,
    type: ev.type,
    message: payload.message || 'Suspicious activity detected.',
    objects: payload.objects || [], // <--- Pass the objects list
    createdAt: ev.createdAt,
  });
});

app.post('/api/interviews/:id/reference/face', upload.single('photo'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'photo required' });
  const relPath = path.relative(process.cwd(), req.file.path);
  await prisma.interview.update({
    where: { id: req.params.id },
    data: { referenceFacePath: relPath }
  });
  res.json({ ok: true, path: relPath });
});

// Upload Reference Voice
app.post('/api/interviews/:id/reference/voice', upload.single('audio'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'audio required' });
  const relPath = path.relative(process.cwd(), req.file.path);
  await prisma.interview.update({
    where: { id: req.params.id },
    data: { referenceVoicePath: relPath }
  });
  res.json({ ok: true, path: relPath });
});

// Code Execution Engine (IDE Support)
app.post('/api/code/execute', async (req: Request, res: Response) => {
  const { language, code, testCases } = req.body;

  if (!code) return res.status(400).json({ error: 'No code provided' });

  // Unique file identifier
  const fileId = `${Date.now()}-${Math.round(Math.random() * 1000)}`;
  const fileName = `submission_${fileId}.${language === 'python' ? 'py' : 'js'}`;
  const filePath = path.join(process.cwd(), 'uploads', fileName);

  try {
    let finalCode = code;

    // --- INTELLIGENT WRAPPER INJECTION ---
    // If test cases exist, we wrap the user's code with a test runner.
    // We assume the user writes a function named 'solution'.
    if (testCases && Array.isArray(testCases)) {
      const serializedCases = JSON.stringify(testCases);

      if (language === 'python') {
        finalCode = `
import json
import sys

# User's Code
${code}

# Test Harness
def run_tests():
    try:
        cases = ${serializedCases}
        results = []
        for i, case in enumerate(cases):
            try:
                # Input is expected to be a JSON string representing arguments list: "[1, 2]"
                args = json.loads(case['input']) 
                expected = json.loads(case['output'])
                
                # Capture stdout if needed, but mainly check return value
                result = solution(*args)
                
                # strict comparison
                passed = (result == expected)
                
                results.append({
                    "id": i,
                    "status": "Accepted" if passed else "Wrong Answer",
                    "input": case['input'],
                    "expected": json.dumps(expected),
                    "actual": json.dumps(result),
                    "passed": passed
                })
            except Exception as e:
                results.append({
                    "id": i,
                    "status": "Runtime Error",
                    "error": str(e),
                    "passed": False
                })
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps([{"status": "Harness Error", "error": str(e)}]))

if __name__ == "__main__":
    run_tests()
`;
      } else if (language === 'javascript') {
        finalCode = `
// User's Code
${code}

// Test Harness
(function() {
    const cases = ${serializedCases};
    const results = [];
    
    cases.forEach((c, i) => {
        try {
            const args = JSON.parse(c.input);
            const expected = JSON.parse(c.output);
            
            const result = solution(...args);
            
            // Simple deep equality check for primitives/arrays
            const resultStr = JSON.stringify(result);
            const expectedStr = JSON.stringify(expected);
            const passed = resultStr === expectedStr;
            
            results.push({
                id: i,
                status: passed ? "Accepted" : "Wrong Answer",
                input: c.input,
                expected: c.output,
                actual: resultStr,
                passed: passed
            });
        } catch (e) {
            results.push({
                id: i,
                status: "Runtime Error",
                error: e.message,
                passed: false
            });
        }
    });
    console.log(JSON.stringify(results));
})();
`;
      }
    }

    // 1. Write the wrapped code to file
    fs.writeFileSync(filePath, finalCode);

    // 2. Prepare Command
    let command = '';
    if (language === 'python') {
      command = `python3 "${filePath}"`;
    } else if (language === 'javascript') {
      command = `node "${filePath}"`;
    } else {
      throw new Error('Unsupported language');
    }

    // 3. Execute
    const { stdout, stderr } = await execAsync(command, { timeout: 5000 });

    // 4. Parse Results
    // If we ran test cases, stdout should be a JSON string of results.
    let parsedResults = null;
    if (testCases) {
      try {
        parsedResults = JSON.parse(stdout.trim());
      } catch (e) {
        // If parsing fails, it might be a syntax error printed to stdout/stderr
        parsedResults = { error: "Output parsing failed", raw: stdout + stderr };
      }
    }

    res.json({
      success: true,
      output: stdout,
      error: stderr,
      testResults: parsedResults
    });

  } catch (error: any) {
    const msg = error.stderr || error.message || 'Execution failed';
    res.json({ success: false, error: msg });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

app.post('/api/interviews/:id/resume', upload.single('resume'), async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!req.file) return res.status(400).json({ error: 'PDF resume required' });

  try {
    console.log(`[Resume] Starting Deep Scan for ${id}...`);
    
    // 1. Run Python Script
    const scanResult = await ResumeService.parseResume(req.file.path);

    // 2. Save JSON to Database
    await prisma.interview.update({
      where: { id },
      data: {
        resumeData: scanResult // Stores the GitHub analysis
      }
    });

    console.log(`[Resume] Scan complete. Found ${Object.keys(scanResult.tech_stack_found || {}).length} ecosystems.`);

    res.json({ ok: true, data: scanResult });

  } catch (err: any) {
    console.error("Resume Scan Failed:", err);
    res.status(500).json({ error: 'Deep scan failed', details: err.message });
  }
});

// ======================
// Start server
// ======================
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});