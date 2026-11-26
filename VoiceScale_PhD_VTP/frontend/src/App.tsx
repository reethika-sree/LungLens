import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './components/ToastProvider';
import { ModalProvider } from './components/ModalProvider';
import { ProcessingProvider } from './components/ProcessingProvider';
import { PatientRoute, DoctorRoute, AdminRoute, AshaRoute } from './components/RouteGuard';

import LandingPage       from './pages/LandingPage';
import LoginPage         from './pages/auth/LoginPage';
import SignupPage        from './pages/auth/SignupPage';
import PatientLoginPage  from './pages/auth/PatientLoginPage';
import PatientSignupPage from './pages/auth/PatientSignupPage';
import UnauthorizedPage   from './pages/UnauthorizedPage';
import ProfilePage       from './pages/ProfilePage';
import UserManagementPage from './pages/UserManagementPage';

// Dashboards
import PatientDashboardPage from './pages/patient/PatientDashboardPage';
import DoctorDashboardPage  from './pages/doctor/DoctorDashboardPage';
import AdminDashboardPage   from './pages/admin/AdminDashboardPage';
import AshaDashboardPage    from './pages/asha/AshaDashboardPage';

// Patient Flow
import { PatientLanguagePage, PatientQuestionsPage, PatientModePage, PatientConfirmPage, PatientTicketPage } from './pages/patient/PatientPages';
import { PatientVoiceCapturePage } from './pages/patient/PatientVoiceCapturePage';
import PatientDynamicDialoguePage from './pages/patient/PatientDynamicDialoguePage';
import { PatientPredictionPage } from './pages/patient/PatientPredictionPage';
import { PatientChatPage } from './pages/patient/PatientChatPage';
import { PatientHistoryPage } from './pages/patient/PatientHistoryPage';
import { PatientProfilePage } from './pages/patient/PatientProfilePage';

// Doctor Flow
import { DoctorQueuePage, DoctorPatientDetailPage, DoctorShapPage, DoctorActionPage, DoctorTelePage } from './pages/doctor/DoctorPages';

// Admin Flow
import { AdminOverviewPage, AdminMapPage, AdminLogPage, AdminSettingsPage } from './pages/admin/AdminPages';

// ASHA Flow
import { AshaPatientListPage, AshaDailyCheckinPage, AshaRegisterPage, AshaVisitLogPage, AshaProfilePage } from './pages/asha/AshaPages';

import './styles/global.css';
import './pages/patient/PatientPages.css';
import './pages/doctor/DoctorPages.css';
import './pages/admin/AdminPages.css';
import './pages/asha/AshaPages.css';

function RoleRedirectWrapper({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only fire once on initial auth — never on re-renders
    if (!isLoading && !hasRedirected.current && isAuthenticated && user) {
      hasRedirected.current = true;
      const dest = user.role === 'patient' ? '/patient/dashboard'
                 : user.role === 'doctor'  ? '/doctor/dashboard'
                 : user.role === 'admin'   ? '/admin/dashboard'
                 : user.role === 'asha'    ? '/asha/dashboard'
                 : '/';
      // Only redirect if sitting on the root — don't hijack deep links
      if (window.location.pathname === '/') {
        navigate(dest, { replace: true });
      }
    }
  }, [isLoading, isAuthenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div className="vc-loading-screen">
      <div className="vc-spinner" />
      <p style={{ color:'var(--text3)', fontSize:14 }}>Loading LungLens…</p>
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  const getRoleRedirect = () => {
    if (!user) return '/login';
    return user.role === 'patient' ? '/patient/dashboard'
         : user.role === 'doctor'  ? '/doctor/dashboard'
         : user.role === 'admin'   ? '/admin/dashboard'
         : user.role === 'asha'    ? '/asha/dashboard'
         : '/';
  };

  return (
    <Routes>
      <Route path="/"             element={<LandingPage />} />
      <Route path="/login"        element={<LoginPage />} />
      <Route path="/signup"       element={<SignupPage />} />
      
      {/* Dedicated Patient Authentication Routes */}
      <Route path="/patient/login"  element={<PatientLoginPage />} />
      <Route path="/patient/signup" element={<PatientSignupPage />} />

      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/profile"      element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

      {/* Patient Routes */}
      <Route element={<PatientRoute />}>
        <Route path="/patient"               element={<Navigate to="/patient/dashboard" replace />} />
        <Route path="/patient/dashboard"     element={<PatientDashboardPage />} />
        <Route path="/patient/language"      element={<PatientLanguagePage />} />
        <Route path="/patient/voice-capture" element={<PatientVoiceCapturePage />} />
        <Route path="/patient/dialogue"      element={<PatientDynamicDialoguePage />} />
        <Route path="/patient/questions"     element={<PatientQuestionsPage />} />
        <Route path="/patient/prediction"    element={<PatientPredictionPage />} />
        <Route path="/patient/profile"       element={<PatientProfilePage />} />
        <Route path="/patient/mode"          element={<PatientModePage />} />
        <Route path="/patient/chat"          element={<PatientChatPage />} />
        <Route path="/patient/confirm"       element={<PatientConfirmPage />} />
        <Route path="/patient/ticket"        element={<PatientTicketPage />} />
        <Route path="/patient/history"       element={<PatientHistoryPage />} />
      </Route>

      {/* Doctor Routes */}
      <Route element={<DoctorRoute />}>
        <Route path="/doctor"           element={<Navigate to="/doctor/dashboard" replace />} />
        <Route path="/doctor/dashboard" element={<DoctorDashboardPage />} />
        <Route path="/doctor/queue"     element={<DoctorQueuePage />} />
        <Route path="/doctor/patient"   element={<DoctorPatientDetailPage />} />
        <Route path="/doctor/shap"      element={<DoctorShapPage />} />
        <Route path="/doctor/action"    element={<DoctorActionPage />} />
        <Route path="/doctor/tele"      element={<DoctorTelePage />} />
      </Route>

      {/* Admin Routes */}
      <Route element={<AdminRoute />}>
        <Route path="/admin"            element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard"  element={<AdminDashboardPage />} />
        <Route path="/admin/overview"   element={<AdminOverviewPage />} />
        <Route path="/admin/map"        element={<AdminMapPage />} />
        <Route path="/admin/log"        element={<AdminLogPage />} />
        <Route path="/admin/settings"   element={<AdminSettingsPage />} />
        <Route path="/user-management"  element={<UserManagementPage />} />
      </Route>

      {/* ASHA Worker Routes */}
      <Route path="/asha"           element={<AshaRoute><Navigate to="/asha/dashboard" replace /></AshaRoute>} />
      <Route path="/asha/dashboard" element={<AshaRoute><AshaDashboardPage /></AshaRoute>} />
      <Route path="/asha/patients"  element={<AshaRoute><AshaPatientListPage /></AshaRoute>} />
      <Route path="/asha/checkin"   element={<AshaRoute><AshaDailyCheckinPage /></AshaRoute>} />
      <Route path="/asha/register"  element={<AshaRoute><AshaRegisterPage /></AshaRoute>} />
      <Route path="/asha/visits"    element={<AshaRoute><AshaVisitLogPage /></AshaRoute>} />
      <Route path="/asha/profile"   element={<AshaRoute><AshaProfilePage /></AshaRoute>} />

      <Route path="*" element={<Navigate to={getRoleRedirect()} replace />} />
    </Routes>
  );
}

function SessionExpiredModal() {
  const { showSessionExpiredModal, setShowSessionExpiredModal } = useAuth();
  if (!showSessionExpiredModal) return null;
  return (
    <div className="vc-session-overlay">
      <div className="vc-session-modal">
        <h3><i className="bi-clock-history" style={{ color:'var(--amber)', marginRight:8 }} />Session Expired</h3>
        <p>Your session has expired. Please sign in again.</p>
        <button className="vc-btn vc-btn-teal" style={{ width:'100%' }}
          onClick={() => { setShowSessionExpiredModal(false); window.location.href = '/login'; }}>
          <i className="bi-box-arrow-in-right" /> Sign In Again
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  return (
    <RoleRedirectWrapper>
      <AppRoutes />
      <SessionExpiredModal />
    </RoleRedirectWrapper>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <ToastProvider>
              <ModalProvider>
                <ProcessingProvider>
                  <AppContent />
                </ProcessingProvider>
              </ModalProvider>
            </ToastProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
