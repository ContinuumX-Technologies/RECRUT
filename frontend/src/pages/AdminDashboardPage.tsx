import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { LiveInterviewMonitor } from '../components/LiveInterviewMonitor';
import './AdminDashboardPage.css';

// ============================================
// TYPES
// ============================================

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
  starterCode?: {
    javascript?: string;
    python?: string;
  };
  hiddenTestCases?: TestCase[];
  aiConfig?: {
    difficulty: 'easy' | 'medium' | 'hard';
    dataStructure: string;
    algorithm: string;
    promptHint: string;
  };
};

// New Round Type
type Round = {
  id: string;
  name: string;
  type: 'coding' | 'technical' | 'hr' | 'mixed';
  scheduledAt: string; // ISO Date string or empty
  questions: Question[];
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
    rounds?: Round[]; // Updated to support rounds
    questions?: Question[]; // Backwards compatibility
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
  Camera: () => (
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
  Layers: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
};

// ============================================
// HELPERS
// ============================================

const LoadingSpinner = ({ size = 'default' }: { size?: 'sm' | 'default' | 'lg' }) => (
  <div className={`admin-spinner admin-spinner--${size}`}>
    <div className="admin-spinner__ring" />
  </div>
);

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
  const [tab, setTab] = useState<'templates' | 'interviews' | 'live'>('templates');
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

  // --- Rounds & Questions State ---
  const [rounds, setRounds] = useState<Round[]>([
    {
      id: crypto.randomUUID(),
      name: 'Round 1: DSA',
      type: 'coding',
      scheduledAt: '',
      questions: [
        { id: crypto.randomUUID(), type: 'code', text: 'Solve Two Sum', durationSec: 1200, codingMode: 'leetcode' }
      ]
    }
  ]);
  const [activeRoundIdx, setActiveRoundIdx] = useState(0);

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

  // Modals
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [templateDeleteConfirm, setTemplateDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [templateDeleting, setTemplateDeleting] = useState(false);

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

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    if (!token) return;

    setTemplateDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/templates/${templateId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== templateId));
        setToast({ message: 'Template deleted successfully', type: 'success' });
      } else {
        const err = await res.json().catch(() => ({}));
        setToast({
          message: err.message || err.error || 'Failed to delete template',
          type: 'error'
        });
      }
    } catch (err) {
      console.error('Delete template error:', err);
      setToast({ message: 'Network error deleting template', type: 'error' });
    } finally {
      setTemplateDeleting(false);
      setTemplateDeleteConfirm(null);
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

  // --- Handlers: Round Management ---

  const addRound = () => {
    const newRound: Round = {
      id: crypto.randomUUID(),
      name: `Round ${rounds.length + 1}`,
      type: 'technical',
      scheduledAt: '',
      questions: [{ id: crypto.randomUUID(), type: 'text', text: '', durationSec: 300 }]
    };
    setRounds(prev => [...prev, newRound]);
    setActiveRoundIdx(rounds.length); // switch to new round
  };

  const removeRound = (idx: number) => {
    if (rounds.length === 1) {
      setToast({ message: 'At least one round is required', type: 'error' });
      return;
    }
    const newRounds = rounds.filter((_, i) => i !== idx);
    setRounds(newRounds);
    if (activeRoundIdx >= newRounds.length) {
      setActiveRoundIdx(newRounds.length - 1);
    }
  };

  const updateRound = (idx: number, field: keyof Round, val: any) => {
    setRounds(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  // --- Handlers: Question Management (Scoped to Active Round) ---

  const addQuestion = () => {
    const newQ: Question = {
      id: crypto.randomUUID(),
      type: 'text',
      text: '',
      durationSec: 300
    };
    const updatedRounds = [...rounds];
    updatedRounds[activeRoundIdx].questions.push(newQ);
    setRounds(updatedRounds);
  };

  const removeQuestion = (qIdx: number) => {
    const updatedRounds = [...rounds];
    if (updatedRounds[activeRoundIdx].questions.length === 1) {
      setToast({ message: 'A round must have at least one question', type: 'error' });
      return;
    }
    updatedRounds[activeRoundIdx].questions = updatedRounds[activeRoundIdx].questions.filter((_, i) => i !== qIdx);
    setRounds(updatedRounds);
  };

  const updateQuestion = (qIdx: number, field: keyof Question, val: any) => {
    const updatedRounds = [...rounds];
    updatedRounds[activeRoundIdx].questions = updatedRounds[activeRoundIdx].questions.map((q, i) =>
      i === qIdx ? { ...q, [field]: val } : q
    );
    setRounds(updatedRounds);
  };

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

  const updateProctor = (field: keyof ProctorConfig, val: number) => {
    if (val < 0) return;
    setProctorConfig(prev => ({ ...prev, [field]: val }));
  };

  // --- Submit Handler ---

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    // Validation: Check all rounds
    for (const round of rounds) {
      if (!round.name.trim()) {
        setToast({ message: 'All rounds must have a name', type: 'error' });
        return;
      }
      const hasEmptyQuestion = round.questions.some(q => !q.text || !q.text.trim());
      if (hasEmptyQuestion) {
        setToast({ message: `Questions in ${round.name} cannot be empty`, type: 'error' });
        return;
      }
      // JSON Validation for Code Questions
      try {
        round.questions.forEach(q => {
          if (q.type === 'code' && q.codingMode === 'leetcode') {
            JSON.stringify(q.testCases ?? []);
            JSON.stringify(q.hiddenTestCases ?? []);
          }
        });
      } catch {
        setToast({ message: `Invalid JSON in test cases for ${round.name}.`, type: "error" });
        return;
      }
    }

    setLoading(prev => ({ ...prev, submit: true }));

    const finalConfig = {
      rounds: rounds, // Sending the full rounds structure
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
        setToast({ message: 'Recruitment Drive Created!', type: 'success' });
        // Reset Form
        setTplForm({ name: '', role: '', level: '', description: '' });
        setRounds([{
          id: crypto.randomUUID(),
          name: 'Round 1: DSA',
          type: 'coding',
          scheduledAt: '',
          questions: [{ id: crypto.randomUUID(), type: 'code', text: 'Solve Two Sum', durationSec: 1200 }]
        }]);
        setActiveRoundIdx(0);
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

  const handleGenerateAI = async (qIdx: number, questionId: string, aiConfig: any) => {
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

      updateQuestion(qIdx, 'text', data.text || data.title);
      updateQuestion(qIdx, 'type', data.type || 'code');
      updateQuestion(qIdx, 'description', data.description);
      updateQuestion(qIdx, 'testCases', data.testCases);
      updateQuestion(qIdx, 'hiddenTestCases', data.hiddenTestCases);
      updateQuestion(qIdx, 'starterCode', data.starterCode);

      setToast({ message: "AI question generated!", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to generate AI question", type: "error" });
    } finally {
      setAiLoading(prev => ({ ...prev, [questionId]: false }));
    }
  };

  // Helper to safely get stats from template (Backward compatible)
  const getTemplateStats = (t: Template) => {
    const roundCount = t.config?.rounds?.length || 0;
    let questionCount = 0;
    if (t.config?.rounds) {
      questionCount = t.config.rounds.reduce((acc, r) => acc + r.questions.length, 0);
    } else if (t.config?.questions) {
      questionCount = t.config.questions.length;
    }
    return { roundCount, questionCount };
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
                <h1 className="admin-nav__title">Recruitment Dashboard</h1>
                <p className="admin-nav__subtitle">{user.name}</p>
              </div>
            </div>
          </div>

          {/* Center - Stats & Tabs (Desktop) */}
          <div className="admin-nav__center">
            <div className="admin-nav__tabs">
              <button
                className={`admin-nav__tab ${tab === 'templates' ? 'admin-nav__tab--active' : ''}`}
                onClick={() => setTab('templates')}
              >
                <Icons.Layers />
                <span>Drives / Templates</span>
              </button>
              <button
                className={`admin-nav__tab ${tab === 'interviews' ? 'admin-nav__tab--active' : ''}`}
                onClick={() => setTab('interviews')}
              >
                <Icons.Calendar />
                <span>Interviews</span>
              </button>
              <button
                className={`admin-nav__tab ${tab === 'live' ? 'admin-nav__tab--active' : ''}`}
                onClick={() => setTab('live')}
              >
                <Icons.Camera />
                <span>Live Monitor</span>
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
                      <h2 className="admin-panel__title">Create Recruitment Drive</h2>
                      <p className="admin-panel__subtitle">Define rounds, schedule, and questions</p>
                    </div>
                  </div>
                  <div className="admin-badge">
                    {rounds.length} Round{rounds.length !== 1 ? 's' : ''}
                  </div>
                </div>

                <form onSubmit={handleCreateTemplate} className="admin-form">
                  {/* Basic Info */}
                  <div className="admin-form__section">
                    <div className="admin-form__row">
                      <div className="admin-input-group">
                        <label className="admin-label">Drive / Template Name</label>
                        <input
                          type="text"
                          required
                          className="admin-input"
                          placeholder="e.g. VIT Campus Drive 2026"
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
                          <option value="intern">Internship</option>
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
                        placeholder="e.g. SDE-1, Data Scientist"
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

                  {/* ROUNDS MANAGER */}
                  <div className="admin-rounds-manager">
                    <div className="admin-rounds-header">
                      <h3 className="admin-section-title">Interview Rounds</h3>
                      <button type="button" onClick={addRound} className="admin-btn admin-btn--secondary admin-btn--sm">
                        <Icons.Plus /> Add Round
                      </button>
                    </div>

                    {/* Round Tabs */}
                    <div className="admin-round-tabs">
                      {rounds.map((r, idx) => (
                        <div key={r.id} className="admin-round-tab-wrapper">
                          <button
                            type="button"
                            className={`admin-round-tab ${idx === activeRoundIdx ? 'admin-round-tab--active' : ''}`}
                            onClick={() => setActiveRoundIdx(idx)}
                          >
                            <span className="admin-round-tab__name">{r.name}</span>
                            <span className="admin-round-tab__count">{r.questions.length}Q</span>
                          </button>
                          {rounds.length > 1 && (
                            <button
                              type="button"
                              className="admin-round-remove"
                              onClick={(e) => { e.stopPropagation(); removeRound(idx); }}
                              title="Remove Round"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Active Round Configuration */}
                    <div className="admin-active-round">
                      <div className="admin-active-round__config">
                        <div className="admin-form__row">
                          <div className="admin-input-group">
                            <label className="admin-label admin-label--sm">Round Name</label>
                            <input
                              type="text"
                              className="admin-input admin-input--sm"
                              value={rounds[activeRoundIdx].name}
                              onChange={e => updateRound(activeRoundIdx, 'name', e.target.value)}
                              placeholder="e.g. Round 1: Coding"
                            />
                          </div>
                          <div className="admin-input-group">
                            <label className="admin-label admin-label--sm">Round Type</label>
                            <select
                              className="admin-select admin-select--sm"
                              value={rounds[activeRoundIdx].type}
                              onChange={e => updateRound(activeRoundIdx, 'type', e.target.value)}
                            >
                              <option value="coding">Coding / DSA</option>
                              <option value="technical">Technical Interview</option>
                              <option value="hr">HR / Behavioral</option>
                              <option value="mixed">Mixed Assessment</option>
                            </select>
                          </div>
                        </div>
                        <div className="admin-input-group">
                          <label className="admin-label admin-label--sm">Scheduled Date (Optional)</label>
                          <input
                            type="datetime-local"
                            className="admin-input admin-input--sm"
                            value={rounds[activeRoundIdx].scheduledAt}
                            onChange={e => updateRound(activeRoundIdx, 'scheduledAt', e.target.value)}
                          />
                          <p className="admin-input-hint">Leave blank if scheduling happens later per candidate.</p>
                        </div>
                      </div>

                      {/* Questions for Active Round */}
                      <div className="admin-questions">
                        <div className="admin-questions__header">
                          <h4 className="admin-questions__title">Questions for {rounds[activeRoundIdx].name}</h4>
                          <button type="button" onClick={addQuestion} className="admin-btn admin-btn--primary admin-btn--sm">
                            <Icons.Plus /> Add Question
                          </button>
                        </div>

                        <div className="admin-questions__list">
                          {rounds[activeRoundIdx].questions.map((q, qIdx) => (
                            <div key={q.id} className="admin-question-card">
                              <span className="admin-question-card__number">{qIdx + 1}</span>

                              <button type="button" onClick={() => removeQuestion(qIdx)} className="admin-question-card__delete">
                                <Icons.Trash />
                              </button>

                              <div className="admin-question-card__content">
                                <div className="admin-question-card__row">
                                  <select className="admin-select" value={q.type} onChange={e => updateQuestion(qIdx, 'type', e.target.value)}>
                                    <option value="code">💻 Code Challenge</option>
                                    <option value="text">✏️ Text Response</option>
                                    <option value="audio">🎤 Voice Response</option>
                                    <option value="mcq">☑️ Multiple Choice</option>
                                  </select>
                                  <div className="admin-duration-input">
                                    <Icons.Clock />
                                    <input
                                      type="number"
                                      min="60"
                                      className="admin-duration-input__field"
                                      value={q.durationSec}
                                      onChange={e => updateQuestion(qIdx, 'durationSec', parseInt(e.target.value) || 60)}
                                    />
                                    <span>sec</span>
                                  </div>
                                </div>

                                <textarea
                                  required
                                  className="admin-textarea"
                                  rows={2}
                                  placeholder="Enter question text..."
                                  value={q.text}
                                  onChange={e => updateQuestion(qIdx, 'text', e.target.value)}
                                />

                                {/* Code Configuration (Only if type is code) */}
                                {q.type === 'code' && (
                                  <div className="admin-code-config">
                                    <div className="admin-input-group">
                                      <select
                                        className="admin-select"
                                        value={q.codingMode || 'leetcode'}
                                        onChange={e => updateQuestion(qIdx, 'codingMode', e.target.value)}
                                      >
                                        <option value="leetcode">Manual / LeetCode Style</option>
                                        <option value="ai">Generate with AI</option>
                                      </select>
                                    </div>

                                    {/* AI Generator UI */}
                                    {q.codingMode === 'ai' && (
                                      <div className="admin-ai-generator">
                                        <div className="admin-form__row">
                                          <select
                                            className="admin-select"
                                            value={q.aiConfig?.difficulty || 'medium'}
                                            onChange={e => updateQuestion(qIdx, 'aiConfig', { ...q.aiConfig, difficulty: e.target.value })}
                                          >
                                            <option value="easy">Easy</option>
                                            <option value="medium">Medium</option>
                                            <option value="hard">Hard</option>
                                          </select>
                                          <input
                                            type="text"
                                            className="admin-input"
                                            placeholder="Topic (e.g. Arrays)"
                                            value={q.aiConfig?.dataStructure || ''}
                                            onChange={e => updateQuestion(qIdx, 'aiConfig', { ...q.aiConfig, dataStructure: e.target.value })}
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          className="admin-btn admin-btn--purple admin-btn--full"
                                          disabled={aiLoading[q.id]}
                                          onClick={() => handleGenerateAI(qIdx, q.id, q.aiConfig)}
                                        >
                                          {aiLoading[q.id] ? <LoadingSpinner size="sm" /> : <><Icons.Wand /> Generate Question</>}
                                        </button>
                                      </div>
                                    )}

                                    {/* Manual LeetCode UI */}
                                    {q.codingMode === 'leetcode' && (
                                      <>
                                        <textarea
                                          className="admin-textarea admin-textarea--sm"
                                          placeholder="Problem Description..."
                                          value={q.description || ''}
                                          onChange={e => updateQuestion(qIdx, 'description', e.target.value)}
                                        />
                                        <div className="admin-input-group">
                                            <label className="admin-label admin-label--sm">Test Cases</label>
                                            <textarea
                                            className="admin-textarea admin-textarea--mono"
                                            placeholder='Public Test Cases JSON: [{ "input": "...", "output": "..." }]'
                                            value={JSON.stringify(q.testCases || [], null, 2)}
                                            onChange={e => { try { updateQuestion(qIdx, 'testCases', JSON.parse(e.target.value)); } catch { } }}
                                            />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* END ROUNDS MANAGER */}
                  
                  {/* Proctor Config (Common for all rounds in this template) */}
                  <div className="admin-proctor-config" style={{marginTop: '2rem'}}>
                    <h3 className="admin-proctor-config__title">
                      <Icons.Clock />
                      <span>Proctor Configuration</span>
                    </h3>
                    <div className="admin-proctor-config__grid">
                      <div className="admin-input-group">
                        <label className="admin-label admin-label--sm">Heartbeat Interval</label>
                        <div className="admin-input-with-suffix">
                          <input type="number" className="admin-input admin-input--sm" value={proctorConfig.heartbeatMs} onChange={e => updateProctor('heartbeatMs', parseInt(e.target.value))} />
                          <span className="admin-input-suffix">ms</span>
                        </div>
                      </div>
                      <div className="admin-input-group">
                        <label className="admin-label admin-label--sm">Focus Loss Limit</label>
                        <div className="admin-input-with-suffix">
                          <input type="number" className="admin-input admin-input--sm" value={proctorConfig.focusLossThreshold} onChange={e => updateProctor('focusLossThreshold', parseInt(e.target.value))} />
                          <span className="admin-input-suffix">strikes</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading.submit || !tplForm.name.trim()}
                    className="admin-btn admin-btn--primary admin-btn--lg admin-btn--full"
                  >
                    {loading.submit ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>Creating Recruitment Drive...</span>
                      </>
                    ) : (
                      <>
                        <Icons.Save />
                        <span>Save Recruitment Drive</span>
                      </>
                    )}
                  </button>
                </form>
              </section>

              {/* Template Library List */}
              <section className="admin-panel admin-panel--small">
                <div className="admin-panel__header admin-panel__header--simple">
                  <h2 className="admin-panel__title">Library</h2>
                  <div className="admin-badge">{templates.length}</div>
                </div>
                <div className="admin-template-list">
                    {templates.map(t => {
                        const { roundCount, questionCount } = getTemplateStats(t);
                        return (
                            <div key={t.id} className="admin-template-card">
                                <div className="admin-template-card__header">
                                    <h3 className="admin-template-card__name">{t.name}</h3>
                                    <button onClick={() => setTemplateDeleteConfirm({ id: t.id, name: t.name })} className="admin-template-card__delete"><Icons.Trash /></button>
                                </div>
                                <div className="admin-template-card__badges">
                                    <span className="admin-tag admin-tag--blue">{t.role}</span>
                                    <span className="admin-tag admin-tag--purple">{t.level}</span>
                                </div>
                                <div className="admin-template-card__footer">
                                    <div className="admin-template-card__stats">
                                        <span><span className="admin-dot admin-dot--green" />{roundCount} Rounds</span>
                                        <span><span className="admin-dot admin-dot--blue" />{questionCount} Qs</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
              </section>
            </div>
          )}

          {/* ================== INTERVIEWS TAB ================== */}
          {tab === 'interviews' && (
            <div className="admin-grid admin-grid--reverse">
              {/* Schedule Form */}
              <section className="admin-panel admin-panel--small">
                <div className="admin-panel__header">
                  <h2 className="admin-panel__title">Schedule Interview</h2>
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
                      placeholder="Search..."
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
                            <button key={c.id} type="button" className="admin-search__result" onClick={() => {
                                setSelectedCandidate(c);
                                setScheduleForm({ ...scheduleForm, candidateName: c.name, candidateEmail: c.email, candidateId: c.candidateId || '' });
                                setCandidateResults([]);
                            }}>
                                <div className="admin-search__result-info">
                                    <span className="admin-search__result-name">{c.name}</span>
                                    <span className="admin-search__result-email">{c.email}</span>
                                </div>
                            </button>
                        ))}
                     </div>
                  )}
                </div>

                <form onSubmit={handleScheduleInterview} className="admin-form">
                    {!selectedCandidate && (
                        <>
                            <div className="admin-input-group">
                                <label className="admin-label">Name</label>
                                <input type="text" className="admin-input" required value={scheduleForm.candidateName} onChange={e => setScheduleForm({ ...scheduleForm, candidateName: e.target.value })} />
                            </div>
                            <div className="admin-input-group">
                                <label className="admin-label">Email</label>
                                <input type="email" className="admin-input" required value={scheduleForm.candidateEmail} onChange={e => setScheduleForm({ ...scheduleForm, candidateEmail: e.target.value })} />
                            </div>
                        </>
                    )}
                    <div className="admin-input-group">
                        <label className="admin-label">Select Drive / Template</label>
                        <select className="admin-select" required value={scheduleForm.templateId} onChange={e => setScheduleForm({ ...scheduleForm, templateId: e.target.value })}>
                            <option value="">Choose...</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div className="admin-input-group">
                        <label className="admin-label">Start Date</label>
                        <input type="datetime-local" className="admin-input" required value={scheduleForm.scheduledAt} onChange={e => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })} />
                    </div>
                    <button type="submit" disabled={loading.submit} className="admin-btn admin-btn--primary admin-btn--full">Schedule</button>
                </form>
              </section>

              {/* Interview List */}
              <section className="admin-panel admin-panel--large">
                 <div className="admin-panel__header">
                    <h2 className="admin-panel__title">Scheduled Interviews</h2>
                 </div>
                 <div className="admin-interview-list">
                    {interviews.map(iv => (
                        <div key={iv.id} className="admin-interview-card">
                            <div className="admin-interview-card__main">
                                <div className="admin-interview-card__avatar">{iv.candidateName.charAt(0)}</div>
                                <div className="admin-interview-card__info">
                                    <h3>{iv.candidateName}</h3>
                                    <p>{iv.candidateEmail}</p>
                                    <StatusBadge status={iv.status} />
                                </div>
                            </div>
                            <button className="admin-btn admin-btn--danger-ghost" onClick={() => setDeleteConfirm({ id: iv.id, name: iv.candidateName })}><Icons.Trash /></button>
                        </div>
                    ))}
                 </div>
              </section>
            </div>
          )}

          {tab === 'live' && (
            <section className="admin-panel admin-panel--large">
              <div className="admin-panel__header">
                <h2 className="admin-panel__title">Live Control Room</h2>
                <div className="admin-badge admin-badge--live">
                  {interviews.filter(i => i.status === 'started' || i.status === 'scheduled').length} Active
                </div>
              </div>
              <LiveInterviewMonitor interviews={interviews.filter(i => i.status === 'scheduled' || i.status === 'started')} />
            </section>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <h2 className="admin-modal__title">Delete Interview?</h2>
            <p className="admin-modal__description">Are you sure you want to delete the interview for <strong>{deleteConfirm.name}</strong>?</p>
            <div className="admin-modal__actions">
              <button onClick={() => setDeleteConfirm(null)} className="admin-btn admin-btn--secondary">Cancel</button>
              <button onClick={() => handleDeleteInterview(deleteConfirm.id)} className="admin-btn admin-btn--danger">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Template Delete Confirmation Modal */}
      {templateDeleteConfirm && (
         <div className="admin-modal-backdrop">
             <div className="admin-modal">
                 <h2 className="admin-modal__title">Delete Template?</h2>
                 <p className="admin-modal__description">Delete <strong>{templateDeleteConfirm.name}</strong>?</p>
                 <div className="admin-modal__actions">
                     <button onClick={() => setTemplateDeleteConfirm(null)} className="admin-btn admin-btn--secondary">Cancel</button>
                     <button onClick={() => handleDeleteTemplate(templateDeleteConfirm.id)} className="admin-btn admin-btn--danger">Delete</button>
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