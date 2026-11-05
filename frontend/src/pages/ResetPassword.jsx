import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, LoaderCircle } from 'lucide-react';
import PasswordRecoveryLayout from '../components/PasswordRecoveryLayout';
import { api } from '../services/api';
import { maskRecoveryEmail, validateNewPassword } from '../services/passwordRecovery';

export default function ResetPassword(){
 const location=useLocation(),navigate=useNavigate(),[params]=useSearchParams();
 const processing=useRef(false),errorBox=useRef(null),passwordField=useRef(null);
 const [challengeId,setChallengeId]=useState(location.state?.challengeId||'');
 const [token,setToken]=useState(params.get('token')||'');
 const email=location.state?.email||'';
 const [code,setCode]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[showPassword,setShowPassword]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [resendAt,setResendAt]=useState(()=>Date.now()+(location.state?.retryAfter||60)*1000),[now,setNow]=useState(Date.now);
 const remaining=Math.max(0,Math.ceil((resendAt-now)/1000));
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(error)errorBox.current?.focus();},[error]);
 useEffect(()=>{if(token)passwordField.current?.focus();},[token]);
 async function verify(event){
  event.preventDefault();if(processing.current)return;
  processing.current=true;setBusy(true);setError('');setNotice('');
  try{
   const data=await api('/auth/verify-reset-code',{method:'POST',body:JSON.stringify({challengeId,code})});
   setToken(data.token);setCode('');
  }catch(err){setError(err.message);}finally{processing.current=false;setBusy(false);}
 }
 async function resend(){
  if(processing.current||remaining||!email)return;
  processing.current=true;setBusy(true);setError('');
  try{
   const data=await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({correo:email})});
   setChallengeId(data.challengeId);setCode('');setNotice(data.message);setResendAt(Date.now()+(data.retryAfter||60)*1000);
  }catch(err){setError(err.message);}finally{processing.current=false;setBusy(false);}
 }
 async function save(event){
  event.preventDefault();if(processing.current)return;
  const validation=validateNewPassword(password,confirmation);
  if(validation){setError(validation);return;}
  processing.current=true;setBusy(true);setError('');
  try{
   await api('/auth/reset-password',{method:'POST',body:JSON.stringify({token,password})});
   localStorage.removeItem('token');localStorage.removeItem('user');localStorage.removeItem('refreshToken');
   navigate('/login',{replace:true,state:{passwordUpdated:true}});
  }catch(err){setError(err.message);}finally{processing.current=false;setBusy(false);}
 }
 const errorMessage=error&&<p ref={errorBox} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</p>;
 const inputClass='mt-2 w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 font-normal focus:border-amber-800';
 if(!challengeId&&!token)return <PasswordRecoveryLayout step={1} title="Solicita un código de recuperación" description="Para elegir una nueva contraseña, primero necesitamos verificar el acceso a tu correo."><Link to="/recuperar-password" className="checkout-pay">Solicitar código<ArrowRight size={18} aria-hidden="true"/></Link></PasswordRecoveryLayout>;
 return <PasswordRecoveryLayout step={token?3:2} title={token?'Elige tu nueva contraseña':'Revisa tu correo'} description={token?'El código fue verificado. Tienes 5 minutos para guardar tu nueva contraseña.':`Si ${maskRecoveryEmail(email)||'tu correo'} pertenece a una cuenta activa, recibirás un código de 6 dígitos. Vence en 10 minutos.`}>
  {token?<form onSubmit={save} className="space-y-5">
   <p className="flex items-center gap-2 text-xs font-semibold text-emerald-800"><CheckCircle2 size={17} aria-hidden="true"/>Acceso al correo verificado</p>
   <label className="block text-sm font-semibold" htmlFor="new-password">Nueva contraseña<input ref={passwordField} id="new-password" type={showPassword?'text':'password'} autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={event=>setPassword(event.target.value)} disabled={busy} aria-describedby="password-hint" className={inputClass}/></label>
   <p id="password-hint" className="text-xs leading-6 text-slate-500">Usa al menos 8 caracteres. Elige una contraseña diferente a la de otros sitios.</p>
   <label className="block text-sm font-semibold" htmlFor="confirm-password">Confirma la contraseña<input id="confirm-password" type={showPassword?'text':'password'} autoComplete="new-password" required minLength={8} maxLength={72} value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={busy} className={inputClass}/></label>
   <label className="flex min-h-10 items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showPassword} onChange={event=>setShowPassword(event.target.checked)} className="h-4 w-4 accent-amber-900"/>Mostrar contraseñas</label>
   {errorMessage}<button type="submit" disabled={busy} className="checkout-pay">{busy?<><LoaderCircle size={18} className="checkout-spinner" aria-hidden="true"/>Guardando contraseña…</>:<>Guardar nueva contraseña<ArrowRight size={18} aria-hidden="true"/></>}</button>
   <p className="text-xs leading-6 text-slate-500">Se cerrarán las sesiones anteriores. Después iniciarás sesión con la nueva contraseña.</p>
  </form>:<form onSubmit={verify} className="space-y-5">
   <label htmlFor="recovery-code" className="block text-sm font-semibold">Código de recuperación<input id="recovery-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required minLength={6} maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))} disabled={busy} placeholder="000000" aria-describedby="code-hint" className={`${inputClass} py-5 text-center text-3xl tracking-[.35em]`}/></label>
   <p id="code-hint" className="text-xs leading-6 text-slate-500">Copia el código del correo más reciente. Tienes hasta 5 intentos para verificarlo.</p>
   {errorMessage}{notice&&<p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">{notice}</p>}
   <button type="submit" disabled={busy||code.length!==6} className="checkout-pay">{busy?<><LoaderCircle size={18} className="checkout-spinner" aria-hidden="true"/>Espera un momento…</>:<>Verificar código<ArrowRight size={18} aria-hidden="true"/></>}</button>
   <div className="space-y-3 border-t pt-4 text-sm"><p className="text-xs leading-6 text-slate-500">¿No llegó? Revisa Spam y verifica que usaste el correo de tu cuenta.</p>{email&&<button type="button" onClick={resend} disabled={busy||remaining>0} className="min-h-10 font-semibold text-amber-900 underline disabled:text-slate-500 disabled:no-underline">{remaining>0?`Pedir otro código en ${remaining} s`:'Enviar otro código'}</button>}<Link to="/recuperar-password" className="block py-2 font-semibold text-amber-900 underline">Usar otro correo o empezar de nuevo</Link></div>
  </form>}
 </PasswordRecoveryLayout>;
}
