import { useEffect,useRef,useState } from 'react';
import { flushSync } from 'react-dom';
import { Link,useLocation,useParams,useNavigate } from 'react-router-dom';
import { CheckCircle,Clock,AlertCircle,Printer,ArrowRight,ArrowLeft,Headphones,RotateCcw,ShoppingBag } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import DeliveryContact from '../components/DeliveryContact';
import ShipmentList from '../components/ShipmentList';
import { api,formatPrice,imageUrl } from '../services/api';
import { OrderStatus,OrderProgress,OrderDelivery,OrderHistory } from '../components/OrderTracking';
import { orderStatusLabel } from '../services/orders';
import { paymentReceiptState,canPrintReceipt,paymentMethodName,startPayment } from '../services/checkout';
import { PaymentContext,PaymentProtection } from '../components/PaymentUI';
import { Panel,buttonClass } from '../components/WorkspaceUI';

export default function Order(){
  const {id}=useParams(),location=useLocation(),navigate=useNavigate(),latest=useRef(null),processing=useRef(false),errorBox=useRef(null);
  const [data,setData]=useState(null),[config,setConfig]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[syncError,setSyncError]=useState(''),[printing,setPrinting]=useState(false),[printAuthorized,setPrintAuthorized]=useState(false);
  const returnedTransaction=new URLSearchParams(location.search).get('id');
  useEffect(()=>{
    let active=true,loading=false;
    async function load(){
      if(processing.current||loading)return;
      loading=true;
      const request=Symbol();latest.current=request;
      try{
        let [result,payment]=await Promise.all([api('/orders/'+id),api('/payments/config')]);
        const transactionId=returnedTransaction||result.payment?.transaccion;
        if(result.order.estado==='pendiente'&&payment.mode==='wompi'&&transactionId){
          try{
            await api(`/payments/${id}/verify`,{method:'POST',body:JSON.stringify({transactionId})});
            result=await api('/orders/'+id);
            if(active&&request===latest.current)setSyncError('');
          }catch(error){if(active&&request===latest.current)setSyncError(error.message);}
        }
        if(active&&request===latest.current){setData(result);setConfig(payment);setError('');if(['aprobado','rechazado','cancelado'].includes(result.payment?.estado_pago)&&(!returnedTransaction||returnedTransaction===result.payment?.transaccion))setSyncError('');}
      }
      catch(error){if(active&&request===latest.current)setError(error.message);}
      finally{loading=false;}
    }
    load();const timer=setInterval(load,10000);
    return()=>{active=false;latest.current=null;clearInterval(timer);};
  },[id,returnedTransaction]);
  useEffect(()=>{if(error)errorBox.current?.focus();},[error]);
  async function pay(){
    if(processing.current||!config)return;
    processing.current=true;setBusy(true);setError('');
    const request=Symbol();latest.current=request;
    try{
      const result=await startPayment(api,id,config.mode,({orderId,transactionId})=>navigate(`/pedido/${orderId}?id=${encodeURIComponent(transactionId)}`,{replace:true}));
      if(result.redirectUrl)window.location.assign(result.redirectUrl);
      else{const result=await api('/orders/'+id);if(request===latest.current)setData(result);}
    }catch(error){if(request===latest.current)setError(error.message);}
    finally{processing.current=false;if(request===latest.current)setBusy(false);}
  }
  const current=data?.order.id_pedido===Number(id)?data:null;
  const transactionMismatch=!!returnedTransaction&&!!current&&returnedTransaction!==current.payment?.transaccion;
  const receiptState=transactionMismatch?'unverified':paymentReceiptState(current?.order,current?.payment);
  const confirmed=canPrintReceipt(current,returnedTransaction)&&!syncError;
  const pending=receiptState==='pending',rejected=receiptState==='rejected';
  const demo=current?.payment?.ambiente==='demo'||current?.payment?.transaccion?.startsWith('demo-');
  const sandbox=current?.payment?.ambiente==='test';
  const awaitingTransaction=pending&&config?.mode==='wompi'&&!!(returnedTransaction||current?.payment?.transaccion);
  const title=confirmed?(demo?'Simulación aprobada de este pedido':sandbox?'Pago de prueba aprobado en Wompi':'Pago confirmado'):rejected?'El pago fue rechazado':receiptState==='cancelled'?'Pedido cancelado':pending?(awaitingTransaction?'Estamos verificando tu pago':'Tu pedido está pendiente de pago'):'Pago sin confirmar';
  async function printReceipt(){
    if(printing||!confirmed)return;
    setPrinting(true);setError('');
    try{
      const fresh=await api('/orders/'+id);
      flushSync(()=>setData(fresh));
      if(!canPrintReceipt(fresh,returnedTransaction))throw Error('No se puede imprimir: este pedido no tiene un pago aprobado y confirmado.');
      flushSync(()=>setPrintAuthorized(true));
      window.print();
    }catch(error){setError(error.message);}
    finally{setPrintAuthorized(false);setPrinting(false);}
  }
  const Icon=confirmed?CheckCircle:pending?Clock:AlertCircle;
  return <MainLayout><section className={`information-page order-receipt-page ${printAuthorized?'receipt-print-authorized':''}`}><div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-12">
    <Link to="/mis-pedidos" className="inline-flex min-h-11 items-center gap-2 text-sm text-stone-600 print:hidden"><ArrowLeft size={16} aria-hidden="true"/>Volver a mis pedidos</Link>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold tracking-[.15em] text-amber-800">CADA PASO DE TU COMPRA</p><h1 className="mt-3 text-3xl font-bold">Pedido #{id}</h1></div>{current&&(confirmed||pending?<OrderStatus status={current.order.estado} delivery={current.order.tipo_entrega}/>:<span className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-900">{rejected?'Pago rechazado':'Sin pago confirmado'}</span>)}</div>
    {error&&<p ref={errorBox} tabIndex={-1} role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">{error}</p>}
    {!data&&!error&&<p role="status">Consultando el estado de tu pedido…</p>}
    {current&&<>
      {(confirmed||pending)&&<div className="print:hidden"><OrderProgress order={data.order}/></div>}
      <section aria-labelledby="payment-state" className={'space-y-4 rounded-3xl border p-6 '+(confirmed?'border-emerald-200 bg-emerald-50':pending?'border-amber-200 bg-amber-50':'border-red-200 bg-red-50')}>
        <Icon aria-hidden="true" size={36}/><h2 id="payment-state" className="text-2xl font-bold">{title}</h2>
        <p>{confirmed?(demo?'Este registro corresponde únicamente a la simulación de este pedido. No confirma otro intento de pago ni acredita un cobro real.':sandbox?'Wompi confirmó la transacción de Sandbox. No corresponde a un cobro real ni a un despacho comercial.':'Recibimos la confirmación del pago. Puedes guardar tu comprobante y consultar aquí el estado de entrega.'):pending?(awaitingTransaction?'Consultamos la transacción directamente con Wompi. Espera el resultado antes de volver a pagar.':'El pedido ya está creado. Retoma el pago desde aquí; no necesitas volver a crear la compra.'):rejected?'El pago no fue aprobado. No se emite comprobante ni se habilita su impresión. Consulta tus pedidos para iniciar una nueva compra.':receiptState==='cancelled'?'Este pedido está cancelado y no tiene un recibo disponible.':'No hay una confirmación de pago válida para este pedido. No se puede emitir ni imprimir un recibo. Consulta el estado o contacta con soporte.'}</p>
        {syncError&&<p role="status" className="text-sm">No pudimos actualizar la transacción: {syncError} Volveremos a comprobarla automáticamente.</p>}
        {pending&&location.state?.paymentNotice&&<p className="rounded-xl border border-amber-300 bg-white p-4">No se pudo completar el paso de pago: {location.state.paymentNotice}</p>}
        {pending&&config&&<PaymentContext config={config}/>}
        {pending&&<><p className="text-sm">El estado se comprueba automáticamente cada 10 segundos. Si acabas de pagar en Wompi, espera la confirmación antes de volver a intentarlo.</p>{!awaitingTransaction&&<button type="button" onClick={pay} disabled={busy||!config||(config.mode!=='demo'&&!config.configured)} className={buttonClass+' gap-2'}>{busy?'Procesando…':config?.mode==='demo'?'Simular pago de '+formatPrice(data.order.total):'Retomar pago en Wompi'}<ArrowRight aria-hidden="true" size={18}/></button>}</>}
        {confirmed&&<p className="font-semibold">Entrega: {data.order.estado==='pagado'?'Por preparar':orderStatusLabel(data.order.estado,data.order.tipo_entrega)}</p>}
      </section>
      <div className="order-receipt-details"><Panel title={confirmed?'Comprobante digital':'Resumen del pedido · sin comprobante de pago'}>
        <div className="space-y-2 text-sm"><p>Fecha: {new Date(data.order.fecha_creacion).toLocaleString('es-CO')}</p><p className="break-all">Referencia: {data.order.referencia}</p>{data.payment?.transaccion&&<p className="break-all">Transacción: {data.payment.transaccion}</p>}<p className="break-words">Entrega: {data.order.direccion_entrega}</p><p>Medio de pago: {paymentMethodName(data.order.metodo_pago)}</p></div>
        <ul className="my-5 space-y-4">{data.items.map(item=><li key={item.id_detalle} className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><img src={imageUrl(item.imagen)} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-stone-50 object-contain print:hidden"/><div className="min-w-0"><p className="break-words text-sm font-semibold">{item.nombre} × {item.cantidad}</p>{item.nombre_tienda&&<p className="mt-1 text-xs text-stone-500">{item.nombre_tienda}</p>}</div></div><strong className="shrink-0 text-sm">{formatPrice(item.subtotal)}</strong></li>)}</ul>
        <dl className="space-y-3 border-t pt-4"><div className="flex justify-between gap-3"><dt>Subtotal</dt><dd>{formatPrice(Number(data.order.total)-Number(data.order.envio))}</dd></div><div className="flex justify-between gap-3"><dt>Envío</dt><dd>{Number(data.order.envio)===0?'Gratis':formatPrice(data.order.envio)}</dd></div><div className="flex justify-between gap-3 text-2xl font-bold"><dt>Total</dt><dd>{formatPrice(data.order.total)}</dd></div></dl>
        {confirmed&&demo&&<p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 font-semibold text-amber-950">Comprobante de demostración. No acredita un cobro real.</p>}
        {confirmed&&sandbox&&<p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 font-semibold text-blue-950">Comprobante de pruebas de Wompi Sandbox. No acredita un cobro real.</p>}
        {!confirmed&&<p className="mt-4 text-sm font-semibold">Este resumen no acredita un pago confirmado.</p>}
        {confirmed&&<button type="button" disabled={printing} className={buttonClass+' mt-5 gap-2 print:hidden'} onClick={printReceipt}><Printer aria-hidden="true" size={18}/>{printing?'Comprobando pago…':'Imprimir / guardar recibo'}</button>}
      </Panel></div>
      {pending&&config&&<Panel><PaymentProtection config={config}/></Panel>}
      <DeliveryContact key={id} order={data.order} shipments={data.shipments} onSaved={async()=>setData(await api('/orders/'+id))}/>
      <div className="grid items-start gap-5 print:hidden md:grid-cols-2">{data.shipments?.length>0?<ShipmentList shipments={data.shipments} order={data.order} guideAllowed={confirmed}/>:<OrderDelivery order={data.order}/>}<OrderHistory history={data.history} delivery={data.order.tipo_entrega}/></div>
    </>}
    <p className="order-print-denied">No hay un recibo autorizado para imprimir. Usa «Imprimir / guardar recibo» después de confirmar un pago aprobado.</p>
    <nav aria-label="Opciones de tu pedido" className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 print:hidden"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-bold text-[#293b32]">Todo lo que necesitas para tu compra</h2><Link to="/mis-pedidos" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-stone-600 hover:text-amber-800"><ArrowLeft size={16}/>Mis pedidos</Link></div><div className={`grid gap-3 ${confirmed?'sm:grid-cols-3':'sm:grid-cols-2'}`}>{[{to:`/pqr?pedido=${encodeURIComponent(id)}`,icon:Headphones,title:'Ayuda con mi pedido',description:'Consulta o reporta una incidencia.'},...(confirmed?[{to:`/postventa?pedido=${encodeURIComponent(id)}`,icon:RotateCcw,title:'Devoluciones y garantías',description:'Solicita una solución y revisa su avance.'}]:[]),{to:'/productos',icon:ShoppingBag,title:'Seguir comprando',description:'Encuentra algo más para tu cocina.'}].map(action=><Link key={action.to} to={action.to} className="group flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 transition hover:border-amber-700 hover:bg-amber-50"><span className="rounded-xl bg-white p-2.5 text-[#3a5543]"><action.icon size={19}/></span><span className="min-w-0"><span className="block text-sm font-bold text-[#293b32]">{action.title}</span><span className="mt-2 block text-xs leading-5 text-stone-500">{action.description}</span></span></Link>)}</div></nav>
  </div></section></MainLayout>;
}
