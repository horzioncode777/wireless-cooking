import { API_URL } from './apiConfig.js';
import { appFetch } from "./notifications.js";
export { API_URL };
export async function api(path,options={}) {
 const token=localStorage.getItem('token');
 const response=await appFetch(`${API_URL}/api${path}`,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...options.headers}});
 const data=await response.json().catch(()=>({message:'Respuesta inválida del servidor.'}));
 if(!response.ok) throw new Error(data.message||'No se pudo completar la operación.');
 if(options.method && !['GET','HEAD'].includes(options.method.toUpperCase())) window.dispatchEvent(new Event('catalog:personalization'));
 return data;
}
export function readUser(){try{return JSON.parse(localStorage.getItem('user')||'null');}catch{return null;}}
export const formatPrice=value=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(value||0));
export const imageUrl=value=>value?.startsWith('/uploads/')||value?.startsWith('/demo-assets/')?`${API_URL}${value}`:value||'/product-placeholder.svg';
