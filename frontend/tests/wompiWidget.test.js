import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPayment, checkoutPayment } from '../src/services/checkout.js';
import { validateWidgetConfiguration } from '../src/services/wompiWidget.js';

const checkout={publicKey:'pub_test_fixture',currency:'COP',amountInCents:2500000,reference:'WC-fixture',signature:{integrity:'a'.repeat(64)},customerData:{email:'sandbox@example.com'}};

test('El widget recibe únicamente datos firmados permitidos y ninguna redirección local',()=>{
 const cleaned=validateWidgetConfiguration({...checkout,redirectUrl:'http://localhost:5173/pedido/1',arbitrary:'ignored'});
 assert.deepEqual(cleaned,checkout);
 for(const invalid of [{...checkout,publicKey:'prv_test_secret'},{...checkout,amountInCents:-1},{...checkout,signature:{integrity:'bad'}},{...checkout,currency:'USD'}])assert.throws(()=>validateWidgetConfiguration(invalid));
});

test('El widget abre sin redirigir la web, devuelve un ID y no acredita el pago del navegador',async t=>{
 const previousWindow=globalThis.window;let options,callback;
 globalThis.window={WidgetCheckout:class {constructor(config){options=config;}open(onResult){callback=onResult;}}};
 t.after(()=>{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;});
 const calls=[],completed=[];
 const result=await startPayment(async path=>{calls.push(path);return {mode:'wompi',checkout};},17,'wompi',value=>completed.push(value));
 assert.deepEqual(result,{redirectUrl:null,widgetOpened:true});assert.deepEqual(calls,['/payments/17/session']);
 assert.equal(options.redirectUrl,undefined);
 callback({transaction:{id:'tx-sandbox-123',status:'APPROVED'}});
 assert.deepEqual(completed,[{orderId:17,transactionId:'tx-sandbox-123'}]);
 callback({});callback({transaction:{id:'https://evil.example/'}});assert.equal(completed.length,1);
 // Closing the widget without a transaction never leaves startPayment pending.
 assert.equal(result.widgetOpened,true);
});

test('Un fallo al cargar Wompi conserva el pedido para retomarlo',async t=>{
 const previousWindow=globalThis.window,previousDocument=globalThis.document;
 globalThis.window={};
 globalThis.document={createElement(){return {remove(){}};},head:{appendChild(script){assert.equal(script.src,'https://checkout.wompi.co/widget.js');queueMicrotask(()=>script.onerror());}}};
 t.after(()=>{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;});
 const calls=[];
 const result=await checkoutPayment(async path=>{calls.push(path);return path==='/orders'?{order:{id_pedido:17}}:{mode:'wompi',checkout};},{},'wompi');
 assert.equal(result.order.id_pedido,17);assert.match(result.error,/No se pudo cargar Wompi/);assert.deepEqual(calls,['/orders','/payments/17/session']);
});
