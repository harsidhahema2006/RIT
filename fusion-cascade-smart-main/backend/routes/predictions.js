const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const PredictionService = require('../services/PredictionService');
const logger = require('../utils/logger');

const predictionService = new PredictionService();

// GET /api/predictions/:id  (also aliased as GET /api/predict/:id)
router.get('/:id', async (req, res) => {
  try {
    const location = await Location.findOne({ id: req.params.id });
    if (!location) return res.status(404).json({ success: false, error: 'Location not found' });

    const predicted = await predictionService.predictLoad(location);

    res.json({
      success: true,
      data: {
        locationId: location.id,
        locationName: location.name,
        locationType: location.type,
        currentLoad: location.currentLoad,
        predictedLoad: predicted,
        confidence: 0.85,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    logger.error('Prediction error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/predictions/batch
router.post('/batch', async (req, res) => {
  try {
    const { locationIds } = req.body;
    if (!Array.isArray(locationIds))
      return res.status(400).json({ success: false, error: 'locationIds must be an array' });

    const locations = await Location.find({ id: { $in: locationIds } });
    const results = await Promise.all(
      locations.map(async loc => ({
        locationId: loc.id,
        currentLoad: loc.currentLoad,
        predictedLoad: await predictionService.predictLoad(loc).catch(() => loc.currentLoad)
      }))
    );

    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/predictions/system/overview
router.get('/system/overview', async (req, res) => {
  try {
    const locations = await Location.find({}).select('-loadHistory');
    const predictions = await Promise.all(
      locations.map(l => predictionService.predictLoad(l).catch(() => l.currentLoad))
    );

    const avgCurrent = locations.reduce((s, l) => s + l.currentLoad, 0) / locations.length;
    const avgPredicted = predictions.reduce((s, p) => s + p, 0) / predictions.length;

    res.json({
      success: true,
      data: {
        totalLocations: locations.length,
        currentSystemLoad: avgCurrent,
        predictedSystemLoad: avgPredicted,
        loadDelta: avgPredicted - avgCurrent,
        criticalPredictions: predictions.filter(p => p > 85).length,
        warningPredictions: predictions.filter(p => p > 65 && p <= 85).length,
        normalPredictions: predictions.filter(p => p <= 65).length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
