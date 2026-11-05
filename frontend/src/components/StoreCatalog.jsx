import { Link } from 'react-router-dom';
import { ArrowUpRight,Images } from 'lucide-react';
import { imageUrl,formatPrice } from '../services/api';

export default function StoreCatalog({products}){
  return <div className="store-product-grid">{products.map(product=>{
    const photos=[...new Set([product.imagen,...(Array.isArray(product.galeria)?product.galeria:[])].filter(Boolean))];
    return <article className="store-product-card" key={product.id_producto}>
      <Link to={`/producto/${product.id_producto}`} className="store-product-image"><img src={imageUrl(photos[0])} alt={product.nombre} width="520" height="520" loading="lazy"/>{photos[1]&&<img src={imageUrl(photos[1])} alt="" loading="lazy" className="store-product-alternate" width="520" height="520"/>}<span><Images size={14}/>{photos.length} fotos</span></Link>
      <div className="store-product-info"><span className="stores-eyebrow">{product.categoria}</span><h3><Link to={`/producto/${product.id_producto}`}>{product.nombre}</Link></h3><p>{product.material}</p><div><strong>{formatPrice(product.precio)}</strong><Link to={`/producto/${product.id_producto}`} aria-label={`Ver ${product.nombre}`}><ArrowUpRight size={21}/></Link></div><small>{Number(product.stock)>0?`${product.stock} disponibles`:'Agotado'}</small></div>
    </article>;
  })}</div>;
}
