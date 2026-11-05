import Dialog from "../../components/Dialog";
import { imageUrl } from "../../services/api";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Users,
  Eye,
  X,
  User,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import {
  getAdminUsers,
  updateAdminUserStatus,
} from "../../services/adminUsers";

function formatDate(value) {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function normalizeText(value = "") {
  return String(value).toLowerCase().trim();
}

function prettifyRole(role = "") {
  const normalized = normalizeText(role);

  if (normalized === "comprador") return "Comprador";
  if (normalized === "vendedor") return "Vendedor";
  if (normalized === "admin") return "Administrador";

  return role || "Sin rol";
}

function prettifyStatus(status = "") {
  const normalized = normalizeText(status);

  if (!normalized) return "Sin estado";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getStatusClasses(status = "") {
  const normalized = normalizeText(status);

  if (normalized === "activo") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (normalized === "pendiente") {
    return "bg-amber-100 text-amber-700";
  }

  if (normalized === "inactivo") {
    return "bg-slate-200 text-slate-700";
  }

  if (normalized === "bloqueado") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function UserDetailModal({
  open,
  onClose,
  user,
  updating,
  onChangeStatus,
}) {
  const [statusOverride, setSelectedStatus] = useState(null);
  const selectedStatus = statusOverride ?? user?.estado ?? "activo";


  if (!open || !user) return null;

  return (
    <Dialog label="Detalle del usuario" onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Detalle del usuario
            </h2>
            <p className="text-sm text-slate-500">
              Información general y gestión de estado.
            </p>
          </div>

          <button aria-label="Cerrar diálogo"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex flex-col items-start gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center">
            <img loading="lazy"
              src={imageUrl(user.foto ||
                "https://ui-avatars.com/api/?name=Usuario&background=e5e7eb&color=64748b")}
              alt={user.nombre || "Usuario"}
              className="h-20 w-20 rounded-3xl object-cover"
            />

            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-800">
                {`${user.nombre || ""} ${user.apellido || ""}`.trim() || "Usuario"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {prettifyRole(user.rol)}
              </p>

              <div className="mt-3">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                    user.estado
                  )}`}
                >
                  {prettifyStatus(user.estado)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h3 className="text-base font-bold text-slate-800">
                Información personal
              </h3>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p className="flex items-center gap-2">
                  <User size={16} className="text-slate-400" />
                  <span>
                    <span className="font-semibold text-slate-700">ID:</span>{" "}
                    {user.id_usuario}
                  </span>
                </p>

                <p className="flex items-center gap-2">
                  <Mail size={16} className="text-slate-400" />
                  <span>{user.correo || "Sin correo"}</span>
                </p>

                <p className="flex items-center gap-2">
                  <Phone size={16} className="text-slate-400" />
                  <span>{user.telefono || "Sin teléfono"}</span>
                </p>

                <p className="flex items-center gap-2">
                  <MapPin size={16} className="text-slate-400" />
                  <span>{user.direccion || "Sin dirección"}</span>
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h3 className="text-base font-bold text-slate-800">
                Gestión del usuario
              </h3>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Rol
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {prettifyRole(user.rol)}
                  </div>
                </div>

                <div>
                  <label htmlFor="adminusers-field-1" className="mb-2 block text-sm font-semibold text-slate-700">
                    Estado
                  </label>
                  <select id="adminusers-field-1"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>

                <button
                  onClick={() => onChangeStatus(selectedStatus)}
                  disabled={updating}
                  className="rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {updating ? "Actualizando..." : "Guardar estado"}
                </button>

                <div className="text-sm text-slate-500">
                  Registrado: {formatDate(user.fecha_registro)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [updating, setUpdating] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getAdminUsers();
      const usersData = Array.isArray(response) ? response : response?.users || [];

      setUsers(usersData);
    } catch (err) {
      console.error("Error cargando usuarios admin:", err);
      setError("No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const query = normalizeText(search);

      const fullName = `${user.nombre || ""} ${user.apellido || ""}`.trim();

      const matchesSearch =
        normalizeText(fullName).includes(query) ||
        normalizeText(user.correo).includes(query) ||
        String(user.id_usuario || "").includes(query);

      const matchesRole =
        roleFilter === "Todos" ||
        normalizeText(user.rol) === normalizeText(roleFilter);

      const matchesStatus =
        statusFilter === "Todos" ||
        normalizeText(user.estado) === normalizeText(statusFilter);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleOpenDetail = (user) => {
    setSelectedUser(user);
    setDetailOpen(true);
  };

  const handleChangeStatus = async (estado) => {
    if (!selectedUser?.id_usuario) return;

    try {
      setUpdating(true);

      const response = await updateAdminUserStatus(selectedUser.id_usuario, estado);
      const updatedUser = response?.user;

      if (updatedUser) {
        setUsers((prev) =>
          prev.map((user) =>
            user.id_usuario === updatedUser.id_usuario
              ? { ...user, estado: updatedUser.estado }
              : user
          )
        );

        setSelectedUser((prev) =>
          prev ? { ...prev, estado: updatedUser.estado } : prev
        );
      } else {
        await loadUsers();
      }
    } catch (err) {
      console.error("Error actualizando estado del usuario:", err);

    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuarios</h1>
          <p className="mt-1 text-sm text-slate-500">
            Aquí se visualizarán y administrarán los usuarios registrados.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
          <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Search size={18} className="mr-3 text-slate-400" />
            <input aria-label="Buscar por nombre, correo o ID..."
              type="text"
              placeholder="Buscar por nombre, correo o ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <select aria-label="Filtrar por rol"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="Todos">Todos los roles</option>
            <option value="comprador">Comprador</option>
            <option value="vendedor">Vendedor</option>
            <option value="admin">Administrador</option>
          </select>

          <select aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="Todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="pendiente">Pendiente</option>
            <option value="bloqueado">Bloqueado</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-500">
                <th className="px-6 py-4 font-semibold">Usuario</th>
                <th className="px-6 py-4 font-semibold">Correo</th>
                <th className="px-6 py-4 font-semibold">Rol</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold">Registro</th>
                <th className="px-6 py-4 text-right font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-slate-500">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id_usuario} className="border-t border-slate-100">
                    <td className="px-6 py-4">
                      <div className="flex min-w-[240px] items-center gap-4">
                        <img loading="lazy"
                          src={imageUrl(user.foto ||
                            "https://ui-avatars.com/api/?name=Usuario&background=e5e7eb&color=64748b")}
                          alt={user.nombre || "Usuario"}
                          className="h-12 w-12 rounded-2xl object-cover"
                        />
                        <div>
                          <p className="font-semibold text-slate-800">
                            {`${user.nombre || ""} ${user.apellido || ""}`.trim() ||
                              "Usuario"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            ID: {user.id_usuario}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {user.correo || "Sin correo"}
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {prettifyRole(user.rol)}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                          user.estado
                        )}`}
                      >
                        {prettifyStatus(user.estado)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-500">
                      {formatDate(user.fecha_registro)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenDetail(user)}
                          className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                          title="Ver detalle"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-4 rounded-3xl bg-slate-100 p-4 text-slate-400">
                        <Users size={30} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">
                        No se encontraron usuarios
                      </h3>
                      <p className="mt-2 max-w-md text-sm text-slate-500">
                        Intenta cambiar la búsqueda o los filtros para encontrar resultados.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <UserDetailModal
        key={`${selectedUser?.id_usuario}-${selectedUser?.estado}-${selectedUser?.verificado}-${detailOpen}`}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        updating={updating}
        onChangeStatus={handleChangeStatus}
      />
    </div>
  );
}