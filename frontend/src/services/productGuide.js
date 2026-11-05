export function shouldAutoStartGuide(products,preference,interacted){
  return Array.isArray(products)&&products.length===0&&!preference&&!interacted;
}

export function validateProductPhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))return 'Elige una foto JPEG, PNG o WebP. Este formato no es compatible.';
  if(file.size>5*1024*1024)return 'La foto supera los 5 MB. Elige una imagen más pequeña.';
  return '';
}
