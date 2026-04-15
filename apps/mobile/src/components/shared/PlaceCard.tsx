import { Image } from "expo-image";
import { MapPin, Star } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { memo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

export type PlaceCardProps = {
  title: string;
  subtitle?: string | null;
  rating?: number | null;
  metaRight?: ReactNode;
  imageUrl?: string | null;
  placeholderIcon?: ReactNode;
  onPress: () => void;
};

/**
 * Horizontal row card for a place or similar entity (image + title + meta).
 * Avoid root `overflow-hidden` so nested ScrollView layouts measure height correctly on RN.
 */
export const PlaceCard = memo(function PlaceCard({
  title,
  subtitle,
  rating,
  metaRight,
  imageUrl,
  placeholderIcon,
  onPress,
}: PlaceCardProps) {
  const mutedParts = useUnstableNativeVariable("--muted-foreground");
  const mutedIconColor = mutedParts ? `hsl(${mutedParts})` : "#888";

  return (
    <Pressable
      onPress={onPress}
      className="flex-row gap-3 rounded-2xl border border-border/80 bg-card/80 px-3 py-3.5 active:opacity-80"
    >
      <View className="h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          (placeholderIcon ?? <MapPin size={22} color={mutedIconColor} />)
        )}
      </View>
      <View className="min-w-0 flex-1 justify-center">
        <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs leading-4 text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <View className="mt-1.5 flex-row flex-wrap items-center gap-1">
          {rating != null ? (
            <>
              <Star size={12} color="#FBBF24" fill="#FBBF24" />
              <Text className="text-xs text-muted-foreground">{rating.toFixed(1)}</Text>
              {metaRight != null ? <Text className="text-xs text-muted-foreground">·</Text> : null}
            </>
          ) : null}
          {metaRight}
        </View>
      </View>
    </Pressable>
  );
});
