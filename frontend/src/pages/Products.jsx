import { API_URL } from '../services/apiConfig.js';
import ProductPagination from "../components/ProductPagination";
import { appFetch } from "../services/notifications.js";
import useCatalogUpdates from "../hooks/useCatalogUpdates";
import { imageUrl } from "../services/api";
import {
  SlidersHorizontal,
  Grid2X2,
  List,
  Star,
  Heart,
  ShoppingCart,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import MainLayout from "../components/layout/MainLayout";



const categoryOptionsBase = [
  { label: "Todas las categorías", value: "todas" },
  { label: "Cerámica", value: "ceramica" },
  { label: "Acero inoxidable", value: "acero" },
  { label: "Utensilios", value: "utensilios" },
  { label: "Artesanías", value: "artesanias" },
  { label: "Vajillas", value: "vajillas" },
  { label: "Accesorios", value: "accesorios" },
  { label: "Ofertas", value: "ofertas" },
];

const priceRanges = [
  { label: "$10.000 - $50.000", min: 10000, max: 50000 },
  { label: "$50.000 - $100.000", min: 50000, max: 100000 },
  { label: "$100.000 - $150.000", min: 100000, max: 150000 },
  { label: "$150.000 - $300.000", min: 150000, max: 300000 },
  { label: "$300.000 - $500.000", min: 300000, max: 500000 },
];

const formatPrice = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");

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

const getProductStock = (product) =>
  product?.stock ?? product?.stock_label ?? 0;

const getProductBrand = (product) =>
  product?.marca ||
  product?.brand ||
  product?.vendedor_nombre ||
  "Wireless Cooking";

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

const getProductBadge = (product) => {
  if (Number(product?.stock || 0) > 0) return "Disponible";
  return "Sin stock";
};

const getProductModel = (product) =>
  product?.modelo || product?.model || `REF-${getProductId(product)}`;

const getProductTechnicalSheet = (product) =>
  product?.ficha_tecnica ||
  product?.technicalSheet ||
  product?.descripcion ||
  "Producto disponible en catálogo.";

const mapCategoryValue = (product) => {
  const raw =
    product?.categoria ||
    product?.category ||
    product?.nombre_categoria ||
    product?.slug_categoria;

  if (raw) {
    const normalized = normalizeText(raw);

    if (normalized.includes("ceram")) return "ceramica";
    if (normalized.includes("acero")) return "acero";
    if (normalized.includes("utens")) return "utensilios";
    if (normalized.includes("artesan")) return "artesanias";
    if (normalized.includes("vajilla")) return "vajillas";
    if (normalized.includes("accesorio")) return "accesorios";
    if (normalized.includes("oferta")) return "ofertas";

    return normalized;
  }

  const byId = Number(product?.id_categoria);

  if (byId === 1) return "ceramica";
  if (byId === 2) return "acero";
  if (byId === 3) return "utensilios";
  if (byId === 4) return "artesanias";
  if (byId === 5) return "vajillas";
  if (byId === 6) return "accesorios";
  if (byId === 7) return "ofertas";

  return "sin-categoria";
};

function ProductCard({
  product,
  favoriteIds,
  togglingFavoriteId,
  addingCartId,
  onToggleFavorite,
  onAddToCart,
}) {
  const productId = getProductId(product);
  const productName = getProductName(product);
  const productDescription = getProductDescription(product);
  const productPrice = getProductPrice(product);
  const productImage = getProductImage(product);
  const productBrand = getProductBrand(product);
  const productRating = getProductRating(product);
  const productReviews = getProductReviews(product);
  const productBadge = getProductBadge(product);
  const productModel = getProductModel(product);
  const productTechnicalSheet = getProductTechnicalSheet(product);
  const isFavorite = favoriteIds.includes(productId);

  return (
    <article className="group overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-1 hover:shadow-lg">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            productBadge === "Disponible"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          <span role="status">{productBadge}{getProductStock(product)>0 ? ` · ${getProductStock(product)} unidades` : ''}</span>
        </span>

        <button
          type="button"
          onClick={() => onToggleFavorite(product)}
          disabled={togglingFavoriteId === productId}
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200 transition disabled:opacity-60 ${
            isFavorite
              ? "text-rose-500"
              : "text-gray-700 hover:text-rose-500"
          }`}
          title={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
        >
          <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gray-50">
        <Link to={`/producto/${productId}`}>
          <img loading="lazy"
            src={imageUrl(productImage)}
            alt={productName}
            className="h-64 w-full object-contain transition duration-500 group-hover:scale-105"
            onError={(e) => {
              e.target.src =
                "/product-placeholder.svg";
            }}
          />
        </Link>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-500">{productBrand}</p>

        <Link to={`/producto/${productId}`}>
          <h3 className="mt-1 line-clamp-3 min-h-[78px] text-lg font-bold leading-6 text-gray-900 transition group-hover:text-amber-700">
            {productName}
          </h3>
        </Link>

        <p className="mt-2 text-sm text-gray-500">{productModel}</p>

        <div className="mt-3 flex items-center gap-1">
          {[...Array(5)].map((_, i) => {
            const filled = i < Math.round(productRating);

            return (
              <Star
                key={i}
                size={15}
                className={
                  filled ? "fill-amber-400 text-amber-400" : "text-gray-300"
                }
              />
            );
          })}

          <span className="ml-1 text-sm text-gray-500">
            {productRating > 0 ? productRating.toFixed(1) : "0.0"} ({productReviews})
          </span>
        </div>

        <div className="mt-4">
          <p className="text-3xl font-extrabold text-gray-900">
            {formatPrice(productPrice)}
          </p>
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-gray-600">
          {productDescription}
        </p>

        <p className="mt-2 line-clamp-2 text-xs text-gray-500">
          {productTechnicalSheet}
        </p>

        <button
          type="button"
          onClick={() => onAddToCart(product)}
          disabled={addingCartId === productId}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <ShoppingCart size={17} />
          {addingCartId === productId ? "Agregando..." : "Agregar al carrito"}
        </button>
      </div>
    </article>
  );
}

export default function Products() {
  const latestCatalogRequest=useRef(0);
  useCatalogUpdates(() => { fetchProducts(true); });
  const location = useLocation();
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(location.search);
  const categoriaUrl = urlParams.get("categoria") || "todas";

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState("");

  const [favoriteIds, setFavoriteIds] = useState([]);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState(null);
  const [addingCartId, setAddingCartId] = useState(null);
  const [cartMessage,setCartMessage] = useState('');

  const [selectedCategory, setSelectedCategory] = useState(categoriaUrl);
  const [searchTerm, setSearchTerm] = useState(urlParams.get("q") || "");
  const [sortBy, setSortBy] = useState("recomendados");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedStock, setSelectedStock] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedPriceRange, setSelectedPriceRange] = useState("");
  const [freeShippingOnly, setFreeShippingOnly] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [pagination, setPagination] = useState({key:'',page:1});
  const [showFilters,setShowFilters] = useState(false);

  useEffect(() => {
    setSelectedCategory(categoriaUrl);
    setSearchTerm(new URLSearchParams(location.search).get("q") || "");
  }, [categoriaUrl, location.search]);

  const getToken = () => localStorage.getItem("token");

  const fetchProducts = async (silent = false) => {
    const requestId=++latestCatalogRequest.current;
    try {
      if (!silent) setLoadingProducts(true);
      setProductsError("");

      const response = await appFetch(`${API_URL}/api/seller/products`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if(requestId!==latestCatalogRequest.current) return;

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los productos");
      }

      const productsArray = Array.isArray(data)
        ? data
        : Array.isArray(data?.products)
        ? data.products
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setProducts(productsArray);
    } catch (error) {
      if(requestId!==latestCatalogRequest.current) return;
      console.error("fetchProducts error:", error);
      setProductsError(error.message || "No se pudieron cargar los productos");
      if (!silent) setProducts([]);
    } finally {
      if(requestId===latestCatalogRequest.current) setLoadingProducts(false);
    }
  };

  const fetchFavorites = async () => {
    const token = getToken();

    if (!token) {
      setFavoriteIds([]);
      return;
    }

    try {
      const response = await appFetch(`${API_URL}/api/favorites`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar favoritos");
      }

      const favoritesArray = Array.isArray(data)
        ? data
        : Array.isArray(data?.favorites)
        ? data.favorites
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const ids = favoritesArray
        .map((item) => item?.product_id || item?.id_producto || item?.id)
        .filter(Boolean);

      setFavoriteIds(ids);
    } catch (error) {
      console.error("fetchFavorites error:", error);
      setFavoriteIds([]);
    }
  };

  const synchronizeProducts = useEffectEvent(() => {
    fetchProducts();
    fetchFavorites();
  });
  useEffect(() => { synchronizeProducts(); }, []);

  const toggleArrayValue = (value, currentArray, setArray) => {
    if (currentArray.includes(value)) {
      setArray(currentArray.filter((item) => item !== value));
    } else {
      setArray([...currentArray, value]);
    }
  };

  const handleCategoryChange = (value) => {
    setSelectedCategory(value);
    navigate(`/productos?categoria=${value}`);
  };

  const applyManualPrice = () => {
    setSelectedPriceRange("");
  };

  const clearFilters = () => {
    setSelectedCategory("todas");
    setSearchTerm("");
    setSortBy("recomendados");
    setMinPrice("");
    setMaxPrice("");
    setSelectedStock([]);
    setSelectedBrands([]);
    setSelectedPriceRange("");
    setFreeShippingOnly(false);
    navigate("/productos?categoria=todas");
  };

  const handleToggleFavorite = async (product) => {
    const token = getToken();
    const productId = getProductId(product);

    if (!token) {
      navigate("/login");
      return;
    }

    if (!productId) return;

    try {
      setTogglingFavoriteId(productId);

      const isFavorite = favoriteIds.includes(productId);

      const response = await appFetch(
        isFavorite
          ? `${API_URL}/api/favorites/${productId}`
          : `${API_URL}/api/favorites`,
        {
          method: isFavorite ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: isFavorite ? undefined : JSON.stringify({ productId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo actualizar favoritos");
      }

      setFavoriteIds((prev) =>
        isFavorite
          ? prev.filter((id) => id !== productId)
          : [...prev, productId]
      );
    } catch (error) {
      console.error("handleToggleFavorite error:", error);

    } finally {
      setTogglingFavoriteId(null);
    }
  };

  const handleAddToCart = async (product) => {
  const token = getToken();
  const productId = getProductId(product);

  if (!token) {
    navigate("/login");
    return;
  }

  if (!productId) return;

  try {
    setAddingCartId(productId);

    const response = await appFetch(`${API_URL}/api/cart/add`, { // ✅ RUTA CORRECTA
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id_producto: productId, // ✅ NOMBRE CORRECTO
        cantidad: 1,            // ✅ NOMBRE CORRECTO
      }),
    });

    // 👇 IMPORTANTE: evitar error del <!DOCTYPE
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

    setCartMessage(`${getProductName(product)} agregado al carrito.`);
  } catch (error) {
    console.error("handleAddToCart error:", error);
    setCartMessage(error.message || "No se pudo agregar al carrito");
  } finally {
    setAddingCartId(null);
  }
};

  const stockOptions = useMemo(() => {
    const unique = [...new Set(products.map((p) => String(getProductStock(p))))];
    return unique.filter((value) => value && value !== "0");
  }, [products]);

  const brandOptions = useMemo(() => {
    return [...new Set(products.map((p) => getProductBrand(p)))];
  }, [products]);

  const categoryOptions = useMemo(() => {
    const dynamicCategories = [...new Set(products.map((p) => mapCategoryValue(p)))];

    const extras = dynamicCategories
      .filter(
        (value) =>
          value &&
          value !== "todas" &&
          !categoryOptionsBase.some((item) => item.value === value)
      )
      .map((value) => ({
        label: value.replace(/-/g, " "),
        value,
      }));

    return [...categoryOptionsBase, ...extras];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    const sellerId = new URLSearchParams(location.search).get("vendedor");
    if (sellerId) result = result.filter(p => String(p.id_vendedor) === sellerId);

    if (selectedCategory !== "todas") {
      result = result.filter(
        (product) => mapCategoryValue(product) === selectedCategory
      );
    }

    if (searchTerm.trim()) {
      const text = searchTerm.toLowerCase();

      result = result.filter((product) => {
        const name = getProductName(product).toLowerCase();
        const brand = getProductBrand(product).toLowerCase();
        const description = getProductDescription(product).toLowerCase();
        const model = getProductModel(product).toLowerCase();
        const technicalSheet = getProductTechnicalSheet(product).toLowerCase();

        return (
          name.includes(text) ||
          brand.includes(text) ||
          description.includes(text) ||
          model.includes(text) ||
          technicalSheet.includes(text)
        );
      });
    }

    if (selectedStock.length > 0) {
      result = result.filter((product) =>
        selectedStock.includes(String(getProductStock(product)))
      );
    }

    if (selectedBrands.length > 0) {
      result = result.filter((product) =>
        selectedBrands.includes(getProductBrand(product))
      );
    }

    if (freeShippingOnly) {
      result = result.filter((product) => Number(getProductStock(product)) > 0);
    }

    if (selectedPriceRange) {
      const range = priceRanges.find((item) => item.label === selectedPriceRange);

      if (range) {
        result = result.filter((product) => {
          const price = getProductPrice(product);
          return price >= range.min && price <= range.max;
        });
      }
    }

    const parsedMin = Number(String(minPrice).replace(/\D/g, ""));
    const parsedMax = Number(String(maxPrice).replace(/\D/g, ""));

    if (minPrice !== "" && !Number.isNaN(parsedMin) && parsedMin > 0) {
      result = result.filter((product) => getProductPrice(product) >= parsedMin);
    }

    if (maxPrice !== "" && !Number.isNaN(parsedMax) && parsedMax > 0) {
      result = result.filter((product) => getProductPrice(product) <= parsedMax);
    }

    if (sortBy === "menor-precio") {
      result.sort((a, b) => getProductPrice(a) - getProductPrice(b));
    } else if (sortBy === "mayor-precio") {
      result.sort((a, b) => getProductPrice(b) - getProductPrice(a));
    } else if (sortBy === "mejor-calificados") {
      result.sort((a, b) => getProductRating(b) - getProductRating(a));
    } else if (sortBy === "mas-vendidos") {
      result.sort((a, b) => Number(b.ventas || 0) - Number(a.ventas || 0));
    }

    return result;
  }, [
    products,
    location.search,
    selectedCategory,
    searchTerm,
    selectedStock,
    selectedBrands,
    freeShippingOnly,
    selectedPriceRange,
    minPrice,
    maxPrice,
    sortBy,
  ]);

  const pageKey=JSON.stringify([location.search,selectedCategory,searchTerm,selectedStock,selectedBrands,freeShippingOnly,selectedPriceRange,minPrice,maxPrice,sortBy]);
  const pageCount=Math.max(1,Math.ceil(filteredProducts.length/24));
  const page=Math.min(pagination.key===pageKey?pagination.page:1,pageCount);
  const visibleProducts=filteredProducts.slice((page-1)*24,page*24);

  return (
    <MainLayout>
      <section className="min-h-[calc(100vh-160px)] bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-amber-600 shadow-sm">
              <SlidersHorizontal size={16} />
              Catálogo de productos
            </p>

            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">
              Productos para tu cocina
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600 md:text-base">
              Explora nuestro catálogo con filtros, ordenamiento y una vista cómoda
              para encontrar exactamente lo que necesitas.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
            <button type="button" aria-expanded={showFilters} aria-controls="catalog-filters" onClick={()=>setShowFilters(!showFilters)} className="rounded-xl border bg-white px-4 py-3 text-left font-bold lg:hidden">{showFilters?'Ocultar filtros':'Mostrar filtros'}</button>
            <aside id="catalog-filters" className={`${showFilters?'':'hidden'} h-fit rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100 lg:block`}>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Filtros</h2>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-semibold text-amber-600"
                >
                  Limpiar
                </button>
              </div>

              <div className="space-y-6">
                <div className="border-b border-gray-100 pb-6">
                  <div className="mb-4 flex w-full items-center justify-between text-left">
                    <span className="text-base font-bold text-gray-900">
                      Categoría
                    </span>
                    <ChevronDown size={18} className="text-gray-500" />
                  </div>

                  <div className="space-y-3">
                    {categoryOptions.map((item) => (
                      <label
                        key={item.value}
                        className="flex cursor-pointer items-center gap-3 text-sm text-gray-700"
                      >
                        <input
                          type="radio"
                          name="category"
                          checked={selectedCategory === item.value}
                          onChange={() => handleCategoryChange(item.value)}
                          className="h-5 w-5 border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="capitalize">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-b border-gray-100 pb-6">
                  <div className="mb-4 flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-4">
                    <div>
                      <p className="font-semibold text-gray-900">Disponibles</p>
                      <p className="text-sm text-gray-500">
                        Mostrar solo productos con stock
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch" aria-label="Mostrar solo productos disponibles" aria-checked={freeShippingOnly}
                      onClick={() => setFreeShippingOnly((prev) => !prev)}
                      className={`flex h-8 w-14 items-center rounded-full p-1 transition ${
                        freeShippingOnly ? "bg-amber-500 justify-end" : "bg-gray-200"
                      }`}
                    >
                      <div className="h-6 w-6 rounded-full bg-white shadow-sm" />
                    </button>
                  </div>
                </div>

                <div className="border-b border-gray-100 pb-6">
                  <div className="mb-4 flex w-full items-center justify-between text-left">
                    <span className="text-base font-bold text-gray-900">
                      Stock
                    </span>
                    <ChevronDown size={18} className="text-gray-500" />
                  </div>

                  <div className="max-h-48 space-y-3 overflow-y-auto">
                    {stockOptions.map((item) => (
                      <label
                        key={item}
                        className="flex cursor-pointer items-center gap-3 text-sm text-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStock.includes(item)}
                          onChange={() =>
                            toggleArrayValue(item, selectedStock, setSelectedStock)
                          }
                          className="h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-b border-gray-100 pb-6">
                  <div className="mb-4 flex w-full items-center justify-between text-left">
                    <span className="text-base font-bold text-gray-900">Precio</span>
                    <ChevronDown size={18} className="text-gray-500" />
                  </div>

                  <div className="mb-5">
                    <p className="mb-3 text-sm font-medium text-gray-700">
                      Escribe tu rango
                    </p>

                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label htmlFor="products-field-1" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Desde
                        </label>
                        <input id="products-field-1"
                          type="text"
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                          placeholder="$ 0"
                          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
                        />
                      </div>

                      <span className="mt-6 text-gray-400">-</span>

                      <div className="flex-1">
                        <label htmlFor="products-field-2" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Hasta
                        </label>
                        <input id="products-field-2"
                          type="text"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                          placeholder="$ 1.000.000"
                          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={applyManualPrice}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      Aplicar rango
                      <ArrowRight size={16} />
                    </button>
                  </div>

                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <p className="text-sm font-medium text-gray-700">
                      O selecciona uno
                    </p>

                    {priceRanges.map((item) => (
                      <label
                        key={item.label}
                        className="flex cursor-pointer items-center gap-3 text-sm text-gray-700"
                      >
                        <input
                          type="radio"
                          name="price-range"
                          checked={selectedPriceRange === item.label}
                          onChange={() => {
                            setSelectedPriceRange(item.label);
                            setMinPrice("");
                            setMaxPrice("");
                          }}
                          className="h-5 w-5 border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-b border-gray-100 pb-6">
                  <div className="mb-4 flex w-full items-center justify-between text-left">
                    <span className="text-base font-bold text-gray-900">Marca</span>
                    <ChevronDown size={18} className="text-gray-500" />
                  </div>

                  <div className="max-h-48 space-y-3 overflow-y-auto">
                    {brandOptions.map((item) => (
                      <label
                        key={item}
                        className="flex cursor-pointer items-center gap-3 text-sm text-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBrands.includes(item)}
                          onChange={() =>
                            toggleArrayValue(item, selectedBrands, setSelectedBrands)
                          }
                          className="h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            <div>
              <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <input aria-label="Buscar productos, modelos o descripción..."
                    type="text"
                    placeholder="Buscar productos, modelos o descripción..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="min-w-[260px] rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  />

                  <select aria-label="Ordenar productos"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  >
                    <option value="recomendados">Recomendados</option>
                    <option value="menor-precio">Menor precio</option>
                    <option value="mayor-precio">Mayor precio</option>
                    <option value="mas-vendidos">Más vendidos</option>
                    <option value="mejor-calificados">Mejor calificados</option>
                  </select>

                  <span className="text-sm text-gray-500">
                    {filteredProducts.length} productos
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Vista en cuadrícula" aria-pressed={viewMode === "grid"}
                    onClick={() => setViewMode("grid")}
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                      viewMode === "grid"
                        ? "border-amber-500 bg-amber-50 text-amber-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                    }`}
                  >
                    <Grid2X2 size={18} />
                  </button>

                  <button
                    type="button"
                    aria-label="Vista en lista" aria-pressed={viewMode === "list"}
                    onClick={() => setViewMode("list")}
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                      viewMode === "list"
                        ? "border-amber-500 bg-amber-50 text-amber-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                    }`}
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>

              <p role="status" className="mb-4 text-sm font-semibold text-amber-900">{cartMessage}</p>
              {productsError && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {productsError}
                </div>
              )}

              {loadingProducts ? (
                <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
                  <p className="text-gray-600">Cargando productos...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
                  <h3 className="text-xl font-bold text-gray-900">
                    No se encontraron productos
                  </h3>
                  <p className="mt-2 text-gray-600">
                    Prueba cambiando la categoría o ajustando los filtros.
                  </p>
                </div>
              ) : (
                <div
                  className={
                    viewMode === "grid"
                      ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
                      : "grid gap-5 grid-cols-1"
                  }
                >
                  {visibleProducts.map((product) => (
                    <ProductCard
                      key={getProductId(product)}
                      product={product}
                      favoriteIds={favoriteIds}
                      togglingFavoriteId={togglingFavoriteId}
                      addingCartId={addingCartId}
                      onToggleFavorite={handleToggleFavorite}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              )}
              {!loadingProducts&&<ProductPagination page={page} pageCount={pageCount} total={filteredProducts.length} pageSize={24} onPageChange={value=>setPagination({key:pageKey,page:value})}/>}
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
