# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/07653dc2-3dd5-496d-82dc-b32e21109b45

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/07653dc2-3dd5-496d-82dc-b32e21109b45) and start prompting.

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

Simply open [Lovable](https://lovable.dev/projects/07653dc2-3dd5-496d-82dc-b32e21109b45) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes it is!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## OG Card Creator Usage Guide

### Image Requirements

The OG Card Creator works with three image components:

1. **Inner Image (suggested dimensions: 1200×800px)**
   - This is the main content of your preview card
   - Formats supported: PNG, JPG, WebP
   - Transparent backgrounds work best

2. **Outer Image (suggested dimensions: 880×480px)**
   - This forms the frame or background
   - Formats supported: PNG, JPG, WebP
   - PNG with transparency is recommended

3. **Overlay Image (suggested dimensions: 600×800px)**
   - This is placed on top of the other images
   - Formats supported: PNG, JPG, WebP
   - PNGs with transparency work best for overlays

### How to Upload Images

1. Paste a publicly accessible image URL in each field
2. The app will automatically convert these to base64 for GitHub storage
3. All images will be uploaded to your GitHub repository
4. The images will be available through jsDelivr CDN for your ENS/Yodl previews

### Troubleshooting GitHub Uploads

If you encounter issues with GitHub uploads:
- Make sure your GitHub token has the 'repo' scope
- Verify the repository exists and you have write permissions
- Check that image URLs are publicly accessible
- Images must be under 10MB for optimal processing

### Example Preview Configuration

Add this to your ENS records to enable preview cards:
```json
{
  "og": {
    "baseUrl": "https://cdn.jsdelivr.net/gh/yourusername/yourrepo/og/custom-folder"
  }
}
```
