import { imageUrl } from "../../services/api";
import { Menu, Search, LogOut } from "lucide-react";
import NotificationBell from '../NotificationBell';
import { useNavigate } from "react-router-dom";
import { useState } from 'react';

export default function AdminHeader({ setOpen }) {
  const navigate = useNavigate();
  const [search,setSearch]=useState('');

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const name = user?.nombre || user?.name || "Administrador";
  const avatar =
    user?.foto ||
    user?.avatar ||
    "https://ui-avatars.com/api/?name=Admin&background=f59e0b&color=fff";

  const handleLogout = () => {
    // limpiar sesión
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // redirigir
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:gap-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          aria-label="Abrir navegación administrativa" onClick={() => setOpen(true)}
          className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div>
          <h2 className="text-base font-bold text-slate-800 md:text-2xl">
            Panel Administrativo
          </h2>
          <p className="hidden text-sm text-slate-500 sm:block">
            Control total de la plataforma
          </p>
        </div>
      </div>

      <form role="search" onSubmit={event=>{event.preventDefault();navigate(`/admin/productos?q=${encodeURIComponent(search.trim())}`);}} className="hidden max-w-xl flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:flex">
        <input aria-label="Buscar productos en administración" value={search} onChange={event=>setSearch(event.target.value)}
          type="text"
          placeholder="Buscar productos..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        <button type="submit" aria-label="Buscar productos" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100"><Search size={18}/></button>
      </form>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <NotificationBell/>

        <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-sm sm:gap-3 sm:px-3">
          <img
            src={imageUrl(avatar)}
            alt="Admin"
            className="hidden h-10 w-10 rounded-full object-cover sm:block"
          />

          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold text-slate-800">{name}</p>
            <p className="text-xs text-slate-500">Administrador</p>
          </div>

          {/* BOTÓN LOGOUT */}
          <button
            aria-label="Cerrar sesión" onClick={handleLogout}
            className="flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-xl px-2 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 sm:ml-2 sm:px-3"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
