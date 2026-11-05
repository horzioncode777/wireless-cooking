import { API_URL } from '../services/apiConfig.js';
import { appFetch } from "../services/notifications.js";
import useCatalogUpdates from "../hooks/useCatalogUpdates";
import { imageUrl } from "../services/api";
import ProductReviewForm from '../components/ProductReviewForm';
import { api } from "../services/api";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Star,ChevronLeft,ChevronRight } from "lucide-react";
import { useNavigate, useParams, Link } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";



const formatPrice = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const getProductId = (product) =>
  product?.id_producto || product?.product_id || product?.id;

const getProductName = (product) =>
  product?.nombre || product?.name || "Producto sin nombre";

const getProductDescription = (product) =>
  product?.descripcion || product?.description || "";

const getProductPrice = (product) =>
  Number(product?.precio || product?.price || 0);

const getProductImage = (product) =>
  product?.imagen ||
  product?.image ||
  product?.imagen_url ||
  product?.image_url ||
  "/product-placeholder.svg";

const getProductRating = (product) => {
  const rating = Number(product?.calificacion || product?.rating || 0);
  if (Number.isNaN(rating)) return 0;
  return Math.max(0, Math.min(5, rating));
};

const getProductReviews = (product) => {
  const reviews = Number(product?.resenas || product?.reviews || 0);
  if (Number.isNaN(reviews)) return 0;
  return Math.max(0, reviews);
};

const buildGallery = (product) => {
  const main = getProductImage(product);
  const extra = Array.isArray(product?.gallery)
    ? product.gallery
    : Array.isArray(product?.galeria)
    ? product.galeria
    : [];

  const merged = [main, ...extra].filter(Boolean);
  return [...new Set(merged)];
};

const buildSpecs = (product) => {
  const specs = [];
  const ficha=product?.ficha||{};
  if(ficha.marca)specs.push(['Marca',ficha.marca]);
  if(ficha.contenido)specs.push(['Contenido',ficha.contenido]);
  if(ficha.medidas)specs.push(['Referencia',ficha.medidas]);
  if(ficha.color)specs.push(['Color',ficha.color]);
  if(ficha.cuidados)specs.push(['Cuidados',ficha.cuidados]);

  if (product?.modelo) specs.push(["Modelo", product.modelo]);
  if (product?.marca) specs.push(["Marca", product.marca]);
  if (product?.categoria) specs.push(["Categoría", product.categoria]);
  if (product?.material) specs.push(["Material", product.material]);
  if (product?.dimensiones) specs.push(["Dimensiones", product.dimensiones]);
  if (product?.peso) specs.push(["Peso", product.peso]);
  if (product?.color) specs.push(["Color", product.color]);
  if (product?.garantia) specs.push(["Garantía", product.garantia]);
  if (product?.stock !== undefined && product?.stock !== null) {
    specs.push(["Stock", String(product.stock)]);
  }
  if (product?.estado) specs.push(["Estado", product.estado]);

  if (specs.length === 0) {
    specs.push(["Categoría", product?.categoria || "No especificada"]);
    specs.push(["Stock", String(product?.stock ?? 0)]);
    specs.push(["Estado", product?.estado || "activo"]);
  }

  return specs;
};

export default function ProductDetail() {
  const latestCatalogRequest=useRef(0);
  useCatalogUpdates(() => { fetchProduct(true); fetchReviews(true); fetchRelatedProducts(true); });
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [loadingProduct, setLoadingProduct] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(true);

  const [productError, setProductError] = useState("");
  const [reviewsError, setReviewsError] = useState("");
  const [relatedError, setRelatedError] = useState("");

  const [mainImage, setMainImage] = useState("");
  const [quantity, setQuantity] = useState(1);


  const [addingCart, setAddingCart] = useState(false);

  const gallery = useMemo(() => buildGallery(product || {}), [product]);
  const specs = useMemo(() => buildSpecs(product || {}), [product]);

  const synchronizeProduct = useEffectEvent(() => {
    fetchProduct();
    if(localStorage.getItem("token")) api("/history",{method:"POST",body:JSON.stringify({id_producto:Number(id)})}).catch(()=>{});
    fetchReviews();
    fetchRelatedProducts();
  });
  useEffect(() => { synchronizeProduct(); }, [id]);

  useEffect(() => {
    if (gallery.length > 0) {
      setMainImage(gallery[0]);
    }
  }, [gallery]);

  const fetchProduct = async (silent = false) => {
    const requestId=++latestCatalogRequest.current;
    try {
      if (!silent) setLoadingProduct(true);
      setProductError("");

      const response = await appFetch(`${API_URL}/api/seller/products/${id}${silent ? "?view=0" : ""}`, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if(requestId!==latestCatalogRequest.current) return;

      if (!response.ok) {
        throw Object.assign(new Error(data.message || "No se pudo cargar el producto"),{status:response.status});
      }

      setProduct(data.product || null);
      setQuantity(value=>Math.max(1,Math.min(value,Number(data.product?.stock || 1))));
    } catch (error) {
      if(requestId!==latestCatalogRequest.current) return;
      console.error("fetchProduct error:", error);
      setProductError(error.message || "No se pudo cargar el producto");
      if (!silent || error.status===404) setProduct(null);
    } finally {
      if(requestId===latestCatalogRequest.current) setLoadingProduct(false);
    }
  };

  const fetchReviews = async (silent=false) => {
    try {
      if(!silent) setLoadingReviews(true);
      setReviewsError("");

      const response = await appFetch(`${API_URL}/api/reviews/product/${id}`, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar las reseñas");
      }

      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch (error) {
      console.error("fetchReviews error:", error);
      setReviewsError(error.message || "No se pudieron cargar las reseñas");
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const fetchRelatedProducts = async (silent=false) => {
    try {
      if(!silent) setLoadingRelated(true);
      setRelatedError("");

      const response = await appFetch(`${API_URL}/api/seller/products/${id}/related`, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar productos relacionados");
      }

      const allProducts = Array.isArray(data?.products)
        ? data.products
        : Array.isArray(data)
        ? data
        : [];

      const filtered = allProducts
        .filter((item) => String(getProductId(item)) !== String(id))
        .slice(0, 4);

      setRelatedProducts(filtered);
    } catch (error) {
      console.error("fetchRelatedProducts error:", error);
      setRelatedError(error.message || "No se pudieron cargar productos relacionados");
      setRelatedProducts([]);
    } finally {
      setLoadingRelated(false);
    }
  };

  const decreaseQuantity = () => {
    setQuantity((prev) => (prev > 1 ? prev - 1 : 1));
  };

  const increaseQuantity = () => {
    setQuantity((prev) => Math.min(Number(product?.stock || 1),prev + 1));
  };

  const handleAddToCart = async () => {
  const token = localStorage.getItem("token");
  const productId = getProductId(product);

  if (!token) {
    navigate("/login");
    return;
  }

  if (!productId) return;

  try {
    setAddingCart(true);

    const response = await appFetch(`${API_URL}/api/cart/add`, { // ✅ RUTA CORRECTA
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id_producto: productId, // ✅ CORRECTO
        cantidad: quantity,     // ✅ CORRECTO
      }),
    });

    // 👇 evita error del <!DOCTYPE
    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      console.error("Respuesta no es JSON:", text);
      throw new Error("Error inesperado del servidor");
    }

    if (!response.ok) {
      throw new Error(data.message || "No se pudo agregar al carrito");
    }


    navigate("/carrito");
  } catch (error) {
    console.error("handleAddToCart error:", error);

  } finally {
    setAddingCart(false);
  }
};

  if (loadingProduct) {
    return (
      <MainLayout>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-gray-600">Cargando producto...</p>
          </div>
        </main>
      </MainLayout>
    );
  }

  if (!product) {
    return (
      <MainLayout>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
            <h2 className="text-2xl font-bold text-gray-900">
              Producto no encontrado
            </h2>
            <p className="mt-2 text-gray-600">
              {productError || "No pudimos encontrar este producto."}
            </p>
          </div>
        </main>
      </MainLayout>
    );
  }

  const productName = getProductName(product);
  const productDescription = getProductDescription(product);
  const productPrice = getProductPrice(product);
  const productRating = getProductRating(product);
  const productReviewsCount = getProductReviews(product);
  const productImage = getProductImage(product);
  const activeImageIndex=Math.max(0,gallery.indexOf(mainImage));

  return (
    <MainLayout>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {productError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {productError}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-12">
          <div className="lg:w-1/2">
            <div className="relative bg-white rounded-xl shadow-sm overflow-hidden mb-4">
              <img loading="lazy"
                src={imageUrl(mainImage || productImage)}
                alt={productName}
                className="w-full h-[28rem] object-contain"
                onError={(e) => {
                  e.target.src =
                    "/product-placeholder.svg";
                }}
              />
              {gallery.length>1&&<>
                <span aria-live="polite" className="absolute right-3 top-3 rounded-full border border-gray-200 bg-white/95 px-3 py-1 text-xs font-semibold text-gray-700">Foto {activeImageIndex+1} de {gallery.length}</span>
                <button type="button" aria-label="Ver imagen anterior" onClick={()=>setMainImage(gallery[(activeImageIndex-1+gallery.length)%gallery.length])} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-sm hover:bg-amber-50"><ChevronLeft size={20}/></button>
                <button type="button" aria-label="Ver imagen siguiente" onClick={()=>setMainImage(gallery[(activeImageIndex+1)%gallery.length])} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-sm hover:bg-amber-50"><ChevronRight size={20}/></button>
              </>}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {gallery.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  aria-label={`Ver imagen ${index+1} de ${productName}`}
                  type="button"
                  aria-pressed={(mainImage || gallery[0]) === image}
                  onClick={() => setMainImage(image)}
                  className={`rounded-lg overflow-hidden border ${
                    mainImage === image
                      ? "border-amber-500"
                      : "border-gray-200 hover:border-amber-400"
                  }`}
                >
                  <img loading="lazy"
                    src={imageUrl(image)}
                    alt={`${productName} vista ${index + 1}`}
                    className="w-full h-24 object-cover"
                    onError={(e) => {
                      e.target.src =
                        "/product-placeholder.svg";
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="lg:w-1/2">
            {product?.id_vendedor&&<Link to={`/tienda/${product.id_vendedor}`} className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-amber-800 underline underline-offset-4">Conoce {product.vendedor_nombre||'la tienda'}</Link>}
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {productName}
            </h1>

            <div className="flex items-center mb-4">
              <div className="flex text-amber-400">
                {Array.from({ length: 5 }).map((_, index) => {
                  const filled = index < Math.round(productRating);

                  return (
                    <Star
                      key={index}
                      size={18}
                      fill={filled ? "currentColor" : "none"}
                      strokeWidth={1.5}
                    />
                  );
                })}
              </div>
              <span className="text-gray-500 ml-2">
                {productRating > 0 ? productRating.toFixed(1) : "0.0"} ({productReviewsCount} {productReviewsCount===1?"reseña":"reseñas"})
              </span>
              <a href="#calificar-producto" className="ml-4 inline-flex min-h-11 items-center text-sm font-bold text-amber-900 underline">Calificar producto</a>
            </div>

            <p className="text-2xl font-semibold text-gray-900 mb-4">
              {formatPrice(productPrice)}
            </p>

            <div className="mb-6">
              <p className="text-sm text-gray-500">Modelo</p>
              <p className="text-base font-semibold text-gray-900">
                {product?.modelo || `REF-${getProductId(product)}`}
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Descripción del producto
              </h3>

              <p className="text-gray-700 leading-relaxed">
                {productDescription || "Sin descripción disponible."}
              </p>
              {product?.ficha?.es_demo&&<p className="mt-3 text-xs leading-relaxed text-gray-500">Producto de demostración. Fotos generadas por IA; precio, características y existencias ficticios.</p>}
            </div>

            <div className="mb-8">
              <div className="flex items-center mb-4">
                <p role="status" className="mr-3 text-sm font-semibold">Disponibles: {Number(product?.stock||0)}</p>
                <span className="text-gray-700 mr-4">Cantidad:</span>

                <div className="flex items-center border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    aria-label="Reducir cantidad" disabled={quantity<=1} onClick={decreaseQuantity}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200"
                  >
                    -
                  </button>
                  <span className="px-4 py-1">{quantity}</span>
                  <button
                    type="button"
                    aria-label="Aumentar cantidad" disabled={quantity>=Number(product?.stock||0)} onClick={increaseQuantity}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={addingCart || Number(product?.stock || 0)===0}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {addingCart ? "Agregando..." : "Añadir al carrito"}
              </button>
            </div>

            <div className="border-t border-gray-200 pt-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Ficha técnica
              </h3>

              <div className="border rounded-xl overflow-hidden">
                {specs.map(([key, value]) => (
                  <div
                    key={key}
                    className="grid grid-cols-2 border-b last:border-b-0"
                  >
                    <div className="bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600 capitalize">
                      {key}
                    </div>
                    <div className="px-4 py-3 text-sm text-gray-900">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ProductReviewForm key={id} productId={Number(id)} onSaved={async()=>{await Promise.all([fetchProduct(true),fetchReviews(true)]);}}/>
          </div>
        </div>

        <section id="opiniones" className="mt-16 scroll-mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Reseñas de usuarios
          </h2>
          <p className="mb-5 text-sm text-stone-500">{productReviewsCount} {productReviewsCount===1?"opinión":"opiniones"} · {productRating.toFixed(1)} de 5 estrellas. {productReviewsCount>50?"Mostramos las 50 opiniones más recientes.":""}</p>

          {reviewsError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {reviewsError}
            </div>
          )}

          {loadingReviews ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
              <p className="text-gray-600">Cargando reseñas...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
              <p className="text-gray-600">Aún no hay reseñas para este producto.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => {
                const reviewerName =
                  `${review?.nombre || ""} ${review?.apellido || ""}`.trim() ||
                  "Usuario";

                return (
                  <article
                    key={review.id_resena}
                    className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-100">
                        {review?.foto ? (
                          <img loading="lazy"
                            src={imageUrl(review.foto)}
                            alt={reviewerName}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : null}
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {reviewerName}
                            </h3>
                            <div className="mt-1 flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, index) => {
                                const filled = index < Number(review?.puntuacion || 0);

                                return (
                                  <Star
                                    key={index}
                                    size={16}
                                    className={
                                      filled
                                        ? "fill-amber-400 text-amber-400"
                                        : "text-gray-300"
                                    }
                                  />
                                );
                              })}
                            </div>
                          </div>

                          <p className="text-sm text-gray-500">
                            {review?.fecha_actualizacion
                              ? new Date(review.fecha_actualizacion).toLocaleDateString("es-CO")
                              : ""}
                          </p>
                        </div>

                        <p className="mt-3 text-sm leading-relaxed text-gray-700">
                          {review?.comentario || "Sin comentario."}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            También te puede interesar
          </h2>

          {relatedError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {relatedError}
            </div>
          )}

          {loadingRelated ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
              <p className="text-gray-600">Cargando productos relacionados...</p>
            </div>
          ) : relatedProducts.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
              <p className="text-gray-600">No hay productos relacionados disponibles.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((item) => (
                <article
                  key={getProductId(item)}
                  className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition"
                >
                  <Link to={`/producto/${getProductId(item)}`}>
                    <img loading="lazy"
                      src={imageUrl(getProductImage(item))}
                      alt={getProductName(item)}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        e.target.src =
                          "https://via.placeholder.com/400x400?text=Producto";
                      }}
                    />
                  </Link>

                  <div className="p-4">
                    <Link to={`/producto/${getProductId(item)}`}>
                      <h3 className="font-medium text-gray-900 mb-1">
                        {getProductName(item)}
                      </h3>
                    </Link>

                    <p className="text-amber-600 font-medium">
                      {formatPrice(getProductPrice(item))}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </MainLayout>
  );
}
