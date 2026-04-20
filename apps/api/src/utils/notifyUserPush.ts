import { prisma } from "@repo/db";
import { sendExpoPushToUserTokens } from "./pushNotifications";

export async function notifyUserPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const tokens = await prisma.pushDevice.findMany({
    where: { userId },
    select: { expoToken: true },
  });
  await sendExpoPushToUserTokens(
    tokens.map((t) => t.expoToken),
    { title, body, data }
  );
}
