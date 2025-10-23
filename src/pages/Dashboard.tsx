import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Depot } from "@/types";
import { Warehouse, Package, Users, TrendingUp } from "lucide-react";

const depots: { id: Depot; name: string; color: string }[] = [
  { id: "A", name: "Dépôt A", color: "bg-blue-500" },
  { id: "B", name: "Dépôt B", color: "bg-green-500" },
  { id: "C", name: "Dépôt C", color: "bg-orange-500" },
];

const Dashboard = () => {
  const { currentDepot, setCurrentDepot, products, clients, sales } = useApp();

  const totalStock = products.reduce(
    (sum, p) => sum + p.stockA + p.stockB + p.stockC,
    0
  );

  const stats = [
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
          Sélectionnez un dépôt pour commencer
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
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
          <CardTitle>Sélection du dépôt</CardTitle>
          <CardDescription>
            Choisissez le dépôt avec lequel vous souhaitez travailler
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
                  <span className="text-xs">(Sélectionné)</span>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
