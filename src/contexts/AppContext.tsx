import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AppData, Depot } from "@/types";
import { loadData, saveData } from "@/lib/storage";

interface AppContextType extends AppData {
  currentDepot: Depot;
  setCurrentDepot: (depot: Depot) => void;
  updateData: (data: Partial<AppData>) => void;
  reloadData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<AppData>(loadData());
  const [currentDepot, setCurrentDepot] = useState<Depot>("A");

  useEffect(() => {
    saveData(data);
  }, [data]);

  const updateData = (updates: Partial<AppData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const reloadData = () => {
    setData(loadData());
  };

  return (
    <AppContext.Provider
      value={{
        ...data,
        currentDepot,
        setCurrentDepot,
        updateData,
        reloadData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
};
