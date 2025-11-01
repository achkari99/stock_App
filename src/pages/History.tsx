import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Printer, FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sale, Depot } from "@/types";
import { buildInvoiceHtml } from "@/templates/invoice";

const History = () => {
  const { sales, clients } = useApp();
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const depotOrder: Depot[] = ["A", "B", "C"];

  const formatDistribution = (sale: Sale, item: Sale["items"][number]) => {
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

  const filteredSales = sales.filter(
    (s) =>
      s.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.clientName.toLowerCase().includes(search.toLowerCase())
  );

  const printInvoice = (sale: Sale) => {
    const client = clients.find((c) => c.id === sale.clientId);
    if (!client) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const invoiceHTML = buildInvoiceHtml(sale, client);

    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Historique des ventes</h1>
        <p className="text-muted-foreground">
          Consultez et imprimez vos factures
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des ventes</CardTitle>
          <CardDescription>
            Historique complet des transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par numéro de facture ou client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Facture</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Dépôt</TableHead>
                  <TableHead className="text-right">Total TTC (DH)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Aucune vente trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">{sale.invoiceNumber}</TableCell>
                        <TableCell>
                          {format(new Date(sale.date), "dd/MM/yyyy à HH:mm", { locale: fr })}
                        </TableCell>
                        <TableCell>{sale.clientName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{sale.depot}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {sale.totalTTC.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedSale(sale)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => printInvoice(sale)}
                            >
                              <Printer className="h-4 w-4" />
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

      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de la vente</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">N° Facture</p>
                  <p className="font-semibold">{selectedSale.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-semibold">
                    {format(new Date(selectedSale.date), "dd MMMM yyyy à HH:mm", { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-semibold">{selectedSale.clientName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dépôt</p>
                  <p className="font-semibold">{selectedSale.depot}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Articles</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Désignation</TableHead>
                        <TableHead className="text-right">Qté</TableHead>
                        <TableHead className="text-right">P.U.</TableHead>
                        <TableHead className="text-right">Repartition</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSale.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.productCode}</TableCell>
                          <TableCell>{item.designation}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{item.unitPrice.toFixed(2)} DH</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {formatDistribution(selectedSale, item)}
                          </TableCell>
                          <TableCell className="text-right">{item.total.toFixed(2)} DH</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="space-y-2 max-w-xs ml-auto">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total HT:</span>
                    <span className="font-semibold">{selectedSale.totalHT.toFixed(2)} DH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TVA (20%):</span>
                    <span className="font-semibold">{selectedSale.tva.toFixed(2)} DH</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-lg">
                    <span className="font-bold">Total TTC:</span>
                    <span className="font-bold text-primary">
                      {selectedSale.totalTTC.toFixed(2)} DH
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedSale(null)}>
                  Fermer
                </Button>
                <Button onClick={() => printInvoice(selectedSale)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimer la facture
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default History;

