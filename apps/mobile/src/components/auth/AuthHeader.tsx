import { Text, View } from "react-native";

type AuthHeaderProps = {
  title: string;
  subtitle: string;
};

export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <View className="gap-2">
      <Text className="text-3xl font-bold text-foreground">{title}</Text>
      <Text className="text-base leading-6 text-muted-foreground">{subtitle}</Text>
    </View>
  );
}
