import WebSocket from "ws";

/**
 * Official Hume Streaming TTS endpoint
 * https://dev.hume.ai/reference/text-to-speech-tts/stream-input
 */
const HUME_TTS_STREAM_URL = "wss://api.hume.ai/v0/tts/stream/input";

type HumeTTSStreamOptions = {
  voice?: string;
  instantMode?: boolean;
  noBinary?: boolean;
};

/**
 * Stream text-to-speech audio from Hume via WebSocket
 *
 * @param text - Text to synthesize
 * @param onAudioChunk - Callback for each audio chunk (PCM/WAV)
 * @param options - Streaming options
 */
export function streamHumeTTS(
  text: string,
  onAudioChunk: (chunk: Buffer) => void,
  options: HumeTTSStreamOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process.env.HUME_API_KEY) {
      reject(new Error("HUME_API_KEY not set"));
      return;
    }

    // --------------------------------------------------
    // 1️⃣ Build WebSocket URL with query params
    // --------------------------------------------------
    const url = new URL(HUME_TTS_STREAM_URL);

    // Auth (allowed by Hume docs)
    url.searchParams.set("api_key", process.env.HUME_API_KEY);

    // Ultra-low latency streaming
    if (options.instantMode !== false) {
      url.searchParams.set("instant_mode", "true");
    }

    // If false → binary audio frames are sent
    if (options.noBinary === true) {
      url.searchParams.set("no_binary", "true");
    }

    // --------------------------------------------------
    // 2️⃣ Open WebSocket
    // --------------------------------------------------
    const ws = new WebSocket(url.toString());

    ws.on("open", () => {
      // ------------------------------------------------
      // 3️⃣ Send text input (stream input protocol)
      // ------------------------------------------------
      ws.send(
        JSON.stringify({
          text,
          voice: options.voice ?? "rajesh", // default voice
        })
      );
    });

    ws.on("message", (data) => {
      // ------------------------------------------------
      // 4️⃣ Handle streamed responses
      // ------------------------------------------------

      // Case A: Binary audio chunk
      if (Buffer.isBuffer(data)) {
        onAudioChunk(data);
        return;
      }

      // Case B: JSON control / metadata frame
      if (typeof data === "string") {
        try {
          const msg = JSON.parse(data);

          // Some frames are metadata, timestamps, etc.
          if (msg.type === "error") {
            reject(new Error(msg.message || "Hume TTS error"));
            ws.close();
          }

          // If no_binary=true, audio may arrive base64-encoded
          if (msg.audio) {
            const audioBuffer = Buffer.from(msg.audio, "base64");
            onAudioChunk(audioBuffer);
          }

          // End of stream
          if (msg.is_final === true) {
            ws.close();
          }
        } catch {
          // Ignore non-JSON text frames
        }
      }
    });

    ws.on("close", () => {
      resolve();
    });

    ws.on("error", (err) => {
      reject(err);
    });
  });
}
