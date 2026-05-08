import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

const memoryStorage = new Map<string, string>();
const memoryFileStorage = new Map<string, string>();

const FILE_STORAGE_DIRECTORY = "app-storage";

function getFileStorageDirectoryUri() {
  if (!FileSystem.documentDirectory) {
    return null;
  }

  return `${FileSystem.documentDirectory}${FILE_STORAGE_DIRECTORY}/`;
}

function getFileStorageUri(key: string) {
  const directoryUri = getFileStorageDirectoryUri();
  if (!directoryUri) {
    return null;
  }

  return `${directoryUri}${encodeURIComponent(key)}.txt`;
}

async function ensureFileStorageDirectory() {
  const directoryUri = getFileStorageDirectoryUri();
  if (!directoryUri) {
    return null;
  }

  const info = await FileSystem.getInfoAsync(directoryUri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
  }

  return directoryUri;
}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
      return;
    } catch {
      memoryStorage.set(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
      return;
    } catch {
      memoryStorage.delete(key);
    }
  },
};

export const fileStorage = {
  async getItem(key: string): Promise<string | null> {
    const fileUri = getFileStorageUri(key);
    if (!fileUri) {
      return memoryFileStorage.get(key) ?? null;
    }

    try {
      const info = await FileSystem.getInfoAsync(fileUri);
      if (!info.exists) {
        return memoryFileStorage.get(key) ?? null;
      }

      const value = await FileSystem.readAsStringAsync(fileUri);
      memoryFileStorage.set(key, value);
      return value;
    } catch {
      return memoryFileStorage.get(key) ?? null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    const fileUri = getFileStorageUri(key);
    memoryFileStorage.set(key, value);

    if (!fileUri) {
      return;
    }

    try {
      await ensureFileStorageDirectory();
      await FileSystem.writeAsStringAsync(fileUri, value);
    } catch {
      return;
    }
  },
  async removeItem(key: string): Promise<void> {
    const fileUri = getFileStorageUri(key);
    memoryFileStorage.delete(key);

    if (!fileUri) {
      return;
    }

    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch {
      return;
    }
  },
};
