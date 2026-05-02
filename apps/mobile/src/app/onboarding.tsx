import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useCallback, useMemo, useRef, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { Pressable, Text, View, type ViewToken } from "react-native";
import { Button } from "@/components/shared/Button";
import { Screen } from "@/components/shared/Screen";
import slides from "@/data/onboardingSlides.json";
import { useUiStore } from "@/store/uiStore";

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
};

export default function OnboardingScreen() {
  const router = useRouter();
  const listRef = useRef<FlashList<Slide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const setHasSeenOnboarding = useUiStore((state) => state.setHasSeenOnboarding);

  const data = useMemo(() => slides as Slide[], []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const item = viewableItems[0]?.index;
    if (typeof item === "number") {
      setCurrentIndex(item);
    }
  });

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  });

  const completeIntro = useCallback(
    async (target: "/(auth)/login" | "/(auth)/register") => {
      await setHasSeenOnboarding(true);
      router.replace(target as never);
    },
    [router, setHasSeenOnboarding],
  );

  const goNext = useCallback(() => {
    if (currentIndex >= data.length - 1) {
      void completeIntro("/(auth)/register");
      return;
    }

    listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
  }, [completeIntro, currentIndex, data.length]);

  return (
    <Screen className="bg-background" contentClassName="px-0 py-0">
      <View className="flex-1">
        <View className="px-5 pb-2 pt-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold uppercase tracking-wide text-primary">
              Travel Companion
            </Text>
            <Pressable onPress={() => void completeIntro("/(auth)/login")}>
              <Text className="text-sm font-medium text-muted-foreground">Skip</Text>
            </Pressable>
          </View>

          <View className="flex-row gap-2">
            {data.map((slide, index) => (
              <View
                key={slide.id}
                className={`h-1.5 flex-1 rounded-full ${
                  index <= currentIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </View>
        </View>

        <FlashList
          ref={listRef}
          data={data}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          estimatedItemSize={360}
          keyExtractor={(item) => item.id}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig.current}
          renderItem={({ item }) => (
            <View className="w-screen px-5 pb-5">
              <View className="flex-1 rounded-3xl border border-border bg-card p-6">
                <Text className="text-3xl font-bold text-card-foreground">{item.title}</Text>
                <Text className="mt-3 text-base leading-6 text-muted-foreground">
                  {item.subtitle}
                </Text>

                <View className="my-8 flex-1 items-center justify-center rounded-2xl bg-muted p-4">
                  <Image
                    source={{ uri: item.image }}
                    contentFit="cover"
                    className="h-56 w-full rounded-xl"
                  />
                </View>
              </View>
            </View>
          )}
        />

        <View className="gap-3 px-5 pb-8">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={currentIndex === data.length - 1 ? "Get started" : "Next"}
            onPress={goNext}
            className="ml-auto h-9 w-9 items-center justify-center rounded-full border border-border bg-card active:opacity-90"
          >
            <ArrowRight color={`hsl(${useUnstableNativeVariable("--foreground")})`} size={18} />
          </Pressable>
          <Button
            label="Login"
            variant="secondary"
            onPress={() => void completeIntro("/(auth)/login")}
          />
          <Button label="Create account" onPress={() => void completeIntro("/(auth)/register")} />
        </View>
      </View>
    </Screen>
  );
}
