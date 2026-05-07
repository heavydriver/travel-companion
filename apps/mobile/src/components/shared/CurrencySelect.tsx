import { ChevronDown } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { KeyboardAvoidingView, useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CurrencyFlagEmoji } from "@/lib/currencyFlag";
import { cn } from "@/lib/utils";

export type CurrencyOption = { code: string; name: string; country: string };

const SHEET_HEADER_HEIGHT = 124;
const SHEET_MAX_HEIGHT_RATIO = 0.72;
const LIST_MAX_HEIGHT_RATIO = 0.55;
const SHEET_VERTICAL_MARGIN = 28;

type CurrencySelectProps = {
  value: string;
  onChange: (code: string) => void;
  currencies: CurrencyOption[];
  triggerClassName?: string;
};

export function CurrencySelect({
  value,
  onChange,
  currencies,
  triggerClassName,
}: CurrencySelectProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const mutedFg = isDark ? "#94a3b8" : "#64748b";
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const keyboardHeight = useKeyboardState((state) => state.height);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return currencies;
    return currencies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase() === q,
    );
  }, [currencies, query]);

  const selected = useMemo(
    () => currencies.find((c) => c.code === value),
    [currencies, value],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const onPick = useCallback(
    (code: string) => {
      onChange(code);
      close();
    },
    [onChange, close],
  );

  const renderItem = useCallback(
    ({ item }: { item: CurrencyOption }) => {
      const active = item.code === value;
      return (
        <Pressable
          onPress={() => onPick(item.code)}
          className={cn(
            "flex-row items-center gap-3 border-b border-border px-4",
            active ? "bg-primary/10" : "bg-transparent",
          )}
          style={{ minHeight: 52 }}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          accessibilityLabel={`${item.code}, ${item.name}`}
        >
          <CurrencyFlagEmoji countryCode={item.country} />
          <View className="min-w-0 flex-1 py-2">
            <Text className="text-base font-semibold text-foreground">{item.code}</Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {item.name}
            </Text>
          </View>
        </Pressable>
      );
    },
    [onPick, value],
  );

  const keyExtractor = useCallback((item: CurrencyOption) => item.code, []);

  const sheetMaxHeight = useMemo(() => {
    const defaultMaxHeight = Math.round(windowHeight * SHEET_MAX_HEIGHT_RATIO);

    if (!keyboardVisible || keyboardHeight <= 0) {
      return defaultMaxHeight;
    }

    return Math.min(
      defaultMaxHeight,
      Math.max(0, windowHeight - keyboardHeight - insets.top - SHEET_VERTICAL_MARGIN),
    );
  }, [insets.top, keyboardHeight, keyboardVisible, windowHeight]);

  const listMaxHeight = useMemo(() => {
    const defaultMaxHeight = Math.round(windowHeight * LIST_MAX_HEIGHT_RATIO);
    const availableHeight = Math.max(
      0,
      sheetMaxHeight - SHEET_HEADER_HEIGHT - Math.max(insets.bottom, 12),
    );

    return Math.min(defaultMaxHeight, availableHeight);
  }, [insets.bottom, sheetMaxHeight, windowHeight]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className={cn(
          "h-[48px] flex-row items-center justify-between gap-1 rounded-xl border border-border bg-card px-2",
          triggerClassName,
        )}
        accessibilityRole="button"
        accessibilityLabel={`Select currency, ${value}`}
      >
        <View className="flex-row items-center gap-2">
          <CurrencyFlagEmoji countryCode={selected?.country ?? "ZZ"} />
          <Text className="text-base font-semibold text-foreground">{value}</Text>
        </View>
        <ChevronDown size={18} color={mutedFg} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={close}
        statusBarTranslucent
      >
        <View className="flex-1">
          <Pressable
            className="absolute inset-0 bg-black/50"
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close currency list"
          />
          <KeyboardAvoidingView behavior="padding" enabled={open} style={{ flex: 1 }}>
            <View className="flex-1 justify-end">
              <View
                className="rounded-t-2xl border-t border-border bg-card"
                style={{
                  paddingBottom: Math.max(insets.bottom, 12),
                  maxHeight: sheetMaxHeight,
                }}
              >
                <View className="border-b border-border px-4 pb-3 pt-3">
                  <Text className="text-center text-base font-semibold text-foreground">
                    Choose currency
                  </Text>
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search code or name"
                    placeholderTextColor={mutedFg}
                    className="mt-3 rounded-xl border border-border bg-background px-3 py-2.5 text-base text-foreground"
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                    returnKeyType="search"
                  />
                </View>
                <FlatList
                  data={filtered}
                  keyExtractor={keyExtractor}
                  renderItem={renderItem}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                  initialNumToRender={16}
                  maxToRenderPerBatch={24}
                  windowSize={8}
                  removeClippedSubviews={Platform.OS === "android"}
                  style={{ maxHeight: listMaxHeight }}
                  ListEmptyComponent={
                    <View className="items-center py-10">
                      <Text className="text-sm text-muted-foreground">No matches</Text>
                    </View>
                  }
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}
