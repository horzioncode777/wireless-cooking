import { API_URL } from '../services/apiConfig.js';
import { appFetch } from "../services/notifications.js";
import useCatalogUpdates from "../hooks/useCatalogUpdates";
import { imageUrl } from "../services/api";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import { PaymentBrands } from "../components/PaymentUI";



const formatPrice = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export default function Cart() {
  const latestCatalogRequest=useRef(0);
  useCatalogUpdates(() => { fetchCart(true); });
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [cartItems, setCartItems] = useState([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const [cartError, setCartError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const fetchCart = async (silent = false) => {
    const requestId=++latestCatalogRequest.current;
    if (!token) {
      if(requestId===latestCatalogRequest.current) setLoadingCart(false);
      if (!silent) setCartItems([]);
      return;
    }

    try {
      if (!silent) setLoadingCart(true);
      setCartError("");

      const response = await appFetch(`${API_URL}/api/cart`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if(requestId!==latestCatalogRequest.current) return;

      if (!response.ok) {
        throw new Error(data.message || "No se pudo cargar el carrito");
      }

      setCartItems(data.cart?.items || []);
    } catch (error) {
      if(requestId!==latestCatalogRequest.current) return;
      console.error("fetchCart error:", error);
      setCartError(error.message || "No se pudo cargar el carrito");
      if (!silent) setCartItems([]);
    } finally {
      if(requestId===latestCatalogRequest.current) setLoadingCart(false);
    }
  };

  const synchronizeCart = useEffectEvent(() => {
    fetchCart();
  });
  useEffect(() => { synchronizeCart(); }, [token]);

  const updateQuantity = async (item, newQty) => {
    if (newQty <= 0) {
      await removeItem(item.id_item);
      return;
    }

    try {
      setUpdatingId(item.id_item);

      const response = await appFetch(`${API_URL}/api/cart/item/${item.id_item}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cantidad: newQty }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo actualizar la cantidad");
      }

      setCartItems((prev) =>
        prev.map((cartItem) =>
          cartItem.id_item === item.id_item
            ? { ...cartItem, cantidad: newQty }
            : cartItem
        )
      );
    } catch (error) {
      console.error("updateQuantity error:", error);

    } finally {
      setUpdatingId(null);
    }
  };

  const removeItem = async (id_item) => {
    try {
      setRemovingId(id_item);

      const response = await appFetch(`${API_URL}/api/cart/item/${id_item}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo eliminar el producto");
      }

      setCartItems((prev) => prev.filter((item) => item.id_item !== id_item));
    } catch (error) {
      console.error("removeItem error:", error);

    } finally {
      setRemovingId(null);
    }
  };

  const subtotal = useMemo(() => {
    return cartItems.reduce(
      (acc, item) => acc + Number(item.precio || 0) * Number(item.cantidad || 0),
      0
    );
  }, [cartItems]);

  const shipping = cartItems.length > 0 ? 12000 : 0;
  const total = subtotal + shipping;

  if (!token) {
    return (
      <MainLayout>
        <section className="min-h-[calc(100vh-160px)] bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-10">
          <div className="mx-auto max-w-4xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <ShoppingCart size={28} />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900">
              Inicia sesión para ver tu carrito
            </h1>
            <p className="mt-3 text-gray-600">
              Tu carrito está asociado a tu cuenta. Inicia sesión para ver, editar
              y continuar tu compra.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/login"
                className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"
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
          <div className="mb-8">
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-amber-600 shadow-sm">
              <ShoppingCart size={16} />
              Tu carrito
            </p>

            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">
              Carrito de compras
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600 md:text-base">
              Revisa los productos seleccionados antes de continuar con el pago.
            </p>
          </div>

          {cartError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {cartError}
            </div>
          )}

          {loadingCart ? (
            <div className="rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
              <p className="text-gray-600">Cargando carrito...</p>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                <ShoppingCart size={28} />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900">
                Tu carrito está vacío
              </h2>
              <p className="mt-2 text-gray-600">
                Aún no has agregado productos. Explora el catálogo y encuentra algo increíble.
              </p>
              <Link
                to="/productos"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"
              >
                Ir a productos
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                {cartItems.map((item) => (
                  <article
                    key={item.id_item}
                    className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="overflow-hidden rounded-2xl bg-gray-100 sm:h-32 sm:w-32 shrink-0">
                        <img loading="lazy"
                          src={imageUrl(item.imagen ||
                            "https://dummyimage.com/600x400/f3f4f6/9ca3af&text=Producto")}
                          alt={item.nombre}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-900">
                              {item.nombre}
                            </h2>
                            <p className="mt-1 text-sm text-gray-500">
                              {item.id_categoria ? `Categoría #${item.id_categoria}` : "Sin categoría"}
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-sm text-gray-500">Precio unitario</p>
                            <p className="text-lg font-bold text-gray-900">
                              {formatPrice(item.precio)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-600">
                              Cantidad
                            </span>

                            <div className="flex items-center rounded-full border border-gray-200 bg-gray-50">
                              <button
                                type="button"
                                aria-label={`Reducir cantidad de ${item.nombre}`}
                                onClick={() =>
                                  updateQuantity(item, Number(item.cantidad) - 1)
                                }
                                disabled={updatingId === item.id_item}
                                className="flex h-10 w-10 items-center justify-center rounded-l-full text-gray-600 transition hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                              >
                                <Minus aria-hidden="true" size={16} />
                              </button>

                              <span className="min-w-[36px] text-center text-sm font-semibold text-gray-900">
                                {item.cantidad}
                              </span>

                              <button
                                type="button"
                                aria-label={`Aumentar cantidad de ${item.nombre}`}
                                onClick={() =>
                                  updateQuantity(item, Number(item.cantidad) + 1)
                                }
                                disabled={updatingId === item.id_item || Number(item.cantidad)>=Number(item.stock)}
                                className="flex h-10 w-10 items-center justify-center rounded-r-full text-gray-600 transition hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                              >
                                <Plus aria-hidden="true" size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            {(item.cantidad>item.stock || item.estado!=="activo" || item.comercio_activo===false) && <p role="status" className="text-sm font-bold text-red-800">Disponibilidad actualizada: {item.stock} unidades. Revisa este producto antes de pagar.</p>}
                            <p className="text-base font-bold text-gray-900">
                              {formatPrice(Number(item.precio) * Number(item.cantidad))}
                            </p>

                            <button
                              type="button"
                              onClick={() => removeItem(item.id_item)}
                              disabled={removingId === item.id_item}
                              className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                            >
                              <Trash2 size={16} />
                              {removingId === item.id_item ? "Eliminando..." : "Eliminar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}

                <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        ¿Deseas agregar más productos?
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Sigue explorando nuestro catálogo y encuentra más artículos
                        para tu cocina.
                      </p>
                    </div>

                    <Link
                      to="/productos"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      Seguir comprando
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>

              <aside className="lg:col-span-1">
                <div className="sticky top-24 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h2 className="text-xl font-bold text-gray-900">
                    Resumen del pedido
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {cartItems.length} productos agregados
                  </p>

                  <div className="mt-6 space-y-4">
                    {cartItems.map((item) => (
                      <div
                        key={item.id_item}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="line-clamp-2 font-medium text-gray-800">
                            {item.nombre}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Cantidad: {item.cantidad}
                          </p>
                        </div>

                        <span className="shrink-0 font-semibold text-gray-900">
                          {formatPrice(Number(item.precio) * Number(item.cantidad))}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 space-y-3 border-t border-gray-100 pt-5">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Envío estimado</span>
                      <span>{formatPrice(shipping)}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-base font-bold text-gray-900">
                      <span>Total</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate("/checkout")}
                    disabled={cartItems.some(item=>item.cantidad>item.stock||item.estado!=='activo'||item.comercio_activo===false)}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-amber-700"
                  >
                    Continuar al pago
                    <ArrowRight size={18} />
                  </button>

                  <div className="mt-5 flex justify-center"><PaymentBrands/></div>

                  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
                    <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                    <p>
                      Compra segura con protección de datos y validación de pedido
                      antes de confirmar el pago.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </section>
    </MainLayout>
  );
}
