import { Router } from "express";
import {
  handleCreateAttachment,
  handleDeleteAttachment,
} from "../controllers/attachment.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router: Router = Router();

router.use(requireAuth);
router.post("/", upload.single("file"), handleCreateAttachment);
router.delete("/:attachmentId", handleDeleteAttachment);

export default router;
