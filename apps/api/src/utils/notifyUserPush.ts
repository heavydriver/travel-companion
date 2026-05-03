import { prisma } from "@repo/db";
import { sendExpoPushToUserTokens } from "./pushNotifications";

type NotificationType = "message" | "connection_request" | "connection_accepted" | "general";

export async function notifyUserPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  type: NotificationType = "general"
): Promise<void> {
  if (type === "message" || type === "connection_request" || type === "connection_accepted") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notifyMessages: true, notifyConnections: true },
    });

    if (!user) return;
    if (type === "message" && !user.notifyMessages) return;
    if ((type === "connection_request" || type === "connection_accepted") && !user.notifyConnections) return;
  }

  const tokens = await prisma.pushDevice.findMany({
    where: { userId },
    select: { expoToken: true },
  });
  await sendExpoPushToUserTokens(
    tokens.map((t) => t.expoToken),
    { title, body, data }
  );
}
