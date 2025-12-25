import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './CandidateDashboardPage.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

type CandidateInterview = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  candidateId: string;
  status: string;
  scheduledAt?: string;
  template?: {
    id: string;
    name: string;
    role: string;
    level: string;
  } | null;
};

// ============================================
// ICON COMPONENTS
// ============================================

const Icons = {
  Sparkles: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3l1.09 3.41L16.5 7.5l-3.41 1.09L12 12l-1.09-3.41L7.5 7.5l3.41-1.09L12 3zm6.5 9l.72 2.28L21.5 15l-2.28.72-.72 2.28-.72-2.28L15.5 15l2.28-.72.72-2.28zM5.5 15l.72 2.28L8.5 18l-2.28.72-.72 2.28-.72-2.28L2.5 18l2.28-.72.72-2.28z"/>
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9,18 15,12 9,6"/>
    </svg>
  ),
  LogOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  User: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Briefcase: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  ),
  AlertCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
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
  Video: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  FileText: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10,9 9,9 8,9"/>
    </svg>
  ),
};

// ============================================
// LOADING SPINNER
// ============================================

const LoadingSpinner = () => (
  <div className="candidate-spinner">
    <div className="candidate-spinner__ring" />
  </div>
);

// ============================================
// STATUS BADGE
// ============================================

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusInfo = (status: string) => {
    switch (status.toLowerCase()) {
      case 'scheduled':
        return { label: 'Scheduled', icon: <Icons.Calendar /> };
      case 'ongoing':
      case 'in_progress':
        return { label: 'In Progress', icon: <Icons.Video /> };
      case 'completed':
        return { label: 'Completed', icon: <Icons.CheckCircle /> };
      case 'cancelled':
        return { label: 'Cancelled', icon: <Icons.AlertCircle /> };
      default:
        return { label: status, icon: <Icons.Clock /> };
    }
  };

  const info = getStatusInfo(status);

  return (
    <span className={`candidate-status candidate-status--${status.toLowerCase()}`}>
      <span className="candidate-status__icon">{info.icon}</span>
      <span className="candidate-status__text">{info.label}</span>
    </span>
  );
};

// ============================================
// EMPTY STATE
// ============================================

const EmptyState = () => (
  <div className="candidate-empty">
    <div className="candidate-empty__illustration">
      <div className="candidate-empty__circle candidate-empty__circle--1" />
      <div className="candidate-empty__circle candidate-empty__circle--2" />
      <div className="candidate-empty__icon">
        <Icons.Calendar />
      </div>
    </div>
    <h2 className="candidate-empty__title">No Interviews Yet</h2>
    <p className="candidate-empty__text">
      You don't have any scheduled interviews at the moment.
      Check back later or contact your recruiter.
    </p>
    <div className="candidate-empty__tips">
      <div className="candidate-empty__tip">
        <Icons.CheckCircle />
        <span>Ensure your profile is complete</span>
      </div>
      <div className="candidate-empty__tip">
        <Icons.CheckCircle />
        <span>Check your email for invitations</span>
      </div>
      <div className="candidate-empty__tip">
        <Icons.CheckCircle />
        <span>Prepare your camera and microphone</span>
      </div>
    </div>
  </div>
);

// ============================================
// INTERVIEW CARD
// ============================================

const InterviewCard = ({ interview }: { interview: CandidateInterview }) => {
  const isJoinable = interview.status === 'scheduled' || interview.status === 'ongoing';
  const scheduledDate = interview.scheduledAt ? new Date(interview.scheduledAt) : null;
  const isToday = scheduledDate && new Date().toDateString() === scheduledDate.toDateString();
  const isPast = scheduledDate && scheduledDate < new Date();

  return (
    <div className={`candidate-card ${isToday ? 'candidate-card--today' : ''}`}>
      {isToday && (
        <div className="candidate-card__today-badge">
          <Icons.Sparkles />
          <span>Today</span>
        </div>
      )}

      <div className="candidate-card__header">
        <div className="candidate-card__icon">
          <Icons.Briefcase />
        </div>
        <div className="candidate-card__title-group">
          <h3 className="candidate-card__title">
            {interview.template?.name || 'Interview Session'}
          </h3>
          {interview.template?.role && (
            <p className="candidate-card__role">{interview.template.role}</p>
          )}
        </div>
        <StatusBadge status={interview.status} />
      </div>

      <div className="candidate-card__details">
        {scheduledDate && (
          <div className="candidate-card__detail">
            <span className="candidate-card__detail-icon">
              <Icons.Calendar />
            </span>
            <span className="candidate-card__detail-label">Date</span>
            <span className="candidate-card__detail-value">
              {scheduledDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
        )}

        {scheduledDate && (
          <div className="candidate-card__detail">
            <span className="candidate-card__detail-icon">
              <Icons.Clock />
            </span>
            <span className="candidate-card__detail-label">Time</span>
            <span className="candidate-card__detail-value">
              {scheduledDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        )}

        <div className="candidate-card__detail">
          <span className="candidate-card__detail-icon">
            <Icons.Hash />
          </span>
          <span className="candidate-card__detail-label">Reg. No</span>
          <span className="candidate-card__detail-value candidate-card__detail-value--mono">
            {interview.candidateId}
          </span>
        </div>

        {interview.template?.level && (
          <div className="candidate-card__detail">
            <span className="candidate-card__detail-icon">
              <Icons.FileText />
            </span>
            <span className="candidate-card__detail-label">Level</span>
            <span className="candidate-card__detail-value">
              {interview.template.level.charAt(0).toUpperCase() + interview.template.level.slice(1)}
            </span>
          </div>
        )}
      </div>

      <div className="candidate-card__footer">
        <span className="candidate-card__id">
          ID: {interview.id.slice(0, 8)}...
        </span>

        {isJoinable && !isPast && (
          <Link to={`/interview/${interview.id}`} className="candidate-btn candidate-btn--primary">
            <Icons.Play />
            <span>Join Interview</span>
            <Icons.ChevronRight />
          </Link>
        )}

        {interview.status === 'completed' && (
          <div className="candidate-card__completed">
            <Icons.CheckCircle />
            <span>Interview Completed</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function CandidateDashboardPage() {
  const { user, token, logout } = useAuth();
  const [interviews, setInterviews] = useState<CandidateInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const loadInterviews = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/me/interviews`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!res.ok) {
          console.error('Load interviews error', data);
          setError('Failed to load interviews');
          return;
        }

        setInterviews(data);
      } catch (e) {
        console.error('Error loading interviews', e);
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadInterviews();
  }, [token]);

  // Separate interviews by status
  const upcomingInterviews = interviews.filter(
    iv => iv.status === 'scheduled' || iv.status === 'ongoing'
  );
  const pastInterviews = interviews.filter(
    iv => iv.status === 'completed' || iv.status === 'cancelled'
  );

  if (!user) {
    return (
      <div className="candidate-page">
        <div className="candidate-access-denied">
          <div className="candidate-access-denied__icon">
            <Icons.AlertCircle />
          </div>
          <h2>Not Logged In</h2>
          <p>Please log in to view your interviews.</p>
          <Link to="/login" className="candidate-btn candidate-btn--primary">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="candidate-page">
      {/* ================================
          NAVIGATION
          ================================ */}
      <header className="candidate-nav">
        <div className="candidate-nav__container">
          <div className="candidate-nav__left">
            <div className="candidate-nav__logo">
              <Icons.Sparkles />
            </div>
            <div className="candidate-nav__brand">
              <h1 className="candidate-nav__title">My Interviews</h1>
              <p className="candidate-nav__subtitle">Candidate Portal</p>
            </div>
          </div>

          <div className="candidate-nav__right">
            <div className="candidate-nav__user">
              <div className="candidate-nav__avatar">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="candidate-nav__user-info">
                <span className="candidate-nav__user-name">{user.name}</span>
                <span className="candidate-nav__user-email">{user.email}</span>
              </div>
            </div>

            <button onClick={logout} className="candidate-nav__logout">
              <Icons.LogOut />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================================
          MAIN CONTENT
          ================================ */}
      <main className="candidate-main">
        <div className="candidate-main__container">

          {/* Welcome Section */}
          <section className="candidate-welcome">
            <div className="candidate-welcome__content">
              <h2 className="candidate-welcome__title">
                Welcome back, {user.name.split(' ')[0]}! 👋
              </h2>
              <p className="candidate-welcome__text">
                {upcomingInterviews.length > 0
                  ? `You have ${upcomingInterviews.length} upcoming interview${upcomingInterviews.length !== 1 ? 's' : ''}.`
                  : 'Check below for your interview schedule.'
                }
              </p>
            </div>

            <div className="candidate-welcome__stats">
              <div className="candidate-stat-card">
                <div className="candidate-stat-card__icon candidate-stat-card__icon--blue">
                  <Icons.Calendar />
                </div>
                <div className="candidate-stat-card__content">
                  <span className="candidate-stat-card__value">{upcomingInterviews.length}</span>
                  <span className="candidate-stat-card__label">Upcoming</span>
                </div>
              </div>

              <div className="candidate-stat-card">
                <div className="candidate-stat-card__icon candidate-stat-card__icon--green">
                  <Icons.CheckCircle />
                </div>
                <div className="candidate-stat-card__content">
                  <span className="candidate-stat-card__value">{pastInterviews.length}</span>
                  <span className="candidate-stat-card__label">Completed</span>
                </div>
              </div>
            </div>
          </section>

          {/* Loading State */}
          {loading && (
            <div className="candidate-loading">
              <LoadingSpinner />
              <p>Loading your interviews...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="candidate-error">
              <Icons.AlertCircle />
              <p>{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="candidate-btn candidate-btn--secondary"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && interviews.length === 0 && (
            <EmptyState />
          )}

          {/* Upcoming Interviews */}
          {!loading && !error && upcomingInterviews.length > 0 && (
            <section className="candidate-section">
              <div className="candidate-section__header">
                <h2 className="candidate-section__title">
                  <span className="candidate-section__icon candidate-section__icon--blue">
                    <Icons.Calendar />
                  </span>
                  Upcoming Interviews
                </h2>
                <span className="candidate-section__count">{upcomingInterviews.length}</span>
              </div>

              <div className="candidate-section__grid">
                {upcomingInterviews.map(interview => (
                  <InterviewCard key={interview.id} interview={interview} />
                ))}
              </div>
            </section>
          )}

          {/* Past Interviews */}
          {!loading && !error && pastInterviews.length > 0 && (
            <section className="candidate-section">
              <div className="candidate-section__header">
                <h2 className="candidate-section__title">
                  <span className="candidate-section__icon candidate-section__icon--gray">
                    <Icons.Clock />
                  </span>
                  Past Interviews
                </h2>
                <span className="candidate-section__count">{pastInterviews.length}</span>
              </div>

              <div className="candidate-section__grid">
                {pastInterviews.map(interview => (
                  <InterviewCard key={interview.id} interview={interview} />
                ))}
              </div>
            </section>
          )}

          {/* Tips Card */}
          {!loading && !error && upcomingInterviews.length > 0 && (
            <section className="candidate-tips">
              <div className="candidate-tips__header">
                <Icons.Sparkles />
                <h3>Interview Tips</h3>
              </div>
              <div className="candidate-tips__grid">
                <div className="candidate-tip">
                  <div className="candidate-tip__number">1</div>
                  <div className="candidate-tip__content">
                    <h4>Test Your Setup</h4>
                    <p>Ensure your camera and microphone are working before the interview.</p>
                  </div>
                </div>
                <div className="candidate-tip">
                  <div className="candidate-tip__number">2</div>
                  <div className="candidate-tip__content">
                    <h4>Find a Quiet Space</h4>
                    <p>Choose a well-lit, quiet environment with minimal distractions.</p>
                  </div>
                </div>
                <div className="candidate-tip">
                  <div className="candidate-tip__number">3</div>
                  <div className="candidate-tip__content">
                    <h4>Join Early</h4>
                    <p>Log in 5-10 minutes before your scheduled time to settle in.</p>
                  </div>
                </div>
                <div className="candidate-tip">
                  <div className="candidate-tip__number">4</div>
                  <div className="candidate-tip__content">
                    <h4>Stay Focused</h4>
                    <p>Keep your eyes on the screen and avoid switching tabs during the interview.</p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* ================================
          FOOTER
          ================================ */}
      <footer className="candidate-footer">
        <p>Need help? Contact support at <a href="mailto:support@interview.ai">support@interview.ai</a></p>
      </footer>
    </div>
  );
}

export default CandidateDashboardPage;