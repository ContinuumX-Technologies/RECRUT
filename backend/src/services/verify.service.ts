import { Request, Response } from "express";

export function verifySolution(req: Request, res: Response) {
  const { code, expectedAlgorithm, expectedDataStructure } = req.body;

  const flags = {
    usesAlgorithm: code.includes(expectedAlgorithm),
    usesDataStructure: code.includes(expectedDataStructure)
  };

  res.json({
    passed: flags.usesAlgorithm && flags.usesDataStructure,
    details: flags
  });
}
