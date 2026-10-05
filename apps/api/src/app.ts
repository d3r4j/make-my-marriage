import express, { type Express } from 'express';
import { privateRoutes } from './routes/private.routes';
import { publicRoutes } from './routes/public.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { weddingRoutes } from './modules/weddings/wedding.routes';

export function createApp(): Express {
  const app = express();
  const webOrigin = process.env['WEB_ORIGIN'] ?? 'http://localhost:4200';

  app.disable('x-powered-by');
  app.use((request, response, next) => {
    response.setHeader('Access-Control-Allow-Origin', webOrigin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.vary('Origin');
    if (request.method === 'OPTIONS') { response.sendStatus(204); return; }
    next();
  });
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use('/api/public', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/weddings', weddingRoutes);
  app.use('/api', privateRoutes);

  return app;
}
