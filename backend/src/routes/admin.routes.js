import { Router } from "express";
import { saveShipment } from '../services/shipments.js';
import {
  getAllProductsAdmin,
  createProductAdmin,
  updateProductAdmin,
  deleteProductAdmin,
  getAdminCategories,
  getAdminDashboard,
  getAdminUsers,
  updateUserStatus,
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
  getAdminSellers,
  getAdminSellerById,
  updateSellerVerification,
  updateSellerUserStatus,
  getAdminReports,
} from "../controllers/admin.controller.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";
import { updateDelivery } from '../services/orders.js';
import { asyncRoute } from '../utils/http.js';

const router = Router();

// Dashboard
router.get("/dashboard", verifyToken, isAdmin, getAdminDashboard);

// Reportes
router.get("/reports", verifyToken, isAdmin, getAdminReports);

// Usuarios
router.get("/users", verifyToken, isAdmin, getAdminUsers);
router.patch("/users/:id/status", verifyToken, isAdmin, updateUserStatus);

// Pedidos
router.get("/orders", verifyToken, isAdmin, getAdminOrders);
router.put('/orders/:id/shipments/:seller',verifyToken,isAdmin,asyncRoute(saveShipment));
router.get("/orders/:id", verifyToken, isAdmin, getAdminOrderById);
router.patch("/orders/:id/status", verifyToken, isAdmin, updateAdminOrderStatus);
router.patch('/orders/:id/delivery',verifyToken,isAdmin,asyncRoute(async(req,res)=>{
 const order=await updateDelivery(req.params.id,req.body);
 res.json({ok:true,order,message:'Datos de entrega guardados.'});
}));

// Vendedores
router.get("/sellers", verifyToken, isAdmin, getAdminSellers);
router.get("/sellers/:id", verifyToken, isAdmin, getAdminSellerById);
router.patch(
  "/sellers/:id/verification",
  verifyToken,
  isAdmin,
  updateSellerVerification
);
router.patch(
  "/sellers/:id/user-status",
  verifyToken,
  isAdmin,
  updateSellerUserStatus
);

// Productos
router.get("/products", verifyToken, isAdmin, getAllProductsAdmin);
router.get("/categories", verifyToken, isAdmin, getAdminCategories);
router.post("/products", verifyToken, isAdmin, createProductAdmin);
router.put("/products/:id", verifyToken, isAdmin, updateProductAdmin);
router.delete("/products/:id", verifyToken, isAdmin, deleteProductAdmin);

export default router;
