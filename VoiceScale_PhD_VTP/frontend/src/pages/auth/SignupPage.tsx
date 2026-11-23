import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeToggleBtn } from '../../contexts/ThemeContext';
import './Auth.css';

const ROLES = [
  { value: 'patient', label: 'Patient',      icon: 'bi-person-fill',        desc: 'Voice intake & queue' },
  { value: 'doctor',  label: 'PHC Doctor',   icon: 'bi-heart-pulse-fill',   desc: 'Queue, SHAP, teleconsult' },
  { value: 'asha',    label: 'ASHA Worker',  icon: 'bi-house-fill',         desc: 'Village visits & DOTS' },
  { value: 'admin',   label: 'Admin (NHM)',  icon: 'bi-graph-up-arrow',     desc: 'TB heatmaps & oversight' },
];

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [role, setRole]         = useState('patient');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName || !email || !password || !confirm) { setError('Please fill in all fields.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const u = await signup(fullName, email, password, confirm, role);
      const dest = u?.role === 'doctor' ? '/doctor/dashboard'
                 : u?.role === 'admin'  ? '/admin/dashboard'
                 : u?.role === 'asha'   ? '/asha/dashboard'
                 : '/patient/dashboard';
      navigate(dest);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div style={{ marginBottom: 28 }}>
          <div className="auth-brand-title">Join<br /><span>VoiceCare PHC</span></div>
        </div>
        <p className="auth-brand-sub">Register as a patient, doctor, ASHA worker, or district administrator.</p>
        <div className="auth-feature-list">
          {[
            { icon: 'bi-person-fill',       label: 'Patient — voice intake, queue ticket, live status' },
            { icon: 'bi-heart-pulse-fill',  label: 'Doctor — AI queue, SHAP scores, teleconsult' },
            { icon: 'bi-house-fill',        label: 'ASHA — village visits, DOTS check-in (mobile)' },
            { icon: 'bi-graph-up-arrow',    label: 'Admin — TB heatmaps, ABDM config' },
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
            <span className="auth-logo-text" style={{ color: 'var(--text)' }}>Voice<span>Care</span> PHC</span>
          </div>
          <div className="auth-title">Create account</div>
          <div className="auth-subtitle">Register to access VoiceCare PHC portals</div>
          {error && <div className="auth-error"><i className="bi-exclamation-circle-fill" /> {error}</div>}
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>I am a</label>
              <div className="auth-role-grid">
                {ROLES.map(r => (
                  <button key={r.value} type="button" className={`auth-role-btn ${role === r.value ? 'active' : ''}`} onClick={() => setRole(r.value)}>
                    <i className={r.icon} style={{ fontSize: 16 }} />
                    <span style={{ fontWeight: 500 }}>{r.label}</span>
                    <span style={{ fontSize: 10, opacity: .7 }}>{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="auth-field">
              <label>Full name</label>
              <div className="auth-input-wrap">
                <i className="bi-person-fill auth-icon" />
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter your full name" autoFocus />
              </div>
            </div>
            <div className="auth-field">
              <label>Email address</label>
              <div className="auth-input-wrap">
                <i className="bi-envelope-fill auth-icon" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.gov.in" />
              </div>
            </div>
            <div className="auth-field">
              <label>Password</label>
              <div className="auth-input-wrap">
                <i className="bi-lock-fill auth-icon" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" />
              </div>
            </div>
            <div className="auth-field">
              <label>Confirm password</label>
              <div className="auth-input-wrap">
                <i className="bi-lock-fill auth-icon" />
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" />
              </div>
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading
                ? <><i className="bi-arrow-repeat" style={{ animation: 'vcSpin .7s linear infinite' }} /> Creating account...</>
                : <><i className="bi-person-plus-fill" /> Create Account</>}
            </button>
          </form>
          <div className="auth-switch">Already have an account?{' '}<Link to="/login" className="auth-switch-btn">Sign in</Link></div>
          <div className="auth-switch" style={{ marginTop: 8 }}><Link to="/" className="auth-switch-btn"><i className="bi-house-fill" /> Back to Landing Page</Link></div>
        </div>
      </div>
    </div>
  );
}
