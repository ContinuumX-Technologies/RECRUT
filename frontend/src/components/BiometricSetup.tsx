// frontend/src/components/BiometricSetup.tsx
import { useState, useRef, useEffect } from 'react';

type Props = {
  interviewId: string;
  onComplete: () => void;
};

// Add type for WebGazer
declare global {
  interface Window {
    webgazer?: any;
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function BiometricSetup({ interviewId, onComplete }: Props) {
  // Steps: face → voice → calibration → done
  const [step, setStep] = useState<'face' | 'voice' | 'calibration' | 'done'>('face');
  const [loading, setLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // --- FACE CAPTURE ---
  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(s);
    } catch (err) {
      console.error('Failed to access camera:', err);
      alert('Could not access camera. Please allow permissions.');
    }
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    // Cleanup: if component unmounts after everything is done, stop tracks
    return () => {
      if (stream && step === 'done') {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream, step]);

  const capturePhoto = async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        setLoading(true);
        const fd = new FormData();
        fd.append('photo', blob, 'reference-face.jpg');

        try {
          await fetch(`${API_BASE}/api/interviews/${interviewId}/reference/face`, {
            method: 'POST',
            body: fd,
          });
          setStep('voice');
        } catch (error) {
          console.error('Upload failed', error);
        } finally {
          setLoading(false);
        }
      },
      'image/jpeg'
    );
  };

  // --- VOICE CAPTURE ---
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(s);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        setLoading(true);
        const fd = new FormData();
        fd.append('audio', blob, 'reference-voice.webm');

        try {
          await fetch(`${API_BASE}/api/interviews/${interviewId}/reference/voice`, {
            method: 'POST',
            body: fd,
          });
        } catch (err) {
          console.error('Voice upload failed', err);
        } finally {
          setLoading(false);
        }

        // Stop audio tracks
        s.getTracks().forEach((t) => t.stop());

        // Stop video preview tracks before calibration starts
        // (WebGazer will take over the camera)
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          setStream(null);
        }

        setStep('calibration');
      };

      mediaRecorder.current.start();
      setRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
  };

  // --- CALIBRATION STATE ---
  const [calibPoints, setCalibPoints] = useState(0);
  const [calibReady, setCalibReady] = useState(false);
  const [samples, setSamples] = useState<{ x: number; y: number }[]>([]);

  // Initialize WebGazer for calibration
  useEffect(() => {
    if (step !== 'calibration') return;
    if (!window.webgazer) {
      alert('Eye tracking library failed to load. Please refresh the page.');
      return;
    }

    let cancelled = false;

    const initWebGazer = async () => {
      try {
        await window.webgazer.clearData();
        await window.webgazer
          .setRegression('ridge')
          .setGazeListener(() => {}) // no-op during calibration
          .begin();

        // Show debug overlay so user sees camera + face box
        window.webgazer.showVideo(true);
        window.webgazer.showFaceOverlay(true);
        window.webgazer.showPredictionPoints(true);

        if (!cancelled) setCalibReady(true);
      } catch (e) {
        console.error('WebGazer init failed', e);
        if (!cancelled) {
          alert(
            'Eye tracking failed to initialize. Please ensure camera permissions are granted and refresh the page.'
          );
        }
      }
    };

    initWebGazer();

    return () => {
      cancelled = true;
      // We *do not* end() here so the proctor shell can continue using WebGazer.
      // Just hide UI if we happen to unmount during calibration.
      try {
        window.webgazer && window.webgazer.showVideo(false);
        window.webgazer && window.webgazer.showFaceOverlay(false);
        window.webgazer && window.webgazer.showPredictionPoints(false);
      } catch {
        // ignore
      }
    };
  }, [step]);

  // Handle 9-point calibration clicks
  const handleCalibClick = async (e: React.MouseEvent) => {
    if (!calibReady || !window.webgazer) return;

    const target = e.currentTarget as HTMLButtonElement;

    // Visual feedback per dot
    target.style.backgroundColor = '#10b981'; // green
    target.style.borderColor = '#059669';
    target.disabled = true;

    // Capture current gaze prediction at the moment of click
    try {
      const prediction = await window.webgazer.getCurrentPrediction();
      if (prediction && typeof prediction.x === 'number' && typeof prediction.y === 'number') {
        setSamples((prev) => [...prev, { x: prediction.x, y: prediction.y }]);
      }
    } catch (err) {
      console.warn('Failed to get gaze prediction for calibration point', err);
    }

    const newCount = calibPoints + 1;
    setCalibPoints(newCount);

    // Once all 9 points are clicked, compute bounding box + save
    if (newCount >= 9) {
      setTimeout(() => {
        if (samples.length > 0) {
          const xs = samples.map((s) => s.x);
          const ys = samples.map((s) => s.y);

          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          const calibrationPayload = {
            minX,
            maxX,
            minY,
            maxY,
            screenW: window.innerWidth,
            screenH: window.innerHeight,
            points: samples,
            createdAt: Date.now(),
          };

          try {
            localStorage.setItem(
              `gaze_calibration_${interviewId}`,
              JSON.stringify(calibrationPayload)
            );
          } catch (err) {
            console.error('Failed to persist gaze calibration', err);
          }
        }

        // Hide WebGazer UI (keep it running for proctoring)
        try {
          window.webgazer.showVideo(false);
          window.webgazer.showFaceOverlay(false);
          window.webgazer.showPredictionPoints(false);
        } catch {
          // ignore
        }

        setStep('done');
        onComplete();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl relative">
        <h2 className="text-xl font-semibold text-white mb-2">Identity & Setup</h2>

        {/* STEP 1: FACE */}
        {step === 'face' && (
          <div className="flex flex-col items-center gap-4 animate-in fade-in">
            <p className="text-sm text-slate-400">Step 1/3: Reference Photo</p>
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-slate-700">
              {!stream ? (
                <button
                  onClick={startCamera}
                  className="absolute inset-0 flex items-center justify-center text-emerald-500 hover:bg-white/5"
                >
                  Click to Enable Camera
                </button>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              )}
            </div>
            <button
              onClick={capturePhoto}
              disabled={!stream || loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Uploading...' : 'Capture Photo'}
            </button>
          </div>
        )}

        {/* STEP 2: VOICE */}
        {step === 'voice' && (
          <div className="flex flex-col items-center gap-4 animate-in fade-in">
            <p className="text-sm text-slate-400">Step 2/3: Voice Sample</p>
            <div className="p-4 bg-slate-800 rounded-lg text-center w-full">
              <p className="text-sm text-slate-300 mb-2">
                Please read the following aloud:
              </p>
              <blockquote className="text-lg font-medium text-white italic">
                "My name is [Your Name], and I consent to being audio and video recorded for
                this interview."
              </blockquote>
            </div>

            {!recording ? (
              <button
                onClick={startRecording}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
              >
                Start Recording
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium animate-pulse"
              >
                Stop &amp; Submit
              </button>
            )}
            {loading && (
              <p className="text-xs text-slate-500">Uploading voice sample...</p>
            )}
          </div>
        )}

        {/* STEP 3: GAZE CALIBRATION */}
        {step === 'calibration' && (
          <div className="fixed inset-0 z-60 bg-slate-950 flex flex-col items-center justify-center cursor-crosshair">
            {/* Instructions Overlay */}
            <div className="absolute top-10 left-0 right-0 text-center pointer-events-none">
              <h3 className="text-2xl font-bold text-white mb-2">
                Eye Tracking Calibration
              </h3>
              <p className="text-slate-300 text-lg">
                Click on each red dot while looking directly at it.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="h-2 w-48 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${(calibPoints / 9) * 100}%` }}
                  />
                </div>
                <span className="text-emerald-400 font-mono">
                  {calibPoints}/9
                </span>
              </div>
              {!calibReady && (
                <p className="text-sm text-amber-400 mt-2">Initializing camera...</p>
              )}
            </div>

            {/* 9 Point Calibration Grid */}
            <div className="w-full h-full relative">
              {[
                // Top Row
                { top: '5%', left: '5%' },
                { top: '5%', left: '50%' },
                { top: '5%', left: '95%' },
                // Middle Row
                { top: '50%', left: '5%' },
                { top: '50%', left: '50%' },
                { top: '50%', left: '95%' },
                // Bottom Row
                { top: '95%', left: '5%' },
                { top: '95%', left: '50%' },
                { top: '95%', left: '95%' },
              ].map((pos, i) => (
                <button
                  key={i}
                  onClick={handleCalibClick}
                  disabled={!calibReady}
                  className="absolute w-6 h-6 sm:w-8 sm:h-8 rounded-full border-4 border-white bg-red-500 hover:scale-125 transition-transform disabled:opacity-0 disabled:cursor-not-allowed transform -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                  style={{ top: pos.top, left: pos.left }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}