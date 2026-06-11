import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Two routes, two HTML entries:
//   /     -> index.html      (sales page)
//   /app/ -> app/index.html  (the product)
// Vercel/Netlify serve dist/ as-is with zero extra config.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: here("index.html"),
        app: here("app/index.html"),
      },
    },
  },
});
