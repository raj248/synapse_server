import { Prisma } from "@prisma/client";

interface SiblingScope {
  classId: string;
  parentId: number | null;
}

// Shifts everything between the old and new position by one, closing the
// gap the move leaves behind — this is what lets the UI just send "topic X
// now belongs at index N" and have gaps close automatically instead of
// managing spacing itself.
export async function moveSyllabusTopic(
  tx: Prisma.TransactionClient,
  topicId: number,
  siblingsWhere: SiblingScope,
  fromIndex: number,
  toIndex: number,
): Promise<void> {
  if (fromIndex === toIndex) return;

  if (toIndex > fromIndex) {
    await tx.syllabusTopic.updateMany({
      where: { ...siblingsWhere, orderIndex: { gt: fromIndex, lte: toIndex } },
      data: { orderIndex: { decrement: 1 } },
    });
  } else {
    await tx.syllabusTopic.updateMany({
      where: { ...siblingsWhere, orderIndex: { gte: toIndex, lt: fromIndex } },
      data: { orderIndex: { increment: 1 } },
    });
  }

  await tx.syllabusTopic.update({
    where: { id: topicId },
    data: { orderIndex: toIndex },
  });
}

// Makes room at `index` before a new sibling is created there.
export async function insertSyllabusTopicAt(
  tx: Prisma.TransactionClient,
  siblingsWhere: SiblingScope,
  index: number,
): Promise<void> {
  await tx.syllabusTopic.updateMany({
    where: { ...siblingsWhere, orderIndex: { gte: index } },
    data: { orderIndex: { increment: 1 } },
  });
}

// Closes the gap left behind after a sibling is deleted.
export async function closeSyllabusTopicGap(
  tx: Prisma.TransactionClient,
  siblingsWhere: SiblingScope,
  removedIndex: number,
): Promise<void> {
  await tx.syllabusTopic.updateMany({
    where: { ...siblingsWhere, orderIndex: { gt: removedIndex } },
    data: { orderIndex: { decrement: 1 } },
  });
}
