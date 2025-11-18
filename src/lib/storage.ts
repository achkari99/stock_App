import { supabase } from "@/lib/supabaseClient";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  AppData,
  Client,
  Supplier,
  DEFAULT_PRODUCT_TYPES,
  Depot,
  Product,
  ProductType,
  Sale,
  SaleItem,
  Purchase,
  PurchaseItem,
} from "@/types";

const STORAGE_KEY = "stock-management-data";

export const defaultData: AppData = {
  products: [],
  clients: [],
  suppliers: [],
  sales: [],
  purchases: [],
  invoiceCounter: 0,
  purchaseCounter: 0,
  productTypes: [...DEFAULT_PRODUCT_TYPES],
};

export type CreateProductInput = Omit<Product, "id">;
export type UpdateProductInput = Product;

export type CreateClientInput = Omit<Client, "id">;
export type UpdateClientInput = Client;

export type CreateSupplierInput = Omit<Supplier, "id">;
export type UpdateSupplierInput = Supplier;

export interface CreateSaleInput {
  sale: Omit<Sale, "id">;
  updatedProducts: Product[];
}

export interface CreatePurchaseInput {
  purchase: Omit<Purchase, "id">;
  updatedProducts: Product[];
}

export interface UpdatePurchaseInput {
  purchase: Purchase;
  updatedProducts: Product[];
}

interface DataSource {
  loadInitialData(): Promise<AppData>;
  addProductType(name: ProductType): Promise<ProductType[]>;
  deleteProductType(name: ProductType): Promise<ProductType[]>;
  createProduct(input: CreateProductInput): Promise<Product>;
  updateProduct(input: UpdateProductInput): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  createClient(input: CreateClientInput): Promise<Client>;
  updateClient(input: UpdateClientInput): Promise<Client>;
  deleteClient(id: string): Promise<void>;
  createSupplier(input: CreateSupplierInput): Promise<Supplier>;
  updateSupplier(input: UpdateSupplierInput): Promise<Supplier>;
  deleteSupplier(id: string): Promise<void>;
  createSale(input: CreateSaleInput): Promise<Sale>;
  deleteSale(id: string): Promise<void>;
  createPurchase(input: CreatePurchaseInput): Promise<Purchase>;
  updatePurchase(input: UpdatePurchaseInput): Promise<Purchase>;
  deletePurchase(id: string, updatedProducts: Product[]): Promise<void>;
}

type ProductTypeRow = {
  id: string;
  name: string;
};

type ClientRow = {
  id: string;
  name: string | null;
  client_code: string | null;
  ice: string | null;
  if_tva: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
};

type SupplierRow = ClientRow;

type SaleRow = {
  id: string;
  invoice_number: string;
  sale_date: string;
  depot: Depot;
  client_id: string | null;
  client_name: string | null;
  total_ht: number | string | null;
  tva: number | string | null;
  total_ttc: number | string | null;
};

type PurchaseRow = {
  id: string;
  code: string;
  supplier_id: string | null;
  supplier_name: string | null;
  purchase_date: string;
  notes: string | null;
  total_ht: number | string | null;
  tva: number | string | null;
  total_ttc: number | string | null;
};

const normalize = (value: string) => value.trim().toLowerCase();
const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
const throwIfTableMissing = (error: PostgrestError | null, table: string) => {
  if (!error) {
    return;
  }
  if (error.code === "42P01") {
    throw new Error(`Table "${table}" introuvable. Veuillez exécuter le script SQL de création Supabase.`);
  }
  throw error;
};

class SupabaseDataSource implements DataSource {
  private buildDepotQuantitiesFromRow(row: {
    quantity_depot_a?: number | string | null;
    quantity_depot_b?: number | string | null;
    quantity_depot_c?: number | string | null;
  }): Partial<Record<Depot, number>> | undefined {
    const entries: [Depot, number][] = [];
    (["A", "B", "C"] as Depot[]).forEach((depot) => {
      const key =
        depot === "A" ? "quantity_depot_a" : depot === "B" ? "quantity_depot_b" : "quantity_depot_c";
      const raw = row[key as keyof typeof row];
      if (raw === undefined || raw === null) {
        return;
      }
      const parsed = Number(raw);
      if (Number.isNaN(parsed) || parsed === 0) {
        return;
      }
      entries.push([depot, parsed]);
    });

    if (entries.length === 0) {
      return undefined;
    }
    return Object.fromEntries(entries) as Partial<Record<Depot, number>>;
  }

  private async fetchProductTypes(): Promise<ProductTypeRow[]> {
    const { data, error } = await supabase!
      .from("app_product_types")
      .select("id, name")
      .order("name", { ascending: true });

    throwIfTableMissing(error as PostgrestError | null, "app_product_types");

    return data ?? [];
  }

  private async ensureDefaultProductTypes(): Promise<void> {
    const rows = await this.fetchProductTypes();
    const existing = new Set(rows.map((row) => normalize(row.name)));
    const missing = DEFAULT_PRODUCT_TYPES.filter((type) => !existing.has(normalize(type)));

    if (missing.length === 0) {
      return;
    }

    const insertPayload = missing.map((name) => ({ name }));
    const { error } = await supabase!.from("app_product_types").upsert(insertPayload, {
      onConflict: "name",
    });

    if (error && (error as PostgrestError).code !== "23505") {
      throw error;
    }
  }

  private async resolveProductTypeId(typeName: ProductType): Promise<ProductTypeRow> {
    const trimmed = typeName.trim();
    if (!trimmed) {
      throw new Error("Type de produit invalide.");
    }

    const { data, error } = await supabase!
      .from("app_product_types")
      .select("id, name")
      .ilike("name", trimmed)
      .maybeSingle();

    if (error && (error as PostgrestError).code !== "PGRST116") {
      throw error;
    }

    if (!data) {
      const insertResult = await supabase!
        .from("app_product_types")
        .insert({ name: trimmed })
        .select("id, name")
        .single();

      if (insertResult.error) {
        throw insertResult.error;
      }
      return insertResult.data;
    }

    return data;
  }

  private mapProduct(
    row: {
      id: string;
      code: string;
      designation: string;
      price: number | string;
      reactive_start_date: string | null;
      reactive_end_date: string | null;
      product_type_id: string;
    },
    typeById: Map<string, string>,
    stockMap: Map<string, { A: number; B: number; C: number }>,
  ): Product {
    const stock = stockMap.get(row.id) ?? { A: 0, B: 0, C: 0 };

    return {
      id: row.id,
      code: row.code,
      designation: row.designation,
      type: typeById.get(row.product_type_id) ?? DEFAULT_PRODUCT_TYPES[0],
      price: Number(row.price ?? 0),
      stockA: stock.A ?? 0,
      stockB: stock.B ?? 0,
      stockC: stock.C ?? 0,
      reactiveStartDate: row.reactive_start_date,
      reactiveEndDate: row.reactive_end_date,
    };
  }

  private mapClient(row: ClientRow): Client {
    return {
      id: row.id,
      name: row.name ?? "",
      code: row.client_code ?? undefined,
      ice: row.ice ?? "",
      ifTva: row.if_tva ?? "",
      address: row.address ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
    };
  }

  private mapSupplier(row: SupplierRow): Supplier {
    return {
      id: row.id,
      name: row.name ?? "",
      ice: row.ice ?? "",
      ifTva: row.if_tva ?? "",
      address: row.address ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
    };
  }

  private mapSale(row: SaleRow, itemMap: Map<string, SaleItem[]>): Sale {
    const saleItems = itemMap.get(row.id) ?? [];
    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      date: row.sale_date,
      depot: row.depot,
      clientId: row.client_id ?? "",
      clientName: row.client_name ?? "",
      items: saleItems,
      totalHT: Number(row.total_ht ?? 0),
      tva: Number(row.tva ?? 0),
      totalTTC: Number(row.total_ttc ?? 0),
    };
  }

  private mapPurchase(row: PurchaseRow, itemMap: Map<string, PurchaseItem[]>): Purchase {
    return {
      id: row.id,
      code: row.code ?? "",
      supplierId: row.supplier_id ?? "",
      supplierName: row.supplier_name ?? "",
      purchaseDate: row.purchase_date,
      notes: row.notes ?? null,
      items: itemMap.get(row.id) ?? [],
      totalHT: Number(row.total_ht ?? 0),
      tva: Number(row.tva ?? 0),
      totalTTC: Number(row.total_ttc ?? 0),
    };
  }

  private async fetchProducts(typeById: Map<string, string>): Promise<Product[]> {
    const [{ data: productRows, error: productError }, { data: stockRows, error: stockError }] =
      await Promise.all([
        supabase!
          .from("app_products")
          .select("id, code, designation, product_type_id, price, reactive_start_date, reactive_end_date")
          .order("designation", { ascending: true }),
        supabase!.from("app_product_stock").select("product_id, depot, quantity"),
      ]);

    if (productError) {
      throwIfTableMissing(productError as PostgrestError, "app_products");
      throw productError;
    }
    if (stockError) {
      throwIfTableMissing(stockError as PostgrestError, "app_product_stock");
      throw stockError;
    }

    const stockMap = new Map<string, { A: number; B: number; C: number }>();
    (stockRows ?? []).forEach((row) => {
      const entry = stockMap.get(row.product_id) ?? { A: 0, B: 0, C: 0 };
      entry[row.depot as Depot] = Number(row.quantity ?? 0);
      stockMap.set(row.product_id, entry);
    });

    return (productRows ?? []).map((row) => this.mapProduct(row, typeById, stockMap));
  }

  private async fetchClients(): Promise<Client[]> {
    const { data, error } = await supabase!
      .from("app_clients")
      .select("id, name, client_code, ice, if_tva, address, phone, email")
      .order("name", { ascending: true });

    if (error) {
      throwIfTableMissing(error as PostgrestError, "app_clients");
      throw error;
    }

    return (data ?? []).map((row) => this.mapClient(row));
  }

  private async fetchSuppliers(): Promise<Supplier[]> {
    const { data, error } = await supabase!
      .from("app_suppliers")
      .select("id, name, ice, if_tva, address, phone, email")
      .order("name", { ascending: true });

    if (error) {
      throwIfTableMissing(error as PostgrestError, "app_suppliers");
      throw error;
    }

    return (data ?? []).map((row) => this.mapSupplier(row));
  }

  private async fetchSales(typeById: Map<string, string>): Promise<Sale[]> {
    const [{ data: saleRows, error: saleError }, { data: saleItemRows, error: itemError }, { data: depotRows, error: depotError }] =
      await Promise.all([
        supabase!
          .from("app_sales")
          .select("id, invoice_number, sale_date, depot, client_id, client_name, total_ht, tva, total_ttc")
          .order("sale_date", { ascending: true }),
        supabase!
          .from("app_sale_items")
          .select(
            "id, sale_id, product_id, product_code, designation, product_type_id, quantity, unit_price, total, reactive_start_date, reactive_end_date",
          ),
        supabase!.from("app_sale_item_depot_quantities").select("sale_item_id, depot, quantity"),
      ]);

    if (saleError) {
      throwIfTableMissing(saleError as PostgrestError, "app_sales");
      throw saleError;
    }
    if (itemError) {
      throwIfTableMissing(itemError as PostgrestError, "app_sale_items");
      throw itemError;
    }
    if (depotError) {
      throwIfTableMissing(depotError as PostgrestError, "app_sale_item_depot_quantities");
      throw depotError;
    }

    const depotQuantityMap = new Map<string, Record<Depot, number>>();
    (depotRows ?? []).forEach((row) => {
      const current = depotQuantityMap.get(row.sale_item_id) ?? { A: 0, B: 0, C: 0 };
      current[row.depot as Depot] = Number(row.quantity ?? 0);
      depotQuantityMap.set(row.sale_item_id, current);
    });

    const saleItemMap = new Map<string, SaleItem[]>();
    (saleItemRows ?? []).forEach((row) => {
      const items = saleItemMap.get(row.sale_id) ?? [];
      items.push({
        productId: row.product_id ?? "",
        productCode: row.product_code ?? "",
        designation: row.designation ?? "",
        productType: typeById.get(row.product_type_id) ?? DEFAULT_PRODUCT_TYPES[0],
        quantity: Number(row.quantity ?? 0),
        unitPrice: Number(row.unit_price ?? 0),
        total: Number(row.total ?? 0),
        quantityPerDepot: depotQuantityMap.get(row.id) ?? undefined,
        reactiveStartDate: row.reactive_start_date,
        reactiveEndDate: row.reactive_end_date,
      });
      saleItemMap.set(row.sale_id, items);
    });

    return (saleRows ?? []).map((row) => this.mapSale(row, saleItemMap));
  }

  private async fetchPurchases(typeById: Map<string, string>): Promise<Purchase[]> {
    const [{ data: purchaseRows, error: purchaseError }, { data: itemRows, error: itemError }] =
      await Promise.all([
        supabase!
          .from("app_purchases")
          .select("id, code, supplier_id, supplier_name, purchase_date, notes, total_ht, tva, total_ttc")
          .order("purchase_date", { ascending: false }),
        supabase!
          .from("app_purchase_items")
          .select(
            "id, purchase_id, product_id, product_code, designation, product_type_id, quantity, unit_price, total, quantity_depot_a, quantity_depot_b, quantity_depot_c, reactive_start_date, reactive_end_date",
          ),
      ]);

    if (purchaseError) {
      throwIfTableMissing(purchaseError as PostgrestError, "app_purchases");
      throw purchaseError;
    }

    if (itemError) {
      throwIfTableMissing(itemError as PostgrestError, "app_purchase_items");
      throw itemError;
    }

    const itemMap = new Map<string, PurchaseItem[]>();

    (itemRows ?? []).forEach((row) => {
      const perDepot = this.buildDepotQuantitiesFromRow(row);

      const items = itemMap.get(row.purchase_id) ?? [];
      items.push({
        id: row.id,
        productId: row.product_id ?? "",
        productCode: row.product_code ?? "",
        designation: row.designation ?? "",
        productType: typeById.get(row.product_type_id) ?? DEFAULT_PRODUCT_TYPES[0],
        quantity: Number(row.quantity ?? 0),
        unitPrice: Number(row.unit_price ?? 0),
        total: Number(row.total ?? 0),
        quantityPerDepot: perDepot,
        reactiveStartDate: row.reactive_start_date,
        reactiveEndDate: row.reactive_end_date,
      });
      itemMap.set(row.purchase_id, items);
    });

    return (purchaseRows ?? []).map((row) => this.mapPurchase(row, itemMap));
  }

  private computeInvoiceCounter(sales: Sale[]): number {
    const currentYear = new Date().getFullYear();
    const prefix = `FAC-${currentYear}-`;
    let max = 0;
    for (const sale of sales) {
      if (!sale.invoiceNumber?.startsWith(prefix)) {
        continue;
      }
      const suffix = sale.invoiceNumber.slice(prefix.length);
      const parsed = parseInt(suffix, 10);
      if (!Number.isNaN(parsed)) {
        max = Math.max(max, parsed);
      }
    }
    return max;
  }

  private computePurchaseCounter(purchases: Purchase[]): number {
    const currentYear = new Date().getFullYear();
    const prefix = `ACH-${currentYear}-`;
    let max = 0;
    for (const purchase of purchases) {
      if (!purchase.code?.startsWith(prefix)) {
        continue;
      }
      const suffix = purchase.code.slice(prefix.length);
      const parsed = parseInt(suffix, 10);
      if (!Number.isNaN(parsed)) {
        max = Math.max(max, parsed);
      }
    }
    return max;
  }

  public async loadInitialData(): Promise<AppData> {
    await this.ensureDefaultProductTypes();
    const typeRows = await this.fetchProductTypes();
    const typeById = new Map(typeRows.map((row) => [row.id, row.name]));
    const productTypes = typeRows.map((row) => row.name);

    const [products, clients, suppliers, sales, purchases] = await Promise.all([
      this.fetchProducts(typeById),
      this.fetchClients(),
      this.fetchSuppliers(),
      this.fetchSales(typeById),
      this.fetchPurchases(typeById),
    ]);

    return {
      products,
      clients,
      suppliers,
      sales,
      purchases,
      productTypes: Array.from(new Set([...DEFAULT_PRODUCT_TYPES, ...productTypes])),
      invoiceCounter: this.computeInvoiceCounter(sales),
      purchaseCounter: this.computePurchaseCounter(purchases),
    };
  }

  public async addProductType(name: ProductType): Promise<ProductType[]> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Nom de type invalide.");
    }

    const { error } = await supabase!.from("app_product_types").insert({ name: trimmed });
    if (error && (error as PostgrestError).code !== "23505") {
      throw error;
    }

    const rows = await this.fetchProductTypes();
    return Array.from(new Set([...DEFAULT_PRODUCT_TYPES, ...rows.map((row) => row.name)]));
  }

  public async deleteProductType(name: ProductType): Promise<ProductType[]> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Nom de type invalide.");
    }

    if (DEFAULT_PRODUCT_TYPES.some((type) => normalize(type) === normalize(trimmed))) {
      throw new Error("Impossible de supprimer un type par defaut.");
    }

    const { data: targetRow, error: fetchError } = await supabase!
      .from("app_product_types")
      .select("id")
      .eq("name", trimmed)
      .maybeSingle();

    if (fetchError && (fetchError as PostgrestError).code !== "PGRST116") {
      throw fetchError;
    }

    if (!targetRow) {
      return this.loadInitialData().then((data) => data.productTypes);
    }

    const { data: productRefs, error: refError } = await supabase!
      .from("app_products")
      .select("id")
      .eq("product_type_id", targetRow.id)
      .limit(1);

    if (refError) {
      throw refError;
    }

    if (productRefs && productRefs.length > 0) {
      throw new Error("Ce type est encore utilise par au moins un produit.");
    }

    const { error } = await supabase!
      .from("app_product_types")
      .delete()
      .eq("id", targetRow.id);

    if (error) {
      throw error;
    }

    const rows = await this.fetchProductTypes();
    return Array.from(new Set([...DEFAULT_PRODUCT_TYPES, ...rows.map((row) => row.name)]));
  }

  public async createProduct(input: CreateProductInput): Promise<Product> {
    const typeRow = await this.resolveProductTypeId(input.type);

    const { data: productRow, error: insertError } = await supabase!
      .from("app_products")
      .insert({
        code: input.code,
        designation: input.designation,
        product_type_id: typeRow.id,
        price: input.price,
        reactive_start_date: input.reactiveStartDate ?? null,
        reactive_end_date: input.reactiveEndDate ?? null,
      })
      .select("id, code, designation, product_type_id, price, reactive_start_date, reactive_end_date")
      .single();

    if (insertError) {
      throw insertError;
    }

    const stockPayload = [
      { product_id: productRow.id, depot: "A", quantity: input.stockA ?? 0 },
      { product_id: productRow.id, depot: "B", quantity: input.stockB ?? 0 },
      { product_id: productRow.id, depot: "C", quantity: input.stockC ?? 0 },
    ];

    const { error: stockError } = await supabase!
      .from("app_product_stock")
      .upsert(stockPayload, { onConflict: "product_id,depot" });

    if (stockError) {
      throw stockError;
    }

    const stockMap = new Map([[productRow.id, { A: input.stockA ?? 0, B: input.stockB ?? 0, C: input.stockC ?? 0 }]]);
    return this.mapProduct(productRow, new Map([[typeRow.id, typeRow.name]]), stockMap);
  }

  public async updateProduct(input: UpdateProductInput): Promise<Product> {
    const typeRow = await this.resolveProductTypeId(input.type);

    const { data: updatedRow, error: updateError } = await supabase!
      .from("app_products")
      .update({
        code: input.code,
        designation: input.designation,
        product_type_id: typeRow.id,
        price: input.price,
        reactive_start_date: input.reactiveStartDate ?? null,
        reactive_end_date: input.reactiveEndDate ?? null,
      })
      .eq("id", input.id)
      .select("id, code, designation, product_type_id, price, reactive_start_date, reactive_end_date")
      .single();

    if (updateError) {
      throw updateError;
    }

    const stockPayload = [
      { product_id: input.id, depot: "A" as Depot, quantity: input.stockA ?? 0 },
      { product_id: input.id, depot: "B" as Depot, quantity: input.stockB ?? 0 },
      { product_id: input.id, depot: "C" as Depot, quantity: input.stockC ?? 0 },
    ];

    const { error: stockError } = await supabase!
      .from("app_product_stock")
      .upsert(stockPayload, { onConflict: "product_id,depot" });

    if (stockError) {
      throw stockError;
    }

    const stockMap = new Map([[input.id, { A: input.stockA ?? 0, B: input.stockB ?? 0, C: input.stockC ?? 0 }]]);
    return this.mapProduct(updatedRow, new Map([[typeRow.id, typeRow.name]]), stockMap);
  }

  public async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase!.from("app_products").delete().eq("id", id);
    if (error) {
      throw error;
    }
  }

  public async createClient(input: CreateClientInput): Promise<Client> {
    const { data, error } = await supabase!
      .from("app_clients")
      .insert({
        name: input.name,
        client_code: input.code ?? null,
        ice: input.ice,
        if_tva: input.ifTva,
        address: input.address,
        phone: input.phone,
        email: input.email,
      })
      .select("id, name, client_code, ice, if_tva, address, phone, email")
      .single();

    if (error) {
      throw error;
    }

    return this.mapClient(data);
  }

  public async updateClient(input: UpdateClientInput): Promise<Client> {
    const { data, error } = await supabase!
      .from("app_clients")
      .update({
        name: input.name,
        client_code: input.code ?? null,
        ice: input.ice,
        if_tva: input.ifTva,
        address: input.address,
        phone: input.phone,
        email: input.email,
      })
      .eq("id", input.id)
      .select("id, name, client_code, ice, if_tva, address, phone, email")
      .single();

    if (error) {
      throw error;
    }

    return this.mapClient(data);
  }

  public async deleteClient(id: string): Promise<void> {
    const { error } = await supabase!.from("app_clients").delete().eq("id", id);
    if (error) {
      throw error;
    }
  }

  public async createSupplier(input: CreateSupplierInput): Promise<Supplier> {
    const { data, error } = await supabase!
      .from("app_suppliers")
      .insert({
        name: input.name,
        ice: input.ice,
        if_tva: input.ifTva,
        address: input.address,
        phone: input.phone,
        email: input.email,
      })
      .select("id, name, ice, if_tva, address, phone, email")
      .single();

    if (error) {
      throw error;
    }

    return this.mapSupplier(data);
  }

  public async updateSupplier(input: UpdateSupplierInput): Promise<Supplier> {
    const { data, error } = await supabase!
      .from("app_suppliers")
      .update({
        name: input.name,
        ice: input.ice,
        if_tva: input.ifTva,
        address: input.address,
        phone: input.phone,
        email: input.email,
      })
      .eq("id", input.id)
      .select("id, name, ice, if_tva, address, phone, email")
      .single();

    if (error) {
      throw error;
    }

    return this.mapSupplier(data);
  }

  public async deleteSupplier(id: string): Promise<void> {
    const { error } = await supabase!.from("app_suppliers").delete().eq("id", id);
    if (error) {
      throw error;
    }
  }

  public async createSale(input: CreateSaleInput): Promise<Sale> {
    const { sale, updatedProducts } = input;

    const { data: saleRow, error: saleError } = await supabase!
      .from("app_sales")
      .insert({
        invoice_number: sale.invoiceNumber,
        sale_date: sale.date,
        depot: sale.depot,
        client_id: sale.clientId || null,
        client_name: sale.clientName ?? "",
        total_ht: sale.totalHT,
        tva: sale.tva,
        total_ttc: sale.totalTTC,
      })
      .select("id, invoice_number, sale_date, depot, client_id, client_name, total_ht, tva, total_ttc")
      .single();

    if (saleError) {
      throw saleError;
    }

    if (!saleRow) {
      throw new Error("Echec de la creation de la vente.");
    }

    const typeNames = Array.from(
      new Set(sale.items.map((item) => item.productType?.trim()).filter(Boolean) as string[]),
    );

    const { data: typeRows, error: typeError } = await supabase!
      .from("app_product_types")
      .select("id, name")
      .in("name", typeNames.length > 0 ? typeNames : DEFAULT_PRODUCT_TYPES);

    if (typeError) {
      throw typeError;
    }

    const typeMap = new Map<string, string>();
    const typeNameById = new Map<string, string>();
    (typeRows ?? []).forEach((row) => {
      typeMap.set(normalize(row.name), row.id);
      typeNameById.set(row.id, row.name);
    });

    const saleItemsPayload = sale.items.map((item) => {
      const typeId =
        typeMap.get(normalize(item.productType)) ??
        typeMap.get(normalize(DEFAULT_PRODUCT_TYPES[0]));

      if (!typeId) {
        throw new Error(`Type de produit introuvable pour ${item.productType}.`);
      }

      return {
        sale_id: saleRow.id,
        product_id: item.productId || null,
        product_code: item.productCode,
        designation: item.designation,
        product_type_id: typeId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total,
        reactive_start_date: item.reactiveStartDate ?? null,
        reactive_end_date: item.reactiveEndDate ?? null,
      };
    });

    const { data: insertedItems, error: insertItemsError } = await supabase!
      .from("app_sale_items")
      .insert(saleItemsPayload)
      .select(
        "id, sale_id, product_id, product_code, designation, product_type_id, quantity, unit_price, total, reactive_start_date, reactive_end_date",
      );

    if (insertItemsError) {
      throw insertItemsError;
    }

    if (updatedProducts.length > 0) {
      const stockPayload = updatedProducts.flatMap((product) => [
        { product_id: product.id, depot: "A" as Depot, quantity: product.stockA ?? 0 },
        { product_id: product.id, depot: "B" as Depot, quantity: product.stockB ?? 0 },
        { product_id: product.id, depot: "C" as Depot, quantity: product.stockC ?? 0 },
      ]);

      const { error: stockError } = await supabase!
        .from("app_product_stock")
        .upsert(stockPayload, { onConflict: "product_id,depot" });

      if (stockError) {
        throw stockError;
      }
    }

    const saleItemMap = new Map<string, SaleItem[]>();
    const depotEntries: { sale_item_id: string; depot: Depot; quantity: number }[] = [];
    (insertedItems ?? []).forEach((row, index) => {
      const sourceItem = sale.items[index] ?? sale.items.find((item) => item.productCode === row.product_code);
      if (sourceItem?.quantityPerDepot) {
        (Object.entries(sourceItem.quantityPerDepot) as [Depot, number][]).forEach(([depot, quantity]) => {
          depotEntries.push({
            sale_item_id: row.id,
            depot,
            quantity,
          });
        });
      }

      const items = saleItemMap.get(row.sale_id) ?? [];
      items.push({
        productId: row.product_id ?? "",
        productCode: row.product_code ?? "",
        designation: row.designation ?? "",
        productType: sourceItem?.productType ?? DEFAULT_PRODUCT_TYPES[0],
        quantity: Number(row.quantity ?? 0),
        unitPrice: Number(row.unit_price ?? 0),
        total: Number(row.total ?? 0),
        quantityPerDepot: sourceItem?.quantityPerDepot ?? undefined,
        reactiveStartDate: row.reactive_start_date,
        reactiveEndDate: row.reactive_end_date,
      });
      saleItemMap.set(row.sale_id, items);
    });

    if (depotEntries.length > 0) {
      const { error: depotError } = await supabase!
        .from("app_sale_item_depot_quantities")
        .insert(depotEntries);
      if (depotError) {
        throw depotError;
      }
    }

    return this.mapSale(saleRow, saleItemMap);
  }

  public async deleteSale(id: string): Promise<void> {
    const { error } = await supabase!.from("app_sales").delete().eq("id", id);
    if (error) {
      throw error;
    }
  }

  public async createPurchase(input: CreatePurchaseInput): Promise<Purchase> {
    const { purchase, updatedProducts } = input;
    const { data: purchaseRow, error: purchaseError } = await supabase!
      .from("app_purchases")
      .insert({
        code: purchase.code,
        supplier_id: purchase.supplierId || null,
        supplier_name: purchase.supplierName ?? "",
        purchase_date: purchase.purchaseDate,
        notes: purchase.notes ?? null,
        total_ht: purchase.totalHT,
        tva: purchase.tva,
        total_ttc: purchase.totalTTC,
      })
      .select("id, code, supplier_id, supplier_name, purchase_date, notes, total_ht, tva, total_ttc")
      .single();

    if (purchaseError) {
      throw purchaseError;
    }

    if (!purchaseRow) {
      throw new Error("Echec de la creation de l'achat.");
    }

    const typeNames = Array.from(new Set(purchase.items.map((item) => item.productType?.trim()).filter(Boolean)));
    const { data: typeRows, error: typeError } = await supabase!
      .from("app_product_types")
      .select("id, name")
      .in("name", typeNames.length > 0 ? typeNames : DEFAULT_PRODUCT_TYPES);

    if (typeError) {
      throw typeError;
    }

    const typeMap = new Map<string, string>();
    (typeRows ?? []).forEach((row) => {
      typeMap.set(normalize(row.name), row.id);
    });

    const itemsPayload = purchase.items.map((item) => {
      const typeId =
        typeMap.get(normalize(item.productType)) ??
        typeMap.get(normalize(DEFAULT_PRODUCT_TYPES[0]));

      if (!typeId) {
        throw new Error(`Type de produit introuvable pour ${item.productType}.`);
      }

      const quantityPerDepot = item.quantityPerDepot ?? undefined;
      return {
        purchase_id: purchaseRow.id,
        product_id: item.productId || null,
        product_code: item.productCode,
        designation: item.designation,
        product_type_id: typeId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total,
        quantity_depot_a: quantityPerDepot?.A ?? 0,
        quantity_depot_b: quantityPerDepot?.B ?? 0,
        quantity_depot_c: quantityPerDepot?.C ?? 0,
        reactive_start_date: item.reactiveStartDate ?? null,
        reactive_end_date: item.reactiveEndDate ?? null,
      };
    });

    const { data: insertedItems, error: insertItemsError } = await supabase!
      .from("app_purchase_items")
      .insert(itemsPayload)
      .select(
        "id, purchase_id, product_id, product_code, designation, product_type_id, quantity, unit_price, total, quantity_depot_a, quantity_depot_b, quantity_depot_c, reactive_start_date, reactive_end_date",
      );

    if (insertItemsError) {
      throw insertItemsError;
    }

    if (updatedProducts.length > 0) {
      const stockPayload = updatedProducts.flatMap((product) => [
        { product_id: product.id, depot: "A" as Depot, quantity: product.stockA ?? 0 },
        { product_id: product.id, depot: "B" as Depot, quantity: product.stockB ?? 0 },
        { product_id: product.id, depot: "C" as Depot, quantity: product.stockC ?? 0 },
      ]);

      const { error: stockError } = await supabase!
        .from("app_product_stock")
        .upsert(stockPayload, { onConflict: "product_id,depot" });

      if (stockError) {
        throw stockError;
      }
    }

    const itemMap = new Map<string, PurchaseItem[]>();
    (insertedItems ?? []).forEach((row, index) => {
      const sourceItem = purchase.items[index] ?? purchase.items.find((item) => item.productCode === row.product_code);
      const items = itemMap.get(row.purchase_id) ?? [];
      items.push({
        id: row.id,
        productId: row.product_id ?? "",
        productCode: row.product_code ?? "",
        designation: row.designation ?? "",
        productType: sourceItem?.productType ?? typeNameById.get(row.product_type_id) ?? DEFAULT_PRODUCT_TYPES[0],
        quantity: Number(row.quantity ?? 0),
        unitPrice: Number(row.unit_price ?? 0),
        total: Number(row.total ?? 0),
        quantityPerDepot: this.buildDepotQuantitiesFromRow(row),
        reactiveStartDate: row.reactive_start_date,
        reactiveEndDate: row.reactive_end_date,
      });
      itemMap.set(row.purchase_id, items);
    });

    return this.mapPurchase(purchaseRow, itemMap);
  }

  public async updatePurchase(input: UpdatePurchaseInput): Promise<Purchase> {
    const { purchase, updatedProducts } = input;
    const { data: purchaseRow, error: purchaseError } = await supabase!
      .from("app_purchases")
      .update({
        code: purchase.code,
        supplier_id: purchase.supplierId || null,
        supplier_name: purchase.supplierName ?? "",
        purchase_date: purchase.purchaseDate,
        notes: purchase.notes ?? null,
        total_ht: purchase.totalHT,
        tva: purchase.tva,
        total_ttc: purchase.totalTTC,
      })
      .eq("id", purchase.id)
      .select("id, code, supplier_id, supplier_name, purchase_date, notes, total_ht, tva, total_ttc")
      .single();

    if (purchaseError) {
      throw purchaseError;
    }

    if (!purchaseRow) {
      throw new Error("Echec de la mise a jour de l'achat.");
    }

    const { error: deleteItemsError } = await supabase!
      .from("app_purchase_items")
      .delete()
      .eq("purchase_id", purchase.id);

    if (deleteItemsError) {
      throw deleteItemsError;
    }

    const typeNames = Array.from(new Set(purchase.items.map((item) => item.productType?.trim()).filter(Boolean)));
    const { data: typeRows, error: typeError } = await supabase!
      .from("app_product_types")
      .select("id, name")
      .in("name", typeNames.length > 0 ? typeNames : DEFAULT_PRODUCT_TYPES);

    if (typeError) {
      throw typeError;
    }

    const typeMap = new Map<string, string>();
    const typeNameById = new Map<string, string>();
    (typeRows ?? []).forEach((row) => {
      typeMap.set(normalize(row.name), row.id);
      typeNameById.set(row.id, row.name);
    });

    const itemsPayload = purchase.items.map((item) => {
      const typeId =
        typeMap.get(normalize(item.productType)) ??
        typeMap.get(normalize(DEFAULT_PRODUCT_TYPES[0]));

      if (!typeId) {
        throw new Error(`Type de produit introuvable pour ${item.productType}.`);
      }

      const quantityPerDepot = item.quantityPerDepot ?? undefined;
      return {
        purchase_id: purchase.id,
        product_id: item.productId || null,
        product_code: item.productCode,
        designation: item.designation,
        product_type_id: typeId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total,
        quantity_depot_a: quantityPerDepot?.A ?? 0,
        quantity_depot_b: quantityPerDepot?.B ?? 0,
        quantity_depot_c: quantityPerDepot?.C ?? 0,
        reactive_start_date: item.reactiveStartDate ?? null,
        reactive_end_date: item.reactiveEndDate ?? null,
      };
    });

    const { data: insertedItems, error: insertItemsError } = await supabase!
      .from("app_purchase_items")
      .insert(itemsPayload)
      .select(
        "id, purchase_id, product_id, product_code, designation, product_type_id, quantity, unit_price, total, quantity_depot_a, quantity_depot_b, quantity_depot_c, reactive_start_date, reactive_end_date",
      );

    if (insertItemsError) {
      throw insertItemsError;
    }

    if (updatedProducts.length > 0) {
      const stockPayload = updatedProducts.flatMap((product) => [
        { product_id: product.id, depot: "A" as Depot, quantity: product.stockA ?? 0 },
        { product_id: product.id, depot: "B" as Depot, quantity: product.stockB ?? 0 },
        { product_id: product.id, depot: "C" as Depot, quantity: product.stockC ?? 0 },
      ]);

      const { error: stockError } = await supabase!
        .from("app_product_stock")
        .upsert(stockPayload, { onConflict: "product_id,depot" });

      if (stockError) {
        throw stockError;
      }
    }

    const itemMap = new Map<string, PurchaseItem[]>();
    (insertedItems ?? []).forEach((row, index) => {
      const sourceItem = purchase.items[index] ?? purchase.items.find((item) => item.productCode === row.product_code);
      const items = itemMap.get(row.purchase_id) ?? [];
      items.push({
        id: row.id,
        productId: row.product_id ?? "",
        productCode: row.product_code ?? "",
        designation: row.designation ?? "",
        productType: sourceItem?.productType ?? typeNameById.get(row.product_type_id) ?? DEFAULT_PRODUCT_TYPES[0],
        quantity: Number(row.quantity ?? 0),
        unitPrice: Number(row.unit_price ?? 0),
        total: Number(row.total ?? 0),
        quantityPerDepot: this.buildDepotQuantitiesFromRow(row),
        reactiveStartDate: row.reactive_start_date,
        reactiveEndDate: row.reactive_end_date,
      });
      itemMap.set(row.purchase_id, items);
    });

    return this.mapPurchase(purchaseRow, itemMap);
  }

  public async deletePurchase(id: string, updatedProducts: Product[]): Promise<void> {
    const { error } = await supabase!.from("app_purchases").delete().eq("id", id);
    if (error) {
      throw error;
    }

    if (updatedProducts.length > 0) {
      const stockPayload = updatedProducts.flatMap((product) => [
        { product_id: product.id, depot: "A" as Depot, quantity: product.stockA ?? 0 },
        { product_id: product.id, depot: "B" as Depot, quantity: product.stockB ?? 0 },
        { product_id: product.id, depot: "C" as Depot, quantity: product.stockC ?? 0 },
      ]);

      const { error: stockError } = await supabase!
        .from("app_product_stock")
        .upsert(stockPayload, { onConflict: "product_id,depot" });

      if (stockError) {
        throw stockError;
      }
    }
  }
}

type PersistedData = AppData;

const hasElectronBridge =
  typeof window !== "undefined" && typeof window.electronAPI?.loadData === "function";

const normalizeDepotQuantitiesPersisted = (
  value: Partial<Record<string, number>> | null | undefined,
): Partial<Record<Depot, number>> | undefined => {
  if (!value) {
    return undefined;
  }

  const entries: [Depot, number][] = [];
  (["A", "B", "C"] as Depot[]).forEach((depot) => {
    const raw = value[depot];
    if (raw === undefined || raw === null) {
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      return;
    }
    entries.push([depot, parsed]);
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries) as Partial<Record<Depot, number>>;
};

const applyMigrations = (data: AppData): AppData => {
  const productTypes: ProductType[] =
    Array.isArray(data.productTypes) && data.productTypes.length > 0
      ? Array.from(new Set([...DEFAULT_PRODUCT_TYPES, ...data.productTypes]))
      : [...DEFAULT_PRODUCT_TYPES];

  const products = (data.products ?? []).map((product) => ({
    ...product,
    type: product.type ?? DEFAULT_PRODUCT_TYPES[0],
    reactiveStartDate: product.reactiveStartDate ?? null,
    reactiveEndDate: product.reactiveEndDate ?? null,
    stockA: product.stockA ?? 0,
    stockB: product.stockB ?? 0,
    stockC: product.stockC ?? 0,
  }));

  const productById = new Map(
    products.map((product) => [
      product.id,
      {
        type: product.type,
        reactiveStartDate: product.reactiveStartDate ?? null,
        reactiveEndDate: product.reactiveEndDate ?? null,
      },
    ]),
  );

  const sales = (data.sales ?? []).map((sale) => ({
    ...sale,
    items: sale.items.map((item) => {
      const productInfo = productById.get(item.productId);
      const productType = item.productType ?? productInfo?.type ?? DEFAULT_PRODUCT_TYPES[0];
      return {
        ...item,
        productType,
        reactiveStartDate: item.reactiveStartDate ?? productInfo?.reactiveStartDate ?? null,
        reactiveEndDate: item.reactiveEndDate ?? productInfo?.reactiveEndDate ?? null,
      };
    }),
  }));

  const currentYear = new Date().getFullYear();
  const prefix = `FAC-${currentYear}-`;
  const invoiceCounter = sales.reduce((max, sale) => {
    if (!sale.invoiceNumber?.startsWith(prefix)) {
      return max;
    }
    const suffix = sale.invoiceNumber.slice(prefix.length);
    const parsed = parseInt(suffix, 10);
    return Number.isNaN(parsed) ? max : Math.max(max, parsed);
  }, data.invoiceCounter ?? 0);

  const suppliers = data.suppliers ?? [];

  const purchases = (data.purchases ?? []).map((purchase) => ({
    ...purchase,
    notes: purchase.notes ?? null,
    items: (purchase.items ?? []).map((item) => {
      const productInfo = productById.get(item.productId);
      const productType = item.productType ?? productInfo?.type ?? DEFAULT_PRODUCT_TYPES[0];
      return {
        ...item,
        productType,
        reactiveStartDate: item.reactiveStartDate ?? productInfo?.reactiveStartDate ?? null,
        reactiveEndDate: item.reactiveEndDate ?? productInfo?.reactiveEndDate ?? null,
        quantityPerDepot: normalizeDepotQuantitiesPersisted(
          item.quantityPerDepot as Partial<Record<string, number>> | null | undefined,
        ),
      };
    }),
  }));

  const purchasePrefix = `ACH-${currentYear}-`;
  const purchaseCounter = purchases.reduce((max, purchase) => {
    if (!purchase.code?.startsWith(purchasePrefix)) {
      return max;
    }
    const suffix = purchase.code.slice(purchasePrefix.length);
    const parsed = parseInt(suffix, 10);
    return Number.isNaN(parsed) ? max : Math.max(max, parsed);
  }, data.purchaseCounter ?? 0);

  return {
    products,
    sales,
    productTypes,
    clients: data.clients ?? [],
    suppliers,
    purchases,
    invoiceCounter,
    purchaseCounter,
  };
};

const loadFromElectron = (): PersistedData => {
  const payload = window.electronAPI?.loadData();
  return payload ? applyMigrations(payload) : defaultData;
};

const saveToElectron = (data: PersistedData) => {
  window.electronAPI?.saveData(data);
};

const loadFromLocalStorage = (): PersistedData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return defaultData;
  }
  try {
    return applyMigrations(JSON.parse(stored) as AppData);
  } catch (error) {
    console.error("Erreur de parsing localStorage:", error);
    return defaultData;
  }
};

const saveToLocalStorage = (data: PersistedData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

class LocalDataSource implements DataSource {
  private read(): PersistedData {
    if (hasElectronBridge) {
      return loadFromElectron();
    }
    return loadFromLocalStorage();
  }

  private write(data: PersistedData) {
    if (hasElectronBridge) {
      saveToElectron(data);
    } else {
      saveToLocalStorage(data);
    }
  }

  public async loadInitialData(): Promise<AppData> {
    return this.read();
  }

  public async addProductType(name: ProductType): Promise<ProductType[]> {
    const data = this.read();
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Nom de type invalide.");
    }
    if (!data.productTypes.some((type) => normalize(type) === normalize(trimmed))) {
      data.productTypes = [...data.productTypes, trimmed];
      this.write(data);
    }
    return data.productTypes;
  }

  public async deleteProductType(name: ProductType): Promise<ProductType[]> {
    const data = this.read();
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Nom de type invalide.");
    }
    if (DEFAULT_PRODUCT_TYPES.some((type) => normalize(type) === normalize(trimmed))) {
      throw new Error("Impossible de supprimer un type par defaut.");
    }
    const inUse = data.products.some((product) => normalize(product.type) === normalize(trimmed));
    if (inUse) {
      throw new Error("Ce type est encore utilise par au moins un produit.");
    }
    data.productTypes = data.productTypes.filter((type) => normalize(type) !== normalize(trimmed));
    this.write(data);
    return data.productTypes;
  }

  public async createProduct(input: CreateProductInput): Promise<Product> {
    const data = this.read();
    const newProduct: Product = {
      ...input,
      id: generateId(),
    };
    data.products = [...data.products, newProduct];
    this.write(data);
    return newProduct;
  }

  public async updateProduct(input: UpdateProductInput): Promise<Product> {
    const data = this.read();
    data.products = data.products.map((product) => (product.id === input.id ? input : product));
    this.write(data);
    return input;
  }

  public async deleteProduct(id: string): Promise<void> {
    const data = this.read();
    data.products = data.products.filter((product) => product.id !== id);
    this.write(data);
  }

  public async createClient(input: CreateClientInput): Promise<Client> {
    const data = this.read();
    const client: Client = { ...input, id: generateId() };
    data.clients = [...data.clients, client];
    this.write(data);
    return client;
  }

  public async updateClient(input: UpdateClientInput): Promise<Client> {
    const data = this.read();
    data.clients = data.clients.map((client) => (client.id === input.id ? input : client));
    this.write(data);
    return input;
  }

  public async deleteClient(id: string): Promise<void> {
    const data = this.read();
    data.clients = data.clients.filter((client) => client.id !== id);
    this.write(data);
  }

  public async createSupplier(input: CreateSupplierInput): Promise<Supplier> {
    const data = this.read();
    const supplier: Supplier = { ...input, id: generateId() };
    data.suppliers = [...data.suppliers, supplier];
    this.write(data);
    return supplier;
  }

  public async updateSupplier(input: UpdateSupplierInput): Promise<Supplier> {
    const data = this.read();
    data.suppliers = data.suppliers.map((supplier) => (supplier.id === input.id ? input : supplier));
    this.write(data);
    return input;
  }

  public async deleteSupplier(id: string): Promise<void> {
    const data = this.read();
    data.suppliers = data.suppliers.filter((supplier) => supplier.id !== id);
    this.write(data);
  }

  public async createSale(input: CreateSaleInput): Promise<Sale> {
    const data = this.read();
    const sale: Sale = {
      id: generateId(),
      ...input.sale,
    };
    data.sales = [...data.sales, sale];
    data.products = data.products.map((product) => {
      const updated = input.updatedProducts.find((p) => p.id === product.id);
      return updated ?? product;
    });
    data.invoiceCounter = Math.max(data.invoiceCounter, parseInt(sale.invoiceNumber.split("-").pop() ?? "0", 10));
    this.write(data);
    return sale;
  }

  public async deleteSale(id: string): Promise<void> {
    const data = this.read();
    data.sales = data.sales.filter((sale) => sale.id !== id);
    this.write(data);
  }

  public async createPurchase(input: CreatePurchaseInput): Promise<Purchase> {
    const data = this.read();
    const purchase: Purchase = {
      id: generateId(),
      ...input.purchase,
    };
    data.purchases = [...data.purchases, purchase];
    data.products = input.updatedProducts;

    const suffix = purchase.code.split("-").pop();
    const parsed = suffix ? parseInt(suffix, 10) : NaN;
    if (!Number.isNaN(parsed)) {
      data.purchaseCounter = Math.max(data.purchaseCounter ?? 0, parsed);
    }

    this.write(data);
    return purchase;
  }

  public async updatePurchase(input: UpdatePurchaseInput): Promise<Purchase> {
    const data = this.read();
    data.purchases = data.purchases.map((purchase) => (purchase.id === input.purchase.id ? input.purchase : purchase));
    data.products = input.updatedProducts;

    const suffix = input.purchase.code.split("-").pop();
    const parsed = suffix ? parseInt(suffix, 10) : NaN;
    if (!Number.isNaN(parsed)) {
      data.purchaseCounter = Math.max(data.purchaseCounter ?? 0, parsed);
    }

    this.write(data);
    return input.purchase;
  }

  public async deletePurchase(id: string, updatedProducts: Product[]): Promise<void> {
    const data = this.read();
    data.purchases = data.purchases.filter((purchase) => purchase.id !== id);
    data.products = updatedProducts;
    this.write(data);
  }
}

const dataSource: DataSource = supabase ? new SupabaseDataSource() : new LocalDataSource();

export const isSupabaseEnabled = Boolean(supabase);

export const loadInitialData = () => dataSource.loadInitialData();
export const addProductType = (name: ProductType) => dataSource.addProductType(name);
export const deleteProductType = (name: ProductType) => dataSource.deleteProductType(name);
export const createProduct = (input: CreateProductInput) => dataSource.createProduct(input);
export const updateProduct = (input: UpdateProductInput) => dataSource.updateProduct(input);
export const deleteProduct = (id: string) => dataSource.deleteProduct(id);
export const createClient = (input: CreateClientInput) => dataSource.createClient(input);
export const updateClient = (input: UpdateClientInput) => dataSource.updateClient(input);
export const deleteClient = (id: string) => dataSource.deleteClient(id);
export const createSale = (input: CreateSaleInput) => dataSource.createSale(input);
export const deleteSale = (id: string) => dataSource.deleteSale(id);
export const createSupplier = (input: CreateSupplierInput) => dataSource.createSupplier(input);
export const updateSupplier = (input: UpdateSupplierInput) => dataSource.updateSupplier(input);
export const deleteSupplier = (id: string) => dataSource.deleteSupplier(id);
export const createPurchase = (input: CreatePurchaseInput) => dataSource.createPurchase(input);
export const updatePurchase = (input: UpdatePurchaseInput) => dataSource.updatePurchase(input);
export const deletePurchase = (id: string, updatedProducts: Product[]) =>
  dataSource.deletePurchase(id, updatedProducts);

export const exportData = async (): Promise<void> => {
  const data = await loadInitialData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sauvegarde-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const importData = async (file: File): Promise<void> => {
  const text = await file.text();
  const parsed = applyMigrations(JSON.parse(text) as AppData);

  if (isSupabaseEnabled) {
    throw new Error("L'importation directe n'est pas encore disponible lorsque Supabase est activé.");
  }

  if (hasElectronBridge) {
    saveToElectron(parsed);
  } else {
    saveToLocalStorage(parsed);
  }
};
