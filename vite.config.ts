import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vitest/config';

// Modo "movil": sirve por HTTPS (certificado autofirmado) en la red local,
// porque los navegadores móviles solo dan acceso a la cámara en orígenes seguros.
// Modo "tunel": HTTP local pensado para exponerse con un túnel HTTPS gratuito (plan B, ver docs/10).
export default defineConfig(({ mode }) => {
  const movil = mode === 'movil';
  const tunel = mode === 'tunel';
  return {
    base: './',
    plugins: movil ? [basicSsl()] : [],
    // Puertos propios (no el 5173 por defecto de Vite) para no chocar con otros proyectos abiertos.
    server: {
      host: movil ? true : 'localhost',
      port: movil ? 8443 : 5190,
      allowedHosts: tunel ? ['.trycloudflare.com'] : [],
    },
    preview: { host: movil ? true : 'localhost', port: movil ? 8444 : 4190 },
    build: { target: 'es2022', chunkSizeWarningLimit: 900 },
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
