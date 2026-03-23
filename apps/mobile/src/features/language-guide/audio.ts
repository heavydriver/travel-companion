import * as Speech from "expo-speech";
import { useCallback, useEffect } from "react";
import type { PhraseItem } from "./types";

export function usePhraseAudio() {
  const stopPlayback = useCallback(async () => {
    Speech.stop();
  }, []);

  const playPhrase = useCallback(
    async (phrase: PhraseItem) => {
      await stopPlayback();
      // expo-av is intentionally disabled for now, so all playback uses TTS.
      const spoken = phrase.latinSpelling ?? phrase.originalText ?? phrase.englishText;
      if (!spoken) return;
      Speech.speak(spoken);
    },
    [stopPlayback]
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
