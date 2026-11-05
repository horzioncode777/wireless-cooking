import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wompiSettings, fetchWompiTransaction } from '../src/services/wompi.js';

const sandbox = { WOMPI_ENVIRONMENT:'test', WOMPI_PUBLIC_KEY:'pub_test_fixture',
 WOMPI_PRIVATE_KEY:'prv_test_fixture', WOMPI_INTEGRITY_SECRET:'integrity-fixture', WOMPI_EVENTS_SECRET:'events-fixture' };

test('La integración exige llaves del mismo ambiente y bloquea una llave privada de producción en Sandbox', () => {
 assert.equal(wompiSettings(sandbox).configured,true);
 assert.equal(wompiSettings({...sandbox,WOMPI_PRIVATE_KEY:''}).configured,false);
 assert.equal(wompiSettings({...sandbox,WOMPI_PRIVATE_KEY:'prv_prod_fixture'}).configured,false);
});

test('La consulta de una transacción autentica en el servidor sin enviar la llave en la URL', async () => {
 const transaction={id:'test-transaction-1',reference:'order-fixture',status:'APPROVED',currency:'COP',amount_in_cents:10000};
 let calls=0;
 const value=await fetchWompiTransaction(transaction.id,{env:sandbox,fetchImpl:async(url,options)=>{
  calls++;
  assert.equal(url,'https://sandbox.wompi.co/v1/transactions/test-transaction-1');
  assert.equal(options.headers.Authorization,'Bearer prv_test_fixture');
  assert.ok(!url.includes(sandbox.WOMPI_PRIVATE_KEY));
  return new Response(JSON.stringify({data:transaction}),{status:200});
 }});
 assert.equal(calls,1);assert.deepEqual(value,transaction);
});

test('Una llave ausente o de otro ambiente no provoca consultas sin autenticar', async () => {
 for(const privateKey of ['', 'prv_prod_fixture']) {
  await assert.rejects(fetchWompiTransaction('transaction-1',{env:{...sandbox,WOMPI_PRIVATE_KEY:privateKey},
   fetchImpl:()=>{throw new Error('No debe alcanzar la red');}}),error=>error.status===503);
 }
});
