import { API_URL } from '../services/apiConfig.js';
import { appFetch } from "../services/notifications.js";
import Dialog from "../components/Dialog";
import useCatalogUpdates from "../hooks/useCatalogUpdates";
import { imageUrl } from "../services/api";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  Store,
  MapPin,
  Mail,
  Phone,
  Star,
  Package,
  ShoppingBag,
  CircleDollarSign,
  Eye,
  Search,
  Plus,
  SquarePen,
  Trash2,
  BadgeCheck,
  X,
  Save,
  Camera,
  Upload,
  ImagePlus,
  Sparkles,
} from "lucide-react";
import { Link,useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import StorePublicFields from "../components/StorePublicFields";
import { profileToForm, profileFromForm } from "../services/storeProfile";
import WalletCard from '../components/WalletCard';



const DEFAULT_STORE_IMAGE =
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80";

const DEFAULT_BANNER_IMAGE =
  "https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1400&q=80";

const formatPrice = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-CO");
};

const parseResponseSafely = async (response) => {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await response.json();
  }

  const text = await response.text();
  return {
    ok: false,
    message: text || "Respuesta inválida del servidor.",
  };
};

function StatCard({ icon, title, value, subtitle, loading = false }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-1 hover:shadow-lg">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <h3 className="mt-1 text-2xl font-extrabold text-gray-900">
        {loading ? "..." : value}
      </h3>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}

function ProductCard({ product, onEdit, onDelete, onViewReviews }) {
  const statusStyles = {
    Activo: "bg-emerald-100 text-emerald-700",
    Pausado: "bg-amber-100 text-amber-700",
    Agotado: "bg-rose-100 text-rose-700",
  };

  const normalizedStatus =
    product.status === "agotado"
      ? "Agotado"
      : product.status === "pausado"
      ? "Pausado"
      : "Activo";

  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative">
        <img loading="lazy"
          src={imageUrl(product.image || DEFAULT_STORE_IMAGE)}
          alt={product.name}
          onError={(e) => {
            e.currentTarget.src = DEFAULT_STORE_IMAGE;
          }}
          className="h-56 w-full object-cover"
        />
        <span
          className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-bold ${
            statusStyles[normalizedStatus]
          }`}
        >
          {normalizedStatus}
        </span>
      </div>

      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
            {product.category || "Sin categoría"}
          </span>
          <span className="text-sm font-semibold text-gray-500">
            Stock: {product.stock}
          </span>
        </div>

        <h3 className="text-lg font-bold text-gray-900">{product.name}</h3>

        <p className="mt-3 text-2xl font-extrabold text-gray-900">
          {formatPrice(product.price)}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-gray-50 p-3">
            <p className="text-gray-500">Vistas</p>
            <p className="mt-1 font-bold text-gray-900">{product.views}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-3">
            <p className="text-gray-500">Ventas</p>
            <p className="mt-1 font-bold text-gray-900">{product.sales}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-amber-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Reseñas</p>
            <div className="flex items-center gap-1 text-amber-500">
              <Star size={16} className="fill-amber-400" />
              <span className="font-bold text-gray-900">
                {Number(product.rating || 0).toFixed(1)}
              </span>
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {product.reviewsCount || 0} comentario
            {Number(product.reviewsCount || 0) === 1 ? "" : "s"}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <SquarePen size={16} />
            Editar
          </button>

          <button
            type="button"
            onClick={() => onViewReviews(product)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
          >
            <Eye size={16} />
            Reseñas
          </button>
        </div>

        <div className="mt-2">
          <button
            type="button"
            onClick={() => onDelete(product)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 size={17} />
            Eliminar
          </button>
        </div>
      </div>
    </article>
  );
}

function ReviewStars({ value = 0, size = 16 }) {
  const rounded = Math.round(Number(value || 0));

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < rounded;

        return (
          <Star
            key={index}
            size={size}
            className={
              filled ? "fill-amber-400 text-amber-400" : "text-gray-300"
            }
          />
        );
      })}
    </div>
  );
}

export default function ProfileProducts() {
  useCatalogUpdates(() => { fetchSellerProducts(true); fetchSellerStats(true); });
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const savedUser = JSON.parse(localStorage.getItem("user") || "null");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  const [seller, setSeller] = useState({
    id: null,
    name: "",
    owner: "",
    email: "",
    phone: "",
    location: "",
    rating: 0,
    reviews: 0,
    description: "",
    verified: false,
    banner: "",
    avatar: "",
    city: "",
    publicProfile: {},
  });

  const [editProfileForm, setEditProfileForm] = useState({
    name: "",
    owner: "",
    email: "",
    phone: "",
    location: "",
    description: "",
    city: "",
    publicProfile: profileToForm(),
  });

  const [productsData, setProductsData] = useState([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalSales: 0,
    totalViews: 0,
    estimatedRevenue: 0,
  });

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [pageError, setPageError] = useState("");
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileModalError, setProfileModalError] = useState("");
  const [profileModalSuccess, setProfileModalSuccess] = useState("");

  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const [selectedProductReviews, setSelectedProductReviews] = useState(null);
  const [productReviews, setProductReviews] = useState([]);
  const [loadingProductReviews, setLoadingProductReviews] = useState(false);
  const [productReviewsError, setProductReviewsError] = useState("");

  const synchronizeSeller = useEffectEvent(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    if (savedUser?.rol !== "vendedor" && savedUser?.rol !== "admin") {
      navigate("/perfil", { replace: true });
      return;
    }

    fetchSellerProfile();
    fetchSellerProducts();
    fetchSellerStats();
  });
  useEffect(() => { synchronizeSeller(); }, [token, savedUser?.rol]);

  const avatarPreview = useMemo(
    () => (selectedAvatar ? URL.createObjectURL(selectedAvatar) : null),
    [selectedAvatar]
  );

  const bannerPreview = useMemo(
    () => (selectedBanner ? URL.createObjectURL(selectedBanner) : null),
    [selectedBanner]
  );

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [avatarPreview, bannerPreview]);

  const fetchSellerProfile = async () => {
    try {
      setLoadingProfile(true);
      setPageError("");

      const response = await appFetch(`${API_URL}/api/seller/profile`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await parseResponseSafely(response);

      if (!response.ok) {
        throw new Error(
          data.message || "No se pudo cargar el perfil del vendedor."
        );
      }

      const profile = data.seller || data.store || data.user || {};

      const nextSeller = {
        city: profile.ciudad || "",
        publicProfile: profile.perfil_publico || {},
        id:
          profile.id ||
          profile.id_vendedor ||
          profile.id_tienda ||
          savedUser?.id_usuario ||
          null,
        name:
          profile.name || profile.nombre_tienda || profile.tienda || "Mi tienda",
        owner:
          profile.owner ||
          profile.propietario ||
          `${profile.nombre || savedUser?.nombre || ""} ${
            profile.apellido || savedUser?.apellido || ""
          }`.trim() ||
          "Propietario",
        email: profile.email || profile.correo || savedUser?.correo || "",
        phone: profile.phone || profile.telefono || "",
        location:
          profile.location || profile.ubicacion || profile.direccion || "",
        rating: Number(profile.rating || profile.calificacion || 0),
        reviews: Number(
          profile.reviews || profile.resenas || profile.total_resenas || 0
        ),
        description:
          profile.description ||
          profile.descripcion ||
          "Sin descripción registrada.",
        verified: Boolean(profile.verified ?? profile.verificado ?? false),
        banner:
          profile.banner || profile.banner_url || profile.portada || DEFAULT_BANNER_IMAGE,
        avatar:
          profile.avatar ||
          profile.logo ||
          profile.foto ||
          profile.imagen ||
          DEFAULT_STORE_IMAGE,
      };

      setSeller(nextSeller);
    } catch (error) {
      console.error("fetchSellerProfile error:", error);
      setPageError(error.message || "No se pudo cargar el perfil del vendedor.");
    } finally {
      setLoadingProfile(false);
    }
  };

  const normalizeProduct = (product) => {
    const rawStatus = String(product.estado || product.status || "activo")
      .trim()
      .toLowerCase();

    let normalizedStatus = "activo";

    if (rawStatus.includes("agot")) normalizedStatus = "agotado";
    else if (rawStatus.includes("paus")) normalizedStatus = "pausado";
    else normalizedStatus = "activo";

    return {
      id: product.id_producto,
      name: product.nombre,
      category: product.categoria || "Sin categoría",
      price: Number(product.precio || 0),
      stock: Number(product.stock || 0),
      status: normalizedStatus,
      views: Number(product.vistas || 0),
      sales: Number(product.ventas || 0),
      image: product.imagen || "",
      description: product.descripcion || "",
      rating: Number(product.calificacion || 0),
      reviewsCount: Number(product.resenas || 0),
      raw: product,
    };
  };

  const fetchSellerProducts = async (silent=false) => {
    try {
      if(!silent) setLoadingProducts(true);

      const response = await appFetch(`${API_URL}/api/seller/products/mine`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await parseResponseSafely(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los productos.");
      }

      const products = Array.isArray(data.products)
        ? data.products
        : Array.isArray(data.productos)
        ? data.productos
        : [];

      setProductsData(products.map(normalizeProduct));
    } catch (error) {
      console.error("fetchSellerProducts error:", error);
      setPageError(
        (prev) => prev || error.message || "No se pudieron cargar los productos."
      );
      setProductsData([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchSellerStats = async (silent=false) => {
    try {
      if(!silent) setLoadingStats(true);

      const response = await appFetch(`${API_URL}/api/seller/stats`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await parseResponseSafely(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar las métricas.");
      }

      const metrics = data.stats || data.metricas || {};

      setStats({
        totalProducts: Number(
          metrics.totalProducts || metrics.total_productos || 0
        ),
        activeProducts: Number(
          metrics.activeProducts || metrics.productos_activos || 0
        ),
        totalSales: Number(metrics.totalSales || metrics.total_ventas || 0),
        totalViews: Number(metrics.totalViews || metrics.total_vistas || 0),
        estimatedRevenue: Number(
          metrics.estimatedRevenue || metrics.ingresos_estimados || 0
        ),
      });
    } catch (error) {
      console.error("fetchSellerStats error:", error);

      setStats({
        totalProducts: productsData.length,
        activeProducts: productsData.filter(
          (product) => product.status === "activo"
        ).length,
        totalSales: productsData.reduce(
          (acc, product) => acc + Number(product.sales || 0),
          0
        ),
        totalViews: productsData.reduce(
          (acc, product) => acc + Number(product.views || 0),
          0
        ),
        estimatedRevenue: productsData.reduce(
          (acc, product) =>
            acc + Number(product.sales || 0) * Number(product.price || 0),
          0
        ),
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchProductReviews = async (product) => {
    try {
      setSelectedProductReviews(product);
      setLoadingProductReviews(true);
      setProductReviewsError("");
      setProductReviews([]);

      const response = await appFetch(
        `${API_URL}/api/reviews/product/${product.id}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await parseResponseSafely(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar las reseñas.");
      }

      setProductReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch (error) {
      console.error("fetchProductReviews error:", error);
      setProductReviewsError(
        error.message || "No se pudieron cargar las reseñas."
      );
      setProductReviews([]);
    } finally {
      setLoadingProductReviews(false);
    }
  };

  const closeReviewsModal = () => {
    setSelectedProductReviews(null);
    setProductReviews([]);
    setProductReviewsError("");
    setLoadingProductReviews(false);
  };

  const filteredProducts = useMemo(() => {
    let result = [...productsData];

    if (search.trim()) {
      const text = search.toLowerCase();
      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(text) ||
          product.category.toLowerCase().includes(text)
      );
    }

    if (statusFilter !== "Todos") {
      const map = {
        Activo: "activo",
        Pausado: "pausado",
        Agotado: "agotado",
      };

      result = result.filter((product) => product.status === map[statusFilter]);
    }

    return result;
  }, [productsData, search, statusFilter]);

  const computedStats = useMemo(() => {
    if (loadingStats) return stats;

    const fallbackTotalProducts = productsData.length;
    const fallbackActiveProducts = productsData.filter(
      (product) => product.status === "activo"
    ).length;
    const fallbackTotalSales = productsData.reduce(
      (acc, product) => acc + Number(product.sales || 0),
      0
    );
    const fallbackTotalViews = productsData.reduce(
      (acc, product) => acc + Number(product.views || 0),
      0
    );
    const fallbackEstimatedRevenue = productsData.reduce(
      (acc, product) =>
        acc + Number(product.sales || 0) * Number(product.price || 0),
      0
    );

    return {
      totalProducts: stats.totalProducts || fallbackTotalProducts,
      activeProducts: stats.activeProducts || fallbackActiveProducts,
      totalSales: stats.totalSales || fallbackTotalSales,
      totalViews: stats.totalViews || fallbackTotalViews,
      estimatedRevenue: stats.estimatedRevenue || fallbackEstimatedRevenue,
    };
  }, [stats, productsData, loadingStats]);

  const openEditProfileModal = () => {
    setProfileModalError("");
    setProfileModalSuccess("");
    setSelectedAvatar(null);
    setSelectedBanner(null);
    setEditProfileForm({
      name: seller.name || "",
      owner: seller.owner || "",
      email: seller.email || "",
      phone: seller.phone || "",
      location: seller.location || "",
      description: seller.description || "",
      city: seller.city || "",
      publicProfile: profileToForm(seller.publicProfile),
    });
    setIsEditProfileOpen(true);
  };

  const closeEditProfileModal = () => {
    setIsEditProfileOpen(false);
    setProfileModalError("");
    setProfileModalSuccess("");
    setSelectedAvatar(null);
    setSelectedBanner(null);
  };

  const handleEditProfileChange = (e) => {
    const { name, value } = e.target;
    setEditProfileForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedAvatar(file);
  };

  const handleBannerChange = (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedBanner(file);
  };

  const handleUploadAvatar = async () => {
    if (!selectedAvatar) {
      setProfileModalError("Selecciona una imagen para el logo.");
      return;
    }

    try {
      setIsUploadingAvatar(true);
      setProfileModalError("");
      setProfileModalSuccess("");

      const formData = new FormData();
      formData.append("photo", selectedAvatar);

      const response = await appFetch(`${API_URL}/api/seller/profile/photo`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await parseResponseSafely(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudo subir el logo.");
      }

      setProfileModalSuccess("Logo actualizado correctamente.");
      setSelectedAvatar(null);
      await fetchSellerProfile();
    } catch (error) {
      console.error("handleUploadAvatar error:", error);
      setProfileModalError(error.message || "No se pudo subir el logo.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUploadBanner = async () => {
    if (!selectedBanner) {
      setProfileModalError("Selecciona una imagen para el banner.");
      return;
    }

    try {
      setIsUploadingBanner(true);
      setProfileModalError("");
      setProfileModalSuccess("");

      const formData = new FormData();
      formData.append("banner", selectedBanner);

      const response = await appFetch(`${API_URL}/api/seller/profile/banner`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await parseResponseSafely(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudo subir el banner.");
      }

      setProfileModalSuccess("Banner actualizado correctamente.");
      setSelectedBanner(null);
      await fetchSellerProfile();
    } catch (error) {
      console.error("handleUploadBanner error:", error);
      setProfileModalError(error.message || "No se pudo subir el banner.");
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    if (!editProfileForm.name.trim()) {
      setProfileModalError("El nombre de la tienda es obligatorio.");
      return;
    }

    if (!editProfileForm.email.trim()) {
      setProfileModalError("El correo es obligatorio.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(editProfileForm.email.trim())) {
      setProfileModalError("Ingresa un correo válido.");
      return;
    }

    try {
      setIsSavingProfile(true);
      setProfileModalError("");
      setProfileModalSuccess("");

      const ownerParts = editProfileForm.owner.trim().split(" ");
      const nombre = ownerParts[0] || "";
      const apellido = ownerParts.slice(1).join(" ") || "";

      const response = await appFetch(`${API_URL}/api/seller/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre,
          apellido,
          correo: editProfileForm.email.trim().toLowerCase(),
          telefono: editProfileForm.phone.trim() || null,
          direccion: editProfileForm.location.trim() || null,
          nombre_tienda: editProfileForm.name.trim(),
          descripcion: editProfileForm.description.trim(),
          ciudad: editProfileForm.city.trim(),
          perfil_publico: profileFromForm(editProfileForm.publicProfile),
        }),
      });

      const data = await parseResponseSafely(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudo actualizar el perfil.");
      }

      setProfileModalSuccess("Perfil actualizado correctamente.");
      await fetchSellerProfile();

      setTimeout(() => {
        setIsEditProfileOpen(false);
      }, 700);
    } catch (error) {
      console.error("handleSaveProfile error:", error);
      setProfileModalError(error.message || "No se pudo actualizar el perfil.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleEditProfile = () => {
    openEditProfileModal();
  };

  const handleAddProduct = () => {
    navigate("/crear-producto");
  };

  const handleEditProduct = (product) => {
    navigate(`/editar-producto/${product.id}`);
  };

  const handleDeleteProduct = async (product) => {
    const confirmDelete = window.confirm(
      `¿Seguro que quieres eliminar "${product.name}"?`
    );

    if (!confirmDelete) return;

    try {
      setDeleteLoadingId(product.id);

      const response = await appFetch(
        `${API_URL}/api/seller/products/${product.id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await parseResponseSafely(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudo eliminar el producto.");
      }

      const updatedProducts = productsData.filter((item) => item.id !== product.id);
      setProductsData(updatedProducts);

      setStats((prev) => ({
        ...prev,
        totalProducts: Math.max(0, prev.totalProducts - 1),
        activeProducts:
          product.status === "activo"
            ? Math.max(0, prev.activeProducts - 1)
            : prev.activeProducts,
        totalSales: Math.max(0, prev.totalSales - Number(product.sales || 0)),
        totalViews: Math.max(0, prev.totalViews - Number(product.views || 0)),
        estimatedRevenue: Math.max(
          0,
          prev.estimatedRevenue -
            Number(product.sales || 0) * Number(product.price || 0)
        ),
      }));
    } catch (error) {
      console.error("handleDeleteProduct error:", error);

    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <MainLayout>
      <section className="min-h-[calc(100vh-160px)] bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6"><WalletCard/></div>
          {pageError && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {pageError}
            </div>
          )}

          <div className="overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
            <div
              className="relative h-64 bg-cover bg-center"
              style={{
                backgroundImage: `url('${seller.banner || DEFAULT_BANNER_IMAGE}')`,
              }}
            >
              <div className="absolute inset-0 bg-black/35" />
            </div>

            <div className="relative px-6 pb-8 md:px-8">
              <div className="-mt-16 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                  <div className="h-32 w-32 overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-lg">
                    <img loading="lazy"
                      src={imageUrl(seller.avatar || DEFAULT_STORE_IMAGE)}
                      alt={seller.name || "Tienda"}
                      onClick={() => setIsPhotoOpen(true)}
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_STORE_IMAGE;
                      }}
                      className="h-full w-full cursor-pointer object-cover transition hover:scale-105"
                    />
                  </div>

                  <div className="pt-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-extrabold text-gray-900">
                        {loadingProfile ? "Cargando..." : seller.name || "Mi tienda"}
                      </h1>

                      {seller.verified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                          <BadgeCheck size={16} />
                          Verificado
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm font-medium text-gray-500">
                      Propietario:{" "}
                      {loadingProfile
                        ? "Cargando..."
                        : seller.owner || "Sin propietario"}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-2">
                        <MapPin size={16} className="text-orange-500" />
                        {seller.location || "Sin ubicación"}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Mail size={16} className="text-orange-500" />
                        {seller.email || "Sin correo"}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Phone size={16} className="text-orange-500" />
                        {seller.phone || "Sin teléfono"}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-sm">
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star size={16} className="fill-amber-400" />
                        <span className="font-bold text-gray-900">
                          {seller.rating || 0}
                        </span>
                      </div>
                      <span className="text-gray-500">
                        ({seller.reviews || 0} reseñas)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {seller.id&&<Link to={`/tienda/${seller.id}`} className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-orange-50"><Eye size={17}/>Ver tienda pública</Link>}
                  <button
                    type="button"
                    onClick={handleEditProfile}
                    className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                  >
                    <SquarePen size={17} />
                    Editar perfil
                  </button>

                  <button
                    type="button"
                    onClick={handleAddProduct}
                    className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                  >
                    <Plus size={17} />
                    Agregar producto
                  </button>
                </div>
              </div>

              <div className="mt-6 max-w-4xl">
                <p className="text-gray-600">
                  {seller.description || "Sin descripción registrada."}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Package size={22} />}
              title="Productos publicados"
              value={computedStats.totalProducts}
              subtitle="Total del catálogo"
              loading={loadingProducts || loadingStats}
            />
            <StatCard
              icon={<Store size={22} />}
              title="Productos activos"
              value={computedStats.activeProducts}
              subtitle="Disponibles actualmente"
              loading={loadingProducts || loadingStats}
            />
            <StatCard
              icon={<ShoppingBag size={22} />}
              title="Ventas"
              value={computedStats.totalSales}
              subtitle="Ventas acumuladas"
              loading={loadingProducts || loadingStats}
            />
            <StatCard
              icon={<Eye size={22} />}
              title="Vistas"
              value={computedStats.totalViews}
              subtitle="Visitas a productos"
              loading={loadingProducts || loadingStats}
            />
          </div>

          <div className="mt-8 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-gray-100 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-orange-600">
                  Panel de productos
                </p>
                <h2 className="mt-1 text-2xl font-extrabold text-gray-900">
                  Gestiona tu catálogo
                </h2>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
                  <Search size={18} className="text-gray-400" />
                  <input aria-label="Buscar producto..."
                    type="text"
                    placeholder="Buscar producto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full min-w-[220px] bg-transparent px-3 text-sm outline-none"
                  />
                </div>

                <select aria-label="Filtrar por estado"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                >
                  <option value="Todos">Todos los estados</option>
                  <option value="Activo">Activo</option>
                  <option value="Pausado">Pausado</option>
                  <option value="Agotado">Agotado</option>
                </select>
              </div>
            </div>

            {loadingProducts ? (
              <div className="mt-8 rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
                <p className="text-gray-600">Cargando productos...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="mt-8 rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
                <h3 className="text-xl font-bold text-gray-900">
                  No se encontraron productos
                </h3>
                <p className="mt-2 text-gray-600">
                  Intenta con otra búsqueda o cambia el filtro de estado.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="relative">
                    {deleteLoadingId === product.id && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/70 backdrop-blur-sm">
                        <span className="text-sm font-semibold text-gray-700">
                          Eliminando...
                        </span>
                      </div>
                    )}

                    <ProductCard
                      product={product}
                      onEdit={handleEditProduct}
                      onDelete={handleDeleteProduct}
                      onViewReviews={fetchProductReviews}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h3 className="text-xl font-extrabold text-gray-900">
                Información de la tienda
              </h3>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Nombre de la tienda</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {seller.name || "Sin nombre"}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Propietario</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {seller.owner || "Sin propietario"}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Correo</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {seller.email || "Sin correo"}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Teléfono</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {seller.phone || "Sin teléfono"}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4 sm:col-span-2">
                  <p className="text-sm text-gray-500">Ubicación</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {seller.location || "Sin ubicación"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h3 className="text-xl font-extrabold text-gray-900">
                Estado general
              </h3>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-700">
                    {seller.verified ? "Tienda verificada" : "Tienda activa"}
                  </p>
                  <p className="mt-1 text-sm text-emerald-600">
                    Tu perfil está visible y recibiendo visitas.
                  </p>
                </div>

                <div className="rounded-2xl bg-orange-50 p-4">
                  <p className="text-sm font-semibold text-orange-700">
                    Recomendación
                  </p>
                  <p className="mt-1 text-sm text-orange-600">
                    Agrega más productos con imágenes y descripción para mejorar
                    el alcance.
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Calificación promedio</p>
                  <p className="mt-1 text-2xl font-extrabold text-gray-900">
                    {seller.rating || 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Reseñas</p>
                  <p className="mt-1 text-2xl font-extrabold text-gray-900">
                    {seller.reviews || 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Ingresos estimados</p>
                  <p className="mt-1 text-2xl font-extrabold text-gray-900">
                    <span className="inline-flex items-center gap-2">
                      <CircleDollarSign size={22} className="text-orange-500" />
                      {formatPrice(computedStats.estimatedRevenue)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isPhotoOpen && (
        <Dialog label="Fotografía del perfil" onClose={() => setIsPhotoOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4"
          onClick={() => setIsPhotoOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img loading="lazy"
              src={imageUrl(seller.avatar || DEFAULT_STORE_IMAGE)}
              alt={seller.name || "Tienda"}
              onError={(e) => {
                e.currentTarget.src = DEFAULT_STORE_IMAGE;
              }}
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

      {selectedProductReviews && (
        <Dialog label="Reseñas del producto" onClose={closeReviewsModal}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={closeReviewsModal}
        >
          <div
            className="relative flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[0_25px_100px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                    Reseñas del producto
                  </p>
                  <h3 className="mt-2 text-2xl font-black leading-none">
                    {selectedProductReviews.name}
                  </h3>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold backdrop-blur-sm">
                      <Star size={15} className="fill-amber-300 text-amber-300" />
                      {Number(selectedProductReviews.rating || 0).toFixed(1)}
                    </div>
                    <span className="text-sm text-white/90">
                      {selectedProductReviews.reviewsCount || 0} comentario
                      {Number(selectedProductReviews.reviewsCount || 0) === 1
                        ? ""
                        : "s"}
                    </span>
                  </div>
                </div>

                <button aria-label="Cerrar diálogo"
                  type="button"
                  onClick={closeReviewsModal}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#fff7f0] to-white px-5 py-5">
              {productReviewsError && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {productReviewsError}
                </div>
              )}

              {loadingProductReviews ? (
                <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
                  <p className="text-gray-600">Cargando reseñas...</p>
                </div>
              ) : productReviews.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
                  <h4 className="text-xl font-bold text-gray-900">
                    Aún no hay reseñas
                  </h4>
                  <p className="mt-2 text-gray-600">
                    Este producto todavía no tiene comentarios de usuarios.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {productReviews.map((review) => {
                    const reviewerName =
                      `${review?.nombre || ""} ${review?.apellido || ""}`.trim() ||
                      "Usuario";

                    return (
                      <article
                        key={review.id_resena}
                        className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-100">
                            {review?.foto ? (
                              <img loading="lazy"
                                src={imageUrl(review.foto)}
                                alt={reviewerName}
                                onError={(e) => {
                                  e.currentTarget.src = DEFAULT_STORE_IMAGE;
                                }}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-gray-500">
                                {reviewerName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <h4 className="font-bold text-gray-900">
                                  {reviewerName}
                                </h4>
                                <div className="mt-1">
                                  <ReviewStars
                                    value={Number(review?.puntuacion || 0)}
                                    size={16}
                                  />
                                </div>
                              </div>

                              <p className="text-sm text-gray-500">
                                {formatDate(
                                  review?.fecha_actualizacion ||
                                    review?.fecha_creacion
                                )}
                              </p>
                            </div>

                            <div className="mt-3 rounded-2xl bg-gray-50 p-4">
                              <p className="text-sm leading-relaxed text-gray-700">
                                {review?.comentario?.trim()
                                  ? review.comentario
                                  : "El usuario dejó una calificación sin comentario."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Dialog>
      )}

      {isEditProfileOpen && (
        <Dialog label="Editar perfil de la tienda" onClose={closeEditProfileModal}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={closeEditProfileModal}
        >
          <div
            className="relative flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[0_25px_100px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-6 py-5 text-white">
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-black/10 blur-2xl" />

              <div className="relative z-10 flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold backdrop-blur-sm">
                    <Sparkles size={13} />
                    Panel premium de edición
                  </div>

                  <h2 className="mt-3 text-2xl font-black sm:text-[2rem] leading-none">
                    Editar perfil de la tienda
                  </h2>
                  <p className="mt-2 text-sm text-white/90">
                    Ajusta tus datos y tus imágenes en una sola ventana.
                  </p>
                </div>

                <button aria-label="Cerrar diálogo"
                  type="button"
                  onClick={closeEditProfileModal}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#fff7f0] to-white px-5 py-5">
              {profileModalError && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm">
                  {profileModalError}
                </div>
              )}

              {profileModalSuccess && (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
                  {profileModalSuccess}
                </div>
              )}

              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="rounded-[1.6rem] border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="h-16 w-16 overflow-hidden rounded-[1.2rem] border-4 border-white bg-gray-100 shadow">
                        <img loading="lazy"
                          src={imageUrl(avatarPreview || seller.avatar || DEFAULT_STORE_IMAGE)}
                          alt={seller.name || "Tienda"}
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_STORE_IMAGE;
                          }}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-lg font-extrabold text-gray-900">
                          {editProfileForm.name || seller.name || "Mi tienda"}
                        </p>
                        <p className="truncate text-sm text-gray-500">
                          {editProfileForm.email || seller.email || "Sin correo"}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[1.25rem] border border-gray-100">
                      <img loading="lazy"
                        src={imageUrl(bannerPreview || seller.banner || DEFAULT_BANNER_IMAGE)}
                        alt="Banner"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_BANNER_IMAGE;
                        }}
                        className="h-32 w-full object-cover"
                      />
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="mb-3">
                      <h4 className="text-base font-extrabold text-gray-900">
                        Logo o foto de perfil
                      </h4>
                      <p className="mt-1 text-sm text-gray-500">
                        Imagen principal de tu tienda.
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-[1.25rem] border border-gray-100 bg-gray-50">
                      {avatarPreview || seller.avatar ? (
                        <img loading="lazy"
                          src={imageUrl(avatarPreview || seller.avatar)}
                          alt="Logo"
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_STORE_IMAGE;
                          }}
                          className="h-32 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-32 items-center justify-center text-gray-400">
                          <Camera size={28} />
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="block w-full text-xs text-gray-700 file:mr-3 file:rounded-xl file:border-0 file:bg-orange-100 file:px-3 file:py-2 file:font-semibold file:text-orange-700 hover:file:bg-orange-200"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleUploadAvatar}
                      disabled={isUploadingAvatar}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Upload size={15} />
                      {isUploadingAvatar ? "Subiendo..." : "Subir logo"}
                    </button>
                  </div>

                  <div className="rounded-[1.6rem] border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="mb-3">
                      <h4 className="text-base font-extrabold text-gray-900">
                        Banner de portada
                      </h4>
                      <p className="mt-1 text-sm text-gray-500">
                        Imagen horizontal para destacar tu tienda.
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-[1.25rem] border border-gray-100 bg-gray-50">
                      {bannerPreview || seller.banner ? (
                        <img loading="lazy"
                          src={imageUrl(bannerPreview || seller.banner)}
                          alt="Banner"
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_BANNER_IMAGE;
                          }}
                          className="h-32 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-32 items-center justify-center text-gray-400">
                          <ImagePlus size={28} />
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBannerChange}
                        className="block w-full text-xs text-gray-700 file:mr-3 file:rounded-xl file:border-0 file:bg-orange-100 file:px-3 file:py-2 file:font-semibold file:text-orange-700 hover:file:bg-orange-200"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleUploadBanner}
                      disabled={isUploadingBanner}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Upload size={15} />
                      {isUploadingBanner ? "Subiendo..." : "Subir banner"}
                    </button>
                  </div>
                </div>

                <div className="min-w-0 rounded-[1.6rem] border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-5">
                    <h3 className="text-2xl font-extrabold text-gray-900">
                      Datos de la tienda
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">Actualiza tu cuenta y los datos públicos que verán tus compradores.</p>
                    <Link to={`/tienda/${seller.id}`} className="mt-3 inline-flex min-h-11 items-center font-semibold text-amber-900 underline">Ver página pública de mi tienda</Link>
                  </div>

                  <form
                    onSubmit={handleSaveProfile}
                    className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"
                  >
                    <div className="sm:col-span-2">
                      <label htmlFor="profileproducts-field-1" className="mb-2 block text-sm font-semibold text-gray-700">
                        Nombre de la tienda
                      </label>
                      <input id="profileproducts-field-1"
                        type="text"
                        name="name"
                        value={editProfileForm.name}
                        onChange={handleEditProfileChange}
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                        placeholder="Ej: Delicias Horizon"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="profileproducts-field-2" className="mb-2 block text-sm font-semibold text-gray-700">
                        Propietario
                      </label>
                      <input id="profileproducts-field-2"
                        type="text"
                        name="owner"
                        value={editProfileForm.owner}
                        onChange={handleEditProfileChange}
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                        placeholder="Nombre del propietario"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="profileproducts-field-3" className="mb-2 block text-sm font-semibold text-gray-700">
                        Correo de tu cuenta (privado)
                      </label>
                      <input id="profileproducts-field-3"
                        type="email"
                        name="email"
                        value={editProfileForm.email}
                        onChange={handleEditProfileChange}
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                        placeholder="correo@ejemplo.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="profileproducts-field-4" className="mb-2 block text-sm font-semibold text-gray-700">
                        Teléfono de tu cuenta (privado)
                      </label>
                      <input id="profileproducts-field-4"
                        type="text"
                        name="phone"
                        value={editProfileForm.phone}
                        onChange={handleEditProfileChange}
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                        placeholder="3001234567"
                      />
                    </div>

                    <div>
                      <label htmlFor="profileproducts-field-5" className="mb-2 block text-sm font-semibold text-gray-700">
                        Dirección de tu cuenta (privada)
                      </label>
                      <input id="profileproducts-field-5"
                        type="text"
                        name="location"
                        value={editProfileForm.location}
                        onChange={handleEditProfileChange}
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                        placeholder="Ciudad o dirección"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="profileproducts-field-6" className="mb-2 block text-sm font-semibold text-gray-700">
                        Descripción
                      </label>
                      <textarea id="profileproducts-field-6"
                        name="description"
                        rows={5}
                        value={editProfileForm.description}
                        onChange={handleEditProfileChange}
                        className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                        placeholder="Describe tu tienda..."
                      />
                    </div>

                    <StorePublicFields city={editProfileForm.city} profile={editProfileForm.publicProfile}
                      disabled={isSavingProfile}
                      onCityChange={city=>setEditProfileForm(prev=>({...prev,city}))}
                      onChange={(field,value)=>setEditProfileForm(prev=>({...prev,publicProfile:{...prev.publicProfile,[field]:value}}))}/>
                    <div className="sm:col-span-2 mt-2 flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={closeEditProfileModal}
                        className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>

                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Save size={15} />
                        {isSavingProfile ? "Guardando..." : "Guardar cambios"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </MainLayout>
  );
}
