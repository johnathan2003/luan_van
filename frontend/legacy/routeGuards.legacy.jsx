import { Navigate, Outlet } from "react-router-dom";
import useAuthStore from "./store/authStore";

// ─── Guards ────────────────────────────────────────────────
export function RequireAuth() {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

export function RequireRole({ roles }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!roles.includes(user?.role)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}

export function GuestOnly() {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Outlet />;
  // Redirect theo role
  const redirectMap = {
    buyer: "/",
    seller: "/seller/dashboard",
    shipper: "/shipper/deliveries",
    admin: "/admin/overview",
  };
  return <Navigate to={redirectMap[user?.role] || "/"} replace />;
}
