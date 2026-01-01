import { Router } from "express";
import { generateAIQuestion } from "../services/openai.service";

const router = Router();

router.post("/ai-generate-question", async (req, res) => {
    try {
      const result = await generateAIQuestion(req.body);
      res.json(result);
    } catch (err: any) {
      console.error("AI Generation Error:", err.message);
      res.status(500).json({
        message: "AI generation failed",
        error: err.message
      });
    }
  });
  

export default router;
