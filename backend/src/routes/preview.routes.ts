import { Router } from "express";

const router = Router();

router.post("/preview", (req, res) => {
  res.json({
    preview: {
      title: req.body.text,
      description: req.body.description,
      language: req.body.language,
      sampleTestCases: req.body.testCases
    }
  });
});

export default router;
