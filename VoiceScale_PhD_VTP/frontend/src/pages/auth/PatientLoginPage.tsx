import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeToggleBtn } from '../../contexts/ThemeContext';
import './Auth.css';

export default function PatientLoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      // Immediately navigate to the Patient Dashboard
      navigate('/patient/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid email or password. Please try again or create an account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div style={{ marginBottom: 28 }}>
          <div className="auth-brand-title">Patient Portal<br /><span>LungLens</span></div>
        </div>
        <p className="auth-brand-sub">
          Welcome to the patient health portal. Sign in to access your confidential voice screening records, AI-powered TB triage assessments, and daily medication tracker.
        </p>
        <div className="auth-feature-list">
          {[
            { icon: 'bi-mic-fill',              label: 'Voice intake in Telugu, Hindi & English' },
            { icon: 'bi-chat-dots-fill',        label: 'Dynamic AI follow-up questionnaires' },
            { icon: 'bi-cpu-fill',              label: 'XGBoost TB risk prediction & priority queue' },
            { icon: 'bi-capsule-pill',          label: 'Daily DOTS medication adherence logs' },
          ].map(f => (
            <div key={f.label} className="auth-feature-item">
              <div className="auth-feature-icon"><i className={f.icon} /></div>
              <span className="auth-feature-label">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-right">
        <div style={{ position: 'absolute', top: 20, right: 24 }}><ThemeToggleBtn /></div>
        <div className="auth-card">
          <div className="auth-logo-row">
            <div className="auth-logo-icon" style={{ background: 'linear-gradient(135deg, var(--teal), var(--blue))' }}>
              <i className="bi-person-fill" style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <span className="auth-logo-text" style={{ color: 'var(--text)' }}>Patient <span>Sign In</span></span>
          </div>

          <div className="auth-title">Welcome back</div>
          <div className="auth-subtitle">Sign in to your patient account to continue</div>

          {error && <div className="auth-error"><i className="bi-exclamation-circle-fill" /> {error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Email address</label>
              <div className="auth-input-wrap">
                <i className="bi-envelope-fill auth-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="patient@phc.gov.in"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label>Password</label>
              <div className="auth-input-wrap">
                <i className="bi-lock-fill auth-icon" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading} style={{ background: 'linear-gradient(135deg, var(--teal), var(--blue))' }}>
              {loading
                ? <><i className="bi-arrow-repeat" style={{ animation: 'vcSpin .7s linear infinite' }} /> Signing in...</>
                : <><i className="bi-box-arrow-in-right" /> Sign In as Patient</>}
            </button>
          </form>

          <div className="auth-demo-hint">
            <i className="bi-info-circle" /> Demo Account: <strong>patient@phc.gov.in</strong> / <strong>patient123</strong>
          </div>

          <div className="auth-switch">
            New Patient?{' '}
            <Link to="/patient/signup" className="auth-switch-btn" style={{ fontWeight: 700, color: 'var(--teal)' }}>
              Create Patient Account
            </Link>
          </div>

          <div className="auth-switch" style={{ marginTop: 8 }}>
            Are you a doctor or staff?{' '}
            <Link to="/login" className="auth-switch-btn">
              Clinical / Staff Login
            </Link>
          </div>

          <div className="auth-switch" style={{ marginTop: 8 }}>
            <Link to="/" className="auth-switch-btn">
              <i className="bi-house-fill" /> Back to Home Page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
