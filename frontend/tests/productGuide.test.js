import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldAutoStartGuide,validateProductPhoto} from '../src/services/productGuide.js';

test('La guía se abre para un inventario vacío sin preferencia previa',()=>{
  assert.equal(shouldAutoStartGuide([],null,false),true);
});
test('Omitir o completar la guía evita repetirla automáticamente',()=>{
  assert.equal(shouldAutoStartGuide([],'omitida',false),false);
  assert.equal(shouldAutoStartGuide([],'completada',false),false);
});
test('Una respuesta tardía no interrumpe al comerciante que comenzó a escribir',()=>{
  assert.equal(shouldAutoStartGuide([],null,true),false);
});
test('No se inicia automáticamente con productos existentes o inventario desconocido',()=>{
  assert.equal(shouldAutoStartGuide([{id_producto:1}],null,false),false);
  assert.equal(shouldAutoStartGuide(undefined,null,false),false);
});

test('Fotos JPEG, PNG y WebP hasta 5 MB son aceptadas',()=>{
  for(const type of ['image/jpeg','image/png','image/webp'])assert.equal(validateProductPhoto({type,size:5*1024*1024}),'');
});
test('Fotos de formato incompatible o mayores a 5 MB reciben una explicación',()=>{
  assert.match(validateProductPhoto({type:'image/gif',size:100}),/formato no es compatible/);
  assert.match(validateProductPhoto({type:'image/png',size:5*1024*1024+1}),/supera los 5 MB/);
});
