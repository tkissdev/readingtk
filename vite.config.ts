import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: { preset: "vercel" },
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/scheduler/")) {
              return "vendor-react";
            }
            if (id.includes("node_modules/@tanstack/")) {
              return "vendor-tanstack";
            }
            if (id.includes("node_modules/@supabase/")) {
              return "vendor-supabase";
            }
            if (id.includes("node_modules/@radix-ui/") || id.includes("node_modules/lucide-react/") || id.includes("node_modules/sonner/") || id.includes("node_modules/class-variance-authority/") || id.includes("node_modules/clsx/") || id.includes("node_modules/tailwind-merge/")) {
              return "vendor-ui";
            }
            if (id.includes("node_modules/")) {
              return "vendor-misc";
            }
          },
        },
      },
    },
  },
});
