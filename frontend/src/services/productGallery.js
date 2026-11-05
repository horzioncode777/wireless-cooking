import { validateProductPhoto } from './productGuide.js';

export function photosFromProduct(product) {
  return [...new Set([product?.imagen, ...(Array.isArray(product?.galeria) ? product.galeria : [])].filter(url => typeof url === 'string' && url))].map(url => ({ id:url, url }));
}
export function validateGallery(photos) {
  return photos.length < 2 || photos.length > 5 ? 'Agrega entre 2 y 5 fotos del producto antes de guardar.' : '';
}
export function validateNewPhotos(photos, files) {
  if (photos.length + files.length > 5) return 'Puedes guardar hasta 5 fotos. Retira una antes de agregar otra.';
  for (const file of files) {
    const message = validateProductPhoto(file);
    if (message) return `${file.name}: ${message}`;
  }
  const keys = [...photos.filter(photo => photo.file).map(photo => photo.file), ...files].map(file => `${file.name}:${file.size}:${file.lastModified}`);
  if (new Set(keys).size !== keys.length) return 'Esa foto ya está seleccionada. Elige otra imagen.';
  return '';
}
export function appendGallery(body, photos) {
  let index = 0;
  const manifest = photos.map(photo => {
    if (!photo.file) return { url:photo.url };
    body.append('imagenes', photo.file);
    return { archivo:index++ };
  });
  body.append('galeria_orden', JSON.stringify(manifest));
}
