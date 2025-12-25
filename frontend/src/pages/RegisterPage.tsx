import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './RegisterPage.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// ============================================
// ICON COMPONENTS
// ============================================

const Icons = {
  Brain: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-2 3.46V12a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h4z"/>
      <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0 2 3.46V12a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4V6a4 4 0 0 0-4-4h-4z"/>
      <path d="M9 22v-4"/>
      <path d="M15 22v-4"/>
      <path d="M12 18v4"/>
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
  Mail: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  Lock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  ArrowRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12,5 19,12 12,19"/>
    </svg>
  ),
  AlertCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  Sparkles: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3l1.09 3.41L16.5 7.5l-3.41 1.09L12 12l-1.09-3.41L7.5 7.5l3.41-1.09L12 3zm6.5 9l.72 2.28L21.5 15l-2.28.72-.72 2.28-.72-2.28L15.5 15l2.28-.72.72-2.28zM5.5 15l.72 2.28L8.5 18l-2.28.72-.72 2.28-.72-2.28L2.5 18l2.28-.72.72-2.28z"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  ),
  Shield: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Zap: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
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
};

// ============================================
// LOADING SPINNER
// ============================================

const Spinner = () => (
  <div className="register-spinner">
    <div className="register-spinner__ring" />
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CANDIDATE' as 'CANDIDATE' | 'INTERVIEWER',
    candidateId: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      
      login(data.token, data.user);
      navigate(data.user.role === 'INTERVIEWER' ? '/interviewer/dashboard' : '/candidate/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="register-page ">
      {/* ================================
          LEFT SIDE - BRANDING
          ================================ */}
      <div className="register-hero">
        <div className="register-hero__bg" />
        <div className="register-hero__gradient" />
        
        <div className="register-hero__content">
          <div className="register-hero__logo">
            <Icons.Sparkles />
          </div>
          
          <h1 className="register-hero__title">
            Join the Future of
            <span className="register-hero__title-accent">
              Intelligent Hiring
            </span>
          </h1>
          
          <p className="register-hero__subtitle">
            Experience the next generation of interview technology powered by artificial intelligence.
          </p>

          <div className="register-hero__features">
            <div className="register-feature">
              <div className="register-feature__icon">
                <Icons.Zap />
              </div>
              <div className="register-feature__text">
                <strong>AI-Powered Analysis</strong>
                <span>Smart insights from every interview</span>
              </div>
            </div>
            
            <div className="register-feature">
              <div className="register-feature__icon">
                <Icons.Shield />
              </div>
              <div className="register-feature__text">
                <strong>Secure & Private</strong>
                <span>Enterprise-grade data protection</span>
              </div>
            </div>
            
            <div className="register-feature">
              <div className="register-feature__icon">
                <Icons.Sparkles />
              </div>
              <div className="register-feature__text">
                <strong>Seamless Experience</strong>
                <span>Intuitive interface for all users</span>
              </div>
            </div>
          </div>
        </div>

        <div className="register-hero__footer">
          <p>Trusted by leading companies worldwide</p>
        </div>
      </div>

      {/* ================================
          RIGHT SIDE - FORM
          ================================ */}
      <div className="register-form-container">
        <div className="register-form-wrapper">
          {/* Header */}
          <header className="register-header">
            <div className="register-header__logo-mobile">
              <Icons.Sparkles />
              <span>Interview AI</span>
            </div>
            <h2 className="register-header__title">Create your account</h2>
            <p className="register-header__subtitle">
              Already have an account?{' '}
              <Link to="/login" className="register-link">
                Sign in
              </Link>
            </p>
          </header>

          {/* Form */}
          <form onSubmit={handleSubmit} className="register-form">
            {/* Role Selection */}
            <div className="register-role-selector">
              <button
                type="button"
                onClick={() => setForm({ ...form, role: 'CANDIDATE' })}
                className={`register-role-btn ${form.role === 'CANDIDATE' ? 'register-role-btn--active' : ''}`}
              >
                <span className="register-role-btn__icon">
                  <Icons.User />
                </span>
                <span className="register-role-btn__label">Candidate</span>
                <span className="register-role-btn__desc">Take interviews</span>
                {form.role === 'CANDIDATE' && (
                  <span className="register-role-btn__check">
                    <Icons.Check />
                  </span>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => setForm({ ...form, role: 'INTERVIEWER' })}
                className={`register-role-btn register-role-btn--interviewer ${form.role === 'INTERVIEWER' ? 'register-role-btn--active' : ''}`}
              >
                <span className="register-role-btn__icon">
                  <Icons.Briefcase />
                </span>
                <span className="register-role-btn__label">Interviewer</span>
                <span className="register-role-btn__desc">Conduct interviews</span>
                {form.role === 'INTERVIEWER' && (
                  <span className="register-role-btn__check">
                    <Icons.Check />
                  </span>
                )}
              </button>
            </div>

            {/* Input Fields */}
            <div className="register-fields">
              <div className="register-input-group">
                <label className="register-label">Full Name</label>
                <div className="register-input-wrapper">
                  <span className="register-input-icon">
                    <Icons.User />
                  </span>
                  <input
                    type="text"
                    required
                    className="register-input"
                    placeholder="Enter your full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="register-input-group">
                <label className="register-label">Email Address</label>
                <div className="register-input-wrapper">
                  <span className="register-input-icon">
                    <Icons.Mail />
                  </span>
                  <input
                    type="email"
                    required
                    className="register-input"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="register-input-group">
                <label className="register-label">Password</label>
                <div className="register-input-wrapper">
                  <span className="register-input-icon">
                    <Icons.Lock />
                  </span>
                  <input
                    type="password"
                    required
                    className="register-input"
                    placeholder="Create a strong password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <span className="register-input-hint">Must be at least 8 characters</span>
              </div>

              {form.role === 'CANDIDATE' && (
                <div className="register-input-group register-input-group--optional">
                  <label className="register-label">
                    Registration Number
                    <span className="register-label-optional">Optional</span>
                  </label>
                  <div className="register-input-wrapper">
                    <span className="register-input-icon">
                      <Icons.Hash />
                    </span>
                    <input
                      type="text"
                      className="register-input"
                      placeholder="e.g., STU-2024-001"
                      value={form.candidateId}
                      onChange={(e) => setForm({ ...form, candidateId: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="register-error">
                <Icons.AlertCircle />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="register-submit"
            >
              {loading ? (
                <Spinner />
              ) : (
                <>
                  <span>Create Account</span>
                  <Icons.ArrowRight />
                </>
              )}
            </button>

            {/* Terms */}
            <p className="register-terms">
              By creating an account, you agree to our{' '}
              <a href="/terms">Terms of Service</a> and{' '}
              <a href="/privacy">Privacy Policy</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;