import { useEffect, useState, type JSX } from 'react';
import { useParams, Link } from 'react-router-dom';
import './AdminInterviewPage.css';

// --- Types ---
type Question = {
  id: string;
  type: 'text' | 'audio' | 'code' | 'mcq';
  text: string;
  durationSec?: number;
  options?: string[];
  language?: string;
};

type AIAnalysis = {
  score: number;
  emotion: string;
  contradiction?: string | null;
  followUpQuestion?: string | null;
};

type MediaRecord = {
  id: string;
  type: 'audio' | 'video' | 'frame';
  path: string;
  transcript: string | null;
  analysisJson: AIAnalysis | null;
  createdAt: string;
};

type ProctorEvent = {
  id: string;
  type: string;
  payload: any;
  createdAt: string;
};

type Interview = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  candidateId?: string;
  status: string;
  suspicionScore: number;
  proctorEvents: ProctorEvent[];
  mediaRecords: MediaRecord[];
  customConfig?: { questions?: Question[]; proctor?: any };
  template?: { 
    name?: string;
    config: { questions?: Question[]; proctor?: any } 
  };
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// ============================================
// ICON COMPONENTS
// ============================================

const Icons = {
  Sparkles: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3l1.09 3.41L16.5 7.5l-3.41 1.09L12 12l-1.09-3.41L7.5 7.5l3.41-1.09L12 3zm6.5 9l.72 2.28L21.5 15l-2.28.72-.72 2.28-.72-2.28L15.5 15l2.28-.72.72-2.28zM5.5 15l.72 2.28L8.5 18l-2.28.72-.72 2.28-.72-2.28L2.5 18l2.28-.72.72-2.28z"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15,18 9,12 15,6"/>
    </svg>
  ),
  Save: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17,21 17,13 7,13 7,21"/>
      <polyline points="7,3 7,8 15,8"/>
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <line x1="10" y1="11" x2="10" y2="17"/>
      <line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  ),
  AlertTriangle: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
    </svg>
  ),
  User: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Mail: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  Hash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9"/>
      <line x1="4" y1="15" x2="20" y2="15"/>
      <line x1="10" y1="3" x2="8" y2="21"/>
      <line x1="16" y1="3" x2="14" y2="21"/>
    </svg>
  ),
  Shield: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Brain: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/>
    </svg>
  ),
  Mic: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
    </svg>
  ),
  Video: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  MessageSquare: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  ),
  Activity: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  FileText: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  Code: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16,18 22,12 16,6"/>
      <polyline points="8,6 2,12 8,18"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  ),
};

// ============================================
// LOADING SPINNER
// ============================================

const LoadingSpinner = ({ size = 'default' }: { size?: 'sm' | 'default' | 'lg' }) => (
  <div className={`monitor-spinner monitor-spinner--${size}`}>
    <div className="monitor-spinner__ring" />
  </div>
);

// ============================================
// TOAST COMPONENT
// ============================================

const Toast = ({
  message,
  type,
  onClose
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`monitor-toast monitor-toast--${type}`}>
      <span className="monitor-toast__icon">
        {type === 'success' ? <Icons.Check /> : <Icons.AlertTriangle />}
      </span>
      <p className="monitor-toast__message">{message}</p>
      <button onClick={onClose} className="monitor-toast__close" aria-label="Close">
        <Icons.X />
      </button>
    </div>
  );
};

// ============================================
// SUSPICION BADGE
// ============================================

const SuspicionBadge = ({ score }: { score: number }) => {
  const level = score > 7 ? 'critical' : score > 4 ? 'warning' : 'safe';
  
  return (
    <div className={`monitor-suspicion monitor-suspicion--${level}`}>
      <div className="monitor-suspicion__icon">
        <Icons.Shield />
      </div>
      <div className="monitor-suspicion__content">
        <span className="monitor-suspicion__label">Suspicion Score</span>
        <span className="monitor-suspicion__value">{score}</span>
      </div>
      <div className="monitor-suspicion__meter">
        <div 
          className="monitor-suspicion__fill" 
          style={{ width: `${Math.min(score * 10, 100)}%` }}
        />
      </div>
    </div>
  );
};

// ============================================
// QUESTION TYPE BADGE
// ============================================

const QuestionTypeBadge = ({ type }: { type: string }) => {
  const config: Record<string, { icon: JSX.Element; label: string; className: string }> = {
    text: { icon: <Icons.FileText />, label: 'Text', className: 'blue' },
    audio: { icon: <Icons.Mic />, label: 'Voice', className: 'purple' },
    mcq: { icon: <Icons.CheckCircle />, label: 'MCQ', className: 'green' },
    code: { icon: <Icons.Code />, label: 'Code', className: 'orange' },
  };

  const { icon, label, className } = config[type] || config.text;

  return (
    <span className={`monitor-type-badge monitor-type-badge--${className}`}>
      {icon}
      <span>{label}</span>
    </span>
  );
};

// ============================================
// AI ANALYSIS CARD
// ============================================

const AIAnalysisCard = ({ analysis }: { analysis: AIAnalysis }) => {
  const scoreLevel = analysis.score >= 7 ? 'good' : analysis.score >= 5 ? 'fair' : 'poor';

  return (
    <div className="monitor-ai-card">
      <div className="monitor-ai-card__header">
        <div className="monitor-ai-card__title">
          <Icons.Brain />
          <span>AI Analysis</span>
        </div>
        <div className={`monitor-ai-card__score monitor-ai-card__score--${scoreLevel}`}>
          <span className="monitor-ai-card__score-value">{analysis.score}</span>
          <span className="monitor-ai-card__score-max">/10</span>
        </div>
      </div>

      <div className="monitor-ai-card__body">
        <div className="monitor-ai-card__row">
          <span className="monitor-ai-card__label">Detected Emotion</span>
          <span className="monitor-ai-card__value">{analysis.emotion}</span>
        </div>

        {analysis.contradiction && (
          <div className="monitor-ai-card__alert monitor-ai-card__alert--warning">
            <Icons.AlertTriangle />
            <div>
              <strong>Contradiction Detected</strong>
              <p>{analysis.contradiction}</p>
            </div>
          </div>
        )}

        {analysis.followUpQuestion && (
          <div className="monitor-ai-card__alert monitor-ai-card__alert--info">
            <Icons.MessageSquare />
            <div>
              <strong>Suggested Follow-up</strong>
              <p>{analysis.followUpQuestion}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function AdminInterviewPage() {
  const { id } = useParams<{ id: string }>();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'responses'>('questions');

  useEffect(() => {
    fetchInterview();
  }, [id]);

  const fetchInterview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/interviews/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setInterview(data);
      const initialQuestions = data.customConfig?.questions || data.template?.config?.questions || [];
      setQuestions(initialQuestions);
    } catch (err) {
      console.error(err);
      setToast({ msg: 'Failed to load interview data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!interview) return;
    setSaving(true);
    try {
      const existingProctorConfig = interview.customConfig?.proctor || interview.template?.config?.proctor || {};
      const payload = { customConfig: { questions, proctor: existingProctorConfig } };

      const res = await fetch(`${API_BASE}/api/admin/interviews/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Save failed');
      setToast({ msg: 'Configuration saved successfully', type: 'success' });
    } catch (e) {
      setToast({ msg: 'Failed to save configuration', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const addQuestion = () => {
    setQuestions([...questions, {
      id: crypto.randomUUID(),
      type: 'text',
      text: '',
      durationSec: 60
    }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) {
      setToast({ msg: 'At least one question is required', type: 'error' });
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  // Loading State
  if (loading) {
    return (
      <div className="monitor-page">
        <div className="monitor-loading">
          <LoadingSpinner size="lg" />
          <p>Loading interview data...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (!interview) {
    return (
      <div className="monitor-page">
        <div className="monitor-error">
          <div className="monitor-error__icon">
            <Icons.AlertTriangle />
          </div>
          <h2>Interview Not Found</h2>
          <p>The requested interview could not be loaded.</p>
          <Link to="/admin" className="monitor-btn monitor-btn--primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const responses = interview.mediaRecords?.filter(r => ['audio', 'video'].includes(r.type)) || [];

  return (
    <div className="monitor-page">
      {/* ================================
          NAVIGATION
          ================================ */}
      <header className="monitor-nav">
        <div className="monitor-nav__container">
          <div className="monitor-nav__left">
            <Link to="/interviewer/dashboard" className="monitor-nav__back">
              <Icons.ChevronLeft />
              <span>Back</span>
            </Link>

            <div className="monitor-nav__divider" />

            <div className="monitor-nav__brand">
              <div className="monitor-nav__logo">
                <Icons.Eye />
              </div>
              <div>
                <h1 className="monitor-nav__title">Interview Monitor</h1>
                <p className="monitor-nav__subtitle">
                  {interview.template?.name || 'Custom Interview'}
                </p>
              </div>
            </div>
          </div>

          <div className="monitor-nav__right">
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="monitor-btn monitor-btn--primary"
            >
              {saving ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Icons.Save />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ================================
          MAIN CONTENT
          ================================ */}
      <main className="monitor-main">
        <div className="monitor-main__container">

          {/* Interview Info Card */}
          <section className="monitor-info-card">
            <div className="monitor-info-card__details">
              <div className="monitor-info-card__avatar">
                {interview.candidateName.charAt(0).toUpperCase()}
              </div>
              <div className="monitor-info-card__content">
                <h2 className="monitor-info-card__name">{interview.candidateName}</h2>
                <div className="monitor-info-card__meta">
                  <span className="monitor-info-card__item">
                    <Icons.Mail />
                    {interview.candidateEmail}
                  </span>
                  <span className="monitor-info-card__item">
                    <Icons.Hash />
                    {interview.id.slice(0, 8)}
                  </span>
                  {interview.candidateId && (
                    <span className="monitor-info-card__item">
                      <Icons.User />
                      {interview.candidateId}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <SuspicionBadge score={interview.suspicionScore} />
          </section>

          {/* Tabs */}
          <div className="monitor-tabs">
            <button
              className={`monitor-tabs__btn ${activeTab === 'questions' ? 'monitor-tabs__btn--active' : ''}`}
              onClick={() => setActiveTab('questions')}
            >
              <Icons.FileText />
              <span>Questions</span>
              <span className="monitor-tabs__count">{questions.length}</span>
            </button>
            <button
              className={`monitor-tabs__btn ${activeTab === 'responses' ? 'monitor-tabs__btn--active' : ''}`}
              onClick={() => setActiveTab('responses')}
            >
              <Icons.Brain />
              <span>AI Responses</span>
              <span className="monitor-tabs__count">{responses.length}</span>
            </button>
          </div>

          {/* Content Grid */}
          <div className="monitor-grid">
            {/* Left Panel */}
            <div className="monitor-panel monitor-panel--main">
              {activeTab === 'questions' && (
                <>
                  {/* Questions Header */}
                  <div className="monitor-panel__header">
                    <div className="monitor-panel__header-left">
                      <div className="monitor-panel__icon monitor-panel__icon--blue">
                        <Icons.FileText />
                      </div>
                      <div>
                        <h2 className="monitor-panel__title">Questions Configuration</h2>
                        <p className="monitor-panel__subtitle">Edit interview questions</p>
                      </div>
                    </div>
                    <button onClick={addQuestion} className="monitor-btn monitor-btn--secondary monitor-btn--sm">
                      <Icons.Plus />
                      <span>Add Question</span>
                    </button>
                  </div>

                  {/* Questions List */}
                  <div className="monitor-questions">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="monitor-question">
                        <div className="monitor-question__number">{idx + 1}</div>

                        <div className="monitor-question__content">
                          <div className="monitor-question__header">
                            <QuestionTypeBadge type={q.type} />

                            <select
                              value={q.type}
                              onChange={(e) => updateQuestion(idx, 'type', e.target.value)}
                              className="monitor-select"
                            >
                              <option value="text">Text Response</option>
                              <option value="audio">Voice Recording</option>
                              <option value="mcq">Multiple Choice</option>
                              <option value="code">Code Challenge</option>
                            </select>

                            <div className="monitor-duration">
                              <Icons.Clock />
                              <input
                                type="number"
                                min="10"
                                max="600"
                                value={q.durationSec || 60}
                                onChange={(e) => updateQuestion(idx, 'durationSec', parseInt(e.target.value) || 60)}
                                className="monitor-duration__input"
                              />
                              <span>sec</span>
                            </div>

                            <button
                              onClick={() => removeQuestion(idx)}
                              className="monitor-question__delete"
                              aria-label="Delete question"
                            >
                              <Icons.Trash />
                            </button>
                          </div>

                          <textarea
                            value={q.text}
                            onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                            placeholder="Enter your interview question here..."
                            className="monitor-textarea"
                            rows={3}
                          />

                          {q.type === 'mcq' && (
                            <div className="monitor-question__options">
                              <label className="monitor-label">Answer Options</label>
                              <input
                                type="text"
                                value={q.options?.join(', ') || ''}
                                onChange={(e) => updateQuestion(idx, 'options', e.target.value.split(',').map(s => s.trim()))}
                                placeholder="Enter options separated by commas: Option A, Option B, Option C"
                                className="monitor-input"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'responses' && (
                <>
                  {/* Responses Header */}
                  <div className="monitor-panel__header">
                    <div className="monitor-panel__header-left">
                      <div className="monitor-panel__icon monitor-panel__icon--purple">
                        <Icons.Brain />
                      </div>
                      <div>
                        <h2 className="monitor-panel__title">AI Analysis & Responses</h2>
                        <p className="monitor-panel__subtitle">Review candidate submissions</p>
                      </div>
                    </div>
                  </div>

                  {/* Responses List */}
                  <div className="monitor-responses">
                    {responses.length === 0 ? (
                      <div className="monitor-empty">
                        <div className="monitor-empty__icon">
                          <Icons.MessageSquare />
                        </div>
                        <h3>No Responses Yet</h3>
                        <p>The candidate hasn't submitted any responses.</p>
                      </div>
                    ) : (
                      responses.map((record) => (
                        <div key={record.id} className="monitor-response">
                          <div className="monitor-response__header">
                            <div className="monitor-response__type">
                              {record.type === 'audio' ? <Icons.Mic /> : <Icons.Video />}
                              <span>{record.type === 'audio' ? 'Voice' : 'Video'} Response</span>
                            </div>
                            <span className="monitor-response__time">
                              {new Date(record.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <div className="monitor-response__body">
                            {/* Media Player */}
                            <div className="monitor-response__player">
                              {record.type === 'audio' ? (
                                <audio controls className="monitor-audio">
                                  <source src={`${API_BASE}/${record.path}`} />
                                </audio>
                              ) : (
                                <video controls className="monitor-video">
                                  <source src={`${API_BASE}/${record.path}`} />
                                </video>
                              )}
                            </div>

                            {/* Transcript */}
                            {record.transcript && (
                              <div className="monitor-response__transcript">
                                <label>Transcript</label>
                                <p>"{record.transcript}"</p>
                              </div>
                            )}

                            {/* AI Analysis */}
                            {record.analysisJson ? (
                              <AIAnalysisCard analysis={record.analysisJson} />
                            ) : (
                              <div className="monitor-response__processing">
                                <LoadingSpinner size="sm" />
                                <span>Processing AI analysis...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Right Panel - Proctor Logs */}
            <aside className="monitor-panel monitor-panel--sidebar">
              <div className="monitor-panel__header monitor-panel__header--compact">
                <div className="monitor-panel__header-left">
                  <div className="monitor-panel__icon monitor-panel__icon--orange">
                    <Icons.Activity />
                  </div>
                  <h2 className="monitor-panel__title">Proctor Logs</h2>
                </div>
                <span className="monitor-badge">{interview.proctorEvents.length}</span>
              </div>

              <div className="monitor-logs">
                {interview.proctorEvents.length === 0 ? (
                  <div className="monitor-logs__empty">
                    <Icons.Shield />
                    <span>No events detected</span>
                  </div>
                ) : (
                  interview.proctorEvents.map((event) => {
                    const isViolation = event.type.includes('VIOLATION') || 
                                        event.type.includes('forbidden') ||
                                        event.type.includes('FOCUS');
                    return (
                      <div 
                        key={event.id} 
                        className={`monitor-log ${isViolation ? 'monitor-log--violation' : ''}`}
                      >
                        <div className="monitor-log__header">
                          <span className={`monitor-log__type ${isViolation ? 'monitor-log__type--violation' : ''}`}>
                            {event.type.replace(/_/g, ' ')}
                          </span>
                          <span className="monitor-log__time">
                            {new Date(event.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="monitor-log__payload">
                          {typeof event.payload === 'string' 
                            ? event.payload 
                            : JSON.stringify(event.payload)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default AdminInterviewPage;