import { Text } from "react-native";

function regionToEmoji(region: string): string {
  const upper = region.toUpperCase();
  if (upper === "EU") return "🇪🇺";
  if (!/^[A-Z]{2}$/.test(upper)) return "🏳️";
  const codePoints = upper.split("").map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/** `countryCode` is ISO 3166-1 alpha-2 from the API (`EU` for euro area). */
export function CurrencyFlagEmoji({ countryCode }: { countryCode: string }) {
  return <Text className="text-xl">{regionToEmoji(countryCode)}</Text>;
}
