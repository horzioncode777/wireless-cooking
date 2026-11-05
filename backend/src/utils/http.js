export const asyncRoute = (fn) => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
export const fail = (status,message) => Object.assign(new Error(message),{status});
export const money = value => Math.round(Number(value)*100);
