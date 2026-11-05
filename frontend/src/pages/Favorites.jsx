import { API_URL } from '../services/apiConfig.js';
import { appFetch } from "../services/notifications.js";
import { imageUrl } from "../services/api";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { Heart, ShoppingCart, Trash2, Star, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";



const formatPrice = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const getImageUrl = (item) => {
  return (
    item?.imagen ||
    item?.image ||
    item?.imagen_url ||
    item?.image_url ||
    item?.foto ||
    item?.foto_url ||
    "/product-placeholder.svg"
  );
};

const getProductId = (item) => {
  return item?.product_id || item?.producto_id || item?.id_producto || item?.id;
};

const getProductName = (item) => {
  return item?.name || item?.nombre || item?.titulo || "Producto sin nombre";
};

const getCategory = (item) => {
  return item?.category || item?.categoria || "Sin categoría";
};

const getPrice = (item) => {
  return item?.price || item?.precio || 0;
};

const getRating = (item) => {
  return item?.rating || item?.calificacion || item?.valoracion || 4.8;
};

export default function Favorites() {
  const token = localStorage.getItem("token");

  const [favoriteItems, setFavoriteItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favoritesError, setFavoritesError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    }),
    [token]
  );

  const fetchFavorites = async () => {
    if (!token) {
      setLoading(false);
      setFavoriteItems([]);
      return;
    }

    try {
      setLoading(true);
      setFavoritesError("");

      const res = await appFetch(`${API_URL}/api/favorites`, {
        method: "GET",
        headers,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "No se pudieron cargar los favoritos");
      }

      const favoritesArray = Array.isArray(data)
        ? data
        : Array.isArray(data?.favorites)
        ? data.favorites
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setFavoriteItems(favoritesArray);
    } catch (error) {
      console.error("fetchFavorites error:", error);
      setFavoritesError(error.message || "No se pudieron cargar los favoritos");
      setFavoriteItems([]);
    } finally {
      setLoading(false);
    }
  };

  const synchronizeFavorites = useEffectEvent(() => {
    fetchFavorites();
  });
  useEffect(() => { synchronizeFavorites(); }, [token]);

  const handleRemoveFavorite = async (item) => {
    const productId = getProductId(item);
    if (!productId) return;

    try {
      setActionLoading(`remove-${productId}`);

      const res = await appFetch(`${API_URL}/api/favorites/${productId}`, {
        method: "DELETE",
        headers,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "No se pudo quitar de favoritos");
      }

      setFavoriteItems((prev) =>
        prev.filter((fav) => getProductId(fav) !== productId)
      );
    } catch (error) {
      console.error("handleRemoveFavorite error:", error);

    } finally {
      setActionLoading(null);
    }
  };

  const handleAddToCart = async (item) => {
    const productId = getProductId(item);
    if (!productId) return;

    try {
      setActionLoading(`cart-${productId}`);

      const res = await appFetch(`${API_URL}/api/cart/add`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          productId,
          quantity: 1,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "No se pudo agregar al carrito");
      }


    } catch (error) {
      console.error("handleAddToCart error:", error);

    } finally {
      setActionLoading(null);
    }
  };

  if (!token) {
    return (
      <MainLayout>
        <section className="min-h-[calc(100vh-160px)] bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-10">
          <div className="mx-auto max-w-4xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-500">
              <Heart size={28} />
            </div>

            <h1 className="text-3xl font-extrabold text-gray-900">
              Inicia sesión para ver tus favoritos
            </h1>

            <p className="mt-3 text-gray-600">
              Tus favoritos están asociados a tu cuenta. Inicia sesión para ver,
              guardar y gestionar los productos que más te gustan.
            </p>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/login"
                className="rounded-2xl bg-rose-500 px-6 py-3 font-semibold text-white transition hover:bg-rose-600"
              >
                Iniciar sesión
              </Link>

              <Link
                to="/registro"
                className="rounded-2xl border border-gray-200 bg-white px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Crear cuenta
              </Link>
            </div>
          </div>
        </section>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <section className="min-h-[calc(100vh-160px)] bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-rose-500 shadow-sm">
                <Heart size={16} />
                Tus favoritos
              </p>

              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">
                Lista de favoritos
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-gray-600 md:text-base">
                Guarda aquí los productos que más te gustan para revisarlos luego
                y agregarlos fácilmente al carrito.
              </p>
            </div>

            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-5 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
            >
              Seguir explorando
              <ArrowRight size={16} />
            </Link>
          </div>

          {favoritesError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {favoritesError}
            </div>
          )}

          {loading ? (
            <div className="rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-rose-200 border-t-rose-500" />
              <h2 className="text-xl font-bold text-gray-900">
                Cargando favoritos...
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Estamos trayendo tus productos guardados.
              </p>
            </div>
          ) : favoriteItems.length === 0 ? (
            <div className="rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                <Heart size={28} />
              </div>

              <h2 className="text-2xl font-extrabold text-gray-900">
                Aún no tienes favoritos
              </h2>

              <p className="mt-2 text-gray-600">
                Todavía no has guardado productos. Explora el catálogo y marca con
                corazón los que más te gusten.
              </p>

              <Link
                to="/productos"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-6 py-3 font-semibold text-white transition hover:bg-rose-600"
              >
                Explorar productos
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {favoriteItems.map((item) => {
                  const productId = getProductId(item);
                  const productName = getProductName(item);
                  const productCategory = getCategory(item);
                  const productPrice = getPrice(item);
                  const productRating = getRating(item);
                  const productImage = getImageUrl(item);

                  return (
                    <article
                      key={productId}
                      className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-1 hover:shadow-lg"
                    >
                      <div className="relative overflow-hidden">
                        <img loading="lazy"
                          src={imageUrl(productImage)}
                          alt={productName}
                          className="h-64 w-full object-cover transition duration-500 group-hover:scale-105"
                          onError={(e) => {
                            e.target.src =
                              "/product-placeholder.svg";
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveFavorite(item)}
                          disabled={actionLoading === `remove-${productId}`}
                          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-rose-500 shadow-md backdrop-blur transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70"
                          title="Quitar de favoritos"
                        >
                          <Heart size={18} fill="currentColor" />
                        </button>

                        <span className="absolute left-4 top-4 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          {productCategory}
                        </span>
                      </div>

                      <div className="p-5">
                        <div className="mb-2 flex items-center gap-1 text-amber-500">
                          <Star size={15} fill="currentColor" />
                          <span className="text-sm font-semibold text-gray-700">
                            {productRating}
                          </span>
                        </div>

                        <h2 className="line-clamp-2 min-h-[56px] text-lg font-bold text-gray-900">
                          {productName}
                        </h2>

                        <p className="mt-3 text-2xl font-extrabold text-gray-900">
                          {formatPrice(productPrice)}
                        </p>

                        <div className="mt-5 space-y-3">
                          <Link
                            to={`/producto/${productId}`}
                            className="inline-flex w-full items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                          >
                            Ver producto
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleAddToCart(item)}
                            disabled={actionLoading === `cart-${productId}`}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <ShoppingCart size={17} />
                            {actionLoading === `cart-${productId}`
                              ? "Agregando..."
                              : "Agregar al carrito"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveFavorite(item)}
                            disabled={actionLoading === `remove-${productId}`}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <Trash2 size={16} />
                            {actionLoading === `remove-${productId}`
                              ? "Quitando..."
                              : "Quitar de favoritos"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-10 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      ¿Listo para comprar?
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Revisa tus favoritos y mueve tus productos preferidos al
                      carrito cuando quieras.
                    </p>
                  </div>

                  <Link
                    to="/carrito"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
                  >
                    Ir al carrito
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </MainLayout>
  );
}
