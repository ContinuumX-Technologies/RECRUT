import WebSocket from "ws";
import { IncomingMessage } from "http";
import OpenAI from "openai";
import { prisma } from "../lib/prisma";
import { generateContextAwareCodingQuestion } from "../services/openai.service";
import { streamHumeTTS } from "../ws/humeTTS.ws";

// =====================================================
// OpenAI client (decision logic)
// =====================================================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =====================================================
// Realtime Interview WebSocket
// =====================================================
export function setupRealtimeInterviewWSS(server: any) {
  const wss = new WebSocket.Server({
    server,
    path: "/ws/realtime",
  });

  wss.on("connection", async (client: WebSocket, req: IncomingMessage) => {
    console.log("🎙️ Frontend connected to Realtime WS:", req.url);

    // -------------------------------------------------
    // 1️⃣ Extract interviewId
    // -------------------------------------------------
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const interviewId = url.searchParams.get("interviewId");

    if (!interviewId) {
      console.warn("⚠️ WS connection ignored (missing interviewId)");
      client.close();
      return;
    }

    console.log("✅ Realtime interview session:", interviewId);

    // -------------------------------------------------
    // 2️⃣ Connect to OpenAI Realtime
    // -------------------------------------------------
    const openaiWS = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    openaiWS.on("open", () => {
      console.log("🤖 Connected to OpenAI Realtime");

      // Enable transcription
      openaiWS.send(
        JSON.stringify({
          type: "session.update",
          session: {
            input_audio_transcription: { model: "whisper-1" },
          },
        })
      );
    });

    // -------------------------------------------------
    // 3️⃣ Browser Audio → OpenAI Realtime
    // -------------------------------------------------
    client.on("message", (data) => {
      if (openaiWS.readyState !== WebSocket.OPEN) return;

      openaiWS.send(
        JSON.stringify({
          type: "input_audio_buffer.append",
          audio: Buffer.from(data as Buffer).toString("base64"),
        })
      );
    });

    // -------------------------------------------------
    // 4️⃣ OpenAI Events → Decision + Follow-up
    // -------------------------------------------------
    openaiWS.on("message", async (msg) => {
      const event = JSON.parse(msg.toString());

      if (
        event.type ===
        "conversation.item.input_audio_transcription.completed"
      ) {
        const transcript: string = event.transcript;
        console.log(`🎤 User Transcript: "${transcript}"`);

        if (!transcript || transcript.trim().length < 10) return;

        try {
          // -------------------------------------------------
          // 5️⃣ Decide follow-up type
          // -------------------------------------------------
          const decision = await analyzeFollowUpNeeds(transcript);

          let newQuestion: any;

          if (decision.type === "code") {
            console.log("👉 Decision: CODING follow-up");
            newQuestion = await generateContextAwareCodingQuestion(transcript);
          } else {
            console.log("👉 Decision: CONVERSATIONAL follow-up");
            newQuestion = {
              id: `ai-followup-${Date.now()}`,
              text:
                decision.suggestedText ||
                "Could you elaborate on that?",
              type: "audio",
              durationSec: 60,
              generatedReason: "Conversational Follow-up",
            };
          }

          // -------------------------------------------------
          // 6️⃣ Save to database
          // -------------------------------------------------
          const interview = await prisma.interview.findUnique({
            where: { id: interviewId },
            select: { customConfig: true, template: true },
          });

          if (interview) {
            const currentConfig =
              (interview.customConfig as any) ||
              (interview.template?.config as any) ||
              {};

            const updatedQuestions = [
              ...(currentConfig.questions || []),
              newQuestion,
            ];

            await prisma.interview.update({
              where: { id: interviewId },
              data: {
                customConfig: {
                  ...currentConfig,
                  questions: updatedQuestions,
                },
              },
            });

            console.log("✅ Database updated via Realtime");

            // Notify frontend
            client.send(
              JSON.stringify({
                type: "question_generated",
                question: newQuestion,
              })
            );
          }

          // -------------------------------------------------
          // 7️⃣ 🔊 Stream Hume TTS (WebSocket → frontend)
          // -------------------------------------------------
          streamHumeTTS(
            newQuestion.text,
            (audioChunk) => {
              client.send(
                JSON.stringify({
                  type: "tts_audio_chunk",
                  questionId: newQuestion.id,
                  audio: audioChunk.toString("base64"),
                })
              );
            },
            {
              voice: "rajesh",
              instantMode: true,
            }
          ).catch((err) => {
            console.error("❌ Hume TTS stream failed:", err);
          });

        } catch (err) {
          console.error("❌ Error processing transcript:", err);
        }
      }

      // Optional: relay OpenAI events to frontend
      client.send(msg.toString());
    });

    client.on("close", () => {
      console.log("🔌 Realtime WS closed:", interviewId);
      openaiWS.close();
    });
  });
}

// =====================================================
// Decision Helper
// =====================================================
async function analyzeFollowUpNeeds(
  transcript: string
): Promise<{
  type: "code" | "conversation";
  suggestedText?: string;
}> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are an Interview Director.

Rules:
1. If the candidate mentions data structures or algorithms AND should demonstrate them → "code".
2. Otherwise → "conversation".
3. Provide a concise follow-up question.

Return JSON:
{ "type": "code" | "conversation", "suggestedText": "..." }
          `,
        },
        { role: "user", content: transcript },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content;
    return raw
      ? JSON.parse(raw)
      : { type: "conversation", suggestedText: "Tell me more." };
  } catch {
    return {
      type: "conversation",
      suggestedText: "Could you elaborate?",
    };
  }
}
