import { useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { Supplier } from "@/types";
import { toast } from "sonner";

const Suppliers = () => {
  const { suppliers, createSupplier, updateSupplier, deleteSupplier } = useApp();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    ice: "",
    ifTva: "",
    address: "",
    phone: "",
    email: "",
  });

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter(
        (supplier) =>
          supplier.name.toLowerCase().includes(search.toLowerCase()) ||
          supplier.ice.toLowerCase().includes(search.toLowerCase()),
      ),
    [suppliers, search],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingSupplier) {
        await updateSupplier({ id: editingSupplier.id, ...formData });
        toast.success("Fournisseur modifié avec succès");
      } else {
        await createSupplier(formData);
        toast.success("Fournisseur ajouté avec succès");
      }
      handleClose();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du fournisseur:", error);
      toast.error("Impossible d'enregistrer le fournisseur.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      ice: supplier.ice,
      ifTva: supplier.ifTva,
      address: supplier.address,
      phone: supplier.phone,
      email: supplier.email,
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce fournisseur ?")) {
      return;
    }
    try {
      await deleteSupplier(id);
      toast.success("Fournisseur supprimé");
    } catch (error) {
      console.error("Erreur lors de la suppression du fournisseur:", error);
      toast.error("Impossible de supprimer le fournisseur.");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingSupplier(null);
    setFormData({
      name: "",
      ice: "",
      ifTva: "",
      address: "",
      phone: "",
      email: "",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des fournisseurs</h1>
          <p className="text-muted-foreground">Suivez et mettez à jour vos fournisseurs</p>
        </div>
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un fournisseur
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des fournisseurs</CardTitle>
          <CardDescription>Consultez et modifiez les informations de vos fournisseurs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou ICE..."
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
                  <TableHead>Nom</TableHead>
                  <TableHead>ICE</TableHead>
                  <TableHead>IF/TVA</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Aucun fournisseur trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.ice}</TableCell>
                      <TableCell>{supplier.ifTva}</TableCell>
                      <TableCell>{supplier.phone}</TableCell>
                      <TableCell>{supplier.email}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(supplier)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(supplier.id)}>
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Modifier le fournisseur" : "Ajouter un fournisseur"}</DialogTitle>
            <DialogDescription>Remplissez les informations du fournisseur</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nom / Raison sociale *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="ice">ICE *</Label>
                  <Input
                    id="ice"
                    value={formData.ice}
                    onChange={(event) => setFormData({ ...formData, ice: event.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ifTva">IF/TVA *</Label>
                  <Input
                    id="ifTva"
                    value={formData.ifTva}
                    onChange={(event) => setFormData({ ...formData, ifTva: event.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Adresse *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(event) => setFormData({ ...formData, address: event.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="phone">Téléphone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                    required
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {editingSupplier ? "Modifier" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Suppliers;
