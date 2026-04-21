const express = require('express');
const router = express.Router();
const axios = require('axios');
const Location = require('../models/Location');
const AIDecision = require('../models/AIDecision');
const logger = require('../utils/logger');

// ML Service configuration
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const ML_TIMEOUT = parseInt(process.env.ML_SERVICE_TIMEOUT) || 10000;

// Q-Learning implementation (fallback when ML service unavailable)
class QLearningAgent {
  constructor() {
    this.qTable = new Map();
    this.learningRate = 0.1;
    this.discountFactor = 0.95;
    this.explorationRate = 0.1;
    this.actions = [
      'increase_power',
      'decrease_power', 
      'maintain_power',
      'reroute_power',
      'emergency_shed',
      'balance_load'
    ];
  }
  
  // Convert state to string key for Q-table
  stateToKey(state) {
    return JSON.stringify({
      avgLoad: Math.round(state.averageLoad / 10) * 10,
      criticalCount: state.criticalLocations,
      bessLevel: Math.round(state.bessCapacity / 20) * 20,
      timeOfDay: Math.floor(new Date().getHours() / 6) // 0-3 (6-hour blocks)
    });
  }
  
  // Get Q-value for state-action pair
  getQValue(state, action) {
    const key = `${this.stateToKey(state)}_${action}`;
    return this.qTable.get(key) || 0;
  }
  
  // Set Q-value for state-action pair
  setQValue(state, action, value) {
    const key = `${this.stateToKey(state)}_${action}`;
    this.qTable.set(key, value);
  }
  
  // Choose action using epsilon-greedy policy
  chooseAction(state) {
    if (Math.random() < this.explorationRate) {
      // Explore: random action
      return this.actions[Math.floor(Math.random() * this.actions.length)];
    } else {
      // Exploit: best known action
      let bestAction = this.actions[0];
      let bestValue = this.getQValue(state, bestAction);
      
      for (const action of this.actions) {
        const qValue = this.getQValue(state, action);
        if (qValue > bestValue) {
          bestValue = qValue;
          bestAction = action;
        }
      }
      
      return bestAction;
    }
  }
  
  // Update Q-value based on reward
  updateQValue(state, action, reward, nextState) {
    const currentQ = this.getQValue(state, action);
    
    // Find max Q-value for next state
    let maxNextQ = -Infinity;
    for (const nextAction of this.actions) {
      const nextQ = this.getQValue(nextState, nextAction);
      maxNextQ = Math.max(maxNextQ, nextQ);
    }
    
    // Q-learning update rule
    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
    this.setQValue(state, action, newQ);
    
    return newQ;
  }
  
  // Calculate reward based on system state
  calculateReward(prevState, currentState, action) {
    let reward = 0;
    
    // Reward for reducing critical locations
    const criticalReduction = prevState.criticalLocations - currentState.criticalLocations;
    reward += criticalReduction * 15;
    
    // Reward for balanced load
    const loadBalance = 100 - Math.abs(50 - currentState.averageLoad);
    reward += loadBalance * 0.1;
    
    // Penalty for overload
    if (currentState.averageLoad > 85) {
      reward -= 20;
    }
    
    // Reward for maintaining BESS capacity
    if (currentState.bessCapacity > 20) {
      reward += 10;
    } else if (currentState.bessCapacity < 10) {
      reward -= 10;
    }
    
    // Action-specific rewards
    switch (action) {
      case 'emergency_shed':
        reward += currentState.criticalLocations > 0 ? 5 : -5;
        break;
      case 'balance_load':
        reward += Math.abs(prevState.averageLoad - 50) > Math.abs(currentState.averageLoad - 50) ? 10 : -5;
        break;
      case 'reroute_power':
        reward += criticalReduction > 0 ? 8 : -3;
        break;
    }
    
    return Math.max(-50, Math.min(50, reward)); // Clamp reward
  }
}

// Global Q-Learning agent instance
const qAgent = new QLearningAgent();

// Helper function to get current system state
async function getSystemState() {
  const locations = await Location.find({ connectionStatus: 'online' });
  const bessLocations = locations.filter(l => l.type === 'bess');
  
  const totalLoad = locations.reduce((sum, l) => sum + l.currentLoad, 0);
  const averageLoad = locations.length > 0 ? totalLoad / locations.length : 0;
  const criticalLocations = locations.filter(l => l.status === 'critical').length;
  const warningLocations = locations.filter(l => l.status === 'warning').length;
  
  const totalBessCapacity = bessLocations.reduce((sum, b) => sum + (b.metadata?.chargeLevel || 0), 0);
  const averageBessCapacity = bessLocations.length > 0 ? totalBessCapacity / bessLocations.length : 0;
  
  return {
    averageLoad,
    criticalLocations,
    warningLocations,
    bessCapacity: averageBessCapacity,
    totalLocations: locations.length,
    timestamp: new Date()
  };
}

// Helper function to generate power allocation plan
function generateAllocationPlan(locations, action, confidence = 85) {
  const plan = {
    action,
    confidence,
    allocations: [],
    totalPowerAdjustment: 0,
    estimatedImpact: {}
  };
  
  const criticalLocations = locations.filter(l => l.status === 'critical');
  const warningLocations = locations.filter(l => l.status === 'warning');
  const normalLocations = locations.filter(l => l.status === 'normal');
  
  switch (action) {
    case 'emergency_shed':
      // Reduce power to non-critical locations
      normalLocations.forEach(location => {
        const reduction = Math.min(20, location.currentLoad * 0.3);
        plan.allocations.push({
          locationId: location.id,
          currentAllocation: location.currentLoad,
          newAllocation: Math.max(0, location.currentLoad - reduction),
          change: -reduction,
          reason: 'Emergency load shedding'
        });
        plan.totalPowerAdjustment -= reduction;
      });
      break;
      
    case 'balance_load':
      // Redistribute power from high-load to low-load locations
      const highLoadLocations = locations.filter(l => l.currentLoad > 70);
      const lowLoadLocations = locations.filter(l => l.currentLoad < 40);
      
      highLoadLocations.forEach(location => {
        const reduction = Math.min(15, location.currentLoad - 65);
        plan.allocations.push({
          locationId: location.id,
          currentAllocation: location.currentLoad,
          newAllocation: location.currentLoad - reduction,
          change: -reduction,
          reason: 'Load balancing - reduce high load'
        });
        plan.totalPowerAdjustment -= reduction;
      });
      
      const redistributePower = Math.abs(plan.totalPowerAdjustment) / Math.max(1, lowLoadLocations.length);
      lowLoadLocations.forEach(location => {
        plan.allocations.push({
          locationId: location.id,
          currentAllocation: location.currentLoad,
          newAllocation: Math.min(100, location.currentLoad + redistributePower),
          change: redistributePower,
          reason: 'Load balancing - increase low load'
        });
      });
      break;
      
    case 'reroute_power':
      // Prioritize critical locations
      criticalLocations.forEach(location => {
        const increase = Math.min(10, 100 - location.currentLoad);
        plan.allocations.push({
          locationId: location.id,
          currentAllocation: location.currentLoad,
          newAllocation: location.currentLoad + increase,
          change: increase,
          reason: 'Priority routing to critical location'
        });
        plan.totalPowerAdjustment += increase;
      });
      break;
      
    case 'increase_power':
      // Increase power to locations below capacity
      locations.filter(l => l.currentLoad < 80).forEach(location => {
        const increase = Math.min(5, 80 - location.currentLoad);
        plan.allocations.push({
          locationId: location.id,
          currentAllocation: location.currentLoad,
          newAllocation: location.currentLoad + increase,
          change: increase,
          reason: 'Increase power allocation'
        });
        plan.totalPowerAdjustment += increase;
      });
      break;
      
    case 'decrease_power':
      // Decrease power across all locations
      locations.forEach(location => {
        const decrease = Math.min(5, location.currentLoad * 0.1);
        plan.allocations.push({
          locationId: location.id,
          currentAllocation: location.currentLoad,
          newAllocation: Math.max(0, location.currentLoad - decrease),
          change: -decrease,
          reason: 'Reduce power allocation'
        });
        plan.totalPowerAdjustment -= decrease;
      });
      break;
      
    default: // maintain_power
      locations.forEach(location => {
        plan.allocations.push({
          locationId: location.id,
          currentAllocation: location.currentLoad,
          newAllocation: location.currentLoad,
          change: 0,
          reason: 'Maintain current allocation'
        });
      });
  }
  
  // Calculate estimated impact
  plan.estimatedImpact = {
    criticalReduction: Math.max(0, criticalLocations.length - Math.floor(criticalLocations.length * 0.7)),
    efficiencyGain: Math.abs(plan.totalPowerAdjustment) * 0.1,
    loadBalance: action === 'balance_load' ? 15 : 5
  };
  
  return plan;
}

// GET /api/rl/action - Get RL-based optimal action
router.get('/action', async (req, res, next) => {
  try {
    const currentState = await getSystemState();
    
    let action = 'maintain_power';
    let confidence = 70;
    let modelUsed = 'q_learning';
    let qValue = 0;
    
    try {
      // Try ML service first (Deep Q-Network)
      const mlResponse = await axios.post(`${ML_SERVICE_URL}/rl-action`, {
        state: currentState,
        timestamp: new Date().toISOString()
      }, {
        timeout: ML_TIMEOUT
      });
      
      if (mlResponse.data && mlResponse.data.success) {
        action = mlResponse.data.action;
        confidence = mlResponse.data.confidence || 85;
        modelUsed = mlResponse.data.model || 'dqn';
        qValue = mlResponse.data.qValue || 0;
        
        logger.rlAction(currentState, action, 0, qValue);
      }
    } catch (mlError) {
      logger.warn(`ML Service unavailable for RL action: ${mlError.message}`);
      
      // Fallback to local Q-learning
      action = qAgent.chooseAction(currentState);
      qValue = qAgent.getQValue(currentState, action);
      confidence = Math.min(85, 60 + Math.abs(qValue));
      modelUsed = 'q_learning_local';
    }
    
    // Get all locations for allocation plan
    const locations = await Location.find({ connectionStatus: 'online' });
    const allocationPlan = generateAllocationPlan(locations, action, confidence);
    
    // Create AI decision record
    const decision = new AIDecision({
      decisionId: `rl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      locationId: 'system', // System-wide decision
      decisionType: 'optimization',
      severity: currentState.criticalLocations > 0 ? 'critical' : 'info',
      message: `RL Agent recommends: ${action.replace('_', ' ')}`,
      action: `Execute ${action} with ${allocationPlan.allocations.length} location adjustments`,
      confidence,
      parameters: {
        currentLoad: currentState.averageLoad,
        criticalLocations: currentState.criticalLocations,
        bessCapacity: currentState.bessCapacity,
        qValue,
        allocationPlan
      },
      mlModelUsed: modelUsed === 'dqn' ? 'dqn' : 'q_learning'
    });
    
    await decision.save();
    
    res.json({
      success: true,
      data: {
        action,
        confidence,
        modelUsed,
        qValue,
        systemState: currentState,
        allocationPlan,
        decisionId: decision.decisionId,
        reasoning: {
          criticalLocations: currentState.criticalLocations,
          averageLoad: currentState.averageLoad,
          bessCapacity: currentState.bessCapacity,
          recommendation: `Based on current system state, ${action.replace('_', ' ')} is optimal`
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// POST /api/rl/feedback - Provide feedback to RL agent
router.post('/feedback', async (req, res, next) => {
  try {
    const { decisionId, reward, newState, success = true } = req.body;
    
    if (!decisionId || reward === undefined) {
      return res.status(400).json({
        success: false,
        error: 'decisionId and reward are required'
      });
    }
    
    // Find the decision
    const decision = await AIDecision.findOne({ decisionId });
    if (!decision) {
      return res.status(404).json({
        success: false,
        error: 'Decision not found'
      });
    }
    
    // Update decision with feedback
    decision.result = {
      success,
      metrics: {
        reward,
        loadReduction: newState?.loadReduction || 0,
        efficiencyGain: newState?.efficiencyGain || 0,
        powerSaved: newState?.powerSaved || 0
      },
      feedback: `Reward: ${reward}, Success: ${success}`
    };
    decision.executionStatus = success ? 'completed' : 'failed';
    await decision.save();
    
    // Update Q-learning agent if using local model
    if (decision.mlModelUsed === 'q_learning' && decision.parameters) {
      const prevState = {
        averageLoad: decision.parameters.currentLoad,
        criticalLocations: decision.parameters.criticalLocations,
        bessCapacity: decision.parameters.bessCapacity
      };
      
      const currentState = newState || await getSystemState();
      const action = decision.parameters.allocationPlan?.action || 'maintain_power';
      
      const calculatedReward = qAgent.calculateReward(prevState, currentState, action);
      const finalReward = reward !== undefined ? reward : calculatedReward;
      
      const newQValue = qAgent.updateQValue(prevState, action, finalReward, currentState);
      
      logger.rlAction(prevState, action, finalReward, newQValue);
    }
    
    // Try to send feedback to ML service
    try {
      await axios.post(`${ML_SERVICE_URL}/rl-feedback`, {
        decisionId,
        reward,
        newState,
        success
      }, {
        timeout: ML_TIMEOUT
      });
    } catch (mlError) {
      logger.warn(`Failed to send feedback to ML service: ${mlError.message}`);
    }
    
    res.json({
      success: true,
      data: {
        decisionId,
        feedbackProcessed: true,
        updatedQValue: decision.parameters?.qValue,
        message: 'Feedback processed successfully'
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// GET /api/rl/state - Get current system state
router.get('/state', async (req, res, next) => {
  try {
    const systemState = await getSystemState();
    
    // Get recent RL decisions
    const recentDecisions = await AIDecision.find({
      decisionType: 'optimization',
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    })
    .sort({ timestamp: -1 })
    .limit(10);
    
    // Calculate performance metrics
    const successfulDecisions = recentDecisions.filter(d => d.result?.success).length;
    const averageReward = recentDecisions.length > 0 
      ? recentDecisions.reduce((sum, d) => sum + (d.result?.metrics?.reward || 0), 0) / recentDecisions.length
      : 0;
    
    res.json({
      success: true,
      data: {
        systemState,
        performance: {
          recentDecisions: recentDecisions.length,
          successRate: recentDecisions.length > 0 ? (successfulDecisions / recentDecisions.length) * 100 : 0,
          averageReward: Math.round(averageReward * 100) / 100,
          qTableSize: qAgent.qTable.size,
          explorationRate: qAgent.explorationRate
        },
        recentActions: recentDecisions.slice(0, 5).map(d => ({
          decisionId: d.decisionId,
          action: d.parameters?.allocationPlan?.action,
          confidence: d.confidence,
          timestamp: d.timestamp,
          success: d.result?.success,
          reward: d.result?.metrics?.reward
        }))
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// POST /api/rl/train - Trigger training session
router.post('/train', async (req, res, next) => {
  try {
    const { episodes = 100, learningRate, explorationRate } = req.body;
    
    // Update agent parameters if provided
    if (learningRate !== undefined) {
      qAgent.learningRate = Math.max(0.01, Math.min(1, learningRate));
    }
    if (explorationRate !== undefined) {
      qAgent.explorationRate = Math.max(0.01, Math.min(1, explorationRate));
    }
    
    let trainingResults = {
      episodes: 0,
      totalReward: 0,
      averageReward: 0,
      qTableGrowth: 0
    };
    
    try {
      // Try ML service training
      const mlResponse = await axios.post(`${ML_SERVICE_URL}/rl-train`, {
        episodes,
        learningRate: qAgent.learningRate,
        explorationRate: qAgent.explorationRate
      }, {
        timeout: 30000 // 30 seconds for training
      });
      
      if (mlResponse.data && mlResponse.data.success) {
        trainingResults = mlResponse.data.results;
      }
    } catch (mlError) {
      logger.warn(`ML Service training failed: ${mlError.message}`);
      
      // Local training simulation
      const initialQTableSize = qAgent.qTable.size;
      let totalReward = 0;
      
      for (let episode = 0; episode < Math.min(episodes, 50); episode++) {
        // Simulate training episode
        const state = await getSystemState();
        const action = qAgent.chooseAction(state);
        const reward = Math.random() * 20 - 10; // Random reward for simulation
        const nextState = await getSystemState();
        
        qAgent.updateQValue(state, action, reward, nextState);
        totalReward += reward;
      }
      
      trainingResults = {
        episodes: Math.min(episodes, 50),
        totalReward,
        averageReward: totalReward / Math.min(episodes, 50),
        qTableGrowth: qAgent.qTable.size - initialQTableSize
      };
    }
    
    logger.info(`RL Training completed: ${trainingResults.episodes} episodes, avg reward: ${trainingResults.averageReward}`);
    
    res.json({
      success: true,
      data: {
        trainingCompleted: true,
        results: trainingResults,
        agentParameters: {
          learningRate: qAgent.learningRate,
          explorationRate: qAgent.explorationRate,
          qTableSize: qAgent.qTable.size
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;