import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload } from "lucide-react";
import { exportData, importData } from "@/lib/storage";
import { useApp } from "@/contexts/AppContext";
import { DEFAULT_PRODUCT_TYPES, type ProductType } from "@/types";
import { toast } from "sonner";

const normalizeType = (value: string) => value.trim().toLowerCase();

const Settings = () => {
  const { reloadData, productTypes, products, removeProductType } = useApp();
  const [typeToDelete, setTypeToDelete] = useState<ProductType>("");

  const sanitizedProductTypes = useMemo<ProductType[]>(() => {
    const seen = new Set<string>();
    const result: ProductType[] = [];

    const addType = (type: ProductType | null | undefined) => {
      if (!type) return;
      const trimmed = type.trim();
      if (!trimmed) return;
      const normalized = normalizeType(trimmed);
      if (seen.has(normalized)) return;
      seen.add(normalized);
      result.push(trimmed);
    };

    DEFAULT_PRODUCT_TYPES.forEach(addType);
    productTypes.forEach(addType);

    return result;
  }, [productTypes]);

  const deletableTypes = useMemo(
    () =>
      sanitizedProductTypes.filter(
        (type) => !DEFAULT_PRODUCT_TYPES.some((defaultType) => normalizeType(defaultType) === normalizeType(type)),
      ),
    [sanitizedProductTypes],
  );

  useEffect(() => {
    if (!typeToDelete || !deletableTypes.includes(typeToDelete)) {
      setTypeToDelete(deletableTypes[0] ?? "");
    }
  }, [deletableTypes, typeToDelete]);

  const handleExport = async () => {
    try {
      await exportData();
      toast.success("Sauvegarde exportée avec succès.");
    } catch (error) {
      console.error("Erreur lors de l'exportation:", error);
      toast.error("Erreur lors de l'exportation.");
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await importData(file);
      await reloadData();
      toast.success("Données importées avec succès.");
    } catch (error) {
      console.error("Erreur lors de l'importation:", error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'importation.");
    }
  };

  const handleDeleteType = async () => {
    if (!typeToDelete) {
      toast.error("Veuillez sélectionner un type à supprimer.");
      return;
    }

    const targetNormalized = normalizeType(typeToDelete);
    const remainingTypes = sanitizedProductTypes.filter((type) => normalizeType(type) !== targetNormalized);

    if (remainingTypes.length === sanitizedProductTypes.length) {
      toast.error("Impossible de supprimer ce type.");
      return;
    }

    if (remainingTypes.length === 0) {
      toast.error("Au moins un type de produit doit être conservé.");
      return;
    }

    const impactedProducts = products.filter((product) => normalizeType(product.type) === targetNormalized);
    if (impactedProducts.length > 0) {
      toast.error("Ce type est encore utilisé par un ou plusieurs produits.");
      return;
    }

    try {
      await removeProductType(typeToDelete);
      setTypeToDelete("");
      toast.success("Type supprimé.");
    } catch (error) {
      console.error("Erreur lors de la suppression du type:", error);
      toast.error(error instanceof Error ? error.message : "Impossible de supprimer ce type.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">Gérez vos sauvegardes et vos types de produit</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sauvegarde des données</CardTitle>
          <CardDescription>Exportez ou importez vos données de gestion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-medium">Exporter les données</h3>
            <Button onClick={handleExport} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Télécharger la sauvegarde
            </Button>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Importer des données</h3>
            <div className="flex items-center gap-4">
              <Input id="file-upload" type="file" accept=".json" onChange={handleImport} className="hidden" />
              <Button
                variant="outline"
                onClick={() => document.getElementById("file-upload")?.click()}
                className="w-full sm:w-auto"
              >
                <Upload className="mr-2 h-4 w-4" />
                Charger une sauvegarde
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Attention : l'importation remplacera toutes les données actuelles.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gestion des types de produit</CardTitle>
          <CardDescription>Supprimez les types personnalisés dont vous n'avez plus besoin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {deletableTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun type personnalisé à supprimer.</p>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="type-to-delete">Type à supprimer</Label>
                <Select value={typeToDelete} onValueChange={(value) => setTypeToDelete(value as ProductType)}>
                  <SelectTrigger id="type-to-delete">
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {deletableTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="destructive" onClick={handleDeleteType}>
                Supprimer
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Un type ne peut être supprimé que s'il n'est plus utilisé par un produit actif.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations de l'entreprise</CardTitle>
          <CardDescription>Configurez les informations pour la facturation</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cette fonctionnalité sera disponible prochainement.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;

