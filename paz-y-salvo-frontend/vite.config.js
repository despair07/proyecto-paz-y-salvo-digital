import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // La carpeta del proyecto está en OneDrive, que bloquea archivos temporales de Vite en Windows
  // y puede tumbar el servidor: la caché de dependencias vive en la carpeta temporal del sistema.
  cacheDir: path.join(os.tmpdir(), 'vite-paz-y-salvo'),
  server: {
    port: 5173,
    // Si el puerto está ocupado, falla en vez de moverse (el CORS del backend espera el 5173)
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
