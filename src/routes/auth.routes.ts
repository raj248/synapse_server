import { Router } from "express";
import {
  handleGetMe,
  handleGoogleLogin,
  handleLogin,
  handleRefreshToken,
} from "../controllers/auth.controller";

const router: Router = Router();

router.post("/login", handleLogin);
router.post("/google", handleGoogleLogin);
router.get("/me", handleGetMe);
router.post("/refresh", handleRefreshToken);

export default router;
