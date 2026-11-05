import pool from '../config/db.js';
import { catalogSnapshot } from './catalog.js';
import { fail } from '../utils/http.js';

// Local content model: learn a TF-IDF vocabulary from the current public catalog.
// No API key or personal data transfer is needed; it is not a conversational AI.
const stopwords = new Set('para con del las los una unos unas este esta como por que sus cocina producto productos artesanal artesanales cajica wireless cooking'.split(' '));
const tokens = text => String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]{3,}/g)?.filter(word => !stopwords.has(word)) || [];
const dot = (a,b) => { let sum=0; for (const [word,value] of a) sum += value * (b.get(word)||0); return sum; };
function normalize(vector) { const norm=Math.hypot(...vector.values()) || 1; return new Map([...vector].map(([word,value])=>[word,value/norm])); }

export function trainContentModel(products) {
  const counts = products.map(product => {
    const terms = tokens(`${product.nombre} ${product.nombre} ${product.categoria} ${product.categoria} ${product.material} ${product.descripcion}`);
    const count = new Map(); for (const term of terms) count.set(term,(count.get(term)||0)+1); return count;
  });
  const frequency = new Map();
  for (const count of counts) for (const term of count.keys()) frequency.set(term,(frequency.get(term)||0)+1);
  const vectors = counts.map(count=>normalize(new Map([...count].map(([term,count])=>[term,(1+Math.log(count))*(1+Math.log((1+products.length)/(1+frequency.get(term))))]))));
  return { products, vectors, index: new Map(products.map((product,index)=>[Number(product.id_producto),index])) };
}

export function rankRecommendations(model, signals, limit=8) {
  const profile = new Map(), categories = new Map(), purchased = new Set();
  for (const signal of signals) {
    const index = model.index.get(Number(signal.id_producto)); if(index===undefined) continue;
    const weight = Math.max(0,Number(signal.weight)||0);
    for (const [term,value] of model.vectors[index]) profile.set(term,(profile.get(term)||0)+value*weight);
    const product = model.products[index];
    categories.set(product.categoria,(categories.get(product.categoria)||0)+weight);
    if(signal.purchased) purchased.add(Number(signal.id_producto));
  }
  const userVector = normalize(profile);
  const strongestCategory = [...categories].sort((a,b)=>b[1]-a[1])[0]?.[0];
  const hasProfile = userVector.size>0;
  const ranked = model.products.filter(product=>Number(product.stock)>0).map(product=>{
    const index = model.index.get(Number(product.id_producto));
    const similarity = hasProfile ? dot(userVector,model.vectors[index]) : 0;
    const popularity = Math.log1p(Number(product.ventas)||0)*.025 + Math.log1p(Number(product.vistas)||0)*.005;
    const repeatPenalty = purchased.has(Number(product.id_producto)) ? .5 : 0;
    const reason = hasProfile && similarity>.1 ? (product.categoria===strongestCategory?`Por tu interés en ${strongestCategory}`:'Similar a los productos que exploraste') : 'Popular entre nuestros compradores';
    return {...product,recommendation_score:similarity+popularity-repeatPenalty,reason};
  }).sort((a,b)=>b.recommendation_score-a.recommendation_score || Number(b.id_producto)-Number(a.id_producto));
  // Reserve one discovery slot when another category exists. Keep the most relevant items first.
  const chosen=ranked.slice(0,limit);
  if(chosen.length>=4 && new Set(chosen.map(product=>product.id_categoria)).size===1) {
    const discovery=ranked.find(product=>product.id_categoria!==chosen[0].id_categoria);
    if(discovery) chosen[chosen.length-1]={...discovery,reason:'Descubre otra categoría de nuestros artesanos'};
  }
  return {products:chosen,mode:hasProfile?'modelo_contenido_tfidf':'popularidad',personalized:hasProfile};
}

let trained;
function contentModel(snapshot) {
  if(trained?.snapshot!==snapshot) trained={snapshot,model:trainContentModel(snapshot.products)};
  return trained.model;
}
export async function relatedProducts(req,res,next) {
  try {
    const id=Number(req.params.id);
    if(!Number.isInteger(id)||id<1) throw fail(400,'Producto inválido.');
    const model=contentModel(await catalogSnapshot());
    if(!model.index.has(id)) throw fail(404,'Producto no encontrado.');
    const result=rankRecommendations(model,[{id_producto:id,weight:1}],5);
    res.json({ok:true,products:result.products.filter(product=>Number(product.id_producto)!==id).slice(0,4)});
  }catch(error){next(error);}
}
const profiles=new Map();
export function invalidateRecommendations(userId) { profiles.delete(Number(userId)); }
export async function recommendationsFor(userId) {
  const snapshot=await catalogSnapshot();
  const model=contentModel(snapshot);
  const key=Number(userId), previous=profiles.get(key);
  if(previous?.snapshot===snapshot && Date.now()-previous.created<10000) return previous.promise;
  const entry={snapshot,created:Date.now(),promise:null};
  entry.promise=rankForUser(model,userId).catch(error=>{if(profiles.get(key)===entry) profiles.delete(key);throw error;});
  profiles.set(key,entry);
  if(profiles.size>500) profiles.delete(profiles.keys().next().value);
  return entry.promise;
}
async function rankForUser(model,userId) {
  const {rows}=await pool.query(`
    WITH signals AS (
      SELECT id_producto, LEAST(COUNT(*),5)*EXP(-EXTRACT(EPOCH FROM(now()-MAX(fecha)))/2592000) AS weight,false AS purchased
      FROM historial_navegacion WHERE id_usuario=$1 AND fecha>now()-interval '90 days' GROUP BY id_producto
      UNION ALL SELECT id_producto,4,false FROM favoritos WHERE id_usuario=$1
      UNION ALL SELECT ci.id_producto,3,false FROM carrito_items ci JOIN carritos c USING(id_carrito) WHERE c.id_usuario=$1 AND c.estado='activo'
      UNION ALL SELECT d.id_producto,6*EXP(-EXTRACT(EPOCH FROM(now()-MAX(o.fecha_creacion)))/7776000),true
      FROM detalle_pedido d JOIN pedidos o USING(id_pedido) WHERE o.id_usuario=$1 AND o.estado IN ('pagado','empacando','enviado','entregado') GROUP BY d.id_producto
    ) SELECT id_producto,SUM(weight) AS weight,BOOL_OR(purchased) AS purchased FROM signals GROUP BY id_producto
  `,[userId]);
  return rankRecommendations(model,rows);
}
