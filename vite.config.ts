import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // host:true binds IPv4 + IPv6; without it Vite listened on [::1] only and
  // http://127.0.0.1:5173 refused the connection.
  server: { host: true, port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
