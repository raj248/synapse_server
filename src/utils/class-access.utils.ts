import { prisma } from "../config/db";
import { AppError } from "./app-error.utils";

export async function requireClassMembership(classId: string, userId: string) {
  const membership = await prisma.classMember.findUnique({
    where: { userId_classId: { userId, classId } },
  });

  if (!membership) {
    throw new AppError("You are not a member of this class", 403);
  }

  return membership;
}

export async function requireTeacherMembership(
  classId: string,
  userId: string,
) {
  const membership = await requireClassMembership(classId, userId);

  if (membership.role !== "TEACHER") {
    throw new AppError(
      "Only a teacher of this class can perform this action",
      403,
    );
  }

  return membership;
}

export async function requireClassAuthor(classId: string, userId: string) {
  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, createdById: true },
  });

  if (!classRecord) {
    throw new AppError("Class not found", 404);
  }

  if (classRecord.createdById !== userId) {
    throw new AppError("Only the class creator can perform this action", 403);
  }

  return classRecord;
}
