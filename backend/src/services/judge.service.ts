import { Request, Response } from "express";
import { executeInDocker } from "../utils/docker";
import { prisma } from "../lib/prisma";

/**
 * RUN → visible test cases only
 */
export async function runCode(req: Request, res: Response) {
  const { code, language, questionId } = req.body;

  if (!code || !questionId) {
    return res.status(400).json({ error: "code and questionId required" });
  }

  // 1️⃣ Fetch interviews that have customConfig or template
  const interviews = await prisma.interview.findMany({
    include: { template: true }
  });

  // 2️⃣ Find question in JS (SQLite-safe)
  let foundQuestion: any = null;

  for (const interview of interviews) {
    const config =
      (interview.customConfig as any) ||
      (interview.template?.config as any);

    if (!config?.questions) continue;

    const q = config.questions.find((x: any) => x.id === questionId);
    if (q) {
      foundQuestion = q;
      break;
    }
  }

  if (!foundQuestion || !Array.isArray(foundQuestion.testCases)) {
    return res.json({ testResults: [] });
  }

  // 3️⃣ Run visible test cases
  const results = [];

  for (const tc of foundQuestion.testCases) {
    try {
      const { output, timeMs } = await executeInDocker(
        language,
        code,
        tc.input
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
  const { code, language, questionId } = req.body;

  if (!code || !language || !questionId) {
    return res.status(400).json({ error: "Invalid submission payload" });
  }

  const hiddenTestCases = await getHiddenTestCases(questionId);

  let totalTime = 0;

  for (const tc of hiddenTestCases) {
    const { output, timeMs } = await executeInDocker(
      language,
      code,
      tc.input
    );

    totalTime += timeMs;

    if (output.trim() !== tc.output.trim()) {
      return res.json({ status: "Wrong Answer" });
    }
  }

  return res.json({
    status: "Accepted",
    timeMs: totalTime,
    memoryMb: 256
  });
}

async function getHiddenTestCases(questionId: string) {
  const interviews = await prisma.interview.findMany({
    include: { template: true }
  });

  for (const interview of interviews) {
    const config =
      (interview.customConfig as any) ||
      (interview.template?.config as any);

    if (!config?.questions) continue;

    const question = config.questions.find(
      (q: any) => q.id === questionId
    );

    if (question?.hiddenTestCases) {
      return question.hiddenTestCases;
    }
  }

  throw new Error("Hidden test cases not found");
}
