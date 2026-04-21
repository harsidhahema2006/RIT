const axios = require('axios');
const logger = require('../utils/logger');

class ReinforcementLearningService {
  constructor() {
    this.pythonServiceUrl = process.env.PYTHON_RL_SERVICE_URL || 'http://localhost:8001';
    this.fallbackEnabled = true;
    this.cache = new Map();
    this.cacheTimeout = 2 * 60 * 1000; // 2 minutes
    this.feedbackBuffer = [];
    this.maxBufferSize = 100;
  }

  async getOptimalAction(systemState) {
    try {
      // Check cache first
      const cacheKey = `action-${Date.now() - (Date.now() % this.cacheTimeout)}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      let action;
      try {
        // Try Python RL service first
        action = await this.callPythonRLService(systemState);
      } catch (error) {
        logger.warn('Python RL service unavailable, using fallback');
        action = await this.fallbackAction(systemState);
      }

      // Cache the result
      this.cache.set(cacheKey, action);
      this.cleanCache();

      return action;
    } catch (error) {
      logger.error('Error getting optimal action:', error);
      return this.fallbackAction(systemState);
    }
  }

  async callPythonRLService(systemState) {
    const response = await axios.post(`${this.pythonServiceUrl}/action`, systemState, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.allocations) {
      return response.data;
    } else {
      throw new Error('Invalid response from Python RL service');
    }
  }

  async fallbackAction(systemState) {
    try {
      const locations = systemState.locations || [];
      const allocations = [];

      // Simple rule-based power allocation
      for (const location of locations) {
        const currentLoad = location.currentLoad || 0;
        const predictedLoad = location.predictedLoad || currentLoad;
        const status = location.status || 'normal';
        const type = location.type || 'house';

        let adjustment = 0;
        let priority = 1;
        let reason = 'Maintaining current allocation';

        // Rule-based decision making
        if (status === 'critical') {
          // Critical locations need immediate load reduction
          adjustment = -Math.min(15, currentLoad * 0.2);
          priority = 3;
          reason = 'Emergency load reduction for critical zone';
        } else if (status === 'warning') {
          // Warning locations need moderate adjustment
          if (predictedLoad > currentLoad) {
            adjustment = -Math.min(10, (predictedLoad - currentLoad) * 0.5);
            reason = 'Preventive load reduction based on prediction';
          } else {
            adjustment = -5;
            reason = 'Precautionary load reduction';
          }
          priority = 2;
        } else {
          // Normal locations can be optimized
          if (type === 'bess') {
            // BESS can absorb or provide power
            const hour = new Date().getHours();
            if (hour >= 10 && hour <= 16) {
              // Charging period (solar available)
              adjustment = Math.min(10, 80 - currentLoad);
              reason = 'Charging during solar peak hours';
            } else if (hour >= 18 && hour <= 22) {
              // Discharging period (peak demand)
              adjustment = -Math.min(15, currentLoad - 20);
              reason = 'Discharging during peak demand';
            }
          } else if (currentLoad < 50) {
            // Underutilized locations can take more load
            adjustment = Math.min(5, 65 - currentLoad);
            reason = 'Increasing allocation to utilize capacity';
          }
        }

        const recommendedLoad = Math.max(0, Math.min(100, currentLoad + adjustment));

        allocations.push({
          locationId: location.id,
          currentLoad,
          recommendedLoad,
          adjustment,
          priority,
          reason
        });
      }

      // Sort by priority (highest first)
      allocations.sort((a, b) => b.priority - a.priority);

      return {
        allocations,
        confidence: 0.6,
        strategy: 'rule_based_fallback',
        systemMetrics: this.calculateSystemMetrics(systemState),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in fallback action:', error);
      return {
        allocations: [],
        confidence: 0.0,
        strategy: 'error_fallback',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  calculateSystemMetrics(systemState) {
    const locations = systemState.locations || [];
    
    if (locations.length === 0) {
      return {
        efficiency: 0,
        balance: 0,
        stability: 0,
        utilization: 0
      };
    }

    // Calculate efficiency (how well we're using capacity)
    const totalLoad = locations.reduce((sum, l) => sum + (l.currentLoad || 0), 0);
    const totalCapacity = locations.reduce((sum, l) => sum + (l.capacity || 100), 0);
    const utilization = (totalLoad / totalCapacity) * 100;
    
    // Optimal utilization is around 70%
    const efficiency = Math.max(0, 100 - Math.abs(utilization - 70));

    // Calculate balance (how evenly distributed the load is)
    const loads = locations.map(l => l.currentLoad || 0);
    const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    const variance = loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length;
    const balance = Math.max(0, 100 - Math.sqrt(variance));

    // Calculate stability (how many locations are in critical/warning state)
    const criticalCount = locations.filter(l => l.status === 'critical').length;
    const warningCount = locations.filter(l => l.status === 'warning').length;
    const stability = Math.max(0, 100 - (criticalCount * 30 + warningCount * 15));

    return {
      efficiency: Math.round(efficiency * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      stability: Math.round(stability * 100) / 100,
      utilization: Math.round(utilization * 100) / 100
    };
  }

  async processFeedback(feedback) {
    try {
      // Add to feedback buffer
      this.feedbackBuffer.push({
        ...feedback,
        timestamp: new Date().toISOString()
      });

      // Keep buffer size manageable
      if (this.feedbackBuffer.length > this.maxBufferSize) {
        this.feedbackBuffer = this.feedbackBuffer.slice(-this.maxBufferSize);
      }

      // Try to send feedback to Python service
      try {
        await axios.post(`${this.pythonServiceUrl}/feedback`, feedback, {
          timeout: 3000,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        logger.debug('Feedback sent to RL service');
      } catch (error) {
        logger.warn('Could not send feedback to RL service:', error.message);
      }

      return true;
    } catch (error) {
      logger.error('Error processing feedback:', error);
      return false;
    }
  }

  async trainModel(trainingData, episodes = 1) {
    try {
      const payload = {
        ...trainingData,
        episodes
      };

      const response = await axios.post(`${this.pythonServiceUrl}/train`, payload, {
        timeout: 30000, // Training can take longer
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Error training RL model:', error);
      return {
        success: false,
        error: error.message,
        fallback: 'Training failed, using existing model'
      };
    }
  }

  async getTrainingStats() {
    try {
      const response = await axios.get(`${this.pythonServiceUrl}/stats`, {
        timeout: 5000
      });

      return {
        ...response.data,
        feedbackBufferSize: this.feedbackBuffer.length,
        lastFeedback: this.feedbackBuffer.length > 0 
          ? this.feedbackBuffer[this.feedbackBuffer.length - 1].timestamp 
          : null
      };
    } catch (error) {
      logger.warn('Could not get RL training stats:', error.message);
      return {
        available: false,
        error: error.message,
        feedbackBufferSize: this.feedbackBuffer.length
      };
    }
  }

  async simulateScenario(scenario, steps = 10) {
    try {
      const results = [];
      let currentState = scenario.initialState;

      for (let step = 0; step < steps; step++) {
        // Get action for current state
        const action = await this.getOptimalAction(currentState);
        
        // Simulate state transition (simplified)
        const nextState = this.simulateStateTransition(currentState, action);
        
        // Calculate reward
        const reward = this.calculateReward(currentState, action, nextState);
        
        results.push({
          step,
          state: currentState,
          action,
          nextState,
          reward,
          timestamp: new Date().toISOString()
        });

        currentState = nextState;
      }

      return {
        scenario: scenario.name || 'Simulation',
        steps: results,
        totalReward: results.reduce((sum, r) => sum + r.reward, 0),
        finalState: currentState
      };
    } catch (error) {
      logger.error('Error simulating scenario:', error);
      throw error;
    }
  }

  simulateStateTransition(currentState, action) {
    // Simplified state transition simulation
    const newLocations = currentState.locations.map(location => {
      const allocation = action.allocations.find(a => a.locationId === location.id);
      
      if (allocation) {
        const newLoad = Math.max(0, Math.min(100, allocation.recommendedLoad));
        const newStatus = newLoad > 85 ? 'critical' : (newLoad > 65 ? 'warning' : 'normal');
        
        return {
          ...location,
          currentLoad: newLoad,
          status: newStatus
        };
      }
      
      return location;
    });

    return {
      ...currentState,
      locations: newLocations,
      timestamp: new Date().toISOString()
    };
  }

  calculateReward(prevState, action, newState) {
    let reward = 0;

    // Reward for reducing critical locations
    const prevCritical = prevState.locations.filter(l => l.status === 'critical').length;
    const newCritical = newState.locations.filter(l => l.status === 'critical').length;
    
    if (newCritical < prevCritical) {
      reward += 15 * (prevCritical - newCritical);
    } else if (newCritical > prevCritical) {
      reward -= 20 * (newCritical - prevCritical);
    }

    // Reward for load balancing
    const prevLoads = prevState.locations.map(l => l.currentLoad);
    const newLoads = newState.locations.map(l => l.currentLoad);
    
    const prevStd = this.calculateStandardDeviation(prevLoads);
    const newStd = this.calculateStandardDeviation(newLoads);
    
    if (newStd < prevStd) {
      reward += 10 * (prevStd - newStd) / 10;
    }

    // Penalty for overloads
    const overloaded = newState.locations.filter(l => l.currentLoad > 85).length;
    reward -= 20 * overloaded;

    // Small penalty for large adjustments (encourage stability)
    const totalAdjustment = action.allocations.reduce((sum, a) => sum + Math.abs(a.adjustment || 0), 0);
    reward -= totalAdjustment * 0.1;

    return reward;
  }

  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  async getPolicyInfo() {
    try {
      const response = await axios.get(`${this.pythonServiceUrl}/policy`, {
        timeout: 5000
      });

      return response.data;
    } catch (error) {
      logger.warn('Could not get RL policy info:', error.message);
      return {
        available: false,
        error: error.message,
        fallback: {
          type: 'rule_based',
          description: 'Simple rule-based policy for power distribution',
          rules: [
            'Reduce load for critical locations',
            'Moderate adjustment for warning locations',
            'Optimize BESS charging/discharging based on time',
            'Increase allocation for underutilized locations'
          ]
        }
      };
    }
  }

  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      const keyTime = parseInt(key.split('-')[1]);
      if (now - keyTime > this.cacheTimeout * 2) {
        this.cache.delete(key);
      }
    }
  }

  // Get buffered feedback for analysis
  getFeedbackBuffer() {
    return [...this.feedbackBuffer];
  }

  // Clear feedback buffer
  clearFeedbackBuffer() {
    this.feedbackBuffer = [];
  }
}

module.exports = ReinforcementLearningService;