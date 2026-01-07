import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { LiveInterviewMonitor } from '../components/LiveInterviewMonitor';
import './CollegeDashboardPage.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

type OutreachRecord = {
  id: string;
  companyName: string;
  email: string;
  contactPerson: string;
  status: 'contacted' | 'negotiating' | 'scheduled' | 'rejected';
  tier: 'Super Dream' | 'Dream' | 'Regular' | null;
  ctc: number;
  slot?: string;
  driveDate?: string;
  timeline: { date: string; title: string; description: string }[];
  updatedAt: string;
};

const getTierClass = (tier: string | null | undefined): string => {
  if (!tier) return 'regular';
  return tier.toLowerCase().replace(' ', '-');
};

const displayTier = (tier: string | null | undefined): string => {
  return tier || 'Regular';
};

export function CollegeDashboardPage() {
  const { user, token, logout } = useAuth();
  const [tab, setTab] = useState<'overview' | 'drives' | 'live'>('overview');
  const [driveView, setDriveView] = useState<'pipeline' | 'calendar'>('pipeline');
  const [loading, setLoading] = useState(false);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [outreachList, setOutreachList] = useState<OutreachRecord[]>([]);
  
  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompany, setNewCompany] = useState({ companyName: '', email: '', contactPerson: '', ctc: '', tier: 'Regular' });
  const [selectedCompany, setSelectedCompany] = useState<OutreachRecord | null>(null);
  const [logForm, setLogForm] = useState({ title: '', description: '', status: '' });
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotForm, setSlotForm] = useState({ slot: 'Slot 1', driveDate: '' });
  const [generatedCreds, setGeneratedCreds] = useState<{email: string, password: string} | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (token) loadData();
  }, [token, tab]);

  const loadData = async () => {
    if(!token) return;
    setLoading(true);
    try {
      if (tab === 'overview' || tab === 'live') {
        const intRes = await fetch(`${API_BASE}/api/admin/interviews`, { headers: { Authorization: `Bearer ${token}` } });
        if (intRes.ok) setInterviews(await intRes.json());
      }
      if (tab === 'drives') {
        const res = await fetch(`${API_BASE}/api/college/outreach`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setOutreachList(await res.json());
      }
    } catch(e) { console.error(e) }
    setLoading(false);
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!token) return;
    const res = await fetch(`${API_BASE}/api/college/outreach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...newCompany, ctc: parseFloat(newCompany.ctc) || 0 })
    });
    if(res.ok) {
      setNewCompany({ companyName: '', email: '', contactPerson: '', ctc: '', tier: 'Regular' });
      setShowAddForm(false);
      loadData();
    }
  };

  const handleLogTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!token || !selectedCompany) return;
    const res = await fetch(`${API_BASE}/api/college/outreach/${selectedCompany.id}/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(logForm)
    });
    if(res.ok) {
      setLogForm({ title: '', description: '', status: '' });
      loadData();
      // Refresh selected company data
      const updated = outreachList.find(c => c.id === selectedCompany.id);
      if (updated) setSelectedCompany(updated);
    }
  };

  const handleFinalizeSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!token || !selectedCompany) return;
    const res = await fetch(`${API_BASE}/api/college/outreach/${selectedCompany.id}/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(slotForm)
    });
    if(res.ok) {
      const data = await res.json();
      setGeneratedCreds(data.credentials);
      setShowSlotForm(false);
      loadData();
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const closeCompanyDetail = () => {
    setSelectedCompany(null);
    setGeneratedCreds(null);
    setShowSlotForm(false);
  };

  const stats = useMemo(() => ({
    companies: new Set(interviews.map(i => i.interviewer?.name || 'Unknown')).size,
    active: interviews.filter(i => i.status === 'started').length,
    scheduled: interviews.filter(i => i.status === 'scheduled').length,
    completed: interviews.filter(i => i.status === 'completed').length,
  }), [interviews]);

  const pipelineData = useMemo(() => ({
    contacted: outreachList.filter(l => l.status === 'contacted'),
    negotiating: outreachList.filter(l => l.status === 'negotiating'),
    scheduled: outreachList.filter(l => l.status === 'scheduled'),
  }), [outreachList]);

  if (!user || user.role !== 'COLLEGE') {
    return (
      <div className="cp-denied">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <h1>Access Denied</h1>
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="cp">
      {/* Top Bar */}
      <header className="cp-topbar">
        <div className="cp-topbar-left">
          <div className="cp-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 20V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
              <path d="M16 8h4a2 2 0 0 1 2 2v10"/>
              <path d="M2 14h14"/>
              <path d="M6 6h4"/>
              <path d="M6 10h2"/>
            </svg>
            <span>Placement Cell</span>
          </div>
        </div>

        {/* Main Navigation Tabs */}
        <nav className="cp-tabs">
          <button 
            className={`cp-tab ${tab === 'overview' ? 'cp-tab--active' : ''}`}
            onClick={() => setTab('overview')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Overview
          </button>
          <button 
            className={`cp-tab ${tab === 'drives' ? 'cp-tab--active' : ''}`}
            onClick={() => setTab('drives')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              <rect x="2" y="8" width="20" height="12" rx="2"/>
            </svg>
            Drives
          </button>
          <button 
            className={`cp-tab ${tab === 'live' ? 'cp-tab--active' : ''}`}
            onClick={() => setTab('live')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Live
            {stats.active > 0 && <span className="cp-tab-badge">{stats.active}</span>}
          </button>
        </nav>

        <div className="cp-topbar-right">
          <div className="cp-user">
            <span className="cp-user-name">{user?.email?.split('@')[0] || 'User'}</span>
            <div className="cp-user-avatar">{user?.email?.charAt(0)?.toUpperCase() || 'U'}</div>
          </div>
          <button className="cp-logout" onClick={logout} title="Sign out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="cp-main">
        {/* =================== OVERVIEW TAB =================== */}
        {tab === 'overview' && (
          <div className="cp-content">
            <div className="cp-page-header">
              <div>
                <h1>Overview</h1>
                <p>Placement activity summary</p>
              </div>
              <span className="cp-date">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </div>

            <div className="cp-stats">
              <div className="cp-stat">
                <span className="cp-stat-value">{stats.companies}</span>
                <span className="cp-stat-label">Companies</span>
              </div>
              <div className="cp-stat cp-stat--green">
                <span className="cp-stat-value">{stats.active}</span>
                <span className="cp-stat-label">Live Now</span>
              </div>
              <div className="cp-stat">
                <span className="cp-stat-value">{stats.scheduled}</span>
                <span className="cp-stat-label">Scheduled</span>
              </div>
              <div className="cp-stat">
                <span className="cp-stat-value">{stats.completed}</span>
                <span className="cp-stat-label">Completed</span>
              </div>
            </div>

            <div className="cp-card">
              <div className="cp-card-header">
                <h2>Recent Sessions</h2>
              </div>
              <div className="cp-table-wrap">
                <table className="cp-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Status</th>
                      <th>Company</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interviews.slice(0, 10).map(iv => (
                      <tr key={iv.id}>
                        <td>
                          <div className="cp-user-cell">
                            <span className="cp-avatar">{iv.candidateName?.charAt(0) || '?'}</span>
                            <div>
                              <div className="cp-name">{iv.candidateName || 'Unknown'}</div>
                              <div className="cp-email">{iv.candidateEmail || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`cp-badge cp-badge--${iv.status || 'unknown'}`}>
                            {iv.status || 'Unknown'}
                          </span>
                        </td>
                        <td>{iv.interviewer?.name || '—'}</td>
                        <td className="cp-date-cell">
                          {iv.scheduledAt ? new Date(iv.scheduledAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric'
                          }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {interviews.length === 0 && (
                  <div className="cp-empty">No sessions yet</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =================== DRIVES TAB =================== */}
        {tab === 'drives' && (
          <div className="cp-content">
            <div className="cp-page-header">
              <div>
                <h1>Placement Drives</h1>
                <p>Manage company partnerships</p>
              </div>
              <button className="cp-btn cp-btn--primary" onClick={() => setShowAddForm(!showAddForm)}>
                {showAddForm ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Cancel
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Add Company
                  </>
                )}
              </button>
            </div>

            {/* Add Company Form (Inline) */}
            {showAddForm && (
              <div className="cp-card cp-card--form">
                <form onSubmit={handleAddCompany} className="cp-inline-form">
                  <div className="cp-form-grid">
                    <div className="cp-field">
                      <label>Company Name</label>
                      <input 
                        type="text"
                        required 
                        value={newCompany.companyName} 
                        onChange={e => setNewCompany({...newCompany, companyName: e.target.value})}
                        placeholder="e.g., Google"
                      />
                    </div>
                    <div className="cp-field">
                      <label>HR Email</label>
                      <input 
                        type="email"
                        required 
                        value={newCompany.email} 
                        onChange={e => setNewCompany({...newCompany, email: e.target.value})}
                        placeholder="hr@company.com"
                      />
                    </div>
                    <div className="cp-field">
                      <label>Contact Person</label>
                      <input 
                        type="text"
                        value={newCompany.contactPerson} 
                        onChange={e => setNewCompany({...newCompany, contactPerson: e.target.value})}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="cp-field">
                      <label>CTC (LPA)</label>
                      <input 
                        type="number"
                        required 
                        value={newCompany.ctc} 
                        onChange={e => setNewCompany({...newCompany, ctc: e.target.value})}
                        placeholder="12"
                      />
                    </div>
                  </div>
                  <div className="cp-form-row">
                    <div className="cp-field cp-field--tier">
                      <label>Tier</label>
                      <div className="cp-tier-options">
                        {['Regular', 'Dream', 'Super Dream'].map(tier => (
                          <button
                            key={tier}
                            type="button"
                            className={`cp-tier-btn ${newCompany.tier === tier ? 'active' : ''}`}
                            onClick={() => setNewCompany({...newCompany, tier})}
                          >
                            {tier}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button type="submit" className="cp-btn cp-btn--primary">
                      Add Company
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Sub Tabs */}
            <div className="cp-subtabs">
              <button 
                className={`cp-subtab ${driveView === 'pipeline' ? 'active' : ''}`}
                onClick={() => setDriveView('pipeline')}
              >
                Pipeline
              </button>
              <button 
                className={`cp-subtab ${driveView === 'calendar' ? 'active' : ''}`}
                onClick={() => setDriveView('calendar')}
              >
                Calendar
              </button>
            </div>

            <div className="cp-drives-layout">
              {/* Pipeline / Calendar View */}
              <div className={`cp-drives-main ${selectedCompany ? 'cp-drives-main--narrow' : ''}`}>
                {driveView === 'pipeline' && (
                  <div className="cp-pipeline">
                    {(['contacted', 'negotiating', 'scheduled'] as const).map(status => (
                      <div key={status} className="cp-column">
                        <div className="cp-column-head">
                          <span className={`cp-dot cp-dot--${status}`} />
                          <span>{status}</span>
                          <span className="cp-count">{pipelineData[status].length}</span>
                        </div>
                        <div className="cp-column-body">
                          {pipelineData[status].map(company => (
                            <div 
                              key={company.id} 
                              className={`cp-company-card ${selectedCompany?.id === company.id ? 'cp-company-card--selected' : ''}`}
                              onClick={() => {
                                setSelectedCompany(company);
                                setGeneratedCreds(null);
                                setShowSlotForm(false);
                              }}
                            >
                              <div className="cp-company-card-top">
                                <h4>{company.companyName || 'Unknown'}</h4>
                                <span className={`cp-tier cp-tier--${getTierClass(company.tier)}`}>
                                  {displayTier(company.tier)}
                                </span>
                              </div>
                              <div className="cp-company-card-bottom">
                                <span>{company.contactPerson || '—'}</span>
                                <span className="cp-ctc">₹{company.ctc || 0}L</span>
                              </div>
                            </div>
                          ))}
                          {pipelineData[status].length === 0 && (
                            <div className="cp-column-empty">No companies</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {driveView === 'calendar' && (
                  <div className="cp-card">
                    <div className="cp-table-wrap">
                      <table className="cp-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Slot</th>
                            <th>Company</th>
                            <th>Package</th>
                            <th>Tier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {outreachList
                            .filter(l => l.status === 'scheduled')
                            .sort((a, b) => new Date(a.driveDate || 0).getTime() - new Date(b.driveDate || 0).getTime())
                            .map(rec => (
                              <tr 
                                key={rec.id} 
                                className={`cp-table-row--clickable ${selectedCompany?.id === rec.id ? 'cp-table-row--selected' : ''}`}
                                onClick={() => {
                                  setSelectedCompany(rec);
                                  setGeneratedCreds(null);
                                  setShowSlotForm(false);
                                }}
                              >
                                <td>
                                  {rec.driveDate ? new Date(rec.driveDate).toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric'
                                  }) : '—'}
                                </td>
                                <td><span className="cp-slot">{rec.slot || '—'}</span></td>
                                <td className="cp-company-name">{rec.companyName || 'Unknown'}</td>
                                <td>₹{rec.ctc || 0} LPA</td>
                                <td>
                                  <span className={`cp-tier cp-tier--${getTierClass(rec.tier)}`}>
                                    {displayTier(rec.tier)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {outreachList.filter(l => l.status === 'scheduled').length === 0 && (
                        <div className="cp-empty">No scheduled drives</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Company Detail Panel (Side Panel) */}
              {selectedCompany && (
                <div className="cp-detail-panel">
                  <div className="cp-detail-header">
                    <div>
                      <h3>{selectedCompany.companyName}</h3>
                      <p>{selectedCompany.email}</p>
                    </div>
                    <button className="cp-close-btn" onClick={closeCompanyDetail}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>

                  {generatedCreds ? (
                    <div className="cp-creds-panel">
                      <div className="cp-creds-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20,6 9,17 4,12"/>
                        </svg>
                      </div>
                      <h4>Credentials Generated</h4>
                      <p>Share with the company HR</p>
                      <div className="cp-creds-box">
                        <div className="cp-creds-row">
                          <span>Email</span>
                          <div className="cp-creds-value">
                            <code>{generatedCreds.email}</code>
                            <button onClick={() => copyToClipboard(generatedCreds.email, 'email')}>
                              {copiedField === 'email' ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                        <div className="cp-creds-row">
                          <span>Password</span>
                          <div className="cp-creds-value">
                            <code>{generatedCreds.password}</code>
                            <button onClick={() => copyToClipboard(generatedCreds.password, 'password')}>
                              {copiedField === 'password' ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>
                      <button className="cp-btn cp-btn--secondary cp-btn--full" onClick={closeCompanyDetail}>
                        Done
                      </button>
                    </div>
                  ) : showSlotForm ? (
                    <div className="cp-slot-form">
                      <h4>Allocate Slot</h4>
                      <form onSubmit={handleFinalizeSlot}>
                        <div className="cp-field">
                          <label>Slot</label>
                          <select 
                            value={slotForm.slot} 
                            onChange={e => setSlotForm({...slotForm, slot: e.target.value})}
                          >
                            <option value="Slot 1">Slot 1 (Super Dream)</option>
                            <option value="Slot 2">Slot 2 (Dream)</option>
                            <option value="Day 1">Day 1 Sharing</option>
                            <option value="Mass">Mass Recruitment</option>
                          </select>
                        </div>
                        <div className="cp-field">
                          <label>Drive Date</label>
                          <input 
                            type="date"
                            required 
                            value={slotForm.driveDate} 
                            onChange={e => setSlotForm({...slotForm, driveDate: e.target.value})}
                          />
                        </div>
                        <div className="cp-form-btns">
                          <button type="button" className="cp-btn cp-btn--secondary" onClick={() => setShowSlotForm(false)}>
                            Back
                          </button>
                          <button type="submit" className="cp-btn cp-btn--green">
                            Confirm
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <>
                      <div className="cp-detail-meta">
                        <span className={`cp-tier cp-tier--${getTierClass(selectedCompany.tier)}`}>
                          {displayTier(selectedCompany.tier)}
                        </span>
                        <span className="cp-detail-ctc">₹{selectedCompany.ctc || 0} LPA</span>
                        <span className={`cp-badge cp-badge--${selectedCompany.status}`}>
                          {selectedCompany.status}
                        </span>
                      </div>

                      {selectedCompany.contactPerson && (
                        <div className="cp-detail-contact">
                          <strong>Contact:</strong> {selectedCompany.contactPerson}
                        </div>
                      )}

                      <div className="cp-timeline">
                        <h4>Activity Log</h4>
                        {selectedCompany.timeline && selectedCompany.timeline.length > 0 ? (
                          <div className="cp-timeline-list">
                            {selectedCompany.timeline.map((item, i) => (
                              <div key={i} className="cp-timeline-item">
                                <div className="cp-timeline-dot" />
                                <div className="cp-timeline-content">
                                  <span className="cp-timeline-date">
                                    {item.date ? new Date(item.date).toLocaleDateString('en-US', {
                                      month: 'short', day: 'numeric'
                                    }) : '—'}
                                  </span>
                                  <strong>{item.title}</strong>
                                  {item.description && <p>{item.description}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="cp-timeline-empty">No activity yet</p>
                        )}
                      </div>

                      <form onSubmit={handleLogTimeline} className="cp-log-form">
                        <h4>Add Log Entry</h4>
                        <input 
                          type="text"
                          placeholder="Title"
                          value={logForm.title} 
                          onChange={e => setLogForm({...logForm, title: e.target.value})}
                          required
                        />
                        <textarea 
                          placeholder="Details (optional)"
                          rows={2}
                          value={logForm.description} 
                          onChange={e => setLogForm({...logForm, description: e.target.value})}
                        />
                        <div className="cp-log-row">
                          <select 
                            value={logForm.status} 
                            onChange={e => setLogForm({...logForm, status: e.target.value})}
                          >
                            <option value="">Update status...</option>
                            <option value="negotiating">Negotiating</option>
                            <option value="rejected">Rejected</option>
                          </select>
                          <button type="submit" className="cp-btn cp-btn--secondary">Log</button>
                        </div>
                      </form>

                      {selectedCompany.status !== 'scheduled' && (
                        <button 
                          className="cp-btn cp-btn--green cp-btn--full"
                          onClick={() => setShowSlotForm(true)}
                        >
                          Finalize & Generate Credentials
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================== LIVE TAB =================== */}
        {tab === 'live' && (
          <div className="cp-content">
            <div className="cp-page-header">
              <div>
                <h1>Live Monitoring</h1>
                <p>Active interview sessions</p>
              </div>
              {stats.active > 0 && (
                <div className="cp-live-indicator">
                  <span className="cp-live-dot" />
                  {stats.active} Live
                </div>
              )}
            </div>

            <div className="cp-card cp-card--full">
              <LiveInterviewMonitor interviews={interviews.filter(i => i.status === 'scheduled' || i.status === 'started')} />
            </div>
          </div>
        )}
      </main>

      {/* Loading Overlay */}
      {loading && (
        <div className="cp-loading">
          <div className="cp-spinner" />
        </div>
      )}
    </div>
  );
}