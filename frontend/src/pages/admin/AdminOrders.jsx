import Dialog from "../../components/Dialog";
import OrderDeliveryEditor from '../../components/admin/OrderDeliveryEditor';
import ShipmentEditor from '../../components/ShipmentEditor';
import { OrderHistory } from '../../components/OrderTracking';
import { imageUrl } from "../../services/api";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Eye,
  ShoppingCart,
  X,
  Package,
} from "lucide-react";
import {
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
} from "../../services/adminOrders";

function formatPrice(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function normalizeStatus(status = "") {
  return String(status).toLowerCase().trim();
}

function prettifyStatus(status = "", delivery) {
  const normalized = normalizeStatus(status);

  if (!normalized) return "Sin estado";
  if (normalized === "enviado" && delivery === "recogida") return "Listo para recoger";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getStatusClasses(status = "") {
  const normalized = normalizeStatus(status);

  if (normalized === "pendiente") {
    return "bg-amber-100 text-amber-700";
  }

  if (normalized === "pagado") {
    return "bg-blue-100 text-blue-700";
  }

  if (normalized === "empacando") {
    return "bg-orange-100 text-orange-800";
  }

  if (normalized === "enviado") {
    return "bg-indigo-100 text-indigo-700";
  }

  if (normalized === "entregado") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (normalized === "cancelado") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function OrderDetailModal({
  open,
  onClose,
  order,
  items,
  loading,
  onChangeStatus,
  updatingStatus,
  onDeliverySaved,
}) {
  const [statusOverride, setSelectedStatus] = useState(null);
  const selectedStatus = statusOverride ?? order?.estado ?? "activo";


  if (!open) return null;

  return (
    <Dialog label="Detalle del pedido" onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Detalle del pedido
            </h2>
            <p className="text-sm text-slate-500">
              Información completa del pedido seleccionado.
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
            Cargando detalle del pedido...
          </div>
        ) : order ? (
          <div className="space-y-6 p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Pedido
                </p>
                <p className="mt-2 text-lg font-bold text-slate-800">
                  #{order.id_pedido}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Total
                </p>
                <p className="mt-2 text-lg font-bold text-slate-800">
                  {formatPrice(order.total)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Método de pago
                </p>
                <p className="mt-2 text-lg font-bold text-slate-800">
                  {order.metodo_pago || "No definido"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Estado
                </p>
                <span
                  className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                    order.estado
                  )}`}
                >
                  {prettifyStatus(order.estado,order.tipo_entrega)}
                </span>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-bold text-slate-800">
                  Información del cliente
                </h3>

                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-700">Nombre:</span>{" "}
                    {`${order.nombre || ""} ${order.apellido || ""}`.trim() || "Cliente"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Correo:</span>{" "}
                    {order.correo || "No registrado"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Teléfono:</span>{" "}
                    {order.telefono || "No registrado"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Dirección:</span>{" "}
                    {order.direccion_entrega || "No registrada"}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-bold text-slate-800">
                  Gestión del pedido
                </h3>

                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="adminorders-field-1" className="mb-2 block text-sm font-semibold text-slate-700">
                      Cambiar estado
                    </label>
                    <select id="adminorders-field-1"
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
                    >
                      <option value={order.estado}>{prettifyStatus(order.estado,order.tipo_entrega)}</option>
                      {order.estado==='pendiente' && <option value="cancelado">Cancelar y reponer inventario</option>}
                      {order.estado==='pagado' && <option value="empacando">Empacando</option>}
                      {order.estado==='empacando' && <option value="enviado">{order.tipo_entrega==='recogida'?'Listo para recoger':'Enviado'}</option>}
                      {order.estado==='enviado' && <option value="entregado">Entregado</option>}
                    </select>
                  </div>

                  <button
                    onClick={() => onChangeStatus(selectedStatus)}
                    disabled={updatingStatus}
                    className="rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {updatingStatus ? "Actualizando..." : "Guardar estado"}
                  </button>

                  <div className="pt-2 text-sm text-slate-500">
                    <p>Creado: {formatDate(order.fecha_creacion)}</p>
                    <p>Actualizado: {formatDate(order.fecha_actualizacion)}</p>
                  </div>
                </div>
              </div>
            </div>

            {order.shipments?.length>0&&['pagado','empacando','enviado','entregado'].includes(order.estado)?order.shipments.map(shipment=><ShipmentEditor key={`${order.id_pedido}-${shipment.id_vendedor}`} order={order} shipment={shipment} endpoint={`/admin/orders/${order.id_pedido}/shipments/${shipment.id_vendedor}`} onSaved={onDeliverySaved}/>):<OrderDeliveryEditor key={`${order.id_pedido}-${order.fecha_actualizacion}`} order={order} onSaved={onDeliverySaved}/>}
            <OrderHistory history={order.history} delivery={order.tipo_entrega}/>
            {order.ambiente==='test'&&<p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">Pedido de Wompi Sandbox: el movimiento logístico también es una prueba.</p>}
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h3 className="text-base font-bold text-slate-800">
                Productos del pedido
              </h3>

              {items.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id_detalle}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <img loading="lazy"
                          src={imageUrl(item.producto_imagen ||
                            "https://ui-avatars.com/api/?name=Producto&background=e5e7eb&color=64748b")}
                          alt={item.producto_nombre || "Producto"}
                          className="h-14 w-14 rounded-2xl object-cover"
                        />
                        <div>
                          <p className="font-semibold text-slate-800">
                            {item.producto_nombre || `Producto #${item.id_producto}`}
                          </p>
                          <p className="text-sm text-slate-500">
                            Cantidad: {item.cantidad}
                          </p>
                        </div>
                      </div>

                      <div className="text-sm text-slate-600 sm:text-right">
                        <p>Unitario: {formatPrice(item.precio_unitario)}</p>
                        <p className="font-semibold text-slate-800">
                          Subtotal: {formatPrice(item.subtotal)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                  Este pedido no tiene productos registrados.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">
            No se encontró la información del pedido.
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getAdminOrders();
      setOrders(Array.isArray(response) ? response : response?.orders || []);
    } catch (err) {
      console.error("Error cargando pedidos admin:", err);
      setError("No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const query = search.toLowerCase();

      const matchesSearch =
        String(order.id_pedido || "").includes(query) ||
        String(order.cliente || "").toLowerCase().includes(query) ||
        String(order.metodo_pago || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "Todos" ||
        normalizeStatus(order.estado) === normalizeStatus(statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const handleOpenDetail = async (orderId) => {
    try {
      setDetailOpen(true);
      setDetailLoading(true);
      setSelectedOrder(null);
      setSelectedItems([]);

      const response = await getAdminOrderById(orderId);

      setSelectedOrder(response?.order?{...response.order,history:response.history}:null);
      setSelectedItems(Array.isArray(response?.items) ? response.items : []);
    } catch (err) {
      console.error("Error cargando detalle del pedido:", err);

      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleChangeStatus = async (estado) => {
    if (!selectedOrder?.id_pedido) return;

    try {
      setUpdatingStatus(true);

      await updateAdminOrderStatus(selectedOrder.id_pedido, estado);

      const refreshed = await getAdminOrderById(selectedOrder.id_pedido);

      setSelectedOrder(refreshed?.order?{...refreshed.order,history:refreshed.history}:null);
      setSelectedItems(Array.isArray(refreshed?.items) ? refreshed.items : []);

      await loadOrders();
    } catch (err) {
      console.error("Error actualizando estado:", err);

    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pedidos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Aquí se administrarán todos los pedidos globales del sistema.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Search size={18} className="mr-3 text-slate-400" />
            <input aria-label="Buscar por pedido, cliente o método de pago..."
              type="text"
              placeholder="Buscar por pedido, cliente o método de pago..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <select aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="Todos">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="empacando">Empacando</option>
            <option value="enviado">Enviado</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-500">
                <th className="px-6 py-4 font-semibold">Pedido</th>
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold">Items</th>
                <th className="px-6 py-4 font-semibold">Método de pago</th>
                <th className="px-6 py-4 font-semibold">Total</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold">Fecha</th>
                <th className="px-6 py-4 text-right font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center text-slate-500">
                    Cargando pedidos...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr key={order.id_pedido} className="border-t border-slate-100">
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      #{order.id_pedido}
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {order.cliente || "Cliente"}
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {order.total_items || 0}
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {order.metodo_pago || "No definido"}
                    </td>

                    <td className="px-6 py-4 font-medium text-slate-700">
                      {formatPrice(order.total)}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                          order.estado
                        )}`}
                      >
                        {prettifyStatus(order.estado,order.tipo_entrega)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-500">
                      {formatDate(order.fecha_creacion)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenDetail(order.id_pedido)}
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
                  <td colSpan="8" className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-4 rounded-3xl bg-slate-100 p-4 text-slate-400">
                        <ShoppingCart size={30} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">
                        No se encontraron pedidos
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

      <OrderDetailModal
        key={`${selectedOrder?.id_pedido}-${selectedOrder?.estado}-${selectedOrder?.verificado}-${detailOpen}`}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedOrder(null);
          setSelectedItems([]);
        }}
        order={selectedOrder}
        items={selectedItems}
        loading={detailLoading}
        onChangeStatus={handleChangeStatus}
        updatingStatus={updatingStatus}
        onDeliverySaved={async()=>{
          const refreshed=await getAdminOrderById(selectedOrder.id_pedido);
          setSelectedOrder({...refreshed.order,history:refreshed.history});
          await loadOrders();
        }}
      />
    </div>
  );
}
