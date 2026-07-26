import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Läuft mehr als ein Dev-Server (z. B. paralleles Preview-Tooling), darf der
  // Port von außen per PORT vorgegeben werden; sonst Vites Standard 5173.
  server: { port: Number(process.env.PORT) || 5173 },
})
