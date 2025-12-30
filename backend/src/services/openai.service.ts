import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid"; // [ADD]: Import UUID generator

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
    Create a professional LeetCode-style coding question.
    
    Difficulty: ${input.difficulty}
    Data Structure: ${input.dataStructure}
    Algorithm: ${input.algorithm}
    Additional Instructions: ${input.promptHint || "None"}
    
    CRITICAL REQUIREMENTS:
    1. STARTER CODE: Provide a function named "solution" with appropriate parameters.
    2. AUTOMATIC INPUTS: You MUST include a "Driver" section at the bottom of the starter code. 
       - For JavaScript: Use 'fs.readFileSync(0)' to read from stdin, 'JSON.parse' the input, and spread it into the 'solution' function.
       - For Python: Use 'sys.stdin.read()', 'json.loads' the input, and spread it into the 'solution' function.
    3. TEST CASES: The "input" field in testCases must be a JSON-stringified ARRAY of arguments that match the solution function parameters. 
    4. DESCRIPTION: Include clear constraints and at least two examples.
  
    Return ONLY valid JSON. Do NOT include markdown or explanations.
    
    JSON FORMAT (MUST MATCH EXACTLY):
    {
      "id": "temp-ai-id",
      "text": "The Title of the Question",
      "type": "code",
      "difficulty": "${input.difficulty}",
      "language": "javascript", 
      "description": "Full problem description including constraints and examples.",
      "starterCode": {
        "javascript": "function solution(...) {\\n  // ...\\n}\\n\\n// --- INTERNAL DRIVER --- ...",
        "python": "import sys, json\\ndef solution(...):\\n    # ...\\n# --- INTERNAL DRIVER --- ..."
      },
      "testCases": [{ "input": "[...]", "output": "..." }],
      "hiddenTestCases": [{ "input": "[...]", "output": "..." }]
    }
    `;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Corrected model name
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1
    });


    const raw = response.choices[0]?.message?.content;

    console.log("🤖 AI RAW RESPONSE:", raw);

    if (!raw) {
        throw new Error("OpenAI returned empty response");
    }

    // 🔒 CLEAN MARKDOWN WRAPPERS
    const cleaned = raw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    try {
        const parsed = JSON.parse(cleaned);
        // [FIX]: Overwrite placeholder with a real unique UUID
        parsed.id = uuidv4();
        console.log("✅ AI PARSED OUTPUT:", parsed);
        return parsed;
    } catch (err) {
        console.error("❌ AI RAW OUTPUT:", raw);
        throw new Error("Invalid JSON returned from OpenAI");
    }
}

/**
 * [NEW] Generates a coding question dynamically based on the candidate's voice answer.
 * @param transcript - The candidate's spoken answer transcribed to text.
 * @param context - (Optional) Previous conversation context to ensure relevance.
 */
export async function generateContextAwareCodingQuestion(transcript: string, context: string[] = []) {
    
    // Construct a context-aware prompt
    const prompt = `
    The candidate is in a technical interview.
    
    CONTEXT (Previous interaction):
    ${context.slice(-2).join('\n')}
    
    CANDIDATE'S LAST ANSWER (Voice Transcript):
    "${transcript}"
    
    TASK:
    Analyze the candidate's answer. Identify a specific data structure, algorithm, or concept they mentioned (or one that logically follows).
    Create a professional LeetCode-style coding question to test that specific concept.
    
    - If they mentioned "HashMaps", generate a HashMap problem.
    - If they mentioned "Recursion", generate a Recursion problem.
    - If the answer was vague, default to a classic "Array" or "String" manipulation problem.
    
    CRITICAL REQUIREMENTS (SAME AS STANDARD GENERATOR):
    1. STARTER CODE: Provide a function named "solution" with appropriate parameters.
    2. AUTOMATIC INPUTS: You MUST include a "Driver" section at the bottom of the starter code. 
       - For JavaScript: Use 'fs.readFileSync(0)' to read from stdin, 'JSON.parse' the input, and spread it into the 'solution' function.
       - For Python: Use 'sys.stdin.read()', 'json.loads' the input, and spread it into the 'solution' function.
    3. TEST CASES: The "input" field in testCases must be a JSON-stringified ARRAY of arguments that match the solution function parameters. 
    4. DESCRIPTION: Include clear constraints and at least two examples.
  
    Return ONLY valid JSON.
    
    JSON FORMAT (MUST MATCH EXACTLY):
    {
      "id": "temp-ai-id",
      "text": "A Short Title Based on Topic",
      "type": "code",
      "difficulty": "Medium",
      "language": "javascript", 
      "description": "Full problem description...",
      "starterCode": {
        "javascript": "function solution(...) {\\n  // ...\\n}\\n\\n// --- INTERNAL DRIVER --- ...",
        "python": "import sys, json\\ndef solution(...):\\n    # ...\\n# --- INTERNAL DRIVER --- ..."
      },
      "testCases": [{ "input": "[...]", "output": "..." }],
      "hiddenTestCases": [{ "input": "[...]", "output": "..." }]
    }
    `;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Using standard 4o for better logic inference from text
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
    });

    const raw = response.choices[0]?.message?.content;
    console.log("🤖 AI CONTEXTUAL QUESTION RAW:", raw);

    if (!raw) {
        throw new Error("OpenAI returned empty response");
    }

    const cleaned = raw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    try {
        const parsed = JSON.parse(cleaned);
        parsed.id = uuidv4(); // Assign real UUID
        
        // Metadata to help track why this question was generated
        parsed.generatedReason = "Follow-up to voice answer";
        
        console.log("✅ AI CONTEXTUAL PARSED:", parsed);
        return parsed;
    } catch (err) {
        console.error("❌ AI PARSE ERROR:", raw);
        throw new Error("Invalid JSON returned from OpenAI during contextual generation");
    }
}