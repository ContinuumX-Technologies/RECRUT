import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminDashboardPage.css';

type CodingMode = 'leetcode' | 'ai';

type TestCase = {
  input: string;
  output: string;
};

type Question = {
  id: string;
  text: string;
  type: 'text' | 'audio' | 'code' | 'mcq';
  durationSec: number;
  codingMode?: CodingMode;
  description?: string;
  language?: string;
  options?: string[];
  testCases?: TestCase[];
  hiddenTestCases?: TestCase[];
  aiConfig?: {
    difficulty: 'easy' | 'medium' | 'hard';
    dataStructure: string;
    algorithm: string;
    promptHint: string;
  };
};

type ProctorConfig = {
  heartbeatMs: number;
  frameIntervalMs: number;
  focusLossThreshold: number;
};

type Template = {
  id: string;
  name: string;
  role: string;
  level: string;
  description?: string;
  config: {
    questions: Question[];
    proctor: ProctorConfig;
  };
};

type Interview = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  candidateId: string;
  status: string;
  scheduledAt?: string;
  template?: Template;
  customConfig?: any;
};

type CandidateUser = {
  id: string;
  name: string;
  email: string;
  candidateId?: string | null;
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

// ============================================
// ICON COMPONENTS
// ============================================

const Icons = {
  Sparkles: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3l1.09 3.41L16.5 7.5l-3.41 1.09L12 12l-1.09-3.41L7.5 7.5l3.41-1.09L12 3zm6.5 9l.72 2.28L21.5 15l-2.28.72-.72 2.28-.72-2.28L15.5 15l2.28-.72.72-2.28zM5.5 15l.72 2.28L8.5 18l-2.28.72-.72 2.28-.72-2.28L2.5 18l2.28-.72.72-2.28z" />
    </svg>
  ),
  Menu: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Briefcase: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
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
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Save: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17,21 17,13 7,13 7,21" />
      <polyline points="7,3 7,8 15,8" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  User: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  LogOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Code: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16,18 22,12 16,6" />
      <polyline points="8,6 2,12 8,18" />
    </svg>
  ),
  Mic: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
    </svg>
  ),
  CheckCircle: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  ),
  AlertCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Wand: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4V2" />
      <path d="M15 16v-2" />
      <path d="M8 9h2" />
      <path d="M20 9h2" />
      <path d="M17.8 11.8L19 13" />
      <path d="M15 9h0" />
      <path d="M17.8 6.2L19 5" />
      <path d="M3 21l9-9" />
      <path d="M12.2 6.2L11 5" />
    </svg>
  ),
};

// ============================================
// LOADING SPINNER
// ============================================

const LoadingSpinner = ({ size = 'default' }: { size?: 'sm' | 'default' | 'lg' }) => (
  <div className={`admin-spinner admin-spinner--${size}`}>
    <div className="admin-spinner__ring" />
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
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`admin-toast admin-toast--${type}`}>
      <span className="admin-toast__icon">
        {type === 'success' ? <Icons.Check /> : type === 'error' ? <Icons.X /> : <Icons.Sparkles />}
      </span>
      <p className="admin-toast__message">{message}</p>
      <button onClick={onClose} className="admin-toast__close" aria-label="Close">
        <Icons.X />
      </button>
    </div>
  );
};

// ============================================
// STATUS BADGE
// ============================================

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`admin-status-badge admin-status-badge--${status}`}>
    <span className="admin-status-badge__dot" />
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
);

// ============================================
// MAIN COMPONENT
// ============================================

export function AdminDashboardPage() {
  const { user, token, logout } = useAuth();
  const [tab, setTab] = useState<'templates' | 'interviews'>('templates');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loading, setLoading] = useState({
    templates: false,
    interviews: false,
    submit: false
  });

  // --- Data State ---
  const [templates, setTemplates] = useState<Template[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);

  // --- Template Form State ---
  const [tplForm, setTplForm] = useState({
    name: '',
    role: '',
    level: '',
    description: '',
  });

  // Questions Builder State
  const [questions, setQuestions] = useState<Question[]>([
    { id: '1', type: 'text', text: 'Tell me about yourself.', durationSec: 120 }
  ]);

  // Proctor Config State
  const [proctorConfig, setProctorConfig] = useState<ProctorConfig>({
    heartbeatMs: 5000,
    frameIntervalMs: 5000,
    focusLossThreshold: 3
  });

  // --- Schedule Form State ---
  const [scheduleForm, setScheduleForm] = useState({
    candidateName: '',
    candidateEmail: '',
    candidateId: '',
    templateId: '',
    scheduledAt: '',
  });

  // --- Search State ---
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidateResults, setCandidateResults] = useState<CandidateUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateUser | null>(null);
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

  // Add this state for delete confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- Effects ---
  useEffect(() => {
    if (token) {
      loadTemplates();
      loadInterviews();
    }
  }, [token]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Data Loaders ---
  const loadTemplates = useCallback(async () => {
    if (!token) return;
    setLoading(prev => ({ ...prev, templates: true }));
    try {
      const res = await fetch(`${API_BASE}/api/admin/templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : []);
      } else {
        setToast({ message: 'Failed to load templates', type: 'error' });
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setToast({ message: 'Network error loading templates', type: 'error' });
    } finally {
      setLoading(prev => ({ ...prev, templates: false }));
    }
  }, [token]);

  const loadInterviews = useCallback(async () => {
    if (!token) return;
    setLoading(prev => ({ ...prev, interviews: true }));
    try {
      const res = await fetch(`${API_BASE}/api/admin/interviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInterviews(Array.isArray(data) ? data : []);
      } else {
        setToast({ message: 'Failed to load interviews', type: 'error' });
      }
    } catch (err) {
      console.error('Error loading interviews:', err);
      setToast({ message: 'Network error loading interviews', type: 'error' });
    } finally {
      setLoading(prev => ({ ...prev, interviews: false }));
    }
  }, [token]);

  const searchCandidates = useCallback(async (query: string) => {
    if (!query.trim() || !token) {
      setCandidateResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/candidates?query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCandidateResults(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Search error:', err);
      setToast({ message: 'Search failed', type: 'error' });
    } finally {
      setSearchLoading(false);
    }
  }, [token]);

  // --- Handlers ---
  const addQuestion = () => {
    const newId = crypto.randomUUID();
    setQuestions(prev => [...prev, {
      id: newId,
      type: 'text',
      text: '',
      durationSec: 60
    }]);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length === 1) {
      setToast({ message: 'At least one question is required', type: 'error' });
      return;
    }
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  // Delete interview handler
  const handleDeleteInterview = useCallback(async (interviewId: string) => {
    if (!token) return;

    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/interviews/${interviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setToast({ message: 'Interview deleted successfully', type: 'success' });
        setInterviews(prev => prev.filter(iv => iv.id !== interviewId));
      } else {
        const errorData = await res.json().catch(() => ({}));
        setToast({ message: errorData.error || 'Failed to delete interview', type: 'error' });
      }
    } catch (err) {
      console.error('Delete interview error:', err);
      setToast({ message: 'Network error deleting interview', type: 'error' });
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  }, [token]);

  const updateQuestion = (idx: number, field: keyof Question, val: any) => {
    setQuestions(prev => prev.map((q, i) =>
      i === idx ? { ...q, [field]: val } : q
    ));
  };

  const updateProctor = (field: keyof ProctorConfig, val: number) => {
    if (val < 0) return;
    setProctorConfig(prev => ({ ...prev, [field]: val }));
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const hasEmptyQuestion = questions.some(q => !q.text.trim());
    if (hasEmptyQuestion) {
      setToast({ message: 'All questions must have text', type: 'error' });
      return;
    }

    setLoading(prev => ({ ...prev, submit: true }));

    try {
      questions.forEach(q => {
        if (q.type === 'code' && q.codingMode === 'leetcode') {
          JSON.stringify(q.testCases ?? []);
          JSON.stringify(q.hiddenTestCases ?? []);
        }
      });
    } catch {
      setToast({ message: "Invalid JSON in test cases.", type: "error" });
      setLoading(prev => ({ ...prev, submit: false }));
      return;
    }

    const finalConfig = {
      questions: questions.map(q => ({ ...q, text: q.text.trim() })),
      proctor: proctorConfig
    };

    try {
      const res = await fetch(`${API_BASE}/api/admin/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...tplForm,
          name: tplForm.name.trim(),
          role: tplForm.role.trim(),
          description: tplForm.description.trim(),
          config: finalConfig
        }),
      });

      if (res.ok) {
        setToast({ message: 'Template created successfully!', type: 'success' });
        setTplForm({ name: '', role: '', level: '', description: '' });
        setQuestions([{ id: '1', type: 'text', text: 'Tell me about yourself.', durationSec: 120 }]);
        setProctorConfig({ heartbeatMs: 5000, frameIntervalMs: 5000, focusLossThreshold: 3 });
        loadTemplates();
      } else {
        const errorData = await res.json().catch(() => ({}));
        setToast({ message: errorData.message || 'Failed to create template', type: 'error' });
      }
    } catch (err) {
      console.error('Template creation error:', err);
      setToast({ message: 'Network error', type: 'error' });
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  };

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(prev => ({ ...prev, submit: true }));

    try {
      const res = await fetch(`${API_BASE}/api/admin/interviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...scheduleForm,
          candidateName: scheduleForm.candidateName.trim(),
          candidateEmail: scheduleForm.candidateEmail.trim(),
        }),
      });

      if (res.ok) {
        setToast({ message: 'Interview scheduled successfully!', type: 'success' });
        setScheduleForm({ candidateName: '', candidateEmail: '', candidateId: '', templateId: '', scheduledAt: '' });
        setSelectedCandidate(null);
        setCandidateQuery('');
        setCandidateResults([]);
        loadInterviews();
      } else {
        const errorData = await res.json().catch(() => ({}));
        setToast({ message: errorData.message || 'Failed to schedule interview', type: 'error' });
      }
    } catch (err) {
      console.error('Interview scheduling error:', err);
      setToast({ message: 'Network error', type: 'error' });
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  };

  const handleGenerateAI = async (idx: number, questionId: string, aiConfig: any) => {
    try {
      setAiLoading(prev => ({ ...prev, [questionId]: true }));
      setToast({ message: "Generating question with AI...", type: "info" });

      const res = await fetch(`${API_BASE}/api/admin/ai-generate-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(aiConfig)
      });

      if (!res.ok) throw new Error("AI generation failed");

      const data = await res.json();

      updateQuestion(idx, 'text', data.title);
      updateQuestion(idx, 'description', data.description);
      updateQuestion(idx, 'testCases', data.testCases);
      updateQuestion(idx, 'hiddenTestCases', data.hiddenTestCases);

      setToast({ message: "AI question generated!", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to generate AI question", type: "error" });
    } finally {
      setAiLoading(prev => ({ ...prev, [questionId]: false }));
    }
  };

  // Memoized values
  const upcomingInterviews = useMemo(() =>
    interviews.filter(i => i.status === 'scheduled').length, [interviews]);
  const totalTemplates = useMemo(() => templates.length, [templates]);

  // Handle unauthorized access
  if (!user || user.role !== 'INTERVIEWER') {
    return (
      <div className="admin-access-denied">
        <div className="admin-access-denied__card">
          <div className="admin-access-denied__icon">
            <Icons.X />
          </div>
          <h2 className="admin-access-denied__title">Access Denied</h2>
          <p className="admin-access-denied__text">You don't have permission to view this page.</p>
          <button onClick={() => window.history.back()} className="admin-btn admin-btn--primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* ================================
          NAVIGATION
          ================================ */}
      <header className="admin-nav">
        <div className="admin-nav__container">
          {/* Left */}
          <div className="admin-nav__left">
            <button
              className="admin-nav__menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <Icons.X /> : <Icons.Menu />}
            </button>

            <div className="admin-nav__brand">
              <div className="admin-nav__logo">
                <Icons.Sparkles />
              </div>
              <div className="admin-nav__brand-text">
                <h1 className="admin-nav__title">Admin Dashboard</h1>
                <p className="admin-nav__subtitle">{user.name}</p>
              </div>
            </div>
          </div>

          {/* Center - Stats & Tabs (Desktop) */}
          <div className="admin-nav__center">
            <div className="admin-nav__stats">
              <div className="admin-stat">
                <span className="admin-stat__dot admin-stat__dot--green" />
                <span className="admin-stat__text">{totalTemplates} Templates</span>
              </div>
              <div className="admin-stat__divider" />
              <div className="admin-stat">
                <span className="admin-stat__dot admin-stat__dot--blue" />
                <span className="admin-stat__text">{upcomingInterviews} Scheduled</span>
              </div>
            </div>

            <div className="admin-nav__tabs">
              <button
                className={`admin-nav__tab ${tab === 'templates' ? 'admin-nav__tab--active' : ''}`}
                onClick={() => setTab('templates')}
              >
                <Icons.Briefcase />
                <span>Templates</span>
              </button>
              <button
                className={`admin-nav__tab ${tab === 'interviews' ? 'admin-nav__tab--active' : ''}`}
                onClick={() => setTab('interviews')}
              >
                <Icons.Calendar />
                <span>Interviews</span>
              </button>
            </div>
          </div>

          {/* Right */}
          <div className="admin-nav__right">
            <button onClick={logout} className="admin-nav__logout">
              <Icons.LogOut />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="admin-mobile-menu">
            <div className="admin-mobile-menu__tabs">
              <button
                className={`admin-mobile-menu__tab ${tab === 'templates' ? 'admin-mobile-menu__tab--active' : ''}`}
                onClick={() => { setTab('templates'); setMobileMenuOpen(false); }}
              >
                <Icons.Briefcase />
                <span>Templates</span>
              </button>
              <button
                className={`admin-mobile-menu__tab ${tab === 'interviews' ? 'admin-mobile-menu__tab--active' : ''}`}
                onClick={() => { setTab('interviews'); setMobileMenuOpen(false); }}
              >
                <Icons.Calendar />
                <span>Interviews</span>
              </button>
            </div>

            <div className="admin-mobile-menu__stats">
              <div className="admin-mobile-menu__stat">
                <span className="admin-mobile-menu__stat-value">{totalTemplates}</span>
                <span className="admin-mobile-menu__stat-label">Templates</span>
              </div>
              <div className="admin-mobile-menu__stat-divider" />
              <div className="admin-mobile-menu__stat">
                <span className="admin-mobile-menu__stat-value">{upcomingInterviews}</span>
                <span className="admin-mobile-menu__stat-label">Scheduled</span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ================================
          MAIN CONTENT
          ================================ */}
      <main className="admin-main">
        <div className="admin-main__container">

          {/* ================== TEMPLATES TAB ================== */}
          {tab === 'templates' && (
            <div className="admin-grid">
              {/* Template Creator */}
              <section className="admin-panel admin-panel--large">
                <div className="admin-panel__header">
                  <div className="admin-panel__header-left">
                    <div className="admin-panel__icon admin-panel__icon--blue">
                      <Icons.Plus />
                    </div>
                    <div>
                      <h2 className="admin-panel__title">Create Template</h2>
                      <p className="admin-panel__subtitle">Design your interview structure</p>
                    </div>
                  </div>
                  <div className="admin-badge">
                    {questions.length} Question{questions.length !== 1 ? 's' : ''}
                  </div>
                </div>

                <form onSubmit={handleCreateTemplate} className="admin-form">
                  {/* Basic Info */}
                  <div className="admin-form__section">
                    <div className="admin-form__row">
                      <div className="admin-input-group">
                        <label className="admin-label">Template Name</label>
                        <input
                          type="text"
                          required
                          className="admin-input"
                          placeholder="Senior Frontend Developer"
                          value={tplForm.name}
                          onChange={e => setTplForm({ ...tplForm, name: e.target.value })}
                        />
                      </div>
                      <div className="admin-input-group">
                        <label className="admin-label">Experience Level</label>
                        <select
                          required
                          className="admin-select"
                          value={tplForm.level}
                          onChange={e => setTplForm({ ...tplForm, level: e.target.value })}
                        >
                          <option value="">Select Level...</option>
                          <option value="junior">Junior (0-2 years)</option>
                          <option value="mid">Mid-Level (2-5 years)</option>
                          <option value="senior">Senior (5+ years)</option>
                          <option value="lead">Lead/Principal</option>
                        </select>
                      </div>
                    </div>

                    <div className="admin-input-group">
                      <label className="admin-label">Target Role</label>
                      <input
                        type="text"
                        required
                        className="admin-input"
                        placeholder="React Developer, DevOps Engineer"
                        value={tplForm.role}
                        onChange={e => setTplForm({ ...tplForm, role: e.target.value })}
                      />
                    </div>

                    <div className="admin-input-group">
                      <label className="admin-label">Description</label>
                      <textarea
                        className="admin-textarea"
                        rows={3}
                        placeholder="Brief description of the interview..."
                        value={tplForm.description}
                        onChange={e => setTplForm({ ...tplForm, description: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Proctor Config */}
                  <div className="admin-proctor-config">
                    <h3 className="admin-proctor-config__title">
                      <Icons.Clock />
                      <span>Proctor Configuration</span>
                    </h3>
                    <div className="admin-proctor-config__grid">
                      <div className="admin-input-group">
                        <label className="admin-label admin-label--sm">Heartbeat Interval</label>
                        <div className="admin-input-with-suffix">
                          <input
                            type="number"
                            min="1000"
                            max="60000"
                            step="1000"
                            className="admin-input admin-input--sm"
                            value={proctorConfig.heartbeatMs}
                            onChange={e => updateProctor('heartbeatMs', parseInt(e.target.value) || 5000)}
                          />
                          <span className="admin-input-suffix">ms</span>
                        </div>
                      </div>
                      <div className="admin-input-group">
                        <label className="admin-label admin-label--sm">Frame Capture</label>
                        <div className="admin-input-with-suffix">
                          <input
                            type="number"
                            min="1000"
                            max="60000"
                            step="1000"
                            className="admin-input admin-input--sm"
                            value={proctorConfig.frameIntervalMs}
                            onChange={e => updateProctor('frameIntervalMs', parseInt(e.target.value) || 5000)}
                          />
                          <span className="admin-input-suffix">ms</span>
                        </div>
                      </div>
                      <div className="admin-input-group">
                        <label className="admin-label admin-label--sm">Focus Loss Limit</label>
                        <div className="admin-input-with-suffix">
                          <input
                            type="number"
                            min="1"
                            max="10"
                            className="admin-input admin-input--sm"
                            value={proctorConfig.focusLossThreshold}
                            onChange={e => updateProctor('focusLossThreshold', parseInt(e.target.value) || 3)}
                          />
                          <span className="admin-input-suffix">strikes</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Questions Builder */}
                  <div className="admin-questions">
                    <div className="admin-questions__header">
                      <h3 className="admin-questions__title">Interview Questions</h3>
                      <button
                        type="button"
                        onClick={addQuestion}
                        className="admin-btn admin-btn--primary admin-btn--sm"
                      >
                        <Icons.Plus />
                        <span>Add Question</span>
                      </button>
                    </div>

                    <div className="admin-questions__list">
                      {questions.map((q, idx) => (
                        <div key={q.id} className="admin-question-card">
                          <span className="admin-question-card__number">{idx + 1}</span>

                          {questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeQuestion(idx)}
                              className="admin-question-card__delete"
                              aria-label="Delete question"
                            >
                              <Icons.Trash />
                            </button>
                          )}

                          <div className="admin-question-card__content">
                            <div className="admin-question-card__row">
                              <select
                                className="admin-select"
                                value={q.type}
                                onChange={e => updateQuestion(idx, 'type', e.target.value)}
                              >
                                <option value="text">✏️ Text Response</option>
                                <option value="audio">🎤 Voice Response</option>
                                <option value="mcq">☑️ Multiple Choice</option>
                                <option value="code">💻 Code Challenge</option>
                              </select>

                              <div className="admin-duration-input">
                                <Icons.Clock />
                                <input
                                  type="number"
                                  min="10"
                                  max="600"
                                  className="admin-duration-input__field"
                                  value={q.durationSec}
                                  onChange={e => updateQuestion(idx, 'durationSec', parseInt(e.target.value) || 60)}
                                />
                                <span>sec</span>
                              </div>
                            </div>

                            <textarea
                              required
                              className="admin-textarea"
                              rows={3}
                              placeholder="Enter your question here..."
                              value={q.text}
                              onChange={e => updateQuestion(idx, 'text', e.target.value)}
                            />

                            {/* Code Question Options */}
                            {q.type === 'code' && (
                              <div className="admin-code-config">
                                <div className="admin-input-group">
                                  <label className="admin-label admin-label--sm">Coding Type</label>
                                  <select
                                    className="admin-select"
                                    value={q.codingMode || 'leetcode'}
                                    onChange={e => {
                                      const mode = e.target.value as CodingMode;
                                      updateQuestion(idx, 'codingMode', mode);
                                      if (mode === 'ai') {
                                        updateQuestion(idx, 'aiConfig', {
                                          difficulty: 'medium',
                                          dataStructure: '',
                                          algorithm: '',
                                          promptHint: ''
                                        });
                                      }
                                    }}
                                  >
                                    <option value="leetcode">🧩 LeetCode Style</option>
                                    <option value="ai">🤖 AI Generated</option>
                                  </select>
                                </div>

                                {q.codingMode === 'leetcode' && (
                                  <>
                                    <div className="admin-input-group">
                                      <label className="admin-label admin-label--sm">Description</label>
                                      <textarea
                                        className="admin-textarea admin-textarea--sm"
                                        placeholder="Problem description..."
                                        value={q.description || ''}
                                        onChange={e => updateQuestion(idx, 'description', e.target.value)}
                                      />
                                    </div>

                                    <div className="admin-input-group">
                                      <label className="admin-label admin-label--sm">Language</label>
                                      <select
                                        className="admin-select"
                                        value={q.language || 'javascript'}
                                        onChange={e => updateQuestion(idx, 'language', e.target.value)}
                                      >
                                        <option value="javascript">JavaScript</option>
                                        <option value="typescript">TypeScript</option>
                                        <option value="python">Python</option>
                                        <option value="java">Java</option>
                                        <option value="cpp">C++</option>
                                      </select>
                                    </div>

                                    <div className="admin-input-group">
                                      <label className="admin-label admin-label--sm">Public Test Cases (JSON)</label>
                                      <textarea
                                        className="admin-textarea admin-textarea--mono"
                                        placeholder='[{ "input": "[1,2]", "output": "3" }]'
                                        value={JSON.stringify(q.testCases || [], null, 2)}
                                        onChange={e => {
                                          try {
                                            updateQuestion(idx, 'testCases', JSON.parse(e.target.value));
                                          } catch { }
                                        }}
                                      />
                                    </div>

                                    <div className="admin-input-group">
                                      <label className="admin-label admin-label--sm">Hidden Test Cases (JSON)</label>
                                      <textarea
                                        className="admin-textarea admin-textarea--mono"
                                        placeholder='[{ "input": "[5,7]", "output": "12" }]'
                                        value={JSON.stringify(q.hiddenTestCases || [], null, 2)}
                                        onChange={e => {
                                          try {
                                            updateQuestion(idx, 'hiddenTestCases', JSON.parse(e.target.value));
                                          } catch { }
                                        }}
                                      />
                                    </div>
                                  </>
                                )}

                                {q.codingMode === 'ai' && (
                                  <>
                                    <div className="admin-form__row">
                                      <div className="admin-input-group">
                                        <label className="admin-label admin-label--sm">Difficulty</label>
                                        <select
                                          className="admin-select"
                                          value={q.aiConfig?.difficulty || 'medium'}
                                          onChange={e => updateQuestion(idx, 'aiConfig', {
                                            ...q.aiConfig,
                                            difficulty: e.target.value
                                          })}
                                        >
                                          <option value="easy">Easy</option>
                                          <option value="medium">Medium</option>
                                          <option value="hard">Hard</option>
                                        </select>
                                      </div>
                                      <div className="admin-input-group">
                                        <label className="admin-label admin-label--sm">Data Structure</label>
                                        <input
                                          type="text"
                                          className="admin-input admin-input--sm"
                                          placeholder="Array, Tree, Graph..."
                                          value={q.aiConfig?.dataStructure || ''}
                                          onChange={e => updateQuestion(idx, 'aiConfig', {
                                            ...q.aiConfig,
                                            dataStructure: e.target.value
                                          })}
                                        />
                                      </div>
                                    </div>

                                    <div className="admin-input-group">
                                      <label className="admin-label admin-label--sm">Algorithm</label>
                                      <input
                                        type="text"
                                        className="admin-input admin-input--sm"
                                        placeholder="BFS, DP, Binary Search..."
                                        value={q.aiConfig?.algorithm || ''}
                                        onChange={e => updateQuestion(idx, 'aiConfig', {
                                          ...q.aiConfig,
                                          algorithm: e.target.value
                                        })}
                                      />
                                    </div>

                                    <div className="admin-input-group">
                                      <label className="admin-label admin-label--sm">Prompt Guidance</label>
                                      <textarea
                                        className="admin-textarea admin-textarea--sm"
                                        placeholder="Optional guidance for AI..."
                                        value={q.aiConfig?.promptHint || ''}
                                        onChange={e => updateQuestion(idx, 'aiConfig', {
                                          ...q.aiConfig,
                                          promptHint: e.target.value
                                        })}
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      disabled={aiLoading[q.id]}
                                      className="admin-btn admin-btn--purple"
                                      onClick={() => handleGenerateAI(idx, q.id, q.aiConfig)}
                                    >
                                      {aiLoading[q.id] ? (
                                        <>
                                          <LoadingSpinner size="sm" />
                                          <span>Generating...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Icons.Wand />
                                          <span>Generate with AI</span>
                                        </>
                                      )}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading.submit || !tplForm.name.trim() || !tplForm.role.trim() || !tplForm.level}
                    className="admin-btn admin-btn--primary admin-btn--lg admin-btn--full"
                  >
                    {loading.submit ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>Creating Template...</span>
                      </>
                    ) : (
                      <>
                        <Icons.Save />
                        <span>Save Template Configuration</span>
                      </>
                    )}
                  </button>
                </form>
              </section>

              {/* Template Library */}
              <section className="admin-panel admin-panel--small">
                <div className="admin-panel__header admin-panel__header--simple">
                  <h2 className="admin-panel__title">Template Library</h2>
                  <div className="admin-badge">{templates.length} Total</div>
                </div>

                {loading.templates ? (
                  <LoadingSpinner />
                ) : templates.length === 0 ? (
                  <div className="admin-empty-state">
                    <div className="admin-empty-state__icon">
                      <Icons.Briefcase />
                    </div>
                    <p className="admin-empty-state__title">No templates yet</p>
                    <p className="admin-empty-state__text">Create your first template to get started</p>
                  </div>
                ) : (
                  <div className="admin-template-list">
                    {templates.map(t => (
                      <div key={t.id} className="admin-template-card">
                        <div className="admin-template-card__header">
                          <h3 className="admin-template-card__name">{t.name}</h3>
                          <button className="admin-template-card__action">
                            <Icons.ChevronRight />
                          </button>
                        </div>

                        <div className="admin-template-card__badges">
                          <span className="admin-tag admin-tag--blue">
                            <Icons.Briefcase />
                            {t.role}
                          </span>
                          <span className="admin-tag admin-tag--purple">
                            {t.level?.toUpperCase()}
                          </span>
                        </div>

                        {t.description && (
                          <p className="admin-template-card__desc">{t.description}</p>
                        )}

                        <div className="admin-template-card__footer">
                          <div className="admin-template-card__stats">
                            <span>
                              <span className="admin-dot admin-dot--green" />
                              {t.config?.questions?.length || 0} Questions
                            </span>
                            <span>
                              <span className="admin-dot admin-dot--blue" />
                              {t.config?.proctor?.heartbeatMs ? `${t.config.proctor.heartbeatMs / 1000}s` : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ================== INTERVIEWS TAB ================== */}
          {tab === 'interviews' && (
            <div className="admin-grid admin-grid--reverse">
              {/* Schedule Form */}
              <section className="admin-panel admin-panel--small">
                <div className="admin-panel__header">
                  <div className="admin-panel__header-left">
                    <div className="admin-panel__icon admin-panel__icon--blue">
                      <Icons.Calendar />
                    </div>
                    <div>
                      <h2 className="admin-panel__title">Schedule Interview</h2>
                      <p className="admin-panel__subtitle">Set up a new session</p>
                    </div>
                  </div>
                </div>

                {/* Candidate Search */}
                <div className="admin-search">
                  <label className="admin-label">Find Candidate</label>
                  <div className="admin-search__input-wrapper">
                    <span className="admin-search__icon">
                      {searchLoading ? <LoadingSpinner size="sm" /> : <Icons.Search />}
                    </span>
                    <input
                      type="text"
                      className="admin-input admin-input--search"
                      placeholder="Search by name, email or ID..."
                      value={candidateQuery}
                      onChange={e => {
                        setCandidateQuery(e.target.value);
                        if (e.target.value.length > 2) searchCandidates(e.target.value);
                        else setCandidateResults([]);
                      }}
                    />
                  </div>

                  {candidateResults.length > 0 && (
                    <div className="admin-search__dropdown">
                      {candidateResults.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="admin-search__result"
                          onClick={() => {
                            setSelectedCandidate(c);
                            setScheduleForm({
                              ...scheduleForm,
                              candidateName: c.name,
                              candidateEmail: c.email,
                              candidateId: c.candidateId || ''
                            });
                            setCandidateResults([]);
                            setCandidateQuery(c.name);
                          }}
                        >
                          <div className="admin-search__result-info">
                            <span className="admin-search__result-name">{c.name}</span>
                            <span className="admin-search__result-email">{c.email}</span>
                            {c.candidateId && (
                              <span className="admin-search__result-id">ID: {c.candidateId}</span>
                            )}
                          </div>
                          <Icons.User />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Candidate */}
                {selectedCandidate && (
                  <div className="admin-selected-candidate">
                    <div className="admin-selected-candidate__info">
                      <div className="admin-selected-candidate__avatar">
                        <Icons.User />
                      </div>
                      <div>
                        <span className="admin-selected-candidate__name">{selectedCandidate.name}</span>
                        <span className="admin-selected-candidate__email">{selectedCandidate.email}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="admin-selected-candidate__clear"
                      onClick={() => {
                        setSelectedCandidate(null);
                        setCandidateQuery('');
                        setScheduleForm({ ...scheduleForm, candidateName: '', candidateEmail: '', candidateId: '' });
                      }}
                    >
                      <Icons.X />
                    </button>
                  </div>
                )}

                <form onSubmit={handleScheduleInterview} className="admin-form">
                  {!selectedCandidate && (
                    <>
                      <div className="admin-form__row">
                        <div className="admin-input-group">
                          <label className="admin-label">Name</label>
                          <input
                            type="text"
                            required
                            className="admin-input"
                            placeholder="John Doe"
                            value={scheduleForm.candidateName}
                            onChange={e => setScheduleForm({ ...scheduleForm, candidateName: e.target.value })}
                          />
                        </div>
                        <div className="admin-input-group">
                          <label className="admin-label">Candidate ID</label>
                          <input
                            type="text"
                            className="admin-input"
                            placeholder="Optional"
                            value={scheduleForm.candidateId}
                            onChange={e => setScheduleForm({ ...scheduleForm, candidateId: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="admin-input-group">
                        <label className="admin-label">Email Address</label>
                        <input
                          type="email"
                          required
                          className="admin-input"
                          placeholder="john@example.com"
                          value={scheduleForm.candidateEmail}
                          onChange={e => setScheduleForm({ ...scheduleForm, candidateEmail: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  <div className="admin-input-group">
                    <label className="admin-label">Interview Template</label>
                    <select
                      required
                      className="admin-select"
                      value={scheduleForm.templateId}
                      onChange={e => setScheduleForm({ ...scheduleForm, templateId: e.target.value })}
                    >
                      <option value="">Select a template...</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} • {t.role} • {t.level}
                        </option>
                      ))}
                    </select>
                    {templates.length === 0 && (
                      <p className="admin-input-hint admin-input-hint--warning">
                        No templates available. Create one first.
                      </p>
                    )}
                  </div>

                  <div className="admin-input-group">
                    <label className="admin-label">Schedule Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      min={new Date().toISOString().slice(0, 16)}
                      className="admin-input"
                      value={scheduleForm.scheduledAt}
                      onChange={e => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading.submit || templates.length === 0}
                    className="admin-btn admin-btn--primary admin-btn--lg admin-btn--full"
                  >
                    {loading.submit ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>Scheduling...</span>
                      </>
                    ) : (
                      <>
                        <Icons.Calendar />
                        <span>Schedule Interview</span>
                      </>
                    )}
                  </button>
                </form>
              </section>

              {/* Interview List */}
              <section className="admin-panel admin-panel--large">
                <div className="admin-panel__header admin-panel__header--simple">
                  <h2 className="admin-panel__title">Scheduled Interviews</h2>
                  <div className="admin-badge">{interviews.length} Total</div>
                </div>

                {loading.interviews ? (
                  <LoadingSpinner />
                ) : interviews.length === 0 ? (
                  <div className="admin-empty-state">
                    <div className="admin-empty-state__icon">
                      <Icons.Calendar />
                    </div>
                    <p className="admin-empty-state__title">No interviews scheduled</p>
                    <p className="admin-empty-state__text">Schedule your first interview to get started</p>
                  </div>
                ) : (
                  <div className="admin-interview-list">
                    {interviews.map(iv => (
                      <div key={iv.id} className="admin-interview-card">
                        <div className="admin-interview-card__main">
                          <div className="admin-interview-card__avatar">
                            {iv.candidateName.charAt(0).toUpperCase()}
                          </div>
                          <div className="admin-interview-card__info">
                            <h3 className="admin-interview-card__name">{iv.candidateName}</h3>
                            <p className="admin-interview-card__email">{iv.candidateEmail}</p>

                            <div className="admin-interview-card__meta">
                              <StatusBadge status={iv.status} />

                              <span className="admin-interview-card__date">
                                <Icons.Calendar />
                                {iv.scheduledAt ? new Date(iv.scheduledAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 'Not scheduled'}
                              </span>

                              {iv.candidateId && (
                                <span className="admin-interview-card__id">ID: {iv.candidateId}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <Link to={`/admin/interview/${iv.id}`} className="admin-btn admin-btn--secondary">
                          Manage
                          <Icons.ChevronRight />
                        </Link>
                        <button
                          type="button"
                          className="admin-btn admin-btn--danger-ghost"
                          onClick={() => setDeleteConfirm({ id: iv.id, name: iv.candidateName })}
                          aria-label="Delete interview"
                        >
                          <Icons.Trash />
                        </button>

                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal__icon admin-modal__icon--danger">
              <Icons.Trash />
            </div>

            <h2 className="admin-modal__title">Delete Interview?</h2>

            <p className="admin-modal__description">
              Are you sure you want to delete the interview for <strong>{deleteConfirm.name}</strong>?
              This will permanently remove all associated data including recordings and proctor logs.
            </p>

            <div className="admin-modal__warning">
              <Icons.AlertCircle />
              <span>This action cannot be undone</span>
            </div>

            <div className="admin-modal__actions">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="admin-btn admin-btn--secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteInterview(deleteConfirm.id)}
                disabled={deleting}
                className="admin-btn admin-btn--danger"
              >
                {deleting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Icons.Trash />
                    <span>Delete Interview</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

    </div>
  );
}

export default AdminDashboardPage;