import { useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Depot, Product } from "@/types";
import { Warehouse, Package, Users, TrendingUp } from "lucide-react";

const depots: { id: Depot; name: string; color: string }[] = [
  { id: "A", name: "Depot A", color: "bg-blue-500" },
  { id: "B", name: "Depot B", color: "bg-green-500" },
  { id: "C", name: "Depot C", color: "bg-orange-500" },
];

const Dashboard = () => {
  const { currentDepot, setCurrentDepot, products, clients, sales } = useApp();

  const stockKeyByDepot: Record<Depot, keyof Product> = {
    A: "stockA",
    B: "stockB",
    C: "stockC",
  };

  const currentDepotMeta = depots.find((depot) => depot.id === currentDepot);
  const currentKey = stockKeyByDepot[currentDepot];

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat("fr-FR"),
    []
  );
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "MAD",
        minimumFractionDigits: 2,
      }),
    []
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    []
  );

  const totalStock = products.reduce(
    (sum, product) => sum + product.stockA + product.stockB + product.stockC,
    0
  );

  const depotStock = products.reduce(
    (sum, product) => sum + product[currentKey],
    0
  );

  const depotProductsWithStock = products.filter(
    (product) => product[currentKey] > 0
  ).length;

  const lowStockThreshold = 5;
  const depotLowStock = products.filter(
    (product) => product[currentKey] > 0 && product[currentKey] <= lowStockThreshold
  ).length;

  const depotStockValue = products.reduce(
    (sum, product) => sum + product[currentKey] * product.price,
    0
  );

  const depotSalesAggregate = sales.reduce(
    (acc, sale) => {
      const contribution = sale.items.reduce(
        (itemAcc, item) => {
          const distribution =
            item.quantityPerDepot ??
            ({ [sale.depot]: item.quantity } as Partial<Record<Depot, number>>);
          const depotQuantity = distribution[currentDepot] ?? 0;
          if (depotQuantity <= 0) return itemAcc;

          const share =
            item.quantity > 0 ? depotQuantity / item.quantity : 0;
          return {
            quantity: itemAcc.quantity + depotQuantity,
            total: itemAcc.total + item.total * share,
          };
        },
        { quantity: 0, total: 0 }
      );

      if (contribution.quantity <= 0) {
        return acc;
      }

      const saleDate = new Date(sale.date);
      const isValidDate = !Number.isNaN(saleDate.getTime());

      return {
        count: acc.count + 1,
        quantity: acc.quantity + contribution.quantity,
        total: acc.total + contribution.total,
        lastSaleDate:
          isValidDate && (!acc.lastSaleDate || saleDate > acc.lastSaleDate)
            ? saleDate
            : acc.lastSaleDate,
      };
    },
    {
      count: 0,
      quantity: 0,
      total: 0,
      lastSaleDate: null as Date | null,
    }
  );

  const topProducts = [...products]
    .sort((a, b) => b[currentKey] - a[currentKey])
    .slice(0, 5);

  const globalStats = [
    {
      title: "Produits",
      value: products.length,
      icon: Package,
      color: "text-primary",
    },
    {
      title: "Clients",
      value: clients.length,
      icon: Users,
      color: "text-accent",
    },
    {
      title: "Ventes",
      value: sales.length,
      icon: TrendingUp,
      color: "text-warning",
    },
    {
      title: "Stock total",
      value: totalStock,
      icon: Warehouse,
      color: "text-destructive",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground">
          Selectionnez un depot pour commencer
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {globalStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selection du depot</CardTitle>
          <CardDescription>
            Choisissez le depot avec lequel vous souhaitez travailler
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {depots.map((depot) => (
              <Button
                key={depot.id}
                variant={currentDepot === depot.id ? "default" : "outline"}
                size="lg"
                onClick={() => setCurrentDepot(depot.id)}
                className="h-24 flex-col gap-2"
              >
                <Warehouse className="h-8 w-8" />
                <span className="text-lg font-semibold">{depot.name}</span>
                {currentDepot === depot.id && (
                  <span className="text-xs">(Selectionne)</span>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Statistiques detaillees - {currentDepotMeta?.name ?? currentDepot}
          </CardTitle>
          <CardDescription>
            Vue d ensemble du depot {currentDepot}: stocks, ventes et produits a
            surveiller
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Stock disponible</p>
              <p className="mt-2 text-2xl font-bold">
                {numberFormatter.format(depotStock)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {depotLowStock > 0
                  ? `${depotLowStock} produit(s) sous ${lowStockThreshold} unites`
                  : "Stock confortable"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Produits actifs</p>
              <p className="mt-2 text-2xl font-bold">
                {numberFormatter.format(depotProductsWithStock)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {products.length > 0
                  ? `${Math.round(
                      (depotProductsWithStock / products.length) * 100
                    )}% du catalogue`
                  : "Aucun produit enregistre"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Valeur estimee</p>
              <p className="mt-2 text-2xl font-bold">
                {currencyFormatter.format(depotStockValue)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Prix catalogue x quantites
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Ventes rattachees</p>
              <p className="mt-2 text-2xl font-bold">
                {currencyFormatter.format(depotSalesAggregate.total)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {depotSalesAggregate.count > 0
                  ? `${depotSalesAggregate.count} vente(s)${
                      depotSalesAggregate.lastSaleDate
                        ? ` - Derniere: ${dateTimeFormatter.format(
                            depotSalesAggregate.lastSaleDate
                          )}`
                        : ""
                    }`
                  : "Aucune vente enregistree"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Produits principaux du depot
            </p>
            <div className="mt-3 space-y-2">
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun produit pour ce depot pour le moment.
                </p>
              ) : (
                topProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {product.designation}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Code: {product.code}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {numberFormatter.format(product[currentKey])} unites
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Valeur:{" "}
                        {currencyFormatter.format(
                          product[currentKey] * product.price
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
