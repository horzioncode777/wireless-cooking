import { getOwnProducts, getOwnProduct } from "../controllers/product.controller.js";
import { relatedProducts } from '../services/recommendations.js';
import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getCategories,
  getSellerProductById,
  getSellerProducts,
  updateProduct,
} from "../controllers/product.controller.js";
import {
  verifySeller,
  verifyToken,
} from "../middlewares/auth.middleware.js";
import upload from "../middlewares/upload.middleware.js";

const router = Router();
router.get('/mine',verifyToken,verifySeller,getOwnProducts);
router.get('/mine/:id',verifyToken,verifySeller,getOwnProduct);


// Públicas
router.get("/", getSellerProducts);
router.get("/categories/list", getCategories);
router.get('/:id/related',relatedProducts);
router.get("/:id", getSellerProductById);

// Privadas vendedor
router.post("/", verifyToken, verifySeller, upload.fields([{name:"imagenes",maxCount:5},{name:"imagen",maxCount:1}]), createProduct);
router.put("/:id", verifyToken, verifySeller, upload.fields([{name:"imagenes",maxCount:5},{name:"imagen",maxCount:1}]), updateProduct);
router.delete("/:id", verifyToken, verifySeller, deleteProduct);

export default router;
