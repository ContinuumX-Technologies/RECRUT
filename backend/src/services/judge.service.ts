import { Request, Response } from "express";
import { executeInDocker } from "../utils/docker";
import { prisma } from "../lib/prisma";

/**
 * RUN → visible test cases only
 */
export async function runCode(req: Request, res: Response) {
  const { code, language, testCases } = req.body;

  // FIX: Ensure testCases is an iterable array
  if (!Array.isArray(testCases)) {
    return res.status(400).json({ error: "testCases must be an array" });
  }

  const results = [];

  for (const tc of testCases) {
    try {
      // Pass tc.input as a string to the docker executor
      const { output, timeMs } = await executeInDocker(
        language,
        code,
        typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input)
      );

      results.push({
        input: tc.input,
        expected: tc.output,
        actual: output,
        passed: output.trim() === tc.output.trim(),
        timeMs
      });
    } catch (err: any) {
      results.push({
        input: tc.input,
        error: err.toString(),
        passed: false
      });
    }
  }

  res.json({ testResults: results });
}

/**
 * SUBMIT → hidden test cases ONLY (from DB)
 */
export async function submitCode(req: Request, res: Response) {
  // Add interviewId to the destructuring (get it from the frontend)
  const { code, language, questionId, interviewId } = req.body;

  if (!code || !language || !questionId || !interviewId) {
    return res.status(400).json({ error: "Invalid submission payload" });
  }

  try {
    const hiddenTestCases = await getHiddenTestCases(interviewId, questionId);
    let totalTime = 0;

    for (const tc of hiddenTestCases) {
      const { output, timeMs } = await executeInDocker(language, code, tc.input);
      totalTime += timeMs;

      if (output.trim() !== tc.output.trim()) {
        return res.json({ status: "Wrong Answer" });
      }
    }

    return res.json({ status: "Accepted", timeMs: totalTime, memoryMb: 256 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

async function getHiddenTestCases(interviewId: string, questionId: string) {
  // 1. Fetch the interview record using a simple ID lookup (SQLite safe)
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: { template: true }
  });

  if (!interview) throw new Error("Interview not found");

  // 2. Extract configuration from the JSON field manually
  const config = (interview.customConfig as any) || (interview.template?.config as any);
  
  // 3. Find the specific question in the array
  const question = config?.questions?.find((q: any) => q.id === questionId);

  if (!question?.hiddenTestCases) {
    throw new Error("Hidden test cases not found for this question");
  }

  return question.hiddenTestCases;
}