import { API_URL } from '../services/apiConfig.js';
import { appFetch } from "../services/notifications.js";
import useCatalogUpdates from "../hooks/useCatalogUpdates";
import { imageUrl } from "../services/api";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProductPagination from "../components/ProductPagination";
import Recommendations from "../components/Recommendations";
import MainLayout from "../components/layout/MainLayout";


const productsPerPage = 8;

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

const getProductPrice = (product) =>
  Number(product?.precio || product?.price || 0);

const getProductImage = (product) =>
  product?.imagen ||
  product?.image ||
  product?.imagen_url ||
  product?.image_url ||
  "/product-placeholder.svg";

const getProductSales = (product) =>
  Number(product?.ventas || product?.sales || 0);

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

export default function Home() {
  const latestCatalogRequest=useRef(0);
  const navigate = useNavigate();
  const productsRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState("");

  const [sortBy, setSortBy] = useState("destacados");
  const [category, setCategory] = useState("todas");
  const [requestedPage, setCurrentPage] = useState(1);

  const fetchProducts = async (silent=false) => {
    const requestId=++latestCatalogRequest.current;
      try {
        if(!silent) setLoadingProducts(true);
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
        if(!silent) setProducts([]);
      } finally {
        if(requestId===latestCatalogRequest.current) setLoadingProducts(false);
      }
  };
  const initializeCatalog = useEffectEvent(()=>{fetchProducts();});
  useEffect(()=>{initializeCatalog();},[]);
  useCatalogUpdates(()=>fetchProducts(true));

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (category !== "todas") {
      result = result.filter(
        (product) => mapCategoryValue(product) === category
      );
    }

    if (sortBy === "precio-asc") {
      result.sort((a, b) => getProductPrice(a) - getProductPrice(b));
    } else if (sortBy === "precio-desc") {
      result.sort((a, b) => getProductPrice(b) - getProductPrice(a));
    } else if (sortBy === "mas-vendidos") {
      result.sort((a, b) => getProductSales(b) - getProductSales(a));
    } else {
      result.sort((a, b) => {
        const aDate = new Date(a?.fecha_creacion || 0).getTime();
        const bDate = new Date(b?.fecha_creacion || 0).getTime();
        return bDate - aDate;
      });
    }

    return result;
  }, [products, sortBy, category]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage));
  const currentPage=Math.min(requestedPage,totalPages);

  const visibleProducts = useMemo(() => {
    const start = (currentPage - 1) * productsPerPage;
    return filteredProducts.slice(start, start + productsPerPage);
  }, [filteredProducts, currentPage]);

  const handleCategoryChange = (e) => {
    setCategory(e.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setCurrentPage(1);
  };

  const handleExploreProducts = () => {
    productsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleViewProduct = (id) => {
    navigate(`/producto/${id}`);
  };

  return (
    <MainLayout>
      <section
        className="relative flex h-[28rem] items-center bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://plus.unsplash.com/premium_photo-1736194029253-e6e8cbd42087?auto=format&fit=crop&q=80&w=1170')",
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4">
          <div className="max-w-2xl text-white">
            <h1 className="mb-4 text-4xl font-bold md:text-5xl">
              Descubre las tiendas de la Sabana
            </h1>
            <p className="mb-8 text-lg md:text-xl">
              Utensilios de cocina y piezas únicas hechas a mano con amor y
              tradición.
            </p>
            <button
              type="button"
              onClick={handleExploreProducts}
              className="rounded-lg bg-amber-600 px-8 py-3 font-semibold text-white transition hover:bg-amber-700"
            >
              Explorar productos
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
          <select aria-label="Ordenar productos"
            value={sortBy}
            onChange={handleSortChange}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 md:w-auto"
          >
            <option value="destacados">Destacados</option>
            <option value="mas-vendidos">Más vendidos</option>
            <option value="precio-asc">Precio ascendente</option>
            <option value="precio-desc">Precio descendente</option>
          </select>

          <select aria-label="Filtrar por categoría"
            value={category}
            onChange={handleCategoryChange}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 md:w-auto"
          >
            <option value="todas">Todas las categorías</option>
            <option value="ceramica">Cerámica</option>
            <option value="acero">Acero inoxidable</option>
            <option value="utensilios">Utensilios</option>
            <option value="artesanias">Artesanías</option>
            <option value="accesorios">Accesorios</option>
            <option value="ofertas">Ofertas</option>
          </select>
        </div>
      </section>

      <section ref={productsRef} className="scroll-mt-36 mx-auto max-w-7xl px-4 pb-14">
        <h2 className="mb-8 text-2xl font-bold">Nuestros productos destacados</h2>

        {productsError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {productsError}
          </div>
        )}

        {loadingProducts ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-gray-600">Cargando productos...</p>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
            <h3 className="text-xl font-bold text-gray-900">
              No se encontraron productos
            </h3>
            <p className="mt-2 text-gray-600">
              Intenta cambiar la categoría o el ordenamiento.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((product) => {
                const productId = getProductId(product);
                const productName = getProductName(product);
                const productPrice = getProductPrice(product);
                const productImage = getProductImage(product);

                return (
                  <article
                    key={productId}
                    className="overflow-hidden rounded-lg bg-white shadow-md transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <img loading="lazy"
                      src={imageUrl(productImage)}
                      alt={productName}
                      className="h-52 w-full object-cover"
                      onError={(e) => {
                        e.target.src =
                          "/product-placeholder.svg";
                      }}
                    />

                    <div className="p-4">
                      <h3 className="mb-1 text-lg font-semibold">
                        {productName}
                      </h3>
                      <p className="mb-3 font-bold text-amber-600">
                        {formatPrice(productPrice)}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleViewProduct(productId)}
                        className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white transition hover:bg-amber-700"
                      >
                        Ver más
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <ProductPagination page={currentPage} pageCount={totalPages} total={filteredProducts.length} pageSize={productsPerPage} onPageChange={page=>{setCurrentPage(page);productsRef.current?.scrollIntoView({behavior:'smooth',block:'start'});}}/>
          </>
        )}
      </section>

      <Recommendations />
    </MainLayout>
  );
}
