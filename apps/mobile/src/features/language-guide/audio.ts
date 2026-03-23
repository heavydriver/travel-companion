import * as Speech from "expo-speech";
import { useCallback, useEffect } from "react";
import type { PhraseItem } from "./types";

type SpeechVoice = Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>>[number];

const LANGUAGE_TO_LOCALES: Record<string, string[]> = {
  en: ["en-US", "en-GB", "en"],
  fr: ["fr-FR", "fr-CA", "fr"],
  it: ["it-IT", "it"],
  ja: ["ja-JP", "ja"],
  es: ["es-ES", "es-MX", "es"],
  th: ["th-TH", "th"],
};

function normalizeLocale(locale: string) {
  return locale.toLowerCase().replace(/_/g, "-");
}

function getLocaleCandidates(languageIso?: string | null) {
  if (!languageIso) return [];
  const normalizedIso = languageIso.toLowerCase();
  const mapped = LANGUAGE_TO_LOCALES[normalizedIso];
  if (mapped?.length) {
    return mapped;
  }
  return [normalizedIso];
}

function selectBestVoice(voices: SpeechVoice[], localeCandidates: string[]) {
  if (!voices.length || !localeCandidates.length) return null;

  const normalizedCandidates = localeCandidates.map(normalizeLocale);

  const exactMatch = normalizedCandidates.flatMap((candidate) =>
    voices.filter((voice) => normalizeLocale(voice.language) === candidate),
  )[0];
  if (exactMatch) return exactMatch;

  const languagePrefixMatch = normalizedCandidates.flatMap((candidate) => {
    const baseLanguage = candidate.split("-")[0];
    return voices.filter((voice) => normalizeLocale(voice.language).startsWith(`${baseLanguage}-`));
  })[0];
  if (languagePrefixMatch) return languagePrefixMatch;

  return null;
}

export function usePhraseAudio() {
  const stopPlayback = useCallback(async () => {
    Speech.stop();
  }, []);

  const getVoices = useCallback(async () => {
    try {
      return await Speech.getAvailableVoicesAsync();
    } catch {
      // On some devices this can fail; fallback to language-only speak.
      return [] as SpeechVoice[];
    }
  }, []);

  const playPhrase = useCallback(
    async (phrase: PhraseItem, languageIso?: string | null) => {
      await stopPlayback();
      // expo-av is intentionally disabled for now, so all playback uses TTS.
      const spoken = phrase.latinSpelling ?? phrase.originalText ?? phrase.englishText;
      if (!spoken) return;

      const localeCandidates = getLocaleCandidates(languageIso);
      const voices = await getVoices();
      const matchedVoice = selectBestVoice(voices, localeCandidates);
      const selectedLanguage = matchedVoice?.language ?? localeCandidates[0];

      try {
        Speech.speak(spoken, {
          language: selectedLanguage,
          voice: matchedVoice?.identifier,
          rate: 0.95,
          pitch: 1,
        });
      } catch {
        // Fallback to language-only, then default voice if language fails.
        try {
          Speech.speak(spoken, selectedLanguage ? { language: selectedLanguage } : undefined);
        } catch {
          Speech.speak(spoken);
        }
      }
    },
    [getVoices, stopPlayback]
  );

  useEffect(() => {
    return () => {
      void stopPlayback();
    };
  }, [stopPlayback]);

  return {
    playPhrase,
    stopPlayback,
  };
}
