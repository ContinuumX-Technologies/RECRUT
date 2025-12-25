import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

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
  Eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  EyeOff: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
};

// ============================================
// LOADING SPINNER
// ============================================

const Spinner = () => (
  <div className="login-spinner">
    <div className="login-spinner__ring" />
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      login(data.token, data.user);
      
      if (data.user.role === 'INTERVIEWER') {
        navigate('/interviewer/dashboard');
      } else {
        navigate('/candidate/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* ================================
          LEFT SIDE - HERO
          ================================ */}
      <div className="login-hero">
        <div className="login-hero__bg" />
        <div className="login-hero__gradient" />
        
        <div className="login-hero__content">
          <div className="login-hero__logo">
            <Icons.Sparkles />
          </div>
          
          <h1 className="login-hero__title">
            Welcome back to
            <span className="login-hero__title-accent">
              Interview AI
            </span>
          </h1>
          
          <p className="login-hero__subtitle">
            Continue your journey with AI-powered interviews. Your next opportunity awaits.
          </p>

          <div className="login-hero__features">
            <div className="login-feature">
              <div className="login-feature__icon">
                <Icons.Zap />
              </div>
              <span>Instant access to your dashboard</span>
            </div>
            
            <div className="login-feature">
              <div className="login-feature__icon">
                <Icons.Shield />
              </div>
              <span>Secure & encrypted connection</span>
            </div>
            
            <div className="login-feature">
              <div className="login-feature__icon">
                <Icons.Sparkles />
              </div>
              <span>Pick up where you left off</span>
            </div>
          </div>
        </div>

        <div className="login-hero__footer">
          <p>Protected by enterprise-grade security</p>
        </div>
      </div>

      {/* ================================
          RIGHT SIDE - FORM
          ================================ */}
      <div className="login-form-container">
        <div className="login-form-wrapper">
          {/* Header */}
          <header className="login-header">
            <div className="login-header__logo-mobile">
              <Icons.Sparkles />
              <span>Interview AI</span>
            </div>
            <h2 className="login-header__title">Sign in</h2>
            <p className="login-header__subtitle">
              Don't have an account?{' '}
              <Link to="/register" className="login-link">
                Create one
              </Link>
            </p>
          </header>

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            {/* Input Fields */}
            <div className="login-fields">
              <div className="login-input-group">
                <label className="login-label" htmlFor="email">Email Address</label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">
                    <Icons.Mail />
                  </span>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="login-input"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="login-input-group">
                <div className="login-label-row">
                  <label className="login-label" htmlFor="password">Password</label>
                  <Link to="/forgot-password" className="login-forgot">
                    Forgot password?
                  </Link>
                </div>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">
                    <Icons.Lock />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="login-input login-input--password"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                  </button>
                </div>
              </div>
            </div>

            {/* Remember Me */}
            <label className="login-remember">
              <input type="checkbox" className="login-remember__input" />
              <span className="login-remember__checkbox">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
              </span>
              <span className="login-remember__text">Keep me signed in</span>
            </label>

            {/* Error Message */}
            {error && (
              <div className="login-error">
                <Icons.AlertCircle />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="login-submit"
            >
              {loading ? (
                <Spinner />
              ) : (
                <>
                  <span>Sign In</span>
                  <Icons.ArrowRight />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="login-divider">
              <span>or continue with</span>
            </div>

            {/* Social Login */}
            <div className="login-social">
              <button type="button" className="login-social-btn">
                <svg viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Google</span>
              </button>
              
              <button type="button" className="login-social-btn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span>GitHub</span>
              </button>
            </div>
          </form>

          {/* Footer */}
          <footer className="login-footer">
            <p>
              By signing in, you agree to our{' '}
              <a href="/terms">Terms</a> and{' '}
              <a href="/privacy">Privacy Policy</a>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;