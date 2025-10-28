import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { Sale as SaleType, SaleItem, Product, Client } from "@/types";
import { toast } from "sonner";

const Sale = () => {
  const { currentDepot, products, clients, sales, updateData, invoiceCounter } = useApp();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [items, setItems] = useState<SaleItem[]>([]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const getAvailableStock = (product: Product) => {
    if (currentDepot === "A") return product.stockA;
    if (currentDepot === "B") return product.stockB;
    return product.stockC;
  };

  const getTotalStock = (product: Product) => {
    return product.stockA + product.stockB + product.stockC;
  };

  const addItem = () => {
    if (!selectedProduct || !quantity) {
      toast.error("Veuillez sélectionner un produit et une quantité");
      return;
    }

    const qty = parseInt(quantity);
    const available = getAvailableStock(selectedProduct);

    if (qty <= 0) {
      toast.error("La quantité doit être supérieure à 0");
      return;
    }

    if (qty > available) {
      toast.error(`Stock insuffisant. Disponible: ${available}`);
      return;
    }

    const existingItem = items.find((i) => i.productId === selectedProduct.id);
    if (existingItem) {
      toast.error("Ce produit est déjà dans la liste");
      return;
    }

    const newItem: SaleItem = {
      productId: selectedProduct.id,
      productCode: selectedProduct.code,
      designation: selectedProduct.designation,
      quantity: qty,
      unitPrice: selectedProduct.price,
      total: qty * selectedProduct.price,
    };

    setItems([...items, newItem]);
    setSelectedProductId("");
    setQuantity("");
    toast.success("Article ajouté");
  };

  const removeItem = (productId: string) => {
    setItems(items.filter((i) => i.productId !== productId));
  };

  const calculateTotals = () => {
    const totalHT = items.reduce((sum, item) => sum + item.total, 0);
    const tva = totalHT * 0.2; // TVA 20%
    const totalTTC = totalHT + tva;
    return { totalHT, tva, totalTTC };
  };

  const validateSale = () => {
    if (!selectedClient) {
      toast.error("Veuillez sélectionner un client");
      return;
    }

    if (items.length === 0) {
      toast.error("Veuillez ajouter au moins un article");
      return;
    }

    const { totalHT, tva, totalTTC } = calculateTotals();
    const year = new Date().getFullYear();
    const newInvoiceNumber = `FAC-${year}-${String(invoiceCounter + 1).padStart(4, "0")}`;

    const newSale: SaleType = {
      id: Date.now().toString(),
      invoiceNumber: newInvoiceNumber,
      date: new Date().toISOString(),
      depot: currentDepot,
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      items: [...items],
      totalHT,
      tva,
      totalTTC,
    };

    // Update stock
    const updatedProducts = products.map((product) => {
      const saleItem = items.find((i) => i.productId === product.id);
      if (!saleItem) return product;

      if (currentDepot === "A") {
        return { ...product, stockA: product.stockA - saleItem.quantity };
      } else if (currentDepot === "B") {
        return { ...product, stockB: product.stockB - saleItem.quantity };
      } else {
        return { ...product, stockC: product.stockC - saleItem.quantity };
      }
    });

    updateData({
      sales: [...sales, newSale],
      products: updatedProducts,
      invoiceCounter: invoiceCounter + 1,
    });

    // Reset form
    setItems([]);
    setSelectedClientId("");
    toast.success(`Vente enregistrée - Facture: ${newInvoiceNumber}`);
  };

  const { totalHT, tva, totalTTC } = calculateTotals();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nouvelle vente</h1>
        <p className="text-muted-foreground">
          Dépôt actuel: <span className="font-semibold">{currentDepot}</span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ajouter un article</CardTitle>
              <CardDescription>
                Sélectionnez un produit et la quantité
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Produit</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un produit" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => {
                        const stock = getAvailableStock(product);
                        const totalStock = getTotalStock(product);
                        return (
                          <SelectItem key={product.id} value={product.id} disabled={stock === 0}>
                            {product.code} - {product.designation} (Stock total: {totalStock})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantité</Label>
                  <div className="flex gap-2">
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0"
                    />
                    <Button onClick={addItem}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {selectedProduct && (
                    <p className="text-xs text-muted-foreground">
                      Prix unitaire: {selectedProduct.price.toFixed(2)} DH
                    </p>
                  )}
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
                <p className="text-center text-muted-foreground py-8">
                  Aucun article ajouté
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Désignation</TableHead>
                        <TableHead className="text-right">Qté</TableHead>
                        <TableHead className="text-right">P.U. (DH)</TableHead>
                        <TableHead className="text-right">Total (DH)</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell className="font-medium">{item.productCode}</TableCell>
                          <TableCell>{item.designation}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {item.total.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeItem(item.productId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
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
                <Label>Sélectionner le client</Label>
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
                    <p className="text-muted-foreground">ICE: {selectedClient.ice}</p>
                    <p className="text-muted-foreground">IF/TVA: {selectedClient.ifTva}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Récapitulatif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total HT:</span>
                <span className="font-semibold">{totalHT.toFixed(2)} DH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TVA (20%):</span>
                <span className="font-semibold">{tva.toFixed(2)} DH</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between text-lg">
                  <span className="font-bold">Total TTC:</span>
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
