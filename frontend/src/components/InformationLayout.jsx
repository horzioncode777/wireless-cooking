import { useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, MessageCircle } from 'lucide-react';
import MainLayout from './layout/MainLayout';
import { informationLinks } from '../services/publicInformation';

export default function InformationLayout({ eyebrow, title, description, children }) {
  const location = useLocation(), navigate = useNavigate(), heading = useRef(null);
  useEffect(() => {
    document.title = `${title.replace(/\.$/, '')} | Wireless Cooking`;
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      heading.current?.focus({ preventScroll: true });
    }
    return () => { document.title = 'Wireless Cooking'; };
  }, [title, location.pathname, location.hash]);
  return <MainLayout compactAssistant><div className="information-page">
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-stone-600 hover:text-amber-900"><ArrowLeft size={16} aria-hidden="true"/>Volver al inicio</Link>
      <header className="information-heading">
        <p className="text-xs font-bold tracking-[.18em] text-amber-800">{eyebrow}</p>
        <h1 ref={heading} tabIndex={-1} className="mt-3 text-3xl font-bold tracking-tight sm:mt-4 sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600 sm:mt-5 sm:text-lg sm:leading-7">{description}</p>
      </header>
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 sm:gap-7 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-5 lg:sticky lg:top-44">
          <div className="information-mobile-nav">
            <label htmlFor="information-section" className="mb-2 block text-xs font-bold text-stone-600">Explorar información y ayuda</label>
            <select id="information-section" value={informationLinks.some(item => item.path === location.pathname) ? location.pathname : ''} onChange={event => navigate(event.target.value)} className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-[#293b32]">
              <option value="" disabled>Elige una sección</option>
              {informationLinks.map(item => <option key={item.path} value={item.path}>{item.label}</option>)}
            </select>
          </div>
          <nav aria-label="Información y ayuda" className="information-nav">
            {informationLinks.map(item => <NavLink key={item.path} to={item.path} end className={({ isActive }) => `flex min-h-12 items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ${isActive ? 'bg-[#293b32] font-bold text-white' : 'text-stone-600 hover:bg-stone-100'}`}>{item.label}<ArrowUpRight size={15} aria-hidden="true"/></NavLink>)}
          </nav>
          <div className="hidden rounded-2xl bg-[#ecefe8] p-5 lg:block"><MessageCircle size={23} aria-hidden="true" className="text-[#3a5543]"/><h2 className="mt-3 font-bold">Estamos para ayudarte</h2><p className="mt-2 text-sm leading-6 text-stone-600">Encuentra el canal adecuado para tu consulta.</p><Link to="/contacto" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-amber-900">Hablar con soporte<ArrowUpRight size={15} aria-hidden="true"/></Link></div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  </div></MainLayout>;
}
