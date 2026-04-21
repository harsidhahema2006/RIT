const express = require('express');
const router = express.Router();
const ReinforcementLearningService = require('../services/ReinforcementLearningService');
const Location = require('../models/Location');
const logger = require('../utils/logger');

const rlService = new ReinforcementLearningService();

// GET /api/rl/action - Get RL-based optimal power distribution decision
router.get('/action', async (req, res) => {
  try {
    // Get current system state
    const locations = await Location.find({}).select('-loadHistory').lean();
    
    if (locations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No locations found'
      });
    }
    
    // Build system state for RL
    const systemState = {
      locations: locations.map(l => ({
        id: l.id,
        type: l.type,
        currentLoad: l.currentLoad,
        predictedLoad: l.predictedLoad,
        capacity: l.capacity,
        status: l.status,
        severityScore: l.severityScore
      })),
      systemLoad: locations.reduce((sum, l) => sum + l.currentLoad, 0) / locations.length,
      bessCapacity: locations.filter(l => l.type === 'bess').reduce((sum, l) => sum + l.capacity, 0),
      criticalCount: locations.filter(l => l.status === 'critical').length,
      timestamp: new Date().toISOString()
    };
    
    // Get optimal action from RL service
    const action = await rlService.getOptimalAction(systemState);
    
    res.json({
      success: true,
      data: action,
      systemState: {
        totalLocations: locations.length,
        averageLoad: systemState.systemLoad,
        criticalCount: systemState.criticalCount,
        bessCapacity: systemState.bessCapacity
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting RL action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get RL action',
      message: error.message
    });
  }
});

// POST /api/rl/feedback - Provide feedback for RL training
router.post('/feedback', async (req, res) => {
  try {
    const { 
      previousState, 
      action, 
      currentState, 
      reward,
      metadata 
    } = req.body;
    
    if (!previousState || !action || !currentState) {
      return res.status(400).json({
        success: false,
        error: 'Missing required feedback data'
      });
    }
    
    // Store feedback for RL training
    const feedback = {
      previousState,
      action,
      currentState,
      reward: reward || 0,
      timestamp: new Date().toISOString(),
      metadata: metadata || {}
    };
    
    // Send feedback to RL service for learning
    await rlService.processFeedback(feedback);
    
    res.json({
      success: true,
      message: 'Feedback processed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error processing RL feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process feedback',
      message: error.message
    });
  }
});

// POST /api/rl/train - Trigger RL model training
router.post('/train', async (req, res) => {
  try {
    const { trainingData, episodes = 1 } = req.body;
    
    // Collect training data if not provided
    let data = trainingData;
    if (!data) {
      data = await collectTrainingData();
    }
    
    // Train the RL model
    const trainingResult = await rlService.trainModel(data, episodes);
    
    res.json({
      success: true,
      data: trainingResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error training RL model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to train RL model',
      message: error.message
    });
  }
});

// GET /api/rl/stats - Get RL training statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await rlService.getTrainingStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting RL stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get RL stats',
      message: error.message
    });
  }
});

// POST /api/rl/simulate - Simulate RL decision making
router.post('/simulate', async (req, res) => {
  try {
    const { scenarios, steps = 10 } = req.body;
    
    if (!Array.isArray(scenarios)) {
      return res.status(400).json({
        success: false,
        error: 'Scenarios must be an array'
      });
    }
    
    const results = [];
    
    for (const scenario of scenarios) {
      try {
        const simulation = await rlService.simulateScenario(scenario, steps);
        results.push({
          scenario: scenario.name || 'Unnamed',
          success: true,
          data: simulation
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
    logger.error('Error simulating RL scenarios:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate scenarios',
      message: error.message
    });
  }
});

// GET /api/rl/policy - Get current RL policy information
router.get('/policy', async (req, res) => {
  try {
    const policy = await rlService.getPolicyInfo();
    
    res.json({
      success: true,
      data: policy,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting RL policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get RL policy',
      message: error.message
    });
  }
});

// Helper function to collect training data
async function collectTrainingData() {
  try {
    // Get historical data for training
    const locations = await Location.find({})
      .select('id type currentLoad predictedLoad status loadHistory')
      .lean();
    
    const states = [];
    const actions = [];
    const rewards = [];
    const nextStates = [];
    
    // Process historical data to create training examples
    for (const location of locations) {
      if (location.loadHistory && location.loadHistory.length > 1) {
        for (let i = 0; i < location.loadHistory.length - 1; i++) {
          const current = location.loadHistory[i];
          const next = location.loadHistory[i + 1];
          
          // Create state representation
          const state = [
            current.load / 100,
            location.type === 'bess' ? 1 : 0,
            location.type === 'substation' ? 1 : 0,
            location.type === 'factory' ? 1 : 0,
            location.type === 'industry' ? 1 : 0,
            location.type === 'house' ? 1 : 0
          ];
          
          const nextState = [
            next.load / 100,
            location.type === 'bess' ? 1 : 0,
            location.type === 'substation' ? 1 : 0,
            location.type === 'factory' ? 1 : 0,
            location.type === 'industry' ? 1 : 0,
            location.type === 'house' ? 1 : 0
          ];
          
          // Simple action (load change)
          const action = Math.round((next.load - current.load) / 10) + 5; // Discretize to 0-10
          
          // Simple reward (negative for high loads)
          const reward = next.load > 85 ? -10 : (next.load < 65 ? 5 : 0);
          
          states.push(state);
          actions.push(action);
          rewards.push(reward);
          nextStates.push(nextState);
        }
      }
    }
    
    return {
      states: states.slice(-1000), // Last 1000 examples
      actions: actions.slice(-1000),
      rewards: rewards.slice(-1000),
      nextStates: nextStates.slice(-1000)
    };
  } catch (error) {
    logger.error('Error collecting training data:', error);
    return {
      states: [],
      actions: [],
      rewards: [],
      nextStates: []
    };
  }
}

module.exports = router;