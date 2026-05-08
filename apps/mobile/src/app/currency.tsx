import { useQuery } from "@tanstack/react-query";
import getSymbolFromCurrency from "currency-symbol-map";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowDownUp, ArrowLeft } from "lucide-react-native";
import { useColorScheme, useUnstableNativeVariable } from "nativewind";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useEden } from "@/api/client";
import { CurrencySelect } from "@/components/shared/CurrencySelect";
import { Screen } from "@/components/shared/Screen";
import { buildOfflineCurrencyTable, useOfflinePackQuery } from "@/features/offline/pack";
import { useNetworkStore } from "@/store/networkStore";

type SupportedCurrency = { code: string; name: string; country: string };

function extractRateTable(body: Record<string, unknown>, base: string): Record<string, number> {
  const inner = body[base.toLowerCase()];
  if (!inner || typeof inner !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(inner as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      out[k.toUpperCase()] = v;
    }
  }
  return out;
}

/** Upstream may send `date` as `YYYY-MM-DD`, ISO string, or (after parsing) a `Date`. */
function extractRatesDate(body: Record<string, unknown>): string | null {
  const d = body.date;
  if (typeof d === "string" && d.length > 0) {
    const day = d.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
    const t = Date.parse(d);
    if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
    return null;
  }
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  if (typeof d === "number" && Number.isFinite(d)) {
    const x = new Date(d);
    return Number.isNaN(x.getTime()) ? null : x.toISOString().slice(0, 10);
  }
  return null;
}

function formatRatesDate(isoDate: string): string {
  const day = isoDate.slice(0, 10);
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const TRIGGER_COL_CLASS = "w-[112px]";

export default function CurrencyConverterScreen() {
  const router = useRouter();
  const eden = useEden();
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const foreground = useUnstableNativeVariable("--foreground");
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const placeholderColor = mutedFg ? `hsl(${mutedFg})` : isDark ? "#94a3b8" : "#64748b";
  const iconColor = foreground ? `hsl(${foreground})` : isDark ? "#e2e8f0" : "#334155";
  const foregroundColor = foreground ? `hsl(${foreground})` : undefined;
  const isConnected = useNetworkStore((state) => state.isConnected);

  const params = useLocalSearchParams<{ base?: string; quote?: string; destinationId?: string }>();
  const destinationId =
    typeof params.destinationId === "string" && params.destinationId.length > 0
      ? params.destinationId
      : null;
  const offlinePackQuery = useOfflinePackQuery(destinationId);
  const offlineCurrency = offlinePackQuery.data?.currency ?? null;

  const initialBase = (params.base ?? "USD").toUpperCase();
  const hasBaseParam = typeof params.base === "string" && params.base.length > 0;
  const initialQuote = (params.quote ?? (hasBaseParam ? "USD" : "EUR")).toUpperCase();

  const [baseCode, setBaseCode] = useState(initialBase);
  const [quoteCode, setQuoteCode] = useState(initialQuote);
  const [baseInput, setBaseInput] = useState("100");
  const [quoteInput, setQuoteInput] = useState("");
  const lastEdited = useRef<"base" | "quote">("base");
  const baseInputRef = useRef(baseInput);
  const quoteInputRef = useRef(quoteInput);
  baseInputRef.current = baseInput;
  quoteInputRef.current = quoteInput;

  useEffect(() => {
    setBaseCode(initialBase);
    setQuoteCode(initialQuote);
  }, [initialBase, initialQuote]);

  const supportedQuery = useQuery({
    ...eden.api.v1.currency.supported.get.queryOptions(),
    enabled: isConnected,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const currencies = (offlineCurrency?.supported ??
    supportedQuery.data?.currencies ??
    []) as SupportedCurrency[];
  const baseSupported = currencies.some((c) => c.code === baseCode);

  const ratesQuery = useQuery({
    ...eden.api.v1.currency.rates({ base: baseCode }).get.queryOptions(),
    enabled: baseSupported && currencies.length > 0 && isConnected,
    staleTime: 60 * 60 * 1000,
  });

  const ratesBody = ratesQuery.data as Record<string, unknown> | undefined;
  const rates = useMemo(
    () =>
      isConnected && ratesBody
        ? extractRateTable(ratesBody, baseCode)
        : offlineCurrency
          ? buildOfflineCurrencyTable(offlinePackQuery.data, baseCode)
          : {},
    [isConnected, offlineCurrency, offlinePackQuery.data, ratesBody, baseCode],
  );
  const rateDateRaw =
    isConnected && ratesBody
      ? extractRatesDate(ratesBody)
      : (offlineCurrency?.fetchedAt.slice(0, 10) ?? null);

  const rate = rates[quoteCode] ?? 0;

  const byCode = useMemo(() => {
    const m = new Map<string, SupportedCurrency>();
    for (const c of currencies) m.set(c.code, c);
    return m;
  }, [currencies]);

  const baseMeta = byCode.get(baseCode);
  const quoteMeta = byCode.get(quoteCode);

  const onBaseChange = (raw: string) => {
    lastEdited.current = "base";
    setBaseInput(raw);
    const n = Number.parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(n) || rate <= 0) {
      setQuoteInput("");
      return;
    }
    setQuoteInput((n * rate).toFixed(2));
  };

  const onQuoteChange = (raw: string) => {
    lastEdited.current = "quote";
    setQuoteInput(raw);
    const n = Number.parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(n) || rate <= 0) {
      setBaseInput("");
      return;
    }
    setBaseInput((n / rate).toFixed(4));
  };

  useEffect(() => {
    if (lastEdited.current === "base") {
      const n = Number.parseFloat(baseInputRef.current.replace(",", "."));
      if (!Number.isFinite(n) || rate <= 0) return;
      setQuoteInput((n * rate).toFixed(2));
    } else {
      const n = Number.parseFloat(quoteInputRef.current.replace(",", "."));
      if (!Number.isFinite(n) || rate <= 0) return;
      setBaseInput((n / rate).toFixed(4));
    }
  }, [rate]);

  const swapCurrencies = () => {
    setBaseCode(quoteCode);
    setQuoteCode(baseCode);
    setBaseInput(quoteInput);
    setQuoteInput(baseInput);
    lastEdited.current = "base";
  };

  return (
    <Screen scrollable contentClassName="pb-8">
      <View className="gap-6">
        <View className="mb-2 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-card active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color={foregroundColor} />
          </Pressable>
          <Text className="text-2xl font-bold text-foreground">Currency Converter</Text>
          <View className="h-10 w-10" />
        </View>

        {(supportedQuery.isLoading && isConnected && !offlineCurrency) ||
        (!isConnected && offlinePackQuery.isLoading) ? (
          <View className="items-center py-12">
            <ActivityIndicator size="large" />
            <Text className="mt-3 text-sm text-muted-foreground">
              {isConnected ? "Loading currencies…" : "Loading offline currency data…"}
            </Text>
          </View>
        ) : supportedQuery.isError && !offlineCurrency ? (
          <View className="rounded-2xl border border-border bg-card px-4 py-4">
            <Text className="text-sm text-destructive">Could not load currencies.</Text>
          </View>
        ) : (
          <View className="gap-2">
            <View className="gap-1">
              <Text className="text-sm font-medium text-muted-foreground">Base currency</Text>
              <View className="flex-row items-stretch gap-3">
                <View className={TRIGGER_COL_CLASS}>
                  <CurrencySelect value={baseCode} onChange={setBaseCode} currencies={currencies} />
                </View>
                <TextInput
                  value={baseInput}
                  onChangeText={onBaseChange}
                  keyboardType="decimal-pad"
                  className="min-h-[48px] flex-1 rounded-xl border border-border bg-card px-4 py-3 text-xl font-semibold tabular-nums text-foreground"
                  placeholder="0"
                  placeholderTextColor={placeholderColor}
                />
              </View>
              {baseMeta ? (
                <Text className="text-xs font-semibold text-primary" numberOfLines={2}>
                  {baseMeta.name} ({getSymbolFromCurrency(baseCode)})
                </Text>
              ) : null}
            </View>

            <View className="items-center">
              <Pressable
                onPress={swapCurrencies}
                accessibilityRole="button"
                accessibilityLabel="Swap base and quote currency"
                className="h-10 w-10 items-center justify-center rounded-full border border-border bg-muted active:opacity-80"
              >
                <ArrowDownUp size={18} color={iconColor} />
              </Pressable>
            </View>

            <View className="gap-1">
              <Text className="text-sm font-medium text-muted-foreground">Convert to</Text>
              <View className="flex-row items-stretch gap-3">
                <View className={TRIGGER_COL_CLASS}>
                  <CurrencySelect
                    value={quoteCode}
                    onChange={setQuoteCode}
                    currencies={currencies}
                  />
                </View>
                <TextInput
                  value={quoteInput}
                  onChangeText={onQuoteChange}
                  keyboardType="decimal-pad"
                  className="min-h-[48px] flex-1 rounded-xl border border-border bg-card px-4 py-3 text-xl font-semibold tabular-nums text-foreground"
                  placeholder="0"
                  placeholderTextColor={placeholderColor}
                />
              </View>
              {quoteMeta ? (
                <Text className="text-xs font-semibold text-primary" numberOfLines={2}>
                  {quoteMeta.name} ({getSymbolFromCurrency(quoteCode)})
                </Text>
              ) : null}
            </View>

            <View className="px-4 py-8">
              {ratesQuery.isFetching ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" />
                  <Text className="text-sm text-muted-foreground">Updating rate…</Text>
                </View>
              ) : rate > 0 ? (
                <>
                  <Text className="text-center text-md font-semibold text-foreground">
                    1 {baseCode} = {rate.toFixed(4)} {quoteCode}
                  </Text>
                  <Text className="mt-2 text-center text-sm text-muted-foreground">
                    {rateDateRaw
                      ? `As of ${formatRatesDate(rateDateRaw)}`
                      : "As of date unavailable"}
                  </Text>
                </>
              ) : (
                <Text className="text-center text-sm text-destructive">
                  No rate for this pair. Choose another currency.
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}
