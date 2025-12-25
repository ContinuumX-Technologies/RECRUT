import { Router } from "express";
import { verifySolution } from "../services/verify.service";

const router = Router();

router.post("/verify-solution", verifySolution);

export default router;
