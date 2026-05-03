import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";

type ScreenProps = PropsWithChildren<{
  scrollable?: boolean;
  className?: string;
  contentClassName?: string;
  keyboardBottomOffset?: number;
}>;

export function Screen({
  children,
  scrollable = false,
  className,
  contentClassName,
  keyboardBottomOffset = 62,
}: ScreenProps) {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className={cn("flex-1 bg-background", className)}
    >
      {scrollable ? (
        <KeyboardAwareScrollView
          bottomOffset={keyboardBottomOffset}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName={cn("flex-grow px-5 pt-6 pb-5", contentClassName)}
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <View className={cn("flex-1 px-5 pt-6 pb-5", contentClassName)}>{children}</View>
      )}
    </SafeAreaView>
  );
}
