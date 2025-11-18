# Guide d'utilisation – Stock Zen Maroc

## 1. Présentation

Stock Zen Maroc est une application de gestion de stock et de facturation adaptée aux entreprises marocaines disposant de plusieurs dépôts. L'application permet de gérer les produits, clients, ventes et factures depuis une interface moderne et simplifiée.

## 2. Installation de l'application

1. Lancez le fichier `Stock-Zen-Maroc-1.0.0-Setup.exe`.
2. Suivez l'assistant d'installation (Next → Install → Finish).
3. Une fois l'installation terminée, un raccourci **Stock Zen Maroc** est créé dans le menu Démarrer. Vous pouvez l'épingler à la barre des tâches.

> **Note** : les données de l'application sont enregistrées automatiquement dans un fichier `stock-data.json` situé dans `%APPDATA%\Stock Zen Maroc`. Réinstaller ou mettre à jour l'application ne supprime pas vos données.

## 3. Première ouverture

1. Ouvrez **Stock Zen Maroc** via le menu Démarrer.
2. L'écran d'accueil affiche un tableau de bord avec des statistiques de stock et de ventes.
3. La barre latérale gauche donne accès aux différentes rubriques : Dépôts, Produits, Clients, Nouvelle vente, Historique, Paramètres.

## 4. Gestion des produits

### Ajouter un produit
1. Cliquez sur **Produits** dans la barre latérale.
2. Appuyez sur **Ajouter un produit**.
3. Choisissez le **type** :
   - **Produit physique** : gérer les quantités par dépôt.
   - **Produit réactif** : prestations sans stock avec période de validité.
4. Renseignez le code, la désignation, le prix HT et les champs spécifiques (stocks ou période).
5. Cliquez sur **Ajouter** pour enregistrer.

### Modifier ou supprimer
- Bouton crayon (✏️) : ouvre la fiche pour modifier puis « Modifier ».
- Bouton corbeille (🗑️) : supprime le produit après confirmation.

## 5. Gestion des clients

1. Accédez à **Clients**.
2. Cliquez sur **Ajouter un client** et renseignez les informations (raison sociale, ICE, adresse, téléphone, e-mail).
3. Validez avec **Enregistrer**.

## 6. Réaliser une vente / facture

1. Cliquez sur **Nouvelle vente**.
2. Sélectionnez le client dans la partie droite.
3. Choisissez un produit :
   - Pour un **produit physique**, indiquez la répartition des quantités par dépôt.
   - Pour un **produit réactif**, la quantité est fixée à 1 et aucune répartition n'est demandée.
4. Ajoutez l'article (bouton « + »). Répétez pour chaque produit.
5. Le récapitulatif affiche Total HT, TVA (20 %) et Total TTC.
6. Cliquez sur **Valider la vente** pour enregistrer. La facture est générée automatiquement.

## 7. Impression / export de facture

1. Ouvrez **Historique**.
2. Recherchez la vente via le numéro de facture ou le nom du client.
3. Bouton imprimante (🖨️) : ouvre la facture dans une nouvelle fenêtre prêt à être imprimée ou sauvegardée en PDF.
4. Bouton œil (📄) : affiche le détail de la vente sans impression.

## 8. Suppression d'une vente

- Dans l'historique, cliquez sur la corbeille (🗑️) pour supprimer une vente. La confirmation est obligatoire.

## 9. Gestion des données (sauvegarde / restauration)

L'application sauvegarde automatiquement chaque modification dans `stock-data.json`. Pour transférer vos données :

1. Copiez le fichier `%APPDATA%\Stock Zen Maroc\stock-data.json` vers un support externe.
2. Pour restaurer sur un autre poste, remplacez le fichier `stock-data.json` existant après avoir installé l'application.

## 10. Paramètres

- Accédez à **Paramètres** pour ajuster les préférences (thème, notifications, etc.).

## 11. Mise à jour de l'application

1. Téléchargez la nouvelle version du fichier `Stock-Zen-Maroc-<version>-Setup.exe`.
2. Exécutez l'installateur : il mettra à jour l'application **sans supprimer vos données**.

## 12. Support

- Pour toute question ou anomalie, notez les étapes réalisées et capturez les messages d'erreur (Console → `Ctrl+Shift+I`).
- Communiquez ces informations à l'équipe de support de Stock Zen Maroc.

Bon usage !

