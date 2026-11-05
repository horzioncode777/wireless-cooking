import test from 'node:test';
import assert from 'node:assert/strict';
import { maskRecoveryEmail, validateNewPassword } from '../src/services/passwordRecovery.js';

test('La recuperación detecta contraseñas distintas antes de enviar la petición',()=>{
 assert.match(validateNewPassword('UnaNuevaClave!2026','OtraClave!2026'),/no coinciden/);
 assert.equal(validateNewPassword('UnaNuevaClave!2026','UnaNuevaClave!2026'),'');
});
test('La longitud valida bytes para evitar truncamiento silencioso de bcrypt',()=>{
 assert.match(validateNewPassword('corta','corta'),/8 caracteres/);
 const tooLong='🔐'.repeat(19);
 assert.match(validateNewPassword(tooLong,tooLong),/demasiado larga/);
 assert.equal(validateNewPassword('a'.repeat(72),'a'.repeat(72)),'');
});
test('El correo de la pantalla de código se muestra parcialmente oculto',()=>{
 assert.equal(maskRecoveryEmail('persona@gmail.com'),'pe•••@gmail.com');
 assert.equal(maskRecoveryEmail(''),'');
});
