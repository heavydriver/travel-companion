import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CloudRain, Navigation2, Sunrise, Sunset } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { client } from "@/api/client";
import { wmoIconForCode } from "@/features/weather/wmoIcon";
import { usePreferencesStore } from "@/store/preferencesStore";

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

type OpenMeteoDaily = {
  time?: unknown[];
  sunrise?: unknown[];
  sunset?: unknown[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_probability_max?: number[];
  wind_speed_10m_max?: number[];
  wind_direction_10m_dominant?: number[];
};

type OpenMeteoPayload = {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    precipitation?: number;
    is_day?: number;
  };
  daily?: OpenMeteoDaily;
};

type SelectedDayData = {
  index: number;
  time: unknown;
  weatherCode: number;
  tMax?: number;
  tMin?: number;
  rainChance?: number;
  windSpeed?: number;
  windDirection?: number;
  sunrise?: unknown;
  sunset?: unknown;
};

function cToF(c: number) {
  return (c * 9) / 5 + 32;
}

function kmhToMph(kmh: number) {
  return kmh * 0.621371;
}

function mmToInches(mm: number) {
  return mm * 0.0393701;
}

function parseDate(raw: unknown): Date | null {
  if (typeof raw === "string" || typeof raw === "number") {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Normalize `daily.time` from API / client (array, array-like object, or single string). */
function normalizeDailyTimeList(time: unknown): unknown[] {
  if (Array.isArray(time)) return time;
  if (time == null) return [];
  if (typeof time === "string") return [time];
  if (typeof time === "object") {
    const o = time as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => /^\d+$/.test(k));
    if (keys.length > 0) {
      return keys.sort((a, b) => Number(a) - Number(b)).map((k) => o[k]);
    }
  }
  return [];
}

/** One cell from `daily.time`: unwrap `{ date }` / `{ time }` / Date / unix ms. */
function unwrapDailyTimeCell(cell: unknown): unknown {
  if (cell == null) return null;
  if (typeof cell === "string" || typeof cell === "number" || cell instanceof Date) return cell;
  if (typeof cell === "object" && !Array.isArray(cell)) {
    const o = cell as Record<string, unknown>;
    for (const key of ["date", "time", "day", "value"] as const) {
      const v = o[key];
      if (typeof v === "string" || typeof v === "number" || v instanceof Date) return v;
    }
  }
  return cell;
}

/** First calendar day in `daily.time` (often `YYYY-MM-DD`, sometimes ISO with time). */
function extractYmdParts(raw: unknown): { y: number; mo: number; d: number } | null {
  if (raw == null) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return { y: raw.getFullYear(), mo: raw.getMonth() + 1, d: raw.getDate() };
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const dt = new Date(ms);
    if (Number.isNaN(dt.getTime())) return null;
    return { y: dt.getFullYear(), mo: dt.getMonth() + 1, d: dt.getDate() };
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const key of ["date", "time", "day", "value"] as const) {
      const v = o[key];
      if (typeof v === "string") {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
        if (m) {
          const y = Number(m[1]);
          const mo = Number(m[2]);
          const d = Number(m[3]);
          if (Number.isFinite(y) && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { y, mo, d };
        }
      }
      if (typeof v === "number" && Number.isFinite(v)) {
        const p = extractYmdParts(v);
        if (p) return p;
      }
      if (v instanceof Date && !Number.isNaN(v.getTime())) {
        return { y: v.getFullYear(), mo: v.getMonth() + 1, d: v.getDate() };
      }
    }
    return null;
  }
  let s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, mo, d };
}

/** Local calendar `Date` at noon (avoids DST midnight quirks). Not for UTC `YYYY-MM-DD` string via `Date.parse`. */
function parseDailyTimeString(raw: unknown): Date | null {
  const parts = extractYmdParts(raw);
  if (!parts) return parseDate(raw);
  const dt = new Date(parts.y, parts.mo - 1, parts.d, 12, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** e.g. `2026-04-15` -> `April 15` (month/day only, from string; no timezone shift). */
function monthDayFromDailyTime(raw: unknown): string | null {
  const p = extractYmdParts(raw);
  if (!p) return null;
  return `${EN_MONTHS[p.mo - 1]} ${p.d}`;
}

function isSameDeviceDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(raw: unknown, index: number): string {
  const cell = unwrapDailyTimeCell(raw);
  const monthDay = monthDayFromDailyTime(cell);
  const d = parseDailyTimeString(cell);
  if (monthDay && d) return `${WEEKDAY_FORMATTER.format(d)} ${monthDay}`;
  if (typeof cell === "string" && cell.trim().length > 0) return cell.trim();
  return `Day ${index + 1}`;
}

function formatClock(raw: unknown) {
  const d = parseDate(raw);
  if (!d) return "--";
  return TIME_FORMATTER.format(d);
}

function formatDirection(deg?: number) {
  if (deg == null || !Number.isFinite(deg)) return "--";
  const normalized = ((deg % 360) + 360) % 360;
  const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(normalized / 45) % 8;
  return `${compass[idx]} ${Math.round(normalized)}°`;
}

function WindDirectionValue({ degrees }: { degrees?: number }) {
  if (degrees == null || !Number.isFinite(degrees)) {
    return <Text className="text-sm font-semibold text-foreground">--</Text>;
  }
  const normalized = ((degrees % 360) + 360) % 360;
  return (
    <View className="flex-row items-center gap-2">
      {/*
        Lucide SVG pivot ≠ layout center when rotate is on the icon alone.
        Rotate a fixed square wrapper so origin is true box center; ArrowUp is vertically symmetric (unlike Navigation/MoveUp).
      */}
      <View className="h-8 w-8 shrink-0 items-center justify-center">
        <View
          className="items-center justify-center"
          style={{
            width: 24,
            height: 24,
            transform: [{ rotate: `${normalized}deg` }],
          }}
        >
          <Navigation2 size={16} color="#3B82F6" />
        </View>
      </View>
      <Text className="flex-1 text-sm font-semibold text-foreground">
        {formatDirection(normalized)}
      </Text>
    </View>
  );
}

function DetailStat({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <View className="min-w-[47%] flex-1 rounded-2xl bg-muted/60 px-3 py-2">
      <View className="flex-row items-center gap-1.5">
        {icon}
        <Text className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Text>
      </View>
      <View className="mt-1">
        {typeof value === "string" ? (
          <Text className="text-sm font-semibold text-foreground">{value}</Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

function WeatherMainCard({
  title,
  subtitle,
  iconColor,
  weatherCode,
  mainTempText,
  feelsLikeText,
  statWindSpeed,
  statWindDirection,
  statRain,
  statSunrise,
  statSunset,
}: {
  title: string;
  subtitle: string;
  iconColor: string;
  weatherCode: number;
  mainTempText: string;
  /** Shown under main temp, smaller — use for current conditions “feels like” only. */
  feelsLikeText?: string | null;
  statWindSpeed: string;
  statWindDirection: ReactNode;
  statRain: string;
  statSunrise: string;
  statSunset: string;
}) {
  const Icon = wmoIconForCode(weatherCode);
  return (
    <View className="mx-4 rounded-3xl border border-border bg-card p-5">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-xs uppercase tracking-wide text-muted-foreground">{subtitle}</Text>
          <Text className="mt-1 text-lg font-semibold text-foreground">{title}</Text>
          <Text className="mt-2 text-4xl font-bold text-foreground">{mainTempText}</Text>
          {feelsLikeText ? (
            <Text className="mt-1 text-sm text-muted-foreground">{feelsLikeText}</Text>
          ) : null}
        </View>
        <Icon size={56} color={iconColor} />
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <DetailStat label="Wind Speed" value={statWindSpeed} />
        <DetailStat label="Wind Direction" value={statWindDirection} />
      </View>

      <View className="mt-2 flex-row items-center gap-3 rounded-2xl bg-muted/60 px-3 py-3">
        <CloudRain size={20} color="#3B82F6" />
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rain
        </Text>
        <Text className="flex-1 text-right text-sm font-semibold text-foreground">{statRain}</Text>
      </View>

      <View className="mt-2 flex-row gap-2">
        <View className="flex-1 rounded-2xl bg-muted/60 px-3 py-2">
          <View className="flex-row items-center gap-2">
            <Sunrise size={16} color="#F59E0B" />
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sunrise
            </Text>
          </View>
          <Text className="mt-1 text-sm font-semibold text-foreground">{statSunrise}</Text>
        </View>
        <View className="flex-1 rounded-2xl bg-muted/60 px-3 py-2">
          <View className="flex-row items-center gap-2">
            <Sunset size={16} color="#A855F7" />
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sunset
            </Text>
          </View>
          <Text className="mt-1 text-sm font-semibold text-foreground">{statSunset}</Text>
        </View>
      </View>
    </View>
  );
}

export default function WeatherScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    lat?: string;
    lng?: string;
    timezone?: string;
    name?: string;
    days?: string;
  }>();

  const lat = Number(params.lat);
  const lng = Number(params.lng);
  const timezone = typeof params.timezone === "string" ? params.timezone : "auto";
  const label = typeof params.name === "string" ? params.name : "Weather";
  const forecastDays = Math.min(16, Math.max(1, Number(params.days) || 7));

  const unitSystem = usePreferencesStore((s) => s.unitSystem);
  /** `null` = main card shows current conditions (when API has current + today in daily). Else daily index. Tap same card again toggles back to current. */
  const [focusedDayIndex, setFocusedDayIndex] = useState<number | null>(null);

  const foreground = useUnstableNativeVariable("--foreground");
  const foregroundColor = foreground ? `hsl(${foreground})` : "#111827";
  const primary = useUnstableNativeVariable("--primary");
  const primaryColor = primary ? `hsl(${primary})` : "#3B82F6";

  const query = useQuery({
    queryKey: ["weather-forecast", lat, lng, timezone, forecastDays],
    queryFn: async () => {
      const res = await client.api.v1.weather.forecast.get({
        query: {
          latitude: lat,
          longitude: lng,
          forecastDays,
          timezone,
        },
      });
      if (res.error) throw new Error("Failed to load weather");
      return res.data as OpenMeteoPayload;
    },
    enabled: Number.isFinite(lat) && Number.isFinite(lng),
    staleTime: 10 * 60 * 1000,
  });

  const isMetric = unitSystem === "metric";
  const current = query.data?.current;
  const daily = query.data?.daily;
  const dailyTimes = useMemo(() => normalizeDailyTimeList(daily?.time), [daily?.time]);
  const now = new Date();

  const todayDailyIndex = useMemo(
    () =>
      dailyTimes.findIndex((timeRaw) => {
        const d = parseDailyTimeString(unwrapDailyTimeCell(timeRaw));
        return d ? isSameDeviceDate(d, now) : false;
      }),
    [dailyTimes, now],
  );

  const fallbackDailyIndex = todayDailyIndex >= 0 ? todayDailyIndex : 0;

  /** Daily row whose calendar date matches `current.time` (e.g. `2026-04-15T07:00`), else today on device, else 0. */
  const currentDailyIndex = useMemo(() => {
    if (!dailyTimes.length) return -1;
    const fromCurrent = extractYmdParts(current?.time);
    if (fromCurrent) {
      const idx = dailyTimes.findIndex((timeRaw) => {
        const tp = extractYmdParts(unwrapDailyTimeCell(timeRaw));
        return (
          tp != null && tp.y === fromCurrent.y && tp.mo === fromCurrent.mo && tp.d === fromCurrent.d
        );
      });
      if (idx >= 0) return idx;
    }
    if (todayDailyIndex >= 0) return todayDailyIndex;
    return 0;
  }, [dailyTimes, current?.time, todayDailyIndex]);

  /** `null` focused index => show live `current` block when API sends it (default). */
  const showCurrentInMain = focusedDayIndex === null && current != null;

  const mainDailyIndex =
    focusedDayIndex != null
      ? focusedDayIndex
      : showCurrentInMain
        ? dailyTimes.length === 0
          ? -1
          : currentDailyIndex >= 0
            ? currentDailyIndex
            : 0
        : dailyTimes.length
          ? fallbackDailyIndex
          : -1;

  const selectedDay: SelectedDayData | null = useMemo(() => {
    if (!daily || mainDailyIndex < 0 || mainDailyIndex >= dailyTimes.length) return null;
    return {
      index: mainDailyIndex,
      time: dailyTimes[mainDailyIndex],
      weatherCode: daily.weather_code?.[mainDailyIndex] ?? 0,
      tMax: daily.temperature_2m_max?.[mainDailyIndex],
      tMin: daily.temperature_2m_min?.[mainDailyIndex],
      rainChance: daily.precipitation_probability_max?.[mainDailyIndex],
      windSpeed: daily.wind_speed_10m_max?.[mainDailyIndex],
      windDirection: daily.wind_direction_10m_dominant?.[mainDailyIndex],
      sunrise: daily.sunrise?.[mainDailyIndex],
      sunset: daily.sunset?.[mainDailyIndex],
    };
  }, [daily, dailyTimes, mainDailyIndex]);

  const highlightDayIndex =
    focusedDayIndex != null
      ? focusedDayIndex
      : showCurrentInMain && currentDailyIndex >= 0
        ? currentDailyIndex
        : todayDailyIndex >= 0
          ? todayDailyIndex
          : 0;

  const formatTemp = (c?: number) => {
    if (c == null || !Number.isFinite(c)) return "--";
    const value = isMetric ? c : cToF(c);
    return `${value.toFixed(0)}°${isMetric ? "C" : "F"}`;
  };

  const formatWind = (kmh?: number) => {
    if (kmh == null || !Number.isFinite(kmh)) return "--";
    const value = isMetric ? kmh : kmhToMph(kmh);
    return `${value.toFixed(0)} ${isMetric ? "km/h" : "mph"}`;
  };

  const formatPrecip = (mm?: number) => {
    if (mm == null || !Number.isFinite(mm)) return "--";
    const value = isMetric ? mm : mmToInches(mm);
    return `${value.toFixed(isMetric ? 1 : 2)} ${isMetric ? "mm" : "in"}`;
  };

  const mainIconColor = showCurrentInMain && current?.is_day ? "#F59E0B" : primaryColor;

  useEffect(() => {
    if (focusedDayIndex != null && focusedDayIndex >= dailyTimes.length) {
      setFocusedDayIndex(null);
    }
  }, [dailyTimes.length, focusedDayIndex]);

  const onDailyCardPress = (index: number) => {
    setFocusedDayIndex((prev) => (prev === index ? null : index));
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-card active:opacity-80"
        >
          <ArrowLeft size={20} color={foregroundColor} />
        </Pressable>
        <Text className="flex-1 text-center text-lg font-bold text-foreground" numberOfLines={1}>
          {label}
        </Text>
        <View className="w-10" />
      </View>

      <View className="border-b border-border px-4 py-2">
        <Text className="text-xs text-muted-foreground">
          Units follow{" "}
          <Text className="font-semibold text-foreground">Settings → Units</Text> (
          {unitSystem === "metric" ? "metric" : "imperial"}).
        </Text>
      </View>

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : query.isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-muted-foreground">Could not load weather.</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-10 pt-4">
          {showCurrentInMain && current && selectedDay ? (
            <WeatherMainCard
              title={dayLabel(current.time ?? selectedDay.time, selectedDay.index)}
              subtitle={current.is_day ? "Current Conditions - Day" : "Current Conditions - Night"}
              iconColor={mainIconColor}
              weatherCode={current.weather_code ?? selectedDay.weatherCode}
              mainTempText={formatTemp(current.temperature_2m)}
              feelsLikeText={
                current.apparent_temperature != null
                  ? `Feels like ${formatTemp(current.apparent_temperature)}`
                  : null
              }
              statWindSpeed={formatWind(current.wind_speed_10m)}
              statWindDirection={<WindDirectionValue degrees={current.wind_direction_10m} />}
              statRain={formatPrecip(current.precipitation)}
              statSunrise={formatClock(selectedDay.sunrise)}
              statSunset={formatClock(selectedDay.sunset)}
            />
          ) : showCurrentInMain && current && !selectedDay ? (
            <WeatherMainCard
              title={dayLabel(current.time ?? "", 0)}
              subtitle={current.is_day ? "Current Conditions - Day" : "Current Conditions - Night"}
              iconColor={mainIconColor}
              weatherCode={current.weather_code ?? 0}
              mainTempText={formatTemp(current.temperature_2m)}
              feelsLikeText={
                current.apparent_temperature != null
                  ? `Feels like ${formatTemp(current.apparent_temperature)}`
                  : null
              }
              statWindSpeed={formatWind(current.wind_speed_10m)}
              statWindDirection={<WindDirectionValue degrees={current.wind_direction_10m} />}
              statRain={formatPrecip(current.precipitation)}
              statSunrise="--"
              statSunset="--"
            />
          ) : selectedDay ? (
            <WeatherMainCard
              title={dayLabel(unwrapDailyTimeCell(selectedDay.time), selectedDay.index)}
              subtitle="Forecast Conditions"
              iconColor={mainIconColor}
              weatherCode={selectedDay.weatherCode}
              mainTempText={`${formatTemp(selectedDay.tMax)} / ${formatTemp(selectedDay.tMin)}`}
              statWindSpeed={formatWind(selectedDay.windSpeed)}
              statWindDirection={<WindDirectionValue degrees={selectedDay.windDirection} />}
              statRain={
                selectedDay.rainChance != null
                  ? `${Math.round(selectedDay.rainChance)}% chance`
                  : "--"
              }
              statSunrise={formatClock(selectedDay.sunrise)}
              statSunset={formatClock(selectedDay.sunset)}
            />
          ) : null}

          <View className="px-4">
            <Text className="mb-2 text-lg font-bold text-foreground">Daily Forecast</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3 px-4 pb-1"
          >
            {dailyTimes.map((timeRaw, index) => {
              if (!daily) return null;
              const cell = unwrapDailyTimeCell(timeRaw);
              const dateText = dayLabel(cell, index);
              const active = highlightDayIndex === index;
              const Icon = wmoIconForCode(daily.weather_code?.[index] ?? 0);
              const high = formatTemp(daily.temperature_2m_max?.[index]);
              const low = formatTemp(daily.temperature_2m_min?.[index]);
              const pop = daily.precipitation_probability_max?.[index];
              const pk = extractYmdParts(cell);
              const rowKey = pk
                ? `d-${pk.y}-${String(pk.mo).padStart(2, "0")}-${String(pk.d).padStart(2, "0")}`
                : `d-slot-${String(cell)}`;

              return (
                <Pressable
                  key={rowKey}
                  onPress={() => onDailyCardPress(index)}
                  className={`w-36 rounded-2xl border p-2.5 active:opacity-85 ${
                    active ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <Text
                    className="text-xs text-center font-semibold leading-tight text-foreground"
                    numberOfLines={2}
                  >
                    {dateText}
                  </Text>
                  <View className="my-2 items-center">
                    <Icon size={28} color={active ? primaryColor : "#3B82F6"} />
                  </View>
                  <Text className="text-center text-sm font-bold text-foreground">
                    {high} / {low}
                  </Text>
                  <View className="mt-1 flex-row items-center justify-center gap-1">
                    <CloudRain size={13} color="#3B82F6" />
                    <Text className="text-xs text-muted-foreground">
                      {pop != null ? `${Math.round(pop)}%` : "--"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
