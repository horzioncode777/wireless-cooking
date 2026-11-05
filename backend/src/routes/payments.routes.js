import { Router } from "express";
import { paymentConfig, paymentSession, demoPayment, wompiWebhook, verifyWompiPayment } from '../controllers/checkout.controller.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { asyncRoute } from '../utils/http.js';
import { getPaymentMethods } from "../controllers/payments.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();
router.get('/config',paymentConfig);
router.post('/wompi/events',asyncRoute(wompiWebhook));
router.post('/:id/session',verifyToken,asyncRoute(paymentSession));
router.post('/:id/verify',verifyToken,rateLimit(20),asyncRoute(verifyWompiPayment));
router.post('/:id/demo',verifyToken,asyncRoute(demoPayment));

router.get("/", verifyToken, getPaymentMethods);

export default router;
