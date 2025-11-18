import { useMemo, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { Product, ProductType, DEFAULT_PRODUCT_TYPES } from "@/types";
import { toast } from "sonner";
import { isReactiveType } from "@/lib/utils";

type ProductFormData = {
  type: ProductType;
  code: string;
  designation: string;
  price: string;
  stockA: string;
  stockB: string;
  stockC: string;
  reactiveStartDate: string;
  reactiveEndDate: string;
};

const createEmptyFormData = (initialType: ProductType): ProductFormData => ({
  type: initialType,
  code: "",
  designation: "",
  price: "",
  stockA: "",
  stockB: "",
  stockC: "",
  reactiveStartDate: "",
  reactiveEndDate: "",
});

const formatDateForDisplay = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("fr-FR");
};

const formatReactivePeriod = (product: Product) => {
  const start = formatDateForDisplay(product.reactiveStartDate ?? null);
  const end = formatDateForDisplay(product.reactiveEndDate ?? null);
  if (!start || !end) {
    return null;
  }
  return `${start} au ${end}`;
};

const normalizeType = (value: string) => value.trim().toLowerCase();

const Products = () => {
  const { products, productTypes, addProductType, createProduct, updateProduct, deleteProduct } = useApp();

  const sanitizedProductTypes = useMemo<ProductType[]>(() => {
    const seen = new Set<string>();
    const result: ProductType[] = [];

    const addType = (type: ProductType | null | undefined) => {
      if (!type) {
        return;
      }
      const trimmedType = type.trim();
      if (!trimmedType) {
        return;
      }
      const normalized = normalizeType(trimmedType);
      if (seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      result.push(trimmedType);
    };

    DEFAULT_PRODUCT_TYPES.forEach(addType);
    productTypes.forEach(addType);

    return result;
  }, [productTypes]);

  const defaultType: ProductType = sanitizedProductTypes[0] ?? DEFAULT_PRODUCT_TYPES[0];

  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(() => createEmptyFormData(defaultType));
  const [isAddingType, setIsAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.code.toLowerCase().includes(search.toLowerCase()) ||
          product.designation.toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search],
  );

  const typeOptions = useMemo(() => {
    const normalizedExisting = new Set(sanitizedProductTypes.map((type) => normalizeType(type)));
    const options = [...sanitizedProductTypes];
    const trimmedCurrent = formData.type.trim();
    if (trimmedCurrent && !normalizedExisting.has(normalizeType(trimmedCurrent))) {
      options.push(trimmedCurrent as ProductType);
    }
    return options;
  }, [sanitizedProductTypes, formData.type]);

  const displayTypeLabel = (type: ProductType) =>
    isReactiveType(type) ? "Produit reactif" : `Type : ${type}`;

  const handleTypeChange = (value: ProductType) => {
    const nextValue = value.trim() as ProductType;
    if (!nextValue) {
      return;
    }
    const reactive = isReactiveType(nextValue);
    setFormData((prev) => ({
      ...prev,
      type: nextValue,
      ...(reactive
        ? { stockA: "", stockB: "", stockC: "" }
        : { reactiveStartDate: "", reactiveEndDate: "" }),
    }));
  };

  const handleAddProductType = () => {
    setNewTypeName("");
    setIsAddingType(true);
  };

  const handleCancelAddProductType = () => {
    setIsAddingType(false);
    setNewTypeName("");
  };

  const handleConfirmAddProductType = async (
    event?: MouseEvent<HTMLButtonElement> | FormEvent<HTMLFormElement> | KeyboardEvent<HTMLInputElement>,
  ) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    // @ts-expect-error - nativeEvent exists on React events in the browser
    event?.nativeEvent?.stopImmediatePropagation?.();

    const trimmed = newTypeName.trim();
    if (!trimmed) {
      toast.error("Veuillez saisir un nom de type.");
      return;
    }

    if (sanitizedProductTypes.some((type) => normalizeType(type) === normalizeType(trimmed))) {
      toast.error("Ce type existe déjà.");
      return;
    }

    try {
      const nextTypes = await addProductType(trimmed);
      const reactive = isReactiveType(trimmed);
      if (!nextTypes.some((type) => normalizeType(type) === normalizeType(trimmed))) {
        throw new Error("Erreur lors de l'ajout du type.");
      }

      setFormData((prev) => ({
        ...prev,
        type: trimmed,
        ...(reactive
          ? { stockA: "", stockB: "", stockC: "" }
          : { reactiveStartDate: "", reactiveEndDate: "" }),
      }));

      toast.success("Nouveau type ajoute.");
      setIsAddingType(false);
      setNewTypeName("");
    } catch (error) {
      console.error(error);
      toast.error("Impossible d'ajouter le type.");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsedPrice = parseFloat(formData.price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Le prix doit etre un nombre positif.");
      return;
    }

    const normalizedType = formData.type.trim() as ProductType;
    const reactive = isReactiveType(normalizedType);

    if (reactive) {
      if (!formData.reactiveStartDate || !formData.reactiveEndDate) {
        toast.error("Veuillez renseigner la periode du produit reactif.");
        return;
      }
      if (new Date(formData.reactiveEndDate) < new Date(formData.reactiveStartDate)) {
        toast.error("La date de fin doit etre posterieure a la date de debut.");
        return;
      }
    }

    const toInt = (value: string) => {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const sharedFields = {
      code: formData.code,
      designation: formData.designation,
      type: normalizedType,
      price: parsedPrice,
      stockA: reactive ? 0 : toInt(formData.stockA),
      stockB: reactive ? 0 : toInt(formData.stockB),
      stockC: reactive ? 0 : toInt(formData.stockC),
      reactiveStartDate: reactive ? formData.reactiveStartDate : null,
      reactiveEndDate: reactive ? formData.reactiveEndDate : null,
    };

    try {
      if (editingProduct) {
        await updateProduct({
          id: editingProduct.id,
          ...sharedFields,
        });
        toast.success("Produit modifie avec succes");
      } else {
        await createProduct(sharedFields);
        toast.success("Produit ajoute avec succes");
      }
      handleClose();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du produit:", error);
      toast.error("Impossible d'enregistrer le produit.");
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);

    const normalizedType = product.type?.trim() ?? "";
    const fallbackType = sanitizedProductTypes[0] ?? DEFAULT_PRODUCT_TYPES[0];
    if (
      normalizedType &&
      !sanitizedProductTypes.some((type) => normalizeType(type) === normalizeType(normalizedType))
    ) {
      void addProductType(normalizedType as ProductType);
    }

    const reactive = isReactiveType(product.type);
    setFormData({
      type: (normalizedType || fallbackType) as ProductType,
      code: product.code,
      designation: product.designation,
      price: product.price.toString(),
      stockA: reactive ? "" : product.stockA.toString(),
      stockB: reactive ? "" : product.stockB.toString(),
      stockC: reactive ? "" : product.stockC.toString(),
      reactiveStartDate: reactive ? product.reactiveStartDate ?? "" : "",
      reactiveEndDate: reactive ? product.reactiveEndDate ?? "" : "",
    });
    setIsOpen(true);
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Etes-vous sur de vouloir supprimer ce produit ?")) {
      return;
    }
    try {
      await deleteProduct(productId);
      toast.success("Produit supprime");
    } catch (error) {
      console.error("Erreur lors de la suppression du produit:", error);
      toast.error("Impossible de supprimer le produit.");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingProduct(null);
    setFormData(createEmptyFormData(defaultType));
  };

  const getTotalStock = (product: Product) => {
    if (isReactiveType(product.type)) {
      return 0;
    }
    return product.stockA + product.stockB + product.stockC;
  };

  const formatDepotBreakdown = (product: Product) =>
    `A:${product.stockA} | B:${product.stockB} | C:${product.stockC}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des produits</h1>
        </div>
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un produit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des produits</CardTitle>
          <CardDescription>Gerez vos produits et consultez les stocks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par code ou designation..."
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
                  <TableHead>Code</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead className="text-right">Prix (DH)</TableHead>
                  <TableHead className="text-right">Stock A</TableHead>
                  <TableHead className="text-right">Stock B</TableHead>
                  <TableHead className="text-right">Stock C</TableHead>
                  <TableHead className="text-right">Stock total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Aucun produit trouve
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts
                    .sort((a, b) => a.designation.localeCompare(b.designation, "fr"))
                    .map((product) => {
                      const reactive = isReactiveType(product.type);
                      const reactivePeriod = formatReactivePeriod(product);
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.code}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span>{product.designation}</span>
                              <span className="text-xs uppercase tracking-wide text-primary/80">
                                {displayTypeLabel(product.type)}
                              </span>
                              {reactivePeriod && (
                                <span className="text-xs text-muted-foreground">
                                  Periode : {reactivePeriod}
                                </span>
                              )}
                              {!reactive && (
                                <span className="text-xs text-muted-foreground">
                                  {formatDepotBreakdown(product)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{product.price.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{reactive ? "-" : product.stockA}</TableCell>
                          <TableCell className="text-right">{reactive ? "-" : product.stockB}</TableCell>
                          <TableCell className="text-right">{reactive ? "-" : product.stockC}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {reactive ? "-" : getTotalStock(product)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleEdit(product)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => handleDelete(product.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Modifier le produit" : "Ajouter un produit"}</DialogTitle>
            <DialogDescription>Renseignez les informations du produit</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Code produit *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(event) => setFormData({ ...formData, code: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="designation">Designation *</Label>
                <Input
                  id="designation"
                  value={formData.designation}
                  onChange={(event) => setFormData({ ...formData, designation: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-type">Type de produit *</Label>
                <div className="flex gap-2">
                  <Select value={formData.type} onValueChange={(value) => handleTypeChange(value as ProductType)}>
                    <SelectTrigger id="product-type" className="w-full">
                      <SelectValue placeholder="Selectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddProductType}>
                    + Type
                  </Button>
                </div>
                {isAddingType && (
                  <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <Input
                        id="new-type-name"
                        value={newTypeName}
                        onChange={(event) => setNewTypeName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            handleConfirmAddProductType(event);
                          }
                        }}
                        placeholder="Nom du type"
                        className="md:w-auto"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={(event) => {
                            handleConfirmAddProductType(event);
                          }}
                        >
                          Valider
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={handleCancelAddProductType}>
                          Annuler
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">Prix (DH) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(event) => setFormData({ ...formData, price: event.target.value })}
                  required
                />
              </div>

              {isReactiveType(formData.type) ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="reactive-start">Date de debut *</Label>
                    <Input
                      id="reactive-start"
                      type="date"
                      value={formData.reactiveStartDate}
                      onChange={(event) =>
                        setFormData({ ...formData, reactiveStartDate: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="reactive-end">Date de fin *</Label>
                    <Input
                      id="reactive-end"
                      type="date"
                      value={formData.reactiveEndDate}
                      onChange={(event) =>
                        setFormData({ ...formData, reactiveEndDate: event.target.value })
                      }
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="stockA">Stock A</Label>
                    <Input
                      id="stockA"
                      type="number"
                      min="0"
                      value={formData.stockA}
                      onChange={(event) => setFormData({ ...formData, stockA: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="stockB">Stock B</Label>
                    <Input
                      id="stockB"
                      type="number"
                      min="0"
                      value={formData.stockB}
                      onChange={(event) => setFormData({ ...formData, stockB: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="stockC">Stock C</Label>
                    <Input
                      id="stockC"
                      type="number"
                      min="0"
                      value={formData.stockC}
                      onChange={(event) => setFormData({ ...formData, stockC: event.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button type="submit">{editingProduct ? "Modifier" : "Ajouter"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
