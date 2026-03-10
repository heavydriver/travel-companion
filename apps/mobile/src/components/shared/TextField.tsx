import { Text, TextInput, View } from "react-native";
import { cn } from "@/lib/utils";

type TextFieldProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?:
    | "default"
    | "email-address"
    | "numeric"
    | "phone-pad"
    | "url";
  error?: string;
  className?: string;
};

export function TextField({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize = "none",
  keyboardType = "default",
  error,
  className,
}: TextFieldProps) {
  return (
    <View className={cn("gap-2", className)}>
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        className={cn(
          "min-h-12 rounded-xl border border-border bg-card px-4 py-3 text-foreground",
          error && "border-destructive"
        )}
        placeholder={placeholder}
        placeholderTextColor="hsl(218 11% 65%)"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
      />
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
    </View>
  );
}
