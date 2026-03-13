import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import { config } from './config.js';
import { closeDb } from './db/index.js';
import { definitionsRoutes } from './routes/definitions.js';
import { trustRoutes } from './routes/trust.js';
import { keyboardsRoutes } from './routes/keyboards.js';
import { statsRoutes } from './routes/stats.js';

/**
 * TheVIA Backend Server
 *
 * Community-driven VIA keyboard configurator backend.
 * Handles JSON keyboard definition storage, trust/reputation scoring,
 * and definition search/retrieval.
 */

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        config.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
          : undefined,
    },
    trustProxy: true,
  });

  // --- Plugins ---

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // API server, no HTML
  });

  // CORS
  await fastify.register(cors, {
    origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Fingerprint'],
    credentials: true,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: config.RATE_LIMIT_GENERAL,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
  });

  // Multipart file upload support
  await fastify.register(multipart, {
    limits: {
      fileSize: 1024 * 1024, // 1MB max file size
      files: 1,              // 1 file per request
      fields: 10,            // Max 10 metadata fields
    },
  });

  // --- Health check ---
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  }));

  // --- API Routes ---
  await fastify.register(
    async (api) => {
      await api.register(definitionsRoutes, { prefix: '/definitions' });
      await api.register(trustRoutes, { prefix: '/trust' });
      await api.register(keyboardsRoutes, { prefix: '/keyboards' });
      await api.register(statsRoutes, { prefix: '/stats' });
    },
    { prefix: '/api/v1' },
  );

  // --- Global error handler ---
  fastify.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      fastify.log.error(error, 'Internal server error');
    } else {
      fastify.log.warn(error, `Client error ${statusCode}`);
    }

    return reply.status(statusCode).send({
      error: error.name || 'Error',
      message:
        config.NODE_ENV === 'production' && statusCode >= 500
          ? 'Internal server error'
          : error.message,
      statusCode,
    });
  });

  // --- Not found handler ---
  fastify.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: 'Not Found',
      message: 'The requested resource was not found',
      statusCode: 404,
    });
  });

  return fastify;
}

async function start() {
  const fastify = await buildServer();

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      fastify.log.info(`Received ${signal}, shutting down...`);
      await fastify.close();
      await closeDb();
      process.exit(0);
    });
  }

  try {
    await fastify.listen({
      port: config.PORT,
      host: config.HOST,
    });

    fastify.log.info(`TheVIA server running at http://${config.HOST}:${config.PORT}`);
    fastify.log.info(`Environment: ${config.NODE_ENV}`);
    fastify.log.info(`Storage: ${config.STORAGE_TYPE}`);
  } catch (err) {
    fastify.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

start();
