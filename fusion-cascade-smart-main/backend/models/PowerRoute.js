const mongoose = require('mongoose');

const powerRouteSchema = new mongoose.Schema({
  routeId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sourceId: {
    type: String,
    required: true,
    ref: 'Location'
  },
  destinationId: {
    type: String,
    required: true,
    ref: 'Location'
  },
  intermediateNodes: [{
    nodeId: {
      type: String,
      ref: 'Location'
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    order: Number
  }],
  routeCoordinates: [{
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    }
  }],
  distance: {
    type: Number,
    required: true,
    min: 0
  },
  powerFlow: {
    type: Number,
    required: true,
    min: 0
  },
  efficiency: {
    type: Number,
    min: 0,
    max: 100,
    default: 95
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'overloaded'],
    default: 'active'
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
powerRouteSchema.index({ sourceId: 1, destinationId: 1 });
powerRouteSchema.index({ status: 1, priority: -1 });

// Method to calculate route efficiency
powerRouteSchema.methods.calculateEfficiency = function() {
  // Efficiency decreases with distance and increases with power flow optimization
  const baseEfficiency = 98;
  const distancePenalty = Math.min(this.distance * 0.1, 10);
  const flowOptimization = this.powerFlow > 0 ? 2 : 0;
  
  this.efficiency = Math.max(baseEfficiency - distancePenalty + flowOptimization, 70);
  return this.efficiency;
};

// Static method to find optimal route
powerRouteSchema.statics.findOptimalRoute = function(sourceId, destinationId) {
  return this.findOne({ 
    sourceId, 
    destinationId, 
    status: 'active' 
  })
  .sort({ efficiency: -1, distance: 1 })
  .exec();
};

module.exports = mongoose.model('PowerRoute', powerRouteSchema);