import { API_URL as base } from '../services/apiConfig.js';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle2, Info, TriangleAlert, CircleAlert, X } from 'lucide-react';
import { NotificationContext } from '../services/notificationContext';
import { notify } from '../services/notifications';


const icons={success:CheckCircle2,info:Info,warning:TriangleAlert,error:CircleAlert};
function subscribeSession(callback){window.addEventListener('storage',callback);return()=>window.removeEventListener('storage',callback);}
const sessionSnapshot=()=>localStorage.getItem('token')||'';
const sortItems=items=>items.sort((a,b)=>BigInt(a.id)>BigInt(b.id)?-1:1);
function Toast({notice,onClose}){
 const [paused,setPaused]=useState(false);
 const Icon=icons[notice.level]||Info;
 useEffect(()=>{
  if(paused)return;
  const timeout=setTimeout(()=>onClose(notice.id),notice.level==='error'?12000:7000);
  return()=>clearTimeout(timeout);
 },[notice.id,notice.level,onClose,paused]);
 return <div className={`app-toast app-toast--${notice.level}`} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false);}}>
  <Icon size={21} aria-hidden="true"/><div><p>{notice.message}</p>{notice.href&&<Link to={notice.href} onClick={()=>onClose(notice.id)}>Ver detalle →</Link>}</div><button type="button" onClick={()=>onClose(notice.id)} aria-label="Cerrar aviso"><X size={16}/></button>
 </div>;
}

function NotificationSession({token,children}){
 const [toasts,setToasts]=useState([]),[items,setItems]=useState([]),[unread,setUnread]=useState(0),[loading,setLoading]=useState(!!token),[error,setError]=useState(''),[nextCursor,setNextCursor]=useState(null),[loadingMore,setLoadingMore]=useState(false);
 const latest=useRef(null),pending=useRef(false),alive=useRef(true),unauthorized=useRef(false);
 const dismiss=useCallback(id=>setToasts(previous=>previous.filter(item=>item.id!==id)),[]);
 const request=useCallback(async(path='',options={})=>{
  const response=await fetch(`${base}/api/notifications${path}`,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}});
  const data=await response.json().catch(()=>({message:'El servidor devolvió una respuesta inválida. Intenta nuevamente.'}));
  if(!response.ok){if(response.status===401)unauthorized.current=true;throw Error(response.status===401?'Tu sesión venció. Inicia sesión nuevamente.':data.message||'No se pudieron cargar las notificaciones.');}
  if(options.method==='PATCH')localStorage.setItem('notifications:changed',String(Date.now()));
  return data;
 },[token]);
 const refresh=useCallback(async(event)=>{
  if(!token||pending.current||unauthorized.current||document.hidden)return;
  pending.current=true;
  try{
   const data=await request();
   if(!alive.current||sessionSnapshot()!==token)return;
   const initial=latest.current===null;
   const fresh=initial?[]:data.notifications.filter(item=>BigInt(item.id)>BigInt(latest.current)&&!item.leida_en);
   if(data.notifications.length)latest.current=data.notifications[0].id;
   if(!event?.detail?.silent){
    if(fresh.length===1)notify(fresh[0].titulo,'info',{href:fresh[0].destino,key:`inbox:${fresh[0].id}`});
    else if(fresh.length>1)notify(`Tienes ${fresh.length} nuevas notificaciones.`,'info',{href:'/notificaciones',key:`inbox:${fresh[0].id}`});
   }
   setItems(previous=>sortItems([...new Map([...previous,...data.notifications].map(item=>[item.id,item])).values()]));
   setUnread(data.unread);setError('');
   if(initial)setNextCursor(data.nextCursor);
  }catch(err){if(alive.current){setError(err.message);if(unauthorized.current)notify(err.message,'warning',{key:'session-expired',href:'/login'});}}
  finally{pending.current=false;if(alive.current)setLoading(false);}
 },[token,request]);
 useEffect(()=>{
  alive.current=true;
  function receive(event){setToasts(previous=>[...previous,event.detail].slice(-4));}
  function offline(){notify('Estás sin conexión. Tus cambios requieren conexión al servidor.','warning',{key:'offline'});}
  function online(){notify('La conexión se restableció.','success');refresh();}
  window.addEventListener('app:notice',receive);
  window.addEventListener('notifications:refresh',refresh);
  window.addEventListener('focus',refresh);
  window.addEventListener('offline',offline);
  window.addEventListener('online',online);
  function storage(event){if(event.key==='notifications:changed')refresh();}
  window.addEventListener('storage',storage);
  document.addEventListener('visibilitychange',refresh);
  refresh();
  const timer=token?setInterval(refresh,15000):null;
  return()=>{
   alive.current=false;clearInterval(timer);
   window.removeEventListener('app:notice',receive);window.removeEventListener('notifications:refresh',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('offline',offline);window.removeEventListener('online',online);window.removeEventListener('storage',storage);document.removeEventListener('visibilitychange',refresh);
  };
 },[token,refresh]);
 async function markRead(id){
  try{await request(`/${id}/read`,{method:'PATCH'});if(alive.current){setItems(previous=>previous.map(item=>item.id===id?{...item,leida_en:new Date().toISOString()}:item));await refresh();}}
  catch(err){notify(err.message,'error');}
 }
 async function readAll(){
  if(!items.length)return;
  const through=items[0].id;
  try{await request('/read-all',{method:'PATCH',body:JSON.stringify({through})});if(alive.current){setItems(previous=>previous.map(item=>BigInt(item.id)<=BigInt(through)?{...item,leida_en:item.leida_en||new Date().toISOString()}:item));await refresh();}}
  catch(err){notify(err.message,'error');}
 }
 async function loadMore(){
  if(!nextCursor||loadingMore)return;
  setLoadingMore(true);
  try{const data=await request(`?before=${nextCursor}`);if(alive.current){setItems(previous=>sortItems([...new Map([...previous,...data.notifications].map(item=>[item.id,item])).values()]));setNextCursor(data.nextCursor);setUnread(data.unread);}}
  catch(err){notify(err.message,'error');}
  finally{if(alive.current)setLoadingMore(false);}
 }
 return <NotificationContext.Provider value={{items,unread,loading,error,nextCursor,loadingMore,refresh,markRead,readAll,loadMore}}>{children}<div className="app-toasts" role="region" aria-label="Avisos de la aplicación"><div aria-live="polite" aria-atomic="false">{toasts.filter(item=>item.level!=='error').map(notice=><Toast key={notice.id} notice={notice} onClose={dismiss}/>)}</div><div aria-live="assertive" aria-atomic="false">{toasts.filter(item=>item.level==='error').map(notice=><Toast key={notice.id} notice={notice} onClose={dismiss}/>)}</div></div></NotificationContext.Provider>;
}

export default function NotificationProvider({children}){
 useLocation(); // Re-read same-tab login/logout when navigation changes.
 const token=useSyncExternalStore(subscribeSession,sessionSnapshot);
 return <NotificationSession key={token} token={token}>{children}</NotificationSession>;
}
