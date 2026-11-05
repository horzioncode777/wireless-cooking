import { Router } from "express";
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
} from "../controllers/cart.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyToken, getCart);
router.post("/add", verifyToken, addToCart);
router.put("/item/:id", verifyToken, updateCartItemQuantity);
router.delete("/item/:id", verifyToken, removeCartItem);
router.delete("/clear", verifyToken, clearCart);

export default router;