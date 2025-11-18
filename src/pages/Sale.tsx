import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { SaleItem, Product, Depot } from "@/types";
import { isReactiveType } from "@/lib/utils";
import { toast } from "sonner";

const formatReactivePeriodLabel = (start?: string | null, end?: string | null) => {
  if (!start || !end) {
    return null;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  return `${startDate.toLocaleDateString("fr-FR")} au ${endDate.toLocaleDateString("fr-FR")}`;
};

const Sale = () => {
  const { currentDepot, products, clients, invoiceCounter, createSale } = useApp();
  const depotOrder: Depot[] = ["A", "B", "C"];
  const stockKeyByDepot: Record<Depot, keyof Product> = {
    A: "stockA",
    B: "stockB",
    C: "stockC",
  };

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [distribution, setDistribution] = useState<Record<Depot, string>>({
    A: "",
    B: "",
    C: "",
  });
  const [items, setItems] = useState<SaleItem[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState("");

  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const selectedClient = clients.find((client) => client.id === selectedClientId);

  const isReactiveProduct = isReactiveType(selectedProduct?.type);
  const selectedReactivePeriod = formatReactivePeriodLabel(
    selectedProduct?.reactiveStartDate ?? null,
    selectedProduct?.reactiveEndDate ?? null,
  );

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.designation.localeCompare(b.designation, "fr")),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalize = (value: string) =>
      value
        .toLocaleLowerCase("fr")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    if (!productSearchTerm.trim()) {
      return sortedProducts;
    }

    const term = normalize(productSearchTerm.trim());

    return sortedProducts.filter((product) => {
      const designationMatch = normalize(product.designation).includes(term);
      const codeMatch = normalize(product.code).includes(term);
      return designationMatch || codeMatch;
    });
  }, [sortedProducts, productSearchTerm]);

  const getDepotStock = (product: Product, depot: Depot) => {
    if (isReactiveType(product.type)) {
      return 0;
    }
    return product[stockKeyByDepot[depot]];
  };

  const getTotalStock = (product: Product) => {
    if (isReactiveType(product.type)) {
      return 0;
    }
    return product.stockA + product.stockB + product.stockC;
  };

  useEffect(() => {
    setDistribution({ A: "", B: "", C: "" });
  }, [selectedProductId]);

  const handleDistributionChange = (depot: Depot, value: string) => {
    if (!/^\d*$/.test(value)) {
      return;
    }
    setDistribution((prev) => ({
      ...prev,
      [depot]: value,
    }));
  };

  const totalSelectedQuantity = isReactiveProduct
    ? 0
    : depotOrder.reduce((sum, depot) => {
        const parsed = distribution[depot] ? parseInt(distribution[depot], 10) : 0;
        return sum + (Number.isNaN(parsed) ? 0 : parsed);
      }, 0);

  const totalAvailableForSelected =
    selectedProduct && !isReactiveProduct ? getTotalStock(selectedProduct) : 0;

  const formatDistribution = (item: SaleItem) => {
    if (isReactiveType(item.productType)) {
      return "-";
    }

    const distributionForItem =
      item.quantityPerDepot ??
      ({
        [currentDepot]: item.quantity,
      } as Partial<Record<Depot, number>>);

    return (
      depotOrder
        .map((depot) => {
          const qty = distributionForItem[depot] ?? 0;
          return qty > 0 ? `${depot}:${qty}` : null;
        })
        .filter(Boolean)
        .join(" | ") || "-"
    );
  };

  const addItem = () => {
    if (!selectedProduct) {
      toast.error("Veuillez selectionner un produit");
      return;
    }

    if (items.some((item) => item.productId === selectedProduct.id)) {
      toast.error("Ce produit est deja dans la liste");
      return;
    }

    if (isReactiveProduct) {
      const reactiveItem: SaleItem = {
        productId: selectedProduct.id,
        productCode: selectedProduct.code,
        designation: selectedProduct.designation,
        productType: selectedProduct.type,
        quantity: 1,
        unitPrice: selectedProduct.price,
        total: selectedProduct.price,
        reactiveStartDate: selectedProduct.reactiveStartDate ?? null,
        reactiveEndDate: selectedProduct.reactiveEndDate ?? null,
      };

      setItems((prev) => [...prev, reactiveItem]);
      toast.success("Article ajoute");
      return;
    }

    const quantityByDepot = depotOrder.reduce((acc, depot) => {
      const value = distribution[depot];
      const parsed = value ? parseInt(value, 10) : 0;
      acc[depot] = Number.isNaN(parsed) ? 0 : parsed;
      return acc;
    }, {} as Record<Depot, number>);

    const totalSelected = depotOrder.reduce((sum, depot) => sum + quantityByDepot[depot], 0);

    if (totalSelected <= 0) {
      toast.error("La quantite totale doit etre superieure a 0");
      return;
    }

    for (const depot of depotOrder) {
      if (quantityByDepot[depot] > getDepotStock(selectedProduct, depot)) {
        toast.error(`Stock insuffisant pour le depot ${depot}.`);
        return;
      }
    }

    const newItem: SaleItem = {
      productId: selectedProduct.id,
      productCode: selectedProduct.code,
      designation: selectedProduct.designation,
      productType: selectedProduct.type,
      quantity: totalSelected,
      unitPrice: selectedProduct.price,
      total: totalSelected * selectedProduct.price,
      quantityPerDepot: quantityByDepot,
      reactiveStartDate: null,
      reactiveEndDate: null,
    };

    setItems((prev) => [...prev, newItem]);
    toast.success("Article ajoute");
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const calculateTotals = () => {
    const totalHT = items.reduce((sum, item) => sum + item.total, 0);
    const tva = totalHT * 0.2;
    const totalTTC = totalHT + tva;
    return { totalHT, tva, totalTTC };
  };

  const validateSale = async () => {
    if (!selectedClient) {
      toast.error("Veuillez selectionner un client");
      return;
    }

    if (items.length === 0) {
      toast.error("Veuillez ajouter au moins un article");
      return;
    }

    const { totalHT, tva, totalTTC } = calculateTotals();
    const year = new Date().getFullYear();
    const newInvoiceNumber = `FAC-${year}-${String(invoiceCounter + 1).padStart(4, "0")}`;

    const saleItems = items.map((item) => ({
      ...item,
      quantityPerDepot: isReactiveType(item.productType)
        ? undefined
        : {
            ...(item.quantityPerDepot ??
              ({
                [currentDepot]: item.quantity,
              } as Partial<Record<Depot, number>>)),
          },
    }));

    const updatedProducts = products.map((product) => {
      const saleItem = items.find((item) => item.productId === product.id);
      if (!saleItem || isReactiveType(saleItem.productType)) {
        return product;
      }

      const distributionForItem =
        saleItem.quantityPerDepot ??
        ({
          [currentDepot]: saleItem.quantity,
        } as Partial<Record<Depot, number>>);

      return {
        ...product,
        stockA: product.stockA - (distributionForItem.A ?? 0),
        stockB: product.stockB - (distributionForItem.B ?? 0),
        stockC: product.stockC - (distributionForItem.C ?? 0),
      };
    });

    try {
      await createSale({
        sale: {
          invoiceNumber: newInvoiceNumber,
          date: new Date().toISOString(),
          depot: currentDepot,
          clientId: selectedClient.id,
          clientName: selectedClient.name,
          items: saleItems,
          totalHT,
          tva,
          totalTTC,
        },
        updatedProducts,
      });

      setItems([]);
      setSelectedClientId("");
      setSelectedProductId("");
      setDistribution({ A: "", B: "", C: "" });
      toast.success(`Vente enregistrée - Facture: ${newInvoiceNumber}`);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la vente:", error);
      toast.error("Impossible d'enregistrer la vente.");
    }
  };

  const { totalHT, tva, totalTTC } = calculateTotals();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nouvelle vente</h1>
        <p className="text-muted-foreground">Selectionnez un client, ajoutez des produits et validez la facture.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Produits disponibles</CardTitle>
              <CardDescription>
                Choisissez un produit puis repartissez la quantite sur les depots (si applicable).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Produit</Label>
                  <Select
                    value={selectedProductId}
                    onValueChange={setSelectedProductId}
                    onOpenChange={(open) => {
                      if (!open) {
                        setProductSearchTerm("");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner un produit" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 pb-2">
                        <Input
                          autoFocus
                          placeholder="Rechercher par code ou designation..."
                          value={productSearchTerm}
                          onChange={(event) => setProductSearchTerm(event.target.value)}
                          onKeyDown={(event) => event.stopPropagation()}
                        />
                      </div>
                      {filteredProducts.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Aucun produit trouve</div>
                      ) : (
                        filteredProducts.map((product) => {
                          const reactive = isReactiveType(product.type);
                          const totalStock = getTotalStock(product);
                          const breakdown = reactive
                            ? "-"
                            : depotOrder
                                .map((depot) => `${depot}:${getDepotStock(product, depot)}`)
                                .join(" | ");
                          return (
                            <SelectItem
                              key={product.id}
                              value={product.id}
                              disabled={!reactive && totalStock === 0}
                            >
                              {product.code} - {product.designation}{" "}
                              {reactive ? "(Reactif)" : `(Total: ${totalStock}) [${breakdown}]`}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  {selectedProduct && (
                    <>
                      {isReactiveProduct ? (
                        <>
                          <p className="text-xs text-muted-foreground">
                            Produit reactif – aucun stock a repartir.
                          </p>
                          {selectedReactivePeriod && (
                            <p className="text-xs text-muted-foreground">Periode : {selectedReactivePeriod}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Stock total : {getTotalStock(selectedProduct)} - A:{selectedProduct.stockA} | B:
                          {selectedProduct.stockB} | C:{selectedProduct.stockC}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">Prix : {selectedProduct.price.toFixed(2)} DH</p>
                    </>
                  )}
                </div>
                <div className="space-y-3">
                  {isReactiveProduct ? (
                    <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                      Aucun ajustement de stock requis pour ce produit reactif. Cliquez sur « + » pour l’ajouter a la
                      vente.
                    </div>
                  ) : (
                    <>
                      <Label className="block">Repartition par depot</Label>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {depotOrder.map((depot) => (
                          <div key={depot} className="space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">Depot {depot}</Label>
                            <Input
                              type="number"
                              min="0"
                              value={distribution[depot]}
                              onChange={(event) => handleDistributionChange(depot, event.target.value)}
                              placeholder="0"
                              disabled={!selectedProduct}
                            />
                            <p className="text-[11px] text-muted-foreground">
                              Disponible :{" "}
                              {selectedProduct ? getDepotStock(selectedProduct, depot) : 0}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Quantite totale selectionnee</span>
                        <span className="font-semibold text-foreground">
                          {totalSelectedQuantity} / {totalAvailableForSelected}
                        </span>
                      </div>
                    </>
                  )}
                  <Button onClick={addItem} disabled={!selectedProduct || (!isReactiveProduct && totalSelectedQuantity === 0)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Articles de la vente</CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aucun article ajoute</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead className="text-right">Qte</TableHead>
                        <TableHead className="text-right">P.U. (DH)</TableHead>
                        <TableHead className="text-right">Total (DH)</TableHead>
                        <TableHead className="text-right">Repartition</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const periodLabel = formatReactivePeriodLabel(
                          item.reactiveStartDate ?? null,
                          item.reactiveEndDate ?? null,
                        );
                        return (
                          <TableRow key={item.productId}>
                            <TableCell className="font-medium">{item.productCode}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span>{item.designation}</span>
                                <span className="text-xs uppercase tracking-wide text-primary/80">
                                  {isReactiveType(item.productType) ? "Produit reactif" : `Type : ${item.productType}`}
                                </span>
                                {periodLabel && (
                                  <span className="text-xs text-muted-foreground">Periode : {periodLabel}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {isReactiveType(item.productType) ? "-" : item.quantity}
                            </TableCell>
                            <TableCell className="text-right">{item.unitPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {item.total.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {formatDistribution(item)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="destructive" size="sm" onClick={() => removeItem(item.productId)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Selectionner le client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedClient && (
                  <div className="mt-4 space-y-1 text-sm">
                    <p className="font-medium">{selectedClient.name}</p>
                    <p className="text-muted-foreground">ICE : {selectedClient.ice}</p>
                    <p className="text-muted-foreground">IF/TVA : {selectedClient.ifTva}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recapitulatif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total HT :</span>
                <span className="font-semibold">{totalHT.toFixed(2)} DH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TVA (20 %) :</span>
                <span className="font-semibold">{tva.toFixed(2)} DH</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between text-lg">
                  <span className="font-bold">Total TTC :</span>
                  <span className="font-bold text-primary">{totalTTC.toFixed(2)} DH</span>
                </div>
              </div>
              <Button
                className="w-full mt-4"
                size="lg"
                onClick={validateSale}
                disabled={items.length === 0 || !selectedClient}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Valider la vente
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Sale;

