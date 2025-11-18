export type Depot = "A" | "B" | "C";

export type ProductType = string;
export const DEFAULT_PRODUCT_TYPES: ProductType[] = ["physique", "reactif"];

export interface Product {
  id: string;
  code: string;
  designation: string;
  type: ProductType;
  price: number;
  stockA: number;
  stockB: number;
  stockC: number;
  reactiveStartDate?: string | null;
  reactiveEndDate?: string | null;
}

export interface Client {
  id: string;
  name: string;
  code?: string;
  ice: string;
  ifTva: string;
  address: string;
  phone: string;
  email: string;
}

export interface Supplier {
  id: string;
  name: string;
  ice: string;
  ifTva: string;
  address: string;
  phone: string;
  email: string;
}

export interface SaleItem {
  productId: string;
  productCode: string;
  designation: string;
  productType: ProductType;
  quantity: number;
  unitPrice: number;
  total: number;
  quantityPerDepot?: Record<Depot, number>;
  reactiveStartDate?: string | null;
  reactiveEndDate?: string | null;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  depot: Depot;
  clientId: string;
  clientName: string;
  items: SaleItem[];
  totalHT: number;
  tva: number;
  totalTTC: number;
}

export interface PurchaseItem {
  id?: string;
  productId: string;
  productCode: string;
  designation: string;
  productType: ProductType;
  quantity: number;
  unitPrice: number;
  total: number;
  quantityPerDepot?: Partial<Record<Depot, number>>;
  reactiveStartDate?: string | null;
  reactiveEndDate?: string | null;
}

export interface Purchase {
  id: string;
  code: string;
  supplierId: string;
  supplierName: string;
  purchaseDate: string;
  notes?: string | null;
  items: PurchaseItem[];
  totalHT: number;
  tva: number;
  totalTTC: number;
}

export interface AppData {
  products: Product[];
  clients: Client[];
  suppliers: Supplier[];
  sales: Sale[];
  purchases: Purchase[];
  invoiceCounter: number;
  purchaseCounter: number;
  productTypes: ProductType[];
}
