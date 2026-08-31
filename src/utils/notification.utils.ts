import { prisma } from "../config/db";
import { sendFcmToUsers } from "./fcm.utils";
import { sendToUsers } from "../websocket/socket-server";

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function notifyClassMembers(
  classId: string,
  excludeUserId: string,
  payload: NotificationPayload,
): Promise<void> {
  const members = await prisma.classMember.findMany({
    where: { classId, userId: { not: excludeUserId } },
    select: { userId: true },
  });
  const userIds = members.map((m) => m.userId);
  if (userIds.length === 0) return;

  await Promise.all([
    sendFcmToUsers(userIds, payload),
    Promise.resolve(sendToUsers(userIds, { type: "notification", ...payload })),
  ]);
}
