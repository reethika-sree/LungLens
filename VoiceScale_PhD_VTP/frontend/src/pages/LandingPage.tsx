import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggleBtn } from '../contexts/ThemeContext';
import './LandingPage.css';

const STATS = [
  { val: '95%',  lbl: 'TB Detection Accuracy' },
  { val: '3s',   lbl: 'Voice → Risk Score' },
  { val: '11+',  lbl: 'Indian Languages' },
  { val: '0.98', lbl: 'Blood Model AUC' },
];

const PORTALS = [
  { key:'patient', badge:'PATH 01 / PATIENT',      icon:'bi-person-fill',       name:'Patient',    desc:'Speak symptoms in 11 Indian languages. Whisper STT transcribes, AI scores TB risk 0–100%, and issues a P1–P5 queue ticket in under 3 seconds.',                meta:'10 screens · Voice-first',  color:'var(--blue)',   bg:'var(--blue-a)',   border:'rgba(110,184,255,.3)',  path:'/patient' },
  { key:'doctor',  badge:'PATH 02 / PHC DOCTOR',   icon:'bi-heart-pulse-fill',  name:'PHC Doctor', desc:'Live AI-ranked queue with XGBoost TB scores, SHAP explainability on every prediction, GeneXpert fusion results, referral letters and teleconsult.',     meta:'5 screens · Clinical AI',   color:'var(--purple)', bg:'var(--purple-a)', border:'rgba(184,164,255,.3)',  path:'/doctor'  },
  { key:'asha',    badge:'PATH 03 / ASHA WORKER',  icon:'bi-house-fill',        name:'ASHA Worker',desc:'Village patient list, daily DOTS pill check-in, field patient registration and visit logs — designed for 2G mobile with zero training required.',       meta:'5 screens · Mobile-first',  color:'var(--teal)',   bg:'var(--teal-a)',   border:'rgba(0,232,181,.3)',    path:'/asha'    },
  { key:'admin',   badge:'PATH 04 / MASTER ADMIN', icon:'bi-graph-up-arrow',    name:'Admin (NHM)',desc:'TB cluster heatmaps, multi-PHC oversight, user management, audit logs and ABDM FHIR R4 configuration for district-level administrators.',  meta:'4 screens · District view', color:'var(--amber)',  bg:'var(--amber-a)',  border:'rgba(247,187,74,.3)',   path:'/admin'   },
];

const FEATURES = [
  { icon:'bi-mic-fill',              title:'Voice-First Intake',         desc:'Patients speak in any of 11 Indian languages — Hindi, Telugu, Tamil, Kannada, Marathi, Bengali, Gujarati, Punjabi, Odia, Malayalam, English. Whisper STT transcribes and a Llama 3 LangGraph agent extracts structured symptoms instantly.' },
  { icon:'bi-cpu-fill',              title:'XGBoost TB Scoring',         desc:'XGBoost model trained on 8 blood-marker features (4 raw + 4 abnormality flags) scores TB risk 0–100% with AUC 0.98. Every prediction ships with a SHAP waterfall so doctors see the exact reason, not just a number.' },
  { icon:'bi-lightning-charge-fill', title:'Fusion Engine Triage',       desc:'Three models run in parallel — XGBoost on blood markers, DenseNet-121 on chest X-rays, rule logic on GeneXpert lab results. A weighted fusion layer (Lab 50%, X-ray 30%, Blood 20%) produces a single P1–P5 priority badge.' },
  { icon:'bi-house-fill',            title:'ASHA Village Integration',   desc:'ASHA workers register patients in the field, log daily DOTS pill adherence, and track visit history — all from a mobile-first PWA that works on 2G with no prior training needed.' },
  { icon:'bi-camera-video-fill',     title:'Integrated Teleconsult',     desc:'Rural patients connect with district specialists via video directly inside the Doctor portal — no separate app, no extra login.' },
  { icon:'bi-shield-lock-fill',      title:'Blockchain Health Records',  desc:'Every patient record is written to an Ethereum smart contract via Solidity. Records are tamper-proof, patient-verifiable, and ABDM FHIR R4 compliant from day one.' },
];

const ROLE_META: Record<string, { color: string; label: string; icon: string; greeting: string }> = {
  patient: { color:'var(--blue)',   label:'Patient',     icon:'bi-person-fill',      greeting:'Welcome back! Your portal is ready.' },
  doctor:  { color:'var(--purple)', label:'PHC Doctor',  icon:'bi-heart-pulse-fill', greeting:'Welcome back, Doctor. Your queue awaits.' },
  asha:    { color:'var(--teal)',   label:'ASHA Worker', icon:'bi-house-fill',        greeting:'Welcome back! Your patients are waiting.' },
  admin:   { color:'var(--amber)',  label:'Admin (NHM)', icon:'bi-graph-up-arrow',   greeting:'Welcome back. District overview is live.' },
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const roleMeta = user?.role ? ROLE_META[user.role] : null;

  const goToPortal = () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    const map: Record<string,string> = { patient:'/patient', doctor:'/doctor', admin:'/admin', asha:'/asha' };
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
            <button className="lp-wb-cta" style={{ background: roleMeta.color }} onClick={goToPortal}>
              Go to my portal <i className="bi-arrow-right" />
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
            <span className="lp-logo-text">Voice<span>Care</span> PHC</span>
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
                <button className="lp-btn-signin" onClick={() => navigate('/login')}>
                  <i className="bi-box-arrow-in-right" /> Sign In
                </button>
                <button className="lp-btn-signup" onClick={() => navigate('/signup')}>
                  <i className="bi-person-plus-fill" /> Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="lp-hero">
        <div className="lp-hero-content">
          <div className="lp-hero-badge"><i className="bi-broadcast" /> Whisper STT · LangGraph · XGBoost · Ethereum · Live</div>
          <h1 className="lp-hero-title">AI Triage for<br /><span>India's PHCs</span></h1>
          <p className="lp-hero-sub">A 30-second voice clip + Questioneer  gives ous  a TB risk score. Small Language models & Whisper STT transcribes, XGBoost + DenseNet-121 score  and the doctor gets a SHAP-explained, priority-ranked queue in under 3 seconds.</p>

          <div className="lp-hero-actions">
            {isAuthenticated ? (
              <>
                <button
                  className={`lp-btn-primary lp-btn-portal-hero ${pulsePortal ? 'lp-hero-portal-pulse' : ''}`}
                  onClick={goToPortal}
                  style={roleMeta ? { background: roleMeta.color } : {}}
                >
                  <i className={roleMeta?.icon || 'bi-grid-fill'} />
                  Enter {roleMeta?.label ?? 'My'} Portal
                  <span className="lp-btn-shimmer" />
                </button>
                <button className="lp-btn-secondary" onClick={() => navigate('/profile')}>
                  <i className="bi-person-circle" /> My Profile
                </button>
              </>
            ) : (
              <>
                <button className="lp-btn-primary" onClick={() => navigate('/signup')}>
                  <i className="bi-person-plus-fill" /> Get Started Free
                </button>
                <button className="lp-btn-secondary" onClick={() => navigate('/login')}>
                  <i className="bi-box-arrow-in-right" /> Sign In
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
        <div className="lp-section-title">Four Portals. One Platform.</div>
        <div className="lp-section-sub">Purpose-built interfaces for patients, PHC doctors, ASHA workers, and district administrators</div>

        {isAuthenticated && roleMeta && (
          <div className="lp-portal-arrow-hint lp-hint-enter" style={{ color: roleMeta.color }}>
            <i className="bi-arrow-down-circle-fill" style={{ fontSize:18 }} />
            <span>Your portal is highlighted — click to enter</span>
          </div>
        )}

        <div className="lp-portal-cards">
          {PORTALS.map(p => {
            const isMyRole  = user?.role === p.key;
            const canAccess = isAuthenticated && isMyRole;
            const dimmed    = isAuthenticated && !isMyRole;

            return (
              <div
                key={p.name}
                className={`lp-portal-card ${canAccess ? 'accessible' : 'locked'} ${canAccess && pulsePortal ? 'lp-card-spotlight' : ''}`}
                onClick={canAccess ? goToPortal : undefined}
                style={{
                  borderColor:  canAccess ? p.border : 'var(--border)',
                  cursor:       canAccess ? 'pointer' : 'not-allowed',
                  opacity:      dimmed ? 0.45 : 1,
                  boxShadow:    canAccess ? `0 0 0 2px ${p.border}, 0 8px 32px ${p.border}` : 'none',
                  transform:    canAccess ? 'translateY(-2px)' : 'none',
                }}
              >
                {canAccess && (
                  <div className="lp-my-portal-badge" style={{ color: p.color, borderColor: p.border, background: p.bg }}>
                    <i className="bi-star-fill" style={{ fontSize:8 }} /> YOUR PORTAL
                  </div>
                )}
                <div className="lp-pc-badge">{p.badge}</div>
                <div className="lp-pc-icon" style={{ background: p.bg, border:`1px solid ${p.border}`, opacity: canAccess ? 1 : 0.5 }}>
                  <i className={p.icon} style={{ color: p.color, fontSize:22 }} />
                </div>
                <div className="lp-pc-name">{p.name}</div>
                <div className="lp-pc-desc">{p.desc}</div>
                <div className="lp-pc-meta">{p.meta}</div>
                <button
                  className={`lp-pc-btn ${canAccess ? 'lp-pc-btn-active' : ''}`}
                  style={{
                    background: canAccess ? p.bg : 'var(--bg2)',
                    color:      canAccess ? p.color : 'var(--text3)',
                    cursor:     canAccess ? 'pointer' : 'not-allowed',
                    border:     canAccess ? `1px solid ${p.border}` : '1px solid transparent',
                    fontWeight: canAccess ? 700 : 500,
                  }}
                  disabled={!canAccess}
                >
                  {canAccess ? (
                    <>
                      <i className="bi-box-arrow-in-right" /> Enter portal
                    </>
                  ) : isAuthenticated ? (
                    <>
                      <i className="bi-lock-fill" /> Access Denied
                    </>
                  ) : (
                    <>
                      <i className="bi-lock-fill" /> Sign In to Access
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
          <div className="lp-section-title">Built for the Field</div>
          <div className="lp-section-sub">Every feature designed for real PHC constraints — low bandwidth, multiple languages, rural settings</div>
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
        <p>© 2026 VOICECARE PHC · WHISPER STT · LANGRAPH · XGBOOST · DENSENET-121 · ETHEREUM · FHIR R4 · IIIT SRI CITY</p>
      </footer>
    </div>
  );
}
