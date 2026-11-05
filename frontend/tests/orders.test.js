import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderStates,orderStatusLabel,paymentEnvironmentLabel,deliveryDate,orderDate,orderProgressStates,orderProgressIndex } from '../src/services/orders.js';

test('Una recogida lista no se presenta como un envío',()=>{
 assert.equal(orderStatusLabel('enviado','recogida'),'Listo para recoger');
 assert.equal(orderStatusLabel('enviado','envio'),'Enviado');
});
test('El ambiente procede del pago guardado, incluso si cambia la configuración de la web',()=>{
 assert.equal(paymentEnvironmentLabel({ambiente:'test'}),'Wompi Sandbox');
 assert.equal(paymentEnvironmentLabel({ambiente:'demo'}),'Demostración');
 assert.equal(paymentEnvironmentLabel({transaccion:'demo-1'}),'Demostración');
 assert.equal(paymentEnvironmentLabel({}),'Ambiente sin registrar');
});
test('La fecha estimada conserva el día en Colombia y las fechas inválidas tienen alternativa',()=>{
 assert.match(deliveryDate('2026-11-05'),/^5(?:\/|\s)/);
 assert.equal(deliveryDate(null),'Por confirmar');
 assert.equal(orderDate('invalid'),'Por confirmar');
});

test('El seguimiento incluye empacado entre pago y envío',()=>{
 assert.deepEqual(orderStates.filter(state=>state.id!=='cancelado').map(state=>state.id),['pendiente','pagado','empacando','enviado','entregado']);
 assert.equal(orderStatusLabel('empacando','envio'),'Empacando');
 assert.equal(orderStatusLabel('empacando','recogida'),'Empacando');
});

test('La barra tiene tres pasos y preparar un paquete no lo presenta como enviado',()=>{
 assert.deepEqual(orderProgressStates,['pendiente','pagado','enviado']);
 assert.equal(orderProgressIndex('empacando'),1);
 assert.equal(orderProgressIndex('pagado'),1);
 assert.equal(orderProgressIndex('enviado'),2);
 assert.equal(orderProgressIndex('entregado'),2);
 assert.equal(orderProgressIndex('cancelado'),-1);
});
