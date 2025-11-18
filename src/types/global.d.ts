import type { AppData } from "@/types";

declare global {
  interface Window {
    electronAPI?: {
      loadData: () => AppData;
      saveData: (data: AppData) => void;
    };
  }
}

export {};
