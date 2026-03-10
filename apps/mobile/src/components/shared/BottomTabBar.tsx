import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Bot, CalendarDays, Compass, Home, Map as MapIcon } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabMeta = {
  label: string;
  icon: "home" | "explore" | "map" | "assistant" | "itinerary";
};

const TAB_CONFIG: Record<string, TabMeta> = {
  index: { label: "Home", icon: "home" },
  map: { label: "Map", icon: "map" },
  explore: { label: "Explore", icon: "explore" },
  itinerary: { label: "Itinerary", icon: "itinerary" },
  assistant: { label: "Assistant", icon: "assistant" },
};

function TabIcon({
  icon,
  focused,
  primaryColor,
  mutedColor,
}: {
  icon: TabMeta["icon"];
  focused: boolean;
  primaryColor: string | undefined;
  mutedColor: string | undefined;
}) {
  const color = focused ? primaryColor : mutedColor;
  const size = 22;

  switch (icon) {
    case "home":
      return <Home size={size} color={color} />;
    case "explore":
      return <Compass size={size} color={color} />;
    case "map":
      return <MapIcon size={size} color={color} />;
    case "itinerary":
      return <CalendarDays size={size} color={color} />;
    case "assistant":
      return <Bot size={size} color={color} />;
    default:
      return <Home size={size} color={color} />;
  }
}

export function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const primary = useUnstableNativeVariable("--primary");
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const primaryColor = primary ? `hsl(${primary})` : undefined;
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : undefined;

  return (
    <View className="border-t border-border bg-card" style={{ paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-around pt-2">
        {state.routes.map((route, index) => {
          const config = TAB_CONFIG[route.name];
          if (!config) {
            return null;
          }

          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityRole="button"
              accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel}
              testID={descriptors[route.key]?.options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              className="flex-1 items-center justify-center active:opacity-80"
              style={{ height: 56 }}
            >
              <TabIcon
                icon={config.icon}
                focused={isFocused}
                primaryColor={primaryColor}
                mutedColor={mutedColor}
              />
              <Text
                className="mt-1 text-xs font-medium"
                style={{
                  color: isFocused ? primaryColor : mutedColor,
                }}
              >
                {config.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
