import { Router } from "express";
import { getOrders } from "../controllers/orders.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { createOrder, getOrder } from '../controllers/checkout.controller.js';
import { asyncRoute } from '../utils/http.js';
import { saveContact } from '../services/shipments.js';

const router = Router();

router.get("/", verifyToken, getOrders);
router.post('/',verifyToken,asyncRoute(createOrder));
router.get('/:id',verifyToken,asyncRoute(getOrder));
router.patch('/:id/contact',verifyToken,asyncRoute(saveContact));

export default router;
