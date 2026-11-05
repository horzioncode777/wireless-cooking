import { useState } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";

export default function AdminLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
      <a href="#contenido-admin" className="sr-only focus:not-sr-only focus:p-4">Saltar al contenido administrativo</a>
      <AdminSidebar open={open} setOpen={setOpen} />

      <div className="lg:pl-72">
        <AdminHeader setOpen={setOpen} />

        <main id="contenido-admin" tabIndex={-1} className="min-w-0 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
