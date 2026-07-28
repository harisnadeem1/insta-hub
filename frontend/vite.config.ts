import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      customViteReactPlugin: true,
      server: {
        entry: "./src/server.ts",
        preset: "node-server",
      },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
});