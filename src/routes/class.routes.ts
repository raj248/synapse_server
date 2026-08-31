import { Router } from "express";
import {
  handleCreateClass,
  handleDeleteClass,
  handleGetClass,
  handleJoinClass,
  handleLeaveClass,
  handleListClasses,
  handleListMembers,
  handleRemoveMember,
  handleUpdateClass,
} from "../controllers/class.controller";
import { classTopicRouter } from "./topic.routes";
import { classTaskRouter } from "./task.routes";
import { requireAuth } from "../middlewares/auth.middleware";
import { classAnnouncementRouter } from "./announcement.routes";

const router: Router = Router();

router.use(requireAuth);

router.post("/", handleCreateClass);
router.get("/", handleListClasses);
router.post("/join", handleJoinClass);

router.get("/:classId", handleGetClass);
router.patch("/:classId", handleUpdateClass);
router.delete("/:classId", handleDeleteClass);
router.post("/:classId/leave", handleLeaveClass);

router.get("/:classId/members", handleListMembers);
router.delete("/:classId/members/:userId", handleRemoveMember);

router.use("/:classId/announcements", classAnnouncementRouter);
router.use("/:classId/topics", classTopicRouter);
router.use("/:classId/tasks", classTaskRouter);

export default router;
