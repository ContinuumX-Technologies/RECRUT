import { Router } from "express";
import { runCode, submitCode } from "../services/judge.service";

const router = Router();

router.post("/run", runCode);
router.post("/submit", submitCode);

export default router;
