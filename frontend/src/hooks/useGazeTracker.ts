// frontend/src/hooks/useGazeTracker.ts
import { useEffect, useRef, useState } from 'react';

// Types exposed to the rest of the app
export type GazePoint = {
  x: number;
  y: number;
  t: number; // timestamp (ms)
};

export type GazeCalibrationBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type UseGazeTrackerConfig = {
  interviewId: string;
  enabled: boolean;                 // Should tracking run?
  minAwayDurationMs?: number;       // How long user must look away before we flag
  smoothingWindowMs?: number;       // Rolling window for smoothing gaze samples
  minConfidence?: number;           // Ignore predictions below this
  marginPx?: number;                // Extra margin added to calibration box
  onAwayChange?: (isAway: boolean) => void; // Called when away status flips
  
  // 🔴 NEW: Cognitive / Behavioral Callbacks
  onReadingDetected?: () => void;
  onHighCognitiveLoad?: () => void;
};

export type UseGazeTrackerState = {
  supported: boolean; // webgazer loaded?
  ready: boolean;     // at least one valid sample received
  isAway: boolean;    // currently outside safe zone for long enough
  lastGaze: GazePoint | null;
  calibrationBounds: GazeCalibrationBounds | null;
  
  // 🔴 NEW: Real-time insights
  isReading: boolean;
};

// ---- Module-level singletons so webgazer only starts once per page ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global {
  interface Window {
    webgazer?: any;
  }
}

let webgazerInitPromise: Promise<void> | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let webgazerStarted = false;

// Only start webgazer once. All hooks share this.
async function ensureWebgazerStarted(): Promise<void> {
  if (webgazerInitPromise) return webgazerInitPromise;

  if (!window.webgazer) {
    // Script not loaded or blocked
    webgazerInitPromise = Promise.reject(
      new Error('WebGazer not available on window')
    );
    return webgazerInitPromise;
  }

  webgazerInitPromise = (async () => {
    const wg = window.webgazer;

    // Basic production-ready configuration
    wg.setRegression('ridge');
    wg.setTracker('clmtrackr');
    wg.showVideo(false);
    wg.showFaceOverlay(false);
    wg.showFaceFeedbackBox(false);
    wg.showPredictionPoints(false);

    // Start camera
    await wg.begin();
    webgazerStarted = true;
  })();

  return webgazerInitPromise;
}

// -------------------- Hook implementation --------------------

export function useGazeTracker(config: UseGazeTrackerConfig): UseGazeTrackerState {
  const {
    interviewId,
    enabled,
    minAwayDurationMs = 1500,
    smoothingWindowMs = 800,
    minConfidence = 0.5,
    marginPx = 60,
    onAwayChange,
    onReadingDetected,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onHighCognitiveLoad
  } = config;

  const [supported, setSupported] = useState<boolean>(!!window.webgazer);
  const [ready, setReady] = useState(false);
  const [isAway, setIsAway] = useState(false);
  
  // 🔴 NEW: Eye-Intent State
  const [isReading, setIsReading] = useState(false);
  
  const [calibrationBounds, setCalibrationBounds] =
    useState<GazeCalibrationBounds | null>(null);
  const [lastGaze, setLastGaze] = useState<GazePoint | null>(null);

  // rolling buffer of gaze samples
  const samplesRef = useRef<GazePoint[]>([]);
  const awaySinceRef = useRef<number | null>(null);
  const listenerAttachedRef = useRef(false);

  // Load calibration bounds from localStorage (written by BiometricSetup)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`gaze_calibration_${interviewId}`);
      if (!raw) {
        setCalibrationBounds(null);
        return;
      }
      const parsed = JSON.parse(raw) as GazeCalibrationBounds;
      if (
        typeof parsed.minX === 'number' &&
        typeof parsed.maxX === 'number' &&
        typeof parsed.minY === 'number' &&
        typeof parsed.maxY === 'number'
      ) {
        setCalibrationBounds(parsed);
      } else {
        setCalibrationBounds(null);
      }
    } catch (e) {
      console.warn('Invalid gaze calibration data', e);
      setCalibrationBounds(null);
    }
  }, [interviewId]);

  // Helper to check if a point is inside safe zone
  const isInsideSafeZone = (x: number, y: number): boolean => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!calibrationBounds) {
      // Fallback: just check screen bounds with margin
      return (
        x >= marginPx &&
        x <= vw - marginPx &&
        y >= marginPx &&
        y <= vh - marginPx
      );
    }

    const minX = calibrationBounds.minX - marginPx;
    const maxX = calibrationBounds.maxX + marginPx;
    const minY = calibrationBounds.minY - marginPx;
    const maxY = calibrationBounds.maxY + marginPx;

    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  };

  // 🔴 NEW: Analyze gaze buffer for behavioral patterns
  const analyzeGazeIntent = (samples: GazePoint[]) => {
    if (samples.length < 15) return; // Need enough history

    // --- Reading Detection (Horizontal Saccades) ---
    // Logic: Consistent Left->Right movement followed by rapid Left return (carriage return)
    // Simplified: Check if horizontal flow is positive (L->R) and variance in Y is low (staying on line)
    
    const yVals = samples.map(p => p.y);
    const yMean = yVals.reduce((a,b) => a+b, 0) / yVals.length;
    // Calculate vertical variance (how much they look up/down)
    const verticalVariance = yVals.reduce((a,b) => a + Math.pow(b - yMean, 2), 0) / yVals.length;

    let horizontalFlow = 0;
    for(let i=1; i < samples.length; i++) {
        const dx = samples[i].x - samples[i-1].x;
        if(dx > 5) horizontalFlow++;        // Moving right
        else if (dx < -100) horizontalFlow += 2; // Rapid return left (carriage return)
    }

    // Heuristics:
    // 1. High horizontal flow (mostly reading L->R)
    // 2. Low vertical variance (staying on lines of text)
    // 3. Not just looking away (which is handled by isAway)
    const isScanning = horizontalFlow > (samples.length * 0.6);
    const isStableLine = verticalVariance < 4000; // Threshold depends on screen size/calibration

    if (isScanning && isStableLine) {
        if (!isReading) {
            setIsReading(true);
            onReadingDetected?.();
        }
    } else {
        if (isReading) {
            setIsReading(false);
        }
    }
  };

  // Core effect: start webgazer, attach gaze listener, compute isAway with smoothing
  useEffect(() => {
    if (!enabled) {
      // When disabled, reset state but keep webgazer warm in background
      samplesRef.current = [];
      awaySinceRef.current = null;
      if (isAway) {
        setIsAway(false);
        onAwayChange?.(false);
      }
      return;
    }

    if (!window.webgazer) {
      setSupported(false);
      console.warn('[GazeTracker] window.webgazer not found.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await ensureWebgazerStarted();
      } catch (e) {
        if (!cancelled) {
          console.error('[GazeTracker] Failed to start WebGazer', e);
          setSupported(false);
        }
        return;
      }
      if (cancelled) return;

      const wg = window.webgazer;
      setSupported(true);

      // Attach gaze listener only once
      if (!listenerAttachedRef.current) {
        wg.setGazeListener((data: any, timestamp: number) => {
          if (!data || cancelled) return;

          const x = data.x;
          const y = data.y;
          const confidence = typeof data.confidence === 'number'
            ? data.confidence
            : 1; // some builds don't expose confidence

          // Ignore obviously invalid values or low confidence predictions
          if (
            typeof x !== 'number' ||
            typeof y !== 'number' ||
            x < 0 ||
            y < 0 ||
            x > window.innerWidth * 1.2 || // very off-screen
            y > window.innerHeight * 1.2 ||
            confidence < minConfidence
          ) {
            return;
          }

          const t = timestamp || Date.now();
          const inside = isInsideSafeZone(x, y);

          // Push to rolling buffer
          const samples = samplesRef.current;
          samples.push({ x, y, t });

          // Keep only last smoothingWindowMs
          const cutoff = t - smoothingWindowMs;
          while (samples.length && samples[0].t < cutoff) {
            samples.shift();
          }

          // 🔴 NEW: Run behavioral analysis periodically (every ~5 frames)
          if (samples.length % 5 === 0) {
             analyzeGazeIntent(samples);
          }

          // Compute smoothed point (average)
          const len = samples.length;
          if (len === 0) return;
          const avgX = samples.reduce((s, p) => s + p.x, 0) / len;
          const avgY = samples.reduce((s, p) => s + p.y, 0) / len;

          const smoothedInside = isInsideSafeZone(avgX, avgY);
          const now = t;

          // Mark ready after first good sample
          if (!ready) setReady(true);

          // Update last gaze state (for debugging / future UI)
          setLastGaze({ x: avgX, y: avgY, t: now });

          // Away detection with hysteresis in time, not individual samples
          if (!smoothedInside) {
            if (awaySinceRef.current == null) {
              awaySinceRef.current = now;
            }
            const elapsed = now - awaySinceRef.current;
            if (elapsed >= minAwayDurationMs && !isAway) {
              setIsAway(true);
              onAwayChange?.(true);
            }
          } else {
            // Back inside -> reset
            awaySinceRef.current = null;
            if (isAway) {
              setIsAway(false);
              onAwayChange?.(false);
            }
          }
        });

        listenerAttachedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
      // We intentionally do NOT call webgazer.end() here to keep camera warm
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    minAwayDurationMs,
    smoothingWindowMs,
    minConfidence,
    marginPx,
    calibrationBounds,
    onAwayChange,
    onReadingDetected
  ]);

  return {
    supported,
    ready,
    isAway,
    isReading, // 🔴 Exposed to UI
    lastGaze,
    calibrationBounds,
  };
}