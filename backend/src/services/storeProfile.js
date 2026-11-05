import { fail } from '../utils/http.js';

const textLimits = {
  lema: 180, especialidad: 400, historia: 6000, responsable_publico: 150,
  direccion_publica: 400, horario: 600, correo_publico: 254,
  telefono_publico: 30, color: 7, preparacion: 600, politica_envio: 3000,
};
const lists = ['valores', 'servicios', 'cobertura'];

// A patch never copies account credentials, verification or the demo flag into public metadata.
export function validatePublicProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(400, 'El perfil público debe ser un objeto.');
  const result = {};
  for (const [key, content] of Object.entries(value)) {
    if (Object.hasOwn(textLimits, key)) {
      if (typeof content !== 'string' || content.trim().length > textLimits[key]) throw fail(400, `Revisa el campo público ${key}: máximo ${textLimits[key]} caracteres.`);
      result[key] = content.trim();
    } else if (lists.includes(key)) {
      if (!Array.isArray(content) || content.length > 20 || content.some(item => typeof item !== 'string' || !item.trim() || item.trim().length > 250)) throw fail(400, `${key}: usa hasta 20 elementos de máximo 250 caracteres.`);
      result[key] = [...new Set(content.map(item => item.trim()))];
    } else if (key === 'fundacion') {
      if (content !== null && (!Number.isInteger(content) || content < 1000 || content > new Date().getFullYear())) throw fail(400, 'Revisa el año de fundación.');
      result[key] = content;
    } else {
      throw fail(400, `El campo ${key} no se puede editar en el perfil público.`);
    }
  }
  if (result.correo_publico && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.correo_publico)) throw fail(400, 'El correo público no es válido.');
  if (result.telefono_publico && !/^\+?[\d\s().-]{7,30}$/.test(result.telefono_publico)) throw fail(400, 'El teléfono público no es válido.');
  if (result.color && !/^#[\da-f]{6}$/i.test(result.color)) throw fail(400, 'El color de la tienda debe tener formato #A34D1B.');
  return result;
}

export function validateSellerFields(body) {
  const limits = { nombre:100, apellido:100, correo:150, telefono:30, direccion:500, foto:2000, nombre_tienda:150, descripcion:6000, logo:2000, banner_url:2000, ciudad:100 };
  const result = {};
  for (const [key, max] of Object.entries(limits)) {
    if (!Object.hasOwn(body, key)) continue;
    const value = body[key] === null ? '' : body[key];
    if (typeof value !== 'string' || value.trim().length > max) throw fail(400, `Revisa ${key}: máximo ${max} caracteres.`);
    result[key] = value.trim();
  }
  for (const key of ['nombre', 'nombre_tienda', 'correo', 'ciudad']) if (Object.hasOwn(result, key) && !result[key]) throw fail(400, `El campo ${key} es obligatorio.`);
  if (result.correo) {
    result.correo = result.correo.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.correo)) throw fail(400, 'El correo de la cuenta no es válido.');
  }
  for (const key of ['foto', 'logo', 'banner_url']) if (result[key] && !/^https?:\/\//i.test(result[key]) && !/^\/(uploads|demo-assets)\//.test(result[key])) throw fail(400, 'La dirección de imagen no es válida.');
  return result;
}
