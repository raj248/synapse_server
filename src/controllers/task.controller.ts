import { Response } from "express";
import { prisma } from "../config/db";
import { AppError } from "../utils/app-error.utils";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  requireClassMembership,
  requireTeacherMembership,
} from "../utils/class-access.utils";
import {
  getSubmissionOrThrow,
  getTaskOrThrow,
  getTopicOrThrow,
} from "../utils/content-access.utils";

async function linkTopics(taskId: number, topicIds: number[], classId: string) {
  if (topicIds.length === 0) return;

  const topics = await prisma.syllabusTopic.findMany({
    where: { id: { in: topicIds } },
  });
  const invalid = topics.find((t) => t.classId !== classId);
  if (invalid || topics.length !== topicIds.length) {
    throw new AppError("One or more topics don't belong to this class", 400);
  }

  await prisma.taskTopic.createMany({
    data: topicIds.map((topicId) => ({ taskId, topicId })),
    skipDuplicates: true,
  });
}

export const handleCreateTask = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { classId } = req.params;
  const {
    title,
    description,
    dueDate,
    category,
    isSubmissionRequired,
    topicIds,
  } = req.body;

  if (!title) {
    throw new AppError("Task title is required", 400);
  }

  await requireTeacherMembership(classId as string, userId);

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        classId: classId as string,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        category,
        isSubmissionRequired: Boolean(isSubmissionRequired),
      },
    });

    if (Array.isArray(topicIds) && topicIds.length > 0) {
      await linkTopics(created.id, topicIds.map(Number), classId as string);
    }

    return created;
  });

  res.status(201).json(task);
};

export const handleListTasks = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { classId } = req.params;
  const { category, topicId, isCompleted } = req.query;

  await requireClassMembership(classId as string, userId);

  const tasks = await prisma.task.findMany({
    where: {
      classId: classId as string,
      category: category ? (category as any) : undefined,
      isCompleted:
        isCompleted !== undefined ? isCompleted === "true" : undefined,
      topicReferences: topicId
        ? { some: { topicId: Number(topicId) } }
        : undefined,
    },
    include: { topicReferences: { include: { topic: true } } },
    orderBy: { dueDate: "asc" },
  });

  res.status(200).json(tasks);
};

export const handleGetTask = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { taskId } = req.params;

  const task = await getTaskOrThrow(Number(taskId));
  await requireClassMembership(task.classId, userId);

  const [full, mySubmission] = await Promise.all([
    prisma.task.findUnique({
      where: { id: task.id },
      include: {
        topicReferences: { include: { topic: true } },
        attachments: true,
      },
    }),
    prisma.taskSubmission.findUnique({
      where: { taskId_studentId: { taskId: task.id, studentId: userId } },
    }),
  ]);

  res.status(200).json({ ...full, mySubmission });
};

export const handleUpdateTask = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { taskId } = req.params;
  const {
    title,
    description,
    dueDate,
    category,
    isSubmissionRequired,
    topicIds,
  } = req.body;

  const task = await getTaskOrThrow(Number(taskId));
  await requireTeacherMembership(task.classId, userId);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.task.update({
      where: { id: task.id },
      data: {
        title,
        description,
        dueDate:
          dueDate !== undefined
            ? dueDate
              ? new Date(dueDate)
              : null
            : undefined,
        category,
        isSubmissionRequired:
          isSubmissionRequired !== undefined
            ? Boolean(isSubmissionRequired)
            : undefined,
      },
    });

    if (Array.isArray(topicIds)) {
      await tx.taskTopic.deleteMany({ where: { taskId: task.id } });
      await linkTopics(task.id, topicIds.map(Number), task.classId);
    }

    return result;
  });

  res.status(200).json(updated);
};

export const handleUpdateTaskStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { taskId } = req.params;
  const { isCompleted } = req.body;

  if (typeof isCompleted !== "boolean") {
    throw new AppError("isCompleted (boolean) is required", 400);
  }

  const task = await getTaskOrThrow(Number(taskId));
  await requireTeacherMembership(task.classId, userId);

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { isCompleted },
  });

  res.status(200).json(updated);
};

export const handleDeleteTask = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { taskId } = req.params;

  const task = await getTaskOrThrow(Number(taskId));
  await requireTeacherMembership(task.classId, userId);

  await prisma.task.delete({ where: { id: task.id } });

  res.status(204).send();
};

export const handleCreateSubmission = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { taskId } = req.params;
  const { remarks } = req.body;

  const task = await getTaskOrThrow(Number(taskId));
  await requireClassMembership(task.classId, userId);

  if (!task.isSubmissionRequired) {
    throw new AppError("This task doesn't accept submissions", 400);
  }

  const existing = await prisma.taskSubmission.findUnique({
    where: { taskId_studentId: { taskId: task.id, studentId: userId } },
  });
  if (existing) {
    throw new AppError(
      "You've already submitted this task — delete your existing submission to resubmit",
      400,
    );
  }

  const submission = await prisma.taskSubmission.create({
    data: { taskId: task.id, studentId: userId, remarks },
  });

  res.status(201).json(submission);
};

export const handleListSubmissions = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { taskId } = req.params;

  const task = await getTaskOrThrow(Number(taskId));
  await requireTeacherMembership(task.classId, userId);

  const submissions = await prisma.taskSubmission.findMany({
    where: { taskId: task.id },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          image: true,
        },
      },
      attachments: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  res.status(200).json(submissions);
};

export const handleDeleteSubmission = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { submissionId } = req.params;

  const submission = await getSubmissionOrThrow(Number(submissionId));

  if (submission.studentId !== userId) {
    throw new AppError("You can only delete your own submission", 403);
  }

  await prisma.taskSubmission.delete({ where: { id: submission.id } });

  res.status(204).send();
};
