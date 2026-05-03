import type {
  DownloadOptions,
  DownloadPauseState,
  DownloadProgressData,
  DownloadResumable,
} from "expo-file-system/legacy";
import * as FileSystem from "expo-file-system/legacy";
import { storage } from "@/lib/storage";

const MODEL_METADATA_KEY = "travel_companion_ai_model_metadata";
const MODEL_RESUME_KEY = "travel_companion_ai_model_resume";

export const MODEL_FILENAME = "gemma-2-2b-it-Q4_K_M.gguf";
export const MODEL_HUGGINGFACE_ID =
  "bartowski/gemma-2-2b-it-GGUF/gemma-2-2b-it-Q4_K_M.gguf";
export const MODEL_DOWNLOAD_URL =
  "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf";
export const MODEL_APPROX_SIZE_BYTES = 1.71 * 1024 * 1024 * 1024;

export type StoredModelMetadata = {
  fileName: string;
  uri: string;
  sizeBytes: number;
  downloadedAt: string;
};

export type DownloadProgress = {
  progress: number;
  totalBytesWritten: number;
  totalBytesExpected: number;
};

export type StoredResumeState = {
  url: string;
  fileUri: string;
  options?: DownloadOptions;
  resumeData?: string | null;
};

let currentDownloadResumable: DownloadResumable | null = null;

function getModelDirectoryUri() {
  if (!FileSystem.documentDirectory) {
    throw new Error("Document directory is unavailable on this device");
  }

  return `${FileSystem.documentDirectory}models/`;
}

export function getModelUri() {
  return `${getModelDirectoryUri()}${MODEL_FILENAME}`;
}

async function ensureModelDirectory() {
  const dir = getModelDirectoryUri();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function readResumeState(): Promise<StoredResumeState | null> {
  try {
    const raw = await storage.getItem(MODEL_RESUME_KEY);
    return raw ? (JSON.parse(raw) as StoredResumeState) : null;
  } catch {
    return null;
  }
}

async function writeResumeState(state: StoredResumeState | null) {
  if (!state) {
    await storage.removeItem(MODEL_RESUME_KEY);
    return;
  }
  await storage.setItem(MODEL_RESUME_KEY, JSON.stringify(state));
}

function toProgress(
  data: DownloadProgressData | null | undefined,
): DownloadProgress {
  const totalBytesExpected =
    data?.totalBytesExpectedToWrite ?? MODEL_APPROX_SIZE_BYTES;
  const totalBytesWritten = data?.totalBytesWritten ?? 0;

  return {
    progress:
      totalBytesExpected > 0
        ? Math.max(0, Math.min(1, totalBytesWritten / totalBytesExpected))
        : 0,
    totalBytesWritten,
    totalBytesExpected,
  };
}

function createResumable(
  resumeState: StoredResumeState | null,
  onProgress?: (progress: DownloadProgress) => void,
) {
  const fileUri = resumeState?.fileUri ?? getModelUri();

  const resumable = FileSystem.createDownloadResumable(
    MODEL_DOWNLOAD_URL,
    fileUri,
    resumeState?.options,
    (progressData) => {
      const progress = toProgress(progressData);
      onProgress?.(progress);
      const savable = resumable.savable();
      void writeResumeState({
        url: MODEL_DOWNLOAD_URL,
        fileUri,
        options: savable.options,
        resumeData: savable.resumeData,
      });
    },
    resumeState?.resumeData ?? undefined,
  );

  return resumable;
}

export async function getStoredModelMetadata(): Promise<StoredModelMetadata | null> {
  const fileUri = getModelUri();
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (!fileInfo.exists) {
    await storage.removeItem(MODEL_METADATA_KEY);
    return null;
  }

  try {
    const raw = await storage.getItem(MODEL_METADATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredModelMetadata;
      return {
        ...parsed,
        uri: fileUri,
        sizeBytes: fileInfo.size ?? parsed.sizeBytes ?? MODEL_APPROX_SIZE_BYTES,
      };
    }
  } catch {
    // fall through to synthesized metadata
  }

  const metadata: StoredModelMetadata = {
    fileName: MODEL_FILENAME,
    uri: fileUri,
    sizeBytes: fileInfo.size ?? MODEL_APPROX_SIZE_BYTES,
    downloadedAt: new Date().toISOString(),
  };
  await storage.setItem(MODEL_METADATA_KEY, JSON.stringify(metadata));
  return metadata;
}

async function finalizeSuccessfulDownload(uri: string) {
  const fileInfo = await FileSystem.getInfoAsync(uri);
  const metadata: StoredModelMetadata = {
    fileName: MODEL_FILENAME,
    uri,
    sizeBytes: fileInfo.exists ? fileInfo.size : MODEL_APPROX_SIZE_BYTES,
    downloadedAt: new Date().toISOString(),
  };
  await storage.setItem(MODEL_METADATA_KEY, JSON.stringify(metadata));
  await writeResumeState(null);
  return metadata;
}

export async function isModelDownloaded() {
  return (await getStoredModelMetadata()) != null;
}

export async function hasPausedModelDownload() {
  return (await readResumeState()) != null;
}

export async function startModelDownload(
  onProgress?: (progress: DownloadProgress) => void,
) {
  await ensureModelDirectory();
  const existing = await getStoredModelMetadata();
  if (existing) {
    onProgress?.({
      progress: 1,
      totalBytesWritten: existing.sizeBytes,
      totalBytesExpected: existing.sizeBytes,
    });
    return existing;
  }

  currentDownloadResumable = createResumable(null, onProgress);
  const result = await currentDownloadResumable.downloadAsync();
  if (!result?.uri) {
    throw new Error("Model download did not return a file path");
  }

  currentDownloadResumable = null;
  return finalizeSuccessfulDownload(result.uri);
}

export async function pauseModelDownload() {
  if (!currentDownloadResumable) {
    return;
  }

  const paused =
    (await currentDownloadResumable.pauseAsync()) as DownloadPauseState;
  currentDownloadResumable = null;
  await writeResumeState({
    url: MODEL_DOWNLOAD_URL,
    fileUri: paused.url ?? getModelUri(),
    options: paused.options,
    resumeData: paused.resumeData,
  });
}

export async function resumeModelDownload(
  onProgress?: (progress: DownloadProgress) => void,
) {
  await ensureModelDirectory();
  const resumeState = await readResumeState();
  if (!resumeState?.resumeData) {
    return startModelDownload(onProgress);
  }

  currentDownloadResumable = createResumable(resumeState, onProgress);
  const result = await currentDownloadResumable.resumeAsync();
  if (!result?.uri) {
    throw new Error("Model resume did not return a file path");
  }

  currentDownloadResumable = null;
  return finalizeSuccessfulDownload(result.uri);
}

export async function deleteDownloadedModel() {
  currentDownloadResumable = null;
  const fileUri = getModelUri();
  const info = await FileSystem.getInfoAsync(fileUri);
  if (info.exists) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  }
  await storage.removeItem(MODEL_METADATA_KEY);
  await writeResumeState(null);
}
