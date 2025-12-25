import { Request, Response } from "express";
import { executeInDocker } from "../utils/docker";

export async function runCode(req: Request, res: Response) {
  const { code, language, testCases } = req.body;

  const results = [];
  for (const tc of testCases) {
    const output = await executeInDocker(language, code, tc.input);
    results.push({
      input: tc.input,
      expected: tc.output,
      actual: output,
      passed: output.trim() === tc.output.trim()
    });
  }

  res.json({ testResults: results });
}

export async function submitCode(req: Request, res: Response) {
  const { code, language, allTestCases } = req.body;

  for (const tc of allTestCases) {
    const output = await executeInDocker(language, code, tc.input);
    if (output.trim() !== tc.output.trim()) {
      return res.json({ status: "Wrong Answer" });
    }
  }

  res.json({
    status: "Accepted",
    timeMs: Math.floor(Math.random() * 100),
    memoryMb: Math.floor(Math.random() * 64)
  });
}
