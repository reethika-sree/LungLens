import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggleBtn } from '../contexts/ThemeContext';
import './LandingPage.css';

const STATS = [
  { val: '95%',  lbl: 'TB Detection Accuracy' },
  { val: '3s',   lbl: 'Voice → Risk Score' },
  { val: '3',    lbl: 'Supported Languages (TE, HI, EN)' },
  { val: '0.98', lbl: 'Blood Model AUC' },
];

const PORTALS = [
  { key:'patient', badge:'PATH 01 / PATIENT',      icon:'bi-person-fill',       name:'Patient',    desc:'Speak symptoms in Telugu, Hindi, or English. Whisper STT transcribes, dynamic AI dialogue identifies missing symptoms, and XGBoost scores TB risk with instant clinical feedback.', meta:'Voice-first · Dynamic Dialogue', color:'var(--blue)',   bg:'var(--blue-a)',   border:'rgba(110,184,255,.3)',  path:'/patient/dashboard' },
  { key:'doctor',  badge:'PATH 02 / PHC DOCTOR',   icon:'bi-heart-pulse-fill',  name:'PHC Doctor', desc:'Live AI-ranked queue with XGBoost TB scores, SHAP explainability on every prediction, GeneXpert fusion results, referral letters and teleconsult.',                                meta:'Clinical AI & SHAP Queue',        color:'var(--purple)', bg:'var(--purple-a)', border:'rgba(184,164,255,.3)',  path:'/doctor/dashboard'  },
  { key:'asha',    badge:'PATH 03 / ASHA WORKER',  icon:'bi-house-fill',        name:'ASHA Worker',desc:'Village patient list, daily DOTS pill check-in, field patient registration and visit logs — designed for 2G mobile with zero training required.',                                  meta:'Mobile-first Field Portal',         color:'var(--teal)',   bg:'var(--teal-a)',   border:'rgba(0,232,181,.3)',    path:'/asha/dashboard'    },
  { key:'admin',   badge:'PATH 04 / MASTER ADMIN', icon:'bi-graph-up-arrow',    name:'Admin (NHM)',desc:'TB cluster heatmaps, multi-PHC oversight, user management, audit logs and ABDM FHIR R4 configuration for district-level administrators.',                             meta:'District Surveillance',            color:'var(--amber)',  bg:'var(--amber-a)',  border:'rgba(247,187,74,.3)',   path:'/admin/dashboard'   },
];

const FEATURES = [
  { icon:'bi-mic-fill',              title:'Dynamic Voice Dialogue',     desc:'Patients speak naturally in Telugu, Hindi, or English. The backend NLP engine extracts symptoms, understands negations, and dynamically asks targeted follow-up questions.' },
  { icon:'bi-cpu-fill',              title:'XGBoost TB Scoring',         desc:'XGBoost model trained on clinical symptom markers scores TB probability 0–100%. Structured symptom vectors feed directly into priority tiering (P1–P3).' },
  { icon:'bi-chat-heart-fill',       title:'Role-Specific Dashboards',   desc:'Completely separate, dedicated dashboards for Patients, Doctors, ASHA workers, and NHM District Administrators with customized sidebar navigation and KPIs.' },
  { icon:'bi-house-fill',            title:'ASHA Village Integration',   desc:'ASHA workers register patients in the field, log daily DOTS pill adherence, and track visit history — all from a mobile-first PWA.' },
  { icon:'bi-shield-check',          title:'Clinical Lexicon Matching',  desc:'Rich trilingual medical lexicon mapping common colloquialisms, transliterations, and native scripts across respiratory, constitutional, and risk factors.' },
  { icon:'bi-shield-lock-fill',      title:'Secure Patient Portals',     desc:'Separate patient authentication pages, role-protected routes, and comprehensive medical disclaimers adhering to healthcare compliance.' },
];

const ROLE_META: Record<string, { color: string; label: string; icon: string; greeting: string }> = {
  patient: { color:'var(--blue)',   label:'Patient',     icon:'bi-person-fill',      greeting:'Welcome back! Your patient dashboard is ready.' },
  doctor:  { color:'var(--purple)', label:'PHC Doctor',  icon:'bi-heart-pulse-fill', greeting:'Welcome back, Doctor. Your clinical queue awaits.' },
  asha:    { color:'var(--teal)',   label:'ASHA Worker', icon:'bi-house-fill',        greeting:'Welcome back! Your village patients are waiting.' },
  admin:   { color:'var(--amber)',  label:'Admin (NHM)', icon:'bi-graph-up-arrow',   greeting:'Welcome back. District health surveillance is live.' },
};

function LoginParticles({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="lp-particles" aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => (
        <div key={i} className="lp-particle" style={{
          left: `${8 + (i * 4.7) % 84}%`,
          animationDelay: `${i * 0.07}s`,
          animationDuration: `${0.8 + (i % 5) * 0.18}s`,
          background: ['var(--teal)','var(--blue)','var(--purple)','var(--amber)','var(--green)'][i % 5],
          width:  `${4 + (i % 3) * 3}px`,
          height: `${4 + (i % 3) * 3}px`,
          borderRadius: i % 4 === 0 ? '2px' : '50%',
        }} />
      ))}
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [justLoggedIn,      setJustLoggedIn]      = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [pulsePortal,       setPulsePortal]       = useState(false);
  const prevAuth  = useRef(isAuthenticated);
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prevAuth.current && isAuthenticated) {
      setJustLoggedIn(true);
      setShowWelcomeBanner(true);
      setTimeout(() => setPulsePortal(true),  600);
      setTimeout(() => portalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 1000);
      setTimeout(() => setJustLoggedIn(false), 2600);
      setTimeout(() => setShowWelcomeBanner(false), 7000);
    }
    if (!pulsePortal && isAuthenticated) setPulsePortal(true);
    prevAuth.current = isAuthenticated;
  }, [isAuthenticated]);

  const roleMeta = user?.role ? ROLE_META[user.role] : null;

  const goToPortal = (targetRole?: string) => {
    if (!isAuthenticated) {
      if (targetRole === 'patient') {
        navigate('/patient/login');
      } else {
        navigate('/login');
      }
      return;
    }
    const map: Record<string,string> = {
      patient: '/patient/dashboard',
      doctor:  '/doctor/dashboard',
      admin:   '/admin/dashboard',
      asha:    '/asha/dashboard'
    };
    navigate(map[user?.role ?? ''] ?? '/');
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', position:'relative', overflowX:'hidden' }}>

      <LoginParticles active={justLoggedIn} />

      {/* ── Welcome banner ── */}
      {showWelcomeBanner && roleMeta && (
        <div className="lp-welcome-banner lp-wb-enter" style={{ '--wb-color': roleMeta.color } as React.CSSProperties}>
          <div className="lp-wb-inner">
            <div className="lp-wb-icon" style={{ color: roleMeta.color }}>
              <i className={roleMeta.icon} />
            </div>
            <div className="lp-wb-text">
              <strong className="lp-wb-title">Signed in as {roleMeta.label} ✓</strong>
              <span className="lp-wb-sub">{roleMeta.greeting}</span>
            </div>
            <button className="lp-wb-cta" style={{ background: roleMeta.color }} onClick={() => goToPortal()}>
              Go to my dashboard <i className="bi-arrow-right" />
            </button>
            <button className="lp-wb-close" onClick={() => setShowWelcomeBanner(false)} aria-label="Dismiss">
              <i className="bi-x" />
            </button>
          </div>
          <div className="lp-wb-progress" style={{ background: roleMeta.color }} />
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="lp-header">
        <div className="lp-header-inner">
          <div className="lp-logo" onClick={() => navigate('/')}>
            <div className="lp-logo-icon"><i className="bi-lungs-fill" style={{ color:'#fff', fontSize:18 }} /></div>
            <span className="lp-logo-text">Lung<span>Lens</span></span>
          </div>
          <div className="lp-header-actions">
            <ThemeToggleBtn />
            {isAuthenticated ? (
              <>
                <div
                  className={`lp-user-avatar ${pulsePortal ? 'lp-avatar-glow' : ''}`}
                  onClick={() => navigate('/profile')}
                  title={`${user?.full_name} — View profile`}
                  style={roleMeta ? { background:`linear-gradient(135deg, ${roleMeta.color}, var(--blue))` } : {}}
                >
                  {(user?.full_name || 'U')[0].toUpperCase()}
                </div>
                <button className="lp-btn-logout" onClick={logout}>
                  <i className="bi-box-arrow-right" /> Logout
                </button>
              </>
            ) : (
              <>
                <button className="lp-btn-signin" onClick={() => navigate('/patient/login')} style={{ color: 'var(--blue)', borderColor: 'rgba(110,184,255,.3)' }}>
                  <i className="bi-person-heart" /> Patient Portal
                </button>
                <button className="lp-btn-signin" onClick={() => navigate('/login')}>
                  <i className="bi-hospital" /> Staff Sign In
                </button>
                <button className="lp-btn-signup" onClick={() => navigate('/patient/signup')}>
                  <i className="bi-person-plus-fill" /> Patient Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="lp-hero">
        <div className="lp-hero-content">
          <div className="lp-hero-badge"><i className="bi-broadcast" /> Voice NLP · Dynamic Dialogue · XGBoost ML · India PHC Triage</div>
          <h1 className="lp-hero-title">Intelligent TB Triage for<br /><span>India's Primary Healthcare</span></h1>
          <p className="lp-hero-sub">Speak naturally in Telugu, Hindi, or English. Our NLP pipeline extracts symptoms and duration, dynamically generates missing follow-up questions, and runs machine learning risk scoring for immediate clinical guidance.</p>

          <div className="lp-hero-actions">
            {isAuthenticated ? (
              <>
                <button
                  className={`lp-btn-primary lp-btn-portal-hero ${pulsePortal ? 'lp-hero-portal-pulse' : ''}`}
                  onClick={() => goToPortal()}
                  style={roleMeta ? { background: roleMeta.color } : {}}
                >
                  <i className={roleMeta?.icon || 'bi-grid-fill'} />
                  Enter {roleMeta?.label ?? 'My'} Dashboard
                  <span className="lp-btn-shimmer" />
                </button>
                <button className="lp-btn-secondary" onClick={() => navigate('/profile')}>
                  <i className="bi-person-circle" /> My Profile
                </button>
              </>
            ) : (
              <>
                <button className="lp-btn-primary" onClick={() => navigate('/patient/login')}>
                  <i className="bi-mic-fill" /> Patient Check-in
                </button>
                <button className="lp-btn-secondary" onClick={() => navigate('/login')}>
                  <i className="bi-shield-lock" /> Doctor / Staff Sign In
                </button>
              </>
            )}
          </div>

          {isAuthenticated && roleMeta && (
            <div className="lp-signed-in-chip lp-chip-enter" style={{ borderColor:`color-mix(in srgb, ${roleMeta.color} 30%, transparent)`, color: roleMeta.color }}>
              <i className="bi-check-circle-fill" />
              Signed in as <strong>{user?.full_name}</strong> · {roleMeta.label}
            </div>
          )}
        </div>
      </section>

      {/* ── STATS ── */}
      <div className="lp-stats">
        {STATS.map(s => (
          <div key={s.lbl} className="lp-stat">
            <div className="lp-stat-val">{s.val}</div>
            <div className="lp-stat-lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* ── PORTALS ── */}
      <section className="lp-portals" ref={portalRef}>
        <div className="lp-section-title">Role-Specific Healthcare Dashboards</div>
        <div className="lp-section-sub">Purpose-built interfaces tailored specifically for patients, PHC doctors, ASHA field workers, and administrators</div>

        {isAuthenticated && roleMeta && (
          <div className="lp-portal-arrow-hint lp-hint-enter" style={{ color: roleMeta.color }}>
            <i className="bi-arrow-down-circle-fill" style={{ fontSize:18 }} />
            <span>Your portal is highlighted — click to enter</span>
          </div>
        )}

        <div className="lp-portal-cards">
          {PORTALS.map(p => {
            const isMyRole  = user?.role === p.key;
            const canAccess = isAuthenticated ? isMyRole : true;
            const dimmed    = isAuthenticated && !isMyRole;

            return (
              <div
                key={p.name}
                className={`lp-portal-card ${canAccess ? 'accessible' : 'locked'} ${canAccess && pulsePortal && isMyRole ? 'lp-card-spotlight' : ''}`}
                onClick={() => goToPortal(p.key)}
                style={{
                  borderColor:  isMyRole ? p.border : 'var(--border)',
                  cursor:       'pointer',
                  opacity:      dimmed ? 0.45 : 1,
                  boxShadow:    isMyRole ? `0 0 0 2px ${p.border}, 0 8px 32px ${p.border}` : 'none',
                  transform:    isMyRole ? 'translateY(-2px)' : 'none',
                }}
              >
                {isMyRole && (
                  <div className="lp-my-portal-badge" style={{ color: p.color, borderColor: p.border, background: p.bg }}>
                    <i className="bi-star-fill" style={{ fontSize:8 }} /> ACTIVE SESSION
                  </div>
                )}
                <div className="lp-pc-badge">{p.badge}</div>
                <div className="lp-pc-icon" style={{ background: p.bg, border:`1px solid ${p.border}` }}>
                  <i className={p.icon} style={{ color: p.color, fontSize:22 }} />
                </div>
                <div className="lp-pc-name">{p.name} Dashboard</div>
                <div className="lp-pc-desc">{p.desc}</div>
                <div className="lp-pc-meta">{p.meta}</div>
                <button
                  className="lp-pc-btn lp-pc-btn-active"
                  style={{
                    background: p.bg,
                    color:      p.color,
                    cursor:     'pointer',
                    border:     `1px solid ${p.border}`,
                    fontWeight: 700,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPortal(p.key);
                  }}
                >
                  {isAuthenticated && isMyRole ? (
                    <>
                      <i className="bi-box-arrow-in-right" /> Open Dashboard
                    </>
                  ) : isAuthenticated ? (
                    <>
                      <i className="bi-lock" /> Switch Account
                    </>
                  ) : p.key === 'patient' ? (
                    <>
                      <i className="bi-person-check-fill" /> Patient Login / Signup
                    </>
                  ) : (
                    <>
                      <i className="bi-shield-lock-fill" /> Staff Portal Sign In
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="lp-features">
        <div style={{ maxWidth:1040, margin:'0 auto' }}>
          <div className="lp-section-title">Built for Real Clinical Workflow</div>
          <div className="lp-section-sub">Engineered to support low-resource rural PHCs with high-accuracy intelligent triage</div>
        </div>
        <div className="lp-features-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="lp-feature-card">
              <div className="lp-feature-icon"><i className={f.icon} /></div>
              <div className="lp-feature-title">{f.title}</div>
              <div className="lp-feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="lp-footer">
        <p>© 2026 LUNGLENS · WHISPER STT · DYNAMIC NLP · XGBOOST · ETHEREUM · FHIR R4</p>
      </footer>
    </div>
  );
}
