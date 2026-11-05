import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutTotals,checkoutPayment,startPayment,paymentMethodName} from '../src/services/checkout.js';

test('Totales en centavos y envío cambian correctamente al elegir recogida',()=>{
  const items=[{precio:'19.90',cantidad:3},{precio:'1000.01',cantidad:2}];
  assert.deepEqual(checkoutTotals(items,'envio',12000),{subtotal:2059.72,shipping:12000,total:14059.72});
  assert.deepEqual(checkoutTotals(items,'recogida',12000),{subtotal:2059.72,shipping:0,total:2059.72});
  assert.equal(checkoutTotals(items,'envio',0).shipping,0);
});
test('El modo demo solo confirma después de obtener una sesión demo',async()=>{
  const calls=[];
  const request=async(path,options)=>{calls.push([path,options.method]);return {mode:'demo'};};
  assert.deepEqual(await startPayment(request,17,'demo'),{redirectUrl:null});
  assert.deepEqual(calls,[['/payments/17/session','POST'],['/payments/17/demo','POST']]);
});
test('Wompi devuelve la URL de la pasarela sin acreditar un pago',async()=>{
  const calls=[];
  const request=async path=>{calls.push(path);return {mode:'wompi',url:'https://checkout.wompi.co/p/?reference=WC-test'};};
  assert.equal((await startPayment(request,17,'wompi')).redirectUrl,'https://checkout.wompi.co/p/?reference=WC-test');
  assert.deepEqual(calls,['/payments/17/session']);
});
test('Un cambio de modo no realiza un pago inesperado',async()=>{
  const calls=[];
  await assert.rejects(startPayment(async path=>{calls.push(path);return {mode:'demo'};},17,'wompi'),/modo de pago cambió/);
  assert.equal(calls.length,1);
});
test('Solo se acepta el destino HTTPS de Wompi',async()=>{
  for(const url of ['https://example.com/p/','http://checkout.wompi.co/p/','https://checkout.wompi.co.evil.example/p/','https://user:pass@checkout.wompi.co/p/']){
    await assert.rejects(startPayment(async()=>({mode:'wompi',url}),17,'wompi'));
  }
});
test('Checkout crea el pedido y completa la simulación con una sola acción',async()=>{
  const calls=[];
  const details={clave_idempotencia:'same-checkout-key',metodo_pago:'NEQUI'};
  const result=await checkoutPayment(async(path,options)=>{
    calls.push(path);
    if(path==='/orders'){assert.deepEqual(JSON.parse(options.body),details);return {order:{id_pedido:17}};}
    return {mode:'demo'};
  },details,'demo');
  assert.deepEqual(result,{order:{id_pedido:17},redirectUrl:null});
  assert.deepEqual(calls,['/orders','/payments/17/session','/payments/17/demo']);
});
test('Si falla la sesión se conserva el pedido para retomarlo sin recrear la compra',async()=>{
  const calls=[];
  const result=await checkoutPayment(async path=>{calls.push(path);if(path==='/orders')return {order:{id_pedido:17}};throw Error('Sin conexión');},{},'wompi');
  assert.deepEqual(result,{order:{id_pedido:17},error:'Sin conexión'});
  assert.deepEqual(calls,['/orders','/payments/17/session']);
});
test('Una confirmación demo fallida conserva el pedido y no informa éxito',async()=>{
  const result=await checkoutPayment(async path=>{
    if(path==='/orders')return {order:{id_pedido:17}};
    if(path.endsWith('/session'))return {mode:'demo'};
    throw Error('Confirmación no recibida');
  },{},'demo');
  assert.equal(result.order.id_pedido,17);assert.equal(result.error,'Confirmación no recibida');
});
test('Si falla crear el pedido no se inicia un pago',async()=>{
  const calls=[];
  await assert.rejects(checkoutPayment(async path=>{calls.push(path);throw Error('Stock insuficiente');},{},'demo'),/Stock insuficiente/);
  assert.deepEqual(calls,['/orders']);
});
test('Los medios de pago conservan nombres claros en el resumen',()=>{
  assert.equal(paymentMethodName('CARD'),'Tarjeta');assert.equal(paymentMethodName('NEQUI'),'Nequi');
});
