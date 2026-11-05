import { Link } from 'react-router-dom';
import { publicContact } from '../services/publicInformation';

export default function Footer() {
  const groups = [
    { title: 'Compañía', links: [['Sobre nosotros', '/nosotros'], ['Términos y condiciones', '/terminos'], ['Política de privacidad', '/privacidad']] },
    { title: 'Ayuda', links: [['Preguntas frecuentes', '/ayuda'], ['Envíos y devoluciones', '/envios-devoluciones'], ['Contacto', '/contacto']] },
    { title: 'Comunidad local', links: [['Tiendas de la Sabana', '/marketplace'], ['Peticiones, quejas y reclamos', '/pqr'], ['Mis pedidos', '/mis-pedidos'], ['Devoluciones y garantías', '/postventa']] },
  ];
  return <footer className="bg-gray-800 px-4 py-12 text-white">
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <div><Link to="/" aria-label="Wireless Cooking, inicio"><img src="/logo.png" alt="Wireless Cooking" width="240" className="mb-4 h-auto w-60 max-w-full object-contain"/></Link><p className="text-sm leading-6 text-gray-300">Cocina, artesanía y comercio local.</p><a href={`mailto:${publicContact.email}`} className="mt-3 inline-flex min-h-11 max-w-full items-center break-all text-sm text-gray-300 underline-offset-4 hover:text-white hover:underline">{publicContact.email}</a></div>
      {groups.map(group => <nav aria-label={group.title} key={group.title}><h2 className="mb-3 font-bold">{group.title}</h2><ul className="space-y-1 text-sm text-gray-300">{group.links.map(([label, path]) => <li key={path}><Link to={path} className="inline-flex min-h-11 items-center transition hover:text-white hover:underline">{label}</Link></li>)}</ul></nav>)}
    </div>
    <div className="mx-auto mt-10 max-w-7xl border-t border-gray-700 pt-6 text-center text-sm text-gray-300">© {new Date().getFullYear()} Wireless Cooking. Proyecto universitario.</div>
  </footer>;
}
