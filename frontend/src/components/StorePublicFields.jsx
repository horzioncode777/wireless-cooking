import { Eye, MapPin } from 'lucide-react';
import { publicTextFields, publicListFields } from '../services/storeProfile';

const fieldClass='mt-2 w-full min-w-0 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100';
export default function StorePublicFields({ city, profile, onCityChange, onChange, disabled }) {
  return <fieldset disabled={disabled} className="min-w-0 space-y-5 border-t border-stone-200 pt-6 sm:col-span-2">
    <legend className="flex items-center gap-2 pt-6 text-xl font-bold"><Eye size={21}/>Perfil público</legend>
    <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Estos datos aparecen en la página de tu tienda. Publica únicamente la dirección y los contactos que quieras compartir con los compradores. Los datos de tu cuenta se editan por separado.</p>
    <label className="block text-sm font-semibold"><span className="flex items-center gap-2"><MapPin size={16}/>Ciudad de la tienda</span><input required value={city} maxLength={100} onChange={event=>onCityChange(event.target.value)} className={fieldClass} placeholder="Ej: Chía, Zipaquirá, Tabio…"/></label>
    <div className="grid min-w-0 gap-5 sm:grid-cols-2">{publicTextFields.map(([field,label,max])=>{
      const multiline=['historia','horario','politica_envio','preparacion'].includes(field);
      const props={value:profile[field]||'',onChange:event=>onChange(field,event.target.value),maxLength:max,className:fieldClass};
      return <label key={field} className={`block min-w-0 text-sm font-semibold ${multiline?'sm:col-span-2':''}`}>{label}{multiline?<textarea {...props} rows={field==='historia'?5:3}/>:<input {...props} type={field==='correo_publico'?'email':field==='telefono_publico'?'tel':'text'}/>}</label>;
    })}
    <label className="block text-sm font-semibold">Año de fundación<input type="number" min="1000" max={new Date().getFullYear()} step="1" value={profile.fundacion} onChange={event=>onChange('fundacion',event.target.value)} className={fieldClass}/></label>
    <label className="block text-sm font-semibold">Color de la marca<input type="color" value={profile.color} onChange={event=>onChange('color',event.target.value)} className="mt-2 block h-12 w-full rounded-xl border border-stone-200 bg-white p-1"/></label>
    {publicListFields.map(([field,label])=><label key={field} className="block min-w-0 text-sm font-semibold sm:col-span-2">{label}<textarea value={profile[field]||''} onChange={event=>onChange(field,event.target.value)} rows={3} className={fieldClass}/><span className="mt-1 block text-xs font-normal text-stone-500">Un elemento por línea. Hasta 20, de máximo 250 caracteres cada uno.</span></label>)}
    </div>
  </fieldset>;
}
