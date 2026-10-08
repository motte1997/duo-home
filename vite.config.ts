import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' => funktioniert auf Cloudflare Pages (Root) und GitHub Pages (Unterpfad)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
});
