import WebSocket from "ws";
import { IncomingMessage } from "http";
import { prisma } from "../lib/prisma";
import { streamHumeTTS } from "../ws/humeTTS.ws";

// =====================================================
// Realtime Interview WebSocket
// =====================================================
export function setupRealtimeInterviewWSS(server: any) {
  const wss = new WebSocket.Server({
    server,
    path: "/ws/realtime",
  });

  wss.on("connection", (client: WebSocket, req: IncomingMessage) => {
    console.log("🎙️ [WS] Frontend connected:", req.url);

    // =================================================
    // 1️⃣ Extract interviewId
    // =================================================
    let interviewId: string | null = null;

    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      interviewId = url.searchParams.get("interviewId");

      if (!interviewId) {
        console.warn("⚠️ [WS] Missing interviewId");
        client.close();
        return;
      }

      console.log("✅ [SESSION] Interview ID:", interviewId);
    } catch (err) {
      console.error("❌ [WS] Failed to parse interviewId:", err);
      client.close();
      return;
    }

    // =================================================
    // 2️⃣ OpenAI Realtime WebSocket
    // =================================================
    let openaiWS: WebSocket;
    let openaiReady = false;
    let frontendClosed = false;

    const audioQueue: Buffer[] = [];

    try {
      openaiWS = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "OpenAI-Beta": "realtime=v1",
          },
        }
      );
    } catch (err) {
      console.error("❌ [OPENAI] Failed to create WS:", err);
      client.close();
      return;
    }

    // =================================================
    // 3️⃣ OpenAI lifecycle
    // =================================================
    openaiWS.on("open", () => {
      console.log("🤖 [OPENAI] Realtime connected");

      try {
        // ---- Session configuration ----
        // ENABLE SERVER VAD
        openaiWS.send(
          JSON.stringify({
            type: "session.update",
            session: {
              modalities: ["text"], // Text only (we use Hume for audio)
              input_audio_transcription: { model: "whisper-1" },
              turn_detection: null,
              instructions: `
You are a Senior Software Engineer conducting a live technical interview.

Rules:
- ALWAYS SPEAK IN ENGLISH.
- Ask ONE concise spoken follow-up question
- Focus on why, complexity, trade-offs, scalability
- Never explain answers
- Never switch to coding
              `,
            },
          })
        );

        openaiReady = true;

        // ---- Flush buffered audio ----
        if (audioQueue.length > 0) {
          console.log(
            `🚀 [AUDIO] Flushing ${audioQueue.length} buffered chunks`
          );
          for (const chunk of audioQueue) {
            openaiWS.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: chunk.toString("base64"),
              })
            );
          }
          audioQueue.length = 0;
        }
      } catch (err) {
        console.error("❌ [OPENAI] Init failed:", err);
      }
    });

    openaiWS.on("error", (err) => {
      console.error("❌ [OPENAI] WS error:", err);
    });

    openaiWS.on("close", (code, reason) => {
      console.warn(
        `⚠️ [OPENAI] WS closed | code=${code} reason=${reason.toString()}`
      );
    });

    // =================================================
    // 4️⃣ Browser Audio → OpenAI
    // =================================================
    client.on("message", (data) => {
      try {
        // [FIX] Detect Control Signals (JSON) vs Audio (Buffer)
        const strData = data.toString();
        
        // Check if it's a COMMIT signal from frontend
        if (strData.startsWith("{") && strData.endsWith("}")) {
            try {
                const command = JSON.parse(strData);
                if (command.type === "commit") {
                    if (openaiReady && openaiWS.readyState === WebSocket.OPEN) {
                        console.log("▶️ [WS] Received manual COMMIT signal");
                        // Force commit and response generation
                        openaiWS.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
                        openaiWS.send(JSON.stringify({ type: "response.create" }));
                    }
                    return; // Stop processing this message
                }
            } catch (e) {
                // Not valid JSON, proceed as audio
            }
        }

        // Handle Audio Chunk
        const buffer = Buffer.from(data as Buffer);

        if (!openaiReady || openaiWS.readyState !== WebSocket.OPEN) {
          audioQueue.push(buffer);
          return;
        }

        openaiWS.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: buffer.toString("base64"),
          })
        );
      } catch (err) {
        console.error("❌ [AUDIO] Forward failed:", err);
      }
    });

    // =================================================
    // 5️⃣ OpenAI → Events
    // =================================================
    openaiWS.on("message", async (msg) => {
      let event: any;
      try {
        event = JSON.parse(msg.toString());
      } catch {
        return;
      }
      
      if (event.type === 'error') {
          console.error("❌ [OPENAI ERROR]", event.error);
      }

      // Transcript
      if (event.type === "conversation.item.input_audio_transcription.completed") {
        const transcript = event.transcript?.trim();
        if (transcript) {
          console.log("🎤 [CANDIDATE]", transcript);
        }
      }

      // AI Response (Text Generation Done)
      if (event.type === "response.done") {
        const outputItem = event.response?.output?.[0];

        if (
          outputItem?.type === "message" &&
          outputItem?.role === "assistant" &&
          outputItem?.content?.[0]?.type === "text"
        ) {
          const questionText = outputItem.content[0].text;
          if (!questionText) return;

          console.log("🤖 [AI QUESTION]", questionText);

          const newQuestion = {
            id: `ai-followup-${Date.now()}`,
            text: questionText,
            type: "audio",
            durationSec: 60,
            generatedReason: "Realtime AI Interviewer",
          };

          // ---- DB Update ----
          try {
            const interview = await prisma.interview.findUnique({
              where: { id: interviewId! },
              select: { customConfig: true, template: true },
            });

            if (interview) {
              const currentConfig =
                (interview.customConfig as any) ||
                (interview.template?.config as any) ||
                {};

              await prisma.interview.update({
                where: { id: interviewId! },
                data: {
                  customConfig: {
                    ...currentConfig,
                    questions: [
                      ...(currentConfig.questions || []),
                      newQuestion,
                    ],
                  },
                },
              });
            }
          } catch (err) {
            console.error("❌ [DB] Update failed:", err);
          }

          // ---- Frontend Notification ----
          try {
            client.send(
              JSON.stringify({
                type: "question_generated",
                question: newQuestion,
              })
            );
          } catch {}

          // ---- TTS Streaming ----
          try {
            await streamHumeTTS(
              questionText,
              (chunk) => {
                if (!frontendClosed) {
                  client.send(
                    JSON.stringify({
                      type: "tts_audio_chunk",
                      questionId: newQuestion.id,
                      audio: chunk.toString("base64"),
                    })
                  );
                }
              },
              { voice: "rajesh", instantMode: true }
            );
          } catch (err) {
            console.error("❌ [TTS] Failed:", err);
          }
        }
      }
    });

    // =================================================
    // 6️⃣ Graceful shutdown
    // =================================================
    client.on("close", () => {
      console.log("🔌 [WS] Frontend closed:", interviewId);
      frontendClosed = true;

      setTimeout(() => {
        if (openaiWS.readyState === WebSocket.OPEN) {
          console.log("🧹 [OPENAI] Closing after grace period");
          openaiWS.close();
        }
      }, 3000);
    });
  });
}