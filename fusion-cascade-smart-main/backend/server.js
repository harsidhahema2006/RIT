require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// ── Routes ──────────────────────────────────────────────────────────────────
const locationRoutes      = require('./routes/locations');
const predictionRoutes    = require('./routes/predictions');
const optimizationRoutes  = require('./routes/optimization');
const rlRoutes            = require('./routes/reinforcementLearning');
const routeRoutes         = require('./routes/routes');
const decisionRoutes      = require('./routes/decisions');

// ── Services ─────────────────────────────────────────────────────────────────
const SocketService    = require('./services/SocketService');
const SimulationEngine = require('./services/SimulationEngine');

// ── App setup ────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST']
  }
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: parseInt(process.env.API_RATE_LIMIT) || 200 }));

// ── DB ────────────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => logger.info('MongoDB connected'))
  .catch(err => { logger.error('MongoDB error:', err.message); process.exit(1); });

// ── Socket + shared state ─────────────────────────────────────────────────────
const socketService = new SocketService(io);
app.set('io', io);
app.set('socketService', socketService);

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/locations',    locationRoutes);
app.use('/api/predictions',  predictionRoutes);
app.use('/api/optimization', optimizationRoutes);
app.use('/api/rl',           rlRoutes);
app.use('/api/routes',       routeRoutes);
app.use('/api/decisions',    decisionRoutes);

// ── Spec-required shorthand aliases ──────────────────────────────────────────
// POST /api/update-load  → same as POST /api/locations/update-load
app.post('/api/update-load', (req, res, next) => {
  req.url = '/update-load';
  locationRoutes(req, res, next);
});
// GET /api/predict/:id   → GET /api/predictions/:id
app.get('/api/predict/:id', (req, res) =>
  res.redirect(307, `/api/predictions/${req.params.id}`)
);
// GET /api/optimize      → GET /api/optimization
app.get('/api/optimize', (req, res) =>
  res.redirect(307, '/api/optimization')
);
// GET /api/decision/:id  → GET /api/decisions/:id
app.get('/api/decision/:id', (req, res) =>
  res.redirect(307, `/api/decisions/${req.params.id}`)
);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);
app.use('*', (req, res) =>
  res.status(404).json({ error: 'Route not found', path: req.originalUrl })
);

// ── Simulation engine ─────────────────────────────────────────────────────────
const simulationEngine = new SimulationEngine(socketService);

// ── Socket events ─────────────────────────────────────────────────────────────
io.on('connection', socket => {
  logger.info(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => logger.info(`Client disconnected: ${socket.id}`));
  socket.on('requestLocationUpdate', async locationId => {
    try {
      const Location = require('./models/Location');
      const loc = await Location.findOne({ id: locationId }).select('-loadHistory');
      if (loc) socket.emit('locationUpdate', loc);
    } catch (e) { logger.error('Socket location request error:', e.message); }
  });
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = () => {
  logger.info('Shutting down...');
  simulationEngine.stop();
  server.close(() => { mongoose.connection.close(); process.exit(0); });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Smart Power Backend running on port ${PORT}`);
  simulationEngine.start();
});

module.exports = { app, server, io };
