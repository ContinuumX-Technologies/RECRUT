import WebSocket from "ws";
import OpenAI from "openai";

export function setupRealtimeInterviewWSS(server: any) {
  const wss = new WebSocket.Server({ server, path: "/ws/realtime" });

  wss.on("connection", async (client) => {
    console.log("🎙️ Frontend connected to Realtime WS");

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
    });

    // 🎧 AUDIO FROM BROWSER → OPENAI
    client.on("message", (data) => {
      if (openaiWS.readyState !== WebSocket.OPEN) return;

      openaiWS.send(JSON.stringify({
        type: "input_audio_buffer.append",
        audio: Buffer.from(data as Buffer).toString("base64")
      }));
    });

    // 🧠 OPENAI EVENTS → FRONTEND
    openaiWS.on("message", (msg) => {
      client.send(msg.toString());
    });

    client.on("close", () => {
      openaiWS.close();
    });
  });
}
