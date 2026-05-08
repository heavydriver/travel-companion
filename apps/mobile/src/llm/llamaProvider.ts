import { type LlamaLanguageModel, llama } from "@react-native-ai/llama";
import { streamText } from "ai";

type LlamaMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

let activeModelPath: string | null = null;
let preparedModel: LlamaLanguageModel | null = null;
let preparePromise: Promise<LlamaLanguageModel> | null = null;
let activeGenerationPromise: Promise<void> | null = null;
let idleUnloadTimer: ReturnType<typeof setTimeout> | null = null;

const IDLE_UNLOAD_MS = 5 * 60 * 1000;

function clearIdleUnloadTimer() {
  if (!idleUnloadTimer) {
    return;
  }
  clearTimeout(idleUnloadTimer);
  idleUnloadTimer = null;
}

function scheduleIdleUnload() {
  clearIdleUnloadTimer();
  idleUnloadTimer = setTimeout(() => {
    if (activeGenerationPromise || preparePromise) {
      scheduleIdleUnload();
      return;
    }
    void unloadPreparedLlamaModel();
  }, IDLE_UNLOAD_MS);
}

function normalizeModelPath(modelPath: string) {
  if (!modelPath.startsWith("file://")) {
    return modelPath;
  }

  try {
    return decodeURIComponent(modelPath.replace(/^file:\/\//, ""));
  } catch {
    return modelPath.replace(/^file:\/\//, "");
  }
}

export async function getPreparedLlamaModel(modelPath: string) {
  clearIdleUnloadTimer();
  const normalizedModelPath = normalizeModelPath(modelPath);

  if (preparedModel && activeModelPath === normalizedModelPath) {
    return preparedModel;
  }

  if (preparePromise) {
    return preparePromise;
  }

  preparePromise = (async () => {
    if (preparedModel && activeModelPath !== normalizedModelPath) {
      try {
        await preparedModel.unload?.();
      } catch {
        // best effort
      }
    }

    const nextModel = llama.languageModel(normalizedModelPath);
    await nextModel.prepare();
    preparedModel = nextModel;
    activeModelPath = normalizedModelPath;
    return nextModel;
  })();

  try {
    return await preparePromise;
  } finally {
    preparePromise = null;
  }
}

async function resetPreparedModel(model: LlamaLanguageModel | null) {
  if (!model) {
    if (!preparedModel) {
      activeModelPath = null;
    }
    return;
  }

  const shouldClearPreparedModel = preparedModel === model;

  try {
    await model.unload?.();
  } catch {
    // best effort
  } finally {
    if (shouldClearPreparedModel) {
      preparedModel = null;
      activeModelPath = null;
    }
  }
}

async function waitForActiveGeneration() {
  if (!activeGenerationPromise) {
    return;
  }

  try {
    await activeGenerationPromise;
  } catch {
    // best effort
  }
}

export async function unloadPreparedLlamaModel() {
  clearIdleUnloadTimer();
  if (!preparedModel) {
    activeModelPath = null;
    return;
  }

  try {
    await preparedModel.unload?.();
  } finally {
    preparedModel = null;
    activeModelPath = null;
  }
}

export async function streamLlamaText(input: {
  modelPath: string;
  messages: LlamaMessage[];
  onToken?: (token: string, accumulatedText: string) => void;
  abortSignal?: AbortSignal;
}) {
  clearIdleUnloadTimer();
  await waitForActiveGeneration();

  const model = await getPreparedLlamaModel(input.modelPath);
  let shouldResetModel = false;

  const result = streamText({
    model,
    messages: input.messages,
    abortSignal: input.abortSignal,
  });

  let accumulated = "";
  let aborted = Boolean(input.abortSignal?.aborted);
  const iterator = result.textStream[Symbol.asyncIterator]();
  const cancelStream = async () => {
    try {
      await iterator.return?.();
    } catch {
      // best effort
    }
  };
  const handleAbort = () => {
    aborted = true;
    shouldResetModel = true;
    void cancelStream();
  };

  if (input.abortSignal) {
    if (input.abortSignal.aborted) {
      handleAbort();
    } else {
      input.abortSignal.addEventListener("abort", handleAbort, { once: true });
    }
  }

  const generationPromise = (async () => {
    while (true) {
      const { done, value } = await iterator.next();
      if (done) {
        break;
      }

      const delta = value;
      accumulated += delta;
      input.onToken?.(delta, accumulated);
    }
  })();
  const trackedGenerationPromise = generationPromise.then(
    () => undefined,
    () => undefined,
  );
  activeGenerationPromise = trackedGenerationPromise;

  try {
    await generationPromise;
    if (aborted || input.abortSignal?.aborted) {
      throw input.abortSignal?.reason ?? new Error("Generation stopped");
    }
    return accumulated.trim();
  } catch (error) {
    shouldResetModel = true;
    throw error;
  } finally {
    if (input.abortSignal) {
      input.abortSignal.removeEventListener("abort", handleAbort);
    }
    await trackedGenerationPromise;
    if (activeGenerationPromise === trackedGenerationPromise) {
      activeGenerationPromise = null;
    }
    if (shouldResetModel) {
      await resetPreparedModel(model);
    } else if (preparedModel && activeModelPath === normalizeModelPath(input.modelPath)) {
      scheduleIdleUnload();
    }
  }
}
