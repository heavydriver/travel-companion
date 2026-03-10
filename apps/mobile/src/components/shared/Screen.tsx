import type { PropsWithChildren } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";

type ScreenProps = PropsWithChildren<{
  scrollable?: boolean;
  className?: string;
  contentClassName?: string;
}>;

export function Screen({ children, scrollable = false, className, contentClassName }: ScreenProps) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} className={cn("flex-1 bg-background", className)}>
      {scrollable ? (
        <ScrollView contentContainerClassName={cn("flex-grow px-5 pt-6 pb-5", contentClassName)}>
          {children}
        </ScrollView>
      ) : (
        <View className={cn("flex-1 px-5 pt-6 pb-5", contentClassName)}>{children}</View>
      )}
    </SafeAreaView>
  );
}
