import 'dotenv/config';
import { wompiSettings } from '../src/services/wompi.js';
const config=wompiSettings();
if(config.environment!=='test'||!config.publicKey.startsWith('pub_test_')||!config.configured){
 console.error('Falta la configuración completa de Sandbox. Ejecuta configurar-wompi.ps1.');process.exitCode=1;
} else {
 try {
  const response=await fetch(`${config.apiOrigin}/v1/merchants/${encodeURIComponent(config.publicKey)}`,{signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw Error('MERCHANT_UNAVAILABLE');
  const result=await response.json();
  if(!result.data) throw Error('INVALID_MERCHANT');
  console.log('Wompi Sandbox reconoció la llave pública. No se realizó ningún pago.');
  console.log('Los secretos de integridad y eventos se validarán con una transacción y un evento de prueba. Esta comprobación no acredita esa validación.');
 } catch {
  console.error('No se pudo verificar la llave pública con Wompi Sandbox. Revisa la conexión y las credenciales de pruebas.');process.exitCode=1;
 }
}
