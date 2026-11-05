import { useEffect,useRef,useState } from 'react';
import { Link,useLocation,useNavigate } from 'react-router-dom';
import { Heart,ShoppingCart,Search,User,Store,LayoutDashboard,Package,Wallet,RotateCcw,MessageSquareText,Settings,LogOut,ChevronDown,Truck } from 'lucide-react';
import { readUser } from '../services/api';
import NotificationBell from './NotificationBell';

const categories=[['Cerámica','ceramica'],['Acero inoxidable','acero'],['Utensilios','utensilios'],['Artesanías','artesanias'],['Vajillas','vajillas'],['Accesorios','accesorios'],['Ofertas','ofertas']];
export default function Navbar(){
  const location=useLocation(),navigate=useNavigate(),account=useRef(null);
  const [search,setSearch]=useState('');
  const user=readUser();
  const profile=user?.rol==='admin'?'/admin':user?.rol==='vendedor'?'/vendedor':'/perfil';
  const ProfileIcon=user?.rol==='admin'?LayoutDashboard:user?.rol==='vendedor'?Store:User;
  const menuItemClass='group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-amber-50 hover:text-amber-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700';
  const menuIconClass='shrink-0 text-amber-700';
  useEffect(()=>{if(account.current)account.current.open=false;},[location.pathname,location.search]);
  function logout(){localStorage.removeItem('token');localStorage.removeItem('user');navigate('/login');}
  function submit(event){event.preventDefault();navigate(`/productos?q=${encodeURIComponent(search.trim())}`);}
  const active=new URLSearchParams(location.search).get('categoria');
  return <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-md print:hidden">
    <div className="mx-auto max-w-7xl px-4 py-2 md:px-8">
      <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-4">
        <Link to="/" aria-label="Wireless Cooking, inicio" className="shrink-0"><img src="/logo.png" alt="Wireless Cooking" width="175" height="64" className="h-9 w-auto min-[360px]:h-10 sm:h-16"/></Link>
        <form onSubmit={submit} role="search" className="hidden min-w-0 flex-1 items-center gap-2 rounded-full border border-gray-300 bg-gray-50 px-4 md:flex">
          <input aria-label="Buscar productos" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar productos, materiales o tiendas" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm"/>
          <button aria-label="Buscar" className="flex h-11 w-11 items-center justify-center"><Search size={20}/></button>
        </form>
        <nav aria-label="Mi cuenta y compras" className="flex shrink-0 items-center gap-1 sm:gap-3">
          {user&&<NotificationBell/>}
          <Link to="/favoritos" aria-label="Favoritos" className={`${user ? 'hidden min-[360px]:flex' : 'flex'} h-11 w-10 items-center justify-center rounded-full hover:bg-amber-50 sm:w-11`}><Heart size={20}/></Link>
          <Link to="/carrito" aria-label="Carrito" className="flex h-11 w-10 items-center justify-center rounded-full hover:bg-amber-50 sm:w-11"><ShoppingCart size={20}/></Link>
          {user?<details ref={account} className="relative" onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}>
            <summary aria-label="Abrir menú de cuenta" className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border px-3"><User size={20} aria-hidden="true"/><span className="hidden sm:inline">{user.nombre||'Mi cuenta'}</span><ChevronDown size={15} aria-hidden="true" className="hidden text-gray-500 sm:block"/></summary>
            <nav aria-label="Opciones de cuenta" className="absolute right-0 top-full mt-3 w-72 max-w-[calc(100vw-2rem)] space-y-1 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
              <Link className={menuItemClass} to={profile}><ProfileIcon size={19} aria-hidden="true" className={menuIconClass}/>{user.rol==='vendedor'?'Mi negocio':user.rol==='admin'?'Administración':'Mi perfil'}</Link>
              <Link className={menuItemClass} to="/favoritos"><Heart size={19} aria-hidden="true" className={menuIconClass}/>Mis favoritos</Link>
              <Link className={menuItemClass} to="/mis-pedidos"><Package size={19} aria-hidden="true" className={menuIconClass}/>Mis pedidos</Link>
              {user.rol==='vendedor'&&<Link className={menuItemClass} to="/vendedor/pedidos-por-enviar"><Truck size={19} aria-hidden="true" className={menuIconClass}/>Pedidos por enviar</Link>}
              {user.rol==='vendedor'&&<Link className={menuItemClass} to="/vendedor/monedero"><Wallet size={19} aria-hidden="true" className={menuIconClass}/>Mi monedero</Link>}
              <Link className={menuItemClass} to="/postventa"><RotateCcw size={19} aria-hidden="true" className={menuIconClass}/>Devoluciones y garantías</Link>
              <Link className={menuItemClass} to="/pqr"><MessageSquareText size={19} aria-hidden="true" className={menuIconClass}/>Mis PQR</Link>
              <Link className={menuItemClass} to="/configuracion"><Settings size={19} aria-hidden="true" className={menuIconClass}/>Configuración</Link>
              <div className="mx-2 my-2 border-t border-gray-100"/>
              <button onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700"><LogOut size={19} aria-hidden="true" className="shrink-0"/>Cerrar sesión</button>
            </nav>
          </details>:<Link to="/login" className="flex min-h-11 items-center rounded-xl bg-amber-700 px-3 text-sm font-semibold text-white">Ingresar</Link>}
        </nav>
      </div>
      <form onSubmit={submit} role="search" className="mt-2 flex min-w-0 items-center gap-2 rounded-full border border-gray-300 bg-gray-50 px-3 md:hidden">
        <input aria-label="Buscar productos" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar en el catálogo" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm"/>
        <button aria-label="Buscar" className="flex h-11 w-11 items-center justify-center"><Search size={20}/></button>
      </form>
      <nav aria-label="Catálogo y comunidad" className="no-scrollbar mt-2 flex max-w-full items-center gap-1 overflow-x-auto text-sm">
        <Link to="/marketplace" className="flex min-h-11 shrink-0 items-center px-3 font-bold text-amber-800">Tiendas</Link>
        <Link to="/ayuda" className="flex min-h-11 shrink-0 items-center px-3 font-bold text-amber-800">Ayuda</Link>
        <Link to="/pqr" className="flex min-h-11 shrink-0 items-center px-3 font-bold text-amber-800">PQR</Link>
        {categories.map(([label,value])=><Link key={value} to={`/productos?categoria=${value}`} aria-current={location.pathname==='/productos'&&active===value?'page':undefined} className={`flex min-h-11 shrink-0 items-center rounded-full px-3 ${active===value?'bg-amber-100 font-bold text-amber-900':'text-gray-700 hover:bg-gray-100'}`}>{label}</Link>)}
      </nav>
    </div>
  </header>;
}
