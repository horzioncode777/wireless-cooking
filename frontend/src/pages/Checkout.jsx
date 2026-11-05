import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Store, ArrowRight, ShoppingBag, Check, ShieldCheck, LoaderCircle, Headphones } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { api, formatPrice, readUser, imageUrl } from '../services/api';
import { checkoutTotals, checkoutPayment, paymentMethodName } from '../services/checkout';
import { PaymentChoices, PaymentContext, PaymentProtection, PaymentBrands, PaymentPreview } from '../components/PaymentUI';
import useCatalogUpdates from '../hooks/useCatalogUpdates';
import { buttonClass } from '../components/WorkspaceUI';

export default function Checkout(){
  const navigate=useNavigate(),key=useRef(crypto.randomUUID()),processing=useRef(false),errorBox=useRef(null);
  const [items,setItems]=useState([]),[config,setConfig]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [address,setAddress]=useState(readUser()?.direccion||''),[city,setCity]=useState(''),[delivery,setDelivery]=useState('envio'),[method,setMethod]=useState('CARD');
  const [recipient,setRecipient]=useState([readUser()?.nombre,readUser()?.apellido].filter(Boolean).join(' ')),[phone,setPhone]=useState(readUser()?.telefono||'');
  useEffect(()=>{
    let current=true;
    Promise.all([api('/cart'),api('/payments/config')]).then(([cart,pay])=>{
      if(current&&!processing.current){setItems(cart.cart.items);setConfig(pay);setError('');}
    }).catch(error=>{if(current)setError(error.message);}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[]);
  useEffect(()=>{if(error)errorBox.current?.focus();},[error]);
  useCatalogUpdates(()=>{
    if(!processing.current)api('/cart').then(data=>{if(!processing.current)setItems(data.cart.items);}).catch(error=>{if(!processing.current)setError(error.message);});
  });
  const totals=checkoutTotals(items,delivery,config?.shipping??12000);
  const unavailable=items.some(item=>item.cantidad>item.stock||item.estado!=='activo'||item.comercio_activo===false);
  const demo=config?.mode==='demo',ready=config&&(demo||config.configured);
  async function submit(event){
    event.preventDefault();
    if(processing.current||!ready||unavailable||!items.length)return;
    if((delivery==='envio'&&address.trim().length<8)||!city.trim()){
      setError('Completa la dirección y la ciudad para continuar.');return;
    }
    processing.current=true;setBusy(true);setError('');
    try{
      const result=await checkoutPayment(api,{
        direccion_entrega:delivery==='envio'?address.trim()+', '+city.trim():'Recogida en tienda, '+city.trim(),
        metodo_pago:method,entrega:delivery,clave_idempotencia:key.current,
        contacto:{nombre:recipient.trim(),telefono:phone.trim()},
      },config.mode,({orderId,transactionId})=>navigate(`/pedido/${orderId}?id=${encodeURIComponent(transactionId)}`,{replace:true}));
      if(result.redirectUrl)window.location.assign(result.redirectUrl);
      else navigate('/pedido/'+result.order.id_pedido,{replace:true,state:result.error?{paymentNotice:result.error}:null});
    }catch(error){setError(error.message);processing.current=false;setBusy(false);}
  }
  return <MainLayout><section className="checkout-page"><div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:py-12">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link to="/carrito" className="checkout-back"><ArrowLeft size={16}/>Volver al carrito</Link><span className="checkout-trust"><ShieldCheck size={16} aria-hidden="true"/>{demo?'Compra de demostración':'Pago a través de Wompi'}</span></div>
    <div className="checkout-heading"><div><p className="checkout-eyebrow">UN PASO MÁS PARA ESTRENAR</p><h1>El buen gusto empieza aquí<span>.</span></h1><p>Todo listo para tu cocina. Elige cómo recibir y pagar tu compra.</p></div><div className="checkout-accepted"><span>Elige tu forma de pagar</span><PaymentBrands/></div></div>
    <ol aria-label="Progreso de la compra" className="checkout-progress"><li aria-current="step" className="is-current"><span>1</span><div>Tu compra<small>Entrega y método</small></div></li><li><span>2</span><div>Pago<small>En la pasarela</small></div></li><li><span>3</span><div>¡Todo listo!<small>Confirmación</small></div></li></ol>
    {error&&<div ref={errorBox} tabIndex={-1} role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900"><p>{error}</p><Link to="/mis-pedidos" className="mt-2 inline-block font-bold underline">Consultar mis pedidos</Link></div>}
    {loading?<p role="status">Cargando tu compra…</p>:!config?<div className="rounded-2xl border bg-white p-6"><p>No se pudo cargar la compra.</p><button type="button" className={buttonClass+' mt-4'} onClick={()=>window.location.reload()}>Reintentar</button></div>:!items.length?<div className="space-y-4 rounded-3xl border bg-white p-8"><ShoppingBag aria-hidden="true" size={36}/><h2 className="text-xl font-bold">Tu carrito está vacío</h2><p>Si ya continuaste al pago, revisa el pedido antes de iniciar otra compra.</p><div className="flex flex-wrap gap-4"><Link to="/productos" className={buttonClass}>Explorar productos</Link><Link to="/mis-pedidos" className="rounded-xl border px-5 py-3 font-semibold">Mis pedidos</Link></div></div>:<>
      <PaymentContext config={config}/>
      {unavailable&&<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900"><p>Algunos productos cambiaron de disponibilidad. Ajusta el carrito antes de pagar.</p><Link to="/carrito" className="mt-2 inline-block font-bold underline">Revisar carrito</Link></div>}
      <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section aria-label="Entrega y método de pago" className="checkout-panel space-y-7 p-5 sm:p-8">
          <fieldset disabled={busy} className="space-y-4"><legend className="checkout-section-title"><span>01</span>¿Cómo recibes tu compra?</legend>
            <div className="grid grid-cols-2 gap-3">{[{id:'envio',name:'Envío a domicilio',description:formatPrice(config.shipping),icon:Truck},{id:'recogida',name:'Recogida en tienda',description:'Gratis',icon:Store}].map(option=><label key={option.id} className={'checkout-delivery '+(delivery===option.id?'is-selected':'')}><input type="radio" name="delivery" checked={delivery===option.id} onChange={()=>setDelivery(option.id)} className="sr-only"/><span className="flex items-center justify-between"><option.icon aria-hidden="true" size={22}/><span className="payment-choice-check" aria-hidden="true">{delivery===option.id&&<Check size={13} strokeWidth={3}/>}</span></span><span className="mt-3 block font-bold">{option.name}</span><span className={'mt-1 block text-sm '+(option.id==='recogida'?'font-semibold text-emerald-700':'text-slate-500')}>{option.description}</span></label>)}</div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block font-semibold">Nombre de quien recibe<input required minLength={2} maxLength={150} autoComplete="name" value={recipient} onChange={event=>setRecipient(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal"/></label><label className="block font-semibold">Teléfono de contacto<input required type="tel" minLength={7} maxLength={25} autoComplete="tel" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="Número para coordinar la entrega" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal"/></label></div>
            {delivery==='envio'?<label className="block font-semibold">Dirección completa<input required minLength={8} maxLength={350} autoComplete="street-address" value={address} onChange={event=>setAddress(event.target.value)} placeholder="Calle, número, barrio y apartamento" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal"/></label>:<p className="rounded-xl bg-gray-50 p-3 text-sm">La recogida no tiene costo de envío. Cada comercio registrará el punto, la fecha y el horario en el detalle de tu pedido.</p>}
            <label className="block font-semibold">Ciudad<input required maxLength={100} autoComplete="address-level2" value={city} onChange={event=>setCity(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal"/></label>
          </fieldset>
          <PaymentChoices value={method} onChange={setMethod} disabled={busy}/>
          <div className="checkout-protection"><PaymentProtection config={config}/></div>
        </section>
        <aside aria-label="Resumen de tu compra" className="checkout-summary checkout-panel p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold tracking-tight">Tu compra</h2><span className="checkout-count">{items.reduce((sum,item)=>sum+item.cantidad,0)} unidades</span></div><p className="mt-1 text-sm text-slate-500">Un detalle más cerca de tu cocina ideal.</p>
          <ul className="my-5 max-h-80 space-y-4 overflow-y-auto">{items.map(item=><li key={item.id_item} className="flex items-start gap-3"><img loading="lazy" src={imageUrl(item.imagen)} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-gray-50 object-contain"/><div className="min-w-0 flex-1"><p className="break-words font-semibold">{item.nombre}</p><p className="text-sm text-gray-600">{item.cantidad} × {formatPrice(item.precio)}</p></div><strong className="shrink-0 text-sm">{formatPrice(Number(item.precio)*item.cantidad)}</strong></li>)}</ul>
          <dl className="checkout-totals"><div><dt>Subtotal</dt><dd>{formatPrice(totals.subtotal)}</dd></div><div><dt>{delivery==='envio'?'Envío a domicilio':'Recogida en tienda'}</dt><dd className={totals.shipping===0?'text-emerald-700 font-semibold':''}>{totals.shipping===0?'Gratis':formatPrice(totals.shipping)}</dd></div><div className="checkout-total"><dt>Total <small>COP</small></dt><dd>{formatPrice(totals.total)}</dd></div></dl>
          <div className="mt-5"><PaymentPreview method={method} amount={formatPrice(totals.total)}/></div><p className="sr-only" role="status">Medio elegido: {paymentMethodName(method)}. Total: {formatPrice(totals.total)} pesos colombianos.</p>
          {!ready&&<p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-950">La pasarela está pendiente de configuración. Puedes conservar tu carrito y volver más tarde.</p>}
          <button type="submit" disabled={busy||unavailable||!ready} className="checkout-pay mt-5">{busy?<><LoaderCircle className="checkout-spinner" aria-hidden="true" size={19}/>Procesando tu compra…</>:<>{demo?'Simular pago':'Continuar al pago'}<ArrowRight aria-hidden="true" size={19}/></>}</button>
          <p role="status" className="mt-3 text-sm text-gray-600">{busy?'Espera un momento. No necesitas volver a pulsar el botón.':demo?'Esta acción crea el pedido y confirma un pago de prueba, sin cobro real.':'Continuarás en Wompi para completar el pago. Al regresar podrás consultar su confirmación.'}</p>
          <Link to="/pqr" className="checkout-help"><Headphones size={16} aria-hidden="true"/>¿Necesitas ayuda? Estamos para ti<ArrowRight size={14} aria-hidden="true"/></Link>
        </aside>
      </form>
    </>}
  </div></section></MainLayout>;
}
