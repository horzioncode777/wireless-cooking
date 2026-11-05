import { API_URL } from '../services/apiConfig.js';
import { appFetch } from "../services/notifications.js";
import { Link } from "react-router-dom";
import Dialog from "../components/Dialog";
import { imageUrl,formatPrice,readUser } from "../services/api";
import { formatRegistrationDate } from '../services/profile';
import { orderDate } from '../services/orders';
import { OrderStatus } from '../components/OrderTracking';
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  User,
  Mail,
  MapPin,
  Package,
  CreditCard,
  Settings,
  ShoppingBag,
  Heart,
  BadgeCheck,
  Phone,
  Camera,
  Save,
  X,
  Upload,
} from "lucide-react";
import MainLayout from "../components/layout/MainLayout";



export default function Profile() {
  const savedUser = readUser();
  const token = localStorage.getItem("token");

  const [user, setUser] = useState({
    id_usuario: savedUser?.id_usuario || null,
    nombre: savedUser?.nombre || "Usuario",
    apellido: savedUser?.apellido || "",
    correo: savedUser?.correo || "",
    telefono: savedUser?.telefono || "",
    direccion: savedUser?.direccion || "",
    foto: savedUser?.foto || "",
    fecha_registro: savedUser?.fecha_registro || null,
  });

  const [orders, setOrders] = useState([]);
  const [favoritesCount,setFavoritesCount] = useState(null);
  const [orderSummary,setOrderSummary] = useState(null);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [profileError, setProfileError] = useState("");
  const [ordersError, setOrdersError] = useState("");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const [editForm, setEditForm] = useState({
    nombre: "",
    apellido: "",
    correo: "",
    telefono: "",
    direccion: "",
  });

  const synchronizeProfile = useEffectEvent((silent=false) => {
    fetchProfile(silent);
    fetchOrders(silent);
  });
  useEffect(() => {
    synchronizeProfile();
    const refresh=()=>synchronizeProfile(true);
    window.addEventListener('focus',refresh);
    window.addEventListener('online',refresh);
    const timer=setInterval(refresh,30000);
    return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);clearInterval(timer);};
  }, []);

  const fullName = useMemo(() => {
    return `${user.nombre || ""} ${user.apellido || ""}`.trim() || "Usuario";
  }, [user.nombre, user.apellido]);

  const memberSince = formatRegistrationDate(user.fecha_registro);

  const fetchProfile = async (silent=false) => {
    try {
      if(!silent)setLoadingProfile(true);
      setProfileError("");

      const response = await appFetch(`${API_URL}/api/user/profile`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("No se pudo cargar el perfil");
      }

      const data = await response.json();
      const backendUser = data.user || {};

      const mergedUser = {
        rol: backendUser.rol ?? savedUser?.rol ?? "comprador",
        id_usuario: backendUser.id_usuario ?? user.id_usuario,
        nombre: backendUser.nombre ?? user.nombre,
        apellido: backendUser.apellido ?? user.apellido,
        correo: backendUser.correo ?? user.correo,
        telefono: backendUser.telefono ?? user.telefono,
        direccion: backendUser.direccion ?? user.direccion,
        foto: backendUser.foto ?? user.foto,
        fecha_registro: backendUser.fecha_registro || null,
      };

      setUser(mergedUser);
      setFavoritesCount(Number.isInteger(data.summary?.favorites)?data.summary.favorites:null);
      localStorage.setItem("user", JSON.stringify(mergedUser));
    } catch (error) {
      console.error("fetchProfile error:", error);
      setProfileError(
        "No se pudo cargar el perfil desde la base de datos. Mostrando datos locales."
      );
      setFavoritesCount(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchOrders = async (silent=false) => {
    try {
      if(!silent)setLoadingOrders(true);
      setOrdersError("");

      const response = await appFetch(`${API_URL}/api/orders`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("No se pudieron cargar los pedidos");
      }

      const data = await response.json();
      setOrders((data.orders || []).slice(0,3));
      setOrderSummary(data.summary||null);
    } catch (error) {
      console.error("fetchOrders error:", error);
      setOrdersError(
        "No se pudieron cargar los pedidos desde la base de datos."
      );
      setOrders([]);
      setOrderSummary(null);
    } finally {
      setLoadingOrders(false);
    }
  };

  const openEditModal = () => {
    setEditError("");
    setEditSuccess("");
    setSelectedPhoto(null);
    setEditForm({
      nombre: user.nombre || "",
      apellido: user.apellido || "",
      correo: user.correo || "",
      telefono: user.telefono || "",
      direccion: user.direccion || "",
    });
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditError("");
    setEditSuccess("");
    setSelectedPhoto(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedPhoto(file);
  };

  const handleUploadPhoto = async () => {
    if (!selectedPhoto) {
      setEditError("Selecciona una imagen para subir.");
      return;
    }

    try {
      setIsUploadingPhoto(true);
      setEditError("");
      setEditSuccess("");

      const formData = new FormData();
      formData.append("photo", selectedPhoto);

      const response = await appFetch(`${API_URL}/api/user/profile/photo`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setEditError(data.message || "No se pudo subir la foto.");
        return;
      }

      const updatedUser = {
        ...user,
        ...data.user,
      };

      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setEditSuccess("Foto de perfil actualizada correctamente.");
      setSelectedPhoto(null);
    } catch (error) {
      console.error("handleUploadPhoto error:", error);
      setEditError("No se pudo conectar con el servidor al subir la foto.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    if (!editForm.nombre.trim()) {
      setEditError("El nombre es obligatorio.");
      return;
    }

    if (!editForm.correo.trim()) {
      setEditError("El correo es obligatorio.");
      return;
    }

    try {
      setIsSaving(true);
      setEditError("");
      setEditSuccess("");

      const response = await appFetch(`${API_URL}/api/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre: editForm.nombre.trim(),
          apellido: editForm.apellido.trim(),
          correo: editForm.correo.trim(),
          telefono: editForm.telefono.trim(),
          direccion: editForm.direccion.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setEditError(data.message || "No se pudo actualizar el perfil.");
        return;
      }

      const updatedUser = {
        ...user,
        ...data.user,
      };

      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setEditSuccess("Perfil actualizado correctamente.");
      setTimeout(() => {
        setIsEditOpen(false);
      }, 800);
    } catch (error) {
      console.error("handleSaveProfile error:", error);
      setEditError("No se pudo conectar con el servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const stats = [
    {
      title: "Pedidos",
      value: loadingOrders ? "..." : orderSummary ? String(orderSummary.total) : "—",
      to: "/mis-pedidos",
      icon: <ShoppingBag size={20} />,
    },
    {
      title: "Favoritos",
      value: loadingProfile ? "..." : favoritesCount===null ? "—" : String(favoritesCount),
      to: "/favoritos",
      icon: <Heart size={20} />,
    },
    {
      title: "Entregados",
      value: loadingOrders ? "..." : orderSummary ? String(orderSummary.entregados) : "—",
      to: "/mis-pedidos",
      icon: <BadgeCheck size={20} />,
    },
  ];

  return (
    <MainLayout>
      <section className="min-h-[calc(100vh-160px)] bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
            <div className="h-36 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600" />

            <div className="relative px-6 pb-8 md:px-8">
              <div className="-mt-14 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                  <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] border-4 border-white bg-white text-amber-600 shadow-lg">
                    {user.foto ? (
                      <img loading="lazy"
                        src={imageUrl(user.foto)}
                        alt={fullName}
                        onClick={() => setIsPhotoOpen(true)}
                        className="h-full w-full cursor-pointer object-cover transition hover:scale-105"
                      />
                    ) : (
                      <User size={46} />
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-extrabold text-gray-900">
                        {fullName}
                      </h1>

                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                        <BadgeCheck size={16} />
                        Cuenta activa
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-gray-500">
                      {loadingProfile?"Consultando fecha de registro…":memberSince?`Cuenta registrada desde ${memberSince}`:"Fecha de registro no disponible"}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-2">
                        <Mail size={16} className="text-amber-600" />
                        {user.correo || "Sin correo"}
                      </span>

                      <span className="inline-flex items-center gap-2">
                        <MapPin size={16} className="text-amber-600" />
                        {user.direccion || "Sin dirección"}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openEditModal}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  <Settings size={18} />
                  Editar perfil
                </button>
              </div>
            </div>
          </div>

          {(profileError || ordersError) && (
            <div className="mb-6 space-y-3">
              {profileError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {profileError}
                </div>
              )}
              {ordersError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {ordersError}
                </div>
              )}

            </div>
          )}

          <div className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => (
              <Link
                to={stat.to}
                key={stat.title}
                className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:bg-orange-50 hover:ring-orange-200"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                  {stat.icon}
                </div>
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <h3 className="mt-1 text-2xl font-extrabold text-gray-900">
                  {stat.value}
                </h3>
              </Link>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900">
                  Mi cuenta
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Gestiona tu información y tus preferencias
                </p>
              </div>

              <div className="space-y-4 rounded-3xl bg-gradient-to-br from-orange-50 to-amber-50 p-5">
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <Mail size={18} className="text-amber-600" />
                  <span>{user.correo || "Sin correo"}</span>
                </div>

                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <MapPin size={18} className="text-amber-600" />
                  <span>{user.direccion || "Sin dirección"}</span>
                </div>

                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <Phone size={18} className="text-amber-600" />
                  <span>{user.telefono || "Sin teléfono"}</span>
                </div>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <button type="button" onClick={openEditModal} className="flex w-full items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3 text-left text-sm font-semibold text-orange-600 transition hover:bg-orange-100">
                  <User size={18} />
                  Información personal
                </button>



                <Link to="/configuracion" className="flex w-full items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:bg-amber-50 hover:text-amber-600">
                  <Settings size={18} />
                  Configuración
                </Link>
              </div>

              <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-stone-800"><CreditCard size={18} aria-hidden="true"/>Pagos con Wompi</div>
                <p className="text-sm leading-6 text-stone-600">Elige tu forma de pago al finalizar la compra. El pago se completa a través de Wompi.</p>
              </div>
            </aside>

            <div className="space-y-6">
              <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-extrabold text-gray-900">
                      Mis pedidos
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Revisa el estado de tus compras recientes
                    </p>
                  </div>

                  <Link to="/mis-pedidos" className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600">
                    Ver historial completo
                  </Link>
                </div>

                {loadingOrders ? (
                  <p className="text-sm text-gray-500">Cargando pedidos...</p>
                ) : ordersError ? (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">No pudimos consultar tus compras.<button type="button" onClick={()=>fetchOrders()} className="ml-3 min-h-11 font-bold underline">Reintentar</button></div>
                ) : orders.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
                    <p className="text-gray-600">Aún no tienes pedidos.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <Link
                        to={`/pedido/${order.id_pedido}`}
                        key={order.id_pedido}
                        className="rounded-3xl border border-gray-100 p-5 transition hover:border-amber-200 hover:shadow-sm"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                              <Package size={24} />
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-3">
                                <p className="text-lg font-bold text-gray-900">
                                  Pedido #{order.id_pedido}
                                </p>

                                <OrderStatus status={order.estado} delivery={order.tipo_entrega}/>
                              </div>

                              <p className="mt-2 text-sm text-gray-500">
                                {orderDate(order.fecha_creacion,true)}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl bg-gray-50 px-5 py-4 text-left md:min-w-[160px] md:text-right">
                            <p className="text-sm text-gray-500">Total</p>
                            <p className="mt-1 text-xl font-extrabold text-gray-900">
                              {formatPrice(order.total)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h3 className="text-xl font-extrabold text-gray-900">
                  Información personal
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Datos principales de tu cuenta
                </p>

                {loadingProfile ? (
                  <p className="mt-6 text-sm text-gray-500">
                    Cargando información...
                  </p>
                ) : (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm text-gray-500">Nombre completo</p>
                      <p className="mt-1 font-bold text-gray-900">{fullName}</p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm text-gray-500">Correo</p>
                      <p className="mt-1 font-bold text-gray-900">
                        {user.correo || "Sin correo"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm text-gray-500">Teléfono</p>
                      <p className="mt-1 font-bold text-gray-900">
                        {user.telefono || "Sin teléfono"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm text-gray-500">Ubicación</p>
                      <p className="mt-1 font-bold text-gray-900">
                        {user.direccion || "Sin dirección"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {isEditOpen && (
        <Dialog label="Editar perfil" onClose={closeEditModal} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-extrabold text-gray-900">
                  Editar perfil
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Actualiza tu información personal y tu foto.
                </p>
              </div>

              <button aria-label="Cerrar diálogo"
                type="button"
                onClick={closeEditModal}
                className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {editSuccess}
              </div>
            )}

            <div className="mb-6 rounded-3xl border border-gray-100 bg-gray-50 p-5">
              <h4 className="mb-3 text-sm font-bold text-gray-900">
                Foto de perfil
              </h4>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm">
                  {selectedPhoto ? (
                    <img loading="lazy"
                      src={imageUrl(URL.createObjectURL(selectedPhoto))}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : user.foto ? (
                    <img loading="lazy"
                      src={imageUrl(user.foto)}
                      alt={fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Camera size={28} className="text-gray-400" />
                  )}
                </div>

                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-2xl file:border-0 file:bg-orange-100 file:px-4 file:py-2.5 file:font-semibold file:text-orange-700 hover:file:bg-orange-200"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Sube una imagen JPG, PNG o WEBP.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleUploadPhoto}
                  disabled={isUploadingPhoto}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Upload size={16} />
                  {isUploadingPhoto ? "Subiendo..." : "Subir foto"}
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-field-1" className="mb-2 block text-sm font-semibold text-gray-700">
                  Nombre
                </label>
                <input id="profile-field-1"
                  type="text"
                  name="nombre"
                  value={editForm.nombre}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <div>
                <label htmlFor="profile-field-2" className="mb-2 block text-sm font-semibold text-gray-700">
                  Apellido
                </label>
                <input id="profile-field-2"
                  type="text"
                  name="apellido"
                  value={editForm.apellido}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="profile-field-3" className="mb-2 block text-sm font-semibold text-gray-700">
                  Correo
                </label>
                <input id="profile-field-3"
                  type="email"
                  name="correo"
                  value={editForm.correo}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <div>
                <label htmlFor="profile-field-4" className="mb-2 block text-sm font-semibold text-gray-700">
                  Teléfono
                </label>
                <input id="profile-field-4"
                  type="text"
                  name="telefono"
                  value={editForm.telefono}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <div>
                <label htmlFor="profile-field-5" className="mb-2 block text-sm font-semibold text-gray-700">
                  Dirección
                </label>
                <input id="profile-field-5"
                  type="text"
                  name="direccion"
                  value={editForm.direccion}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <div className="sm:col-span-2 mt-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Save size={16} />
                  {isSaving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {isPhotoOpen && user.foto && (
        <Dialog label="Fotografía del perfil" onClose={() => setIsPhotoOpen(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4"
          onClick={() => setIsPhotoOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img loading="lazy"
              src={imageUrl(user.foto)}
              alt={fullName}
              className="max-h-[85vh] w-full rounded-[2rem] object-contain shadow-2xl"
            />

            <button aria-label="Cerrar diálogo"
              type="button"
              onClick={() => setIsPhotoOpen(false)}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-700 shadow-md transition hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
        </Dialog>
      )}
    </MainLayout>
  );
}
