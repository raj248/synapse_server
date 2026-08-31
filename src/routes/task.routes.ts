import { Router } from "express";
import {
  handleCreateSubmission,
  handleCreateTask,
  handleDeleteSubmission,
  handleDeleteTask,
  handleGetTask,
  handleListSubmissions,
  handleListTasks,
  handleUpdateTask,
  handleUpdateTaskStatus,
} from "../controllers/task.controller";
import { requireAuth } from "../middlewares/auth.middleware";

// Mounted at /classes/:classId/tasks
export const classTaskRouter: Router = Router({ mergeParams: true });
classTaskRouter.use(requireAuth);
classTaskRouter.post("/", handleCreateTask);
classTaskRouter.get("/", handleListTasks);

// Mounted standalone at /tasks
export const taskRouter: Router = Router();
taskRouter.use(requireAuth);
taskRouter.get("/:taskId", handleGetTask);
taskRouter.patch("/:taskId", handleUpdateTask);
taskRouter.patch("/:taskId/status", handleUpdateTaskStatus);
taskRouter.delete("/:taskId", handleDeleteTask);
taskRouter.post("/:taskId/submissions", handleCreateSubmission);
taskRouter.get("/:taskId/submissions", handleListSubmissions);

// Mounted standalone at /submissions
export const submissionRouter: Router = Router();
submissionRouter.use(requireAuth);
submissionRouter.delete("/:submissionId", handleDeleteSubmission);
