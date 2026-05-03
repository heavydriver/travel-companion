import { create } from "zustand";
import type { AssistantReference } from "@/features/assistant/grounding";
import { storage } from "@/lib/storage";
import type { PlannerProposal } from "@/llm/plannerSchema";
import {
  deleteDownloadedModel,
  getStoredModelMetadata,
  hasPausedModelDownload,
  MODEL_APPROX_SIZE_BYTES,
} from "@/llm/modelManager";

const ASSISTANT_STORAGE_KEY = "travel_companion_assistant_state";

function createLocalId(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export type AssistantMode = "assist" | "plan";
export type AssistantRole = "user" | "assistant";

export type AssistantMessage = {
  id: string;
  role: AssistantRole;
  content: string;
  createdAt: string;
  proposal?: PlannerProposal | null;
  references?: AssistantReference[];
};

export type AssistantThread = {
  id: string;
  mode: AssistantMode;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  messages: AssistantMessage[];
};

export type PendingPlannerOperation = {
  id: string;
  threadId: string;
  tempTripId: string;
  createdAt: string;
  status: "pending" | "syncing" | "failed";
  error?: string | null;
  destinationId?: string | null;
  proposal: PlannerProposal;
};

export type AssistantModelState = {
  status: "not_downloaded" | "downloading" | "paused" | "loading" | "ready" | "error";
  progress: number;
  totalBytesWritten: number;
  totalBytesExpected: number;
  downloadedAt: string | null;
  sizeBytes: number;
  modelUri: string | null;
  error: string | null;
};

type PersistedAssistantState = {
  activeThreadId: string | null;
  threads: AssistantThread[];
  pendingPlannerOperations: PendingPlannerOperation[];
};

type AssistantState = PersistedAssistantState & {
  hydrated: boolean;
  modelState: AssistantModelState;
  hydrate: () => Promise<void>;
  refreshModelState: () => Promise<void>;
  setModelState: (patch: Partial<AssistantModelState>) => void;
  createThread: (mode?: AssistantMode) => string;
  setActiveThreadId: (threadId: string) => void;
  setThreadMode: (threadId: string, mode: AssistantMode) => void;
  appendUserMessage: (threadId: string, content: string) => string;
  upsertAssistantMessage: (
    threadId: string,
    messageId: string,
    content: string,
    extras?: {
      proposal?: PlannerProposal | null;
      references?: AssistantReference[];
      summary?: string | null;
    },
  ) => void;
  clearHistory: () => Promise<void>;
  queuePlannerOperation: (operation: PendingPlannerOperation) => Promise<void>;
  markPlannerOperationSyncing: (operationId: string) => Promise<void>;
  markPlannerOperationFailed: (operationId: string, error: string) => Promise<void>;
  removePlannerOperation: (operationId: string) => Promise<void>;
  deleteModelAndReset: () => Promise<void>;
};

const defaultModelState: AssistantModelState = {
  status: "not_downloaded",
  progress: 0,
  totalBytesWritten: 0,
  totalBytesExpected: MODEL_APPROX_SIZE_BYTES,
  downloadedAt: null,
  sizeBytes: MODEL_APPROX_SIZE_BYTES,
  modelUri: null,
  error: null,
};

async function persistAssistantState(state: PersistedAssistantState) {
  await storage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(state));
}

function defaultThread(mode: AssistantMode = "assist"): AssistantThread {
  const now = new Date().toISOString();
  return {
    id: createLocalId("assistant-thread"),
    mode,
    title: mode === "plan" ? "New trip plan" : "New chat",
    summary: "",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  activeThreadId: null,
  threads: [],
  pendingPlannerOperations: [],
  hydrated: false,
  modelState: defaultModelState,

  hydrate: async () => {
    try {
      const raw = await storage.getItem(ASSISTANT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedAssistantState;
        const threads = parsed.threads?.length ? parsed.threads : [defaultThread()];
        set({
          threads,
          activeThreadId: parsed.activeThreadId ?? threads[0]?.id ?? null,
          pendingPlannerOperations: parsed.pendingPlannerOperations ?? [],
          hydrated: true,
        });
      } else {
        const thread = defaultThread();
        set({
          threads: [thread],
          activeThreadId: thread.id,
          pendingPlannerOperations: [],
          hydrated: true,
        });
        await persistAssistantState({
          threads: [thread],
          activeThreadId: thread.id,
          pendingPlannerOperations: [],
        });
      }
    } catch {
      const thread = defaultThread();
      set({
        threads: [thread],
        activeThreadId: thread.id,
        pendingPlannerOperations: [],
        hydrated: true,
      });
    }

    await get().refreshModelState();
  },

  refreshModelState: async () => {
    const metadata = await getStoredModelMetadata();
    const paused = await hasPausedModelDownload();
    if (metadata) {
      set({
        modelState: {
          status: "ready",
          progress: 1,
          totalBytesWritten: metadata.sizeBytes,
          totalBytesExpected: metadata.sizeBytes,
          downloadedAt: metadata.downloadedAt,
          sizeBytes: metadata.sizeBytes,
          modelUri: metadata.uri,
          error: null,
        },
      });
      return;
    }

    set({
      modelState: {
        ...defaultModelState,
        status: paused ? "paused" : "not_downloaded",
      },
    });
  },

  setModelState: (patch) =>
    set((state) => ({
      modelState: {
        ...state.modelState,
        ...patch,
      },
    })),

  createThread: (mode = "assist") => {
    const thread = defaultThread(mode);
    const nextThreads = [thread, ...get().threads];
    const nextState: PersistedAssistantState = {
      threads: nextThreads,
      activeThreadId: thread.id,
      pendingPlannerOperations: get().pendingPlannerOperations,
    };
    set(nextState);
    void persistAssistantState(nextState);
    return thread.id;
  },

  setActiveThreadId: (threadId) => {
    const nextState: PersistedAssistantState = {
      threads: get().threads,
      activeThreadId: threadId,
      pendingPlannerOperations: get().pendingPlannerOperations,
    };
    set({ activeThreadId: threadId });
    void persistAssistantState(nextState);
  },

  setThreadMode: (threadId, mode) => {
    const threads = get().threads.map((thread) =>
      thread.id === threadId ? { ...thread, mode, updatedAt: new Date().toISOString() } : thread,
    );
    const nextState: PersistedAssistantState = {
      threads,
      activeThreadId: get().activeThreadId,
      pendingPlannerOperations: get().pendingPlannerOperations,
    };
    set({ threads });
    void persistAssistantState(nextState);
  },

  appendUserMessage: (threadId, content) => {
    const messageId = createLocalId("assistant-message");
    const now = new Date().toISOString();
    const threads = get().threads.map((thread) => {
      if (thread.id !== threadId) return thread;
      const title = thread.messages.length === 0 ? content.slice(0, 48) || thread.title : thread.title;
      return {
        ...thread,
        title,
        updatedAt: now,
        messages: [
          ...thread.messages,
          {
            id: messageId,
            role: "user" as const,
            content,
            createdAt: now,
          },
        ],
      };
    });
    const nextState: PersistedAssistantState = {
      threads,
      activeThreadId: get().activeThreadId,
      pendingPlannerOperations: get().pendingPlannerOperations,
    };
    set({ threads });
    void persistAssistantState(nextState);
    return messageId;
  },

  upsertAssistantMessage: (threadId, messageId, content, extras) => {
    const now = new Date().toISOString();
    const threads = get().threads.map((thread) => {
      if (thread.id !== threadId) return thread;
      const existingIndex = thread.messages.findIndex((message) => message.id === messageId);
      const nextMessage: AssistantMessage = {
        id: messageId,
        role: "assistant",
        content,
        createdAt:
          existingIndex >= 0 ? thread.messages[existingIndex]?.createdAt ?? now : now,
        proposal: extras?.proposal,
        references: extras?.references,
      };
      const nextMessages =
        existingIndex >= 0
          ? thread.messages.map((message, index) => (index === existingIndex ? nextMessage : message))
          : [...thread.messages, nextMessage];
      return {
        ...thread,
        summary: extras?.summary ?? thread.summary,
        updatedAt: now,
        messages: nextMessages,
      };
    });
    const nextState: PersistedAssistantState = {
      threads,
      activeThreadId: get().activeThreadId,
      pendingPlannerOperations: get().pendingPlannerOperations,
    };
    set({ threads });
    void persistAssistantState(nextState);
  },

  clearHistory: async () => {
    const thread = defaultThread();
    const nextState: PersistedAssistantState = {
      threads: [thread],
      activeThreadId: thread.id,
      pendingPlannerOperations: [],
    };
    set(nextState);
    await persistAssistantState(nextState);
  },

  queuePlannerOperation: async (operation) => {
    const pendingPlannerOperations = [...get().pendingPlannerOperations, operation];
    const nextState: PersistedAssistantState = {
      threads: get().threads,
      activeThreadId: get().activeThreadId,
      pendingPlannerOperations,
    };
    set({ pendingPlannerOperations });
    await persistAssistantState(nextState);
  },

  markPlannerOperationSyncing: async (operationId) => {
    const pendingPlannerOperations = get().pendingPlannerOperations.map((operation) =>
      operation.id === operationId
        ? { ...operation, status: "syncing" as const, error: null }
        : operation,
    );
    const nextState: PersistedAssistantState = {
      threads: get().threads,
      activeThreadId: get().activeThreadId,
      pendingPlannerOperations,
    };
    set({ pendingPlannerOperations });
    await persistAssistantState(nextState);
  },

  markPlannerOperationFailed: async (operationId, error) => {
    const pendingPlannerOperations = get().pendingPlannerOperations.map((operation) =>
      operation.id === operationId
        ? { ...operation, status: "failed" as const, error }
        : operation,
    );
    const nextState: PersistedAssistantState = {
      threads: get().threads,
      activeThreadId: get().activeThreadId,
      pendingPlannerOperations,
    };
    set({ pendingPlannerOperations });
    await persistAssistantState(nextState);
  },

  removePlannerOperation: async (operationId) => {
    const pendingPlannerOperations = get().pendingPlannerOperations.filter(
      (operation) => operation.id !== operationId,
    );
    const nextState: PersistedAssistantState = {
      threads: get().threads,
      activeThreadId: get().activeThreadId,
      pendingPlannerOperations,
    };
    set({ pendingPlannerOperations });
    await persistAssistantState(nextState);
  },

  deleteModelAndReset: async () => {
    const { unloadPreparedLlamaModel } = await import("@/llm/llamaProvider");
    await unloadPreparedLlamaModel();
    await deleteDownloadedModel();
    set({
      modelState: {
        ...defaultModelState,
        status: "not_downloaded",
      },
    });
  },
}));
