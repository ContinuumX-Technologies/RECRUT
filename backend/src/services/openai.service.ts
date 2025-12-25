import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function generateAIQuestion(input: {
    difficulty: string;
    dataStructure: string;
    algorithm: string;
    promptHint?: string;
}) {
    const prompt = `
  Create a LeetCode-style coding question.
  
  Difficulty: ${input.difficulty}
  Data Structure: ${input.dataStructure}
  Algorithm: ${input.algorithm}
  Additional Instructions: ${input.promptHint || "None"}
  
  Return ONLY valid JSON. Do NOT include markdown or explanations.
  
  JSON FORMAT:
  {
    "title": "",
    "description": "",
    "starterCode": {
      "javascript": "",
      "python": ""
    },
    "testCases": [{ "input": "", "output": "" }],
    "hiddenTestCases": [{ "input": "", "output": "" }]
  }
  `;

    const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1
    });

    const raw = response.choices[0]?.message?.content;

    if (!raw) {
        throw new Error("OpenAI returned empty response");
    }

    // 🔒 CLEAN MARKDOWN WRAPPERS
    const cleaned = raw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch (err) {
        console.error("❌ AI RAW OUTPUT:", raw);
        throw new Error("Invalid JSON returned from OpenAI");
    }
}
