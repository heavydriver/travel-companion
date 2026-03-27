import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Heart, Play } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Screen } from "@/components/shared/Screen";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguagePhrasesInfiniteQuery, useLanguagesQuery } from "@/features/language-guide/api";
import { usePhraseAudio } from "@/features/language-guide/audio";
import {
  CATEGORY_LABELS,
  COUNTRY_TO_LANGUAGE_ISO,
  FAVORITES_FILTER,
  FAVORITES_LABEL,
} from "@/features/language-guide/constants";
import { useLanguageFavorites } from "@/features/language-guide/favorites";
import { CountryFlag } from "@/features/language-guide/flags";
import {
  type CategoryFilter,
  PHRASE_CATEGORIES,
  type PhraseItem,
} from "@/features/language-guide/types";

type LanguageGuideParams = {
  languageId?: string;
  languageIso?: string;
  countryCode?: string;
};

export default function LanguageGuideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<LanguageGuideParams>();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter | null>(null);
  const [selectedLanguageId, setSelectedLanguageId] = useState<string | null>(null);
  const [languageTriggerWidth, setLanguageTriggerWidth] = useState(0);

  const foreground = useUnstableNativeVariable("--foreground");
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const borderColor = useUnstableNativeVariable("--border");
  const primary = useUnstableNativeVariable("--primary");

  const foregroundColor = foreground ? `hsl(${foreground})` : undefined;
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : undefined;
  const primaryColor = primary ? `hsl(${primary})` : undefined;

  const {
    data: languageData,
    isLoading: isLanguagesLoading,
    error: languagesError,
  } = useLanguagesQuery();
  const languages = languageData?.languages ?? [];

  const selectedLanguage = useMemo(
    () => languages.find((language) => language.id === selectedLanguageId) ?? null,
    [languages, selectedLanguageId],
  );
  const selectedLanguageLabel = selectedLanguage
    ? `${selectedLanguage.name} (${selectedLanguage.nativeName})`
    : null;
  const selectedLanguageOption = selectedLanguage
    ? {
        value: selectedLanguage.id,
        label: selectedLanguageLabel ?? selectedLanguage.name,
      }
    : undefined;

  useEffect(() => {
    if (!languages.length || selectedLanguageId) return;

    const byId = typeof params.languageId === "string" ? params.languageId : undefined;
    const byIsoRaw = typeof params.languageIso === "string" ? params.languageIso : undefined;
    const byCountryRaw = typeof params.countryCode === "string" ? params.countryCode : undefined;
    const byCountryIso = byCountryRaw
      ? COUNTRY_TO_LANGUAGE_ISO[byCountryRaw.toUpperCase()]
      : undefined;
    const byIso = byIsoRaw?.toLowerCase() ?? byCountryIso?.toLowerCase();

    const matched =
      languages.find((language) => language.id === byId) ??
      languages.find((language) => language.isoCode.toLowerCase() === byIso);

    if (matched) {
      setSelectedLanguageId(matched.id);
    }
  }, [languages, params.countryCode, params.languageId, params.languageIso, selectedLanguageId]);

  const phrasesQuery = useLanguagePhrasesInfiniteQuery(selectedLanguageId);
  const allPhrases = useMemo(
    () => phrasesQuery.data?.pages.flatMap((page) => page.phrases) ?? [],
    [phrasesQuery.data?.pages],
  );
  const totalPhrases = phrasesQuery.data?.pages[0]?.total ?? allPhrases.length;

  const { favoriteSet, toggleFavorite } = useLanguageFavorites(selectedLanguageId);
  const { playPhrase } = usePhraseAudio();

  const filteredPhrases = useMemo(() => {
    if (activeCategory === null) {
      return allPhrases;
    }
    if (activeCategory === FAVORITES_FILTER) {
      return allPhrases.filter((phrase) => favoriteSet.has(phrase.id));
    }
    return allPhrases.filter((phrase) => phrase.category === activeCategory);
  }, [activeCategory, allPhrases, favoriteSet]);

  const onSelectLanguage = (option?: { value: string }) => {
    if (!option?.value) return;
    setSelectedLanguageId(option.value);
  };

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)" as never);
  };

  const onEndReached = () => {
    if (!phrasesQuery.hasNextPage || phrasesQuery.isFetchingNextPage) {
      return;
    }
    void phrasesQuery.fetchNextPage();
  };

  const renderPhrase: ListRenderItem<PhraseItem> = ({ item }) => {
    const isFavorite = favoriteSet.has(item.id);
    const primaryText = item.latinSpelling ?? item.originalText ?? item.englishText;
    const secondaryOriginalText = item.latinSpelling ? item.originalText : null;

    return (
      <View className="mb-3 mx-4 rounded-3xl border border-border bg-card p-6">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-bold tracking-tight text-card-foreground">
              {primaryText}
            </Text>
            {secondaryOriginalText ? (
              <Text className="mt-1 text-lg text-card-foreground/90">{secondaryOriginalText}</Text>
            ) : null}
            {item.syllables ? (
              <Text className="mt-1 text-md italic text-muted-foreground">{item.syllables}</Text>
            ) : null}
            <Text className="mt-2 text-lg font-normal text-primary">{item.englishText}</Text>
          </View>

          <View className="gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? "Remove favorite" : "Add favorite"}
              onPress={() => void toggleFavorite(item.id)}
              className="h-12 w-12 items-center justify-center rounded-full bg-background active:opacity-80"
            >
              <Heart
                size={20}
                color={isFavorite ? "#EC4899" : mutedColor}
                fill={isFavorite ? "#EC4899" : "none"}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Play phrase"
              onPress={() => void playPhrase(item, selectedLanguage?.isoCode)}
              className="h-12 w-12 items-center justify-center rounded-full bg-primary active:opacity-80"
            >
              <Play size={20} color="white" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  const emptyState = () => {
    if (selectedLanguageId === null) {
      return (
        <View className="rounded-2xl mx-4 border border-border bg-card p-5">
          <Text className="text-base text-muted-foreground">
            Select a target language to load phrases.
          </Text>
        </View>
      );
    }
    if (phrasesQuery.isLoading) {
      return (
        <View className="items-center py-8">
          <ActivityIndicator />
        </View>
      );
    }
    return (
      <View className="rounded-2xl mx-4 border border-border bg-card p-5">
        <Text className="text-base text-muted-foreground">
          No phrases found for this category yet.
        </Text>
      </View>
    );
  };

  return (
    <Screen contentClassName="px-0 pt-4 pb-0">
      <FlatList
        data={filteredPhrases}
        keyExtractor={(item) => item.id}
        renderItem={renderPhrase}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        ListHeaderComponent={
          <View className="px-5 pb-3">
            <View className="mb-6 flex-row items-center justify-between">
              <Pressable
                className="h-10 w-10 items-center justify-center rounded-full bg-card active:opacity-80"
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <ArrowLeft size={20} color={foregroundColor} />
              </Pressable>
              <Text className="text-2xl font-bold text-foreground">Language Guide</Text>
              <View className="h-10 w-10" />
            </View>

            <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Target Language
            </Text>
            <Select value={selectedLanguageOption} onValueChange={onSelectLanguage}>
              <SelectTrigger
                className="h-auto min-h-14 rounded-2xl border-border bg-card px-4 py-3"
                disabled={isLanguagesLoading || languages.length === 0}
                aria-label="Select target language"
                onLayout={(event) => {
                  const nextWidth = Math.round(event.nativeEvent.layout.width);
                  setLanguageTriggerWidth((prev) => (prev === nextWidth ? prev : nextWidth));
                }}
              >
                {selectedLanguage ? (
                  <View className="flex-row items-center gap-2">
                    <CountryFlag isoCode={selectedLanguage.isoCode} />
                    <Text className="text-lg text-card-foreground">{selectedLanguageLabel}</Text>
                  </View>
                ) : (
                  <SelectValue
                    className="text-lg text-card-foreground"
                    placeholder={isLanguagesLoading ? "Loading languages..." : "Select a language"}
                  />
                )}
              </SelectTrigger>
              <SelectContent
                className="border-border bg-card"
                style={languageTriggerWidth > 0 ? { width: languageTriggerWidth } : undefined}
              >
                {languages.map((language) => (
                  <SelectItem
                    key={language.id}
                    value={language.id}
                    label={`${language.name} (${language.nativeName})`}
                  >
                    <View className="flex-row items-center gap-3">
                      <CountryFlag isoCode={language.isoCode} />
                      <Text className="text-base text-card-foreground">
                        {language.name} ({language.nativeName})
                      </Text>
                    </View>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {languagesError ? (
              <Text className="mt-2 text-sm text-destructive">{languagesError.message}</Text>
            ) : null}
            {phrasesQuery.error ? (
              <Text className="mt-2 text-sm text-destructive">{phrasesQuery.error.message}</Text>
            ) : null}

            <View className="mt-6">
              <Text className="mb-3 text-3xl font-bold text-foreground">Top Phrases</Text>
              <Text className="mb-4 text-sm text-muted-foreground">
                {selectedLanguage
                  ? `${filteredPhrases.length} shown / ${totalPhrases} total`
                  : "Choose a language to begin"}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 pb-4"
            >
              <Pressable
                key="all-phrases"
                onPress={() => setActiveCategory(null)}
                className="rounded-full px-4 py-2.5 active:opacity-80"
                style={{
                  backgroundColor:
                    activeCategory === null
                      ? primaryColor
                      : borderColor
                        ? `hsl(${borderColor})`
                        : undefined,
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{
                    color: activeCategory === null ? "white" : foregroundColor,
                  }}
                >
                  All
                </Text>
              </Pressable>
              {[FAVORITES_FILTER, ...PHRASE_CATEGORIES].map((item) => {
                const isActive = activeCategory === item;
                const label =
                  item === FAVORITES_FILTER
                    ? FAVORITES_LABEL
                    : CATEGORY_LABELS[item as Exclude<CategoryFilter, "FAVORITES">];
                return (
                  <Pressable
                    key={item}
                    onPress={() => setActiveCategory(item)}
                    className="rounded-full px-4 py-2.5 active:opacity-80"
                    style={{
                      backgroundColor: isActive
                        ? primaryColor
                        : borderColor
                          ? `hsl(${borderColor})`
                          : undefined,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{
                        color: isActive ? "white" : foregroundColor,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={emptyState}
        ListFooterComponent={
          phrasesQuery.isFetchingNextPage ? (
            <View className="items-center py-5">
              <ActivityIndicator />
            </View>
          ) : null
        }
        contentContainerClassName="pb-6"
      />
    </Screen>
  );
}
