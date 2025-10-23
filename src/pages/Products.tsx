import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { Product } from "@/types";
import { toast } from "sonner";

const Products = () => {
  const { products, updateData, currentDepot } = useApp();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    designation: "",
    price: "",
    stockA: "",
    stockB: "",
    stockC: "",
  });

  const filteredProducts = products.filter(
    (p) =>
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.designation.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingProduct) {
      updateData({
        products: products.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                code: formData.code,
                designation: formData.designation,
                price: parseFloat(formData.price),
                stockA: parseInt(formData.stockA),
                stockB: parseInt(formData.stockB),
                stockC: parseInt(formData.stockC),
              }
            : p
        ),
      });
      toast.success("Produit modifié avec succès");
    } else {
      const newProduct: Product = {
        id: Date.now().toString(),
        code: formData.code,
        designation: formData.designation,
        price: parseFloat(formData.price),
        stockA: parseInt(formData.stockA) || 0,
        stockB: parseInt(formData.stockB) || 0,
        stockC: parseInt(formData.stockC) || 0,
      };
      updateData({ products: [...products, newProduct] });
      toast.success("Produit ajouté avec succès");
    }
    
    handleClose();
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      code: product.code,
      designation: product.designation,
      price: product.price.toString(),
      stockA: product.stockA.toString(),
      stockB: product.stockB.toString(),
      stockC: product.stockC.toString(),
    });
    setIsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) {
      updateData({ products: products.filter((p) => p.id !== id) });
      toast.success("Produit supprimé");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingProduct(null);
    setFormData({
      code: "",
      designation: "",
      price: "",
      stockA: "",
      stockB: "",
      stockC: "",
    });
  };

  const getStock = (product: Product) => {
    if (currentDepot === "A") return product.stockA;
    if (currentDepot === "B") return product.stockB;
    return product.stockC;
  };

  const getTotalStock = (product: Product) => {
    return product.stockA + product.stockB + product.stockC;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des produits</h1>
          <p className="text-muted-foreground">
            Dépôt actuel: <span className="font-semibold">{currentDepot}</span>
          </p>
        </div>
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un produit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des produits</CardTitle>
          <CardDescription>
            Gérez vos produits et consultez les stocks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par code ou désignation..."
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
                  <TableHead>Code</TableHead>
                  <TableHead>Désignation</TableHead>
                  <TableHead className="text-right">Prix (DH)</TableHead>
                  <TableHead className="text-right">Stock {currentDepot}</TableHead>
                  <TableHead className="text-right">Stock total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Aucun produit trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.code}</TableCell>
                      <TableCell>{product.designation}</TableCell>
                      <TableCell className="text-right">{product.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{getStock(product)}</TableCell>
                      <TableCell className="text-right font-semibold">{getTotalStock(product)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(product.id)}
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Modifier le produit" : "Ajouter un produit"}
            </DialogTitle>
            <DialogDescription>
              Remplissez les informations du produit
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Code produit *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="designation">Désignation *</Label>
                <Input
                  id="designation"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">Prix unitaire (DH) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="stockA">Stock A</Label>
                  <Input
                    id="stockA"
                    type="number"
                    min="0"
                    value={formData.stockA}
                    onChange={(e) => setFormData({ ...formData, stockA: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="stockB">Stock B</Label>
                  <Input
                    id="stockB"
                    type="number"
                    min="0"
                    value={formData.stockB}
                    onChange={(e) => setFormData({ ...formData, stockB: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="stockC">Stock C</Label>
                  <Input
                    id="stockC"
                    type="number"
                    min="0"
                    value={formData.stockC}
                    onChange={(e) => setFormData({ ...formData, stockC: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button type="submit">
                {editingProduct ? "Modifier" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
