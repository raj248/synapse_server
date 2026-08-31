import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "../config/db";
import "../config/firebase";
import { NotificationPayload } from "./notification.utils";

export async function sendFcmToUsers(
  userIds: string[],
  payload: NotificationPayload,
): Promise<void> {
  const tokens = await prisma.deviceToken.findMany({
    where: { userId: { in: userIds } },
  });
  if (tokens.length === 0) return;

  const response = await getMessaging().sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
  });

  // Uninstalled app / revoked token — clean these out so they stop
  // accumulating and getting retried on every future notification.
  const deadTokens = response.responses
    .map((r, i) =>
      !r.success && isDeadTokenError(r.error?.code) ? tokens[i].token : null,
    )
    .filter((t): t is string => t !== null);

  if (deadTokens.length > 0) {
    await prisma.deviceToken.deleteMany({
      where: { token: { in: deadTokens } },
    });
  }
}

function isDeadTokenError(code?: string): boolean {
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token"
  );
}
