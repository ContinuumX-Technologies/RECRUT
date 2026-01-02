import WebSocket from "ws";
import { IncomingMessage } from "http";
import OpenAI from "openai";
import { prisma } from "../lib/prisma";
import { generateContextAwareCodingQuestion } from "../services/openai.service";

// We'll use a local instance for the "Decision" logic
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function setupRealtimeInterviewWSS(server: any) {
  const wss = new WebSocket.Server({ server, path: "/ws/realtime" });

  wss.on("connection", async (client: WebSocket, req: IncomingMessage) => {
    console.log("🎙️ Frontend connected to Realtime WS");

    // 1. EXTRACT INTERVIEW ID
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const interviewId = url.searchParams.get("interviewId");

    if (!interviewId) {
      console.error("❌ No interviewId provided in WS connection");
      client.close();
      return;
    }

    const openaiWS = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1"
        }
      }
    );

    openaiWS.on("open", () => {
      console.log("🤖 Connected to OpenAI Realtime");
      
      // Ensure we get transcriptions
      openaiWS.send(JSON.stringify({
        type: "session.update",
        session: {
          input_audio_transcription: { model: "whisper-1" }
        }
      }));
    });

    // 🎧 AUDIO FROM BROWSER → OPENAI
    client.on("message", (data) => {
      if (openaiWS.readyState !== WebSocket.OPEN) return;
      openaiWS.send(JSON.stringify({
        type: "input_audio_buffer.append",
        audio: Buffer.from(data as Buffer).toString("base64")
      }));
    });

    // 🧠 OPENAI EVENTS → BACKEND LOGIC
    openaiWS.on("message", async (msg) => {
      const event = JSON.parse(msg.toString());

      // 2. INTERCEPT TRANSCRIPTION
      if (event.type === "conversation.item.input_audio_transcription.completed") {
        const transcript = event.transcript;
        console.log(`🎤 User Transcript: "${transcript}"`);

        if (transcript && transcript.trim().length > 10) {
          try {
            console.log("🧠 Analyzing transcript for follow-up type...");
            
            // 3. DECISION STEP: Code vs. Conversation?
            // We ask a fast model to decide the next best step
            const decision = await analyzeFollowUpNeeds(transcript);
            
            let newQuestion;

            if (decision.type === 'code') {
               console.log("👉 Decision: Generate CODING Challenge");
               newQuestion = await generateContextAwareCodingQuestion(transcript);
            } else {
               console.log("👉 Decision: Generate CONVERSATIONAL Follow-up");
               // Create a standard text/voice question manually
               newQuestion = {
                  id: `ai-followup-${Date.now()}`,
                  text: decision.suggestedText || "Could you elaborate on that?",
                  type: 'audio', // 'audio' type means user speaks back
                  durationSec: 60,
                  generatedReason: "Conversational Follow-up"
               };
            }

            // 4. SAVE TO DATABASE
            const interview = await prisma.interview.findUnique({
              where: { id: interviewId },
              select: { customConfig: true, template: true }
            });

            if (interview) {
              const currentConfig = (interview.customConfig as any) || (interview.template?.config as any) || {};
              const currentQuestions = currentConfig.questions || [];

              // Prevent spamming: only add if we haven't just added one (optional logic)
              const updatedQuestions = [...currentQuestions, newQuestion];
              
              await prisma.interview.update({
                where: { id: interviewId },
                data: {
                  customConfig: {
                    ...currentConfig,
                    questions: updatedQuestions
                  }
                }
              });
              
              console.log("✅ Database updated via Realtime!");
              client.send(JSON.stringify({ type: "question_generated", question: newQuestion }));
            }

          } catch (err) {
            console.error("❌ Error processing answer:", err);
          }
        }
      }

      // Relay back to client
      client.send(msg.toString());
    });

    client.on("close", () => {
      openaiWS.close();
    });
  });
}

/**
 * Helper to determine if the candidate's answer triggers a Coding Question
 * or just a standard conversational follow-up.
 */
async function analyzeFollowUpNeeds(transcript: string): Promise<{ type: 'code' | 'conversation', suggestedText?: string }> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast & Cheap
      messages: [
        {
          role: "system",
          content: `
          You are an Interview Director. Analyze the candidate's response.
          
          DECISION RULES:
          1. If the candidate mentions specific data structures (Arrays, Trees, HashMaps) or algorithms (DFS, BFS, Sorting) in a way that implies they should DEMONSTRATE it -> Return "code".
          2. If the candidate is just talking about soft skills, leadership, or high-level concepts -> Return "conversation".
          3. Also provide a specific follow-up question text.

          Return JSON: { "type": "code" | "conversation", "suggestedText": "..." }
          `
        },
        { role: "user", content: transcript }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const raw = completion.choices[0].message.content;
    return raw ? JSON.parse(raw) : { type: 'conversation', suggestedText: "Tell me more." };
  } catch (e) {
    console.warn("⚠️ Decision analysis failed, defaulting to conversation.");
    return { type: 'conversation', suggestedText: "Could you elaborate?" };
  }
}