import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/apiRoutes.ts';
import { applySecurityHeaders } from './server/security/securityMiddleware.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();

  app.disable('x-powered-by');
  app.use(applySecurityHeaders);

  // Scoped JSON payload limits: 4 MB strictly for RL model checkpoint imports, 256 KB for all other API routes
  const modelJsonParser = express.json({ limit: '4mb' });
  const defaultJsonParser = express.json({ limit: '256kb' });
  app.use('/api/rl/model', modelJsonParser);
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/rl/model')) {
      next();
      return;
    }
    defaultJsonParser(req, res, next);
  });

  app.use('/api', apiRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Structured API error handler: never expose raw stack traces or HTML error pages
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!err) {
      next();
      return;
    }
    const e = err as { type?: string; status?: number; statusCode?: number };
    if (e.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Malformed JSON request body.' });
      return;
    }
    if (e.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request payload exceeds maximum allowed size.' });
      return;
    }
    if (req.path.startsWith('/api')) {
      const status =
        typeof e.status === 'number' && e.status >= 400 && e.status < 600 ? e.status : 500;
      res.status(status).json({
        error: status >= 500 ? 'Internal server error.' : 'Invalid request.',
      });
      return;
    }
    res.status(500).send('Internal server error.');
  });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { dotfiles: 'deny', etag: true, index: false }));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RAIRA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start RAIRA server:', err);
  process.exit(1);
});
