import { useLocalSearchParams, useRouter } from "expo-router";
import { Send } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/shared/Screen";

type MessageItem = {
  id: string;
  sender: "me" | "them";
  body: string;
  sentAt: string;
  readAt?: string;
};

const INITIAL_MESSAGES: MessageItem[] = [
  {
    id: "m-1",
    sender: "them",
    body: "Hey! Are you free to explore the market tonight?",
    sentAt: "10:04",
    readAt: "10:06",
  },
  {
    id: "m-2",
    sender: "me",
    body: "Yes, sounds great. 7pm works for me.",
    sentAt: "10:06",
    readAt: "10:07",
  },
];

export default function MessageThreadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ connectionId?: string }>();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [lastPolledAt, setLastPolledAt] = useState<Date | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastPolledAt(new Date());
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setMessages((prev) =>
      prev.map((message) =>
        message.sender === "them" && !message.readAt
          ? {
              ...message,
              readAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            }
          : message,
      ),
    );
  }, []);

  const canSend = draft.trim().length > 0;
  const readLabel = useMemo(() => {
    const mine = [...messages].reverse().find((message) => message.sender === "me");
    if (!mine) return "";
    return mine.readAt ? "Read" : "Sent";
  }, [messages]);

  const handleSend = () => {
    if (!canSend) return;
    const next: MessageItem = {
      id: `m-${messages.length + 1}`,
      sender: "me",
      body: draft.trim(),
      sentAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, next]);
    setDraft("");
  };

  return (
    <Screen contentClassName="pb-0">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1">
          <Pressable onPress={() => router.back()} className="active:opacity-80">
            <Text className="text-base font-medium text-primary">Back</Text>
          </Pressable>

          <View className="mt-4 rounded-2xl border border-border bg-card p-4">
            <Text className="text-lg font-semibold text-foreground">Message Thread</Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              Connection: {params.connectionId ?? "unknown"}
            </Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              Polling every 10s {lastPolledAt ? `· last checked ${lastPolledAt.toLocaleTimeString()}` : ""}
            </Text>
          </View>

          <View className="mt-4 flex-1 gap-2">
            {messages.map((message) => (
              <View
                key={message.id}
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.sender === "me"
                    ? "self-end bg-primary"
                    : "self-start border border-border bg-card"
                }`}
              >
                <Text
                  className={message.sender === "me" ? "text-primary-foreground" : "text-foreground"}
                >
                  {message.body}
                </Text>
                <Text
                  className={`mt-1 text-[11px] ${
                    message.sender === "me" ? "text-primary-foreground/80" : "text-muted-foreground"
                  }`}
                >
                  {message.sentAt}
                </Text>
              </View>
            ))}
          </View>

          <View className="border-t border-border bg-background pb-5 pt-3">
            <View className="flex-row items-center gap-2">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Type your message"
                placeholderTextColor="hsl(218 11% 65%)"
                className="min-h-12 flex-1 rounded-xl border border-border bg-card px-4 text-foreground"
              />
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                className={`h-12 w-12 items-center justify-center rounded-xl ${
                  canSend ? "bg-primary" : "bg-muted"
                }`}
              >
                <Send size={18} color={canSend ? "white" : "hsl(218 11% 65%)"} />
              </Pressable>
            </View>
            <Text className="mt-2 text-right text-xs text-muted-foreground">{readLabel}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
