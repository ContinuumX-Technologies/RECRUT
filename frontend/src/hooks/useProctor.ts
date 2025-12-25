import { useEffect, useRef } from 'react';

type ProctorConfig = {
  heartbeatMs: number;
  frameIntervalMs: number; // reused as video chunk duration (ms)
  focusLossThreshold: number;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Extend Window type to include the Electron lockdown bridge
declare global {
  interface Window {
    lockdown?: {
      onBlur: (callback: () => void) => void;
      onFocus: (callback: () => void) => void;
      requestQuit: () => void;
    };
  }
}

export function useProctor(
  interviewId: string,
  config: ProctorConfig | null
) {
  const initialized = useRef(false);
  const focusLossCount = useRef(0);

  const webcamStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  // flag to stop starting new chunks after unmount
  const recordingStoppedRef = useRef(false);

  async function sendEvent(type: string, payload: any = {}) {
    try {
      await fetch(`${API_BASE}/api/interviews/${interviewId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          timestamp: new Date().toISOString(),
          payload,
        }),
      });
    } catch (err) {
      console.warn('sendEvent failed', err);
    }
  }

  async function goFullscreen() {
    const el: any = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        await sendEvent('fullscreen_enter');
      } catch (e: any) {
        await sendEvent('fullscreen_fail', { error: e.message });
      }
    }
  }

  function addWatermark(text: string) {
    let wm = document.getElementById('proctor-watermark');
    if (!wm) {
      wm = document.createElement('div');
      wm.id = 'proctor-watermark';
      Object.assign(wm.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        fontSize: '12px',
        opacity: '0.18',
        zIndex: '99999',
        pointerEvents: 'none',
        color: '#fff',
      });
      document.body.appendChild(wm);
    }
    wm.textContent = text;
  }

  function setupVisibilityListeners() {
    const handler = () => {
      const hidden = document.hidden;

      // Log generic visibility change
      sendEvent('visibility_change', { hidden });

      // Count focus losses (tab/app switch)
      if (hidden) {
        focusLossCount.current += 1;
        sendEvent('focus_lost', { count: focusLossCount.current });

        if (config && focusLossCount.current >= config.focusLossThreshold) {
          sendEvent('focus_threshold_exceeded', {
            count: focusLossCount.current,
            threshold: config.focusLossThreshold,
          });
        }
      } else {
        sendEvent('focus_gained');
      }
    };

    document.addEventListener('visibilitychange', handler);
    window.addEventListener('blur', handler);
    window.addEventListener('focus', handler);

    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('blur', handler);
      window.removeEventListener('focus', handler);
    };
  }

  function setupPasteListener() {
    const handler = (e: ClipboardEvent) => {
      sendEvent('paste_detected', {
        preview: e.clipboardData?.getData('text')?.slice(0, 50) || null,
      });
    };
    window.addEventListener('paste', handler);

    return () => {
      window.removeEventListener('paste', handler);
    };
  }

  // Electron lockdown integration: listen to app-level blur/focus
  function setupLockdownListeners() {
    if (!window.lockdown) return () => {};

    const blurHandler = () => {
      // Electron window lost focus -> user tried to switch app
      focusLossCount.current += 1;
      sendEvent('lockdown_blur', { count: focusLossCount.current });

      if (config && focusLossCount.current >= config.focusLossThreshold) {
        sendEvent('lockdown_focus_threshold_exceeded', {
          count: focusLossCount.current,
          threshold: config.focusLossThreshold,
        });
      }
    };

    const focusHandler = () => {
      sendEvent('lockdown_focus', {});
    };

    window.lockdown.onBlur(blurHandler);
    window.lockdown.onFocus(focusHandler);

    return () => {};
  }

  // 🔴 NEW: continuous webcam video recording with self-contained chunks
  async function startWebcamVideoRecording(chunkMs: number) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true, // audio handled separately by AudioRecorder
      });
      webcamStreamRef.current = stream;

      const duration =
        typeof chunkMs === 'number' && chunkMs > 0 ? chunkMs : 15000;

      const chooseOptions = (): MediaRecorderOptions => {
        const opts: MediaRecorderOptions = {};
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
          opts.mimeType = 'video/webm;codecs=vp9';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
          opts.mimeType = 'video/webm;codecs=vp8';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          opts.mimeType = 'video/webm';
        }
        return opts;
      };

      const startOneChunk = () => {
        if (recordingStoppedRef.current) return;

        const options = chooseOptions();
        const recorder = new MediaRecorder(stream, options);
        recorderRef.current = recorder;

        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onerror = (err) => {
          console.error('MediaRecorder error', err);
          sendEvent('webcam_recorder_error', { error: String(err) });
        };

        recorder.onstop = async () => {
          if (chunks.length > 0 && !recordingStoppedRef.current) {
            const blob = new Blob(chunks, {
              type: options.mimeType || 'video/webm',
            });

            const form = new FormData();
            form.append('video', blob, `chunk-${Date.now()}.webm`);

            try {
              await fetch(
                `${API_BASE}/api/interviews/${interviewId}/video`,
                {
                  method: 'POST',
                  body: form,
                }
              );
            } catch (e) {
              console.warn('video chunk upload failed', e);
            }
          }

          // Start next chunk if still recording
          if (!recordingStoppedRef.current) {
            startOneChunk();
          }
        };

        recorder.start(5000); // start continuous recording
        sendEvent('webcam_video_chunk_started', { chunkMs: duration });

        // Stop after duration so the file is a self-contained mini video
        window.setTimeout(() => {
          if (!recordingStoppedRef.current && recorder.state === 'recording') {
            recorder.stop();
          }
        }, duration);
      };

      startOneChunk();
      console.log('MediaRecorder continuous chunk loop started, chunk size:', duration, 'ms');
      sendEvent('webcam_video_started', { chunkMs: duration });
    } catch (e: any) {
      console.error('webcam error', e);
      sendEvent('webcam_fail', { error: e.message });
    }
  }

  useEffect(() => {
    if (!config || initialized.current) return;
    initialized.current = true;
    recordingStoppedRef.current = false;

    addWatermark(
      `Interview ${interviewId.slice(0, 6)} • ${new Date().toLocaleString()}`
    );

    goFullscreen();

    const cleanupVisibility = setupVisibilityListeners();
    const cleanupPaste = setupPasteListener();
    const cleanupLockdown = setupLockdownListeners();

    // 🔴 Use video recording instead of still frames; reuse frameIntervalMs as chunk duration
    startWebcamVideoRecording(config.frameIntervalMs);

    sendEvent('proctor_started', { ua: navigator.userAgent });

    const hb = window.setInterval(() => {
      sendEvent('heartbeat', { ts: Date.now() });
    }, config.heartbeatMs);
    heartbeatRef.current = hb as unknown as number;

    return () => {
      cleanupVisibility();
      cleanupPaste();
      cleanupLockdown();

      recordingStoppedRef.current = true;

      if (heartbeatRef.current !== null) {
        clearInterval(heartbeatRef.current);
      }

      // Stop recorder (if any chunk is still running)
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch (e) {
          console.warn('error stopping recorder', e);
        }
      }

      // Stop webcam tracks
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [config, interviewId]);

  return {};
}