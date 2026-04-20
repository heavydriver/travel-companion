import Expo, { type ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export async function sendExpoPushToUserTokens(
  expoTokens: string[],
  message: Pick<ExpoPushMessage, "title" | "body" | "data" | "sound">
): Promise<void> {
  const unique = [...new Set(expoTokens.filter((t) => Expo.isExpoPushToken(t)))];
  if (unique.length === 0) return;

  const chunks = expo.chunkPushNotifications(
    unique.map((to) => ({
      to,
      sound: message.sound ?? "default",
      title: message.title,
      body: message.body,
      data: message.data ?? {},
    }))
  );

  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch {
      // Push delivery is best-effort; avoid failing the main request.
    }
  }
}
