import { AlertTriangle, RotateCcw } from "lucide-react-native";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} message={this.state.error?.message} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center px-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle size={40} color="hsl(0 84% 60%)" />
        </View>

        <Text className="mt-6 text-center text-xl font-bold text-foreground">
          Something went wrong
        </Text>

        <Text className="mt-2 text-center text-sm leading-5 text-muted-foreground">
          The app ran into an unexpected error. You can try again and it should work.
        </Text>

        {message && (
          <View className="mt-4 w-full rounded-xl bg-muted/50 px-4 py-3">
            <Text className="text-center text-xs text-muted-foreground" numberOfLines={3}>
              {message}
            </Text>
          </View>
        )}

        <Pressable
          onPress={onRetry}
          className="mt-8 flex-row items-center gap-2 rounded-full bg-primary px-8 py-3.5 active:opacity-80"
        >
          <RotateCcw size={18} color="#fff" />
          <Text className="text-base font-semibold text-primary-foreground">Try Again</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
