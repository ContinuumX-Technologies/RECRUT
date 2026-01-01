import fs from "fs";
import path from "path";
import { HumeClient } from "hume";
import { v4 as uuidv4 } from "uuid";

// 1. Ensure dotenv is configured if running locally
// require('dotenv').config(); 

const hume = new HumeClient({
  apiKey: process.env.HUME_API_KEY!,
});

// 2. USE ID, NOT NAME
// If "Rajesh" is a custom voice, you MUST use its ID.
// Using just the name with provider "HUME_AI" only works for stock voices (e.g., "Kora").
const RAJESH_VOICE_ID = "8b9ed861-3382-455d-9c03-a40671943d6b"; 

// If you really want to use a stock voice, change this to:
// const STOCK_VOICE = { name: "Matt", provider: "HUME_AI" } as const;

export async function synthesizeRajeshVoice(
  text: string
): Promise<{ audioPath: string }> {

  const outputDir = path.resolve("public/ai-voice");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = `rajesh-${uuidv4()}.mp3`;
  const outputPath = path.join(outputDir, fileName);

  try {
    const response = await hume.tts.synthesizeJson({
      utterances: [
        {
          text,
          // 3. Pass the ID directly for custom voices
          voice: {
            id: RAJESH_VOICE_ID, 
          },
        },
      ],
      // 4. Explicitly requesting MP3 is safer for file writing
      // If 'Format' enum fails, you can sometimes skip it, but this is best practice:
      // format: "mp3" as any, // or import { Format } from "hume/api/resources/tts";
    });

    // 5. Safety check on the response structure
    const base64Audio = response.generations?.[0]?.audio;
    
    if (!base64Audio) {
      console.error("Hume Response:", JSON.stringify(response, null, 2));
      throw new Error("Hume TTS returned no audio data. Check if Voice ID is valid.");
    }

    const buffer = Buffer.from(base64Audio, "base64");
    fs.writeFileSync(outputPath, buffer);

    return { audioPath: `/ai-voice/${fileName}` };
    
  } catch (error) {
    console.error("Error synthesizing voice:", error);
    throw error;
  }
}