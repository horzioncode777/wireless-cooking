import { Navigate, Outlet } from "react-router-dom";
import { readUser } from '../services/api';

export default function AdminRoute() {
  const token = localStorage.getItem("token");
  const user = readUser();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const role = user?.rol || user?.role || user?.tipo_usuario;

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
