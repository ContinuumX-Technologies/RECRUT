import { PythonShell, Options } from 'python-shell';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma'; // Import prisma
// ─────────────────────────────────────────────────────────────────────────────
// Simple concurrency queue (limits to 2 parallel YOLO runs – safe for CPU/GPU)
// ─────────────────────────────────────────────────────────────────────────────
class YoloQueue {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private maxConcurrent = 2; // Adjust based on your machine (2 = safe default)

  add(task: () => Promise<void>) {
    this.queue.push(task);
    this.processNext();
  }

  private processNext() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) return;

    const task = this.queue.shift()!;
    this.activeCount++;

    task().finally(() => {
      this.activeCount--;
      this.processNext();
    });
  }
}

const yoloQueue = new YoloQueue();

// ─────────────────────────────────────────────────────────────────────────────
// Resolve correct Python executable (supports venv, conda, system python)
// ─────────────────────────────────────────────────────────────────────────────
function getPythonPath(): string {
  // 1. Explicit env var override (recommended)
  if (process.env.PYTHON) return process.env.PYTHON;

  // 2. Auto-detect virtual environment
  const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python');
  const venvPythonWin = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');

  if (fs.existsSync(venvPython)) return venvPython;
  if (fs.existsSync(venvPythonWin)) return venvPythonWin;

  // 3. Fallback to system python3
  return 'python3';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main YOLO analysis function
// ─────────────────────────────────────────────────────────────────────────────
export const runYoloAnalysis = (videoPath: string,interviewId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const task = async () => {
      const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
      const refFace = interview?.referenceFacePath; // e.g., "uploads/ref-face.jpg"

      const args = [videoPath, '--model', 'yolov8n.pt'];
      if (refFace && fs.existsSync(refFace)) {
         args.push('--reference', refFace); // Pass it to Python
      }
      const scriptPath = path.join(process.cwd(), 'python');
      
      if (!fs.existsSync(videoPath)) {
         resolve({ error: "File missing on disk" });
         return;
      }

      const options: Options = {
        mode: 'text',
        pythonPath: './venv/bin/python', // Ensure this points to your venv python
        scriptPath: scriptPath,
        args: [videoPath, '--model', 'yolov8n.pt']
      };

      try {
        const messages = await PythonShell.run('process_video.py', options);
        
        if (!messages || messages.length === 0) {
           throw new Error("No output from Python script");
        }
        
        // Parse the LAST message
        const lastMsg = messages[messages.length - 1];
        const result = JSON.parse(lastMsg);

        // 🟢 DEBUG LOG: Show exactly what Python found
        console.log('[YOLO] Python Result:', JSON.stringify(result, null, 2));

        resolve(result);

      } catch (err: any) {
        console.error("[YOLO Service Error]", err);
        resolve({ error: "Analysis failed", details: err.message });
      }
    };

    // Add to queue
    // @ts-ignore
    yoloQueue.add(task);
  });
};