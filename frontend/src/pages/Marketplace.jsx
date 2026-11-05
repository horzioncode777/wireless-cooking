import { useEffect,useEffectEvent,useMemo,useRef,useState } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { api,imageUrl } from '../services/api';
import { ArrowUpRight,MapPin,Search,Store,ArrowRight,Package } from 'lucide-react';
import useCatalogUpdates from '../hooks/useCatalogUpdates';
import '../styles/stores.css';

export default function Marketplace(){
  const latest=useRef(0);
  const [sellers,setSellers]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [query,setQuery]=useState(''),[city,setCity]=useState('');
  async function load(){
    const request=++latest.current;
    try{const data=await api('/marketplace');if(request===latest.current){setSellers(data.sellers);setError('');}}
    catch(error){if(request===latest.current)setError(error.message);}
    finally{if(request===latest.current)setLoading(false);}
  }
  const initialize=useEffectEvent(()=>{load();});
  useEffect(()=>{initialize();},[]);
  useCatalogUpdates(()=>load());
  const cities=useMemo(()=>[...new Set(sellers.map(s=>s.ciudad).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')), [sellers]);
  const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const visible=sellers.filter(s=>(!city||s.ciudad===city)&&normalized(`${s.nombre_tienda} ${s.ciudad} ${s.perfil_publico?.especialidad}`).includes(normalized(query)));
  return <MainLayout><div className="stores-page">
    <section className="stores-intro"><div className="stores-shell stores-intro-content">
      <div><span className="stores-eyebrow"><Store size={15}/> NUESTRA COMUNIDAD</span><h1>Hecho para tu cocina.<br/><em>Descubierto en la Sabana.</em></h1><p>Conoce las marcas, sus historias y los objetos que hacen especial cada mesa.</p></div>
      <div className="stores-intro-stats"><strong>{loading?'—':sellers.length}</strong><span>tiendas para descubrir</span><div/><span><MapPin size={16}/> {cities.length} municipios de Cundinamarca</span></div>
    </div></section>
    <div className="stores-shell stores-directory">
      <div className="stores-section-heading"><div><span className="stores-eyebrow">CERCA DE TI, CON ESTILO PROPIO</span><h2>Tiendas de la Sabana</h2></div><p>Cerámica, acero y artesanías con identidad.</p></div>
      <div className="stores-filters">
        <label className="stores-search"><Search size={19}/><span className="sr-only">Buscar tiendas</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Busca una marca o especialidad" type="search"/></label>
        <label className="stores-city"><MapPin size={18}/><span className="sr-only">Filtrar por municipio</span><select value={city} onChange={e=>setCity(e.target.value)}><option value="">Todos los municipios</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label>
      </div>
      {error&&<p className="stores-error" role="alert">{error} <button type="button" onClick={load}>Volver a intentar</button></p>}
      {loading?<p role="status" className="stores-empty">Estamos preparando las tiendas…</p>:<>
        <p className="stores-result-count" aria-live="polite">{visible.length} {visible.length===1?'tienda':'tiendas'}{city?` en ${city}`:''}</p>
        <div className="stores-grid">{visible.map(seller=>{
          const profile=seller.perfil_publico||{};
          return <article className="store-card" key={seller.id_vendedor}>
            <Link to={`/tienda/${seller.id_vendedor}`} className="store-card-logo" aria-label={`Conocer ${seller.nombre_tienda}`}><img src={imageUrl(seller.logo)} alt={`Logo de ${seller.nombre_tienda}`} loading="lazy" width="320" height="220"/><span className="store-card-arrow"><ArrowUpRight size={20}/></span></Link>
            <div className="store-card-body"><span className="store-card-city"><MapPin size={14}/>{seller.ciudad}, Cundinamarca</span><h3><Link to={`/tienda/${seller.id_vendedor}`}>{seller.nombre_tienda}</Link></h3><p className="store-card-specialty">{profile.especialidad||'Productos para tu cocina'}</p><p className="store-card-description">{seller.descripcion}</p>
              <div className="store-card-meta"><span><Package size={15}/>{seller.productos} productos</span><span>{Number(seller.resenas)>0?`${Number(seller.calificacion).toFixed(1)} / 5 · ${seller.resenas} reseñas`:'Sin reseñas aún'}</span></div>
              <Link to={`/tienda/${seller.id_vendedor}`} className="store-card-link">Conocer tienda<ArrowRight size={17}/></Link>
            </div>
          </article>;
        })}</div>
        {!visible.length&&!error&&<div className="stores-empty"><Store size={32}/><h3>No encontramos tiendas con estos filtros.</h3><button onClick={()=>{setQuery('');setCity('');}}>Ver todas las tiendas</button></div>}
      </>}
      {sellers.some(s=>s.perfil_publico?.es_demo)&&<p className="stores-demo-note">Colección de demostración: marcas, contactos y catálogo ficticios para probar Wireless Cooking. Los pagos continúan en Sandbox.</p>}
    </div>
  </div></MainLayout>;
}
