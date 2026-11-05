export const orderStates=[{id:'pendiente',label:'Pendiente de pago'},{id:'pagado',label:'Pago confirmado'},{id:'empacando',label:'Empacando'},{id:'enviado',label:'Enviado'},{id:'entregado',label:'Entregado'},{id:'cancelado',label:'Cancelado'}];
export const orderProgressStates=['pendiente','pagado','enviado'];
export function orderProgressIndex(status){return orderProgressStates.indexOf(status==='empacando'?'pagado':status==='entregado'?'enviado':status);}
export function orderStatusLabel(status,delivery){return status==='enviado'&&delivery==='recogida'?'Listo para recoger':orderStates.find(item=>item.id===status)?.label||status||'Sin estado';}
export function paymentEnvironmentLabel(order){return order.ambiente==='test'?'Wompi Sandbox':order.ambiente==='demo'||order.transaccion?.startsWith('demo-')?'Demostración':order.ambiente==='prod'?'Pago de producción':'Ambiente sin registrar';}
export function orderDate(value,withTime=false){if(!value)return 'Por confirmar';const date=new Date(value);if(Number.isNaN(date.getTime()))return 'Por confirmar';return new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'medium',...(withTime?{timeStyle:'short'}:{})}).format(date);}
export function deliveryDate(value){if(!value)return 'Por confirmar';return orderDate(`${String(value).slice(0,10)}T12:00:00Z`);}
