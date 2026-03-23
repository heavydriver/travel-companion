import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  Bed,
  CheckCircle2,
  Clock,
  HelpCircle,
  Languages,
  RefreshCw,
  Search,
  Sun,
  Ticket,
  User,
  UtensilsCrossed,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { Pressable, Text, View } from "react-native";
import { Screen } from "@/components/shared/Screen";
import { useAuthStore } from "@/store/authStore";

const QUICK_TOOLS = [
  { label: "Tickets", icon: Ticket },
  { label: "Translate", icon: Languages },
  { label: "Convert", icon: RefreshCw },
  { label: "Food", icon: UtensilsCrossed },
  { label: "Help", icon: HelpCircle },
  { label: "Stay", icon: Bed },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const foreground = useUnstableNativeVariable("--foreground");
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const iconColor = foreground ? `hsl(${foreground})` : undefined;
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : undefined;

  const displayName = user?.name?.split(" ")[0] ?? "there";

  return (
    <Screen scrollable contentClassName="pb-2">
      <View className="gap-6">
        {/* Header */}
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Hello, {displayName}!</Text>
            <View className="mt-1 flex-row items-center gap-1.5">
              <CheckCircle2 size={14} color="#22C55E" />
              <Text className="text-sm text-muted-foreground">Offline Mode Ready</Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-card active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <Search size={20} color={iconColor} />
            </Pressable>
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              <User size={20} color={iconColor} />
            </Pressable>
          </View>
        </View>

        {/* Current Trip Card */}
        <View className="overflow-hidden rounded-2xl bg-card">
          <View className="relative h-44 overflow-hidden">
            <Image
              source="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800"
              className="h-full w-full"
              contentFit="cover"
            />
            <View className="absolute inset-0 bg-black/50" />
            <View className="absolute left-0 right-0 top-0 h-1 bg-muted">
              <View className="h-full rounded-full bg-primary" style={{ width: "25%" }} />
            </View>
            <View className="absolute inset-0 p-4" style={{ justifyContent: "space-between" }}>
              <View className="flex-row items-start justify-between">
                <View className="rounded-full bg-primary px-2.5 py-1">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                    Current Trip
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push("/(tabs)/itinerary" as never)}
                  className="flex-row items-center gap-1 rounded-lg bg-primary px-3 py-2 active:opacity-90"
                >
                  <Text className="text-sm font-semibold text-primary-foreground">Itinerary</Text>
                  <ArrowRight size={16} color="white" />
                </Pressable>
              </View>
              <View>
                <Text className="text-2xl font-bold text-white">Tokyo, Japan</Text>
                <Text className="mt-0.5 text-sm text-white/90">Oct 12 – Oct 20</Text>
                <Text className="text-xs text-white/80">Day 3 of 8</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Local Time & Weather */}
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-border bg-card p-4">
            <View className="flex-row items-center gap-1.5">
              <Clock size={14} color={mutedColor} />
              <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Local Time
              </Text>
            </View>
            <View className="mt-2 flex-row items-baseline gap-2">
              <Text className="text-2xl font-bold text-foreground">14:30</Text>
              <Text className="text-sm text-foreground">JST</Text>
            </View>
            <Text className="mt-1 text-xs text-chart-2 text-foreground">+0h from device</Text>
          </View>
          <View className="flex-1 rounded-2xl border border-border bg-card p-4">
            <View className="flex-row items-center gap-1.5">
              <Sun size={14} color={mutedColor} />
              <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Weather
              </Text>
            </View>
            <View className="mt-2 flex-row items-baseline gap-2">
              <Text className="text-2xl font-bold text-foreground">22°C</Text>
              <Text className="text-sm text-foreground">Clear</Text>
            </View>
            <Text className="mt-1 text-xs text-foreground">H: 24° L: 18°</Text>
          </View>
        </View>

        {/* Quick Tools */}
        <View>
          <Text className="mb-3 text-base font-semibold text-foreground">Quick Tools</Text>
          <View className="flex-row flex-wrap gap-3">
            {QUICK_TOOLS.map(({ label, icon: Icon }) => (
              <Pressable
                key={label}
                onPress={() => {
                  if (label === "Translate") {
                    router.push("/language-guide" as never);
                  }
                }}
                className="h-20 w-[31%] items-center justify-center rounded-2xl border border-border bg-card active:opacity-90"
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Icon size={24} color={iconColor} />
                <Text className="mt-2 text-xs font-medium text-foreground">{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Nearby Navigation */}
        <View>
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">Nearby Navigation</Text>
            <Pressable
              onPress={() => {}}
              className="active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="Open Maps"
            >
              <Text className="text-sm font-medium text-primary">Open Maps</Text>
            </Pressable>
          </View>
          <View className="overflow-hidden rounded-2xl border border-border bg-card">
            <View className="aspect-[2/1] items-center justify-center bg-[hsl(175_40%_25%)]">
              <View className="absolute h-12 w-12 items-center justify-center rounded-full border-2 border-primary bg-primary/30">
                <View className="h-2 w-2 rounded-full bg-primary" />
              </View>
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}
