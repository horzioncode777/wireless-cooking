import { Router } from "express";
import {
  getSellerProfile,
  getSellerStats,
  updateSellerProfile,
  updateSellerPhoto,
  updateSellerBanner,
} from "../controllers/seller.controller.js";
import {
  verifySeller,
  verifyToken,
} from "../middlewares/auth.middleware.js";
import upload from "../middlewares/upload.middleware.js";

const router = Router();

router.get("/profile", verifyToken, verifySeller, getSellerProfile);
router.put("/profile", verifyToken, verifySeller, updateSellerProfile);
router.get("/stats", verifyToken, verifySeller, getSellerStats);

// nuevas rutas para imágenes
router.put(
  "/profile/photo",
  verifyToken,
  verifySeller,
  upload.single("photo"),
  updateSellerPhoto
);

router.put(
  "/profile/banner",
  verifyToken,
  verifySeller,
  upload.single("banner"),
  updateSellerBanner
);

export default router;