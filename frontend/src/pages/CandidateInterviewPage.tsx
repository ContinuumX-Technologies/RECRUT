import { useEffect, useState, useRef, useCallback, useMemo, type JSX } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AudioVisualizerCard from '../components/AudioVizualiser';
import { ProctoredShell } from '../components/ProctoredShell';
import { useProctorAlerts } from '../hooks/useProctorAlert';
import { useProctor } from '../hooks/useProctor';
import { BiometricSetup } from '../components/BiometricSetup';
import EmbeddedIDE from '../leetcode-ide/components/EmbeddedIDE';
import './CandidateInterviewPage.css';

// ===========================================
// TYPES
// ============================================

type TestCase = {
  input: string;
  output: string;
};

type Question = {
  id: string;
  text: string;
  type: 'text' | 'audio' | 'code' | 'mcq';
  durationSec?: number;
  options?: string[];
  language?: 'javascript' | 'python';
  starterCode?: {
    javascript?: string;
    python?: string;
  };
  testCases?: TestCase[];
  description?: string;
  hiddenTestCases?: TestCase[];
  difficulty?: 'easy' | 'medium' | 'hard';
};

type Config = {
  id: string;
  candidateName: string;
  status: string;
  questions: Question[];
  proctorConfig: {
    heartbeatMs: number;
    frameIntervalMs: number;
    focusLossThreshold: number;
  };
};

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';
type ConsoleTab = 'testcase' | 'result';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// ============================================
// ICON COMPONENTS - SF Symbols inspired
// ============================================

const Icons = {
  Logo: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
    </svg>
  ),
  Camera: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  ),
  Warning: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15,18 9,12 15,6" />
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9,18 15,12 9,6" />
    </svg>
  ),
  ChevronDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6,9 12,15 18,9" />
    </svg>
  ),
  Signal: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="14" width="3" height="7" rx="1" />
      <rect x="8" y="10" width="3" height="11" rx="1" />
      <rect x="13" y="6" width="3" height="15" rx="1" />
      <rect x="18" y="3" width="3" height="18" rx="1" />
    </svg>
  ),
  SignalOff: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" opacity="0.4">
      <rect x="3" y="14" width="3" height="7" rx="1" />
      <rect x="8" y="10" width="3" height="11" rx="1" />
      <rect x="13" y="6" width="3" height="15" rx="1" />
      <rect x="18" y="3" width="3" height="18" rx="1" />
      <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Code: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16,18 22,12 16,6" />
      <polyline points="8,6 2,12 8,18" />
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  RotateCcw: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,4 1,10 7,10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  ),
  Send: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  ),
  Shield: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  CheckCircle: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  ),
  XCircle: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
    </svg>
  ),
  Sparkles: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3l1.09 3.41L16.5 7.5l-3.41 1.09L12 12l-1.09-3.41L7.5 7.5l3.41-1.09L12 3zm6.5 9l.72 2.28L21.5 15l-2.28.72-.72 2.28-.72-2.28L15.5 15l2.28-.72.72-2.28zM5.5 15l.72 2.28L8.5 18l-2.28.72-.72 2.28-.72-2.28L2.5 18l2.28-.72.72-2.28z" />
    </svg>
  ),
  Mic: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Lightbulb: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z" />
    </svg>
  ),
};

// ============================================
// LOADING SCREEN - Apple Style
// ============================================

const LoadingScreen = () => (
  <div className="apple-loading">
    <div className="apple-loading__content">
      <div className="apple-loading__logo">
        <div className="apple-loading__ring">
          <div className="apple-loading__ring-segment" />
        </div>
      </div>
      <h1 className="apple-loading__title">Preparing Your Interview</h1>
      <p className="apple-loading__subtitle">Setting up a secure environment...</p>
    </div>
  </div>
);

// ============================================
// ERROR SCREEN - Apple Style
// ============================================

const ErrorScreen = ({
  message,
  onRetry
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div className="apple-error">
    <div className="apple-error__card">
      <div className="apple-error__icon">
        <Icons.Warning />
      </div>
      <h1 className="apple-error__title">Something went wrong</h1>
      <p className="apple-error__message">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="apple-btn apple-btn--primary">
          <Icons.RotateCcw />
          <span>Try Again</span>
        </button>
      )}
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export function CandidateInterviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const interviewId = id || '';

  // ==========================================
  // STATE
  // ==========================================

  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [setupComplete, setSetupComplete] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('testcase');
  const [showSidebar, setShowSidebar] = useState(false);
  const [codeOutput, setCodeOutput] = useState<{
    success: boolean;
    output: string;
    runtime?: string;
    memory?: string;
  } | null>(null);

  // ==========================================
  // REFS
  // ==========================================

  const videoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ==========================================
  // HOOKS
  // ==========================================

  const alert = useProctorAlerts(interviewId);
  useProctor(interviewId, setupComplete && config ? config.proctorConfig : null);

  // Add this state near other state declarations
  const [configLoaded, setConfigLoaded] = useState(false);

  // Replace the fetchConfig function
  const fetchConfig = useCallback(async (silent = false) => {
    // Prevent re-fetching after initial load
    if (configLoaded && silent) {
      console.log('Config already loaded, skipping refetch');
      return;
    }

    if (!interviewId) {
      if (!silent) {
        setError("Invalid interview ID");
        setLoading(false);
      }
      return;
    }

    try {
      if (!silent) setLoading(true);

      const res = await fetch(`${API_BASE}/api/interviews/${interviewId}/config`);

      if (!res.ok) {
        throw new Error(`Failed to load interview: ${res.status}`);
      }

      const data = await res.json();

      // Only set config on first load, or if forced
      if (!configLoaded) {
        setConfig({
          ...data,
          questions: Array.isArray(data.questions) ? data.questions : [],
        });
        setConfigLoaded(true);
      }

      if (!silent) setError(null);
    } catch (e) {
      console.error('Config fetch error:', e);
      if (!silent) setError("Unable to load interview. Please try again.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [interviewId, configLoaded]);
  // ==========================================
  // EFFECTS
  // ==========================================

  // Time update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Camera initialization
  useEffect(() => {
    let isMounted = true;

    const startPreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: false
        });

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(console.error);
        }

        if (mobileVideoRef.current) {
          mobileVideoRef.current.srcObject = stream;
          await mobileVideoRef.current.play().catch(console.error);
        }
      } catch (err) {
        console.error("Camera access failed:", err);
        setError("Camera access denied. Please enable camera permissions.");
      }
    };

    if (setupComplete) {
      startPreview();
    }

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [setupComplete]);


  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Connection monitoring
  useEffect(() => {
    const handleOnline = () => setConnectionStatus('connected');
    const handleOffline = () => setConnectionStatus('disconnected');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (showExitConfirm || !config) return;

      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.closest('.code-editor-wrapper');

      if (isInputField) return;

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && currentIndex < config.questions.length - 1) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, showExitConfirm, config]);

  // Prevent accidental navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (setupComplete && !isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [setupComplete, isSubmitting]);

  

  async function apiFetch<T>(url: string, body: any): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }

    return res.json();
  }

  // ==========================================
  // MEMOIZED VALUES - Fixed
  // ==========================================

  const questions = useMemo(() =>
    config?.questions ?? [],
    [config?.questions]
  );

  const totalQuestions = questions.length;

  const currentQuestion = useMemo(() =>
    questions[currentIndex],
    [questions, currentIndex]
  );

  const progress = useMemo(() =>
    totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0,
    [totalQuestions, currentIndex]
  );

  const isCodeQuestion = currentQuestion?.type === 'code';
  const isLastQuestion = currentIndex >= totalQuestions - 1;

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleAnswerChange = useCallback((value: string) => {
    if (!currentQuestion) return;

    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));

    if (value.trim().length > 0) {
      setAnsweredQuestions(prev => new Set(prev).add(currentIndex));
    } else {
      setAnsweredQuestions(prev => {
        const next = new Set(prev);
        next.delete(currentIndex);
        return next;
      });
    }
  }, [currentQuestion, currentIndex]);

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => {
      const nextIndex = prev + 1;
      if (nextIndex >= totalQuestions) {
        console.warn('Attempted to navigate past last question');
        return prev;
      }
      return nextIndex;
    });
    setCodeOutput(null);
  }, [totalQuestions]);

  const handlePrev = useCallback(() => {
    setCurrentIndex(prev => {
      if (prev <= 0) {
        console.warn('Attempted to navigate before first question');
        return prev;
      }
      return prev - 1;
    });
    setCodeOutput(null);
  }, []);

  const handleFinish = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  const handleSubmit = async () => {
    if (!currentQuestion || !answers[currentQuestion.id]) return;
  
    setConsoleTab("result");
    setCodeOutput(null);
  
    try {
      const res = await apiFetch<{
        status: "Accepted" | "Wrong Answer";
        timeMs?: number;
        memoryMb?: number;
      }>(`${API_BASE}/api/judge/submit`, {
        interviewId, // FIX: Now passing required interviewId
        questionId: currentQuestion.id,
        language: currentQuestion.language || "javascript",
        code: answers[currentQuestion.id]
      });
  
      setCodeOutput({
        success: res.status === "Accepted",
        output: res.status,
        runtime: res.timeMs ? `${res.timeMs} ms` : undefined,
        memory: res.memoryMb ? `${res.memoryMb} MB` : undefined
      });
  
      if (res.status === "Accepted") {
        setAnsweredQuestions(prev => new Set(prev).add(currentIndex));
      }
    } catch (err: any) {
      setCodeOutput({ success: false, output: err.message || "Submission failed" });
    }
  };

  
  const confirmFinish = useCallback(async () => {
    setIsSubmitting(true);

    try {
      if (Object.keys(answers).length > 0) {
        console.log("Submitting answers:", answers);
      }

      await fetch(`${API_BASE}/api/interviews/${interviewId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', answers })
      });

      navigate(`/interview/${interviewId}/complete`);
    } catch (err) {
      console.error('Submit failed:', err);
      setError('Failed to submit interview. Please try again.');
    } finally {
      setIsSubmitting(false);
      setShowExitConfirm(false);
    }
  }, [interviewId, navigate, answers]);

  const handleQuestionSelect = useCallback((index: number) => {
    if (index < 0 || index >= totalQuestions) {
      console.warn(`Invalid question index: ${index}, total: ${totalQuestions}`);
      return;
    }
    setCurrentIndex(index);
    setCodeOutput(null);
    setShowSidebar(false);
  }, [totalQuestions]);

  const handleRunCode = useCallback(async () => {
    if (!currentQuestion || !answers[currentQuestion.id]) return;
  
    setConsoleTab("result");
    setCodeOutput(null);
  
    try {
      // AUTOMATIC INPUT INJECTION:
      // We wrap the user's code with a driver that injects the test case data
      const res = await apiFetch<{
        testResults: any[];
      }>(`${API_BASE}/api/judge/run`, {
        code: answers[currentQuestion.id],
        language: currentQuestion.language || "javascript",
        testCases: currentQuestion.testCases || []
      });
  
      const failed = res.testResults.find(t => !t.passed);
      setCodeOutput({
        success: !failed,
        output: failed 
          ? `Input: ${failed.input}\nExpected: ${failed.expected}\nGot: ${failed.actual}`
          : "All test cases passed!",
        runtime: res.testResults.length > 0 
          ? `${Math.max(...res.testResults.map(t => t.timeMs || 0))} ms` 
          : "0 ms"
      });
    } catch (err: any) {
      setCodeOutput({ success: false, output: err.message || "Execution failed" });
    }
  }, [currentQuestion, answers]);


  const handleResetCode = useCallback(() => {
    const lang = currentQuestion?.language || 'javascript';
    const starter = currentQuestion?.starterCode?.[lang];
    if (starter) {
      handleAnswerChange(starter);
    }
  }, [currentQuestion, handleAnswerChange]);

  const getQuestionTypeIcon = (type: string) => {
    const icons: Record<string, JSX.Element> = {
      mcq: <Icons.CheckCircle />,
      code: <Icons.Code />,
      text: <Icons.Sparkles />,
      audio: <Icons.Mic />
    };
    return icons[type] || <Icons.Sparkles />;
  };

  // ==========================================
  // RENDER QUESTION LIST
  // ==========================================

  const renderQuestionList = () => (
    <div className="question-list">
      {questions.map((q, index) => {
        const isCurrent = index === currentIndex;
        const isAnswered = answeredQuestions.has(index);

        return (
          <button
            key={`question-${q.id}`} // Use stable ID, not index
            className={`question-list__item ${isCurrent ? 'question-list__item--active' : ''
              } ${isAnswered ? 'question-list__item--answered' : ''
              }`}
            onClick={() => handleQuestionSelect(index)}
          >
            <span className="question-list__number">{index + 1}</span>
            <span className="question-list__icon">{getQuestionTypeIcon(q.type)}</span>
            <span className="question-list__text">
              {q.text.length > 30 ? `${q.text.substring(0, 30)}...` : q.text}
            </span>
            {isAnswered && (
              <span className="question-list__check">
                <Icons.Check />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  // Effect to preload starter code when question changes
useEffect(() => {
  if (currentQuestion && !answers[currentQuestion.id]) {
    const starter = currentQuestion.starterCode && typeof currentQuestion.starterCode === 'object'
      ? currentQuestion.starterCode[currentQuestion.language || 'javascript'] || ''
      : '';
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: starter
    }));
  }
}, [currentQuestion, answers]);

  // ==========================================
  // RENDER CONDITIONS
  // ==========================================

  if (loading) {
    return <LoadingScreen />;
  }

  if (error && !config) {
    return <ErrorScreen message={error} onRetry={() => window.location.reload()} />;
  }

  if (!setupComplete) {
    return (
      <BiometricSetup
        interviewId={interviewId}
        onComplete={() => setSetupComplete(true)}
      />
    );
  }

  if (!config || config.questions.length === 0) {
    return <ErrorScreen message="No questions found for this interview." />;
  }

  // ==========================================
  // MAIN RENDER
  // ==========================================

  return (
    <ProctoredShell interviewId={interviewId}>
      <div className="apple-interview">
        {/* ================================
            NAVIGATION BAR
            ================================ */}
        <nav className="apple-nav">
          <div className="apple-nav__container">
            {/* Left */}
            <div className="apple-nav__left">
              <button
                className="apple-nav__menu-btn"
                onClick={() => setShowSidebar(!showSidebar)}
                aria-label="Toggle question list"
              >
                <span className="apple-nav__menu-icon">
                  <span />
                  <span />
                  <span />
                </span>
              </button>

              <div className="apple-nav__brand">
                <span className="apple-nav__logo">
                  <Icons.Sparkles />
                </span>
                <span className="apple-nav__title">Interview</span>
              </div>
            </div>

            {/* Center - Progress */}
            <div className="apple-nav__center">
              <div className="apple-progress">
                <div className="apple-progress__bar">
                  <div
                    className="apple-progress__fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="apple-progress__text">
                  {currentIndex + 1} / {totalQuestions}
                </span>
              </div>
            </div>

            {/* Right */}
            <div className="apple-nav__right">
              <div className={`apple-status ${connectionStatus !== 'connected' ? 'apple-status--offline' : ''}`}>
                <span className="apple-status__icon">
                  {connectionStatus === 'connected' ? <Icons.Signal /> : <Icons.SignalOff />}
                </span>
              </div>

              <div className="apple-status apple-status--recording">
                <span className="apple-status__dot" />
                <span className="apple-status__text">REC</span>
              </div>

              <div className="apple-nav__camera">
                <video
                  ref={mobileVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="apple-nav__camera-video"
                />
              </div>
            </div>
          </div>
        </nav>

        {/* ================================
            SIDEBAR (Mobile)
            ================================ */}
        <aside className={`apple-sidebar ${showSidebar ? 'apple-sidebar--open' : ''}`}>
          <div className="apple-sidebar__backdrop" onClick={() => setShowSidebar(false)} />
          <div className="apple-sidebar__content">
            <div className="apple-sidebar__header">
              <h2 className="apple-sidebar__title">Questions</h2>
              <button
                className="apple-sidebar__close"
                onClick={() => setShowSidebar(false)}
              >
                <Icons.X />
              </button>
            </div>
            {renderQuestionList()}
          </div>
        </aside>

        {/* ================================
            MAIN CONTENT
            ================================ */}
        <main className="apple-main">
          {/* Alert Banner */}
          {alert?.hasWarning && (
            <div className="apple-alert">
              <div className="apple-alert__icon">
                <Icons.Warning />
              </div>
              <div className="apple-alert__content">
                <strong>Proctoring Alert</strong>
                <p>{alert.message || 'Please ensure you follow the guidelines.'}</p>
              </div>
              <button className="apple-alert__dismiss">
                <Icons.X />
              </button>
            </div>
          )}

          {/* Content Container */}
          <div className={`apple-content ${isCodeQuestion ? 'apple-content--code' : ''}`}>

            {/* Left Panel - Question/Problem */}
            <section className="apple-panel apple-panel--question">
              <div className="apple-panel__scroll">
                {/* Question Header */}
                <header className="apple-question-header">
                  <div className="apple-question-meta">
                    <span className="apple-badge">
                      {getQuestionTypeIcon(currentQuestion?.type || '')}
                      <span>{currentQuestion?.type === 'mcq' ? 'Multiple Choice' :
                        currentQuestion?.type === 'code' ? 'Coding' :
                          currentQuestion?.type === 'audio' ? 'Voice' : 'Written'}</span>
                    </span>
                    {currentQuestion?.difficulty && (
                      <span className={`apple-badge apple-badge--${currentQuestion.difficulty}`}>
                        {currentQuestion.difficulty}
                      </span>
                    )}
                  </div>

                  <h1 className="apple-question-title">
                    {currentQuestion?.text}
                  </h1>

                  {currentQuestion?.durationSec && (
                    <div className="apple-duration">
                      <Icons.Clock />
                      <span>Suggested time: {Math.floor(currentQuestion.durationSec / 60)} min</span>
                    </div>
                  )}
                </header>

                {/* Question Description (for code) */}
                {currentQuestion?.description && (
                  <div className="apple-description">
                    {currentQuestion.description.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                )}

                {/* Test Cases (for code) */}
                {isCodeQuestion && currentQuestion?.testCases && (
                  <div className="apple-examples">
                    <h3>Examples</h3>
                    {currentQuestion.testCases.map((tc, i) => (
                      <div key={i} className="apple-example">
                        <div className="apple-example__label">Example {i + 1}</div>
                        <div className="apple-example__row">
                          <span className="apple-example__key">Input:</span>
                          <code className="apple-example__value">{tc.input}</code>
                        </div>
                        <div className="apple-example__row">
                          <span className="apple-example__key">Output:</span>
                          <code className="apple-example__value">{tc.output}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Answer Section (for non-code) */}
                {!isCodeQuestion && (
                  <div className="apple-answer">
                    {currentQuestion?.type === 'audio' && (
                      <div className="apple-audio-section">
                        {/* Prompt Header */}
                        <div className="apple-audio-prompt">
                          <div className="apple-audio-prompt__icon">
                            <Icons.Mic />
                          </div>
                          <h3 className="apple-audio-prompt__title">Voice Response</h3>
                          <p className="apple-audio-prompt__subtitle">
                            Take your time to think, then speak clearly into your microphone.
                          </p>

                          <div className="apple-audio-tips">
                            <span className="apple-audio-tip">
                              <Icons.Check /> Speak naturally
                            </span>
                            <span className="apple-audio-tip">
                              <Icons.Check /> Stay on topic
                            </span>
                            <span className="apple-audio-tip">
                              <Icons.Check /> No time limit
                            </span>
                          </div>
                        </div>

                        {/* Audio Visualizer */}
                        <AudioVisualizerCard
                          variant="default"
                          showControls={true}
                          accentColor="#0071e3"
                          onRecordingStart={() => {
                            console.log('Recording started');
                          }}
                          onRecordingStop={(duration) => {
                            console.log('Recording stopped, duration:', duration);
                            setAnsweredQuestions(prev => new Set(prev).add(currentIndex));
                            handleAnswerChange(`audio_response_${duration}s`);
                          }}
                          onAudioLevel={(level) => {
                            // Optional: use audio level for other UI feedback
                          }}
                        />

                        {/* Optional: Show completion state after recording */}
                        {answeredQuestions.has(currentIndex) && (
                          <div className="apple-audio-complete">
                            <div className="apple-audio-complete__icon">
                              <Icons.Check />
                            </div>
                            <h4 className="apple-audio-complete__title">Response Recorded</h4>
                            <p className="apple-audio-complete__duration">
                              Your voice response has been saved
                            </p>
                            <div className="apple-audio-complete__actions">
                              <button
                                className="apple-btn apple-btn--secondary"
                                onClick={() => {
                                  setAnsweredQuestions(prev => {
                                    const next = new Set(prev);
                                    next.delete(currentIndex);
                                    return next;
                                  });
                                  // Clear the answer too
                                  if (currentQuestion) {
                                    setAnswers(prev => {
                                      const next = { ...prev };
                                      delete next[currentQuestion.id];
                                      return next;
                                    });
                                  }
                                }}
                              >
                                <Icons.RotateCcw />
                                <span>Re-record</span>
                              </button>
                              <button
                                className="apple-btn apple-btn--primary"
                                onClick={isLastQuestion ? handleFinish : handleNext}
                              >
                                <span>{isLastQuestion ? 'Submit' : 'Continue'}</span>
                                <Icons.ChevronRight />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {currentQuestion?.type === 'text' && (
                      <textarea
                        value={answers[currentQuestion.id] || ''}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        className="apple-textarea"
                        placeholder="Write your answer here..."
                        rows={8}
                      />
                    )}

                    {currentQuestion?.type === 'mcq' && (
                      <div className="apple-mcq">
                        {currentQuestion.options?.map((option, i) => {
                          const isSelected = answers[currentQuestion.id] === option;
                          return (
                            <label
                              key={i}
                              className={`apple-mcq__option ${isSelected ? 'apple-mcq__option--selected' : ''}`}
                            >
                              <input
                                type="radio"
                                name={`mcq-${currentQuestion.id}`}
                                value={option}
                                checked={isSelected}
                                onChange={(e) => handleAnswerChange(e.target.value)}
                              />
                              <span className="apple-mcq__radio" />
                              <span className="apple-mcq__text">{option}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation */}
                <nav className="apple-nav-controls">
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="apple-btn apple-btn--secondary"
                  >
                    <Icons.ChevronLeft />
                    <span>Previous</span>
                  </button>

                  {/* Replace the dots section in apple-nav-controls */}
                  <div className="apple-dots">
                    {(() => {
                      // Calculate visible range (show 5 dots max, centered on current)
                      const maxVisible = 5;
                      const halfVisible = Math.floor(maxVisible / 2);

                      let startIndex = Math.max(0, currentIndex - halfVisible);
                      let endIndex = Math.min(totalQuestions, startIndex + maxVisible);

                      // Adjust start if we're near the end
                      if (endIndex - startIndex < maxVisible) {
                        startIndex = Math.max(0, endIndex - maxVisible);
                      }

                      const visibleIndices: number[] = [];
                      for (let i = startIndex; i < endIndex; i++) {
                        visibleIndices.push(i);
                      }

                      return visibleIndices.map((questionIndex) => (
                        <button
                          key={`dot-${questionIndex}-${questions[questionIndex]?.id || questionIndex}`}
                          className={`apple-dot ${questionIndex === currentIndex ? 'apple-dot--active' : ''
                            } ${answeredQuestions.has(questionIndex) ? 'apple-dot--answered' : ''
                            }`}
                          onClick={() => handleQuestionSelect(questionIndex)}
                          aria-label={`Go to question ${questionIndex + 1}`}
                          aria-current={questionIndex === currentIndex ? 'step' : undefined}
                        />
                      ));
                    })()}
                  </div>

                  <button
                    onClick={isLastQuestion ? handleFinish : handleNext}
                    className={`apple-btn ${isLastQuestion ? 'apple-btn--accent' : 'apple-btn--primary'}`}
                  >
                    <span>{isLastQuestion ? 'Submit' : 'Next'}</span>
                    {isLastQuestion ? <Icons.Send /> : <Icons.ChevronRight />}
                  </button>
                </nav>
              </div>
            </section>

            {/* Right Panel - Code Editor / Camera */}
            {isCodeQuestion ? (
              <section className="apple-panel apple-panel--editor">
                {/* Editor Header */}
                <header className="apple-editor-header">
                  <div className="apple-editor-lang">
                    <Icons.Code />
                    <span>{currentQuestion?.language === 'python' ? 'Python 3' : 'JavaScript'}</span>
                    <Icons.ChevronDown />
                  </div>

                  <div className="apple-editor-actions">
                    <button
                      className="apple-btn apple-btn--ghost"
                      onClick={handleResetCode}
                    >
                      <Icons.RotateCcw />
                      <span>Reset</span>
                    </button>
                    <button
                      className="apple-btn apple-btn--secondary"
                      onClick={handleRunCode}
                    >
                      <Icons.Play />
                      <span>Run</span>
                    </button>
                    <button
                      className="apple-btn apple-btn--primary"
                      onClick={handleSubmit}
                    >
                      <Icons.Send />
                      <span>Submit</span>
                    </button>
                  </div>
                </header>

                {/* Editor */}
                <div className="apple-editor-body">
                  <EmbeddedIDE
                    questionId={currentQuestion?.id || ''}
                    language={currentQuestion?.language || 'javascript'}
                    testCases={currentQuestion?.testCases || []}
                    value={answers[currentQuestion?.id || ''] ?? ''}
                    onChange={handleAnswerChange}
                  />
                </div>

                {/* Console */}
                <div className="apple-console">
                  <header className="apple-console-header">
                    <button
                      className={`apple-console-tab ${consoleTab === 'testcase' ? 'apple-console-tab--active' : ''}`}
                      onClick={() => setConsoleTab('testcase')}
                    >
                      Test Case
                    </button>
                    <button
                      className={`apple-console-tab ${consoleTab === 'result' ? 'apple-console-tab--active' : ''}`}
                      onClick={() => setConsoleTab('result')}
                    >
                      Result
                    </button>
                  </header>

                  <div className="apple-console-body">
                    {consoleTab === 'testcase' ? (
                      <div className="apple-console-testcase">
                        {currentQuestion?.testCases?.[0] && (
                          <>
                            <div className="apple-console-row">
                              <label>Input</label>
                              <code>{currentQuestion.testCases[0].input}</code>
                            </div>
                            <div className="apple-console-row">
                              <label>Expected</label>
                              <code>{currentQuestion.testCases[0].output}</code>
                            </div>
                          </>
                        )}
                      </div>
                    ) : codeOutput ? (
                      <div className={`apple-console-result ${codeOutput.success ? 'apple-console-result--success' : 'apple-console-result--error'}`}>
                        <div className="apple-console-result__header">
                          {codeOutput.success ? <Icons.CheckCircle /> : <Icons.XCircle />}
                          <span>{codeOutput.success ? 'Accepted' : 'Wrong Answer'}</span>
                          {codeOutput.success && (
                            <div className="apple-console-result__stats">
                              <span>{codeOutput.runtime}</span>
                              <span>{codeOutput.memory}</span>
                            </div>
                          )}
                        </div>
                        <div className="apple-console-row">
                          <label>Output</label>
                          <code>{codeOutput.output}</code>
                        </div>
                      </div>
                    ) : (
                      <div className="apple-console-empty">
                        <Icons.Play />
                        <span>Run your code to see results</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ) : (
              /* Camera & Tips Panel */
              <aside className="apple-panel apple-panel--sidebar">

                {/* Guidelines */}
                <div className="apple-card">
                  <header className="apple-card__header">
                    <Icons.Shield />
                    <h3>Guidelines</h3>
                  </header>
                  <ul className="apple-checklist">
                    <li><Icons.Check /> Keep your face visible</li>
                    <li><Icons.Check /> Look at your screen</li>
                    <li><Icons.Check /> Stay in a quiet space</li>
                    <li><Icons.Check /> No secondary devices</li>
                  </ul>
                </div>

                {/* Tips */}
                <div className="apple-card apple-card--highlight">
                  <header className="apple-card__header">
                    <Icons.Lightbulb />
                    <h3>Quick Tips</h3>
                  </header>
                  <ul className="apple-tips">
                    <li>Take a breath before answering</li>
                    <li>Structure your response clearly</li>
                    <li>Use specific examples when possible</li>
                  </ul>
                </div>

                {/* Progress */}
                <div className="apple-card">
                  <header className="apple-card__header">
                    <Icons.Sparkles />
                    <h3>Your Progress</h3>
                  </header>
                  <div className="apple-progress-card">
                    <div className="apple-progress-card__circle">
                      <svg viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="var(--border-primary)"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="var(--accent-primary)"
                          strokeWidth="3"
                          strokeDasharray={`${(answeredQuestions.size / totalQuestions) * 100}, 100`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="apple-progress-card__value">
                        {answeredQuestions.size}/{totalQuestions}
                      </span>
                    </div>
                    <span className="apple-progress-card__label">Questions Answered</span>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </main>

        {/* ================================
            SUBMIT MODAL
            ================================ */}
        {showExitConfirm && (
          <div className="apple-modal-backdrop">
            <div className="apple-modal">
              <div className="apple-modal__icon">
                <Icons.Send />
              </div>

              <h2 className="apple-modal__title">Submit Interview?</h2>

              <p className="apple-modal__description">
                You've completed {answeredQuestions.size} of {totalQuestions} questions.
                This action cannot be undone.
              </p>

              {answeredQuestions.size < totalQuestions && (
                <div className="apple-modal__warning">
                  <Icons.Warning />
                  <span>{totalQuestions - answeredQuestions.size} question(s) remaining</span>
                </div>
              )}

              <div className="apple-modal__actions">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  disabled={isSubmitting}
                  className="apple-btn apple-btn--secondary"
                >
                  Go Back
                </button>
                <button
                  onClick={confirmFinish}
                  disabled={isSubmitting}
                  className="apple-btn apple-btn--primary"
                >
                  {isSubmitting ? (
                    <>
                      <span className="apple-spinner" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit</span>
                      <Icons.Send />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================
            ERROR TOAST
            ================================ */}
        {error && config && (
          <div className="apple-toast" role="alert">
            <Icons.Warning />
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss">
              <Icons.X />
            </button>
          </div>
        )}
      </div>
    </ProctoredShell>
  );
}

export default CandidateInterviewPage;