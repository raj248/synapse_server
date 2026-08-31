import { Router } from "express";
import {
  handleRegisterDevice,
  handleUnregisterDevice,
} from "../controllers/notification.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router: Router = Router();
router.use(requireAuth);
router.post("/register-device", handleRegisterDevice);
router.post("/unregister-device", handleUnregisterDevice);

export default router;
