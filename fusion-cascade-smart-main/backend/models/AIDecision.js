const mongoose = require('mongoose');

const aiDecisionSchema = new mongoose.Schema({
  decisionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  locationId: {
    type: String,
    required: true,
    ref: 'Location'
  },
  decisionType: {
    type: String,
    required: true,
    enum: [
      'load_balancing',
      'power_rerouting', 
      'demand_prediction',
      'critical_alert',
      'optimization',
      'maintenance_schedule',
      'emergency_response'
    ]
  },
  severity: {
    type: String,
    required: true,
    enum: ['info', 'warning', 'critical', 'emergency'],
    default: 'info'
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  action: {
    type: String,
    required: true,
    maxlength: 1000
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 85
  },
  parameters: {
    currentLoad: Number,
    predictedLoad: Number,
    targetLoad: Number,
    powerAllocation: Number,
    routeChanges: [{
      from: String,
      to: String,
      powerAmount: Number
    }]
  },
  mlModelUsed: {
    type: String,
    enum: ['lstm', 'regression', 'q_learning', 'dqn', 'optimization'],
    default: 'optimization'
  },
  executionStatus: {
    type: String,
    enum: ['pending', 'executing', 'completed', 'failed'],
    default: 'pending'
  },
  executedAt: Date,
  result: {
    success: Boolean,
    metrics: {
      loadReduction: Number,
      efficiencyGain: Number,
      powerSaved: Number
    },
    feedback: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for performance
aiDecisionSchema.index({ locationId: 1, timestamp: -1 });
aiDecisionSchema.index({ severity: 1, executionStatus: 1 });
aiDecisionSchema.index({ decisionType: 1, timestamp: -1 });

// Method to generate decision message based on type and severity
aiDecisionSchema.methods.generateMessage = function() {
  const templates = {
    load_balancing: {
      info: "Load balancing optimization completed",
      warning: "Load imbalance detected, rebalancing in progress",
      critical: "Critical load imbalance - emergency rebalancing activated",
      emergency: "EMERGENCY: System overload - immediate load shedding required"
    },
    power_rerouting: {
      info: "Power routing optimized for efficiency",
      warning: "Rerouting power due to high demand",
      critical: "Critical rerouting - threshold exceeded",
      emergency: "EMERGENCY: Power rerouting to prevent system failure"
    },
    demand_prediction: {
      info: "Demand forecast updated",
      warning: "High demand predicted in next interval",
      critical: "Critical demand spike predicted - preparing reserves",
      emergency: "EMERGENCY: Extreme demand surge predicted"
    },
    critical_alert: {
      warning: "System monitoring - elevated parameters",
      critical: "Critical system alert - immediate attention required",
      emergency: "EMERGENCY: System failure imminent"
    }
  };

  const template = templates[this.decisionType]?.[this.severity];
  if (template) {
    this.message = template;
  }
  
  return this.message;
};

// Method to execute decision
aiDecisionSchema.methods.execute = async function() {
  this.executionStatus = 'executing';
  this.executedAt = new Date();
  
  try {
    // Simulate decision execution logic
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.executionStatus = 'completed';
    this.result = {
      success: true,
      metrics: {
        loadReduction: Math.random() * 10,
        efficiencyGain: Math.random() * 5,
        powerSaved: Math.random() * 20
      },
      feedback: 'Decision executed successfully'
    };
  } catch (error) {
    this.executionStatus = 'failed';
    this.result = {
      success: false,
      feedback: error.message
    };
  }
  
  return this.save();
};

// Static method to get recent decisions for location
aiDecisionSchema.statics.getRecentDecisions = function(locationId, limit = 10) {
  return this.find({ locationId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
};

// Static method to get critical decisions
aiDecisionSchema.statics.getCriticalDecisions = function() {
  return this.find({ 
    severity: { $in: ['critical', 'emergency'] },
    executionStatus: { $in: ['pending', 'executing'] }
  })
  .sort({ timestamp: -1 })
  .exec();
};

module.exports = mongoose.model('AIDecision', aiDecisionSchema);