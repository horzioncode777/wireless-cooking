import { API_URL } from './apiConfig.js';
const recent=new Map();
const failedReads=new Set();

export function notify(message,level='info',options={}){
 if(!message)return;
 const key=options.key||String(message);
 const now=Date.now();
 if(now-(recent.get(key)||0)<3000)return;
 for(const [id,time] of recent)if(now-time>3000)recent.delete(id);
 recent.set(key,now);
 window.dispatchEvent(new CustomEvent('app:notice',{detail:{id:crypto.randomUUID(),message,level,...options}}));
}

export function actionMessage(path,method,data={}){
 if(path.includes('/notifications')||path==='/history'||path==='/chat'||/\/payments\/\d+\/(?:session|verify)$/.test(path))return null;
 if(data.message)return data.message;
 if(path.includes('/auth/login'))return '¡Bienvenido! Iniciaste sesión correctamente.';
 if(path.includes('/auth/register'))return 'Tu cuenta fue creada. ¡Bienvenido a Wireless Cooking!';
 if(path.includes('/auth/forgot-password'))return 'Solicitud recibida. Revisa tu correo para continuar.';
 if(path.includes('password'))return 'Contraseña actualizada correctamente.';
 if(path.includes('/cart'))return method==='DELETE'?'Producto eliminado del carrito.':path.endsWith('/add')?'Producto agregado al carrito.':'Cantidad actualizada en tu carrito.';
 if(path.includes('/favorites'))return method==='DELETE'?'Producto eliminado de favoritos.':'Producto guardado en favoritos.';
 if(path.includes('/reviews'))return 'Tu reseña fue guardada.';
 if(path.includes('/pqr'))return method==='POST'?'Tu PQR fue registrada.':'La respuesta y el estado de la PQR fueron guardados.';
 if(path==='/orders')return 'Pedido creado. El pago todavía debe confirmarse.';
 if(path.includes('/orders'))return 'Estado del pedido actualizado.';
 if(path.includes('/products'))return method==='DELETE'?'Producto eliminado.':method==='POST'?'Producto creado correctamente.':'Producto actualizado correctamente.';
 if(path.includes('/sellers'))return 'Tienda actualizada correctamente.';
 if(path.includes('/users'))return 'Cuenta de usuario actualizada correctamente.';
 if(path.includes('/profile'))return path.includes('/seller/')?'Datos de la tienda guardados.':'Datos de tu perfil guardados.';
 return method==='DELETE'?'Registro eliminado correctamente.':'Cambios guardados correctamente.';
}

export function reportResponse(path,method,status,data){
 if(path.includes('/notifications')||path==='/history')return;
 const read=['GET','HEAD'].includes(method);
 const key=status===401&&!path.startsWith('/auth/')?'session-expired':`${path}:${status}`;
 if(status>=400){
  if(read&&failedReads.has(key))return;
  if(read)failedReads.add(key);
  notify(status===401&&!path.startsWith('/auth/')?'Tu sesión venció. Inicia sesión nuevamente.':data?.message||'No se pudo completar la operación. Intenta nuevamente.',status===401?'warning':'error',key==='session-expired'?{key,href:'/login'}:{});
 }else{
  if(path.startsWith('/auth/login')||path.startsWith('/auth/register'))failedReads.clear();
  for(const failure of failedReads)if(failure.startsWith(`${path}:`))failedReads.delete(failure);
  if(!read){
   const message=actionMessage(path,method,data);
   if(message)notify(message,'success');
   window.dispatchEvent(new CustomEvent('notifications:refresh',{detail:{silent:true}}));
  }
 }
}

export async function appFetch(input,options={}){
 const method=(options.method||input?.method||'GET').toUpperCase();
 const url=new URL(typeof input==='string'?input:input.url,window.location.origin);
 const path=url.pathname.replace(/^\/api/,'');
 const apiOrigin=new URL(API_URL,window.location.origin).origin;
 if(url.origin!==apiOrigin||!url.pathname.startsWith('/api/'))return fetch(input,options);
 try{
  const response=await fetch(input,options);
  const data=response.status===204?{}:await response.clone().json().catch(()=>null);
  if(data===null){
   const message='El servidor devolvió una respuesta inválida. Intenta nuevamente.';
   reportResponse(path,method,502,{message});
   return response;
  }
  reportResponse(path,method,response.status,data);
  return response;
 }catch(error){
  if(error.name!=='AbortError'&&!options.signal?.aborted&&!path.includes('/notifications')&&path!=='/history')notify('No hay conexión con el servidor. Revisa tu conexión e intenta nuevamente.','error',{key:'network'});
  throw error;
 }
}

export function attachNotificationInterceptor(client){
 client.interceptors.response.use(response=>{
  reportResponse(`/admin${response.config.url}`,response.config.method.toUpperCase(),response.status,response.data);
  return response;
 },error=>{
  if(error.code!=='ERR_CANCELED'){
   if(error.response)reportResponse(`/admin${error.config.url}`,error.config.method.toUpperCase(),error.response.status,error.response.data);
   else notify('No hay conexión con el servidor. Intenta nuevamente.','error',{key:'network'});
  }
  return Promise.reject(error);
 });
}
