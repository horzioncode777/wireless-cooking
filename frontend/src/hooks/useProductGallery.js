import { useEffect, useRef, useState } from 'react';
import { validateNewPhotos } from '../services/productGallery';

export default function useProductGallery() {
  const [photos, setPhotos] = useState([]), [photoError, setPhotoError] = useState('');
  const urls = useRef(new Set());
  useEffect(() => {
    const current = new Set(photos.map(photo => photo.url));
    for (const url of urls.current) if (!current.has(url)) { URL.revokeObjectURL(url); urls.current.delete(url); }
  }, [photos]);
  useEffect(() => {
    const owned = urls.current;
    return () => { for (const url of owned) URL.revokeObjectURL(url); owned.clear(); };
  }, []);
  function addPhotos(files) {
    const selected = Array.from(files || []);
    const error = validateNewPhotos(photos, selected);
    if (error) { setPhotoError(error); return; }
    const additions = selected.map(file => {
      const url = URL.createObjectURL(file); urls.current.add(url);
      return { id:crypto.randomUUID(), url, file };
    });
    setPhotos([...photos, ...additions]); setPhotoError('');
  }
  function movePhoto(index, target) {
    if (target < 0 || target >= photos.length) return;
    const next = [...photos], [photo] = next.splice(index, 1);
    next.splice(target, 0, photo); setPhotos(next); setPhotoError('');
  }
  function removePhoto(id) { setPhotos(photos.filter(photo => photo.id !== id)); setPhotoError(''); }
  return { photos, setPhotos, photoError, addPhotos, movePhoto, removePhoto };
}
