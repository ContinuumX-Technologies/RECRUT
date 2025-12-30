import { prisma } from '../lib/prisma';
import { MediaRecord } from '@prisma/client';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { generateContextAwareCodingQuestion } from './openai.service'; // [UPDATED] Import the coding question generator

const execAsync = promisify(exec);

// Interface for the AI Analysis structure stored in JSON
interface AIAnalysisJson {
  score?: number;
  contradiction?: string | null;
  emotion?: string;
  generatedAt?: string;
}

// Interface for LLM response
interface AIAnalysisResult {
  transcript: string;
  score: number;
  contradiction: string | null;
  emotion: string;
  followUpQuestion: string | null;
}

export class AIShadowService {
  // Initialize OpenAI Client
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // [NEW] Helper: Generate System Prompt with Verified GitHub Context
  private static getSystemPrompt(resumeData: any | null): string {
    let contextStr = "";
    
    // Check if we have the new Python-based structure (tech_stack_found is the key indicator)
    if (resumeData && resumeData.tech_stack_found) {
      const techStack = Object.keys(resumeData.tech_stack_found).join(", ");
      
      // Extract specific repos for context
      // The Python script outputs: { github_users: [ { repos: [ { name, ecosystems } ] } ] }
      const repos = resumeData.github_users?.[0]?.repos?.map((r: any) => 
        `${r.name} (${r.ecosystems.join(', ')})`
      ).join("; ");

      contextStr = `
      VERIFIED GITHUB AUDIT:
      - Confirmed Tech Stack: ${techStack}
      - Key Repositories: ${repos || "None found"}
      
      INSTRUCTION:
      The candidate's technical skills have been verified via their GitHub code.
      - If they claim a skill NOT in the "Confirmed Tech Stack", ask them to explain their experience with it.
      - Ask specific questions about their repositories (e.g., "In repo X, why did you use Y?").
      `;
    } else {
        contextStr = "No GitHub data available for this candidate.";
    }

    return `You are an expert Technical Interviewer AI. 
    Analyze the candidate's audio answer directly.
    
    ${contextStr}
    
    TASK:
    1. Transcribe the audio verbatim.
    2. Rate the quality (1-10) based on technical depth and clarity.
    3. Detect any contradictions with the provided context OR VERIFIED GITHUB CODE.
    4. Identify the candidate's emotion/tone.
    5. Generate ONE sharp follow-up question if needed.

    OUTPUT JSON ONLY:
    {
      "transcript": "string",
      "score": number,
      "contradiction": "string" | null,
      "emotion": "string",
      "followUpQuestion": "string" | null
    }`;
  }

  // Fallback Mock Analysis
  private static async mockLLMAnalysis(text: string, context: string[]): Promise<AIAnalysisResult> {
    const isContradiction = text.toLowerCase().includes("never") && context.some(c => c.includes("always"));
    const score = Math.min(10, Math.max(1, Math.floor(text.length / 10)));

    return {
      transcript: text || "Audio processed (Mock)",
      score: score,
      contradiction: isContradiction ? "Candidate contradicted previous statement." : null,
      emotion: "Confident",
      followUpQuestion: text.length < 20 ? "Could you elaborate?" : null
    };
  }

  // 1. Direct Audio Analysis (GPT-4o Audio)
  private static async analyzeDirectAudio(base64Audio: string, context: string[], systemPrompt: string): Promise<AIAnalysisResult> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-audio-preview",
      modalities: ["text"], // Request text output (analysis) only
      response_format: { type: "json_object" }, 
      messages: [
        {
          role: "system",
          content: systemPrompt // [UPDATED] Uses GitHub-aware prompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `CONTEXT (Previous Answers):\n${context.slice(-3).join('\n')}\n\nAnalyze this audio answer:`
            },
            {
              type: "input_audio",
              input_audio: {
                data: base64Audio,
                format: "wav" 
              }
            }
          ]
        }
      ]
    });

    const textResponse = response.choices[0].message.content || "{}";
    const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  }

  // 2. Fallback: Whisper Transcription + GPT-4o Text Analysis
  private static async analyzeViaWhisper(absolutePath: string, context: string[], systemPrompt: string): Promise<AIAnalysisResult> {
    console.log("[AIShadow] Fallback: Using Whisper + GPT-4o Text Analysis...");

    // Step A: Transcribe with Whisper
    const transcription = await this.openai.audio.transcriptions.create({
      file: fs.createReadStream(absolutePath),
      model: "whisper-1",
    });

    const transcriptText = transcription.text;

    // Step B: Analyze Text with GPT-4o
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt // [UPDATED] Uses GitHub-aware prompt
        },
        {
          role: "user",
          content: `CONTEXT:\n${context.slice(-3).join('\n')}\n\nCURRENT ANSWER:\n"${transcriptText}"`
        }
      ],
      response_format: { type: "json_object" }
    });

    const data = JSON.parse(response.choices[0].message.content || "{}");

    return {
      transcript: transcriptText,
      score: data.score || 5,
      contradiction: data.contradiction || null,
      emotion: data.emotion || "Neutral (Text Inferred)",
      followUpQuestion: data.followUpQuestion || null
    };
  }

  // Helper: Convert any audio input (mp4, webm, etc.) to WAV for OpenAI
  private static async ensureWav(inputPath: string): Promise<string> {
    if (inputPath.toLowerCase().endsWith('.wav')) return inputPath;

    const outputPath = inputPath.replace(/\.[^/.]+$/, "") + ".wav";
    console.log(`[AIShadow] Converting ${path.basename(inputPath)} to WAV...`);

    try {
      await execAsync(`ffmpeg -i "${inputPath}" -ac 1 -ar 24000 -y "${outputPath}"`);
      return outputPath;
    } catch (e) {
      console.error("[AIShadow] FFmpeg conversion failed:", e);
      // THROW so the main loop catches it and switches to analyzeViaWhisper
      throw new Error("FFmpeg conversion failed - cannot proceed with Direct Audio analysis");
    }
  }

  // Main Orchestrator
  private static async analyzeWithOpenAI(audioPath: string, context: string[], resumeData: any | null): Promise<AIAnalysisResult> {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("[AIShadow] OPENAI_API_KEY is missing. Using mock analysis.");
      return this.mockLLMAnalysis("Audio analysis skipped (No Key)", context);
    }

    try {
      const absolutePath = path.resolve(process.cwd(), audioPath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Audio file not found at ${absolutePath}`);
      }

      // [NEW] Generate the System Prompt using Resume Data
      const systemPrompt = this.getSystemPrompt(resumeData);

      // [FIX] Always convert to WAV before sending to GPT-4o Audio
      const wavPath = await this.ensureWav(absolutePath);

      // Try Direct Audio (Preferred)
      try {
        const fileBuffer = fs.readFileSync(wavPath);
        const base64Audio = fileBuffer.toString('base64');
        return await this.analyzeDirectAudio(base64Audio, context, systemPrompt);
      } catch (err: any) {
        // If GPT-4o Audio fails, fallback to Whisper
        if (err?.status === 400) {
          console.warn("[AIShadow] Direct audio rejected (400). Switching to Whisper fallback.");
          return await this.analyzeViaWhisper(absolutePath, context, systemPrompt);
        }
        throw err;
      }

    } catch (error) {
      console.error("[AIShadow] All OpenAI methods failed:", error);
      return this.mockLLMAnalysis("Audio processing failed", context);
    }
  }

  // Entry point
  static async processAnswer(interviewId: string, mediaRecordId: string, audioPath: string) {
    try {
      // 1. Get Context AND Resume Data
      const interview = await prisma.interview.findUnique({
        where: { id: interviewId },
        select: { resumeData: true } // [UPDATED] Fetch the stored GitHub scan
      });

      const previousRecords = await prisma.mediaRecord.findMany({
        where: { interviewId, type: 'audio', id: { not: mediaRecordId } },
        select: { transcript: true },
        orderBy: { createdAt: 'asc' }
      });

      const context = previousRecords
        .map((r: { transcript: string | null }) => r.transcript)
        .filter((t: string | null): t is string => t !== null && t.length > 0);

      // 2. Analyze (Pass resumeData)
      const analysis = await this.analyzeWithOpenAI(audioPath, context, interview?.resumeData);

      // 3. Save to DB
      const shadowAnalysisData = {
        score: analysis.score,
        contradiction: analysis.contradiction,
        emotion: analysis.emotion,
        generatedAt: new Date().toISOString()
      };

      await prisma.mediaRecord.update({
        where: { id: mediaRecordId },
        data: {
          transcript: analysis.transcript,
          analysisJson: shadowAnalysisData,
          processingStage: 'completed',
          processed: true
        }
      });

      // 4. Follow-up
      if (analysis.followUpQuestion) {
        // [UPDATED] Pass transcript to allow coding question generation
        await this.addFollowUpQuestion(interviewId, analysis.followUpQuestion, analysis.transcript);
      }

      // 5. Summary
      await this.updateInterviewSummary(interviewId);

      return analysis;

    } catch (error) {
      console.error("[AIShadow] Error processing answer:", error);
    }
  }

  // [UPDATED] addFollowUpQuestion with Coding Challenge Logic
  private static async addFollowUpQuestion(interviewId: string, text: string, transcriptForContext?: string) {
    const interview = await prisma.interview.findUnique({ 
        where: { id: interviewId },
        include: { template: true }
    });
    
    if (!interview) return;

    // [FIX 3] Merge config correctly (from previous turn)
    let activeConfig: any = interview.customConfig 
      ? JSON.parse(JSON.stringify(interview.customConfig)) 
      : (interview.template?.config ? JSON.parse(JSON.stringify(interview.template.config)) : {});

    const questions = Array.isArray(activeConfig.questions) ? activeConfig.questions : [];

    // Limit follow-ups to 3
    const followUpCount = questions.filter((q: any) => q.id.startsWith('ai-followup') || q.id.startsWith('ai-code')).length;
    if (followUpCount >= 3) return;

    // [NEW] DECISION LOGIC: 
    // If the follow-up text explicitly asks to "write code" or "implement", 
    // generate a coding challenge.
    const requiresCoding = text.toLowerCase().includes("implement") || text.toLowerCase().includes("write code") || text.toLowerCase().includes("coding problem");

    let newQuestion;

    if (requiresCoding && transcriptForContext) {
         try {
             // 1. Generate the Code Question
             const codeQuestionRaw = await generateContextAwareCodingQuestion(transcriptForContext);
             
             // 2. Format it for the config
             newQuestion = {
                 ...codeQuestionRaw, // Spread the AI generated fields (starterCode, testCases, etc)
                 id: `ai-code-${Date.now()}`,
                 // Ensure type is 'code' so the frontend renders the IDE
                 type: 'code' 
             };
         } catch (error) {
             console.error("[AIShadow] Failed to generate coding question, falling back to audio:", error);
             // Fallback to standard audio question
             newQuestion = {
                id: `ai-followup-${Date.now()}`,
                text: `(Follow-up) ${text}`,
                type: 'audio', 
                durationSec: 60
             };
         }
    } else {
         // Standard Audio/Text Follow-up
         newQuestion = {
            id: `ai-followup-${Date.now()}`,
            text: `(Follow-up) ${text}`,
            type: 'audio', 
            durationSec: 60
         };
    }

    activeConfig.questions = [...questions, newQuestion];

    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        customConfig: activeConfig
      }
    });
  }

  private static async updateInterviewSummary(interviewId: string) {
    const records = await prisma.mediaRecord.findMany({
      where: { interviewId, analysisJson: { not: null } }
    });

    const totalScore = records.reduce((acc: number, r: MediaRecord) => {
      const analysis = (r.analysisJson as unknown as AIAnalysisJson) || {};
      return acc + (analysis?.score || 0);
    }, 0);

    const count = records.length || 1;
    const avgScore = totalScore / count;

    const aiSummaryData = {
      overallScore: avgScore.toFixed(1),
      strengths: avgScore > 7 ? ["Technical Proficiency", "Clarity"] : ["Communication"],
      weaknesses: avgScore < 5 ? ["Depth of Knowledge"] : [],
      lastUpdated: new Date().toISOString()
    };

    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        aiSummary: aiSummaryData
      }
    });
  }
}