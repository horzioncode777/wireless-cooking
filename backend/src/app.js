import express from "express";
import cors from "cors";
import communityRoutes from './routes/community.routes.js';
import pool from './config/db.js';
import { fileURLToPath } from 'node:url';
import { catalogEvents } from './services/catalog.js';
import { invalidateRecommendations } from './services/recommendations.js';
import { mountFrontend } from './frontend.js';

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import sellerRoutes from "./routes/seller.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import favoritesRoutes from "./routes/favorites.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import reviewsRoutes from "./routes/reviews.routes.js";
import notificationsRoutes from './routes/notifications.routes.js';
import afterSalesRoutes from './routes/afterSales.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import shippingGuidesRoutes from './routes/shippingGuides.routes.js';

const app = express();
// Enable only when the reverse proxy is on the same machine and the API port is private.
if (process.env.TRUST_PROXY === 'loopback') app.set('trust proxy', 'loopback');

// Middlewares
app.disable('x-powered-by');
app.use(cors({origin:process.env.FRONTEND_URL || 'http://localhost:5173'}));
app.use((req,res,next)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('X-Frame-Options','DENY');
 next();
});
app.use(express.json({limit:'100kb'}));
app.use((req,res,next)=>{
 res.on('finish',()=>{if(!['GET','HEAD','OPTIONS'].includes(req.method) && res.statusCode<400 && req.user?.id) invalidateRecommendations(req.user.id);});
 next();
});
app.use(express.urlencoded({ extended: true }));
app.use('/uploads',express.static(fileURLToPath(new URL('../uploads',import.meta.url))));
app.use('/demo-assets',express.static(fileURLToPath(new URL('../demo-assets',import.meta.url)),{maxAge:'1d'}));
app.get('/api/health',async(req,res)=>{
 try{await pool.query('SELECT 1');res.json({ok:true,database:'connected'});}catch{res.status(503).json({ok:false,database:'unavailable'});}
});
app.use('/api',communityRoutes);
app.get('/api/catalog/events',catalogEvents);

// Test route
if (process.env.SERVE_FRONTEND !== 'true') app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Backend Wireless Cooking funcionando",
  });
});

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/payments", paymentsRoutes);

// Rutas de vendedor
app.use("/api/seller", sellerRoutes);

// Rutas de productos del vendedor
app.use("/api/seller/products", productRoutes);

// Carrito
app.use("/api/cart", cartRoutes);

// Favoritos
app.use("/api/favorites", favoritesRoutes);

// Admin (panel global)
app.use("/api/admin", adminRoutes);

app.use("/api/reviews", reviewsRoutes);
app.use('/api/notifications',notificationsRoutes);
app.use('/api/after-sales',afterSalesRoutes);
app.use('/api/wallet',walletRoutes);
app.use('/api/shipping-guides',shippingGuidesRoutes);

if (process.env.SERVE_FRONTEND === 'true') mountFrontend(app);

app.use((req,res)=>res.status(404).json({ok:false,message:'Ruta no encontrada.'}));
app.use((error,req,res,next)=>{
 console.error('Request failed:',error.code||error.message);
 if(res.headersSent) return next(error);
 const status=error.name==='MulterError'?400:error.status|| (error.code==='23503'?409:500);
 const message=error.code==='LIMIT_FILE_SIZE'?'La imagen no debe superar 5 MB.':['LIMIT_UNEXPECTED_FILE','LIMIT_FILE_COUNT'].includes(error.code)?'Puedes subir hasta 5 fotos usando el campo de imágenes.':error.code==='23503'?'El registro está relacionado con otros datos.':status<500?error.message:'No se pudo completar la operación. Intenta nuevamente.';
 res.status(status).json({ok:false,message});
});

export default app;
