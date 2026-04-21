const express = require('express');
const router = express.Router();
const OptimizationService = require('../services/OptimizationService');
const Location = require('../models/Location');
const logger = require('../utils/logger');

const optimizationService = new OptimizationService();

// GET /api/optimization - Get optimized power distribution
router.get('/', async (req, res) => {
  try {
    const locations = await Location.find({}).lean();
    
    if (locations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No locations found'
      });
    }
    
    const optimization = await optimizationService.optimizeDistribution(locations);
    
    res.json({
      success: true,
      data: optimization,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting optimization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get optimization',
      message: error.message
    });
  }
});

// POST /api/optimization/custom - Run optimization with custom parameters
router.post('/custom', async (req, res) => {
  try {
    const { 
      locationIds, 
      objectives = ['minimize_loss', 'balance_load', 'maximize_efficiency'],
      constraints = {},
      algorithm = 'greedy'
    } = req.body;
    
    let locations;
    if (locationIds && Array.isArray(locationIds)) {
      locations = await Location.find({ id: { $in: locationIds } }).lean();
    } else {
      locations = await Location.find({}).lean();
    }
    
    if (locations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No locations found'
      });
    }
    
    const optimization = await optimizationService.optimizeWithParameters(
      locations, 
      objectives, 
      constraints, 
      algorithm
    );
    
    res.json({
      success: true,
      data: optimization,
      parameters: {
        objectives,
        constraints,
        algorithm,
        locationCount: locations.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error running custom optimization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run custom optimization',
      message: error.message
    });
  }
});

// GET /api/optimization/efficiency - Get system efficiency analysis
router.get('/efficiency', async (req, res) => {
  try {
    const locations = await Location.find({}).lean();
    const efficiency = await optimizationService.calculateSystemEfficiency(locations);
    
    res.json({
      success: true,
      data: efficiency,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error calculating efficiency:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate efficiency',
      message: error.message
    });
  }
});

// GET /api/optimization/load-balance - Get load balancing recommendations
router.get('/load-balance', async (req, res) => {
  try {
    const locations = await Location.find({}).lean();
    const balancing = await optimizationService.optimizeLoadBalance(locations);
    
    res.json({
      success: true,
      data: balancing,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error optimizing load balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize load balance',
      message: error.message
    });
  }
});

// POST /api/optimization/scenario - Run optimization scenario analysis
router.post('/scenario', async (req, res) => {
  try {
    const { scenarios } = req.body;
    
    if (!Array.isArray(scenarios)) {
      return res.status(400).json({
        success: false,
        error: 'Scenarios must be an array'
      });
    }
    
    const results = [];
    
    for (const scenario of scenarios) {
      try {
        const result = await optimizationService.analyzeScenario(scenario);
        results.push({
          scenario: scenario.name || 'Unnamed',
          success: true,
          data: result
        });
      } catch (error) {
        results.push({
          scenario: scenario.name || 'Unnamed',
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error analyzing scenarios:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze scenarios',
      message: error.message
    });
  }
});

// GET /api/optimization/recommendations - Get optimization recommendations
router.get('/recommendations', async (req, res) => {
  try {
    const { priority = 'all', limit = 10 } = req.query;
    
    const locations = await Location.find({}).lean();
    const recommendations = await optimizationService.getRecommendations(
      locations, 
      priority, 
      parseInt(limit)
    );
    
    res.json({
      success: true,
      data: recommendations,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations',
      message: error.message
    });
  }
});

// POST /api/optimization/apply - Apply optimization recommendations
router.post('/apply', async (req, res) => {
  try {
    const { recommendations, dryRun = true } = req.body;
    
    if (!Array.isArray(recommendations)) {
      return res.status(400).json({
        success: false,
        error: 'Recommendations must be an array'
      });
    }
    
    const results = [];
    
    for (const recommendation of recommendations) {
      try {
        if (!dryRun) {
          // Apply the recommendation
          const location = await Location.findOne({ id: recommendation.locationId });
          if (location) {
            location.updateLoad(recommendation.recommendedLoad);
            await location.save();
          }
        }
        
        results.push({
          locationId: recommendation.locationId,
          applied: !dryRun,
          success: true,
          previousLoad: recommendation.currentLoad,
          newLoad: recommendation.recommendedLoad
        });
      } catch (error) {
        results.push({
          locationId: recommendation.locationId,
          applied: false,
          success: false,
          error: error.message
        });
      }
    }
    
    // Emit real-time updates if changes were applied
    if (!dryRun) {
      const io = req.app.get('io');
      if (io) {
        io.emit('optimizationApplied', {
          results,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        results,
        dryRun,
        appliedCount: results.filter(r => r.applied).length,
        totalCount: results.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error applying optimization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply optimization',
      message: error.message
    });
  }
});

module.exports = router;