const fs = require('fs');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// ==========================================
// CONFIGURATION
// ==========================================
const API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE";
const INPUT_FILE = "Yash_Behera_Resume (1).pdf"; 
const OUTPUT_FILE = "parsed_resume.json";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ==========================================
// 1. EXTRACT TEXT FROM PDF (ROBUST)
// ==========================================
async function extractTextFromPDF(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      console.error(`❌ Error reading PDF: ${error.message}`);
      return null;
    }
  }

// ==========================================
// 2. PARSE WITH GEMINI
// ==========================================
async function parseWithGemini(resumeText) {
    const prompt = `
    You are an expert Resume Parser. 
    Analyze the following resume text and extract the details into a structured JSON format.
    
    Requirements:
    1. Extract 'Experience' and 'Projects' sections.
    2. For each entry, identify the 'Title' (Role or Project Name), 'Company' (if applicable), 'Date', and 'Skills'.
    3. 'Skills' should be a list of technical tools mentioned in that specific entry. If a skill is implied (e.g., "built a backend in Java"), include 'Java'.
    4. Also extract a 'Global_Skills' list from the dedicated Skills section if it exists.
    5. Return ONLY valid JSON. No Markdown, no backticks.

    Resume Text:
    ${resumeText}
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Cleanup: Remove markdown formatting
        text = text.replace(/^```json/, '').replace(/```$/, '').trim();

        return JSON.parse(text);
    } catch (error) {
        console.error(`❌ AI Error: ${error.message}`);
        return null;
    }
}

// ==========================================
// MAIN EXECUTION
// ==========================================
async function main() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ File '${INPUT_FILE}' not found.`);
        return;
    }

    console.log(`📄 Reading: ${INPUT_FILE}...`);
    const rawText = await extractTextFromPDF(INPUT_FILE);

    if (rawText) {
        console.log("🤖 Sending to Gemini...");
        const parsedData = await parseWithGemini(rawText);

        if (parsedData) {
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(parsedData, null, 2));
            console.log(`✅ SUCCESS! Saved to ${OUTPUT_FILE}`);
            console.log("\n--- PREVIEW ---");
            console.log(JSON.stringify(parsedData, null, 2));
        } else {
            console.log("❌ Failed to parse JSON.");
        }
    }
}

main();