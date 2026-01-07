import { useEffect, useState, useRef } from 'react';
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
  hasResume?: boolean; 
};

type PlacementDrive = {
  id: string;
  companyName: string;
  tier: 'Super Dream' | 'Dream' | 'Regular';
  ctc: number;
  driveDate: string;
  slot: string;
  status: string;
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
  Upload: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  )
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

const EmptyState = ({ message }: { message?: string }) => (
  <div className="candidate-empty">
    <div className="candidate-empty__illustration">
      <div className="candidate-empty__circle candidate-empty__circle--1" />
      <div className="candidate-empty__circle candidate-empty__circle--2" />
      <div className="candidate-empty__icon">
        <Icons.Calendar />
      </div>
    </div>
    <h2 className="candidate-empty__title">No Items Found</h2>
    <p className="candidate-empty__text">
      {message || "You don't have any scheduled interviews at the moment."}
    </p>
  </div>
);

// ============================================
// INTERVIEW CARD
// ============================================

const InterviewCard = ({ interview }: { interview: CandidateInterview }) => {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const isJoinable = interview.status === 'scheduled' || interview.status === 'ongoing';
  const scheduledDate = interview.scheduledAt ? new Date(interview.scheduledAt) : null;
  const isToday = scheduledDate && new Date().toDateString() === scheduledDate.toDateString();
  const isPast = scheduledDate && scheduledDate < new Date();

  // Handle Resume Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setUploading(true);
    setUploadStatus('idle');
    setStatusMsg('');

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await fetch(`${API_BASE}/api/interviews/${interview.id}/resume`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadStatus('success');
      setStatusMsg('Resume uploaded!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setUploadStatus('idle');
        setStatusMsg('');
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setUploadStatus('error');
      setStatusMsg(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

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

      {/* Upload Status Message */}
      {statusMsg && (
        <div className={`candidate-card__alert candidate-card__alert--${uploadStatus}`}>
          {uploadStatus === 'success' ? <Icons.CheckCircle /> : <Icons.AlertCircle />}
          <span>{statusMsg}</span>
        </div>
      )}

      <div className="candidate-card__footer">
        <span className="candidate-card__id">
          ID: {interview.id.slice(0, 8)}...
        </span>
        
        <div className="candidate-card__actions">
          {/* Resume Upload Button (Visible for scheduled/ongoing) */}
          {isJoinable && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".pdf"
                onChange={handleFileChange}
              />
              <button 
                className="candidate-btn candidate-btn--secondary"
                onClick={triggerUpload}
                disabled={uploading}
                title="Upload PDF Resume"
              >
                {uploading ? (
                  <span className="candidate-spinner-small"></span>
                ) : (
                  <Icons.Upload />
                )}
                <span>{uploading ? 'Uploading...' : 'Resume'}</span>
              </button>
            </>
          )}

          {isJoinable && !isPast && (
            <Link to={`/interview/${interview.id}`} className="candidate-btn candidate-btn--primary">
              <Icons.Play />
              <span>Join</span>
              <Icons.ChevronRight />
            </Link>
          )}
        </div>

        {interview.status === 'completed' && (
          <div className="candidate-card__completed">
            <Icons.CheckCircle />
            <span>Completed</span>
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
  
  // TABS STATE
  const [activeTab, setActiveTab] = useState<'interviews' | 'drives'>('interviews');

  // DATA STATE
  const [interviews, setInterviews] = useState<CandidateInterview[]>([]);
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load Data
  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (activeTab === 'interviews') {
           const res = await fetch(`${API_BASE}/api/me/interviews`, {
             headers: { Authorization: `Bearer ${token}` },
           });
           if (!res.ok) throw new Error('Failed to load interviews');
           setInterviews(await res.json());
        } else {
           const res = await fetch(`${API_BASE}/api/candidate/drives`, {
             headers: { Authorization: `Bearer ${token}` },
           });
           if (!res.ok) throw new Error('Failed to load drives');
           setDrives(await res.json());
        }
      } catch (e: any) {
        console.error('Error loading data', e);
        setError(e.message || 'Network error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token, activeTab]);

  const handleApplyToDrive = async (outreachId: string) => {
      if(!token) return;
      if(!confirm("Are you sure you want to apply? Your profile and resume will be sent to the company.")) return;

      try {
          const res = await fetch(`${API_BASE}/api/candidate/apply/${outreachId}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if(res.ok) {
              alert(data.message || "Application successful!");
          } else {
              alert(data.error || "Failed to apply.");
          }
      } catch(e) {
          alert("Network error.");
      }
  };

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
          <h2>Not Logged In</h2>
          <Link to="/login" className="candidate-btn candidate-btn--primary">Go to Login</Link>
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
              <h1 className="candidate-nav__title">Portal</h1>
              <p className="candidate-nav__subtitle">Student Dashboard</p>
            </div>
          </div>

          <div className="candidate-nav__center">
             <div className="candidate-nav__tabs">
                <button 
                  onClick={() => setActiveTab('interviews')}
                  className={`candidate-nav__tab ${activeTab === 'interviews' ? 'candidate-nav__tab--active' : ''}`}
                >
                    <Icons.Briefcase /> My Interviews
                </button>
                <button 
                  onClick={() => setActiveTab('drives')}
                  className={`candidate-nav__tab ${activeTab === 'drives' ? 'candidate-nav__tab--active' : ''}`}
                >
                    <Icons.Search /> Placement Drives
                </button>
             </div>
          </div>

          <div className="candidate-nav__right">
            <div className="candidate-nav__user">
              <div className="candidate-nav__avatar">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="candidate-nav__user-info">
                <span className="candidate-nav__user-name">{user.name}</span>
              </div>
            </div>
            <button onClick={logout} className="candidate-nav__logout">
              <Icons.LogOut />
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
                Welcome, {user.name.split(' ')[0]}!
              </h2>
              <p className="candidate-welcome__text">
                {activeTab === 'interviews' 
                  ? "Here is your interview schedule."
                  : "Explore and apply to upcoming placement drives."
                }
              </p>
            </div>
            {/* Conditional Stats */}
            {activeTab === 'interviews' && (
                <div className="candidate-welcome__stats">
                    <div className="candidate-stat-card">
                        <div className="candidate-stat-card__icon candidate-stat-card__icon--blue"><Icons.Calendar /></div>
                        <div className="candidate-stat-card__content">
                            <span className="candidate-stat-card__value">{upcomingInterviews.length}</span>
                            <span className="candidate-stat-card__label">Upcoming</span>
                        </div>
                    </div>
                </div>
            )}
          </section>

          {/* Loading / Error */}
          {loading && <div className="candidate-loading"><LoadingSpinner /><p>Loading...</p></div>}
          {error && !loading && <div className="candidate-error"><Icons.AlertCircle /><p>{error}</p></div>}

          {/* --- TAB 1: MY INTERVIEWS --- */}
          {!loading && !error && activeTab === 'interviews' && (
             <>
                {interviews.length === 0 && <EmptyState />}
                
                {upcomingInterviews.length > 0 && (
                    <section className="candidate-section">
                    <div className="candidate-section__header">
                        <h2 className="candidate-section__title">
                        <span className="candidate-section__icon candidate-section__icon--blue"><Icons.Calendar /></span>
                        Upcoming
                        </h2>
                    </div>
                    <div className="candidate-section__grid">
                        {upcomingInterviews.map(interview => (
                        <InterviewCard key={interview.id} interview={interview} />
                        ))}
                    </div>
                    </section>
                )}

                {pastInterviews.length > 0 && (
                    <section className="candidate-section">
                    <div className="candidate-section__header">
                        <h2 className="candidate-section__title">
                        <span className="candidate-section__icon candidate-section__icon--gray"><Icons.Clock /></span>
                        History
                        </h2>
                    </div>
                    <div className="candidate-section__grid">
                        {pastInterviews.map(interview => (
                        <InterviewCard key={interview.id} interview={interview} />
                        ))}
                    </div>
                    </section>
                )}
             </>
          )}

          {/* --- TAB 2: PLACEMENT DRIVES --- */}
          {!loading && !error && activeTab === 'drives' && (
             <>
               {drives.length === 0 && <EmptyState message="No placement drives are currently open for applications." />}
               
               <div className="candidate-section__grid">
                   {drives.map(drive => (
                       <div key={drive.id} className="candidate-card" style={{ borderTop: `4px solid ${drive.tier === 'Super Dream' ? '#ec4899' : '#3b82f6'}` }}>
                           <div className="candidate-card__header">
                               <div className="candidate-card__title-group">
                                    <h3 className="candidate-card__title" style={{ fontSize: '1.25rem' }}>{drive.companyName}</h3>
                                    <span className="candidate-card__role" style={{ color: drive.tier === 'Super Dream' ? '#ec4899' : '#3b82f6', fontWeight: 'bold' }}>
                                        {drive.tier}
                                    </span>
                               </div>
                               <div className="candidate-card__icon" style={{ background: '#f1f5f9' }}>
                                   <Icons.Briefcase />
                               </div>
                           </div>

                           <div className="candidate-card__details" style={{ marginTop: '1rem' }}>
                               <div className="candidate-card__detail">
                                   <span className="candidate-card__detail-value" style={{ fontSize: '1.5rem', fontWeight: 'bold', color:'#334155' }}>
                                       ₹{drive.ctc} LPA
                                   </span>
                               </div>
                               <div className="candidate-card__detail">
                                   <span className="candidate-card__detail-icon"><Icons.Calendar /></span>
                                   <span className="candidate-card__detail-label">Date:</span>
                                   <span className="candidate-card__detail-value">{new Date(drive.driveDate).toLocaleDateString()}</span>
                               </div>
                               <div className="candidate-card__detail">
                                   <span className="candidate-card__detail-icon"><Icons.Clock /></span>
                                   <span className="candidate-card__detail-label">Slot:</span>
                                   <span className="candidate-card__detail-value">{drive.slot}</span>
                               </div>
                           </div>

                           <div className="candidate-card__footer">
                               <button 
                                 className="candidate-btn candidate-btn--primary" 
                                 style={{ width: '100%', justifyContent: 'center' }}
                                 onClick={() => handleApplyToDrive(drive.id)}
                               >
                                   Apply Now <Icons.ChevronRight />
                               </button>
                           </div>
                       </div>
                   ))}
               </div>
             </>
          )}

        </div>
      </main>

      {/* ================================
          FOOTER
          ================================ */}
      <footer className="candidate-footer">
        <p>Need help? Contact <a href="mailto:cdc@vit.ac.in">Placement Cell</a></p>
      </footer>
    </div>
  );
}

export default CandidateDashboardPage;