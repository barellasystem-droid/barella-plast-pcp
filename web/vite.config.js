import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development (npm run dev inside /web) requests to /api are
// proxied to the Express server so you don't hit CORS issues locally.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
