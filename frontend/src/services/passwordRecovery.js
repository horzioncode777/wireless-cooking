export function validateNewPassword(password,confirmation){
 if(password.length<8)return 'Escribe una contraseña de al menos 8 caracteres.';
 if(new TextEncoder().encode(password).length>72)return 'La contraseña es demasiado larga. Usa hasta 72 bytes; las tildes y los emojis pueden ocupar más de uno.';
 if(password!==confirmation)return 'Las contraseñas no coinciden. Revisa ambos campos.';
 return '';
}
export function maskRecoveryEmail(email){
 const [name,domain]=String(email||'').split('@');
 return domain?`${name.slice(0,2)}${'•'.repeat(3)}@${domain}`:'';
}
