// src/voice-visualizer/useAudioAmplitude.ts
import { useEffect, useRef, useState } from 'react';

export function useAudioAmplitude(active: boolean) {
  const [amplitude, setAmplitude] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!active) return;

    let rafId: number;

    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();

      analyser.fftSize = 512;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(dataRef.current!);
        const avg =
          dataRef.current!.reduce((a, b) => a + b, 0) /
          dataRef.current!.length;

        setAmplitude(avg / 255); // normalize 0–1
        rafId = requestAnimationFrame(tick);
      };

      tick();
    };

    init();

    return () => {
      cancelAnimationFrame(rafId);
      audioCtxRef.current?.close();
    };
  }, [active]);

  return amplitude;
}
