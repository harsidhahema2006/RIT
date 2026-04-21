const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const logger = require('../utils/logger');

// GET /api/locations
router.get('/', async (req, res) => {
  try {
    const { type, status, sortBy = 'severityScore', order = 'desc' } = req.query;
    const query = {};
    if (type)   query.type   = type;
    if (status) query.status = status;

    const locations = await Location.find(query)
      .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
      .select('-loadHistory')
      .lean();

    res.json({ success: true, count: locations.length, data: locations, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('GET /locations error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/locations/critical
router.get('/critical', async (req, res) => {
  try {
    const loc = await Location.findMostCritical();
    if (!loc) return res.status(404).json({ success: false, error: 'No locations found' });
    res.json({ success: true, data: loc, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/locations/stats
router.get('/stats', async (req, res) => {
  try {
    const [stats, total, avgArr] = await Promise.all([
      Location.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, avgLoad: { $avg: '$currentLoad' } } }]),
      Location.countDocuments(),
      Location.aggregate([{ $group: { _id: null, avg: { $avg: '$currentLoad' } } }])
    ]);
    res.json({
      success: true,
      data: {
        totalLocations: total,
        averageSystemLoad: avgArr[0]?.avg || 0,
        statusDistribution: stats.reduce((a, s) => { a[s._id] = { count: s.count, avgLoad: s.avgLoad }; return a; }, {})
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/locations/update-load  (also aliased at /api/update-load)
router.post('/update-load', async (req, res) => {
  try {
    const { locationId, currentLoad, predictedLoad } = req.body;
    if (!locationId || currentLoad === undefined)
      return res.status(400).json({ success: false, error: 'locationId and currentLoad required' });

    const location = await Location.findOne({ id: locationId });
    if (!location) return res.status(404).json({ success: false, error: 'Location not found' });

    location.updateLoad(currentLoad, predictedLoad);
    await location.save();

    // Real-time emit
    const io = req.app.get('io');
    if (io) {
      io.emit('loadUpdate', {
        locationId: location.id, currentLoad: location.currentLoad,
        predictedLoad: location.predictedLoad, status: location.status,
        severityScore: location.severityScore, timestamp: location.lastUpdated
      });
      if (location.status === 'critical') {
        io.emit('criticalUpdate', { locationId: location.id, name: location.name, severityScore: location.severityScore });
      }
    }

    res.json({
      success: true,
      data: {
        id: location.id, currentLoad: location.currentLoad,
        predictedLoad: location.predictedLoad, status: location.status,
        severityScore: location.severityScore, lastUpdated: location.lastUpdated
      }
    });
  } catch (err) {
    logger.error('update-load error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/locations/:id
router.get('/:id', async (req, res) => {
  try {
    const location = await Location.findOne({ id: req.params.id }).select('-loadHistory').lean();
    if (!location) return res.status(404).json({ success: false, error: 'Location not found' });
    res.json({ success: true, data: location, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/locations/:id/history
router.get('/:id/history', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const location = await Location.findOne({ id: req.params.id }).select('id name loadHistory').lean();
    if (!location) return res.status(404).json({ success: false, error: 'Location not found' });
    const history = (location.loadHistory || []).slice(-parseInt(limit));
    res.json({ success: true, data: { locationId: location.id, history, count: history.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
