import { Router } from "express";
import {
  handleChangePassword,
  handleForgotPassword,
  handleGetDevAuthTokens,
  handleGetMe,
  handleGoogleLogin,
  handleLogin,
  handleRefreshToken,
  handleRegister,
  handleResetPassword,
  handleVerifyEmail,
} from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router: Router = Router();

if (process.env.NODE_ENV === "development") {
  router.get("/dev/tokens", handleGetDevAuthTokens);
}

router.post("/refresh", handleRefreshToken);

router.post("/login", handleLogin);
router.post("/google", handleGoogleLogin);

// Public Routes
router.post("/register", handleRegister);
router.post("/verify-email", handleVerifyEmail);
router.post("/forgot-password", handleForgotPassword);
router.post("/reset-password", handleResetPassword);

// Protected Routes (Requires Bearer Token)
router.use(requireAuth);

router.post("/change-password", handleChangePassword);
router.get("/me", handleGetMe);

export default router;
