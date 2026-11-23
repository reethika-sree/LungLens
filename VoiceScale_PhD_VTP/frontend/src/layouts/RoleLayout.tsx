import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggleBtn } from '../contexts/ThemeContext';
import { patientApi, L2_FRONTEND_URL } from '../api/client';
import './RoleLayout.css';

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: string;
  badge?: string;
}

const ROLE_NAV: Record<string, { section: string; items: NavItem[] }[]> = {
  patient: [
    {
      section: 'My Health Portal',
      items: [
        { key: 'dashboard', label: 'Patient Dashboard', path: '/patient/dashboard', icon: 'bi-grid-1x2-fill' },
        { key: 'screening', label: 'Voice NLP Screening', path: '/patient/language', icon: 'bi-mic-fill' },
        { key: 'dialogue',  label: 'Dynamic AI Intake',  path: '/patient/dialogue', icon: 'bi-chat-dots-fill' },
        { key: 'prediction', label: 'TB Risk Assessment', path: '/patient/prediction', icon: 'bi-cpu-fill' },
        { key: 'history',   label: 'Consultation Records', path: '/patient/history', icon: 'bi-folder2-open' },
        { key: 'profile',   label: 'Health Profile',     path: '/patient/profile', icon: 'bi-person-badge-fill' },
      ]
    }
  ],
  doctor: [
    {
      section: 'Clinical Care',
      items: [
        { key: 'dashboard', label: 'Doctor Dashboard', path: '/doctor/dashboard', icon: 'bi-speedometer2' },
        { key: 'queue',     label: 'Patient Triage Queue', path: '/doctor/queue', icon: 'bi-person-lines-fill' },
        { key: 'shap',      label: 'SHAP Explainability', path: '/doctor/shap', icon: 'bi-diagram-3-fill' },
        { key: 'action',    label: 'Clinical Orders', path: '/doctor/action', icon: 'bi-clipboard2-pulse-fill' },
        { key: 'tele',      label: 'Teleconsultation', path: '/doctor/tele', icon: 'bi-camera-video-fill' },
      ]
    }
  ],
  admin: [
    {
      section: 'Program Oversight',
      items: [
        { key: 'dashboard', label: 'Program Dashboard', path: '/admin/dashboard', icon: 'bi-grid-fill' },
        { key: 'overview',  label: 'District Analytics', path: '/admin/overview', icon: 'bi-graph-up' },
        { key: 'map',       label: 'TB Hotspot Map', path: '/admin/map', icon: 'bi-map-fill' },
        { key: 'users',     label: 'User Management', path: '/user-management', icon: 'bi-people-fill' },
        { key: 'logs',      label: 'System Audit Logs', path: '/admin/log', icon: 'bi-journal-code' },
        { key: 'settings',  label: 'ABDM Settings', path: '/admin/settings', icon: 'bi-sliders2' },
      ]
    }
  ],
  asha: [
    {
      section: 'Community Health',
      items: [
        { key: 'dashboard', label: 'ASHA Dashboard', path: '/asha/dashboard', icon: 'bi-house-heart-fill' },
        { key: 'patients',  label: 'Village Patients', path: '/asha/patients', icon: 'bi-people-fill' },
        { key: 'checkin',   label: 'Daily DOTS Check-in', path: '/asha/checkin', icon: 'bi-check-circle-fill' },
        { key: 'register',  label: 'Register Patient', path: '/asha/register', icon: 'bi-person-plus-fill' },
        { key: 'visits',    label: 'Home Visit Logs', path: '/asha/visits', icon: 'bi-journal-medical' },
      ]
    }
  ]
};

const ROLE_META: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  patient: { label: 'Patient Portal', color: 'var(--teal)', icon: 'bi-person-fill', bg: 'rgba(0,232,181,0.1)' },
  doctor:  { label: 'PHC Doctor',    color: 'var(--purple)', icon: 'bi-heart-pulse-fill', bg: 'rgba(184,164,255,0.1)' },
  admin:   { label: 'Admin (NHM)',   color: 'var(--amber)',  icon: 'bi-shield-check', bg: 'rgba(247,187,74,0.1)' },
  asha:    { label: 'ASHA Worker',   color: 'var(--blue)',   icon: 'bi-house-fill', bg: 'rgba(110,184,255,0.1)' },
};

interface RoleLayoutProps {
  children: React.ReactNode;
  activeNav?: string;
  pageTitle?: string;
}

export default function RoleLayout({ children, activeNav, pageTitle }: RoleLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [l2Referred, setL2Referred] = useState<boolean>(() => localStorage.getItem('vc_l2_referred') === 'true');

  const role = user?.role || 'patient';
  const roleInfo = ROLE_META[role] || ROLE_META['patient'];
  const sections = ROLE_NAV[role] || ROLE_NAV['patient'];

  // Check L2 status for patients
  useEffect(() => {
    if (role !== 'patient') return;
    patientApi.getL2Status()
      .then(res => {
        const referred = !!(res.data as any)?.l2_referred;
        localStorage.setItem('vc_l2_referred', referred ? 'true' : 'false');
        setL2Referred(referred);
      })
      .catch(() => {});
  }, [role]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="rl-shell">
      {/* Mobile Backdrop */}
      <div
        className={`rl-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── SIDEBAR ── */}
      <aside className={`rl-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="rl-sidebar-brand" onClick={() => navigate(`/${role}/dashboard`)}>
          <div className="rl-brand-icon">
            <i className="bi-lungs-fill" style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <div>
            <div className="rl-brand-title">Voice<span>Care</span> PHC</div>
            <div className="rl-brand-sub">TB Detection & Triage</div>
          </div>
        </div>

        {/* Role Badge */}
        <div
          className="rl-role-pill"
          style={{
            borderColor: `${roleInfo.color}40`,
            background: roleInfo.bg,
            color: roleInfo.color
          }}
        >
          <i className={roleInfo.icon} />
          <span>{roleInfo.label}</span>
        </div>

        {/* Navigation */}
        <nav className="rl-nav">
          {sections.map(sec => (
            <div key={sec.section}>
              <div className="rl-nav-heading">{sec.section}</div>
              {sec.items.map(item => {
                const isActive = activeNav
                  ? activeNav === item.key
                  : location.pathname === item.path || (item.path !== `/${role}/dashboard` && location.pathname.startsWith(item.path));

                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    className={`rl-nav-link ${isActive ? 'active' : ''}`}
                  >
                    <span className="rl-nav-icon">
                      <i className={item.icon} />
                    </span>
                    <span>{item.label}</span>
                    {item.badge && <span className="rl-nav-badge">{item.badge}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="rl-sidebar-footer">
          <div className="rl-user-card">
            <div
              className="rl-avatar"
              style={{ background: `linear-gradient(135deg, ${roleInfo.color}, var(--blue))` }}
            >
              {(user?.full_name || 'U')[0].toUpperCase()}
            </div>
            <div className="rl-user-info">
              <div className="rl-user-name" title={user?.full_name || 'User'}>
                {user?.full_name || 'Healthcare User'}
              </div>
              <div className="rl-user-role">{roleInfo.label}</div>
            </div>
          </div>
          <button className="rl-btn-logout" onClick={handleLogout} title="Sign Out">
            <i className="bi-box-arrow-right" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="rl-main">
        {/* Topbar */}
        <header className="rl-topbar">
          <div className="rl-topbar-left">
            <button
              className="rl-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <i className="bi-list" />
            </button>
            <div className="rl-page-heading">
              <i className={roleInfo.icon} style={{ color: roleInfo.color }} />
              <span>{pageTitle || roleInfo.label}</span>
            </div>
          </div>

          <div className="rl-topbar-right">
            {role === 'patient' && l2Referred && (
              <a
                href={L2_FRONTEND_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 6,
                  background: 'var(--purple)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                <i className="bi-microscope" />
                <span>L2 Referral Lab</span>
                <i className="bi-box-arrow-up-right" style={{ fontSize: 10, opacity: 0.8 }} />
              </a>
            )}

            <ThemeToggleBtn />

            <div
              className="rl-avatar"
              onClick={() => navigate(role === 'patient' ? '/patient/profile' : '/profile')}
              title="View Profile"
              style={{
                cursor: 'pointer',
                width: 32,
                height: 32,
                fontSize: 13,
                background: `linear-gradient(135deg, ${roleInfo.color}, var(--blue))`
              }}
            >
              {(user?.full_name || 'U')[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="rl-content">
          {children}
        </main>
      </div>
    </div>
  );
}
