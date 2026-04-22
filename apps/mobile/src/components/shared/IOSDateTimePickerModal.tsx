import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

type IOSDateTimePickerModalProps = {
  visible: boolean;
  title: string;
  value: Date;
  mode: "date" | "time";
  minimumDate?: Date;
  maximumDate?: Date;
  is24Hour?: boolean;
  onCancel: () => void;
  onConfirm: (value: Date) => void;
};

export function IOSDateTimePickerModal({
  visible,
  title,
  value,
  mode,
  minimumDate,
  maximumDate,
  is24Hour,
  onCancel,
  onConfirm,
}: IOSDateTimePickerModalProps) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    if (visible) {
      setDraftValue(value);
    }
  }, [value, visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onCancel} />
        <View className="rounded-t-3xl bg-background px-5 pb-8 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Pressable onPress={onCancel} className="py-2">
              <Text className="text-base font-medium text-muted-foreground">Cancel</Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground">{title}</Text>
            <Pressable onPress={() => onConfirm(draftValue)} className="py-2">
              <Text className="text-base font-semibold text-primary">Done</Text>
            </Pressable>
          </View>

          <DateTimePicker
            value={draftValue}
            mode={mode}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            is24Hour={is24Hour}
            display="spinner"
            onChange={(_, nextValue) => {
              if (nextValue) setDraftValue(nextValue);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
