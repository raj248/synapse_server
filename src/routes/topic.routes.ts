import { Router } from "express";
import {
  handleCreateTopic,
  handleDeleteTopic,
  handleGetTopic,
  handleGetTopicTree,
  handleReorderTopic,
  handleUpdateTopic,
  handleUpdateTopicStatus,
} from "../controllers/topic.controller";
import { requireAuth } from "../middlewares/auth.middleware";

// Mounted at /classes/:classId/topics — mergeParams so :classId from the
// parent router is visible here.
export const classTopicRouter: Router = Router({ mergeParams: true });
classTopicRouter.use(requireAuth);
classTopicRouter.post("/", handleCreateTopic);
classTopicRouter.get("/", handleGetTopicTree);

// Mounted standalone at /topics — these operate on a topic by its own id,
// independent of knowing the parent classId up front.
export const topicRouter: Router = Router();
topicRouter.use(requireAuth);
topicRouter.get("/:topicId", handleGetTopic);
topicRouter.patch("/:topicId", handleUpdateTopic);
topicRouter.patch("/:topicId/status", handleUpdateTopicStatus);
topicRouter.patch("/:topicId/reorder", handleReorderTopic);
topicRouter.delete("/:topicId", handleDeleteTopic);
