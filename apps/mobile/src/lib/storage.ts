import AsyncStorage from "@react-native-async-storage/async-storage";

const memoryStorage = new Map<string, string>();

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
