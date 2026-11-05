import 'dotenv/config';
import { verifyRecoveryMail } from '../src/services/recoveryMail.js';

try{
 await verifyRecoveryMail();
 console.log('Gmail aceptó la conexión segura y las credenciales. No se envió ningún correo.');
 console.log('Prueba ahora Recuperar contraseña con una cuenta de la web cuyo correo puedas abrir.');
}catch(error){
 console.error(error.status===503?error.message:error.code==='EAUTH'?'Google rechazó las credenciales. Revisa el correo y la contraseña de aplicación; comprueba que la verificación en dos pasos esté activa.':error.code==='ETIMEDOUT'||error.code==='ECONNECTION'||error.code==='EDNS'?'No se pudo conectar con Gmail. Revisa Internet y el acceso al puerto SMTP 465.':'No se pudo verificar Gmail. Revisa la configuración de la cuenta y vuelve a intentarlo.');
 process.exitCode=1;
}
