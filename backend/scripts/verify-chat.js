import 'dotenv/config';
import { chatConfiguration, openaiChatReply } from '../src/services/chat.js';
const config = chatConfiguration();
if (!config.key) {
 console.error('Falta OPENAI_API_KEY. Ejecuta configurar-openai.ps1 en la raíz del proyecto.');
 process.exitCode=1;
} else {
 try {
  await openaiChatReply({message:'Hola, ¿qué puedo consultar sobre esta web?',config});
  console.log('OpenAI respondió correctamente. Se realizó una consulta breve de prueba con el modelo configurado.');
 } catch(error) {
  console.error(error.status===401?'OpenAI rechazó la clave. Revisa la configuración local.':error.status===429?'OpenAI informa de una cuota o límite agotado. Revisa el saldo y los límites del proyecto.':error.status===403||error.status===404?'El proyecto no tiene acceso al modelo configurado. Revisa sus permisos.':'No se pudo completar la prueba de OpenAI. Revisa la conexión y la configuración.');
  process.exitCode=1;
 }
}
