import {
  Bed,
  Bus,
  Camera,
  Coffee,
  Landmark,
  MapPin,
  Music,
  ShoppingBag,
  Train,
  Trees,
  UtensilsCrossed,
  Wine,
} from "lucide-react-native";
import { memo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";
import { pinColorForCategory } from "./categoryPinColor";

/** Normalized pin body (bulb + point). */
const PIN_PATH =
  "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z";

const VB = 24;
/** Bulb center in viewBox space. */
const BULB_CX = 12;
const BULB_CY = 9;
const PIN_PX = 52;

function iconForCategory(category: string, color: string, size: number): ReactNode {
  const c = category.trim().toLowerCase();
  if (c.includes("restaurant") || c.includes("dining") || c.includes("food")) {
    return <UtensilsCrossed size={size} color={color} strokeWidth={2.4} />;
  }
  if (c.includes("cafe") || c.includes("coffee") || c.includes("bakery")) {
    return <Coffee size={size} color={color} strokeWidth={2.4} />;
  }
  if (c.includes("hotel") || c.includes("lodg") || c.includes("stay")) {
    return <Bed size={size} color={color} strokeWidth={2.4} />;
  }
  if (c.includes("shop") || c.includes("mall") || c.includes("store")) {
    return <ShoppingBag size={size} color={color} strokeWidth={2.4} />;
  }
  if (c.includes("nature") || c.includes("park") || c.includes("garden") || c.includes("hike")) {
    return <Trees size={size} color={color} strokeWidth={2.4} />;
  }
  if (c.includes("night") || c.includes("bar") || c.includes("club")) {
    return <Wine size={size} color={color} strokeWidth={2.4} />;
  }
  if (c.includes("music") || c.includes("theatre") || c.includes("theater") || c.includes("show")) {
    return <Music size={size} color={color} strokeWidth={2.4} />;
  }
  if (c.includes("transport") || c.includes("station") || c.includes("transit")) {
    return <Train size={size} color={color} strokeWidth={2.4} />;
  }
  if (c.includes("bus")) {
    return <Bus size={size} color={color} strokeWidth={2.4} />;
  }
  if (
    c.includes("museum") ||
    c.includes("attraction") ||
    c.includes("landmark") ||
    c.includes("monument")
  ) {
    return <Landmark size={size} color={color} strokeWidth={2.4} />;
  }
  if (c.includes("view") || c.includes("photo") || c.includes("scenic")) {
    return <Camera size={size} color={color} strokeWidth={2.4} />;
  }
  return <MapPin size={size} color={color} strokeWidth={2.4} />;
}

export type MapPinMarkerProps = {
  name: string;
  category: string;
  selected: boolean;
  /** Visual scale from map zoom (updated while the camera moves). */
  zoomScale: number;
  onPress: () => void;
};

export const MapPinMarker = memo(function MapPinMarker({
  name,
  category,
  selected,
  zoomScale,
  onPress,
}: MapPinMarkerProps) {
  const accent = pinColorForCategory(category);
  const selectionBoost = selected ? 1.14 : 1;
  const s = Math.max(0.38, Math.min(1.55, zoomScale)) * selectionBoost;

  const base = PIN_PX;
  const w = base * s;
  const h = base * s;

  const iconSize = Math.round(Math.max(11, Math.min(17, 13 * s)));
  const labelShort = name.length > 20 ? `${name.slice(0, 18)}…` : name;
  const fontSize = Math.max(9, Math.round(10 * s));

  const showCompactLabel = !selected && s >= 0.52;

  return (
    <View pointerEvents="box-none" className="items-center" style={{ width: w + 8 }}>
      {selected ? (
        <Text
          pointerEvents="none"
          className="mb-1 max-w-[11rem] text-center font-bold"
          numberOfLines={2}
          style={{
            color: "#FFFFFF",
            fontSize,
            textShadowColor: "rgba(0,0,0,0.55)",
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
        >
          {name}
        </Text>
      ) : showCompactLabel ? (
        <Text
          pointerEvents="none"
          className="mb-0.5 max-w-[9rem] text-center font-semibold"
          numberOfLines={1}
          style={{
            color: accent,
            fontSize: Math.max(8, fontSize - 1),
            textShadowColor: "rgba(0,0,0,0.4)",
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 2,
          }}
        >
          {labelShort}
        </Text>
      ) : null}

      <Pressable
        onPress={onPress}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={{
          width: w,
          height: h,
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            width: base,
            height: base,
            transform: [{ scale: s }],
            transformOrigin: "50% 100%",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              width: base,
              height: base,
              shadowColor: "#2E1064",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: selected ? 0.55 : 0.38,
              shadowRadius: selected ? 7 : 4,
              elevation: selected ? 10 : 5,
            }}
          >
            <Svg width={base} height={base} viewBox={`0 0 ${VB} ${VB}`}>
              <Ellipse
                cx={BULB_CX}
                cy={21.2}
                rx={4.2}
                ry={1.55}
                fill="#1E1B4B"
                opacity={0.28}
              />
              {selected ? (
                <Path
                  d={PIN_PATH}
                  fill="none"
                  stroke={accent}
                  strokeWidth={2.2}
                  opacity={0.95}
                  transform="translate(0, 0.35)"
                />
              ) : null}
              <Path d={PIN_PATH} fill="#FFFFFF" transform="translate(0, 0.35)" />
              <Path
                d={PIN_PATH}
                fill="none"
                stroke="rgba(15,23,42,0.12)"
                strokeWidth={0.45}
                transform="translate(0, 0.35)"
              />
            </Svg>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: (BULB_CX * base) / VB - (iconSize + 10) / 2,
                top: (BULB_CY * base) / VB - (iconSize + 10) / 2 + 0.5,
                width: iconSize + 10,
                height: iconSize + 10,
                borderRadius: 999,
                backgroundColor: accent,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: selected ? 2.5 : 1.5,
                borderColor: "rgba(255,255,255,0.92)",
              }}
            >
              {iconForCategory(category, "#FFFFFF", iconSize)}
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
});
