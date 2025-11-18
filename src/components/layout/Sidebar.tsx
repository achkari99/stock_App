import { Link, useLocation } from "react-router-dom";
import { 
  Package, 
  Users, 
  ShoppingCart, 
  History, 
  Settings, 
  Warehouse,
  Truck,
  ShoppingBag 
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "D\u00e9p\u00f4ts", href: "/", icon: Warehouse },
  { name: "Produits", href: "/products", icon: Package },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Fournisseurs", href: "/suppliers", icon: Truck },
  { name: "Acheter", href: "/purchases", icon: ShoppingBag },
  { name: "Nouvelle vente", href: "/sale", icon: ShoppingCart },
  { name: "Historique", href: "/history", icon: History },
  { name: "Param\u00e8tres", href: "/settings", icon: Settings },
];

export const Sidebar = () => {
  const location = useLocation();

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-6">
        <h1 className="text-xl font-bold">Gestion de Stock</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

