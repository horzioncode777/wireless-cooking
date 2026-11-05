import { NavLink } from "react-router-dom";
import Dialog from '../Dialog';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Store,
  BarChart3,
  Settings,
  X,
} from "lucide-react";

const menuItems = [
  { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { name: "Productos", path: "/admin/productos", icon: Package },
  { name: "Pedidos", path: "/admin/pedidos", icon: ShoppingCart },
  { name: "Usuarios", path: "/admin/usuarios", icon: Users },
  { name: "Vendedores", path: "/admin/vendedores", icon: Store },
  { name: "Reportes", path: "/admin/reportes", icon: BarChart3 },
  { name: "Atención PQR", path: "/admin/pqr", icon: Users },
  { name: "Postventa", path: "/admin/postventa", icon: Package },
  { name: "Monederos", path: "/admin/monederos", icon: Store },
  { name: "Configuración", path: "/admin/configuracion", icon: Settings },
];

export default function AdminSidebar({ open, setOpen }) {
  const content=(<aside
        aria-label="Navegación administrativa"
        className={`fixed left-0 top-0 z-40 h-screen w-72 transform border-r border-white/10 bg-[#111827] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "hidden lg:block lg:translate-x-0"
        }`}
      >
       <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
        <div className="flex items-center">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-18 w-auto object-contain ml-8"
          />
        </div>

        <button
          aria-label="Cerrar navegación administrativa" onClick={() => setOpen(false)}
          className="rounded-xl p-2 hover:bg-white/10 lg:hidden"
        >
          <X size={20} />
        </button>
      </div>

        <nav aria-label="Secciones de administración" className="flex flex-col gap-2 p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/admin"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                    ? "bg-amber-700 text-white shadow-lg"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`
                }
                onClick={() => setOpen(false)}
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>);
  return open?<Dialog label="Navegación administrativa" onClose={()=>setOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:contents">{content}</Dialog>:content;
}
