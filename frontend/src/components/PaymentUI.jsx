import { CreditCard, ShieldCheck, FlaskConical, LockKeyhole, Info, Check, ArrowUpRight, Landmark, Smartphone, Wifi } from 'lucide-react';
import { paymentMethods } from '../services/checkout';

export function PaymentLogo({brand}){
  return <span className={`payment-logo payment-logo--${brand}`} role="img" aria-label={brand==='mastercard'?'Mastercard':brand==='visa'?'Visa':brand==='pse'?'PSE':'Nequi'}>
    {brand==='visa'?<svg viewBox="0 0 80 32" aria-hidden="true"><text x="7" y="25" fill="#1434cb" fontFamily="Arial, sans-serif" fontSize="29" fontStyle="italic" fontWeight="900" letterSpacing="-2">VISA</text></svg>
    :brand==='mastercard'?<svg viewBox="0 0 80 40" aria-hidden="true"><circle cx="30" cy="20" r="16" fill="#eb001b"/><circle cx="50" cy="20" r="16" fill="#f79e1b"/><path d="M40 7.51a16 16 0 0 1 0 24.98 16 16 0 0 1 0-24.98" fill="#ff5f00"/></svg>
    :brand==='pse'?<svg viewBox="0 0 80 36" aria-hidden="true"><circle cx="17" cy="18" r="13" fill="none" stroke="#1265a8" strokeWidth="2"/><path d="m7 18 7 6 12-14" fill="none" stroke="#e6b72e" strokeWidth="3"/><text x="32" y="25" fill="#1265a8" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="24" letterSpacing="-1">pse</text></svg>
    :<svg viewBox="0 0 80 32" aria-hidden="true"><path d="m6 12 7-7 7 7-7 7Z" fill="#da0081"/><path d="m6 23 7-7 7 7-7 7Z" fill="#20c4cb"/><text x="23" y="23" fill="#200020" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="20" letterSpacing="-1">nequi</text></svg>}
  </span>;
}

export function PaymentBrands(){
  return <div className="payment-brands" aria-label="Medios de pago: Visa, Mastercard, PSE y Nequi">{['visa','mastercard','pse','nequi'].map(brand=><PaymentLogo key={brand} brand={brand}/>)}</div>;
}

export function PaymentPreview({method,amount}){
  const details={CARD:{title:'Tu próxima compra, más cerca.',label:'Débito o crédito',icon:CreditCard,brands:['visa','mastercard'],note:'Completa los datos de tu tarjeta en la pasarela.'},PSE:{title:'Paga desde tu banco.',label:'Transferencia con PSE',icon:Landmark,brands:['pse'],note:'Selecciona tu banco al continuar a la pasarela.'},NEQUI:{title:'Tu compra, desde tu celular.',label:'Paga con Nequi',icon:Smartphone,brands:['nequi'],note:'Continúa a la pasarela para pagar con tu cuenta Nequi.'}}[method];
  const Icon=details.icon;
  return <div key={method} className={`payment-preview payment-preview--${method.toLowerCase()}`}>
    <div className="payment-preview-top"><span><Icon size={16} aria-hidden="true"/>{details.label}</span><Wifi size={22} aria-hidden="true"/></div>
    <p className="payment-preview-title">{details.title}</p>
    <div className="payment-preview-bottom"><div><span>Total de tu compra · COP</span><strong>{amount}</strong></div><div className="flex gap-2">{details.brands.map(brand=><PaymentLogo key={brand} brand={brand}/>)}</div></div>
    <p className="payment-preview-note"><ArrowUpRight size={14} aria-hidden="true"/>{details.note}</p>
  </div>;
}

export function PaymentChoices({value,onChange,disabled}){
  return <fieldset disabled={disabled} className="payment-choices"><legend className="checkout-section-title"><span>02</span>Elige cómo pagar</legend>
    <p className="mb-4 text-sm text-slate-500">Tu método favorito, en un solo paso.</p>
    {paymentMethods.map(method=><label key={method.id} className={`payment-choice ${value===method.id?'is-selected':''}`}>
      <input type="radio" name="payment-method" value={method.id} checked={value===method.id} onChange={()=>onChange(method.id)} className="sr-only"/>
      <span className="payment-choice-check" aria-hidden="true">{value===method.id&&<Check size={13} strokeWidth={3}/>}</span>
      <span className="payment-choice-copy"><span className="block font-bold">{method.id==='CARD'?'Tarjeta de crédito o débito':method.name}</span><span className="block text-sm text-slate-500">{method.description}</span></span>
      <span className="payment-choice-logos">{(method.id==='CARD'?['visa','mastercard']:[method.id.toLowerCase()]).map(brand=><PaymentLogo key={brand} brand={brand}/>)}</span>
    </label>)}
    <p className="mt-3 text-xs leading-relaxed text-slate-500">La disponibilidad final de cada medio se muestra al abrir la pasarela.</p>
  </fieldset>;
}
export function PaymentContext({config}){
  if(config?.mode==='demo')return <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><FlaskConical size={22} className="shrink-0" aria-hidden="true"/><div><p className="font-bold">Compra de demostración</p><p className="mt-1 text-sm">No se cobrará dinero ni se pedirán datos bancarios. El botón final simula un pago aprobado.</p></div></div>;
  if(config?.environment==='test')return <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950"><FlaskConical size={22} className="shrink-0" aria-hidden="true"/><div><p className="font-bold">Pasarela en modo de pruebas</p><p className="mt-1 text-sm">Usa únicamente los datos de prueba del proveedor. Esta compra no corresponde a un cobro de producción.</p></div></div>;
  return null;
}
export function PaymentProtection({config}){
  const encrypted=window.location.protocol==='https:';
  const ConnectionIcon=encrypted?LockKeyhole:Info;
  return <div className="space-y-3 text-sm text-gray-700"><div className="flex gap-3"><ShieldCheck size={20} aria-hidden="true" className="shrink-0 text-emerald-800"/><p>{config?.mode==='demo'?'En esta demostración no se ingresan datos de tarjeta.':'Los datos de tu tarjeta o cuenta se ingresan directamente en Wompi. Wireless Cooking no guarda números de tarjeta ni códigos de seguridad.'}</p></div><div className="flex gap-3"><ConnectionIcon size={20} aria-hidden="true" className="shrink-0 text-gray-600"/><p>{encrypted?'La conexión con esta página está cifrada mediante HTTPS.':'Esta página no utiliza HTTPS. Úsala únicamente como entorno local de pruebas.'}</p></div></div>;
}
