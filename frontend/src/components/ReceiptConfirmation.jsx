import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
export default function ReceiptConfirmation({shipment,order,onConfirmed}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false);
 if(shipment.recepcion_confirmada||confirmed)return <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-800"><CheckCircle2 size={16}/>Confirmaste la recepción de esta entrega.</p>;
 if(shipment.estado!=='entregado')return null;
 async function submit(event){event.preventDefault();setBusy(true);setError('');try{await api('/wallet/receipts',{method:'POST',body:JSON.stringify({id_pedido:order.id_pedido,id_vendedor:shipment.id_vendedor})});setConfirmed(true);await onConfirmed?.();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <div className="mt-4 border-t border-stone-100 pt-4">{!open?<button type="button" onClick={()=>setOpen(true)} className="min-h-11 rounded-xl border border-emerald-800 px-4 py-2 text-sm font-bold text-[#293b32]">Confirmar que lo recibí</button>:<form onSubmit={submit} className="space-y-3"><p className="text-xs leading-6 text-stone-600">Confirma únicamente cuando hayas recibido los productos de {shipment.nombre_tienda}. Si existe un problema puedes abrir una solicitud de postventa.</p><label className="flex items-start gap-3 text-sm"><input required type="checkbox" className="mt-1"/>Sí, recibí los productos de esta tienda.</label><div className="flex flex-wrap gap-3"><button disabled={busy} className="min-h-11 rounded-xl bg-[#293b32] px-4 py-2 text-sm font-bold text-white">{busy?'Confirmando…':'Confirmar recepción'}</button><button type="button" disabled={busy} onClick={()=>setOpen(false)} className="min-h-11 px-3 text-sm underline">Volver</button></div>{error&&<p role="alert" className="text-xs text-red-900">{error}</p>}</form>}</div>;
}
