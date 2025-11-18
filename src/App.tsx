import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { Layout } from "@/components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Clients from "./pages/Clients";
import Suppliers from "./pages/Suppliers";
import Purchases from "./pages/Purchases";
import Sale from "./pages/Sale";
import History from "./pages/History";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const RouterComponent =
  typeof window !== "undefined" && window.electronAPI ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <RouterComponent>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/sale" element={<Sale />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </RouterComponent>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
