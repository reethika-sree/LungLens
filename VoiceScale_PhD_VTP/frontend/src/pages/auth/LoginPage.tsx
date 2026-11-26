import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeToggleBtn } from '../../contexts/ThemeContext';
import './Auth.css';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const u = await login(email, password);
      // Role-specific redirection
      const dest = u?.role === 'doctor' ? '/doctor/dashboard'
                 : u?.role === 'admin'  ? '/admin/dashboard'
                 : u?.role === 'asha'   ? '/asha/dashboard'
                 : '/patient/dashboard';
      navigate(dest);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid email or password.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div style={{ marginBottom: 28 }}>
          <div className="auth-brand-title">AI Triage for<br /><span>India's PHCs</span></div>
        </div>
        <p className="auth-brand-sub">Voice-first symptom intake, XGBoost TB risk scoring, and smart queue prioritisation for Primary Health Centres.</p>
        <div className="auth-feature-list">
          {[
            { icon: 'bi-mic-fill',              label: 'Voice intake in 12 languages' },
            { icon: 'bi-cpu-fill',              label: 'XGBoost TB risk scoring (94% accuracy)' },
            { icon: 'bi-lightning-charge-fill', label: 'P1–P5 smart queue prioritisation' },
            { icon: 'bi-cloud-fill',            label: 'ABDM integration & referrals' },
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
            <div className="auth-logo-icon"><i className="bi-lungs-fill" style={{ color: '#fff', fontSize: 15 }} /></div>
            <span className="auth-logo-text" style={{ color: 'var(--text)' }}>Lung<span>Lens</span></span>
          </div>
          <div className="auth-title">Welcome back</div>
          <div className="auth-subtitle">Sign in to access your LungLens portal</div>

          {error && <div className="auth-error"><i className="bi-exclamation-circle-fill" /> {error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Email address</label>
              <div className="auth-input-wrap">
                <i className="bi-envelope-fill auth-icon" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="doctor@phc.gov.in" autoFocus />
              </div>
            </div>
            <div className="auth-field">
              <label>Password</label>
              <div className="auth-input-wrap">
                <i className="bi-lock-fill auth-icon" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading
                ? <><i className="bi-arrow-repeat" style={{ animation: 'vcSpin .7s linear infinite' }} /> Signing in...</>
                : <><i className="bi-box-arrow-in-right" /> Sign In</>}
            </button>
          </form>

          <div className="auth-demo-hint"><i className="bi-info-circle" /> Demo: register any email &amp; password, then sign in</div>
          <div className="auth-switch">Don't have an account?{' '}<Link to="/signup" className="auth-switch-btn">Sign up free</Link></div>
          <div className="auth-switch" style={{ marginTop: 8 }}><Link to="/" className="auth-switch-btn"><i className="bi-house-fill" /> Back to Landing Page</Link></div>
        </div>
      </div>
    </div>
  );
}
