import { useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Printer, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sale, Purchase, Depot, PurchaseItem, Product } from "@/types";
import { buildInvoiceHtml } from "@/templates/invoice";
import { buildDeliveryNoteHtml } from "@/templates/delivery-note";
import { isReactiveType } from "@/lib/utils";
import { toast } from "sonner";

const depotOrder: Depot[] = ["A", "B", "C"];

const formatDistribution = (sale: Sale, item: Sale["items"][number]) => {
  if (isReactiveType(item.productType)) {
    return "-";
  }

  const distribution =
    item.quantityPerDepot ??
    ({
      [sale.depot]: item.quantity,
    } as Partial<Record<Depot, number>>);

  return (
    depotOrder
      .map((depot) => {
        const qty = distribution[depot] ?? 0;
        return qty > 0 ? `${depot}:${qty}` : null;
      })
      .filter(Boolean)
      .join(" | ") || "-"
  );
};

const formatPurchaseDistribution = (item: PurchaseItem) => {
  if (isReactiveType(item.productType)) {
    return "-";
  }
  const perDepot = item.quantityPerDepot ?? {};
  return (
    depotOrder
      .map((depot) => {
        const qty = perDepot[depot] ?? 0;
        return qty > 0 ? `${depot}:${qty}` : null;
      })
      .filter(Boolean)
      .join(" | ") || "-"
  );
};

type Transaction = {
  kind: "sale" | "purchase";
  sale?: Sale;
  purchase?: Purchase;
  id: string;
  code: string;
  date: string;
  counterpart: string;
  total: number;
};

const buildTransactions = (sales: Sale[], purchases: Purchase[]): Transaction[] => {
  const saleTx = sales.map((sale) => ({
    kind: "sale" as const,
    sale,
    id: sale.id,
    code: sale.invoiceNumber,
    date: sale.date,
    counterpart: sale.clientName,
    total: sale.totalTTC,
  }));

  const purchaseTx = purchases.map((purchase) => ({
    kind: "purchase" as const,
    purchase,
    id: purchase.id,
    code: purchase.code,
    date: purchase.purchaseDate,
    counterpart: purchase.supplierName,
    total: purchase.totalTTC,
  }));

  return [...saleTx, ...purchaseTx].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
};

const buildRevertedProducts = (products: Product[], purchase: Purchase) => {
  const delta = new Map<string, { A: number; B: number; C: number }>();
  purchase.items.forEach((item) => {
    if (!item.productId || isReactiveType(item.productType)) {
      return;
    }
    const perDepot = item.quantityPerDepot ?? {};
    const entry = delta.get(item.productId) ?? { A: 0, B: 0, C: 0 };
    entry.A += perDepot.A ?? 0;
    entry.B += perDepot.B ?? 0;
    entry.C += perDepot.C ?? 0;
    delta.set(item.productId, entry);
  });

  return products.map((product) => {
    const change = delta.get(product.id);
    if (!change) {
      return product;
    }
    return {
      ...product,
      stockA: product.stockA - change.A,
      stockB: product.stockB - change.B,
      stockC: product.stockC - change.C,
    };
  });
};

const History = () => {
  const { sales, purchases, clients, suppliers, products, deleteSale, deletePurchase } = useApp();
  const [search, setSearch] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const transactions = useMemo(() => buildTransactions(sales, purchases), [sales, purchases]);

  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return transactions;
    }
    return transactions.filter(
      (transaction) =>
        transaction.code.toLowerCase().includes(term) ||
        transaction.counterpart.toLowerCase().includes(term),
    );
  }, [transactions, search]);

  const printInvoice = (sale: Sale) => {
    const client = clients.find((c) => c.id === sale.clientId);
    if (!client) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const deliveryNoteHtml = buildDeliveryNoteHtml(sale, client);
    const invoiceHTML = buildInvoiceHtml(sale, client, { appendContent: deliveryNoteHtml });
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDeleteTransaction = async (transaction: Transaction) => {
    if (transaction.kind === "sale") {
      if (!confirm("Êtes-vous sûr de vouloir supprimer cette vente ?")) {
        return;
      }
      try {
        await deleteSale(transaction.id);
        setSelectedTransaction((prev) => (prev?.id === transaction.id ? null : prev));
        toast.success("Vente supprimée");
      } catch (error) {
        console.error("Erreur lors de la suppression de la vente:", error);
        toast.error("Impossible de supprimer la vente.");
      }
      return;
    }

    if (!transaction.purchase) {
      return;
    }
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet achat ?")) {
      return;
    }
    try {
      const revertedProducts = buildRevertedProducts(products, transaction.purchase);
      await deletePurchase(transaction.id, revertedProducts);
      setSelectedTransaction((prev) => (prev?.id === transaction.id ? null : prev));
      toast.success("Achat supprimé");
    } catch (error) {
      console.error("Erreur lors de la suppression de l'achat:", error);
      toast.error("Impossible de supprimer l'achat.");
    }
  };

  const renderSaleDetails = (sale: Sale) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">N° facture</p>
          <p className="font-semibold">{sale.invoiceNumber}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Date</p>
          <p className="font-semibold">
            {format(new Date(sale.date), "dd MMMM yyyy à HH:mm", { locale: fr })}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Client</p>
          <p className="font-semibold">{sale.clientName}</p>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>Détails</TableHead>
              <TableHead>Quantité</TableHead>
              <TableHead>Distribution</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.items.map((item) => (
              <TableRow key={item.productId}>
                <TableCell>
                  <div className="font-semibold">{item.designation}</div>
                  <div className="text-sm text-muted-foreground">{item.productCode}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <div>{isReactiveType(item.productType) ? "Produit réactif" : `Type : ${item.productType}`}</div>
                  {item.reactiveStartDate && item.reactiveEndDate && (
                    <div>
                      Période : {new Date(item.reactiveStartDate).toLocaleDateString("fr-FR")} au{" "}
                      {new Date(item.reactiveEndDate).toLocaleDateString("fr-FR")}
                    </div>
                  )}
                </TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{formatDistribution(sale, item)}</TableCell>
                <TableCell className="text-right">{item.total.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderPurchaseDetails = (purchase: Purchase) => {
    const supplier = suppliers.find((supplier) => supplier.id === purchase.supplierId);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Code d'achat</p>
            <p className="font-semibold">{purchase.code}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Date</p>
            <p className="font-semibold">
              {format(new Date(purchase.purchaseDate), "dd MMMM yyyy à HH:mm", { locale: fr })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fournisseur</p>
            <p className="font-semibold">{purchase.supplierName}</p>
            {supplier && (
              <p className="text-sm text-muted-foreground">
                {supplier.phone} • {supplier.email}
              </p>
            )}
          </div>
          {purchase.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="font-semibold whitespace-pre-line">{purchase.notes}</p>
            </div>
          )}
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Détails</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Répartition</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchase.items.map((item, index) => {
                const key = item.productId ? `${item.productId}-${index}` : `${item.productCode}-${index}`;
                return (
                  <TableRow key={key}>
                    <TableCell>
                      <div className="font-semibold">{item.designation}</div>
                      <div className="text-sm text-muted-foreground">{item.productCode}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Type : {item.productType}
                    </TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{formatPurchaseDistribution(item)}</TableCell>
                    <TableCell className="text-right">{item.total.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Historique des transactions</h1>
        <p className="text-muted-foreground">Ventes et achats enregistrés dans l'application.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des transactions</CardTitle>
          <CardDescription>Suivi global des ventes et achats.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par référence ou interlocuteur..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Interlocuteur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total TTC (DH)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Aucune transaction trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">{transaction.code}</TableCell>
                      <TableCell>
                        {format(new Date(transaction.date), "dd/MM/yyyy à HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell>{transaction.counterpart}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            transaction.kind === "sale"
                              ? "border border-green-600 text-green-700 bg-transparent hover:bg-transparent"
                              : "border border-blue-600 text-blue-700 bg-transparent hover:bg-transparent"
                          }
                        >
                          {transaction.kind === "sale" ? "Vendu" : "Acheté"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {transaction.total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setSelectedTransaction(transaction)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                          {transaction.kind === "sale" && transaction.sale && (
                            <Button variant="default" size="sm" onClick={() => printInvoice(transaction.sale!)}>
                              <Printer className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteTransaction(transaction)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

  <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {selectedTransaction?.kind === "sale" ? "Détails de la vente" : "Détails de l'achat"}
        </DialogTitle>
      </DialogHeader>
      {selectedTransaction?.kind === "sale" && selectedTransaction.sale && renderSaleDetails(selectedTransaction.sale)}
      {selectedTransaction?.kind === "purchase" &&
        selectedTransaction.purchase &&
        renderPurchaseDetails(selectedTransaction.purchase)}
    </DialogContent>
  </Dialog>
    </div>
  );
};

export default History;
