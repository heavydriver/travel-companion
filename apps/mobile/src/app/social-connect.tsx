import { Redirect } from "expo-router";

export default function SocialConnectScreen() {
  return <Redirect href="/profile?tab=connections" />;
}
