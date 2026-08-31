import { Response } from "express";
import { prisma } from "../config/db";
import { AppError } from "../utils/app-error.utils";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  requireClassMembership,
  requireTeacherMembership,
} from "../utils/class-access.utils";
import { getTopicOrThrow } from "../utils/content-access.utils";
import {
  closeSyllabusTopicGap,
  insertSyllabusTopicAt,
  moveSyllabusTopic,
} from "../utils/reorder.utils";

type FlatTopic = Awaited<
  ReturnType<typeof prisma.syllabusTopic.findMany>
>[number];

// Prisma's `include` can't nest to arbitrary depth, and a syllabus outline
// can go deeper than any fixed number of levels — fetch flat, assemble the
// tree in memory instead.
function buildTopicTree(topics: FlatTopic[]) {
  const byId = new Map(
    topics.map((t) => [t.id, { ...t, subTopics: [] as any[] }]),
  );
  const roots: (typeof byId extends Map<any, infer V> ? V : never)[] = [];

  for (const topic of byId.values()) {
    if (topic.parentId && byId.has(topic.parentId)) {
      byId.get(topic.parentId)!.subTopics.push(topic);
    } else {
      roots.push(topic);
    }
  }

  return roots;
}

export const handleCreateTopic = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { classId } = req.params;
  const { title, description, parentId: rawParentId, orderIndex } = req.body;

  if (!title) {
    throw new AppError("Topic title is required", 400);
  }

  await requireTeacherMembership(classId as string, userId);

  const parentId = rawParentId != null ? Number(rawParentId) : null;

  if (parentId !== null) {
    const parent = await getTopicOrThrow(parentId);
    if (parent.classId !== classId) {
      throw new AppError("Parent topic belongs to a different class", 400);
    }
  }

  const siblingsWhere = { classId: classId as string, parentId };

  const topic = await prisma.$transaction(async (tx) => {
    const siblingCount = await tx.syllabusTopic.count({ where: siblingsWhere });
    // No orderIndex given → append at the end. Given but out of range → clamp.
    const targetIndex =
      orderIndex != null
        ? Math.min(Math.max(Number(orderIndex), 0), siblingCount)
        : siblingCount;

    if (targetIndex < siblingCount) {
      await insertSyllabusTopicAt(tx, siblingsWhere, targetIndex);
    }

    return tx.syllabusTopic.create({
      data: {
        classId: classId as string,
        title,
        description,
        parentId,
        orderIndex: targetIndex,
      },
    });
  });

  res.status(201).json(topic);
};

export const handleGetTopicTree = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { classId } = req.params;

  await requireClassMembership(classId as string, userId);

  const topics = await prisma.syllabusTopic.findMany({
    where: { classId: classId as string },
    orderBy: { orderIndex: "asc" },
  });

  res.status(200).json(buildTopicTree(topics));
};

export const handleGetTopic = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { topicId } = req.params;

  const topic = await getTopicOrThrow(Number(topicId));
  await requireClassMembership(topic.classId, userId);

  const full = await prisma.syllabusTopic.findUnique({
    where: { id: topic.id },
    include: {
      subTopics: { orderBy: { orderIndex: "asc" } },
      taskReferences: { include: { task: true } },
      attachments: true,
    },
  });

  res.status(200).json(full);
};

// Title/description only now — position changes go through /reorder below,
// since a position change needs sibling-shifting that a plain field update
// shouldn't silently trigger.
export const handleUpdateTopic = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { topicId } = req.params;
  const { title, description } = req.body;

  const topic = await getTopicOrThrow(Number(topicId));
  await requireTeacherMembership(topic.classId, userId);

  const updated = await prisma.syllabusTopic.update({
    where: { id: topic.id },
    data: { title, description },
  });

  res.status(200).json(updated);
};

export const handleUpdateTopicStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { topicId } = req.params;
  const { isCompleted } = req.body;

  if (typeof isCompleted !== "boolean") {
    throw new AppError("isCompleted (boolean) is required", 400);
  }

  const topic = await getTopicOrThrow(Number(topicId));
  await requireTeacherMembership(topic.classId, userId);

  const updated = await prisma.syllabusTopic.update({
    where: { id: topic.id },
    data: { isCompleted },
  });

  res.status(200).json(updated);
};

// Drag-and-drop endpoint: UI sends where the topic landed, backend shifts
// everything else to stay gap-free. Reordering across parents (dragging a
// topic under a different parent) isn't handled here — same-parent only for
// now; say the word if you need cross-parent moves too, that's a bigger
// change (needs to close the gap in the old parent AND open one in the new).
export const handleReorderTopic = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { topicId } = req.params;
  const { orderIndex } = req.body;

  if (typeof orderIndex !== "number" || orderIndex < 0) {
    throw new AppError("orderIndex (non-negative number) is required", 400);
  }

  const topic = await getTopicOrThrow(Number(topicId));
  await requireTeacherMembership(topic.classId, userId);

  const siblingsWhere = { classId: topic.classId, parentId: topic.parentId };

  await prisma.$transaction(async (tx) => {
    const siblingCount = await tx.syllabusTopic.count({ where: siblingsWhere });
    const targetIndex = Math.min(orderIndex, siblingCount - 1);
    await moveSyllabusTopic(
      tx,
      topic.id,
      siblingsWhere,
      topic.orderIndex,
      targetIndex,
    );
  });

  const updated = await prisma.syllabusTopic.findUnique({
    where: { id: topic.id },
  });
  res.status(200).json(updated);
};

export const handleDeleteTopic = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { topicId } = req.params;

  const topic = await getTopicOrThrow(Number(topicId));
  await requireTeacherMembership(topic.classId, userId);

  await prisma.$transaction(async (tx) => {
    // Sub-topics cascade via the schema's self-relation onDelete: Cascade —
    // deleting the whole subtree, so only the deleted topic's own sibling
    // group (relative to ITS parent) needs the gap closed.
    await tx.syllabusTopic.delete({ where: { id: topic.id } });
    await closeSyllabusTopicGap(
      tx,
      { classId: topic.classId, parentId: topic.parentId },
      topic.orderIndex,
    );
  });

  res.status(204).send();
};
