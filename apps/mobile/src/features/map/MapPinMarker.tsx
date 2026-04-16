import { Bed, Camera, MapPin, UtensilsCrossed } from "lucide-react-native";
import { memo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { pinColorForCategory } from "./categoryPinColor";

const LABEL = {
  color: "#FFFFFF",
  fontSize: 9,
  fontWeight: "600" as const,
  textShadowColor: "rgba(0,0,0,0.92)",
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 3,
};

function iconForCategory(category: string): ReactNode {
  const c = category.toLowerCase();
  if (c.includes("food") || c.includes("restaurant") || c.includes("cafe") || c.includes("dining")) {
    return <UtensilsCrossed size={12} color="#fff" />;
  }
  if (c.includes("hotel") || c.includes("lodg") || c.includes("stay")) {
    return <Bed size={12} color="#fff" />;
  }
  if (c.includes("museum") || c.includes("view") || c.includes("attraction") || c.includes("landmark")) {
    return <Camera size={12} color="#fff" />;
  }
  return <MapPin size={12} color="#fff" />;
}

type MapPinMarkerProps = {
  name: string;
  category: string;
  selected: boolean;
  onPress: () => void;
};

export const MapPinMarker = memo(function MapPinMarker({
  name,
  category,
  selected,
  onPress,
}: MapPinMarkerProps) {
  const fill = pinColorForCategory(category);
  const short = name.length > 18 ? `${name.slice(0, 16)}…` : name;
  const label = selected ? name : short;

  return (
    <Pressable onPress={onPress} className="items-center active:opacity-90" hitSlop={6}>
      <Text
        className="mb-0.5 max-w-[9rem] text-center"
        numberOfLines={selected ? 2 : 1}
        style={[LABEL, selected ? { fontSize: 10 } : null]}
      >
        {label}
      </Text>
      <View className="items-center">
        <View
          className="items-center justify-center rounded-full border-2 border-white shadow-md"
          style={{
            backgroundColor: fill,
            width: 30,
            height: 30,
          }}
        >
          {iconForCategory(category)}
        </View>
        <View
          style={{
            marginTop: -1,
            width: 0,
            height: 0,
            borderLeftWidth: 5,
            borderRightWidth: 5,
            borderTopWidth: 7,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderTopColor: fill,
          }}
        />
      </View>
    </Pressable>
  );
});
