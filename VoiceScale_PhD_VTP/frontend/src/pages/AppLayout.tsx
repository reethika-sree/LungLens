import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggleBtn } from '../contexts/ThemeContext';
import { patientApi, L2_FRONTEND_URL } from '../api/client';
import './AppLayout.css';

// ─── Portal nav config per role ────────────────────────────────────────────
const NAV_CONFIG: Record<string, { icon: string; label: string; path: string }[]> = {
  doctor: [
  ],
  patient: [
 
  ],
  asha: [
    { icon: 'bi-people-fill',         label: 'Patients',  path: '/asha/patients' },
    { icon: 'bi-check-circle-fill',   label: 'Check-in',  path: '/asha/checkin' },
    { icon: 'bi-journal-text',        label: 'Visits',    path: '/asha/visits' },
  ],
  admin: [
    { icon: 'bi-speedometer2',        label: 'Overview',  path: '/admin/overview' },
    { icon: 'bi-map-fill',            label: 'Map',       path: '/admin/map' },
    { icon: 'bi-journal-code',        label: 'Audit Log', path: '/admin/log' },
    { icon: 'bi-people-fill',         label: 'User Management', path: '/user-management' },
  ],
};

const ROLE_META: Record<string, { color: string; label: string; icon: string }> = {
  doctor:  { color: 'var(--purple)', label: 'PHC Doctor',  icon: 'bi-heart-pulse-fill' },
  patient: { color: 'var(--blue)',   label: 'Patient',     icon: 'bi-person-fill' },
  asha:    { color: 'var(--teal)',   label: 'ASHA Worker', icon: 'bi-house-fill' },
  admin:   { color: 'var(--amber)',  label: 'Admin (NHM)', icon: 'bi-graph-up-arrow' },
};

interface AppLayoutProps {
  children: React.ReactNode;
  /** pass the active nav key to highlight */
  activeNav?: string;
}

export default function AppLayout({ children, activeNav }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Seed from localStorage so button shows instantly on every page navigation
  const [l2Referred, setL2Referred] = useState<boolean>(
    () => localStorage.getItem('vc_l2_referred') === 'true'
  );

  // For patients: poll L2 referral status every 30s + on tab focus
  useEffect(() => {
    if (user?.role !== 'patient') return;

    const check = () => {
      patientApi.getL2Status()
        .then(res => {
          const referred = !!(res.data as any)?.l2_referred;
          // Persist in localStorage so next mount shows button immediately
          localStorage.setItem('vc_l2_referred', referred ? 'true' : 'false');
          setL2Referred(referred);
        })
        .catch(() => {});
    };

    check(); // immediate check on mount
    const interval = setInterval(check, 15000); // poll every 15s
    window.addEventListener('focus', check);     // re-check on tab focus

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', check);
    };
  }, [user?.role]);

  // Clear cache on logout
  useEffect(() => {
    if (!user) localStorage.removeItem('vc_l2_referred');
  }, [user]);

  const role = user?.role ?? '';
  const navItems = NAV_CONFIG[role] ?? [];
  const meta = ROLE_META[role];

  // Derive active item from current path if not supplied
  const currentPath = location.pathname;

  return (
    <div className="al-root">
      {/* ════════ HEADER ════════ */}
      <header className="al-header">
        <div className="al-header-inner">
          {/* Logo — always navigates to landing */}
          <div className="al-logo" onClick={() => navigate('/')} title="Back to home">
            <div className="al-logo-icon">
              <i className="bi-lungs-fill" style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <span className="al-logo-text">Lung<span>Lens</span></span>
          </div>

          {/* Role badge */}
          {meta && (
            <div className="al-role-badge" style={{ color: meta.color, borderColor: `${meta.color}30`, background: `${meta.color}10` }}>
              <i className={meta.icon} />
              {meta.label}
            </div>
          )}

          {/* Right actions */}
          <div className="al-header-right">
            <ThemeToggleBtn />

            {/* L2 Portal button — shown in header for patients when referred */}
            {role === 'patient' && l2Referred && (
              <a
                href={L2_FRONTEND_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: '#8b5cf6',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                  border: '1px solid rgba(139,92,246,0.6)',
                  whiteSpace: 'nowrap',
                  animation: 'l2-pulse 2s ease-in-out infinite',
                }}
              >
                <i className="bi-microscope" style={{ fontSize: 13 }} />
                <span>L2 Portal</span>
                <i className="bi-box-arrow-up-right" style={{ fontSize: 10, opacity: 0.8 }} />
              </a>
            )}

            {/* Profile avatar */}
            <div
              className="al-avatar"
              onClick={() => navigate('/profile')}
              title={`${user?.full_name} — View profile`}
              style={meta ? { background: `linear-gradient(135deg, ${meta.color}, var(--blue))` } : {}}
            >
              {(user?.full_name || 'U')[0].toUpperCase()}
            </div>

            {/* Back to landing */}
            <button className="al-btn-ghost" onClick={() => navigate('/')} title="Landing page">
              <i className="bi-house-fill" />
              <span>Home</span>
            </button>

            {/* Logout */}
            <button className="al-btn-logout" onClick={logout} title="Logout">
              <i className="bi-box-arrow-right" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* ════════ TOP NAV BAR — doctor/asha/admin only ════════ */}
        {navItems.length > 0 && (
          <nav className="al-topnav">
            <div className="al-topnav-inner">
              {navItems.map(item => {
                const isActive = currentPath === item.path ||
                  (activeNav ? item.path.endsWith(activeNav) : false);
                return (
                  <button
                    key={item.path}
                    className={`al-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                    style={isActive && meta ? {
                      color: meta.color,
                      borderBottomColor: meta.color,
                      background: `${meta.color}0d`,
                    } : {}}
                  >
                    <i className={item.icon} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      {/* ════════ PAGE CONTENT ════════ */}
      <main className="al-main">
        {children}
      </main>

      {/* ════════ FOOTER ════════ */}
      <footer className="al-footer">
        <p>© 2026 LUNGLENS · AI-POWERED TB TRIAGE · 4 PORTALS · PATIENT · DOCTOR · ASHA · ADMIN</p>
      </footer>
    </div>
  );
}
