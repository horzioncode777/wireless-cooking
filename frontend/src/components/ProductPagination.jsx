import { ChevronLeft,ChevronRight,MoreHorizontal } from 'lucide-react';

export default function ProductPagination({page,pageCount,total,pageSize,onPageChange}){
 if(total<1)return null;
 let pages;
 if(pageCount<=7)pages=Array.from({length:pageCount},(_,index)=>index+1);
 else if(page<=4)pages=[1,2,3,4,5,'end',pageCount];
 else if(page>=pageCount-3)pages=[1,'start',pageCount-4,pageCount-3,pageCount-2,pageCount-1,pageCount];
 else pages=[1,'start',page-1,page,page+1,'end',pageCount];
 const format=value=>value.toLocaleString('es-CO');
 const button='inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400';
 return <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 xl:flex-row xl:p-5">
  <p role="status" className="text-center text-sm text-stone-500 xl:text-left">Mostrando <span className="font-semibold text-stone-800">{format((page-1)*pageSize+1)}–{format(Math.min(page*pageSize,total))}</span> de <span className="font-semibold text-stone-800">{format(total)}</span> productos<span className="mt-1 hidden text-xs sm:block">Página {format(page)} de {format(pageCount)}</span></p>
  {pageCount>1&&<nav aria-label="Paginación de productos" className="flex max-w-full items-center gap-1 sm:gap-1.5"><button type="button" aria-label="Página anterior" disabled={page===1} onClick={()=>onPageChange(page-1)} className={button}><ChevronLeft size={17} aria-hidden="true"/><span className="hidden sm:inline">Anterior</span></button>
   <span className="min-w-20 px-2 text-center text-sm font-semibold tabular-nums text-stone-700 sm:hidden" aria-label={`Página ${page} de ${pageCount}`}>{page} / {pageCount}</span>
   <div className="hidden items-center gap-1 sm:flex">{pages.map(value=>typeof value==='number'?<button key={value} type="button" aria-label={`Ir a la página ${value}`} aria-current={page===value?'page':undefined} onClick={()=>onPageChange(value)} className={`h-11 min-w-10 rounded-xl px-2 text-sm font-semibold tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800 ${page===value?'bg-[#293b32] text-white shadow-sm':'text-stone-600 hover:bg-white hover:text-amber-900'}`}>{value}</button>:<span key={value} className="flex h-11 w-6 items-center justify-center text-stone-400" aria-hidden="true"><MoreHorizontal size={17}/></span>)}</div>
   <button type="button" aria-label="Página siguiente" disabled={page===pageCount} onClick={()=>onPageChange(page+1)} className={button}><span className="hidden sm:inline">Siguiente</span><ChevronRight size={17} aria-hidden="true"/></button>
  </nav>}
 </div>;
}
