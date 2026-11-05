import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photosFromProduct, validateGallery, validateNewPhotos, appendGallery } from '../src/services/productGallery.js';
import { profileToForm, profileFromForm } from '../src/services/storeProfile.js';

test('Editar conserva fotos únicas en el orden de la portada existente',()=>{
  const photos=photosFromProduct({imagen:'/cover.png',galeria:['/cover.png','/detail.png']});
  assert.deepEqual(photos.map(photo=>photo.url),['/cover.png','/detail.png']);
  assert.equal(validateGallery(photos),'');assert.match(validateGallery(photos.slice(0,1)),/2 y 5/);
});
test('Galería impide exceso, formato, tamaño y selección repetida',()=>{
  const file={name:'foto.png',type:'image/png',size:100,lastModified:1};
  assert.equal(validateNewPhotos([],[file]),'');
  assert.match(validateNewPhotos(Array(5).fill({}),[file]),/hasta 5/);
  assert.match(validateNewPhotos([],[{...file,type:'image/svg+xml'}]),/formato/);
  assert.match(validateNewPhotos([],[{...file,size:5*1024*1024+1}]),/5 MB/);
  assert.match(validateNewPhotos([{file}],[file]),/ya está seleccionada/);
});
test('El envío de fotos mezcla referencias y archivos respetando el orden elegido',()=>{
  const body=new FormData(),file=new File(['test'],'nueva.png',{type:'image/png'});
  appendGallery(body,[{file,url:'blob:preview'},{url:'/original.png'},{file:new File(['more'],'otra.png',{type:'image/png'})}]);
  assert.deepEqual(JSON.parse(body.get('galeria_orden')),[{archivo:0},{url:'/original.png'},{archivo:1}]);
  assert.deepEqual(body.getAll('imagenes').map(item=>item.name),['nueva.png','otra.png']);
});
test('El editor público conserva párrafos y permite vaciar listas y año sin publicar banderas internas',()=>{
  const profile={historia:'Primer párrafo\n\nSegundo párrafo',fundacion:2020,cobertura:['Chía','Tabio'],valores:['Tradición'],color:'#abcdef',es_demo:true,contrasena:'privada'};
  const form=profileToForm(profile);assert.equal(form.cobertura,'Chía\nTabio');
  const result=profileFromForm({...form,valores:'',servicios:'Asesoría\n\nAsesoría\nDiseño',fundacion:''});
  assert.equal(result.historia,profile.historia);assert.equal(result.fundacion,null);assert.deepEqual(result.valores,[]);
  assert.deepEqual(result.servicios,['Asesoría','Diseño']);assert.equal(result.es_demo,undefined);assert.equal(result.contrasena,undefined);
});
