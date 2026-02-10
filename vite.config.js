import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function diagramBridgePlugin() {
  const diagramPath = path.resolve('public', 'diagram_state.json');
  const empty = JSON.stringify({ tables: [], relationships: [] }, null, 2) + '\n';

  return {
    name: 'diagram-bridge',
    configureServer(server) {
      server.middlewares.use('/api/bridge/clear', (req, res) => {
        if (req.method === 'POST') {
          fs.writeFileSync(diagramPath, empty);
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('ok');
        } else {
          res.writeHead(405);
          res.end();
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), diagramBridgePlugin()],
})
