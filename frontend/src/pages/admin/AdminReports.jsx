import { useEffect, useState } from "react";
import { BarChart3, Users, ShoppingCart, DollarSign } from "lucide-react";
import { getAdminReports } from "../../services/adminReports";

function formatPrice(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function AdminReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAdminReports();
        setData(res);
      } catch (err) {
        console.error("Error cargando reportes:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
    const timer=setInterval(load,30000);
    return ()=>clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-500">
        Cargando reportes...
      </div>
    );
  }

  if (!data) return <p role="alert" className="p-8 text-red-700">No se pudieron cargar los reportes. Revisa la conexión e intenta nuevamente.</p>;
  const { kpis, monthlySales, topProducts, topSellers } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Reportes</h1>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl bg-white p-5 shadow">
          <Users />
          <p className="mt-2 text-sm text-slate-500">Usuarios</p>
          <h3 className="text-xl font-bold">{kpis.total_usuarios}</h3>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow">
          <ShoppingCart />
          <p className="mt-2 text-sm text-slate-500">Pedidos</p>
          <h3 className="text-xl font-bold">{kpis.total_pedidos}</h3>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow">
          <BarChart3 />
          <p className="mt-2 text-sm text-slate-500">Vendedores</p>
          <h3 className="text-xl font-bold">{kpis.total_vendedores}</h3>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow">
          <DollarSign />
          <p className="mt-2 text-sm text-slate-500">Ingresos</p>
          <h3 className="text-xl font-bold">
            {formatPrice(kpis.total_ingresos)}
          </h3>
        </div>
      </div>

      {/* Ventas mensuales */}
      <div className="rounded-3xl bg-white p-6 shadow">
        <h2 className="text-lg font-bold mb-4">Ventas por mes</h2>
        {monthlySales.map((m, i) => (
          <div key={i} className="flex justify-between text-sm border-b py-2">
            <span>{new Date(m.mes).toLocaleDateString()}</span>
            <span>{formatPrice(m.total)}</span>
          </div>
        ))}
      </div>

      {/* Top productos */}
      <div className="rounded-3xl bg-white p-6 shadow">
        <h2 className="text-lg font-bold mb-4">Top productos</h2>
        {topProducts.map((p) => (
          <div key={p.id_producto} className="flex justify-between py-2 text-sm">
            <span>{p.nombre}</span>
            <span>{p.total_vendidos} vendidos</span>
          </div>
        ))}
      </div>

      {/* Top vendedores */}
      <div className="rounded-3xl bg-white p-6 shadow">
        <h2 className="text-lg font-bold mb-4">Top vendedores</h2>
        {topSellers.map((s) => (
          <div key={s.id_vendedor} className="flex justify-between py-2 text-sm">
            <span>{s.nombre_tienda}</span>
            <span>{formatPrice(s.ingresos)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}