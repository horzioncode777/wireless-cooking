import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { imageUrl } from '../services/api';

export default function ProductGalleryEditor({ gallery, disabled=false, onInteract=()=>{} }) {
  const { photos, photoError, addPhotos, movePhoto, removePhoto } = gallery;
  return <section aria-label="Galería de fotos" className="min-w-0 space-y-4">
    <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Fotos del producto</h3><span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold" aria-live="polite">{photos.length} de 5</span></div>
    <p id="gallery-help" className="text-sm text-stone-600">Agrega de 2 a 5 fotos. La primera será la portada del catálogo. JPEG, PNG o WebP, hasta 5 MB por foto.</p>
    <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
      {photos.map((photo,index) => <article key={photo.id} className={`min-w-0 overflow-hidden rounded-2xl border bg-white ${index===0?'border-amber-700':'border-stone-200'}`}>
        <div className="relative bg-stone-50"><img src={imageUrl(photo.url)} alt={`Foto ${index+1} del producto`} className="aspect-[4/3] w-full object-contain"/><span className={`absolute left-2 top-2 rounded-full px-3 py-1 text-xs font-bold ${index===0?'bg-amber-800 text-white':'bg-white text-stone-700'}`}>{index===0?'Portada':`Foto ${index+1}`}</span></div>
        <div className="space-y-2 p-3"><p className="truncate text-xs text-stone-500">{photo.file?.name||'Imagen guardada'}</p>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" disabled={disabled||index===0} onClick={()=>{movePhoto(index,index-1);onInteract();}} aria-label={`Mover foto ${index+1} antes`} className="rounded-lg border p-2.5 disabled:opacity-30"><ArrowLeft size={17}/></button>
            <button type="button" disabled={disabled||index===photos.length-1} onClick={()=>{movePhoto(index,index+1);onInteract();}} aria-label={`Mover foto ${index+1} después`} className="rounded-lg border p-2.5 disabled:opacity-30"><ArrowRight size={17}/></button>
            <button type="button" disabled={disabled} onClick={()=>{removePhoto(photo.id);onInteract();}} aria-label={`Eliminar foto ${index+1}`} className="ml-auto rounded-lg p-2.5 text-red-800 hover:bg-red-50"><Trash2 size={17}/></button>
          </div>
          {index>0&&<button type="button" disabled={disabled} onClick={()=>{movePhoto(index,0);onInteract();}} className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-amber-900"><Star size={14}/>Usar como portada</button>}
        </div>
      </article>)}
    </div>
    <label className={`flex min-h-24 items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 p-4 text-center font-semibold focus-within:ring-2 focus-within:ring-amber-800 ${disabled||photos.length===5?'opacity-50':'cursor-pointer hover:border-amber-600'}`}>
      <ImagePlus size={24} aria-hidden="true"/><span>{photos.length===5?'Galería completa':'Agregar fotos'}</span>
      <input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={disabled||photos.length===5} aria-label="Agregar fotos del producto" aria-describedby="gallery-help" onChange={event=>{addPhotos(event.target.files);event.target.value='';onInteract();}}/>
    </label>
    {photoError&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{photoError}</p>}
    {photos.length<2&&<p className="text-sm text-amber-900">{photos.length===0?'Selecciona al menos dos imágenes.':'Agrega una foto más para completar tu galería.'}</p>}
  </section>;
}
