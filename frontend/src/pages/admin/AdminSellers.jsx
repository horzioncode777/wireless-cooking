import Dialog from "../../components/Dialog";
import { imageUrl } from "../../services/api";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Store,
  Eye,
  X,
  Mail,
  Phone,
  MapPin,
  BadgeCheck,
  Package,
} from "lucide-react";
import {
  getAdminSellers,
  getAdminSellerById,
  updateSellerVerification,
  updateSellerUserStatus,
} from "../../services/adminSellers";

function formatDate(value) {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatPrice(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function normalizeText(value = "") {
  return String(value).toLowerCase().trim();
}

function prettifyStatus(status = "") {
  const normalized = normalizeText(status);

  if (!normalized) return "Sin estado";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getUserStatusClasses(status = "") {
  const normalized = normalizeText(status);

  if (normalized === "activo") return "bg-emerald-100 text-emerald-700";
  if (normalized === "pendiente") return "bg-amber-100 text-amber-700";
  if (normalized === "bloqueado") return "bg-red-100 text-red-700";
  if (normalized === "inactivo") return "bg-slate-200 text-slate-700";

  return "bg-slate-100 text-slate-700";
}

function getVerificationClasses(verificado) {
  return verificado
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";
}

function SellerDetailModal({
  open,
  onClose,
  seller,
  products,
  loading,
  updatingVerification,
  updatingStatus,
  onChangeVerification,
  onChangeUserStatus,
}) {
  const [statusOverride, setSelectedStatus] = useState(null);
  const selectedStatus = statusOverride ?? seller?.estado ?? "activo";
  const [verificationOverride, setSelectedVerification] = useState(null);
  const selectedVerification = verificationOverride ?? Boolean(seller?.verificado);


  if (!open) return null;

  return (
    <Dialog label="Detalle del vendedor" onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Detalle del vendedor
            </h2>
            <p className="text-sm text-slate-500">
              Gestión completa del vendedor del marketplace.
            </p>
          </div>

          <button aria-label="Cerrar diálogo"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            Cargando detalle del vendedor...
          </div>
        ) : seller ? (
          <div className="space-y-6 p-6">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className="h-40 w-full bg-slate-100">
                <img loading="lazy"
                  src={imageUrl(seller.banner_url ||
                    "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80")}
                  alt={seller.nombre_tienda || "Banner"}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center">
                <img loading="lazy"
                  src={imageUrl(seller.logo ||
                    seller.foto ||
                    "https://ui-avatars.com/api/?name=Tienda&background=e5e7eb&color=64748b")}
                  alt={seller.nombre_tienda || "Tienda"}
                  className="-mt-16 h-24 w-24 rounded-3xl border-4 border-white object-cover shadow-md"
                />

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-bold text-slate-800">
                      {seller.nombre_tienda || "Sin nombre de tienda"}
                    </h3>

                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getVerificationClasses(
                        seller.verificado
                      )}`}
                    >
                      {seller.verificado ? "Verificado" : "Pendiente"}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    {`${seller.nombre || ""} ${seller.apellido || ""}`.trim() ||
                      "Vendedor"}
                  </p>

                  <p className="mt-3 max-w-3xl text-sm text-slate-600">
                    {seller.descripcion || "Este vendedor no tiene descripción."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-bold text-slate-800">
                  Información de contacto
                </h3>

                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <p className="flex items-center gap-2">
                    <Mail size={16} className="text-slate-400" />
                    <span>{seller.correo || "Sin correo"}</span>
                  </p>

                  <p className="flex items-center gap-2">
                    <Phone size={16} className="text-slate-400" />
                    <span>{seller.telefono || "Sin teléfono"}</span>
                  </p>

                  <p className="flex items-center gap-2">
                    <MapPin size={16} className="text-slate-400" />
                    <span>{seller.direccion || "Sin dirección"}</span>
                  </p>

                  <p>
                    <span className="font-semibold text-slate-700">
                      Calificación:
                    </span>{" "}
                    {Number(seller.calificacion || 0).toFixed(1)}
                  </p>

                  <p>
                    <span className="font-semibold text-slate-700">
                      Reseñas:
                    </span>{" "}
                    {seller.total_resenas || 0}
                  </p>

                  <p>
                    <span className="font-semibold text-slate-700">
                      Fecha de registro:
                    </span>{" "}
                    {formatDate(seller.fecha_creacion)}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-bold text-slate-800">
                  Gestión del vendedor
                </h3>

                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="adminsellers-field-1" className="mb-2 block text-sm font-semibold text-slate-700">
                      Verificación de tienda
                    </label>
                    <select id="adminsellers-field-1"
                      value={selectedVerification ? "true" : "false"}
                      onChange={(e) =>
                        setSelectedVerification(e.target.value === "true")
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
                    >
                      <option value="false">Pendiente</option>
                      <option value="true">Verificado</option>
                    </select>

                    <button
                      onClick={() => onChangeVerification(selectedVerification)}
                      disabled={updatingVerification}
                      className="mt-3 rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {updatingVerification
                        ? "Actualizando..."
                        : "Guardar verificación"}
                    </button>
                  </div>

                  <div>
                    <label htmlFor="adminsellers-field-2" className="mb-2 block text-sm font-semibold text-slate-700">
                      Estado del usuario
                    </label>
                    <select id="adminsellers-field-2"
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="bloqueado">Bloqueado</option>
                    </select>

                    <button
                      onClick={() => onChangeUserStatus(selectedStatus)}
                      disabled={updatingStatus}
                      className="mt-3 rounded-2xl bg-slate-800 px-5 py-3 font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {updatingStatus ? "Actualizando..." : "Guardar estado"}
                    </button>
                  </div>

                  <div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getUserStatusClasses(
                        seller.estado
                      )}`}
                    >
                      {prettifyStatus(seller.estado)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h3 className="text-base font-bold text-slate-800">
                Productos del vendedor
              </h3>

              {products.length > 0 ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => (
                    <div
                      key={product.id_producto}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <img loading="lazy"
                        src={imageUrl(product.imagen ||
                          "https://ui-avatars.com/api/?name=Producto&background=e5e7eb&color=64748b")}
                        alt={product.nombre || "Producto"}
                        className="h-40 w-full rounded-2xl object-cover"
                      />

                      <h4 className="mt-3 font-semibold text-slate-800">
                        {product.nombre}
                      </h4>

                      <p className="mt-1 text-sm text-slate-500">
                        {formatPrice(product.precio)}
                      </p>

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-700">
                          Stock: {product.stock}
                        </span>
                        <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">
                          {product.estado}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                  Este vendedor no tiene productos registrados.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">
            No se encontró la información del vendedor.
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default function AdminSellers() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [updatingVerification, setUpdatingVerification] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadSellers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getAdminSellers();
      setSellers(Array.isArray(response) ? response : response?.sellers || []);
    } catch (err) {
      console.error("Error cargando vendedores admin:", err);
      setError("No se pudieron cargar los vendedores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSellers();
  }, []);

  const filteredSellers = useMemo(() => {
    return sellers.filter((seller) => {
      const query = normalizeText(search);

      const fullName = `${seller.nombre || ""} ${seller.apellido || ""}`.trim();

      const matchesSearch =
        normalizeText(seller.nombre_tienda).includes(query) ||
        normalizeText(fullName).includes(query) ||
        normalizeText(seller.correo).includes(query) ||
        String(seller.id_vendedor || "").includes(query);

      const matchesVerification =
        verificationFilter === "Todos" ||
        String(Boolean(seller.verificado)) === verificationFilter;

      const matchesStatus =
        statusFilter === "Todos" ||
        normalizeText(seller.estado) === normalizeText(statusFilter);

      return matchesSearch && matchesVerification && matchesStatus;
    });
  }, [sellers, search, verificationFilter, statusFilter]);

  const handleOpenDetail = async (sellerId) => {
    try {
      setDetailOpen(true);
      setDetailLoading(true);
      setSelectedSeller(null);
      setSelectedProducts([]);

      const response = await getAdminSellerById(sellerId);

      setSelectedSeller(response?.seller || null);
      setSelectedProducts(Array.isArray(response?.products) ? response.products : []);
    } catch (err) {
      console.error("Error cargando detalle del vendedor:", err);

      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleChangeVerification = async (verificado) => {
    if (!selectedSeller?.id_vendedor) return;

    try {
      setUpdatingVerification(true);

      await updateSellerVerification(selectedSeller.id_vendedor, verificado);

      const refreshed = await getAdminSellerById(selectedSeller.id_vendedor);
      setSelectedSeller(refreshed?.seller || null);
      setSelectedProducts(Array.isArray(refreshed?.products) ? refreshed.products : []);

      await loadSellers();
    } catch (err) {
      console.error("Error actualizando verificación:", err);

    } finally {
      setUpdatingVerification(false);
    }
  };

  const handleChangeUserStatus = async (estado) => {
    if (!selectedSeller?.id_vendedor) return;

    try {
      setUpdatingStatus(true);

      await updateSellerUserStatus(selectedSeller.id_vendedor, estado);

      const refreshed = await getAdminSellerById(selectedSeller.id_vendedor);
      setSelectedSeller(refreshed?.seller || null);
      setSelectedProducts(Array.isArray(refreshed?.products) ? refreshed.products : []);

      await loadSellers();
    } catch (err) {
      console.error("Error actualizando estado vendedor:", err);

    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Vendedores</h1>
          <p className="mt-1 text-sm text-slate-500">
            Aquí se gestionarán los vendedores del marketplace.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
          <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Search size={18} className="mr-3 text-slate-400" />
            <input aria-label="Buscar por tienda, vendedor, correo o ID..."
              type="text"
              placeholder="Buscar por tienda, vendedor, correo o ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <select aria-label="Filtrar por verificación del comerciante"
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="Todos">Todas las verificaciones</option>
            <option value="true">Verificados</option>
            <option value="false">Pendientes</option>
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
                <th className="px-6 py-4 font-semibold">Tienda</th>
                <th className="px-6 py-4 font-semibold">Vendedor</th>
                <th className="px-6 py-4 font-semibold">Correo</th>
                <th className="px-6 py-4 font-semibold">Verificación</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold">Calificación</th>
                <th className="px-6 py-4 text-right font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-500">
                    Cargando vendedores...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : filteredSellers.length > 0 ? (
                filteredSellers.map((seller) => (
                  <tr key={seller.id_vendedor} className="border-t border-slate-100">
                    <td className="px-6 py-4">
                      <div className="flex min-w-[260px] items-center gap-4">
                        <img loading="lazy"
                          src={imageUrl(seller.logo ||
                            seller.foto ||
                            "https://ui-avatars.com/api/?name=Tienda&background=e5e7eb&color=64748b")}
                          alt={seller.nombre_tienda || "Tienda"}
                          className="h-12 w-12 rounded-2xl object-cover"
                        />
                        <div>
                          <p className="font-semibold text-slate-800">
                            {seller.nombre_tienda || "Sin nombre"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            ID: {seller.id_vendedor}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {`${seller.nombre || ""} ${seller.apellido || ""}`.trim() ||
                        "Vendedor"}
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {seller.correo || "Sin correo"}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getVerificationClasses(
                          seller.verificado
                        )}`}
                      >
                        {seller.verificado ? "Verificado" : "Pendiente"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getUserStatusClasses(
                          seller.estado
                        )}`}
                      >
                        {prettifyStatus(seller.estado)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {Number(seller.calificacion || 0).toFixed(1)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenDetail(seller.id_vendedor)}
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
                  <td colSpan="7" className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-4 rounded-3xl bg-slate-100 p-4 text-slate-400">
                        <Store size={30} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">
                        No se encontraron vendedores
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

      <SellerDetailModal
        key={`${selectedSeller?.id_vendedor}-${selectedSeller?.estado}-${selectedSeller?.verificado}-${detailOpen}`}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedSeller(null);
          setSelectedProducts([]);
        }}
        seller={selectedSeller}
        products={selectedProducts}
        loading={detailLoading}
        updatingVerification={updatingVerification}
        updatingStatus={updatingStatus}
        onChangeVerification={handleChangeVerification}
        onChangeUserStatus={handleChangeUserStatus}
      />
    </div>
  );
}
