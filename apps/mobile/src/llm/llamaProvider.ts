import { streamText } from "ai";
import { llama } from "@react-native-ai/llama";

type LlamaMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

let activeModelPath: string | null = null;
let preparedModel: any | null = null;
let preparePromise: Promise<any> | null = null;

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

export async function unloadPreparedLlamaModel() {
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
  const model = await getPreparedLlamaModel(input.modelPath);
  const result = streamText({
    model,
    messages: input.messages,
    abortSignal: input.abortSignal,
  });

  let accumulated = "";
  for await (const delta of result.textStream) {
    accumulated += delta;
    input.onToken?.(delta, accumulated);
  }

  return accumulated.trim();
}
