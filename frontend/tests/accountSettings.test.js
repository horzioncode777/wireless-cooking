import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordChangeError } from '../src/services/accountSettings.js';
const valid={actual:'OriginalPassword!2026',nueva:'UpdatedPassword!2026',confirmacion:'UpdatedPassword!2026'};
test('El cambio de contraseña exige la actual y una confirmación coincidente',()=>{
 assert.equal(passwordChangeError(valid),'');
 assert.match(passwordChangeError({...valid,actual:''}),/actual/);
 assert.match(passwordChangeError({...valid,confirmacion:'OtraContraseña'}),/no coincide/);
 assert.match(passwordChangeError({...valid,nueva:valid.actual,confirmacion:valid.actual}),/diferente/);
});
test('La contraseña nueva respeta ocho caracteres y el límite de bytes, incluyendo Unicode',()=>{
 assert.match(passwordChangeError({...valid,nueva:'corta'}),/8 caracteres/);
 assert.equal(passwordChangeError({...valid,nueva:'a'.repeat(72),confirmacion:'a'.repeat(72)}),'');
 assert.match(passwordChangeError({...valid,nueva:'🔐'.repeat(19)}),/72 bytes/);
 assert.equal(passwordChangeError({...valid,nueva:'Una frase con espacios 2026',confirmacion:'Una frase con espacios 2026'}),'');
});
