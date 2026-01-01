import { Router } from "express";
import { generateAIQuestion, generateSpeech } from "../services/openai.service";

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

router.post("/speak", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      res.status(400).json({ message: "Text is required" });
      return; // Ensure the function exits
    }

    const audioBuffer = await generateSpeech(text);

    // Send back audio stream
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
    });
    res.send(audioBuffer);
  } catch (err: any) {
    console.error("TTS Route Error:", err.message);
    res.status(500).json({
      message: "Text-to-speech generation failed",
      error: err.message
    });
  }
});

export default router;
