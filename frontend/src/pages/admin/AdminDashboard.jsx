import { API_URL } from '../../services/apiConfig.js';
import { appFetch } from "../../services/notifications.js";
import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  Store,
  AlertTriangle,
} from "lucide-react";
import StatCard from "../../components/admin/StatCard";



const formatCurrency = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(number);
};

const formatDate = (dateString) => {
  if (!dateString) return "Sin fecha";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const normalizeStatus = (status = "") => String(status).toLowerCase().trim();

const getOrderStatusStyles = (status) => {
  const normalized = normalizeStatus(status);

  if (normalized === "pendiente") {
    return "bg-amber-100 text-amber-700";
  }

  if (normalized === "enviado") {
    return "bg-blue-100 text-blue-700";
  }

  if (normalized === "entregado" || normalized === "pagado") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (normalized === "cancelado" || normalized === "rechazado") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
};

const getUserStatusStyles = (status) => {
  const normalized = normalizeStatus(status);

  if (normalized === "activo") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (normalized === "pendiente") {
    return "bg-amber-100 text-amber-700";
  }

  if (normalized === "bloqueado" || normalized === "inactivo") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
};

const prettifyRole = (role = "") => {
  const normalized = String(role).toLowerCase().trim();

  if (normalized === "comprador") return "Comprador";
  if (normalized === "vendedor") return "Vendedor";
  if (normalized === "admin") return "Administrador";

  return role || "Sin rol";
};

const prettifyStatus = (status = "") => {
  const normalized = String(status).toLowerCase().trim();

  if (!normalized) return "Sin estado";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState({
    summary: {
      totalVentas: 0,
      productosActivos: 0,
      totalPedidos: 0,
      totalUsuarios: 0,
    },
    sellers: {
      activos: 0,
      pendientes: 0,
    },
    alerts: {
      stockBajo: 0,
      vendedoresPendientes: 0,
      pedidosPendientes: 0,
    },
    recentOrders: [],
    recentUsers: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = useMemo(() => localStorage.getItem("token"), []);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        if (!token) {
          throw new Error("No se encontró el token de sesión");
        }

        const response = await appFetch(`${API_URL}/api/admin/dashboard`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.message || "No se pudo cargar el dashboard");
        }

        setDashboard({
          summary: {
            totalVentas: Number(data.summary?.totalVentas || 0),
            productosActivos: Number(data.summary?.productosActivos || 0),
            totalPedidos: Number(data.summary?.totalPedidos || 0),
            totalUsuarios: Number(data.summary?.totalUsuarios || 0),
          },
          sellers: {
            activos: Number(data.sellers?.activos || 0),
            pendientes: Number(data.sellers?.pendientes || 0),
          },
          alerts: {
            stockBajo: Number(data.alerts?.stockBajo || 0),
            vendedoresPendientes: Number(data.alerts?.vendedoresPendientes || 0),
            pedidosPendientes: Number(data.alerts?.pedidosPendientes || 0),
          },
          recentOrders: Array.isArray(data.recentOrders) ? data.recentOrders : [],
          recentUsers: Array.isArray(data.recentUsers) ? data.recentUsers : [],
        });
      } catch (err) {
        console.error("Error cargando dashboard admin:", err);
        setError(err.message || "Error al cargar el dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-6">
        <section>
          <h1 className="text-2xl font-bold text-slate-800">Resumen general</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cargando información del panel administrativo...
          </p>
        </section>

        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm text-slate-500">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <section>
          <h1 className="text-2xl font-bold text-slate-800">Resumen general</h1>
          <p className="mt-1 text-sm text-slate-500">
            Vista global del comportamiento de la plataforma y de la tienda principal.
          </p>
        </section>

        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-red-700">No se pudo cargar el dashboard</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold text-slate-800">Resumen general</h1>
        <p className="mt-1 text-sm text-slate-500">
          Vista global del comportamiento de la plataforma y de la tienda principal.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Ventas totales"
          value={formatCurrency(dashboard.summary.totalVentas)}
          subtitle="Acumulado general de la plataforma"
          icon={DollarSign}
        />
        <StatCard
          title="Productos activos"
          value={String(dashboard.summary.productosActivos)}
          subtitle="Entre marca propia y vendedores"
          icon={Package}
        />
        <StatCard
          title="Pedidos"
          value={String(dashboard.summary.totalPedidos)}
          subtitle="Pedidos registrados en la plataforma"
          icon={ShoppingCart}
        />
        <StatCard
          title="Usuarios registrados"
          value={String(dashboard.summary.totalUsuarios)}
          subtitle="Usuarios registrados en el sistema"
          icon={Users}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Pedidos recientes</h2>
              <p className="text-sm text-slate-500">
                Últimos movimientos registrados en la plataforma
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-3 font-medium">Pedido</th>
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Vendedor</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Estado</th>
                  <th className="pb-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentOrders.length > 0 ? (
                  dashboard.recentOrders.map((order, index) => (
                    <tr
                      key={order.id_pedido || order.id || index}
                      className="border-b border-slate-100"
                    >
                      <td className="py-4 font-semibold text-slate-800">
                        #{order.id_pedido || order.id}
                      </td>
                      <td className="py-4 text-slate-600">
                        {order.customer || "Cliente"}
                      </td>
                      <td className="py-4 text-slate-600">
                        {order.seller || "Tienda principal"}
                      </td>
                      <td className="py-4 text-slate-600">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusStyles(
                            order.status
                          )}`}
                        >
                          {prettifyStatus(order.status)}
                        </span>
                      </td>
                      <td className="py-4 text-slate-500">
                        {formatDate(order.fecha_creacion)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-slate-500">
                      No hay pedidos recientes para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-purple-100 p-3 text-purple-600">
                <Store size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Vendedores activos</h3>
                <p className="text-sm text-slate-500">Marketplace operativo</p>
              </div>
            </div>

            <p className="text-3xl font-bold text-slate-800">
              {dashboard.sellers.activos}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {dashboard.sellers.pendientes} vendedores están pendientes de revisión.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-red-100 p-3 text-red-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Alertas</h3>
                <p className="text-sm text-slate-500">Atención administrativa</p>
              </div>
            </div>

            <ul className="space-y-3 text-sm text-slate-600">
              <li>{dashboard.alerts.stockBajo} productos con stock bajo</li>
              <li>{dashboard.alerts.vendedoresPendientes} vendedores pendientes de aprobación</li>
              <li>{dashboard.alerts.pedidosPendientes} pedidos requieren actualización de estado</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-800">Usuarios recientes</h2>
          <p className="text-sm text-slate-500">Nuevos registros en la plataforma</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {dashboard.recentUsers.length > 0 ? (
            dashboard.recentUsers.map((user, index) => (
              <div
                key={user.id_usuario || index}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <h3 className="font-semibold text-slate-800">
                  {`${user.nombre || ""} ${user.apellido || ""}`.trim() || "Usuario"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {prettifyRole(user.type || user.rol)}
                </p>
                <span
                  className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getUserStatusStyles(
                    user.status || user.estado
                  )}`}
                >
                  {prettifyStatus(user.status || user.estado)}
                </span>
              </div>
            ))
          ) : (
            <div className="md:col-span-3 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
              No hay usuarios recientes para mostrar.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}