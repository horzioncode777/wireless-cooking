import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import cloudinary from '../config/cloudinary.js';
export function validateImage(buffer) {
 if(!Buffer.isBuffer(buffer) || buffer.length===0 || buffer.length>5*1024*1024) throw Object.assign(new Error('Usa una imagen JPEG, PNG o WebP válida de máximo 5 MB.'),{status:400});
 const jpeg=buffer[0]===0xff && buffer[1]===0xd8;
 const png=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const webp=buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP';
 if(!jpeg && !png && !webp) throw Object.assign(new Error('Usa una imagen JPEG, PNG o WebP válida de máximo 5 MB.'),{status:400});
 return jpeg?'jpg':png?'png':'webp';
}
export async function uploadImage(buffer,folder='products') {
 const extension=validateImage(buffer);
 if(process.env.IMAGE_STORAGE==='local') {
  const name=`${randomUUID()}.${extension}`;
  const dir=new URL('../../uploads/',import.meta.url); await mkdir(dir,{recursive:true});
  await writeFile(new URL(name,dir),buffer);
  return {secure_url:`/uploads/${name}`};
 }
 return new Promise((resolve,reject)=>{const stream=cloudinary.uploader.upload_stream({folder,resource_type:'image'},(error,result)=>error?reject(error):resolve(result));stream.end(buffer);});
}
// Only newly uploaded assets returned by this service are eligible for failure cleanup.
export async function removeUploadedImage(result) {
 if(/^\/uploads\/[\da-f-]+\.(jpg|png|webp)$/.test(result?.secure_url || '')) {
  await unlink(new URL(`../../uploads/${result.secure_url.split('/').pop()}`,import.meta.url)).catch(error=>{if(error.code!=='ENOENT')throw error;});
 } else if(result?.public_id) await cloudinary.uploader.destroy(result.public_id);
}
