import { Router } from "express";
import {
  getProfile,
  updateProfile,
  uploadProfilePhoto,
} from "../controllers/user.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/upload.middleware.js";
import { asyncRoute } from '../utils/http.js';
import { getSettings,updateSettings } from '../controllers/settings.controller.js';

const router = Router();

router.get('/settings',verifyToken,asyncRoute(getSettings));
router.patch('/settings',verifyToken,asyncRoute(updateSettings));

router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfile);
router.put(
  "/profile/photo",
  verifyToken,
  upload.single("photo"),
  uploadProfilePhoto
);

export default router;
