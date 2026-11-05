import { openWompiWidget } from './wompiWidget.js';
export { paymentReceiptState,canPrintReceipt } from '../../../shared/paymentReceipt.js';

export const paymentMethods=[
  {id:'CARD',name:'Tarjeta',description:'Débito o crédito',mark:'Tarjeta',color:'bg-slate-900 text-white'},
  {id:'PSE',name:'PSE',description:'Desde tu cuenta bancaria',mark:'PSE',color:'bg-blue-900 text-white'},
  {id:'NEQUI',name:'Nequi',description:'Desde tu cuenta Nequi',mark:'Nequi',color:'bg-fuchsia-950 text-white'},
];
export const paymentMethodName=value=>paymentMethods.find(method=>method.id===value)?.name||value;
export function checkoutTotals(items,delivery,shipping){
  const subtotalCents=items.reduce((sum,item)=>sum+Math.round(Number(item.precio)*100)*item.cantidad,0);
  const shippingCents=delivery==='envio'?Math.round(Number(shipping)*100):0;
  return {subtotal:subtotalCents/100,shipping:shippingCents/100,total:(subtotalCents+shippingCents)/100};
}
export async function startPayment(request,id,expectedMode,onTransaction){
  const session=await request(`/payments/${id}/session`,{method:'POST'});
  if(session.mode!==expectedMode)throw new Error('El modo de pago cambió. Revisa el pedido antes de continuar.');
  if(session.mode==='demo'){
    await request(`/payments/${id}/demo`,{method:'POST'});
    return {redirectUrl:null};
  }
  if(session.mode!=='wompi')throw new Error('El método de pago no está disponible.');
  if(session.checkout){
    await openWompiWidget(session.checkout,transactionId=>onTransaction?.({orderId:id,transactionId}));
    return {redirectUrl:null,widgetOpened:true};
  }
  const url=new URL(session.url);
  if(url.origin!=='https://checkout.wompi.co'||url.username||url.password)throw new Error('No se pudo abrir la página de pago. Retoma el pago desde este pedido.');
  return {redirectUrl:url.href};
}
export async function checkoutPayment(request,details,mode,onTransaction){
  const {order}=await request('/orders',{method:'POST',body:JSON.stringify(details)});
  try{return {order,...await startPayment(request,order.id_pedido,mode,onTransaction)};}
  catch(error){return {order,error:error.message};}
}
