// frontend/src/components/ProctoredShell.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useGazeTracker } from '../hooks/useGazeTracker';

type Props = {
  interviewId: string;
  children: React.ReactNode; // your interview questions UI
};

type ProctorState = {
  fullscreen: boolean;
  focused: boolean;
  violationCount: number;
  locked: boolean;
  reason?: string;
};

const MAX_VIOLATIONS = 3; // after this, lock the test

async function sendEvent(interviewId: string, type: string, payload: any = {}) {
  try {
    await fetch(`http://localhost:4000/api/interviews/${interviewId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        timestamp: new Date().toISOString(),
        payload,
      }),
    });
  } catch (e) {
    console.warn('proctor event failed', e);
  }
}

export const ProctoredShell: React.FC<Props> = ({ interviewId, children }) => {
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<ProctorState>({
    fullscreen: false,
    focused: true,
    violationCount: 0,
    locked: false,
  });

  const [gazeWarning, setGazeWarning] = useState(false);

  const incrementViolation = useCallback(
    async (reason: string) => {
      setState((prev) => {
        if (prev.locked) return prev;
        const nextCount = prev.violationCount + 1;
        const locked = nextCount >= MAX_VIOLATIONS;

        if (locked) {
          sendEvent(interviewId, 'PROCTOR_LOCKED', {
            reason,
            violations: nextCount,
          });
        } else {
          sendEvent(interviewId, 'PROCTOR_VIOLATION', {
            reason,
            violations: nextCount,
          });
        }

        return {
          ...prev,
          violationCount: nextCount,
          locked,
          reason,
        };
      });
    },
    [interviewId]
  );

  // ----------- EYE / GAZE TRACKING -----------
  const { supported, ready, isAway } = useGazeTracker({
    interviewId,
    enabled: started && !state.locked, // only track when interview running
    minAwayDurationMs: 4000,           // 4 seconds continuous away before flag
    smoothingWindowMs: 800,            // smooth last 800ms
    minConfidence: 0.6,
    marginPx: 80,                      // generous safe zone around calibration
    onAwayChange: (away) => {
      setGazeWarning(away);

      if (away) {
        // Only fires on transition false -> true
        incrementViolation('GAZE_AWAY');
        sendEvent(interviewId, 'GAZE_AWAY_START', {});
      } else {
        sendEvent(interviewId, 'GAZE_AWAY_END', {});
      }
    },
  });
  // -------------------------------------------

  const requestFullscreen = async () => {
    const el: any = document.documentElement;
    try {
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen();
      }
      await sendEvent(interviewId, 'FULLSCREEN_ENTER');
      setState((prev) => ({ ...prev, fullscreen: true }));
      setStarted(true);
    } catch (e: any) {
      console.error('fullscreen request failed', e);
      await sendEvent(interviewId, 'FULLSCREEN_FAIL', { error: e.message });
      alert(
        'We need fullscreen permission to start the interview. Please allow it and try again.'
      );
    }
  };

  // Core proctor listeners: focus / visibility / fullscreen / shortcuts
  useEffect(() => {
    if (!started) return;

    const handleVisibility = () => {
      const hidden = document.hidden;
      setState((prev) => ({ ...prev, focused: !hidden }));
      if (hidden) {
        incrementViolation('TAB_OR_WINDOW_SWITCH');
      }
    };

    const handleBlur = () => {
      setState((prev) => ({ ...prev, focused: false }));
      incrementViolation('WINDOW_BLUR');
    };

    const handleFocus = () => {
      setState((prev) => ({ ...prev, focused: true }));
    };

    const handleFullscreenChange = () => {
      const fs = !!document.fullscreenElement;
      setState((prev) => ({ ...prev, fullscreen: fs }));
      if (!fs) {
        incrementViolation('FULLSCREEN_EXIT');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Best-effort: block some shortcuts
      const combo = [
        e.ctrlKey ? 'Ctrl' : '',
        e.metaKey ? 'Meta' : '',
        e.altKey ? 'Alt' : '',
        e.key,
      ]
        .filter(Boolean)
        .join('+');

      const bannedCombos = ['Ctrl+L', 'Meta+L', 'Alt+Tab', 'Meta+Tab'];
      if (bannedCombos.includes(combo) || e.key === 'F11') {
        e.preventDefault();
        e.stopPropagation();
        incrementViolation('KEYBOARD_SHORTCUT');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown, true);

    sendEvent(interviewId, 'PROCTOR_STARTED', { ua: navigator.userAgent });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [started, incrementViolation, interviewId]);

  // Warn on attempts to close/refresh
  useEffect(() => {
    if (!started) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [started]);

  // Context menu, copy/paste, devtools / app-switch shortcuts
  useEffect(() => {
    if (!started) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      incrementViolation('RIGHT_CLICK_ATTEMPT');
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      incrementViolation('COPY_PASTE_ATTEMPT');
    };

    const handleRestrictedKeys = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' || // DevTools
        (e.ctrlKey && e.shiftKey && e.key === 'I') || // DevTools
        (e.ctrlKey && e.key === 'c') || // Copy
        (e.ctrlKey && e.key === 'v') || // Paste
        (e.altKey && e.key === 'Tab')   // Switch App
      ) {
        e.preventDefault();
        e.stopPropagation();
        incrementViolation('RESTRICTED_KEY_ATTEMPT');
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    window.addEventListener('keydown', handleRestrictedKeys);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      window.removeEventListener('keydown', handleRestrictedKeys);
    };
  }, [started, incrementViolation]);

  // ---------- PRE-START SCREEN ----------
  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 w-screen">
        <div className="max-w-md border border-slate-800 rounded-xl p-6 bg-slate-900 shadow-lg">
          <h1 className="text-lg font-semibold mb-2">Proctored Interview</h1>
          <p className="text-sm text-slate-300 mb-4">
            This interview will run in fullscreen and your activity will be
            monitored. Switching tabs, exiting fullscreen, or using shortcuts
            may lock the interview.
          </p>
          <ul className="text-xs text-slate-400 mb-4 list-disc pl-4 space-y-1">
            <li>Do not switch tabs or windows.</li>
            <li>Do not exit fullscreen mode.</li>
            <li>Do not refresh or close this page.</li>
            <li>
              <strong className="text-emerald-400">
                Keep your eyes on the screen. Eye tracking is active.
              </strong>
            </li>
          </ul>

          {!supported && (
            <p className="text-xs text-red-400 mb-2">
              Eye tracking library not available. Your activity may be monitored
              with limited features.
            </p>
          )}

          <button
            onClick={requestFullscreen}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-medium hover:bg-emerald-500 transition-colors"
          >
            I understand, start interview
          </button>
        </div>
      </div>
    );
  }

  const showOverlay = state.locked || !state.fullscreen || !state.focused;

  // ---------- MAIN WRAPPER ----------
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      {/* MAIN CONTENT */}
      <div className={showOverlay ? 'pointer-events-none blur-sm' : ''}>
        {children}
      </div>

      {/* GAZE WARNING BANNER (only when away, not locked, and UI is active) */}
      {gazeWarning && !showOverlay && !state.locked && (
        <div className="fixed top-0 left-0 w-full z-40">
          <div className="h-1 bg-red-600 shadow-[0_0_20px_rgba(220,38,38,1)]" />
          <div className="max-w-md mx-auto mt-3 px-4 py-3 bg-red-900/90 border border-red-500/70 rounded-lg shadow-xl flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="text-sm">
              <p className="font-semibold text-red-100">
                Please bring your eyes back to the screen
              </p>
              <p className="text-xs text-red-200 mt-1">
                Looking away for too long may lock your interview.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY WHEN NOT FULLSCREEN / NOT FOCUSED / LOCKED */}
      {showOverlay && (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 text-center px-4">
          <h2 className="text-xl font-semibold mb-2">
            {state.locked ? 'Interview Locked' : 'Return to the Interview'}
          </h2>
          {!state.locked && (
            <>
              <p className="text-sm text-slate-300 mb-4 max-w-md">
                The interview requires your full attention in fullscreen mode.
                Please return to this tab and re-enter fullscreen to continue.
              </p>
              <button
                className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-medium"
                onClick={requestFullscreen}
              >
                Re-enter fullscreen
              </button>
            </>
          )}
          {state.locked && (
            <div className="text-sm text-red-300 max-w-md">
              <p className="mb-2">
                This interview has been locked due to multiple proctoring
                violations.
              </p>
              <p className="font-mono text-xs bg-red-900/20 p-2 rounded border border-red-500/20">
                Last Violation: {state.reason}
              </p>
            </div>
          )}
          <p className="mt-4 text-xs text-slate-500">
            Violations: {state.violationCount} / {MAX_VIOLATIONS}
          </p>
        </div>
      )}

      {/* Optional tiny debug tag for gaze readiness */}
      {started && !state.locked && (
        <div className="fixed bottom-2 right-2 text-[10px] text-slate-500 bg-slate-900/80 px-2 py-1 rounded border border-slate-700/60">
          Gaze: {supported ? (ready ? 'active' : 'calibrating…') : 'unavailable'}
        </div>
      )}
    </div>
  );
};