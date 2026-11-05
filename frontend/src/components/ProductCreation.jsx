import { appFetch } from "../services/notifications.js";
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, CheckCircle } from 'lucide-react';
import MainLayout from './layout/MainLayout';
import { API_URL, api, imageUrl, readUser, formatPrice } from '../services/api';
import { buttonClass } from './WorkspaceUI';
import ProductGalleryEditor from "./ProductGalleryEditor";
import useProductGallery from "../hooks/useProductGallery";
import { appendGallery, validateGallery } from "../services/productGallery";
import { shouldAutoStartGuide } from '../services/productGuide';

const steps=[
  ['Describe tu producto','Elige un nombre fácil de buscar, explica para qué sirve y selecciona su categoría. Por ejemplo: «Olla de cerámica con tapa».'],
  ['Define precio y existencias','Escribe el precio de una unidad en pesos colombianos, sin puntos de miles. Las existencias son las unidades que puedes vender.'],
  ['Agrega las fotografías','Selecciona de 2 a 5 fotos claras: una vista completa y detalles del producto. La primera será la portada. Aceptamos JPEG, PNG o WebP de hasta 5 MB por imagen.'],
  ['Revisa antes de guardar','Comprueba la vista previa y los datos. El producto se crea únicamente cuando pulses Guardar producto. Después podrás cambiarlo desde Editar en Mi negocio.'],
];
const initialForm={nombre:'',descripcion:'',material:'',precio:'',stock:'',estado:'activo',id_categoria:''};
const inputClass='mt-2 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal';
function Field({label,...props}){return <label className="block font-semibold">{label}<input {...props} className={inputClass}/></label>;}
function readGuide(key){try{return localStorage.getItem(key);}catch{return null;}}
function saveGuide(key,status){try{localStorage.setItem(key,status);}catch{/* Storage may be disabled; the form remains usable. */}}

export default function ProductCreation(){
  const location=useLocation(),user=readUser();
  const guideKey=`wireless:product-guide:v1:${user?.id_usuario}`;
  const explicitlyRequested=new URLSearchParams(location.search).get('guia')==='1';
  const [guided,setGuided]=useState(explicitlyRequested),[step,setStep]=useState(0);
  const [form,setForm]=useState(initialForm);
  const gallery=useProductGallery();
  const [categories,setCategories]=useState([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[created,setCreated]=useState(null);
  const interacted=useRef(explicitlyRequested),heading=useRef(null),errorBox=useRef(null),successBox=useRef(null);
  const preview=gallery.photos[0]?.url||'';

  useEffect(()=>{
    let current=true;
    api('/seller/products/categories/list').then(data=>{if(current){setCategories(data.categories||[]);setLoadError('');}})
      .catch(error=>{if(current)setLoadError(error.message);}).finally(()=>{if(current)setLoading(false);});
    if(!explicitlyRequested&&!readGuide(guideKey)) api('/seller/products/mine').then(data=>{
      if(current&&shouldAutoStartGuide(data.products,readGuide(guideKey),interacted.current))setGuided(true);
    }).catch(()=>{/* Inventory failure must not prevent creating a product. */});
    return()=>{current=false;};
  },[guideKey,explicitlyRequested]);
  useEffect(()=>{if(guided)heading.current?.focus();},[step,guided]);
  useEffect(()=>{if(error)errorBox.current?.focus();},[error]);
  useEffect(()=>{if(created)successBox.current?.focus();},[created]);

  function change(event){interacted.current=true;setForm({...form,[event.target.name]:event.target.value});setError('');}
  function toggleGuide(enabled){interacted.current=true;setGuided(enabled);setStep(0);setError('');if(!enabled)saveGuide(guideKey,'omitida');}
  function validate(part){
    if(part===0){
      if(!form.nombre.trim())return 'Escribe el nombre de tu producto.';
      if(form.nombre.trim().length>150)return 'El nombre debe tener como máximo 150 caracteres.';
      if(!form.descripcion.trim())return 'Describe el producto y su uso.';
      if(!categories.some(c=>String(c.id_categoria)===form.id_categoria))return 'Selecciona una categoría para tu producto.';
    }
    if(part===1){
      if(form.precio===''||!Number.isFinite(Number(form.precio))||Number(form.precio)<0||Number(form.precio)>9999999999.99)return 'Escribe un precio válido entre 0 y 9.999.999.999,99 pesos.';
      if(form.stock===''||!Number.isInteger(Number(form.stock))||Number(form.stock)<0||Number(form.stock)>2147483647)return 'Escribe las existencias como un número entero entre 0 y 2.147.483.647.';
      if(!['activo','pausado','agotado'].includes(form.estado))return 'Selecciona un estado válido.';
    }
    if(part===2)return validateGallery(gallery.photos);
    return '';
  }
  function next(event){event?.preventDefault();const message=validate(step);if(message){setError(message);return;}setError('');setStep(step+1);}
  async function submit(event){
    event.preventDefault();
    if(busy||created)return;
    // Enter in a guided input advances the step; only review can create the product.
    if(guided&&step<3){next();return;}
    for(const part of [0,1,2]){const message=validate(part);if(message){if(guided)setStep(part);setError(message);return;}}
    setBusy(true);setError('');
    try{
      const body=new FormData();
      Object.entries(form).forEach(([key,value])=>body.append(key,value.trim()));
      appendGallery(body,gallery.photos);
      const response=await appFetch(`${API_URL}/api/seller/products`,{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('token')}`},body});
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||'No se pudo guardar el producto. Tus datos siguen en el formulario.');
      saveGuide(guideKey,'completada');setCreated(data.product);
      window.dispatchEvent(new Event('catalog:personalization'));
    }catch(error){setError(error.message);}finally{setBusy(false);}
  }
  const category=categories.find(c=>String(c.id_categoria)===form.id_categoria)?.nombre||'Sin categoría';
  return <MainLayout><section className="mx-auto max-w-6xl space-y-6 px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold text-amber-800">Panel de vendedor</p><h1 className="text-3xl font-bold">Crear producto</h1></div><Link to="/vendedor" className="rounded-xl border p-3">Volver a Mi negocio</Link></div>
    {created?<section ref={successBox} tabIndex={-1} aria-labelledby="product-created" className="space-y-5 rounded-3xl border border-emerald-300 bg-emerald-50 p-6">
      <CheckCircle aria-hidden="true" className="text-emerald-800" size={36}/><h2 id="product-created" className="text-2xl font-bold">Producto guardado correctamente</h2><p><strong>{created.nombre}</strong> ya está en tu inventario.</p>
      <p>{created.estado==='activo'?'Está publicado en el catálogo.':`Quedó en estado ${created.estado}. No aparecerá en el catálogo mientras no esté activo.`} {Number(created.stock)===0?'Tiene cero existencias; los clientes no podrán comprarlo hasta que repongas unidades.':''}</p>
      <p>Para cambiar sus fotos, precio o existencias, entra a Mi negocio y pulsa Editar junto al producto.</p>
      <div className="flex flex-wrap gap-3"><Link className={buttonClass} to={`/editar-producto/${created.id_producto}`}>Editar este producto</Link><Link className="rounded-xl border bg-white px-5 py-3 font-semibold" to="/vendedor">Ir a Mi negocio</Link>{created.estado==='activo'&&<Link className="rounded-xl border bg-white px-5 py-3 font-semibold" to={`/producto/${created.id_producto}`}>Ver en el catálogo</Link>}</div>
    </section>:<>
      {guided?<section aria-label="Guía para crear un producto" className="rounded-3xl border border-amber-300 bg-amber-50 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-bold text-amber-950"><BookOpen className="mr-2 inline" size={20} aria-hidden="true"/>Tu producto, paso a paso</p><button type="button" disabled={busy} onClick={()=>toggleGuide(false)} className="rounded-lg px-3 py-2 font-semibold underline">Omitir tutorial</button></div>
        <ol aria-label="Pasos del tutorial" className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{steps.map(([title],index)=><li key={title} aria-current={step===index?'step':undefined} className={`rounded-xl border px-3 py-2 text-sm ${step===index?'border-amber-800 bg-white font-bold text-amber-950':'border-amber-200'}`}>{index+1}. {title}</li>)}</ol>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">Paso {step+1} de 4: {steps[step][0]}</h2><p className="mt-2 max-w-3xl">{steps[step][1]}</p>
      </section>:<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-amber-50 p-4"><p>¿Necesitas ayuda para publicar?</p><button type="button" onClick={()=>toggleGuide(true)} className="rounded-lg px-3 py-2 font-bold text-amber-900 underline">Iniciar tutorial guiado</button></div>}
      {loadError&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{loadError} <button type="button" onClick={()=>window.location.reload()} className="font-bold underline">Reintentar carga</button></p>}
      {error&&<p ref={errorBox} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <form noValidate onSubmit={submit} className="space-y-6 rounded-3xl border bg-white p-5 sm:p-6" aria-label="Crear producto">
          <fieldset disabled={busy} hidden={guided&&step!==0} className="space-y-5"><legend className="mb-4 text-xl font-bold">Información del producto</legend>
            <Field label="Nombre del producto" name="nombre" value={form.nombre} onChange={change} maxLength={150} required placeholder="Ej: Olla de cerámica con tapa"/>
            <label className="block font-semibold">Descripción<textarea name="descripcion" value={form.descripcion} onChange={change} required rows={4} placeholder="Explica el uso, acabado y cuidados del producto." className={inputClass}/></label>
            <label className="block font-semibold">Material<select name="material" value={form.material} onChange={change} className={inputClass}><option value="">Selecciona el material (opcional)</option>{['Cerámica','Acero inoxidable','Madera','Otro'].map(m=><option key={m}>{m}</option>)}</select></label>
            <label className="block font-semibold">Categoría<select name="id_categoria" value={form.id_categoria} onChange={change} disabled={loading} required className={inputClass}><option value="">{loading?'Cargando categorías…':'Selecciona una categoría'}</option>{categories.map(c=><option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}</select></label>
          </fieldset>
          <fieldset disabled={busy} hidden={guided&&step!==1} className="space-y-5"><legend className="mb-4 text-xl font-bold">Precio y disponibilidad</legend>
            <Field label="Precio por unidad (COP)" name="precio" type="number" min="0" max="9999999999.99" step="0.01" required value={form.precio} onChange={change} placeholder="Ej: 85000"/>
            <Field label="Existencias (unidades)" name="stock" type="number" min="0" step="1" required value={form.stock} onChange={change} placeholder="Ej: 10"/>
            <label className="block font-semibold">Estado<select name="estado" value={form.estado} onChange={change} className={inputClass}><option value="activo">Activo</option><option value="pausado">Pausado</option><option value="agotado">Agotado</option></select></label>
            <p className="text-sm text-gray-700">Activo: visible en el catálogo. Pausado o agotado: se conserva en tu inventario y no se muestra en el catálogo. Con cero existencias no se puede comprar.</p>
          </fieldset>
          <fieldset disabled={busy} hidden={guided&&step!==2} className="min-w-0 space-y-4"><legend className="mb-4 text-xl font-bold">Galería del producto</legend>
            <ProductGalleryEditor gallery={gallery} disabled={busy} onInteract={()=>{interacted.current=true;setError('');}}/>
          </fieldset>
          {guided&&step===3&&<section aria-labelledby="product-review" className="space-y-4"><h3 id="product-review" className="text-xl font-bold">Confirma los datos de tu producto</h3><dl className="space-y-3"><div><dt className="font-bold">Nombre</dt><dd>{form.nombre}</dd></div><div><dt className="font-bold">Categoría y material</dt><dd>{category} · {form.material||'Material sin especificar'}</dd></div><div><dt className="font-bold">Precio por unidad</dt><dd>{formatPrice(form.precio)}</dd></div><div><dt className="font-bold">Existencias y estado</dt><dd>{form.stock} unidades · {form.estado}</dd></div><div><dt className="font-bold">Fotografías</dt><dd>{gallery.photos.length} fotos · la primera es la portada</dd></div></dl><p className="rounded-xl bg-amber-50 p-4">{form.estado==='activo'?'Al guardar, el producto aparecerá en el catálogo.':'Al guardar, quedará en tu inventario sin publicarse en el catálogo.'} {Number(form.stock)===0?'No podrá comprarse mientras tenga cero existencias.':''}</p></section>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            {guided?<>{step>0&&<button type="button" disabled={busy} onClick={()=>{setError('');setStep(step-1);}} className="rounded-xl border px-5 py-3 font-semibold">Anterior</button>}{step<3?<button key="guide-next" type="button" disabled={loading||!!loadError||busy} onClick={next} className={buttonClass}>Siguiente</button>:<button key="guide-save" type="submit" disabled={busy||loading||!!loadError} className={buttonClass}>{busy?'Guardando…':'Guardar producto'}</button>}</>:<><Link to="/vendedor" className="rounded-xl border px-5 py-3 font-semibold">Cancelar</Link><button key="guide-save" type="submit" disabled={busy||loading||!!loadError} className={buttonClass}>{busy?'Guardando…':'Guardar producto'}</button></>}
          </div>
        </form>
        <aside aria-label="Vista previa del producto" className="space-y-4 rounded-3xl border bg-white p-5 sm:p-6"><h2 className="text-xl font-bold">Vista previa</h2><p className="text-sm text-gray-600">Se actualiza mientras completas los datos. Aún no está guardado.</p><img src={preview||imageUrl('/product-placeholder.svg')} alt={preview?`Foto de ${form.nombre||'tu producto'}`:'Producto sin fotografía'} className="h-56 w-full rounded-2xl bg-gray-50 object-contain"/><p className="text-sm text-amber-900">{category}</p><h3 className="text-xl font-bold">{form.nombre||'Nombre del producto'}</h3><p className="text-2xl font-bold">{formatPrice(form.precio)}</p><p>{form.stock||0} unidades · {form.estado}</p><p className="whitespace-pre-wrap break-words text-sm text-gray-700">{form.descripcion||'Aquí aparecerá la descripción.'}</p></aside>
      </div>
    </>}
  </section></MainLayout>;
}
