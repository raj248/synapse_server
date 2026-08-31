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
import { storageProvider } from "../utils/storage";

const TARGET_FIELDS = [
  "classId",
  "topicId",
  "taskId",
  "submissionId",
  "announcementId",
] as const;
type TargetField = (typeof TARGET_FIELDS)[number];

interface AttachmentContext {
  classId: string;
  // Present only for submission attachments — students attach to their own
  // submission, everything else (class/topic/task/announcement) is teacher-owned.
  ownerId?: string;
}

async function resolveContext(
  body: Record<string, unknown>,
): Promise<{ field: TargetField; context: AttachmentContext }> {
  const provided = TARGET_FIELDS.filter(
    (f) => body[f] !== undefined && body[f] !== null,
  );

  if (provided.length !== 1) {
    throw new AppError(
      "Provide exactly one of classId, topicId, taskId, submissionId, or announcementId",
      400,
    );
  }
  const field = provided[0];

  switch (field) {
    case "classId": {
      const cls = await prisma.class.findUnique({
        where: { id: body.classId as string },
        select: { id: true },
      });
      if (!cls) throw new AppError("Class not found", 404);
      return { field, context: { classId: cls.id } };
    }
    case "topicId": {
      const topic = await getTopicOrThrow(Number(body.topicId));
      return { field, context: { classId: topic.classId } };
    }
    case "taskId": {
      const task = await getTaskOrThrow(Number(body.taskId));
      return { field, context: { classId: task.classId } };
    }
    case "submissionId": {
      const submission = await getSubmissionOrThrow(Number(body.submissionId));
      return {
        field,
        context: {
          classId: submission.task.classId,
          ownerId: submission.studentId,
        },
      };
    }
    case "announcementId": {
      const announcement = await prisma.announcement.findUnique({
        where: { id: Number(body.announcementId) },
      });
      if (!announcement) throw new AppError("Announcement not found", 404);
      return { field, context: { classId: announcement.classId } };
    }
  }
}

async function assertCanAttach(
  userId: string,
  context: AttachmentContext,
): Promise<void> {
  if (context.ownerId) {
    if (context.ownerId !== userId) {
      throw new AppError(
        "You can only attach files to your own submission",
        403,
      );
    }
    await requireClassMembership(context.classId, userId);
  } else {
    await requireTeacherMembership(context.classId, userId);
  }
}

export const handleCreateAttachment = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const {
    title,
    type,
    classId,
    topicId,
    taskId,
    submissionId,
    announcementId,
  } = req.body;

  if (!type) {
    throw new AppError("type is required", 400);
  }

  const { context } = await resolveContext({
    classId,
    topicId,
    taskId,
    submissionId,
    announcementId,
  });
  await assertCanAttach(userId, context);

  let url: string;
  let fileSize: number | null = null;

  if (type === "LINK") {
    if (!req.body.url) {
      throw new AppError("url is required for LINK attachments", 400);
    }
    url = req.body.url;
  } else {
    // FILE / IMAGE — the `upload` multer middleware (see attachment.routes.ts)
    // parses the multipart body ahead of this handler and populates req.file.
    if (!req.file) {
      throw new AppError("A file is required for FILE/IMAGE attachments", 400);
    }
    const uploaded = await storageProvider.upload(req.file);
    url = uploaded.url;
    fileSize = uploaded.fileSize;
  }

  const attachment = await prisma.attachment.create({
    data: {
      title,
      type,
      url,
      fileSize,
      classId: classId ?? null,
      topicId: topicId != null ? Number(topicId) : null,
      taskId: taskId != null ? Number(taskId) : null,
      submissionId: submissionId != null ? Number(submissionId) : null,
      announcementId: announcementId != null ? Number(announcementId) : null,
    },
  });

  res.status(201).json(attachment);
};

export const handleDeleteAttachment = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { attachmentId } = req.params;

  const attachment = await prisma.attachment.findUnique({
    where: { id: Number(attachmentId) },
  });
  if (!attachment) {
    throw new AppError("Attachment not found", 404);
  }

  const { context } = await resolveContext({
    classId: attachment.classId,
    topicId: attachment.topicId,
    taskId: attachment.taskId,
    submissionId: attachment.submissionId,
    announcementId: attachment.announcementId,
  });
  await assertCanAttach(userId, context);

  await prisma.attachment.delete({ where: { id: attachment.id } });

  if (attachment.type !== "LINK") {
    await storageProvider.delete(attachment.url);
  }

  res.status(204).send();
};
