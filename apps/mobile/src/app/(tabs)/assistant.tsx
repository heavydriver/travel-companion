import { useRouter } from "expo-router";
import {
  Bot,
  CircleDashed,
  Download,
  Menu,
  MessageSquarePlus,
  Send,
  Sparkles,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { client } from "@/api/client";
import { PlannerProposalCard } from "@/components/assistant/PlannerProposalCard";
import { RichTextMessage } from "@/components/assistant/RichTextMessage";
import { AddItineraryItemModal } from "@/components/shared/AddItineraryItemModal";
import { Button } from "@/components/shared/Button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { addOfflineTripItem } from "@/features/offline/itinerary";
import {
  type AssistantReference,
  buildAssistantGrounding,
  buildAssistantReferences,
} from "@/features/assistant/grounding";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { runAssistantCompletion } from "@/llm/chatEngine";
import { pauseModelDownload, resumeModelDownload, startModelDownload } from "@/llm/modelManager";
import { extractPlannerProposal, type PlannerProposal } from "@/llm/plannerSchema";
import { queuePlannerProposal, syncPendingPlannerOperations } from "@/llm/plannerSync";
import type { PendingPlannerOperation } from "@/store/assistantStore";
import { useAssistantStore } from "@/store/assistantStore";
import { useAuthStore } from "@/store/authStore";
import { useNetworkStore } from "@/store/networkStore";
import { useOfflineItineraryStore } from "@/store/offlineItineraryStore";
import { useOfflineStore } from "@/store/offlineStore";
import { useTripStore } from "@/store/tripStore";

const STARTER_CHIPS = [
  "Build a 3-day Kyoto itinerary for food and temples",
  "What should I pack for my upcoming trip?",
  "Help me plan a budget-friendly weekend in Chicago",
  "What are good local foods to try near my trip?",
  "Give me a slow-paced Paris day plan",
  "How do I get around Tokyo efficiently?",
  "Plan a romantic 2-day Lisbon itinerary",
];

const MODE_OPTIONS = [
  { value: "assist", label: "Assist" },
  { value: "plan", label: "Plan" },
] as const;

function createLocalId(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function formatRelativeDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function bytesLabel(bytes: number) {
  if (bytes <= 0) return "0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(bytes > 1024 * 1024 * 1024 ? 1 : 0)} MB`;
}

function isCurrencyQuestion(value: string) {
  const normalized = normalizeForCompare(value);
  return (
    normalized.includes("currency") ||
    normalized.includes("exchange") ||
    normalized.includes("exchange rate") ||
    normalized.includes("conversion") ||
    normalized.includes("convert ") ||
    normalized.includes("rate ") ||
    normalized.includes("how much")
  );
}

function buildDirectCurrencyReply(summary: string) {
  return `## Latest Currency Info\n\n${summary}\n\n_Source: live currency data from app backend._`;
}

const PLAN_THINKING_MESSAGES = [
  "Assistant is thinking…",
  "Assistant is thinking about your trip…",
  "Assistant is thinking through the itinerary…",
  "Assistant is thinking through the details…",
];

function buildPlannerProgressReply(stepIndex: number) {
  const nextIndex = Math.max(0, Math.min(stepIndex, PLAN_THINKING_MESSAGES.length - 1));
  return PLAN_THINKING_MESSAGES[nextIndex];
}

function normalizeForCompare(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIsoDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function atStartOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function defaultItineraryDateForTrip(trip: { startDate: string; endDate: string }) {
  const today = atStartOfDay(new Date());
  const tripStart = parseIsoDate(trip.startDate);
  const tripEnd = parseIsoDate(trip.endDate);

  if (!tripStart || !tripEnd) {
    return today;
  }
  if (today < atStartOfDay(tripStart)) {
    return tripStart;
  }
  if (today > atStartOfDay(tripEnd)) {
    return tripStart;
  }
  return today;
}

function MessageBubble({
  role,
  content,
  proposal,
  references,
  activeTrip,
  isConnected,
  creatingPlan,
  addingPlanToItinerary,
  onCreatePlan,
  onAddPlanToCurrentTrip,
  onPressReference,
  onAddReferenceToItinerary,
}: {
  role: "user" | "assistant";
  content: string;
  proposal?: PlannerProposal | null;
  references?: AssistantReference[];
  activeTrip: {
    title: string;
    startDate: string;
    endDate: string;
    destination: { id: string; name: string };
  } | null;
  isConnected: boolean;
  creatingPlan?: boolean;
  addingPlanToItinerary?: boolean;
  onCreatePlan?: (proposal: PlannerProposal) => void;
  onAddPlanToCurrentTrip?: (proposal: PlannerProposal) => void;
  onPressReference?: (reference: AssistantReference) => void;
  onAddReferenceToItinerary?: (reference: AssistantReference) => void;
}) {
  const isUser = role === "user";
  const resolvedProposal = useMemo(
    () => proposal ?? (!isUser ? extractPlannerProposal(content) : null),
    [content, isUser, proposal],
  );
  const shouldHideTextBubble = !isUser && Boolean(resolvedProposal);
  const actionablePlaceReferences = (references ?? []).filter(
    (reference) =>
      reference.type === "place" && reference.destinationId === activeTrip?.destination.id,
  );

  return (
    <View className={cn("mb-3", isUser ? "items-end" : "items-start")}>
      {!shouldHideTextBubble ? (
        <View
          className={cn(
            "max-w-[88%] rounded-[24px] px-4 py-3.5",
            isUser ? "bg-primary" : "border border-border bg-card/95",
          )}
        >
          {isUser ? (
            <Text className="text-[15px] leading-6 text-primary-foreground">{content}</Text>
          ) : (
            <RichTextMessage
              content={content}
              className="text-foreground"
              entities={references}
              onPressEntity={onPressReference}
            />
          )}
        </View>
      ) : null}

      {!proposal && actionablePlaceReferences.length ? (
        <View className="mt-3 w-full gap-2">
          {actionablePlaceReferences.slice(0, 3).map((reference) => (
            <View
              key={`${reference.type}-${reference.id}`}
              className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-3"
            >
              <Pressable onPress={() => onPressReference?.(reference)} className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{reference.name}</Text>
                <Text className="mt-1 text-xs text-muted-foreground">
                  View details in {activeTrip?.destination.name}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onAddReferenceToItinerary?.(reference)}
                className={cn("rounded-full px-3 py-2", isConnected ? "bg-primary" : "bg-muted")}
                disabled={!isConnected}
              >
                <Text
                  className={cn(
                    "text-xs font-semibold",
                    isConnected ? "text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  Add to itinerary
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {resolvedProposal ? (
        <PlannerProposalCard
          proposal={resolvedProposal}
          activeTrip={activeTrip}
          isConnected={isConnected}
          creating={Boolean(creatingPlan)}
          addingToItinerary={Boolean(addingPlanToItinerary)}
          onCreateTrip={(nextProposal) => onCreatePlan?.(nextProposal)}
          onAddToCurrentTrip={onAddPlanToCurrentTrip}
        />
      ) : null}
    </View>
  );
}

export default function AssistantScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmingMessageId, setConfirmingMessageId] = useState<string | null>(null);
  const [addingPlanMessageId, setAddingPlanMessageId] = useState<string | null>(null);
  const [selectedPlaceReference, setSelectedPlaceReference] = useState<AssistantReference | null>(
    null,
  );
  const [modeTriggerWidth, setModeTriggerWidth] = useState(0);

  const user = useAuthStore((s) => s.user);
  const isConnected = useNetworkStore((s) => s.isConnected);
  const threads = useAssistantStore((s) => s.threads);
  const activeThreadId = useAssistantStore((s) => s.activeThreadId);
  const hydrated = useAssistantStore((s) => s.hydrated);
  const hydrateAssistant = useAssistantStore((s) => s.hydrate);
  const modelState = useAssistantStore((s) => s.modelState);
  const setModelState = useAssistantStore((s) => s.setModelState);
  const createThread = useAssistantStore((s) => s.createThread);
  const setActiveThreadId = useAssistantStore((s) => s.setActiveThreadId);
  const setThreadMode = useAssistantStore((s) => s.setThreadMode);
  const appendUserMessage = useAssistantStore((s) => s.appendUserMessage);
  const upsertAssistantMessage = useAssistantStore((s) => s.upsertAssistantMessage);
  const queueOperation = useAssistantStore((s) => s.queuePlannerOperation);

  const foreground = useUnstableNativeVariable("--foreground");
  const iconColor = foreground ? `hsl(${foreground})` : undefined;

  const trips = useTripStore((s) => s.trips);
  const activeTripId = useTripStore((s) => s.activeTripId);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null;
  const activeTrip =
    (activeTripId ? trips.find((trip) => trip.id === activeTripId) : trips[0]) ?? null;
  const activeTripOfflineItems = useOfflineItineraryStore((state) =>
    activeTrip?.id ? state.tripItems[activeTrip.id] : undefined,
  );
  const activeTripHasOfflinePack = useOfflineStore((state) =>
    activeTrip?.destination.id ? state.isDownloaded(activeTrip.destination.id) : false,
  );

  const starterChips = useMemo(() => {
    const copy = [...STARTER_CHIPS];
    copy.sort(() => Math.random() - 0.5);
    return copy.slice(0, 4);
  }, []);

  const sortedThreads = useMemo(
    () =>
      [...threads].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [threads],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: cached itinerary data should refresh when the active trip or visible message set changes
  const itineraryItems = useMemo(() => {
    if (!activeTrip?.id) {
      return [];
    }

    const cached = queryClient.getQueryData<{
      items: Array<{ title: string; date: string }>;
    }>(["itinerary", activeTrip.id]);
    return activeTripHasOfflinePack ? activeTripOfflineItems ?? cached?.items ?? [] : cached?.items ?? [];
  }, [activeTrip?.id, activeThread?.messages.length, activeTripHasOfflinePack, activeTripOfflineItems]);

  useEffect(() => {
    if (!hydrated) {
      void hydrateAssistant();
    }
  }, [hydrated, hydrateAssistant]);

  useEffect(() => {
    if (hydrated && isConnected) {
      void syncPendingPlannerOperations();
    }
  }, [hydrated, isConnected]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  async function handleDownload() {
    Alert.alert(
      "Download AI Model",
      `Download the on-device model (${bytesLabel(modelState.sizeBytes)}) to enable offline assistant features?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download",
          onPress: async () => {
            try {
              setModelState({
                status: "downloading",
                error: null,
                progress: 0,
                totalBytesExpected: modelState.totalBytesExpected,
              });
              await startModelDownload((progress) => {
                setModelState({
                  status: "downloading",
                  progress: progress.progress,
                  totalBytesWritten: progress.totalBytesWritten,
                  totalBytesExpected: progress.totalBytesExpected,
                  error: null,
                });
              });
              await useAssistantStore.getState().refreshModelState();
            } catch (error) {
              setModelState({
                status: "error",
                error: error instanceof Error ? error.message : "Model download failed",
              });
            }
          },
        },
      ],
    );
  }

  async function handleResumeDownload() {
    try {
      setModelState({ status: "downloading", error: null });
      await resumeModelDownload((progress) => {
        setModelState({
          status: "downloading",
          progress: progress.progress,
          totalBytesWritten: progress.totalBytesWritten,
          totalBytesExpected: progress.totalBytesExpected,
          error: null,
        });
      });
      await useAssistantStore.getState().refreshModelState();
    } catch (error) {
      setModelState({
        status: "error",
        error: error instanceof Error ? error.message : "Model resume failed",
      });
    }
  }

  async function handlePauseDownload() {
    try {
      await pauseModelDownload();
      setModelState({ status: "paused" });
    } catch (error) {
      setModelState({
        status: "error",
        error: error instanceof Error ? error.message : "Could not pause download",
      });
    }
  }

  async function handleSend(seedText?: string) {
    const nextText = (seedText ?? input).trim();
    if (!nextText || !activeThread || !modelState.modelUri || sending) {
      return;
    }

    const threadSnapshot = activeThread;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let streamedText = "";
    let grounding = null as Awaited<ReturnType<typeof buildAssistantGrounding>> | null;
    let plannerProgressTimer: ReturnType<typeof setInterval> | null = null;
    let plannerProgressIndex = 0;

    setInput("");
    appendUserMessage(activeThread.id, nextText);
    const assistantMessageId = createLocalId("assistant-response");
    setTyping(true);
    setSending(true);
    setModelState({ status: "loading", error: null });

    try {
      let groundingContext = "";
      try {
        grounding = await buildAssistantGrounding({
          message: nextText,
          isConnected,
          activeTripDestination: activeTrip?.destination ?? null,
        });
        groundingContext = grounding.promptContext;
      } catch {
        groundingContext = isConnected
          ? "Connectivity status: online. No extra grounded app data could be loaded for this turn."
          : "Connectivity status: offline. No live app data could be loaded for this turn.";
      }

      if (
        threadSnapshot.mode === "assist" &&
        grounding?.currencySummary &&
        isCurrencyQuestion(nextText)
      ) {
        const directReply = buildDirectCurrencyReply(grounding.currencySummary);
        upsertAssistantMessage(activeThread.id, assistantMessageId, directReply, {
          references: buildAssistantReferences(directReply, grounding),
          summary: threadSnapshot.summary,
        });
        setTyping(false);
        setModelState({ status: "ready", error: null, progress: 1 });
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
        return;
      }

      if (threadSnapshot.mode === "plan") {
        plannerProgressIndex = Math.floor(Math.random() * PLAN_THINKING_MESSAGES.length);
        upsertAssistantMessage(
          activeThread.id,
          assistantMessageId,
          buildPlannerProgressReply(plannerProgressIndex),
        );
        plannerProgressTimer = setInterval(() => {
          plannerProgressIndex = Math.floor(Math.random() * PLAN_THINKING_MESSAGES.length);
          upsertAssistantMessage(
            activeThread.id,
            assistantMessageId,
            buildPlannerProgressReply(plannerProgressIndex),
          );
        }, 900);
      }

      const result = await runAssistantCompletion({
        modelPath: modelState.modelUri,
        userName: user?.name,
        thread: {
          mode: threadSnapshot.mode,
          summary: threadSnapshot.summary,
          messages: threadSnapshot.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        },
        userMessage: nextText,
        activeTrip: activeTrip
          ? {
              title: activeTrip.title,
              startDate: activeTrip.startDate,
              endDate: activeTrip.endDate,
              destination: activeTrip.destination,
            }
          : null,
        groundingContext,
        itineraryItems,
        onToken: (_, accumulated) => {
          streamedText = accumulated;
          setTyping(false);
          if (threadSnapshot.mode !== "plan") {
            upsertAssistantMessage(activeThread.id, assistantMessageId, accumulated);
          }
          requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
        },
        abortSignal: abortController.signal,
      });

      if (plannerProgressTimer) {
        clearInterval(plannerProgressTimer);
        plannerProgressTimer = null;
      }

      upsertAssistantMessage(activeThread.id, assistantMessageId, result.text, {
        proposal: result.proposal ?? null,
        references: buildAssistantReferences(result.text, grounding),
        summary: result.nextSummary,
      });
      setModelState({ status: "ready", error: null, progress: 1 });
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (error) {
      if (plannerProgressTimer) {
        clearInterval(plannerProgressTimer);
        plannerProgressTimer = null;
      }
      if (abortController.signal.aborted) {
        if (streamedText.trim() && threadSnapshot.mode !== "plan") {
          upsertAssistantMessage(activeThread.id, assistantMessageId, streamedText.trim());
        } else if (threadSnapshot.mode === "plan") {
          upsertAssistantMessage(
            activeThread.id,
            assistantMessageId,
            "Plan generation stopped before final itinerary was ready.",
          );
        }
        setModelState({ status: "ready", error: null, progress: 1 });
      } else {
        upsertAssistantMessage(
          activeThread.id,
          assistantMessageId,
          "I hit a problem while generating that response. Please try again.",
        );
        setModelState({
          status: "error",
          error: error instanceof Error ? error.message : "Generation failed",
        });
      }
    } finally {
      if (plannerProgressTimer) {
        clearInterval(plannerProgressTimer);
      }
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setTyping(false);
      setSending(false);
    }
  }

  async function handleConfirmPlan(messageId: string, proposal: PlannerProposal) {
    if (!activeThread) {
      return;
    }

    setConfirmingMessageId(messageId);
    const operation: PendingPlannerOperation = {
      id: createLocalId("planner-op"),
      threadId: activeThread.id,
      tempTripId: createLocalId("local-trip"),
      createdAt: new Date().toISOString(),
      status: "pending",
      destinationId: null,
      proposal,
    };

    try {
      await queueOperation(operation);
      queuePlannerProposal(operation);
      if (isConnected) {
        await syncPendingPlannerOperations();
      }
      Toast.show({
        type: "success",
        text1: isConnected ? "Trip created" : "Trip saved offline",
        text2: isConnected
          ? "Your AI plan was turned into a trip and itinerary."
          : "We queued your AI plan and will sync it when you're back online.",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Could not confirm plan",
        text2: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setConfirmingMessageId(null);
    }
  }

  async function handleAddPlanToCurrentTrip(messageId: string, proposal: PlannerProposal) {
    if (!activeTrip) {
      return;
    }
    if (!isConnected && !activeTripHasOfflinePack) {
      Toast.show({
        type: "error",
        text1: "Internet required",
        text2: "Adding AI plan items to an existing itinerary is only available online right now.",
      });
      return;
    }

    setAddingPlanMessageId(messageId);
    try {
      for (const item of proposal.itineraryItems) {
        if (activeTripHasOfflinePack) {
          await addOfflineTripItem(activeTrip.id, {
            tripId: activeTrip.id,
            title: item.title,
            date: item.date,
            startTime: item.startTime ?? null,
            endTime: item.endTime ?? null,
            notes: item.notes ?? null,
            placeId: null,
            isDone: false,
          });
        } else {
          const res = await client.api.v1.trips({ tripId: activeTrip.id })["itinerary-items"].post({
            title: item.title,
            date: item.date,
            startTime: item.startTime ?? undefined,
            endTime: item.endTime ?? undefined,
            notes: item.notes ?? undefined,
          });
          if (res.error) {
            throw new Error(`Could not add "${item.title}" to the itinerary`);
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["itinerary", activeTrip.id] });
      Toast.show({
        type: "success",
        text1: "Itinerary updated",
        text2: `Added ${proposal.itineraryItems.length} plan item${proposal.itineraryItems.length === 1 ? "" : "s"} to ${activeTrip.title}.`,
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Could not add plan items",
        text2: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setAddingPlanMessageId(null);
    }
  }

  function handlePressReference(reference: AssistantReference) {
    router.push(reference.href as never);
  }

  function handleAddReferenceToItinerary(reference: AssistantReference) {
    if (!activeTrip || reference.type !== "place") {
      return;
    }
    if (!isConnected && !activeTripHasOfflinePack) {
      Toast.show({
        type: "error",
        text1: "Internet required",
        text2: "Adding place suggestions to your itinerary is only available online right now.",
      });
      return;
    }
    setSelectedPlaceReference(reference);
  }

  function handleStopGeneration() {
    abortControllerRef.current?.abort();
  }

  if (!hydrated) {
    return (
      <SafeAreaView className="items-center justify-center flex-1 bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const isModelMissing =
    modelState.status === "not_downloaded" ||
    (modelState.status === "paused" && !modelState.modelUri);

  const modeLabel = activeThread?.mode === "plan" ? "Plan" : "Assist";
  const selectedModeOption = activeThread
    ? {
        value: activeThread.mode,
        label: modeLabel,
      }
    : undefined;

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 px-4 pt-2">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => setDrawerOpen(true)}
              className="items-center justify-center border rounded-full h-11 w-11 border-border bg-card"
            >
              <Menu size={20} color={iconColor} />
            </Pressable>

            <View className="items-center flex-1 min-w-0 px-2">
              <View className="flex-row items-center gap-2">
                <View className="items-center justify-center h-9 w-9 rounded-2xl bg-primary/15">
                  <Sparkles size={17} color="#208AEF" />
                </View>
                <Text className="text-lg font-semibold tracking-tight text-foreground">
                  Travel Assistant
                </Text>
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">Powered by Gemma 2</Text>
            </View>

            <Pressable
              onPress={() => {
                const newThreadId = createThread(activeThread?.mode ?? "assist");
                setActiveThreadId(newThreadId);
              }}
              className="items-center justify-center border rounded-full h-11 w-11 border-border bg-card"
            >
              <MessageSquarePlus size={20} color={iconColor} />
            </Pressable>
          </View>

          {isModelMissing ? (
            <View className="mt-5 rounded-[28px] border border-border bg-card p-5">
              <View className="flex-row items-center gap-3">
                <View className="items-center justify-center w-12 h-12 rounded-2xl bg-primary/10">
                  <Download size={20} color="#208AEF" />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground">Download AI Model</Text>
                  <Text className="mt-1 text-sm leading-6 text-muted-foreground">
                    Download the on-device Gemma 2 model once and keep your assistant available for
                    future trips.
                  </Text>
                </View>
              </View>

              <View className="px-4 py-3 mt-4 rounded-2xl bg-muted/40">
                <Text className="text-sm text-foreground">
                  Estimated size: {bytesLabel(modelState.sizeBytes)}
                </Text>
                <Text className="mt-1 text-xs text-muted-foreground">
                  Stored in your device documents folder for offline use.
                </Text>
              </View>

              <Button label="Download Model" onPress={handleDownload} className="mt-5" />
            </View>
          ) : null}

          {modelState.status === "downloading" || modelState.status === "paused" ? (
            <View className="mt-5 rounded-[28px] border border-border bg-card p-5">
              <Text className="text-lg font-semibold text-foreground">
                Preparing your travel AI
              </Text>
              <Text className="mt-2 text-sm leading-6 text-muted-foreground">
                {Math.round(modelState.progress * 100)}% downloaded ·{" "}
                {bytesLabel(modelState.totalBytesWritten)} of{" "}
                {bytesLabel(modelState.totalBytesExpected)}
              </Text>
              <View className="h-3 mt-4 overflow-hidden rounded-full bg-muted">
                <View
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.max(4, modelState.progress * 100)}%`,
                  }}
                />
              </View>
              <View className="flex-row gap-3 mt-4">
                {modelState.status === "paused" ? (
                  <Button
                    label="Resume Download"
                    onPress={handleResumeDownload}
                    className="flex-1"
                  />
                ) : (
                  <Button
                    label="Pause Download"
                    variant="secondary"
                    onPress={handlePauseDownload}
                    className="flex-1"
                  />
                )}
              </View>
            </View>
          ) : null}

          {!isModelMissing &&
          modelState.status !== "downloading" &&
          modelState.status !== "paused" ? (
            <>
              <ScrollView
                ref={scrollRef}
                className="flex-1 mt-4"
                contentContainerClassName="pb-6 pt-1"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {activeThread?.messages.length ? (
                  activeThread.messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      role={message.role}
                      content={message.content}
                      proposal={message.proposal}
                      references={message.references}
                      activeTrip={activeTrip}
                      isConnected={isConnected}
                      creatingPlan={confirmingMessageId === message.id}
                      addingPlanToItinerary={addingPlanMessageId === message.id}
                      onCreatePlan={
                        message.proposal
                          ? (nextProposal) => void handleConfirmPlan(message.id, nextProposal)
                          : undefined
                      }
                      onAddPlanToCurrentTrip={
                        message.proposal
                          ? (nextProposal) =>
                              void handleAddPlanToCurrentTrip(message.id, nextProposal)
                          : undefined
                      }
                      onPressReference={handlePressReference}
                      onAddReferenceToItinerary={handleAddReferenceToItinerary}
                    />
                  ))
                ) : (
                  <View className="pt-10">
                    <View className="rounded-[30px] border border-border bg-card px-5 py-6">
                      <Text className="text-3xl font-bold tracking-tight text-center text-foreground">
                        Where are we headed?
                      </Text>
                      <Text className="mt-2 text-sm leading-6 text-center text-muted-foreground">
                        Ask for ideas, packing help, or switch to planning mode from the composer
                        below.
                      </Text>
                      <View className="flex-row flex-wrap justify-center gap-2 mx-auto mt-6">
                        {starterChips.map((chip) => (
                          <Pressable
                            key={chip}
                            onPress={() => void handleSend(chip)}
                            className="px-3 py-2 border rounded-full border-border bg-background"
                          >
                            <Text className="text-xs font-medium leading-5 text-foreground">
                              {chip}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {typing ? (
                  <View className="self-start px-3 py-2 mt-3 border rounded-full border-border bg-card">
                    <View className="flex-row items-center gap-2">
                      <CircleDashed size={16} color="#64748B" />
                      <Text className="text-sm text-muted-foreground">Assistant is thinking…</Text>
                    </View>
                  </View>
                ) : null}
              </ScrollView>

              <View className="pt-3 pb-2 border-t border-border/80">
                <View className="rounded-[26px] border border-border bg-card px-3 py-3">
                  {activeThread ? (
                    <View className="flex-row items-center justify-between gap-3 mb-2">
                      <Select
                        value={selectedModeOption}
                        onValueChange={(option) => {
                          if (option) {
                            setThreadMode(activeThread.id, option.value as "assist" | "plan");
                          }
                        }}
                      >
                        <SelectTrigger
                          className="px-3 rounded-full h-9 border-border bg-background"
                          aria-label="Select assistant mode"
                          onLayout={(event) => {
                            const nextWidth = Math.round(event.nativeEvent.layout.width);
                            setModeTriggerWidth((prev) => (prev === nextWidth ? prev : nextWidth));
                          }}
                        >
                          <Text className="text-sm font-semibold text-foreground">{modeLabel}</Text>
                        </SelectTrigger>
                        <SelectContent
                          className="border-border bg-card"
                          style={modeTriggerWidth > 0 ? { width: modeTriggerWidth } : undefined}
                        >
                          {MODE_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              label={option.label}
                            >
                              <Text className="text-sm text-foreground">{option.label}</Text>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Text className="flex-1 text-xs text-right text-muted-foreground">
                        {activeThread.mode === "plan"
                          ? "Creates trip-ready itinerary drafts"
                          : "Fast travel answers and follow-ups"}
                      </Text>
                    </View>
                  ) : null}

                  <View className="flex-row items-end gap-2">
                    <TextInput
                      value={input}
                      onChangeText={setInput}
                      placeholder={
                        activeThread?.mode === "plan"
                          ? "Describe the trip you want planned"
                          : "Ask your travel assistant"
                      }
                      placeholderTextColor="hsl(218 11% 65%)"
                      multiline
                      className="min-h-[40px] max-h-28 flex-1 px-1 text-[15px] leading-5 text-foreground"
                    />

                    {sending ? (
                      <Pressable
                        onPress={handleStopGeneration}
                        className="h-10 min-w-[68px] items-center justify-center rounded-full border border-border bg-muted/50 px-3"
                      >
                        <Text className="text-sm font-semibold text-foreground">Stop</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        disabled={!input.trim() || !modelState.modelUri}
                        onPress={() => void handleSend()}
                        className={cn(
                          "h-10 w-10 items-center justify-center rounded-full",
                          !input.trim() || !modelState.modelUri ? "bg-muted" : "bg-primary",
                        )}
                      >
                        <Send
                          size={17}
                          color={input.trim() && modelState.modelUri ? "white" : "#94A3B8"}
                        />
                      </Pressable>
                    )}
                  </View>
                </View>

                {!isConnected ? (
                  <Text className="mt-2 text-xs text-center text-muted-foreground">
                    Offline mode is active. Chat stays available and planner confirmations will sync
                    later.
                  </Text>
                ) : null}

                {modelState.error ? (
                  <Text className="mt-2 text-xs text-center text-destructive">
                    {modelState.error}
                  </Text>
                ) : null}
              </View>
            </>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={drawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View className="flex-row flex-1 bg-black/30">
          <SafeAreaView edges={["top", "bottom", "left"]} className="w-[82%] bg-background">
            <View className="flex-1 px-4 pt-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-xl font-bold text-foreground">Previous chats</Text>
                <Text className="text-xs uppercase tracking-[1px] text-muted-foreground">
                  {sortedThreads.length} total
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  const newThreadId = createThread(activeThread?.mode ?? "assist");
                  setActiveThreadId(newThreadId);
                  setDrawerOpen(false);
                }}
                className="flex-row items-center gap-3 px-4 py-3 mt-4 border rounded-2xl border-border bg-card"
              >
                <View className="items-center justify-center h-9 w-9 rounded-xl bg-primary/15">
                  <Bot size={16} color="#208AEF" />
                </View>
                <Text className="text-sm font-semibold text-foreground">New chat</Text>
              </Pressable>

              <ScrollView
                className="flex-1 mt-4"
                contentContainerClassName="pb-6"
                showsVerticalScrollIndicator={false}
              >
                {sortedThreads.map((thread) => (
                  <Pressable
                    key={thread.id}
                    onPress={() => {
                      setActiveThreadId(thread.id);
                      setDrawerOpen(false);
                    }}
                    className={cn(
                      "mb-2 rounded-2xl border px-3.5 py-3",
                      thread.id === activeThread?.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card",
                    )}
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <Text
                        className="flex-1 min-w-0 text-sm font-semibold text-foreground"
                        numberOfLines={1}
                      >
                        {thread.title}
                      </Text>
                      <Text className="text-[11px] text-muted-foreground">
                        {formatRelativeDate(thread.updatedAt)}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between gap-3 mt-2">
                      <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
                        {thread.summary ||
                          `${thread.mode === "plan" ? "Planner" : "Assistant"} conversation`}
                      </Text>
                      <View className="px-2 py-1 rounded-full bg-muted">
                        <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {thread.mode}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </SafeAreaView>

          <Pressable className="flex-1" onPress={() => setDrawerOpen(false)} />
        </View>
      </Modal>

      {selectedPlaceReference && activeTrip ? (
        <AddItineraryItemModal
          visible
          tripId={activeTrip.id}
          defaultDate={defaultItineraryDateForTrip(activeTrip)}
          tripStartDate={parseIsoDate(activeTrip.startDate) ?? undefined}
          tripEndDate={parseIsoDate(activeTrip.endDate) ?? undefined}
          offlineDestinationId={activeTrip.destination.id}
          initialTitle={selectedPlaceReference.name}
          initialPlaceId={selectedPlaceReference.id}
          onClose={() => setSelectedPlaceReference(null)}
          onSuccess={() => {
            setSelectedPlaceReference(null);
            void queryClient.invalidateQueries({ queryKey: ["itinerary", activeTrip.id] });
          }}
          onSuccessMessage={(title) => {
            Toast.show({
              type: "success",
              text1: "Added to itinerary",
              text2: `${title} was added to ${activeTrip.title}.`,
            });
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
