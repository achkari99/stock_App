import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { AppData, Client, Depot, Product, ProductType, Sale, Supplier, Purchase } from "@/types";
import {
  defaultData,
  loadInitialData,
  addProductType as addProductTypeRequest,
  deleteProductType as deleteProductTypeRequest,
  createProduct as createProductRequest,
  updateProduct as updateProductRequest,
  deleteProduct as deleteProductRequest,
  createClient as createClientRequest,
  updateClient as updateClientRequest,
  deleteClient as deleteClientRequest,
  createSupplier as createSupplierRequest,
  updateSupplier as updateSupplierRequest,
  deleteSupplier as deleteSupplierRequest,
  createSale as createSaleRequest,
  deleteSale as deleteSaleRequest,
  createPurchase as createPurchaseRequest,
  updatePurchase as updatePurchaseRequest,
  deletePurchase as deletePurchaseRequest,
  type CreateProductInput,
  type UpdateProductInput,
  type CreateClientInput,
  type UpdateClientInput,
  type CreateSaleInput,
  type CreateSupplierInput,
  type UpdateSupplierInput,
  type CreatePurchaseInput,
  type UpdatePurchaseInput,
} from "@/lib/storage";

interface AppContextType extends AppData {
  currentDepot: Depot;
  setCurrentDepot: (depot: Depot) => void;
  reloadData: () => Promise<void>;
  isLoading: boolean;
  addProductType: (name: ProductType) => Promise<ProductType[]>;
  removeProductType: (name: ProductType) => Promise<ProductType[]>;
  createProduct: (input: CreateProductInput) => Promise<Product>;
  updateProduct: (input: UpdateProductInput) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  createClient: (input: CreateClientInput) => Promise<Client>;
  updateClient: (input: UpdateClientInput) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
  createSupplier: (input: CreateSupplierInput) => Promise<Supplier>;
  updateSupplier: (input: UpdateSupplierInput) => Promise<Supplier>;
  deleteSupplier: (id: string) => Promise<void>;
  createSale: (input: CreateSaleInput) => Promise<Sale>;
  deleteSale: (id: string) => Promise<void>;
  createPurchase: (input: CreatePurchaseInput) => Promise<Purchase>;
  updatePurchase: (input: UpdatePurchaseInput) => Promise<Purchase>;
  deletePurchase: (id: string, updatedProducts: Product[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const updateCounterFromCode = (code: string, current: number): number => {
  const suffix = code.split("-").pop();
  const parsed = suffix ? parseInt(suffix, 10) : NaN;
  if (Number.isNaN(parsed)) {
    return current;
  }
  return Math.max(current, parsed);
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<AppData>(defaultData);
  const [currentDepot, setCurrentDepot] = useState<Depot>("A");
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await loadInitialData();
      setData(loaded);
    } catch (error) {
      console.error("Erreur de chargement des donnees:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const reloadData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const addProductType = useCallback(async (name: ProductType) => {
    const nextTypes = await addProductTypeRequest(name);
    setData((prev) => ({ ...prev, productTypes: nextTypes }));
    return nextTypes;
  }, []);

  const removeProductType = useCallback(async (name: ProductType) => {
    const nextTypes = await deleteProductTypeRequest(name);
    setData((prev) => ({ ...prev, productTypes: nextTypes }));
    return nextTypes;
  }, []);

  const createProduct = useCallback(async (input: CreateProductInput) => {
    const product = await createProductRequest(input);
    setData((prev) => ({ ...prev, products: [...prev.products, product] }));
    return product;
  }, []);

  const updateProduct = useCallback(async (input: UpdateProductInput) => {
    const product = await updateProductRequest(input);
    setData((prev) => ({
      ...prev,
      products: prev.products.map((existing) => (existing.id === product.id ? product : existing)),
    }));
    return product;
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await deleteProductRequest(id);
    setData((prev) => ({
      ...prev,
      products: prev.products.filter((product) => product.id !== id),
    }));
  }, []);

  const createClient = useCallback(async (input: CreateClientInput) => {
    const client = await createClientRequest(input);
    setData((prev) => ({ ...prev, clients: [...prev.clients, client] }));
    return client;
  }, []);

  const updateClient = useCallback(async (input: UpdateClientInput) => {
    const client = await updateClientRequest(input);
    setData((prev) => ({
      ...prev,
      clients: prev.clients.map((existing) => (existing.id === client.id ? client : existing)),
    }));
    return client;
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    await deleteClientRequest(id);
    setData((prev) => ({
      ...prev,
      clients: prev.clients.filter((client) => client.id !== id),
    }));
  }, []);

  const createSupplier = useCallback(async (input: CreateSupplierInput) => {
    const supplier = await createSupplierRequest(input);
    setData((prev) => ({ ...prev, suppliers: [...prev.suppliers, supplier] }));
    return supplier;
  }, []);

  const updateSupplier = useCallback(async (input: UpdateSupplierInput) => {
    const supplier = await updateSupplierRequest(input);
    setData((prev) => ({
      ...prev,
      suppliers: prev.suppliers.map((existing) => (existing.id === supplier.id ? supplier : existing)),
    }));
    return supplier;
  }, []);

  const deleteSupplier = useCallback(async (id: string) => {
    await deleteSupplierRequest(id);
    setData((prev) => ({
      ...prev,
      suppliers: prev.suppliers.filter((supplier) => supplier.id !== id),
    }));
  }, []);

  const createSale = useCallback(async (input: CreateSaleInput) => {
    const sale = await createSaleRequest(input);
    setData((prev) => {
      const products = prev.products.map((product) => {
        const updated = input.updatedProducts.find((item) => item.id === product.id);
        return updated ?? product;
      });

      const nextCounter = (() => {
        const suffix = sale.invoiceNumber.split("-").pop();
        const parsed = suffix ? parseInt(suffix, 10) : prev.invoiceCounter;
        return Number.isNaN(parsed) ? prev.invoiceCounter : Math.max(prev.invoiceCounter, parsed);
      })();

      return {
        ...prev,
        products,
        sales: [...prev.sales, sale],
        invoiceCounter: nextCounter,
      };
    });
    return sale;
  }, []);

  const deleteSale = useCallback(async (id: string) => {
    await deleteSaleRequest(id);
    setData((prev) => ({
      ...prev,
      sales: prev.sales.filter((sale) => sale.id !== id),
    }));
  }, []);

  const createPurchase = useCallback(async (input: CreatePurchaseInput) => {
    const purchase = await createPurchaseRequest(input);
    setData((prev) => ({
      ...prev,
      purchases: [...prev.purchases, purchase],
      products: input.updatedProducts,
      purchaseCounter: updateCounterFromCode(purchase.code, prev.purchaseCounter),
    }));
    return purchase;
  }, []);

  const updatePurchase = useCallback(async (input: UpdatePurchaseInput) => {
    const purchase = await updatePurchaseRequest(input);
    setData((prev) => ({
      ...prev,
      purchases: prev.purchases.map((existing) => (existing.id === purchase.id ? purchase : existing)),
      products: input.updatedProducts,
      purchaseCounter: updateCounterFromCode(purchase.code, prev.purchaseCounter),
    }));
    return purchase;
  }, []);

  const deletePurchase = useCallback(
    async (id: string, updatedProducts: Product[]) => {
      await deletePurchaseRequest(id, updatedProducts);
      setData((prev) => ({
        ...prev,
        purchases: prev.purchases.filter((purchase) => purchase.id !== id),
        products: updatedProducts,
      }));
    },
    [],
  );

  return (
    <AppContext.Provider
      value={{
        ...data,
        currentDepot,
        setCurrentDepot,
        reloadData,
        isLoading,
        addProductType,
        removeProductType,
        createProduct,
        updateProduct,
        deleteProduct,
        createClient,
        updateClient,
        deleteClient,
        createSupplier,
        updateSupplier,
        deleteSupplier,
        createSale,
        deleteSale,
        createPurchase,
        updatePurchase,
        deletePurchase,
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
