export function formatRegistrationDate(value){
 if(!value)return null;
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return null;
 return new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric',timeZone:'America/Bogota'}).format(date);
}
