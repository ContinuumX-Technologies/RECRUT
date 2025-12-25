// src/voice-visualizer/MorphingVoiceRecorder.tsx
import { useEffect, useRef, useState } from 'react';
import { useAudioAmplitude } from './useAudioAmplitude';
import './morphingSphere.css';

type Props = {
  onComplete?: () => void;
};

const PARTICLES = 600;
const BASE_RADIUS = 90;

export default function MorphingVoiceRecorder({ onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [recording, setRecording] = useState(false);
  const amplitude = useAudioAmplitude(recording);

  const particles = useRef(
    Array.from({ length: PARTICLES }).map(() => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      return { theta, phi };
    })
  );

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = 400 * dpr;
    canvas.height = 400 * dpr;
    ctx.scale(dpr, dpr);

    const render = () => {
      ctx.clearRect(0, 0, 400, 400);
      ctx.translate(200, 200);

      const radius = BASE_RADIUS + amplitude * 60;

      particles.current.forEach(p => {
        const r = radius + Math.random() * amplitude * 20;
        const x = r * Math.sin(p.phi) * Math.cos(p.theta);
        const y = r * Math.sin(p.phi) * Math.sin(p.theta);

        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 200, ${0.6 + amplitude})`;
        ctx.fill();
      });

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      requestAnimationFrame(render);
    };

    render();
  }, [amplitude]);

  return (
    <div className="morphing-recorder">
      <canvas ref={canvasRef} />
      <button
        className={`record-btn ${recording ? 'active' : ''}`}
        onClick={() => {
          if (recording && onComplete) onComplete();
          setRecording(!recording);
        }}
      >
        {recording ? 'Stop Recording' : 'Start Recording'}
      </button>
    </div>
  );
}
