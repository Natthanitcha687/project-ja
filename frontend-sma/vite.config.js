import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwind()],
  server: { port: 5173 },

  // ✅ แก้ Lighthouse: Missing source maps for large first-party JavaScript
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // ✅ ลดการ “เปิดเผยซอร์ส” ในไฟล์ .map (ยังมี map ให้ debug/ให้ Lighthouse ผ่าน)
        sourcemapExcludeSources: true,
      },
    },
  },
});
