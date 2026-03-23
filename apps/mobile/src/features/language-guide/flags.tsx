import { Text } from "react-native";

const LANGUAGE_TO_COUNTRY_OVERRIDES: Record<string, string> = {
  en: "US",
  ja: "JP",
};

function toFlagEmoji(countryCode: string) {
  const normalized = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return "🏳️";
  }
  const codePoints = normalized.split("").map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

type CountryFlagProps = {
  isoCode: string;
};

export function CountryFlag({ isoCode }: CountryFlagProps) {
  const normalizedIso = isoCode.toLowerCase();
  const countryCode =
    LANGUAGE_TO_COUNTRY_OVERRIDES[normalizedIso] ?? normalizedIso.slice(0, 2).toUpperCase();

  return <Text className="text-base">{toFlagEmoji(countryCode)}</Text>;
}
