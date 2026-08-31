import { Response } from "express";
import { prisma } from "../config/db";
import { AppError } from "../utils/app-error.utils";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { generateUniqueJoinCode } from "../utils/join-code.utils";
import {
  requireClassAuthor,
  requireClassMembership,
  requireTeacherMembership,
} from "../utils/class-access.utils";

const memberSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  image: true,
} as const;

export const handleCreateClass = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { name, subject, description } = req.body;

  if (!name) {
    throw new AppError("Class name is required", 400);
  }

  const joinCode = await generateUniqueJoinCode();

  const newClass = await prisma.$transaction(async (tx) => {
    const created = await tx.class.create({
      data: { name, subject, description, joinCode, createdById: userId },
    });

    await tx.classMember.create({
      data: { userId, classId: created.id, role: "TEACHER" },
    });

    return created;
  });

  res.status(201).json(newClass);
};

export const handleListClasses = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;

  const classes = await prisma.class.findMany({
    where: { members: { some: { userId } } },
    include: {
      _count: { select: { members: true } },
      createdBy: { select: memberSelect },
    },
    orderBy: { updatedAt: "desc" },
  });

  res.status(200).json(classes);
};

export const handleGetClass = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { classId } = req.params;

  await requireClassMembership(classId as string, userId);

  const classRecord = await prisma.class.findUnique({
    where: { id: classId as string },
    include: {
      _count: { select: { members: true } },
      createdBy: { select: memberSelect },
    },
  });

  if (!classRecord) {
    throw new AppError("Class not found", 404);
  }

  res.status(200).json(classRecord);
};

export const handleUpdateClass = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { classId } = req.params;
  const { name, subject, description } = req.body;

  await requireTeacherMembership(classId as string, userId);

  const updated = await prisma.class.update({
    where: { id: classId as string },
    data: { name, subject, description },
  });

  res.status(200).json(updated);
};

export const handleDeleteClass = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { classId } = req.params;

  await requireClassAuthor(classId as string, userId);
  await prisma.class.delete({ where: { id: classId as string } });

  res.status(204).send();
};

export const handleJoinClass = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { joinCode } = req.body;

  if (!joinCode) {
    throw new AppError("A join code is required", 400);
  }

  const classRecord = await prisma.class.findUnique({ where: { joinCode } });

  if (!classRecord) {
    throw new AppError("Invalid join code", 404);
  }

  const existingMembership = await prisma.classMember.findUnique({
    where: { userId_classId: { userId, classId: classRecord.id } },
  });

  if (existingMembership) {
    throw new AppError("You're already a member of this class", 400);
  }

  await prisma.classMember.create({
    data: { userId, classId: classRecord.id, role: "STUDENT" },
  });

  res.status(201).json(classRecord);
};

export const handleLeaveClass = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { classId } = req.params;

  const membership = await requireClassMembership(classId as string, userId);

  const classRecord = await prisma.class.findUnique({
    where: { id: classId as string },
    select: { createdById: true },
  });

  if (membership.role === "TEACHER" && classRecord?.createdById === userId) {
    throw new AppError(
      "The class creator can't leave — delete the class instead if you want to remove it",
      400,
    );
  }

  await prisma.classMember.delete({
    where: { userId_classId: { userId, classId: classId as string } },
  });

  res.status(204).send();
};

export const handleListMembers = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { classId } = req.params;

  await requireClassMembership(classId as string, userId);

  const members = await prisma.classMember.findMany({
    where: { classId: classId as string },
    include: { user: { select: memberSelect } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });

  res.status(200).json(members);
};

export const handleRemoveMember = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const actingUserId = req.user!.userId;
  const { classId, userId: targetUserId } = req.params;

  await requireTeacherMembership(classId as string, actingUserId);

  const classRecord = await prisma.class.findUnique({
    where: { id: classId as string },
    select: { createdById: true },
  });

  if (classRecord?.createdById === targetUserId) {
    throw new AppError("The class creator can't be removed", 400);
  }

  const target = await prisma.classMember.findUnique({
    where: {
      userId_classId: {
        userId: targetUserId as string,
        classId: classId as string,
      },
    },
  });

  if (!target) {
    throw new AppError("That user is not a member of this class", 404);
  }

  await prisma.classMember.delete({
    where: {
      userId_classId: {
        userId: targetUserId as string,
        classId: classId as string,
      },
    },
  });

  res.status(204).send();
};
