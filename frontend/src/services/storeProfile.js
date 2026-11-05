export const publicTextFields = [
  ['lema','Lema de tu tienda',180], ['especialidad','Especialidad',400],
  ['historia','Historia de la tienda',6000], ['responsable_publico','Responsable público',150],
  ['direccion_publica','Dirección pública',400], ['horario','Horario de atención',600],
  ['correo_publico','Correo público de contacto',254], ['telefono_publico','Teléfono público de contacto',30],
  ['preparacion','Tiempo de preparación',600], ['politica_envio','Condiciones de envío',3000],
];
export const publicListFields = [['valores','Valores de la marca'],['servicios','Servicios'],['cobertura','Ciudades o zonas de cobertura']];
export function profileToForm(profile={}) {
  const form = {};
  for (const [field] of publicTextFields) form[field] = typeof profile[field]==='string'?profile[field]:'';
  for (const [field] of publicListFields) form[field] = Array.isArray(profile[field])?profile[field].join('\n'):'';
  form.fundacion = profile.fundacion ? String(profile.fundacion) : '';
  form.color = /^#[\da-f]{6}$/i.test(profile.color||'') ? profile.color : '#a34d1b';
  return form;
}
export function profileFromForm(form) {
  const result = {};
  for (const [field] of publicTextFields) result[field] = (form[field]||'').trim();
  for (const [field] of publicListFields) result[field] = [...new Set((form[field]||'').split('\n').map(value=>value.trim()).filter(Boolean))];
  result.fundacion = form.fundacion ? Number(form.fundacion) : null;
  result.color = form.color;
  return result;
}
