import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeToggleBtn } from '../../contexts/ThemeContext';
import './Auth.css';

export default function PatientSignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !email.trim() || !password || !confirm) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      // Role is explicitly patient
      await signup(fullName.trim(), email.trim(), password, confirm, 'patient');
      // Redirect straight to patient dashboard
      navigate('/patient/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed. This email may already be registered. Please sign in instead.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div style={{ marginBottom: 28 }}>
          <div className="auth-brand-title">Patient Portal<br /><span>Register Account</span></div>
        </div>
        <p className="auth-brand-sub">
          Create your private patient account to start confidential multilingual voice screenings, receive AI triage predictions, and access your clinic records.
        </p>
        <div className="auth-feature-list">
          {[
            { icon: 'bi-mic-fill',              label: 'Voice intake in Telugu, Hindi & English' },
            { icon: 'bi-chat-dots-fill',        label: 'Dynamic context-aware AI interview' },
            { icon: 'bi-ticket-perforated-fill',label: 'Instant PHC clinic queue priority ticket' },
            { icon: 'bi-shield-lock-fill',      label: 'Secure, private medical records' },
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
              <i className="bi-person-plus-fill" style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <span className="auth-logo-text" style={{ color: 'var(--text)' }}>Patient <span>Registration</span></span>
          </div>

          <div className="auth-title">Create Patient Account</div>
          <div className="auth-subtitle">Register to begin your TB symptom screening</div>

          {error && <div className="auth-error"><i className="bi-exclamation-circle-fill" /> {error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Full Name</label>
              <div className="auth-input-wrap">
                <i className="bi-person-fill auth-icon" />
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label>Email Address</label>
              <div className="auth-input-wrap">
                <i className="bi-envelope-fill auth-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label>Password (min. 6 characters)</label>
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

            <div className="auth-field">
              <label>Confirm Password</label>
              <div className="auth-input-wrap">
                <i className="bi-shield-lock-fill auth-icon" />
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading} style={{ background: 'linear-gradient(135deg, var(--teal), var(--blue))' }}>
              {loading
                ? <><i className="bi-arrow-repeat" style={{ animation: 'vcSpin .7s linear infinite' }} /> Creating account...</>
                : <><i className="bi-person-check-fill" /> Complete Registration</>}
            </button>
          </form>

          <div className="auth-switch">
            Already registered as a patient?{' '}
            <Link to="/patient/login" className="auth-switch-btn" style={{ fontWeight: 700, color: 'var(--teal)' }}>
              Sign In Here
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
