import { test } from 'node:test';
import assert from 'node:assert/strict';
// Pure ranking tests never connect; keep even an eagerly constructed pool isolated.
process.env.TEST_SCHEMA='test_recommendations_unit';
const { trainContentModel,rankRecommendations } = await import('../src/services/recommendations.js');

const products=[
  {id_producto:1,id_categoria:1,nombre:'Tazón cerámica esmaltada',descripcion:'Tazón artesanal para sopas',categoria:'Cerámica',material:'Cerámica',stock:10,ventas:0},
  {id_producto:2,id_categoria:1,nombre:'Plato cerámica esmaltada',descripcion:'Plato artesanal para sopas',categoria:'Cerámica',material:'Cerámica',stock:10,ventas:0},
  {id_producto:3,id_categoria:2,nombre:'Sartén acero inoxidable',descripcion:'Sartén metálico para freír',categoria:'Acero',material:'Acero inoxidable',stock:10,ventas:20},
  {id_producto:4,id_categoria:2,nombre:'Olla acero inoxidable',descripcion:'Olla metálica resistente',categoria:'Acero',material:'Acero inoxidable',stock:10,ventas:1},
  {id_producto:5,id_categoria:1,nombre:'Vajilla cerámica esmaltada',descripcion:'Vajilla artesanal para sopas',categoria:'Cerámica',material:'Cerámica',stock:0,ventas:200},
];
test('Sin historial se ofrecen productos populares disponibles',()=>{
  const result=rankRecommendations(trainContentModel(products),[],4);
  assert.equal(result.personalized,false);
  assert.equal(result.products[0].id_producto,3);
  assert.ok(result.products.every(product=>product.stock>0));
});
test('El modelo responde a intereses diferentes y explica sus sugerencias',()=>{
  const model=trainContentModel(products);
  const ceramic=rankRecommendations(model,[{id_producto:1,weight:4}],4);
  const steel=rankRecommendations(model,[{id_producto:3,weight:4}],4);
  assert.equal(ceramic.personalized,true);
  assert.equal(ceramic.products[0].id_categoria,1);
  assert.equal(steel.products[0].id_categoria,2);
  assert.match(ceramic.products[0].reason,/Cerámica/);
  assert.ok(ceramic.products.every(product=>Number.isFinite(product.recommendation_score)));
});
test('Las compras recientes reducen la repetición exacta y conservan productos similares',()=>{
  const result=rankRecommendations(trainContentModel(products),[{id_producto:1,weight:6,purchased:true}],4);
  assert.equal(result.products[0].id_producto,2);
});
test('Un catálogo vacío o señales antiguas desconocidas no fallan',()=>{
  assert.deepEqual(rankRecommendations(trainContentModel([]),[{id_producto:999,weight:4}]).products,[]);
  assert.equal(rankRecommendations(trainContentModel(products),[{id_producto:999,weight:4}]).personalized,false);
});
