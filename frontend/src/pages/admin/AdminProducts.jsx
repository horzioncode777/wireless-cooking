import { notify } from "../../services/notifications.js";
import Dialog from "../../components/Dialog";
import { imageUrl } from "../../services/api";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useLocation } from 'react-router-dom';
import useCatalogUpdates from '../../hooks/useCatalogUpdates';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  X,
  Image as ImageIcon,
} from "lucide-react";
import {
  getAdminProducts,
  getAdminCategories,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
} from "../../services/adminProducts";

const emptyForm = {
  tipoProducto: "marca_propia",
  id_vendedor: "",
  id_categoria: "",
  nombre: "",
  descripcion: "",
  precio: "",
  stock: "",
  imagen: "",
  estado: "Activo",
};

function formatPrice(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function ProductModal({
  open,
  onClose,
  onSubmit,
  form,
  setForm,
  editingProduct,
  saving,
  categories,
}) {
  if (!open) return null;

  const isEditing = Boolean(editingProduct);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "precio" || name === "stock" || name === "id_vendedor") {
      setForm((prev) => ({
        ...prev,
        [name]: value.replace(/\D/g, ""),
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const title = isEditing ? "Editar producto" : "Nuevo producto";
  const buttonText = saving
    ? isEditing
      ? "Guardando..."
      : "Creando..."
    : isEditing
    ? "Guardar cambios"
    : "Crear producto";

  return (
    <Dialog label={title} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{title}</h2>
            <p className="text-sm text-slate-500">
              Completa la información del producto.
            </p>
          </div>

          <button aria-label="Cerrar diálogo"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="adminproducts-field-1" className="mb-2 block text-sm font-semibold text-slate-700">
                Tipo de producto
              </label>
              <select id="adminproducts-field-1"
                name="tipoProducto"
                value={form.tipoProducto}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
              >
                <option value="marca_propia">Marca propia</option>
                <option value="marketplace">Marketplace</option>
              </select>
            </div>

            <div>
              <label htmlFor="adminproducts-field-2" className="mb-2 block text-sm font-semibold text-slate-700">
                Estado
              </label>
              <select id="adminproducts-field-2"
                name="estado"
                value={form.estado}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
              >
                <option value="Activo">Activo</option>
                <option value="Borrador">Borrador</option>
                <option value="Agotado">Agotado</option>
              </select>
            </div>

            {form.tipoProducto === "marketplace" && (
              <div className="md:col-span-2">
                <label htmlFor="adminproducts-field-3" className="mb-2 block text-sm font-semibold text-slate-700">
                  ID del vendedor
                </label>
                <input id="adminproducts-field-3"
                  type="text"
                  name="id_vendedor"
                  value={form.id_vendedor}
                  onChange={handleChange}
                  placeholder="Ej: 2"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
                  required={form.tipoProducto === "marketplace"}
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label htmlFor="adminproducts-field-4" className="mb-2 block text-sm font-semibold text-slate-700">
                Nombre del producto
              </label>
              <input id="adminproducts-field-4"
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Ej: Sartén profesional de cocina"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label htmlFor="adminproducts-field-5" className="mb-2 block text-sm font-semibold text-slate-700">
                Categoría
              </label>
              <select id="adminproducts-field-5"
                name="id_categoria"
                value={form.id_categoria}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
                required
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

            <div>
              <label htmlFor="adminproducts-field-6" className="mb-2 block text-sm font-semibold text-slate-700">
                Precio
              </label>
              <input id="adminproducts-field-6"
                type="text"
                name="precio"
                value={form.precio}
                onChange={handleChange}
                placeholder="Ej: 150000"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label htmlFor="adminproducts-field-7" className="mb-2 block text-sm font-semibold text-slate-700">
                Stock
              </label>
              <input id="adminproducts-field-7"
                type="text"
                name="stock"
                value={form.stock}
                onChange={handleChange}
                placeholder="Ej: 10"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="adminproducts-field-8" className="mb-2 block text-sm font-semibold text-slate-700">
                Descripción
              </label>
              <textarea id="adminproducts-field-8"
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                rows={4}
                placeholder="Descripción del producto"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="adminproducts-field-9" className="mb-2 block text-sm font-semibold text-slate-700">
                URL de la imagen
              </label>
              <input id="adminproducts-field-9"
                type="text"
                name="imagen"
                value={form.imagen}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">
              Vista previa
            </p>

            {form.imagen ? (
              <img loading="lazy"
                src={imageUrl(form.imagen)}
                alt="Vista previa"
                className="h-52 w-full rounded-2xl object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-52 w-full items-center justify-center rounded-2xl bg-white text-slate-400">
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon size={28} />
                  <span className="text-sm">Sin imagen</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {buttonText}
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

function DeleteModal({ open, onClose, onConfirm, product, deleting }) {
  if (!open || !product) return null;

  return (
    <Dialog label="Eliminar producto" onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-800">Eliminar producto</h2>
        <p className="mt-2 text-sm text-slate-500">
          ¿Seguro que deseas eliminar{" "}
          <span className="font-semibold">{product.nombre}</span>? Esta acción no
          se puede deshacer.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-2xl bg-red-500 px-5 py-3 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {deleting ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export default function AdminProducts() {
  useCatalogUpdates(()=>loadData(true));
  const location=useLocation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(()=>new URLSearchParams(location.search).get('q')||'');
  const synchronizeSearch=useEffectEvent(()=>setSearch(new URLSearchParams(location.search).get('q')||''));
  useEffect(()=>{synchronizeSearch();},[location.search]);
  const [filterType, setFilterType] = useState("Todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async (silent=false) => {
    try {
      if(!silent) setLoading(true);
      setError("");

      const [productsRes, categoriesRes] = await Promise.all([
        getAdminProducts(),
        getAdminCategories(),
      ]);

      setProducts(
        Array.isArray(productsRes) ? productsRes : productsRes?.products || []
      );
      setCategories(
        Array.isArray(categoriesRes)
          ? categoriesRes
          : categoriesRes?.categories || []
      );
    } catch (err) {
      console.error("Error cargando datos admin:", err);
      setError("No se pudieron cargar los productos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const productType = product.id_vendedor ? "Marketplace" : "Marca propia";

      const matchesSearch =
        (product.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
        (product.categoria || "").toLowerCase().includes(search.toLowerCase());

      const matchesType =
        filterType === "Todos" || productType === filterType;

      return matchesSearch && matchesType;
    });
  }, [products, search, filterType]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingProduct(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setForm({
      tipoProducto: product.id_vendedor ? "marketplace" : "marca_propia",
      id_vendedor: product.id_vendedor ? String(product.id_vendedor) : "",
      id_categoria: product.id_categoria ? String(product.id_categoria) : "",
      nombre: product.nombre || "",
      descripcion: product.descripcion || "",
      precio: product.precio ? String(product.precio) : "",
      stock: product.stock !== undefined ? String(product.stock) : "",
      imagen: product.imagen || "",
      estado: product.estado || "Activo",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      id_vendedor:
        form.tipoProducto === "marketplace"
          ? Number(form.id_vendedor)
          : null,
      id_categoria: Number(form.id_categoria),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      precio: Number(form.precio),
      stock: Number(form.stock),
      imagen: form.imagen.trim(),
      estado: form.estado,
    };

    if (
      !payload.nombre ||
      !payload.descripcion ||
      !payload.precio ||
      payload.stock < 0 ||
      !payload.id_categoria
    ) {
      notify("Completa los campos obligatorios.", "warning");
      return;
    }

    if (
      form.tipoProducto === "marketplace" &&
      (!form.id_vendedor || Number(form.id_vendedor) <= 0)
    ) {
      notify("Debes ingresar un ID de vendedor válido para marketplace.", "warning");
      return;
    }

    try {
      setSaving(true);

      if (editingProduct) {
        await updateAdminProduct(editingProduct.id_producto, payload);
      } else {
        await createAdminProduct(payload);
      }

      setModalOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      console.error("Error guardando producto:", err);

    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (product) => {
    setSelectedProduct(product);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;

    try {
      setDeleting(true);
      await deleteAdminProduct(selectedProduct.id_producto);
      setDeleteOpen(false);
      setSelectedProduct(null);
      await loadData();
    } catch (err) {
      console.error("Error eliminando producto:", err);

    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Productos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Administra todos los productos de la plataforma desde un solo lugar.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600"
        >
          <Plus size={18} />
          Nuevo producto
        </button>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Search size={18} className="mr-3 text-slate-400" />
            <input aria-label="Buscar por nombre o categoría..."
              type="text"
              placeholder="Buscar por nombre o categoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <select aria-label="Filtrar por tipo de producto"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="Todos">Todos</option>
            <option value="Marca propia">Marca propia</option>
            <option value="Marketplace">Marketplace</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-500">
                <th className="px-6 py-4 font-semibold">Producto</th>
                <th className="px-6 py-4 font-semibold">Tipo</th>
                <th className="px-6 py-4 font-semibold">Categoría</th>
                <th className="px-6 py-4 font-semibold">Precio</th>
                <th className="px-6 py-4 font-semibold">Stock</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 text-right font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-500">
                    Cargando productos...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const productType = product.id_vendedor
                    ? "Marketplace"
                    : "Marca propia";

                  return (
                    <tr
                      key={product.id_producto}
                      className="border-t border-slate-100"
                    >
                      <td className="px-6 py-4">
                        <div className="flex min-w-[260px] items-center gap-4">
                          <img loading="lazy"
                            src={imageUrl(product.imagen ||
                              "https://ui-avatars.com/api/?name=Producto&background=e5e7eb&color=64748b")}
                            alt={product.nombre}
                            className="h-14 w-14 rounded-2xl object-cover"
                          />
                          <div>
                            <p className="font-semibold text-slate-800">
                              {product.nombre}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              ID: {product.id_producto}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {productType}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {product.categoria || "Sin categoría"}
                      </td>

                      <td className="px-6 py-4 font-medium text-slate-700">
                        {formatPrice(product.precio)}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            Number(product.stock) > 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {Number(product.stock) > 0
                            ? `${product.stock} unidades`
                            : "Sin stock"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            product.estado === "Activo"
                              ? "bg-emerald-100 text-emerald-700"
                              : product.estado === "Borrador"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {product.estado}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            onClick={() => handleOpenDelete(product)}
                            className="rounded-xl border border-red-200 p-2 text-red-500 transition hover:bg-red-50"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-4 rounded-3xl bg-slate-100 p-4 text-slate-400">
                        <Package size={30} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">
                        No se encontraron productos
                      </h3>
                      <p className="mt-2 max-w-md text-sm text-slate-500">
                        Intenta cambiar la búsqueda o el filtro para encontrar resultados.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ProductModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        onSubmit={handleSubmit}
        form={form}
        setForm={setForm}
        editingProduct={editingProduct}
        saving={saving}
        categories={categories}
      />

      <DeleteModal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedProduct(null);
        }}
        onConfirm={handleDelete}
        product={selectedProduct}
        deleting={deleting}
      />
    </div>
  );
}
