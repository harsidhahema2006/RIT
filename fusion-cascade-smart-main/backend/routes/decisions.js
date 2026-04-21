const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const logger = require('../utils/logger');

// GET /api/decisions/:id - Get AI decision message for specific location
router.get('/:id', async (req, res) => {
  try {
    const location = await Location.findOne({ id: req.params.id });
    
    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }
    
    const decision = generateAIDecision(location);
    
    res.json({
      success: true,
      data: decision,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating AI decision:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI decision',
      message: error.message
    });
  }
});

// GET /api/decisions/system/feed - Get system-wide AI decision feed
router.get('/system/feed', async (req, res) => {
  try {
    const { limit = 10, severity = 'all' } = req.query;
    
    const locations = await Location.find({}).lean();
    const decisions = [];
    
    // Generate decisions for all locations
    for (const location of locations) {
      const decision = generateAIDecision(location);
      
      // Filter by severity if specified
      if (severity === 'all' || decision.severity === severity) {
        decisions.push(decision);
      }
    }
    
    // Sort by priority and timestamp
    decisions.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    // Limit results
    const limitedDecisions = decisions.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: limitedDecisions,
      totalCount: decisions.length,
      filteredCount: limitedDecisions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting AI decision feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI decision feed',
      message: error.message
    });
  }
});

// POST /api/decisions/batch - Generate decisions for multiple locations
router.post('/batch', async (req, res) => {
  try {
    const { locationIds } = req.body;
    
    if (!Array.isArray(locationIds)) {
      return res.status(400).json({
        success: false,
        error: 'locationIds must be an array'
      });
    }
    
    const locations = await Location.find({ id: { $in: locationIds } }).lean();
    const decisions = locations.map(location => generateAIDecision(location));
    
    res.json({
      success: true,
      data: decisions,
      count: decisions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating batch decisions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate batch decisions',
      message: error.message
    });
  }
});

// GET /api/decisions/recommendations/smart - Get smart recommendations based on system state
router.get('/recommendations/smart', async (req, res) => {
  try {
    const locations = await Location.find({}).lean();
    const systemRecommendations = generateSystemRecommendations(locations);
    
    res.json({
      success: true,
      data: systemRecommendations,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating smart recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate smart recommendations',
      message: error.message
    });
  }
});

// POST /api/decisions/simulate - Simulate AI decision making for scenarios
router.post('/simulate', async (req, res) => {
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
        const decisions = simulateScenarioDecisions(scenario);
        results.push({
          scenario: scenario.name || 'Unnamed',
          success: true,
          decisions
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
    logger.error('Error simulating decisions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate decisions',
      message: error.message
    });
  }
});

// Helper functions

function generateAIDecision(location) {
  const now = new Date();
  const hour = now.getHours();
  const currentLoad = location.currentLoad || 0;
  const predictedLoad = location.predictedLoad || currentLoad;
  const status = location.status || 'normal';
  const type = location.type || 'house';
  
  let message = '';
  let action = '';
  let severity = 'info';
  let priority = 1;
  let confidence = 0.8;
  
  // Generate context-aware decisions based on location status and type
  if (status === 'critical') {
    severity = 'critical';
    priority = 3;
    confidence = 0.95;
    
    if (type === 'bess') {
      message = `BESS ${location.name} at critical capacity (${currentLoad}%) — initiating emergency discharge protocol`;
      action = 'emergency_discharge';
    } else if (type === 'substation') {
      message = `Substation ${location.name} overloaded (${currentLoad}%) — rerouting power through backup feeders`;
      action = 'reroute_power';
    } else {
      message = `Critical overload at ${location.name} (${currentLoad}%) — implementing load shedding protocols`;
      action = 'load_shedding';
    }
  } else if (status === 'warning') {
    severity = 'warning';
    priority = 2;
    confidence = 0.85;
    
    if (predictedLoad > currentLoad + 10) {
      message = `High demand predicted for ${location.name} — pre-allocating ${Math.round(predictedLoad - currentLoad)}% additional capacity`;
      action = 'pre_allocate';
    } else if (type === 'bess' && hour >= 10 && hour <= 16) {
      message = `BESS ${location.name} charging opportunity detected — solar surplus available for storage`;
      action = 'optimize_charging';
    } else {
      message = `Load approaching threshold at ${location.name} (${currentLoad}%) — monitoring closely`;
      action = 'monitor';
    }
  } else {
    // Normal status - optimization opportunities
    severity = 'info';
    priority = 1;
    confidence = 0.75;
    
    if (type === 'bess') {
      if (hour >= 18 && hour <= 22 && currentLoad < 50) {
        message = `BESS ${location.name} ready for peak discharge — ${100 - currentLoad}% capacity available`;
        action = 'prepare_discharge';
      } else if (hour >= 6 && hour <= 10 && currentLoad > 80) {
        message = `BESS ${location.name} discharge complete — transitioning to charging mode`;
        action = 'transition_charging';
      } else {
        message = `BESS ${location.name} operating optimally — ${currentLoad}% utilization within normal range`;
        action = 'maintain';
      }
    } else if (type === 'substation') {
      if (currentLoad < 40) {
        message = `Substation ${location.name} underutilized (${currentLoad}%) — opportunity for load balancing`;
        action = 'balance_load';
      } else {
        message = `Substation ${location.name} stable — distributing ${currentLoad}% of capacity efficiently`;
        action = 'maintain';
      }
    } else if (type === 'factory' || type === 'industry') {
      if (hour >= 8 && hour <= 17) {
        if (currentLoad < 60) {
          message = `${location.name} below expected industrial load — ${100 - currentLoad}% capacity available`;
          action = 'increase_allocation';
        } else {
          message = `${location.name} operating at optimal industrial capacity (${currentLoad}%)`;
          action = 'maintain';
        }
      } else {
        message = `${location.name} in off-peak mode — reduced load expected (${currentLoad}%)`;
        action = 'off_peak_mode';
      }
    } else {
      // Residential
      if ((hour >= 7 && hour <= 9) || (hour >= 18 && hour <= 22)) {
        message = `${location.name} peak residential demand period — ${currentLoad}% utilization normal`;
        action = 'peak_mode';
      } else {
        message = `${location.name} residential load stable — ${currentLoad}% within expected range`;
        action = 'maintain';
      }
    }
  }
  
  // Add prediction-based insights
  const loadTrend = predictedLoad - currentLoad;
  if (Math.abs(loadTrend) > 5) {
    const trendDirection = loadTrend > 0 ? 'increase' : 'decrease';
    const trendMagnitude = Math.abs(loadTrend);
    message += ` — ${trendMagnitude.toFixed(1)}% ${trendDirection} predicted`;
  }
  
  // Add time-based context
  const timeContext = getTimeContext(hour, type);
  if (timeContext) {
    message += ` (${timeContext})`;
  }
  
  return {
    id: `decision-${location.id}-${Date.now()}`,
    locationId: location.id,
    locationName: location.name,
    locationType: type,
    message,
    action,
    severity,
    priority,
    confidence,
    currentLoad,
    predictedLoad,
    loadTrend: Math.round(loadTrend * 100) / 100,
    timestamp: now.toISOString(),
    metadata: {
      hour,
      status,
      algorithm: 'rule_based_ai',
      version: '1.0'
    }
  };
}

function getTimeContext(hour, type) {
  if (hour >= 6 && hour <= 9) {
    return type === 'house' ? 'morning peak' : 'business startup';
  } else if (hour >= 10 && hour <= 16) {
    return type === 'bess' ? 'solar charging window' : 'midday operations';
  } else if (hour >= 17 && hour <= 22) {
    return type === 'house' ? 'evening peak' : 'end-of-day operations';
  } else if (hour >= 23 || hour <= 5) {
    return 'off-peak hours';
  }
  return null;
}

function generateSystemRecommendations(locations) {
  const recommendations = [];
  const now = new Date();
  
  // System-level analysis
  const totalLocations = locations.length;
  const criticalCount = locations.filter(l => l.status === 'critical').length;
  const warningCount = locations.filter(l => l.status === 'warning').length;
  const bessLocations = locations.filter(l => l.type === 'bess');
  const avgLoad = locations.reduce((sum, l) => sum + l.currentLoad, 0) / totalLocations;
  
  // Critical system recommendations
  if (criticalCount > 0) {
    recommendations.push({
      id: `sys-critical-${Date.now()}`,
      type: 'system_alert',
      severity: 'critical',
      priority: 3,
      title: 'Critical System Alert',
      message: `${criticalCount} location(s) in critical state — immediate intervention required`,
      action: 'emergency_response',
      affectedLocations: criticalCount,
      estimatedImpact: 'high',
      timeToResolve: '5-15 minutes',
      confidence: 0.95
    });
  }
  
  // Load balancing recommendations
  const loads = locations.map(l => l.currentLoad);
  const loadVariance = calculateVariance(loads);
  if (loadVariance > 400) { // High variance indicates poor balance
    recommendations.push({
      id: `sys-balance-${Date.now()}`,
      type: 'optimization',
      severity: 'warning',
      priority: 2,
      title: 'Load Balancing Opportunity',
      message: `High load variance detected (σ²=${Math.round(loadVariance)}) — system efficiency can be improved`,
      action: 'balance_loads',
      potentialSavings: `${Math.round(loadVariance / 100)}% efficiency gain`,
      estimatedImpact: 'medium',
      timeToResolve: '15-30 minutes',
      confidence: 0.8
    });
  }
  
  // BESS optimization recommendations
  if (bessLocations.length > 0) {
    const bessAvgLoad = bessLocations.reduce((sum, l) => sum + l.currentLoad, 0) / bessLocations.length;
    const hour = now.getHours();
    
    if (hour >= 10 && hour <= 16 && bessAvgLoad < 70) {
      recommendations.push({
        id: `sys-bess-charge-${Date.now()}`,
        type: 'bess_optimization',
        severity: 'info',
        priority: 1,
        title: 'BESS Charging Opportunity',
        message: `Solar peak hours detected — ${bessLocations.length} BESS unit(s) available for charging`,
        action: 'optimize_bess_charging',
        availableCapacity: `${Math.round((100 - bessAvgLoad) * bessLocations.length)}% total`,
        estimatedImpact: 'medium',
        timeToResolve: '1-2 hours',
        confidence: 0.85
      });
    } else if (hour >= 18 && hour <= 22 && bessAvgLoad > 60) {
      recommendations.push({
        id: `sys-bess-discharge-${Date.now()}`,
        type: 'bess_optimization',
        severity: 'info',
        priority: 1,
        title: 'BESS Discharge Opportunity',
        message: `Peak demand period — ${bessLocations.length} BESS unit(s) ready for discharge`,
        action: 'optimize_bess_discharge',
        availableCapacity: `${Math.round(bessAvgLoad * bessLocations.length)}% total`,
        estimatedImpact: 'high',
        timeToResolve: '30-60 minutes',
        confidence: 0.9
      });
    }
  }
  
  // Predictive recommendations
  const predictiveInsights = generatePredictiveInsights(locations);
  recommendations.push(...predictiveInsights);
  
  // System health recommendation
  const healthScore = calculateSystemHealth(locations);
  if (healthScore < 70) {
    recommendations.push({
      id: `sys-health-${Date.now()}`,
      type: 'system_health',
      severity: healthScore < 50 ? 'warning' : 'info',
      priority: healthScore < 50 ? 2 : 1,
      title: 'System Health Alert',
      message: `System health score: ${healthScore}% — performance optimization recommended`,
      action: 'system_optimization',
      healthScore,
      estimatedImpact: 'high',
      timeToResolve: '1-3 hours',
      confidence: 0.75
    });
  }
  
  return {
    recommendations: recommendations.sort((a, b) => b.priority - a.priority),
    systemMetrics: {
      totalLocations,
      criticalCount,
      warningCount,
      averageLoad: Math.round(avgLoad * 100) / 100,
      loadVariance: Math.round(loadVariance),
      healthScore,
      bessCount: bessLocations.length
    },
    generatedAt: now.toISOString(),
    nextUpdate: new Date(now.getTime() + 5 * 60 * 1000).toISOString() // 5 minutes
  };
}

function generatePredictiveInsights(locations) {
  const insights = [];
  const now = new Date();
  const hour = now.getHours();
  
  // Predict peak demand periods
  if (hour >= 16 && hour <= 17) {
    const residentialLocations = locations.filter(l => l.type === 'house');
    const avgResidentialLoad = residentialLocations.reduce((sum, l) => sum + l.currentLoad, 0) / residentialLocations.length;
    
    if (avgResidentialLoad < 60) {
      insights.push({
        id: `pred-evening-peak-${Date.now()}`,
        type: 'predictive',
        severity: 'info',
        priority: 1,
        title: 'Evening Peak Prediction',
        message: `Residential evening peak approaching — expect 20-30% load increase in next 2 hours`,
        action: 'prepare_peak_capacity',
        predictedIncrease: '20-30%',
        timeframe: '2 hours',
        confidence: 0.85
      });
    }
  }
  
  // Predict solar charging opportunities
  if (hour >= 8 && hour <= 9) {
    const bessLocations = locations.filter(l => l.type === 'bess');
    const chargingCapacity = bessLocations.reduce((sum, l) => sum + (100 - l.currentLoad), 0);
    
    if (chargingCapacity > 100) {
      insights.push({
        id: `pred-solar-charge-${Date.now()}`,
        type: 'predictive',
        severity: 'info',
        priority: 1,
        title: 'Solar Charging Forecast',
        message: `Optimal solar conditions predicted — ${Math.round(chargingCapacity)}% BESS charging capacity available`,
        action: 'prepare_solar_charging',
        availableCapacity: `${Math.round(chargingCapacity)}%`,
        timeframe: '2-6 hours',
        confidence: 0.8
      });
    }
  }
  
  return insights;
}

function calculateVariance(values) {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
}

function calculateSystemHealth(locations) {
  const criticalCount = locations.filter(l => l.status === 'critical').length;
  const warningCount = locations.filter(l => l.status === 'warning').length;
  const totalLocations = locations.length;
  
  // Base health score
  let healthScore = 100;
  
  // Penalize for critical and warning locations
  healthScore -= (criticalCount / totalLocations) * 50;
  healthScore -= (warningCount / totalLocations) * 25;
  
  // Consider load distribution
  const loads = locations.map(l => l.currentLoad);
  const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
  const variance = calculateVariance(loads);
  
  // Penalize for poor load distribution
  healthScore -= Math.min(20, variance / 50);
  
  // Penalize for extreme average loads
  if (avgLoad > 85 || avgLoad < 30) {
    healthScore -= Math.abs(avgLoad - 60) / 2;
  }
  
  return Math.max(0, Math.round(healthScore));
}

function simulateScenarioDecisions(scenario) {
  const { name, locations: scenarioLocations, timeframe = '1 hour' } = scenario;
  const decisions = [];
  
  // Generate decisions for each location in the scenario
  for (const location of scenarioLocations) {
    const decision = generateAIDecision(location);
    decision.scenario = name;
    decision.timeframe = timeframe;
    decisions.push(decision);
  }
  
  // Generate scenario-level recommendations
  const systemRecommendations = generateSystemRecommendations(scenarioLocations);
  
  return {
    locationDecisions: decisions,
    systemRecommendations: systemRecommendations.recommendations,
    scenarioMetrics: systemRecommendations.systemMetrics,
    scenarioName: name,
    timeframe
  };
}

module.exports = router;