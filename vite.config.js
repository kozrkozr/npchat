import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages serves a project site from /<repo>/, so built asset URLs need
// that prefix. Hosts that serve from a domain root (Cloudflare Pages, Netlify,
// Vercel, Surge) need "/" instead — build them with BASE_PATH=/ .
// Dev always stays at / so `npm run dev` works unchanged.
export default defineConfig(({ command }) => ({
  base: command === "build" ? (process.env.BASE_PATH ?? "/npchat/") : "/",
  plugins: [react(), tailwindcss()],
}));
