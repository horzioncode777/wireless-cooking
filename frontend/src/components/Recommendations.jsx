import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice, imageUrl } from '../services/api';
import useCatalogUpdates from '../hooks/useCatalogUpdates';

export default function Recommendations() {
  const latest=useRef(0);
  const [products,setProducts] = useState([]);
  const [personalized,setPersonalized] = useState(false);
  async function load() {
    if(!localStorage.getItem('token')) return;
    const request=++latest.current;
    try { const data=await api('/recommendations'); if(request===latest.current){setProducts(data.products); setPersonalized(data.personalized);} }
    catch { /* Keep existing suggestions on a transient connection error. */ }
  }
  const initialize = useEffectEvent(()=>{load();});
  useEffect(()=>{initialize();},[]);
  useCatalogUpdates(()=>load());
  if(!products.length) return null;
  return <section aria-labelledby="recommendations-title" className="mx-auto max-w-7xl px-4 py-8">
    <h2 id="recommendations-title" className="text-2xl font-bold">{personalized?'Sugerencias para ti':'Descubre productos populares'}</h2>
    <p className="mb-5 text-sm text-gray-700">{personalized?'Tomamos en cuenta productos similares a los que visitas, guardas y compras.':'Explora el catálogo para recibir sugerencias según tus intereses.'}</p>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {products.slice(0,4).map(product=><Link key={product.id_producto} to={`/producto/${product.id_producto}`} className="min-w-0 rounded-2xl border p-4 hover:border-amber-700">
        <img src={imageUrl(product.imagen)} alt="" loading="lazy" width="240" height="128" className="mb-3 h-32 w-full object-contain"/>
        <h3 className="font-bold">{product.nombre}</h3>
        <p>{formatPrice(product.precio)}</p>
        <p className="mt-2 text-xs text-gray-700">{product.reason}</p>
      </Link>)}
    </div>
  </section>;
}
