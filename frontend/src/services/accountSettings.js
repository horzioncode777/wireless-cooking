export function passwordChangeError({actual,nueva,confirmacion}){
 if(!actual)return 'Ingresa tu contraseña actual.';
 if(new TextEncoder().encode(actual).length>512)return 'La contraseña actual es demasiado larga.';
 if(nueva.length<8||new TextEncoder().encode(nueva).length>72)return 'La nueva contraseña debe tener al menos 8 caracteres y máximo 72 bytes.';
 if(actual===nueva)return 'Elige una contraseña diferente de la actual.';
 if(nueva!==confirmacion)return 'La confirmación no coincide con la nueva contraseña.';
 return '';
}
