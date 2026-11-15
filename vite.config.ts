import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Dev only, and only when started with CT_DEV_TOKEN=1: lets the page on this Mac connect to HA
// with the token in ~/.config/homeassistant/token, so the live rooms can be tested without
// signing in. Answers only requests from this Mac itself. Never part of a build.
function devToken(): Plugin {
  return {
    name: 'ct-dev-token',
    apply: 'serve',
    configureServer(server) {
      if (process.env.CT_DEV_TOKEN !== '1') return;
      server.middlewares.use('/__dev-token', (req, res) => {
        const ip = req.socket.remoteAddress ?? '';

        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) {
          res.statusCode = 403;
          res.end();

          return;
        }

        res.setHeader('Cache-Control', 'no-store');
        res.end(readFileSync(join(homedir(), '.config/homeassistant/token'), 'utf8').trim());
      });
    },
  };
}

export default defineConfig({
  // Relative asset paths, so the built app also works when bundled inside the Android TV app.
  base: './',
  plugins: [devToken()],
  server: {
    port: 5173,
    host: true,
    strictPort: true,
  },
});
