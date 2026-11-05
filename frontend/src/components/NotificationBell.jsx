import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, ChevronRight, Inbox, ShoppingBag, CreditCard, MessageCircle, ShieldCheck, Package, User, Star, Heart, Store, ShoppingCart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useNotifications } from '../services/notificationContext';

const icons={pedido:ShoppingBag,venta:ShoppingBag,pago:CreditCard,pqr:MessageCircle,seguridad:ShieldCheck,inventario:Package,producto:Package,cuenta:User,resena:Star,favoritos:Heart,tienda:Store,carrito:ShoppingCart};
export function NotificationList({items,onSelect,markRead}){
 return <ul className="notification-list">{items.map(item=>{
  const Icon=icons[item.tipo]||Bell;
  return <li key={item.id} className={!item.leida_en?'is-unread':''}><span className={`notification-type notification-type--${item.nivel}`}><Icon size={18} aria-hidden="true"/></span><div className="min-w-0 flex-1"><Link to={item.destino.startsWith('/')&&!item.destino.startsWith('//')?item.destino:'/notificaciones'} onClick={()=>{markRead(item.id);onSelect?.();}} className="notification-content"><strong>{item.titulo}</strong><p>{item.mensaje}</p><time dateTime={item.fecha_creacion}>{new Date(item.fecha_creacion).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})}</time></Link>{!item.leida_en&&<button type="button" className="notification-mark" onClick={()=>markRead(item.id)}>Marcar como leída</button>}</div>{!item.leida_en&&<span className="notification-dot" aria-label="Sin leer"/>}</li>;
 })}</ul>;
}
export default function NotificationBell(){
 const {items,unread,loading,error,refresh,markRead,readAll}=useNotifications();
 const [openedPath,setOpenedPath]=useState(null),container=useRef(null),button=useRef(null);
 const location=useLocation();
 const open=openedPath===location.pathname;
 useEffect(()=>{
  function outside(event){if(!container.current?.contains(event.target))setOpenedPath(null);}
  function escape(event){if(event.key==='Escape'){setOpenedPath(null);button.current?.focus();}}
  if(open){document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);}
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 return <div ref={container} className="notification-bell" key={location.pathname}>
  <button ref={button} type="button" aria-label={`Notificaciones${unread?`, ${unread} sin leer`:''}`} aria-expanded={open} aria-controls="notification-popover" className="notification-trigger" onClick={()=>{setOpenedPath(open?null:location.pathname);if(!open)refresh();}}><Bell size={20}/>{unread>0&&<span>{unread>99?'99+':unread}</span>}</button>
  {open&&<section id="notification-popover" aria-label="Tus notificaciones" className="notification-popover"><div className="notification-header"><div><h2>Notificaciones</h2><p>{unread?`${unread} sin leer`:'Estás al día'}</p></div><button type="button" disabled={!unread} onClick={readAll} aria-label="Marcar todas como leídas"><CheckCheck size={20}/></button></div>
   {loading?<p className="notification-empty" role="status">Cargando novedades…</p>:error?<div className="notification-empty" role="status"><p>{error}</p><button onClick={refresh}>Reintentar</button></div>:!items.length?<div className="notification-empty"><Inbox size={30} aria-hidden="true"/><p>Aún no tienes notificaciones.</p><small>Tus compras, solicitudes y novedades aparecerán aquí.</small></div>:<NotificationList items={items.slice(0,6)} markRead={markRead} onSelect={()=>setOpenedPath(null)}/>}
   <Link to="/notificaciones" className="notification-footer" onClick={()=>setOpenedPath(null)}>Ver todas las notificaciones<ChevronRight size={16}/></Link>
  </section>}
 </div>;
}
