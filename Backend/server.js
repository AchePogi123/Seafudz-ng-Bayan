import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import menuRoutes from './src/routes/menuRoutes.js';
import orderRoutes from './src/routes/orderRoutes.js';
import kitchenRoutes from './src/routes/kitchenRoutes.js';
import riderRoutes from './src/routes/riderRoutes.js';
import assistantRoutes from './src/routes/assistantRoutes.js';
import salesRoutes from './src/routes/salesRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import userFlowRoutes from './src/routes/userFlowRoutes.js';
import tableRoutes from './src/routes/tableRoutes.js';
import { runMigrations } from './src/migrations/migrate.js';
import { apiLimiter, authLimiter, orderLimiter } from './src/middleware/rateLimiter.js';

dotenv.config();

const app = express();
// Default to 8080 for GCP Cloud Run or fallback to 5000/process.env
const PORT = parseInt(process.env.PORT || '8080', 10);

// Disable X-Powered-By fingerprinting header
app.disable('x-powered-by');

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Strict CORS Configuration with Allowed Origins Whitelist
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'https://seafudz-ng-bayan.web.app',
  'https://seafudz-ng-bayan.firebaseapp.com',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()) : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Cloud Run health probes)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Access blocked by CORS policy: Origin '${origin}' is not authorized.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting Middlewares
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/orders', orderLimiter);
app.use('/api/user-flow/orders', orderLimiter);

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Root health probe for GCP Cloud Run startup checks
app.get('/', (req, res) => {
  res.status(200).send('Seafudz ng Bayan Backend API Server Running');
});

// Detailed API health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Seafudz ng Bayan Full API Backend',
    uptime: process.uptime(),
    features: [
      'Menu Items Catalog',
      'POS & Orders Management',
      'Kitchen Display System',
      'Rider Delivery Service',
      'Assistant Floor Calls',
      'Sales Reports & Analytics',
      'User Authentication'
    ]
  });
});

// Mount All REST API Feature Routes
app.use('/api', menuRoutes);
app.use('/api', orderRoutes);
app.use('/api', kitchenRoutes);
app.use('/api', riderRoutes);
app.use('/api', assistantRoutes);
app.use('/api', salesRoutes);
app.use('/api', authRoutes);
app.use('/api', tableRoutes);
app.use('/api', userFlowRoutes);

// Fallback route for unknown requests
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route '${req.originalUrl}' not found. Check GET /api/health for available endpoints.`,
  });
});

// Start Express Server immediately on 0.0.0.0 to satisfy Cloud Run health probes instantly
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`[SERVER] Seafudz ng Bayan Backend API Server Live`);
  console.log(`[SERVER] Bound Address: http://0.0.0.0:${PORT}`);
  console.log(`=================================================`);

  // Defer database migration out-of-band so boot is never blocked
  setImmediate(() => {
    runMigrations().catch((mErr) => {
      console.warn('[WARN] Auto-migration startup note:', mErr.message);
    });
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[ERROR] Port ${PORT} is already in use by another process.`);
  } else {
    console.error('[ERROR] Server runtime error:', err);
  }
  process.exit(1);
});

export default app;
