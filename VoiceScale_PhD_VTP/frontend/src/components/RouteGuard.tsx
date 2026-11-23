import { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// ─────────────────────────────────────────────────────────────
// Base guard — supports BOTH usage patterns:
//   1. <RouteGuard requiredRole="patient" />        ← nested <Route> pattern (Outlet)
//   2. <RouteGuard requiredRole="patient"><X /></RouteGuard>  ← inline children
// ─────────────────────────────────────────────────────────────
interface RouteGuardProps {
  children?: ReactNode;       // optional now — Outlet used when absent
  requiredRole: string;
  fallbackPath?: string;
}

export function RouteGuard({ children, requiredRole, fallbackPath = '/unauthorized' }: RouteGuardProps) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user?.role !== requiredRole) return <Navigate to={fallbackPath} replace />;
  return <>{children ?? <Outlet />}</>;   // ✅ Outlet when no children passed
}

// ─────────────────────────────────────────────────────────────
// Role-specific guards — children optional for same reason
// ─────────────────────────────────────────────────────────────
export function PatientRoute({ children }: { children?: ReactNode }) {
  return <RouteGuard requiredRole="patient">{children}</RouteGuard>;
}
export function DoctorRoute({ children }: { children?: ReactNode }) {
  return <RouteGuard requiredRole="doctor">{children}</RouteGuard>;
}
export function AdminRoute({ children }: { children?: ReactNode }) {
  return <RouteGuard requiredRole="admin">{children}</RouteGuard>;
}
export function AshaRoute({ children }: { children?: ReactNode }) {
  return <RouteGuard requiredRole="asha">{children}</RouteGuard>;
}

// ─────────────────────────────────────────────────────────────
// Multi-role guard — children optional
// ─────────────────────────────────────────────────────────────
export function MultiRoleRoute({ children, allowedRoles, fallbackPath = '/unauthorized' }: {
  children?: ReactNode;
  allowedRoles: string[];
  fallbackPath?: string;
}) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!user || !allowedRoles.includes(user.role)) return <Navigate to={fallbackPath} replace />;
  return <>{children ?? <Outlet />}</>;   // ✅ Outlet when no children passed
}