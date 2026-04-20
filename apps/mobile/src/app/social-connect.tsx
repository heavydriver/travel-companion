import { Redirect } from "expo-router";

/** Social discovery and requests now live on the Instagram-style profile screen. */
export default function SocialConnectRedirect() {
  return <Redirect href="/profile?tab=nearby" />;
}
