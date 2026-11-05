import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentReceiptState,canPrintReceipt } from '../src/services/checkout.js';
const result=(estado='pagado',estado_pago='aprobado')=>({receiptAllowed:true,order:{estado,total:166500,referencia:'WC-receipt'},payment:{estado_pago,monto:'166500.00',referencia:'WC-receipt',transaccion:'tx-receipt',ambiente:'test'}});

test('Un rechazo prevalece sobre pagado y sobre cualquier ambiente o permiso antiguo',()=>{
 for(const estado of ['pendiente','pagado','empacando','enviado','entregado','cancelado'])for(const ambiente of ['test','demo','prod',null]){
  const data=result(estado,'rechazado');data.payment.ambiente=ambiente;
  assert.equal(paymentReceiptState(data.order,data.payment),'rejected');assert.equal(canPrintReceipt(data),false);
 }
});
test('La impresión exige autorización del servidor y pago aprobado de la misma referencia y monto',()=>{
 for(const estado of ['pagado','empacando','enviado','entregado'])assert.equal(canPrintReceipt(result(estado)),true);
 for(const changes of [{estado_pago:'pendiente'},{estado_pago:'cancelado'},{monto:0},{monto:null},{monto:166499},{referencia:'otra'},{transaccion:null},{transaccion:''}]){
  const data=result();Object.assign(data.payment,changes);assert.equal(canPrintReceipt(data),false);
 }
 assert.equal(canPrintReceipt({...result(),receiptAllowed:false}),false);
 assert.equal(canPrintReceipt({...result(),receiptAllowed:undefined}),false);
 assert.equal(canPrintReceipt({...result(),payment:null}),false);
});
test('No se imprime otro pedido ni se reutiliza la aprobación al volver con una transacción distinta',()=>{
 const data=result();assert.equal(canPrintReceipt(data,'tx-receipt'),true);assert.equal(canPrintReceipt(data,'tx-rechazada'),false);
 // The same eligibility check is repeated on the freshly fetched response before window.print.
 assert.equal(canPrintReceipt(result('pagado','rechazado'),'tx-receipt'),false);
});
test('Pendientes y cancelados carecen de recibo aunque conserven una transacción',()=>{
 const pending=result('pendiente','pendiente');assert.equal(paymentReceiptState(pending.order,pending.payment),'pending');assert.equal(canPrintReceipt(pending),false);
 const cancelled=result('cancelado');assert.equal(paymentReceiptState(cancelled.order,cancelled.payment),'cancelled');assert.equal(canPrintReceipt(cancelled),false);
 assert.equal(paymentReceiptState(null,null),'unverified');
});
