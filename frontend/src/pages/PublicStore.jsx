import { useEffect,useEffectEvent,useRef,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { ArrowLeft,ArrowDown,MapPin,Clock,Mail,Phone,Package,Truck,HeartHandshake,ArrowUpRight,Store } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import StoreCatalog from '../components/StoreCatalog';
import { api,imageUrl } from '../services/api';
import useCatalogUpdates from '../hooks/useCatalogUpdates';
import '../styles/stores.css';

export default function PublicStore(){
  const {id}=useParams();
  const latest=useRef(0);
  const [seller,setSeller]=useState(null),[products,setProducts]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  async function load(silent=false){
    const request=++latest.current;
    if(!silent)setLoading(true);
    try{const data=await api(`/marketplace/${id}`);if(request===latest.current){setSeller(data.seller);setProducts(data.products);setError('');}}
    catch(error){if(request===latest.current){setError(error.message);setSeller(null);}}
    finally{if(request===latest.current)setLoading(false);}
  }
  const initialize=useEffectEvent(()=>load());
  useEffect(()=>{initialize();},[id]);
  useCatalogUpdates(()=>load(true));
  const profile=seller?.perfil_publico||{};
  const color=/^#[\da-f]{6}$/i.test(profile.color||'')?profile.color:'#a34d1b';
  return <MainLayout><div className="stores-page" style={{'--store-accent':color}}>
    {loading?<div className="stores-shell stores-empty" role="status">Cargando la tienda…</div>:!seller?<div className="stores-shell stores-empty"><Store size={36}/><h1>Tienda no disponible</h1><p role="alert">{error}</p><Link to="/marketplace">Explorar las tiendas</Link></div>:<>
      <div className="store-profile-hero"><div className="stores-shell">
        <Link to="/marketplace" className="store-back"><ArrowLeft size={16}/> Todas las tiendas</Link>
        <div className="store-profile-heading"><div className="store-profile-wordmark"><img src={imageUrl(seller.logo)} alt={`Logo de ${seller.nombre_tienda}`} width="360" height="360"/></div><div className="store-profile-title"><span className="store-card-city"><MapPin size={15}/>{seller.ciudad}, Cundinamarca</span><h1>{seller.nombre_tienda}</h1><p className="store-profile-tagline">{profile.lema||seller.descripcion}</p><p>{profile.especialidad}</p><div className="store-profile-facts"><span><Package size={16}/>{seller.productos} productos</span><span>{Number(seller.resenas)>0?`${Number(seller.calificacion).toFixed(1)} / 5 · ${seller.resenas} reseñas`:'Aún sin reseñas'}</span>{profile.es_demo&&<span className="store-demo-badge">Tienda de demostración</span>}</div><a href="#coleccion" className="store-primary-link">Explorar la colección<ArrowDown size={17}/></a></div></div>
      </div></div>
      <div className="stores-shell store-profile-content">
        <section className="store-story"><div><span className="stores-eyebrow">DETRÁS DE LA MARCA</span><h2>Una historia con identidad.</h2><p className="store-story-intro">{seller.descripcion}</p>{(profile.historia||'').split('\n\n').filter(Boolean).map((paragraph,index)=><p key={index}>{paragraph}</p>)}<div className="store-values">{(profile.valores||[]).map(value=><span key={value}>{value}</span>)}</div></div><aside className="store-story-card"><span className="stores-eyebrow">LA ESENCIA DE {seller.nombre_tienda}</span><h3>{profile.especialidad||'Objetos para disfrutar tu cocina'}</h3>{profile.responsable_publico&&<p>Una propuesta de <strong>{profile.responsable_publico}</strong>{profile.fundacion?`, concebida en ${profile.fundacion}.`:'.'}</p>}<ul>{(profile.servicios||[]).map(service=><li key={service}><HeartHandshake size={18}/>{service}</li>)}</ul></aside></section>
        <section id="coleccion" className="store-collection"><div className="stores-section-heading"><div><span className="stores-eyebrow">OBJETOS PARA CADA DÍA</span><h2>La colección</h2></div><Link to={`/productos?vendedor=${seller.id_vendedor}`}>Ver en el catálogo<ArrowUpRight size={17}/></Link></div>{products.length?<StoreCatalog products={products}/>:<p className="stores-empty">Esta tienda está preparando su catálogo.</p>}{profile.es_demo&&<p className="store-collection-note">Productos ficticios con imágenes generadas por IA. Precios, características y existencias de prueba.</p>}</section>
        <section className="store-contact-section"><div><span className="stores-eyebrow">CERCA DE TI</span><h2>Conoce la tienda</h2><p>Información, atención y cobertura de {seller.nombre_tienda}.</p>{profile.es_demo&&<p className="store-contact-demo">Los datos de esta tienda son inventados. El correo y el teléfono son referencias de demostración y no reciben consultas.</p>}</div><dl className="store-contact-grid">
          <div><dt><MapPin size={19}/>Ubicación</dt><dd>{profile.direccion_publica||`${seller.ciudad}, Cundinamarca`}</dd></div>
          <div><dt><Clock size={19}/>Horario</dt><dd>{profile.horario||'Por confirmar con la tienda'}</dd></div>
          {profile.preparacion&&<div><dt><Package size={19}/>Preparación del pedido</dt><dd>{profile.preparacion}</dd></div>}
          <div><dt><Mail size={19}/>Correo</dt><dd>{profile.correo_publico?(profile.es_demo?<span>{profile.correo_publico}</span>:<a href={`mailto:${profile.correo_publico}`}>{profile.correo_publico}</a>):'No publicado'}</dd></div>
          <div><dt><Phone size={19}/>Teléfono</dt><dd>{profile.telefono_publico?(profile.es_demo?<span>{profile.telefono_publico} · ficticio</span>:<a href={`tel:${profile.telefono_publico}`}>{profile.telefono_publico}</a>):'No publicado'}</dd></div>
          <div className="store-coverage"><dt><Truck size={19}/>Cobertura en la Sabana</dt><dd>{(profile.cobertura||[seller.ciudad]).join(' · ')}</dd></div>
        </dl></section>
        <section className="store-shipping-note"><Truck size={26}/><div><h3>Del pedido a tu puerta</h3><p>{profile.politica_envio||'Consulta el estado de tu compra y los datos del envío desde Mis pedidos.'}</p><Link to="/envios-devoluciones">Consultar envíos, devoluciones y garantías<ArrowUpRight size={16}/></Link></div></section>
      </div>
    </>}
  </div></MainLayout>;
}
