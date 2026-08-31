import { Response } from "express";
import { prisma } from "../config/db";
import { AppError } from "../utils/app-error.utils";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  requireClassMembership,
  requireTeacherMembership,
} from "../utils/class-access.utils";
import { getTaskOrThrow, getTopicOrThrow } from "../utils/content-access.utils";
import { notifyClassMembers } from "../utils/notification.utils";

async function getAnnouncementOrThrow(announcementId: number) {
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
  });
  if (!announcement) throw new AppError("Announcement not found", 404);
  return announcement;
}

export const handleCreateAnnouncement = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { classId } = req.params;
  const { title, content, topicId, taskId } = req.body;

  if (!title || !content) {
    throw new AppError("title and content are required", 400);
  }

  await requireTeacherMembership(classId as string, userId);

  if (topicId != null) {
    const topic = await getTopicOrThrow(Number(topicId));
    if (topic.classId !== classId)
      throw new AppError("Topic belongs to a different class", 400);
  }
  if (taskId != null) {
    const task = await getTaskOrThrow(Number(taskId));
    if (task.classId !== classId)
      throw new AppError("Task belongs to a different class", 400);
  }

  const announcement = await prisma.announcement.create({
    data: {
      classId: classId as string,
      authorId: userId,
      title,
      content,
      topicId: topicId != null ? Number(topicId) : null,
      taskId: taskId != null ? Number(taskId) : null,
    },
  });

  const classRecord = await prisma.class.findUnique({
    where: { id: classId as string },
    select: { name: true },
  });

  // Fire-and-forget — a slow or misconfigured push provider shouldn't hold
  // up the API response, or fail announcement creation itself.
  notifyClassMembers(classId as string, userId, {
    title: `${classRecord?.name ?? "Class"}: ${title}`,
    body: content.length > 120 ? `${content.slice(0, 117)}...` : content,
    data: {
      type: "ANNOUNCEMENT",
      classId: classId as string,
      announcementId: String(announcement.id),
    },
  }).catch((err) =>
    console.error("Failed to send announcement notifications:", err),
  );

  res.status(201).json(announcement);
};

export const handleListAnnouncements = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { classId } = req.params;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const pageSize = Math.min(Number(req.query.pageSize) || 20, 50);

  await requireClassMembership(classId as string, userId);

  const [data, total] = await Promise.all([
    prisma.announcement.findMany({
      where: { classId: classId as string },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, image: true },
        },
        attachments: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.announcement.count({ where: { classId: classId as string } }),
  ]);

  res.status(200).json({
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
};

export const handleGetAnnouncement = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { announcementId } = req.params;

  const announcement = await getAnnouncementOrThrow(Number(announcementId));
  await requireClassMembership(announcement.classId, userId);

  const full = await prisma.announcement.findUnique({
    where: { id: announcement.id },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, image: true },
      },
      attachments: true,
      topic: true,
      task: true,
    },
  });

  res.status(200).json(full);
};

export const handleUpdateAnnouncement = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { announcementId } = req.params;
  const { title, content } = req.body;

  const announcement = await getAnnouncementOrThrow(Number(announcementId));
  await requireTeacherMembership(announcement.classId, userId);

  const updated = await prisma.announcement.update({
    where: { id: announcement.id },
    data: { title, content },
  });

  res.status(200).json(updated);
};

export const handleDeleteAnnouncement = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { announcementId } = req.params;

  const announcement = await getAnnouncementOrThrow(Number(announcementId));
  await requireTeacherMembership(announcement.classId, userId);

  await prisma.announcement.delete({ where: { id: announcement.id } });

  res.status(204).send();
};
