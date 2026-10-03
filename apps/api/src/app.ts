import express, { type Express } from 'express';
import { privateRoutes } from './routes/private.routes';
import { publicRoutes } from './routes/public.routes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use('/api/public', publicRoutes);
  app.use('/api', privateRoutes);

  return app;
}
