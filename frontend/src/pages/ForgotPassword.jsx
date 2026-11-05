import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, LoaderCircle } from 'lucide-react';
import { api } from '../services/api';
import PasswordRecoveryLayout from '../components/PasswordRecoveryLayout';

export default function ForgotPassword(){
 const navigate=useNavigate(),processing=useRef(false),errorBox=useRef(null);
 const [email,setEmail]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(error)errorBox.current?.focus();},[error]);
 async function submit(event){
  event.preventDefault();if(processing.current)return;
  processing.current=true;setBusy(true);setError('');
  try{
   const data=await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({correo:email.trim().toLowerCase()})});
   navigate('/restablecer-password',{state:{challengeId:data.challengeId,email:email.trim().toLowerCase(),retryAfter:data.retryAfter||60}});
  }catch(err){setError(err.message);}finally{processing.current=false;setBusy(false);}
 }
 return <PasswordRecoveryLayout step={1} title="¿Olvidaste tu contraseña?" description="Escribe el correo con el que creaste tu cuenta. Si está registrado y activo, recibirás un código de 6 dígitos.">
  <form onSubmit={submit} className="space-y-5">
   <label className="block text-sm font-semibold text-slate-700" htmlFor="recovery-email">Correo electrónico</label>
   <div className="flex items-center gap-3 rounded-xl border border-stone-300 bg-stone-50 px-4 focus-within:border-amber-800"><Mail size={18} className="shrink-0 text-slate-500" aria-hidden="true"/><input id="recovery-email" name="email" type="email" required maxLength={150} autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={event=>setEmail(event.target.value)} disabled={busy} placeholder="correo@ejemplo.com" className="min-w-0 flex-1 bg-transparent py-4 text-sm outline-none"/></div>
   {error&&<p ref={errorBox} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
   <button type="submit" disabled={busy} className="checkout-pay">{busy?<><LoaderCircle size={18} className="checkout-spinner" aria-hidden="true"/>Solicitando código…</>:<>Enviar código<ArrowRight size={18} aria-hidden="true"/></>}</button>
   <p className="text-xs leading-6 text-slate-500">El código vence en 10 minutos. Ten acceso a tu correo y revisa también la carpeta Spam.</p>
  </form>
 </PasswordRecoveryLayout>;
}
