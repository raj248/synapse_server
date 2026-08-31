import { prisma } from "../config/db";
import { AppError } from "./app-error.utils";

export async function getTopicOrThrow(topicId: number) {
  const topic = await prisma.syllabusTopic.findUnique({
    where: { id: topicId },
  });
  if (!topic) throw new AppError("Topic not found", 404);
  return topic;
}

export async function getTaskOrThrow(taskId: number) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new AppError("Task not found", 404);
  return task;
}

export async function getSubmissionOrThrow(submissionId: number) {
  const submission = await prisma.taskSubmission.findUnique({
    where: { id: submissionId },
    include: { task: { select: { classId: true } } },
  });
  if (!submission) throw new AppError("Submission not found", 404);
  return submission;
}
