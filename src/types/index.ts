export type Depot = "A" | "B" | "C";

export interface Product {
  id: string;
  code: string;
  designation: string;
  price: number;
  stockA: number;
  stockB: number;
  stockC: number;
}

export interface Client {
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
  quantity: number;
  unitPrice: number;
  total: number;
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

export interface AppData {
  products: Product[];
  clients: Client[];
  sales: Sale[];
  invoiceCounter: number;
}
