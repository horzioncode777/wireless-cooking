import { useState } from 'react';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { NotificationList } from '../components/NotificationBell';
import { useNotifications } from '../services/notificationContext';

export default function Notifications(){
 const {items,unread,loading,error,markRead,readAll,nextCursor,loadMore,loadingMore,refresh}=useNotifications();
 const [filter,setFilter]=useState('all');
 const visible=filter==='unread'?items.filter(item=>!item.leida_en):items;
 return <MainLayout><section className="min-h-[60vh] bg-stone-50 px-4 py-10"><div className="mx-auto max-w-3xl"><div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800"><Bell size={18}/>Tu actividad, en un solo lugar</p><h1 className="text-3xl font-bold tracking-tight">Notificaciones</h1><p className="mt-2 text-sm text-slate-500">Compras, solicitudes y novedades de tu cuenta.</p></div><button type="button" onClick={readAll} disabled={!unread} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold disabled:opacity-40"><CheckCheck size={18}/>Marcar todas como leídas</button></div>
 <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm"><div className="flex gap-2 border-b p-4" role="group" aria-label="Filtrar notificaciones">{[['all','Todas'],['unread',`Sin leer (${unread})`]].map(([id,label])=><button key={id} type="button" aria-pressed={filter===id} onClick={()=>setFilter(id)} className={`min-h-10 rounded-full px-5 text-sm font-semibold ${filter===id?'bg-amber-900 text-white':'bg-stone-100 text-slate-600'}`}>{label}</button>)}</div>
 {error&&<div role="status" className="m-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">{error}<button onClick={refresh} className="ml-3 font-bold underline">Reintentar</button></div>}
 {loading?<p role="status" className="notification-empty">Cargando notificaciones…</p>:visible.length?<NotificationList items={visible} markRead={markRead}/>:<div className="notification-empty"><Inbox size={36} aria-hidden="true"/><h2 className="font-bold">{filter==='unread'?'No hay avisos sin leer en esta página':'Todavía no hay novedades'}</h2><p>{filter==='unread'?'Puedes consultar el historial en Todas.':'Te avisaremos cuando haya novedades de tus compras, solicitudes o cuenta.'}</p></div>}
 {nextCursor&&<div className="border-t p-4 text-center"><button type="button" onClick={loadMore} disabled={loadingMore} className="min-h-11 rounded-xl border px-5 text-sm font-semibold disabled:opacity-50">{loadingMore?'Cargando…':'Cargar anteriores'}</button></div>}
 </div><p className="mt-4 text-xs leading-relaxed text-slate-500">Las novedades se actualizan mientras usas la app. Las notificaciones importantes se guardan en tu cuenta y puedes consultarlas cuando regreses.</p></div></section></MainLayout>;
}
