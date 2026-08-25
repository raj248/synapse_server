import { Router } from "express";
import { handleRefreshToken } from "../controllers/auth.controller";

const router: Router = Router();

// POST /api/auth/refresh
router.post("/refresh", handleRefreshToken);

export default router;
