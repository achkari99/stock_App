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
import { Sale } from "@/types";

const History = () => {
  const { sales, clients } = useApp();
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

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

    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Facture ${sale.invoiceNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #333;
          }
          .header {
            display: flex;
            justify-content: space-between;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .company {
            font-weight: bold;
            font-size: 20px;
          }
          .invoice-title {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
          }
          .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .info-box {
            width: 48%;
          }
          .info-box h3 {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #2563eb;
          }
          .info-box p {
            margin: 5px 0;
            font-size: 13px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #2563eb;
            color: white;
            padding: 12px;
            text-align: left;
            font-size: 13px;
          }
          td {
            padding: 10px;
            border-bottom: 1px solid #ddd;
            font-size: 13px;
          }
          .text-right {
            text-align: right;
          }
          .totals {
            width: 350px;
            margin-left: auto;
            margin-top: 20px;
          }
          .totals div {
            display: flex;
            justify-content: space-between;
            padding: 8px 15px;
            border-bottom: 1px solid #ddd;
          }
          .totals .total-ttc {
            background-color: #2563eb;
            color: white;
            font-size: 18px;
            font-weight: bold;
            border: none;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company">VOTRE ENTREPRISE</div>
            <p style="margin: 5px 0; font-size: 13px;">Adresse de l'entreprise</p>
            <p style="margin: 5px 0; font-size: 13px;">Téléphone: +212 XXX XXX XXX</p>
            <p style="margin: 5px 0; font-size: 13px;">ICE: XXXXXXXXXXXXXXX</p>
          </div>
          <div style="text-align: right;">
            <div class="invoice-title">FACTURE</div>
            <p style="margin: 5px 0; font-size: 14px;">${sale.invoiceNumber}</p>
            <p style="margin: 5px 0; font-size: 13px;">Date: ${format(new Date(sale.date), "dd/MM/yyyy", { locale: fr })}</p>
            <p style="margin: 5px 0; font-size: 13px;">Dépôt: ${sale.depot}</p>
          </div>
        </div>

        <div class="info-section">
          <div class="info-box">
            <h3>CLIENT</h3>
            <p><strong>${client.name}</strong></p>
            <p>${client.address}</p>
            <p>ICE: ${client.ice}</p>
            <p>IF/TVA: ${client.ifTva}</p>
            <p>Tél: ${client.phone}</p>
            <p>Email: ${client.email}</p>
          </div>
          <div class="info-box">
            <h3>INFORMATIONS DE PAIEMENT</h3>
            <p>Mode de paiement: À définir</p>
            <p>Conditions: À définir</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Désignation</th>
              <th class="text-right">Quantité</th>
              <th class="text-right">Prix unitaire</th>
              <th class="text-right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items
              .map(
                (item) => `
              <tr>
                <td>${item.productCode}</td>
                <td>${item.designation}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">${item.unitPrice.toFixed(2)} DH</td>
                <td class="text-right">${item.total.toFixed(2)} DH</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div class="totals">
          <div>
            <span>Total HT:</span>
            <span>${sale.totalHT.toFixed(2)} DH</span>
          </div>
          <div>
            <span>TVA (20%):</span>
            <span>${sale.tva.toFixed(2)} DH</span>
          </div>
          <div class="total-ttc">
            <span>Total TTC:</span>
            <span>${sale.totalTTC.toFixed(2)} DH</span>
          </div>
        </div>

        <div class="footer">
          <p>Merci de votre confiance</p>
          <p>Cette facture est générée électroniquement et ne nécessite pas de signature</p>
        </div>
      </body>
      </html>
    `;

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
