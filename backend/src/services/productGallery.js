import { fail } from '../utils/http.js';
import { validateImage, uploadImage, removeUploadedImage } from './images.js';

export function productPhotos(product) {
  return [...new Set([product?.imagen, ...(Array.isArray(product?.galeria) ? product.galeria : [])].filter(value => typeof value === 'string' && value))];
}

export function planGallery(req, existing = null) {
  const files = [...(req.files?.imagenes || []), ...(req.files?.imagen || [])];
  for (const file of files) validateImage(file.buffer);
  const hasManifest = Object.hasOwn(req.body, 'galeria_orden');
  if (existing && !hasManifest && !files.length) return null; // Legacy edits preserve all photos.
  if (files.length > 5) throw fail(400, 'Puedes guardar un máximo de 5 fotos por producto.');
  let entries;
  if (hasManifest) {
    try { entries = JSON.parse(req.body.galeria_orden); } catch { throw fail(400, 'El orden de las fotos no es válido.'); }
  } else {
    entries = files.map((_, archivo) => ({ archivo }));
  }
  if (!Array.isArray(entries) || entries.length < 2 || entries.length > 5) throw fail(400, 'Agrega entre 2 y 5 fotos por producto.');
  const allowed = new Set(productPhotos(existing)), usedFiles = new Set(), usedUrls = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).length !== 1) throw fail(400, 'Hay una foto inválida en la galería.');
    if (Object.hasOwn(entry, 'archivo')) {
      if (!Number.isInteger(entry.archivo) || !files[entry.archivo] || usedFiles.has(entry.archivo)) throw fail(400, 'Las fotos nuevas y su orden no coinciden.');
      usedFiles.add(entry.archivo);
    } else if (typeof entry.url === 'string' && allowed.has(entry.url) && !usedUrls.has(entry.url)) {
      usedUrls.add(entry.url);
    } else throw fail(400, 'Solo puedes conservar fotos que ya pertenecen a este producto.');
  }
  if (usedFiles.size !== files.length) throw fail(400, 'Hay fotos nuevas sin asignar a la galería.');
  return { files, entries };
}

export async function uploadGallery(plan, uploaded) {
  const urls = [];
  for (const file of plan.files) {
    const result = await uploadImage(file.buffer);
    uploaded.push(result);
    urls.push(result.secure_url);
  }
  return plan.entries.map(entry => Object.hasOwn(entry, 'archivo') ? urls[entry.archivo] : entry.url);
}

export async function discardGalleryUploads(uploaded) {
  await Promise.allSettled(uploaded.map(removeUploadedImage));
}
