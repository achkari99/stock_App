# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/334c4688-776a-42b9-af67-9f266c5bf7b0

## Nouveautes

- Le tableau de bord affiche maintenant des statistiques detaillees pour le depot selectionne (stock disponible, valeur estimee, ventes rattachees).
- La page Nouvelle vente permet de repartir chaque article sur les depots A, B et C tout en respectant les stocks disponibles.

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/334c4688-776a-42b9-af67-9f266c5bf7b0) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

### Run it as a desktop app (Electron)

Make sure dependencies are installed and then:

```sh
# Start Vite and Electron together
npm run electron:dev

# Create production desktop bundles for Windows, macOS, and Linux
npm run electron:build
```

The build output is generated inside `dist/` (Vite assets) and the Electron distributables inside `dist/` plus platform-specific folders created by `electron-builder`. Add platform icons under `resources/` before packaging to brand the installers.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/334c4688-776a-42b9-af67-9f266c5bf7b0) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
