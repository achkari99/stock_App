import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, Trash2 } from "lucide-react";
import { Depot, PurchaseItem, Product } from "@/types";
import { isReactiveType } from "@/lib/utils";
import { toast } from "sonner";

const depotOrder: Depot[] = ["A", "B", "C"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    minimumFractionDigits: 2,
  }).format(value);

const calculateTotals = (items: PurchaseItem[]) => {
  const totalHT = items.reduce((sum, item) => sum + item.total, 0);
  const tva = totalHT * 0.2;
  const totalTTC = totalHT + tva;
  return { totalHT, tva, totalTTC };
};

const buildUpdatedProducts = (products: Product[], items: PurchaseItem[]) => {
  if (items.length === 0) {
    return products;
  }
  const delta = new Map<string, { A: number; B: number; C: number }>();
  items.forEach((item) => {
    if (!item.productId || isReactiveType(item.productType)) {
      return;
    }
    const perDepot = item.quantityPerDepot ?? {};
    const current = delta.get(item.productId) ?? { A: 0, B: 0, C: 0 };
    current.A += perDepot.A ?? 0;
    current.B += perDepot.B ?? 0;
    current.C += perDepot.C ?? 0;
    delta.set(item.productId, current);
  });

  return products.map((product) => {
    const change = delta.get(product.id);
    if (!change) {
      return product;
    }
    return {
      ...product,
      stockA: product.stockA + change.A,
      stockB: product.stockB + change.B,
      stockC: product.stockC + change.C,
    };
  });
};

const Purchases = () => {
  const { products, suppliers, purchaseCounter, createPurchase } = useApp();

  const [productCode, setProductCode] = useState("");
  const [productName, setProductName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<Depot, string>>({ A: "", B: "", C: "" });
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const matchedProduct = useMemo(() => {
    const trimmed = productCode.trim().toLowerCase();
    if (!trimmed) {
      return undefined;
    }
    return products.find((product) => product.code.toLowerCase() === trimmed);
  }, [productCode, products]);

  const isReactiveProduct = matchedProduct ? isReactiveType(matchedProduct.type) : false;

  useEffect(() => {
    if (matchedProduct) {
      setProductName(matchedProduct.designation);
      if (!unitPrice) {
        setUnitPrice(String(matchedProduct.price));
      }
    }
  }, [matchedProduct, unitPrice]);

  const generatePurchaseCode = () => {
    const year = new Date().getFullYear();
    return `ACH-${year}-${String(purchaseCounter + 1).padStart(4, "0")}`;
  };

  const handleAddItem = () => {
    if (!matchedProduct) {
      toast.error("Aucun produit ne correspond au code saisi.");
      return;
    }
    if (items.some((item) => item.productId === matchedProduct.id)) {
      toast.error("Ce produit est déjà dans le panier.");
      return;
    }

    const priceValue = unitPrice.trim().length > 0 ? Number(unitPrice) : matchedProduct.price;
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      toast.error("Le prix doit être supérieur à 0.");
      return;
    }

    if (isReactiveProduct) {
      const reactiveItem: PurchaseItem = {
        id: crypto.randomUUID(),
        productId: matchedProduct.id,
        productCode: matchedProduct.code,
        designation: matchedProduct.designation,
        productType: matchedProduct.type,
        quantity: 1,
        unitPrice: priceValue,
        total: priceValue,
        reactiveStartDate: matchedProduct.reactiveStartDate ?? null,
        reactiveEndDate: matchedProduct.reactiveEndDate ?? null,
      };
      setItems((prev) => [...prev, reactiveItem]);
      toast.success("Produit ajouté au panier.");
      setProductCode("");
      setProductName("");
      setUnitPrice("");
      return;
    }

    const perDepot: Partial<Record<Depot, number>> = {};
    let totalQuantity = 0;
    depotOrder.forEach((depot) => {
      const raw = quantities[depot];
      const parsed = raw ? parseInt(raw, 10) : 0;
      if (!Number.isNaN(parsed) && parsed > 0) {
        perDepot[depot] = parsed;
        totalQuantity += parsed;
      }
    });

    if (totalQuantity <= 0) {
      toast.error("Indiquez au moins une quantité pour un dépôt.");
      return;
    }

    const newItem: PurchaseItem = {
      id: crypto.randomUUID(),
      productId: matchedProduct.id,
      productCode: matchedProduct.code,
      designation: matchedProduct.designation,
      productType: matchedProduct.type,
      quantity: totalQuantity,
      unitPrice: priceValue,
      total: priceValue * totalQuantity,
      quantityPerDepot: perDepot,
      reactiveStartDate: null,
      reactiveEndDate: null,
    };

    setItems((prev) => [...prev, newItem]);
    toast.success("Produit ajouté au panier.");
    setProductCode("");
    setProductName("");
    setUnitPrice("");
    setQuantities({ A: "", B: "", C: "" });
  };

  const getItemKey = (item: PurchaseItem) => item.id ?? `${item.productId}-${item.productCode}-${item.total}`;

  const handleRemoveItem = (target: PurchaseItem) => {
    const targetKey = getItemKey(target);
    setItems((prev) => prev.filter((item) => getItemKey(item) !== targetKey));
  };

  const handleSubmit = async () => {
    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplier) {
      toast.error("Veuillez sélectionner un fournisseur.");
      return;
    }
    if (items.length === 0) {
      toast.error("Ajoutez au moins un produit au panier.");
      return;
    }

    setIsSubmitting(true);
    const { totalHT, tva, totalTTC } = calculateTotals(items);
    const updatedProducts = buildUpdatedProducts(products, items);

    try {
      await createPurchase({
        purchase: {
          code: generatePurchaseCode(),
          supplierId: supplier.id,
          supplierName: supplier.name,
          purchaseDate: new Date().toISOString(),
          notes: notes.trim() ? notes : null,
          items,
          totalHT,
          tva,
          totalTTC,
        },
        updatedProducts,
      });
      setItems([]);
      setSelectedSupplierId("");
      setProductCode("");
      setUnitPrice("");
      setQuantities({ A: "", B: "", C: "" });
      setNotes("");
      toast.success("Achat enregistré");
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de l'achat:", error);
      toast.error("Impossible d'enregistrer l'achat.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderProductInfo = () => {
    if (!matchedProduct) {
      if (productName.trim().length === 0) {
        return null;
      }
      return (
        <div className="text-sm text-muted-foreground">
          <div>
            <strong>Désignation :</strong> {productName}
          </div>
          <div>
            <strong>Type :</strong> -
          </div>
        </div>
      );
    }
    return (
      <div className="text-sm text-muted-foreground">
        <div>
          <strong>Désignation :</strong> {matchedProduct.designation}
        </div>
        <div>
          <strong>Type :</strong> {matchedProduct.type}
        </div>
      </div>
    );
  };

  const totalValues = calculateTotals(items);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Enregistrer un achat</h1>
          <p className="text-muted-foreground">Ajoutez les produits reçus et sélectionnez un fournisseur.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ajouter un produit</CardTitle>
              <CardDescription>Saisissez les informations des articles reçus.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="product-code">Code produit *</Label>
                  <Input
                    id="product-code"
                    value={productCode}
                    onChange={(event) => setProductCode(event.target.value)}
                    placeholder="Ex: PRD-001"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="product-name">Nom du produit *</Label>
                  <Input
                    id="product-name"
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    placeholder="Désignation du produit"
                    disabled={Boolean(matchedProduct)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit-price">Prix d'achat (DH) *</Label>
                <Input
                  id="unit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  placeholder={matchedProduct ? matchedProduct.price.toString() : "0.00"}
                />
              </div>

              {renderProductInfo()}

              {isReactiveProduct ? (
                <p className="text-sm text-muted-foreground">
                  Produit réactif - quantité fixée à 1 et dates déjà définies.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {depotOrder.map((depot) => (
                    <div className="grid gap-2" key={depot}>
                      <Label htmlFor={`qty-${depot}`}>Quantité dépôt {depot}</Label>
                      <Input
                        id={`qty-${depot}`}
                        type="number"
                        min="0"
                        value={quantities[depot]}
                        onChange={(event) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [depot]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="button" onClick={handleAddItem}>
                  Ajouter au panier
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Panier</CardTitle>
              <CardDescription>Liste des produits à enregistrer.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Prix</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Aucun article dans le panier.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={getItemKey(item)}>
                          <TableCell>
                            <div className="font-semibold">{item.designation}</div>
                            <div className="text-sm text-muted-foreground">{item.productCode}</div>
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell>{formatCurrency(item.total)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(item)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fournisseur</CardTitle>
              <CardDescription>Choisissez le fournisseur concerné.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Fournisseur *</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un fournisseur" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Commentaires ou références..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Récapitulatif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total HT</span>
                  <span className="font-semibold">{formatCurrency(totalValues.totalHT)}</span>
                </div>
                <div className="flex justify-between">
                  <span>TVA (20%)</span>
                  <span className="font-semibold">{formatCurrency(totalValues.tva)}</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Total TTC</span>
                  <span>{formatCurrency(totalValues.totalTTC)}</span>
                </div>
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Valider l'achat
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Purchases;
