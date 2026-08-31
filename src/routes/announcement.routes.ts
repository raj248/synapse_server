import { Router } from "express";
import {
  handleCreateAnnouncement,
  handleDeleteAnnouncement,
  handleGetAnnouncement,
  handleListAnnouncements,
  handleUpdateAnnouncement,
} from "../controllers/announcement.controller";
import { requireAuth } from "../middlewares/auth.middleware";

// Mounted at /classes/:classId/announcements
export const classAnnouncementRouter: Router = Router({ mergeParams: true });
classAnnouncementRouter.use(requireAuth);
classAnnouncementRouter.post("/", handleCreateAnnouncement);
classAnnouncementRouter.get("/", handleListAnnouncements);

// Mounted standalone at /announcements
const router: Router = Router();
router.use(requireAuth);
router.get("/:announcementId", handleGetAnnouncement);
router.patch("/:announcementId", handleUpdateAnnouncement);
router.delete("/:announcementId", handleDeleteAnnouncement);

export default router;
