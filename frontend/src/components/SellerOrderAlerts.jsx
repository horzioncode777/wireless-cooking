import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '../services/notificationContext';
import { NotificationList } from './NotificationBell';

export default function SellerOrderAlerts(){
 const {items,markRead,loading,error,refresh}=useNotifications();
 const sales=items.filter(item=>item.tipo==='venta').slice(0,5);
 return <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-bold"><Bell size={20}/>Avisos de pedidos</h2><Link to="/notificaciones" className="text-sm font-bold text-amber-900 underline">Ver todas las notificaciones</Link></div><p className="mb-4 text-sm text-stone-600">Nuevos pedidos, pagos confirmados y cambios de entrega. Abre un aviso para consultar la planilla de tu tienda.</p>{error?<p role="alert" className="text-sm text-red-800">{error}<button onClick={refresh} className="ml-3 underline">Reintentar</button></p>:loading?<p role="status" className="text-sm">Cargando avisos…</p>:sales.length?<NotificationList items={sales} markRead={markRead}/>:<p className="text-sm text-stone-500">No hay avisos de pedidos entre las notificaciones recientes. Puedes consultar el historial completo.</p>}</section>;
}
