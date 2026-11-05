export const testPhoto = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
export function galleryForm(fields={}, count=2) {
  const body = new FormData();
  for (const [key,value] of Object.entries(fields)) body.append(key, typeof value==='string'?value:JSON.stringify(value));
  for (let i=0;i<count;i++) body.append('imagenes',new Blob([testPhoto],{type:'image/png'}),`photo-${i+1}.png`);
  body.append('galeria_orden',JSON.stringify(Array.from({length:count},(_,archivo)=>({archivo}))));
  return body;
}
