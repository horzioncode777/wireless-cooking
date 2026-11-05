// In-memory limiter for a single instance. Use Redis at the reverse proxy when scaling.
export function rateLimit(max=30, windowMs=60000) {
 const clients=new Map();
 const timer=setInterval(()=>{for(const [key,value] of clients) if(value.until<Date.now()) clients.delete(key);},windowMs);
 timer.unref();
 return (req,res,next)=>{
  const key=req.ip; const now=Date.now(); let value=clients.get(key);
  if(!value || value.until<now) {value={count:0,until:now+windowMs}; clients.set(key,value);}
  if(++value.count>max) return res.status(429).json({ok:false,message:'Demasiadas solicitudes. Intenta de nuevo en un minuto.'});
  next();
 };
}
