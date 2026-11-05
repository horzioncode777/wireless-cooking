import { useState } from 'react';
import { Save,PackageCheck } from 'lucide-react';
import { api } from '../services/api';
import { normalizePacking as normalize } from '../services/packing';
const input='mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-normal';

export default function PackingEditor({data,onSaved,onDirty}){
 const [packing,setPacking]=useState(normalize(data.packing)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false);
 const editable=['pagado','empacando'].includes(data.order.estado)&&!['enviado','entregado'].includes(data.shipment?.estado);
 function change(name,value){onDirty(true);setPacking(previous=>({...previous,[name]:value}));setSuccess(false);}
 async function save(event){event.preventDefault();if(busy)return;setBusy(true);setError('');setSuccess(false);try{const result=await api(`/seller/orders/${data.order.id_pedido}/packing`,{method:'PUT',body:JSON.stringify(packing)});setPacking(normalize(result.packing));onSaved(result.packing);onDirty(false);setSuccess(true);}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <form onSubmit={save} className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-7 print:hidden"><h2 className="flex items-center gap-2 text-lg font-bold"><PackageCheck size={21}/>Revisión opcional del paquete</h2><p className="mt-2 text-sm leading-6 text-stone-500">Puedes revisar el contenido y dejar una observación. La guía ya está generada; no necesitas completar esta revisión para abrirla.</p>
  <fieldset disabled={!editable||busy} className="mt-6 space-y-5">
   <div className="rounded-2xl bg-stone-50 p-4"><h3 className="mb-3 text-sm font-bold">Revisión del contenido</h3>{data.items.map(item=><label key={item.id_detalle} className="flex items-center gap-3 border-t border-stone-200 py-3"><input type="checkbox" checked={packing.revisados.includes(item.id_detalle)} onChange={event=>change('revisados',event.target.checked?[...packing.revisados,item.id_detalle]:packing.revisados.filter(id=>id!==item.id_detalle))} className="h-4 w-4 accent-[#293b32]"/><span className="flex-1 text-sm">{item.nombre}</span><strong className="text-sm">× {item.cantidad}</strong></label>)}</div>
   <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={packing.fragil} onChange={event=>change('fragil',event.target.checked)} className="h-4 w-4"/>Contenido frágil · manipular con cuidado</label><label className="block text-sm font-semibold">Observaciones de empaque<textarea rows={2} maxLength={1000} value={packing.notas} onChange={event=>change('notas',event.target.value)} className={input} placeholder="Protección de cerámica, piezas separadas…"/></label><button disabled={busy||!editable} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#293b32] px-5 py-3 text-sm font-bold text-white disabled:opacity-40"><Save size={17}/>{busy?'Guardando…':'Guardar preparación'}</button>
  </fieldset>{!editable&&<p className="mt-4 text-sm text-stone-500">El empaque queda en consulta después del envío.</p>}{error&&<p role="alert" className="mt-4 text-sm text-red-900">{error}<button type="button" className="ml-3 underline" onClick={()=>{setPacking(normalize(data.packing));onDirty(false);setError('');}}>Descartar cambios y cargar versión actual</button></p>}{success&&<p role="status" className="mt-4 text-sm font-semibold text-emerald-800">Preparación guardada. Ya puedes imprimir.</p>}
 </form>;
}
