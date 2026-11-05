import { API_URL } from '../services/apiConfig.js';
import { appFetch } from "../services/notifications.js";
import { imageUrl } from "../services/api";
import { useEffect, useEffectEvent, useState } from "react";
import { ArrowLeft, Package, Save } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import ProductGalleryEditor from "../components/ProductGalleryEditor";
import useProductGallery from "../hooks/useProductGallery";
import { appendGallery, photosFromProduct, validateGallery } from "../services/productGallery";



export default function EditarProducto() {
  const navigate = useNavigate();
  const { id } = useParams();
  const token = localStorage.getItem("token");
  const savedUser = JSON.parse(localStorage.getItem("user") || "null");

  const [form, setForm] = useState({
    nombre: "",
    material: "",
    descripcion: "",
    precio: "",
    stock: "",
    estado: "activo",
    id_categoria: "",
  });

  const gallery = useProductGallery();
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const initializeProduct = useEffectEvent(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    if (savedUser?.rol !== "vendedor" && savedUser?.rol !== "admin") {
      navigate("/perfil", { replace: true });
      return;
    }

    fetchCategories();
    fetchProduct();
  });
  useEffect(() => { initializeProduct(); }, [id, token, savedUser?.rol]);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);

      const response = await appFetch(
        `${API_URL}/api/seller/products/categories/list`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar las categorías.");
      }

      setCategories(Array.isArray(data.categories) ? data.categories : []);
    } catch (error) {
      console.error("fetchCategories error:", error);
      setPageError(
        (prev) =>
          prev || error.message || "No se pudieron cargar las categorías."
      );
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchProduct = async () => {
    try {
      setLoadingProduct(true);
      setPageError("");

      const response = await appFetch(`${API_URL}/api/seller/products/mine/${id}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo cargar el producto.");
      }

      const product = data.product || {};

      setForm({
        nombre: product.nombre || "",
        material: product.material || "",
        descripcion: product.descripcion || "",
        precio:
          product.precio !== undefined && product.precio !== null
            ? String(product.precio)
            : "",
        stock:
          product.stock !== undefined && product.stock !== null
            ? String(product.stock)
            : "",
            estado: product.estado || "activo",
        id_categoria:
          product.id_categoria !== undefined && product.id_categoria !== null
            ? String(product.id_categoria)
            : "",
      });

      gallery.setPhotos(photosFromProduct(product));
    } catch (error) {
      console.error("fetchProduct error:", error);
      setPageError(error.message || "No se pudo cargar el producto.");
    } finally {
      setLoadingProduct(false);
    }
  };

  const previewImage = gallery.photos[0]?.url || "/product-placeholder.svg";

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setPageError("");
    setSuccessMessage("");
  };

  const validateForm = () => {
    if (!form.nombre.trim()) {
      return "El nombre del producto es obligatorio.";
    }

    if (!form.descripcion.trim()) {
      return "La descripción del producto es obligatoria.";
    }

    if (
      form.precio === "" ||
      Number.isNaN(Number(form.precio)) ||
      Number(form.precio) < 0
    ) {
      return "El precio debe ser un número válido mayor o igual a 0.";
    }

    if (
      form.stock === "" ||
      Number.isNaN(Number(form.stock)) ||
      Number(form.stock) < 0 ||
      !Number.isInteger(Number(form.stock))
    ) {
      return "El stock debe ser un número entero mayor o igual a 0.";
    }

    if (!form.id_categoria) {
      return "Debes seleccionar una categoría.";
    }

    if (!["activo", "pausado", "agotado"].includes(form.estado)) {
      return "El estado seleccionado no es válido.";
    }

    return validateGallery(gallery.photos);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setPageError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setPageError("");
      setSuccessMessage("");

      const formData = new FormData();
      formData.append("nombre", form.nombre.trim());
      formData.append("material", form.material || "");
      formData.append("descripcion", form.descripcion.trim());
      formData.append("precio", String(Number(form.precio)));
      formData.append("stock", String(Number(form.stock)));
      formData.append("estado", form.estado);
      formData.append("id_categoria", String(Number(form.id_categoria)));

      appendGallery(formData, gallery.photos);

      const response = await appFetch(`${API_URL}/api/seller/products/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo actualizar el producto.");
      }

      setSuccessMessage("Producto actualizado correctamente.");

      gallery.setPhotos(photosFromProduct(data.product));

      setTimeout(() => {
        navigate("/perfil-vendedor", { replace: true });
      }, 800);
    } catch (error) {
      console.error("update product error:", error);
      setPageError(error.message || "No se pudo actualizar el producto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <section className="min-h-[calc(100vh-160px)] bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-orange-600">
                Panel de vendedor
              </p>
              <h1 className="mt-1 text-3xl font-extrabold text-gray-900">
                Editar producto
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Modifica la información de tu producto.
              </p>
            </div>

            <Link
              to="/perfil-vendedor"
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
            >
              <ArrowLeft size={18} />
              Volver
            </Link>
          </div>

          {pageError && (
            <div role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {pageError}
            </div>
          )}

          {successMessage && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          {loadingProduct || loadingCategories ? (
            <div className="rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
              <p className="text-gray-600">
                Cargando información del producto...
              </p>
            </div>
          ) : (
            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                    <Package size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-gray-900">
                      Información del producto
                    </h2>
                    <p className="text-sm text-gray-500">
                      Actualiza los datos principales.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="min-w-0 space-y-5">
                  <div>
                    <label htmlFor="editarproducto-field-1" className="mb-2 block text-sm font-semibold text-gray-700">
                      Nombre del producto
                    </label>
                    <input id="editarproducto-field-1"
                      type="text"
                      name="nombre"
                      value={form.nombre}
                      onChange={handleChange}
                      placeholder="Ej: Mortero artesanal en cerámica"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="editarproducto-field-2" className="mb-2 block text-sm font-semibold text-gray-700">
                      Descripción
                    </label>
                    <textarea id="editarproducto-field-2"
                      name="descripcion"
                      value={form.descripcion}
                      onChange={handleChange}
                      rows={5}
                      placeholder="Describe el producto, materiales, uso, beneficios..."
                      className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                    />
                  </div>

                  <label className="block text-sm font-semibold">Material
                  <select name="material" value={form.material} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-gray-200 p-3">
                    <option value="">Selecciona el material</option><option>Cerámica</option><option>Acero inoxidable</option><option>Madera</option><option>Otro</option>
                  </select>
                </label>
                <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="editarproducto-field-3" className="mb-2 block text-sm font-semibold text-gray-700">
                        Precio
                      </label>
                      <input id="editarproducto-field-3"
                        type="number"
                        name="precio"
                        min="0"
                        step="1"
                        value={form.precio}
                        onChange={handleChange}
                        placeholder="69900"
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                      />
                    </div>

                    <div>
                      <label htmlFor="editarproducto-field-4" className="mb-2 block text-sm font-semibold text-gray-700">
                        Stock
                      </label>
                      <input id="editarproducto-field-4"
                        type="number"
                        name="stock"
                        min="0"
                        step="1"
                        value={form.stock}
                        onChange={handleChange}
                        placeholder="10"
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="editarproducto-field-5" className="mb-2 block text-sm font-semibold text-gray-700">
                        Estado
                      </label>
                      <select id="editarproducto-field-5"
                        name="estado"
                        value={form.estado}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                      >
                        <option value="activo">Activo</option>
                        <option value="pausado">Pausado</option>
                        <option value="agotado">Agotado</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="editarproducto-field-6" className="mb-2 block text-sm font-semibold text-gray-700">
                        Categoría
                      </label>
                      <select id="editarproducto-field-6"
                        name="id_categoria"
                        value={form.id_categoria}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                      >
                        <option value="">Selecciona una categoría</option>
                        {categories.map((category) => (
                          <option
                            key={category.id_categoria}
                            value={category.id_categoria}
                          >
                            {category.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <ProductGalleryEditor gallery={gallery} disabled={isSubmitting} onInteract={()=>{setPageError('');setSuccessMessage('');}}/>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Link
                      to="/perfil-vendedor"
                      className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-center text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                    >
                      Cancelar
                    </Link>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Save size={16} />
                      {isSubmitting ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="space-y-6">
                <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-gray-100">
                  <div className="border-b border-gray-100 px-6 py-5">
                    <h3 className="text-lg font-extrabold text-gray-900">
                      Vista previa
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Así se verá el producto en tu panel.
                    </p>
                  </div>

                  <div className="p-6">
                    <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
                      <div className="relative">
                        <img loading="lazy"
                          src={imageUrl(previewImage)}
                          alt={form.nombre || "Vista previa"}
                          className="h-56 w-full object-contain"
                        />
                        <span
                          className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-bold ${
                            form.estado === "pausado"
                              ? "bg-amber-100 text-amber-700"
                              : form.estado === "agotado"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {form.estado === "pausado"
                            ? "Pausado"
                            : form.estado === "agotado"
                            ? "Agotado"
                            : "Activo"}
                        </span>
                      </div>

                      <div className="p-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                            {categories.find(
                              (item) =>
                                String(item.id_categoria) ===
                                String(form.id_categoria)
                            )?.nombre || "Sin categoría"}
                          </span>
                          <span className="text-sm font-semibold text-gray-500">
                            Stock: {form.stock || 0}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-gray-900">
                          {form.nombre || "Nombre del producto"}
                        </h3>

                        <p className="mt-3 text-2xl font-extrabold text-gray-900">
                          {new Intl.NumberFormat("es-CO", {
                            style: "currency",
                            currency: "COP",
                            maximumFractionDigits: 0,
                          }).format(Number(form.precio || 0))}
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-2xl bg-gray-50 p-3">
                            <p className="text-gray-500">Vistas</p>
                            <p className="mt-1 font-bold text-gray-900">0</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 p-3">
                            <p className="text-gray-500">Ventas</p>
                            <p className="mt-1 font-bold text-gray-900">0</p>
                          </div>
                        </div>

                        <p className="mt-4 text-sm text-gray-500">
                          {form.descripcion ||
                            "Aquí aparecerá la descripción del producto."}
                        </p>
                      </div>
                    </article>
                  </div>
                </div>

                <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="text-lg font-extrabold text-gray-900">
                    Consejos
                  </h3>
                  <div className="mt-4 space-y-3 text-sm text-gray-600">
                    <p>Revisa que el precio y stock sean correctos.</p>
                    <p>Muestra el producto completo y sus detalles. La primera foto será su portada.</p>
                    <p>Una buena descripción aumenta la confianza y las ventas.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </MainLayout>
  );
}
