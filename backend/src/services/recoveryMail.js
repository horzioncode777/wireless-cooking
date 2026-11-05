import nodemailer from 'nodemailer';
import { readFileSync } from 'node:fs';
import { fail } from '../utils/http.js';

const recoveryLogo = readFileSync(new URL('../assets/logo.png', import.meta.url));

export function gmailConfiguration(env=process.env){
 const user=String(env.GMAIL_USER||'').trim().toLowerCase();
 const password=String(env.GMAIL_APP_PASSWORD||'').replace(/\s/g,'');
 if(!/^[^\s@]+@(?:gmail\.com|googlemail\.com)$/.test(user)||!/^[a-zA-Z]{16}$/.test(password))return null;
 return {host:'smtp.gmail.com',port:465,secure:true,auth:{user,pass:password},tls:{minVersion:'TLSv1.2'},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false};
}

export function recoveryEmail(code){
 if(!/^\d{6}$/.test(code))throw Error('Invalid recovery code format');
 const text=`Tu código para recuperar el acceso a Wireless Cooking es: ${code}\n\nVence en 10 minutos y solo puede usarse una vez. Escríbelo en la pantalla de recuperación y elige una contraseña nueva. No compartas este código.\n\nSi no solicitaste recuperar tu cuenta, ignora este mensaje. Tu contraseña no ha cambiado.`;
 const html=`<!doctype html><html lang="es"><body style="margin:0;background:#f6f5f1;font-family:Arial,Helvetica,sans-serif;color:#26372f"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border:1px solid #e5e8df;border-radius:20px"><tr><td style="padding:32px"><img align="center" src="cid:wireless-cooking-logo" alt="Wireless Cooking" width="240" style="display:block;width:240px;max-width:100%;height:auto;margin:0 auto 28px;border:0"><h1 style="margin:0 0 15px;font-size:26px;line-height:1.25">Recupera el acceso a tu cuenta</h1><p style="font-size:15px;line-height:1.7">Escribe este código en la pantalla de recuperación. Después podrás elegir tu nueva contraseña.</p><div style="margin:26px 0;padding:22px 8px;border-radius:14px;background:#fbf1e8;text-align:center;font-size:34px;font-weight:bold;letter-spacing:9px;color:#92400e">${code}</div><p style="font-size:14px;line-height:1.7"><strong>Vence en 10 minutos y solo puede usarse una vez.</strong> No lo compartas: nadie de nuestro equipo te lo pedirá.</p><p style="padding-top:18px;border-top:1px solid #edf0e8;font-size:12px;line-height:1.7;color:#687363">Si no solicitaste recuperar tu cuenta, ignora este mensaje. Tu contraseña no ha cambiado.</p></td></tr></table></td></tr></table></body></html>`;
 return {subject:'Tu código de recuperación · Wireless Cooking',text,html,attachments:[{filename:'wireless-cooking-logo.png',content:recoveryLogo,contentType:'image/png',cid:'wireless-cooking-logo',contentDisposition:'inline'}]};
}

export async function sendRecoveryCode(to,code){
 const config=gmailConfiguration();
 if(!config)throw fail(503,'El envío de códigos aún no está configurado. Contacta con soporte.');
 const transporter=nodemailer.createTransport(config);
 try{
  const result=await transporter.sendMail({from:{name:'Wireless Cooking',address:config.auth.user},to,...recoveryEmail(code)});
  if(!result.accepted?.some(address=>String(address).toLowerCase()===to.toLowerCase()))throw Error('SMTP_RECIPIENT_REJECTED');
 }finally{transporter.close();}
}

export async function verifyRecoveryMail(){
 const config=gmailConfiguration();
 if(!config)throw fail(503,'Faltan GMAIL_USER y GMAIL_APP_PASSWORD válidos en backend/.env.');
 const transporter=nodemailer.createTransport(config);
 try{await transporter.verify();}finally{transporter.close();}
}
