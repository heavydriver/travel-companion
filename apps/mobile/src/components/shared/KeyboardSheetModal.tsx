import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Modal, Pressable, Text, View } from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type KeyboardSheetModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  minHeight: number;
  maxHeight: number;
  children: ReactNode;
  footer?: ReactNode;
  bottomOffset?: number;
  extraKeyboardSpace?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function KeyboardSheetModal({
  visible,
  title,
  onClose,
  minHeight,
  maxHeight,
  children,
  footer,
  bottomOffset,
  extraKeyboardSpace = 28,
  contentContainerStyle,
}: KeyboardSheetModalProps) {
  const insets = useSafeAreaInsets();
  const sheetBottomInset = Math.max(insets.bottom, 16);
  const sheetLift = Math.max(insets.bottom, 12);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1">
        <Pressable className="absolute inset-0 bg-black/50" onPress={onClose} />

        <KeyboardAvoidingView behavior="padding" enabled={visible} style={{ flex: 1 }}>
          <View className="flex-1 justify-end">
            <Pressable
              onPress={() => {}}
              className="rounded-t-3xl bg-background"
              style={{
                minHeight,
                maxHeight,
                // marginBottom: sheetLift,
              }}
            >
              <View className="border-b border-border/60 px-5 pb-4 pt-6">
                <View className="flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-foreground">{title}</Text>
                  <Pressable onPress={onClose}>
                    <Text className="text-base font-medium text-primary">Cancel</Text>
                  </Pressable>
                </View>
              </View>

              <View
                className="flex-1"
                style={[
                  { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
                  contentContainerStyle,
                ]}
              >
                {children}
              </View>

              {footer ? (
                <View
                  className="border-t border-border/60 bg-background px-5 pt-4"
                  style={{ paddingBottom: sheetBottomInset }}
                >
                  {footer}
                </View>
              ) : null}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
