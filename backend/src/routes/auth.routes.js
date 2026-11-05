import { Router } from "express";
import { forgotPassword, verifyResetCode, resetPassword, changePassword } from '../controllers/password.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { asyncRoute } from '../utils/http.js';
import {
  login,
  registerBuyer,
  registerSeller,
} from "../controllers/auth.controller.js";

const router = Router();
router.use((req,res,next)=>{ res.set('Cache-Control','no-store'); next(); });
router.post('/forgot-password',rateLimit(10,15*60000),asyncRoute(forgotPassword));
router.post('/verify-reset-code',rateLimit(20,15*60000),asyncRoute(verifyResetCode));
router.post('/reset-password',rateLimit(20,15*60000),asyncRoute(resetPassword));
router.use(rateLimit(20));
router.use((req,res,next)=>{
 if(req.path.startsWith('/register')) {
  const {nombre,correo,password}=req.body;
  if(typeof nombre!=='string' || nombre.trim().length<2 || typeof correo!=='string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || typeof password!=='string' || password.length<8 || password.length>72) return res.status(400).json({ok:false,message:'Ingresa nombre, correo válido y contraseña entre 8 y 72 caracteres.'});
 }
 next();
});
router.post('/change-password',verifyToken,asyncRoute(changePassword));

router.post("/register/buyer", registerBuyer);
router.post("/register/seller", registerSeller);
router.post("/login", login);

export default router;
