import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Upload } from "lucide-react";
import { exportData, importData } from "@/lib/storage";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";

const Settings = () => {
  const { reloadData } = useApp();

  const handleExport = () => {
    exportData();
    toast.success("Sauvegarde exportée avec succès");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importData(file)
        .then(() => {
          reloadData();
          toast.success("Données importées avec succès");
        })
        .catch(() => {
          toast.error("Erreur lors de l'importation");
        });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">
          Gérez vos sauvegardes et paramètres
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sauvegarde des données</CardTitle>
          <CardDescription>
            Exportez ou importez vos données de gestion
          </CardDescription>
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
            <h3 className="mb-2 text-sm font-medium">Importer les données</h3>
            <div className="flex items-center gap-4">
              <Input
                id="file-upload"
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
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
              Attention: L'importation remplacera toutes les données actuelles
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations de l'entreprise</CardTitle>
          <CardDescription>
            Configurez les informations pour la facturation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cette fonctionnalité sera disponible prochainement
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
