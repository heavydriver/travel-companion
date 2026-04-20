import { AlertTriangle, CheckCircle2, Info, Trash2, XCircle } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import type { ComponentType } from "react";
import { Pressable, Text, View } from "react-native";
import type { ToastConfig } from "react-native-toast-message";
import Toast from "react-native-toast-message";
import { cn } from "@/lib/utils";

export type AppToastVariant =
  | "success"
  | "error"
  | "warning"
  | "destructive"
  | "info"
  /** Neutral in-app message (same look as `info`). */
  | "message";

type ToastRenderProps = {
  text1?: string;
  text2?: string;
  onPress?: () => void;
};

type IconProps = { size?: number; color?: string; strokeWidth?: number };

type VariantMeta = {
  Icon: ComponentType<IconProps>;
  iconColor: string;
  ringClass: string;
  borderAccentClass: string;
};

function useVariantMeta(variant: AppToastVariant): VariantMeta {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const tone: Exclude<AppToastVariant, "message"> = variant === "message" ? "info" : variant;

  const c = (light: string, dark: string) => (isDark ? dark : light);

  switch (tone) {
    case "success":
      return {
        Icon: CheckCircle2,
        iconColor: c("#059669", "#34d399"),
        ringClass: "bg-emerald-500/15",
        borderAccentClass: "border-l-emerald-500",
      };
    case "error":
      return {
        Icon: XCircle,
        iconColor: c("#dc2626", "#f87171"),
        ringClass: "bg-red-500/15",
        borderAccentClass: "border-l-red-500",
      };
    case "destructive":
      return {
        Icon: Trash2,
        iconColor: c("#e11d48", "#fb7185"),
        ringClass: "bg-rose-500/15",
        borderAccentClass: "border-l-rose-600",
      };
    case "warning":
      return {
        Icon: AlertTriangle,
        iconColor: c("#d97706", "#fbbf24"),
        ringClass: "bg-amber-500/15",
        borderAccentClass: "border-l-amber-500",
      };
    case "info":
      return {
        Icon: Info,
        iconColor: c("#2563eb", "#60a5fa"),
        ringClass: "bg-blue-500/15",
        borderAccentClass: "border-l-blue-500",
      };
  }
}

/**
 * Shadcn-style toast: icon (left), bold title + body (right). Used via {@link appToastConfig}.
 */
export function AppToastLayout({
  variant,
  text1,
  text2,
  onPress,
}: ToastRenderProps & { variant: AppToastVariant }) {
  const { Icon, iconColor, ringClass, borderAccentClass } = useVariantMeta(variant);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={cn(
        "mx-auto w-[92%] max-w-md flex-row items-start gap-3 rounded-xl border border-border bg-card py-3.5 pl-3 pr-3.5 shadow-lg",
        "border-l-4",
        borderAccentClass,
      )}
    >
      <View className={cn("shrink-0 rounded-full p-2", ringClass)}>
        <Icon size={22} color={iconColor} strokeWidth={2.25} />
      </View>
      <View className="min-w-0 flex-1 pt-0.5">
        {text1 ? (
          <Text className="text-base font-semibold leading-snug text-foreground" numberOfLines={4}>
            {text1}
          </Text>
        ) : null}
        {text2 ? (
          <Text
            className="mt-1 text-sm font-normal leading-5 text-muted-foreground"
            numberOfLines={6}
          >
            {text2}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Pass to `<Toast config={appToastConfig} />` ([custom layouts](https://github.com/calintamas/react-native-toast-message/blob/main/docs/custom-layouts.md)). */
export const appToastConfig: ToastConfig = {
  success: (props) => <AppToastLayout variant="success" {...props} />,
  error: (props) => <AppToastLayout variant="error" {...props} />,
  warning: (props) => <AppToastLayout variant="warning" {...props} />,
  destructive: (props) => <AppToastLayout variant="destructive" {...props} />,
  info: (props) => <AppToastLayout variant="info" {...props} />,
  message: (props) => <AppToastLayout variant="message" {...props} />,
};

type ShowAppToastParams = {
  variant: AppToastVariant;
  title: string;
  message?: string;
} & Partial<Omit<NonNullable<Parameters<typeof Toast.show>[0]>, "type" | "text1" | "text2">>;

/** Typed helper around `Toast.show` using {@link appToastConfig} variants. */
export function showAppToast({
  variant,
  title,
  message: body,
  visibilityTime = 2000,
  position = "top",
  ...rest
}: ShowAppToastParams) {
  Toast.show({
    type: variant,
    text1: title,
    text2: body,
    visibilityTime,
    position,
    ...rest,
  });
}
