import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages serves a project site from /<repo>/, so built asset URLs need
// that prefix. Dev stays at / so `npm run dev` keeps working normally.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/npchat/" : "/",
  plugins: [react(), tailwindcss()],
}));
