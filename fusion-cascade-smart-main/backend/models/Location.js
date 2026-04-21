const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['house', 'factory', 'industry', 'substation', 'bess'],
    index: true
  },
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  currentLoad: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  predictedLoad: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['normal', 'warning', 'critical'],
    default: 'normal',
    index: true
  },
  severityScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0,
    index: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 0,
    default: 100
  },
  efficiency: {
    type: Number,
    min: 0,
    max: 100,
    default: 95
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Historical data for ML predictions
  loadHistory: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    load: {
      type: Number,
      min: 0,
      max: 100
    },
    prediction: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  // Metadata for different location types
  metadata: {
    // For BESS
    batteryCapacity: Number,
    chargeLevel: Number,
    
    // For substations
    voltage: Number,
    transformerCapacity: Number,
    
    // For residential/industrial
    peakDemandTime: String,
    averageConsumption: Number,
    
    // Connection information
    connectedTo: [String], // Array of location IDs
    powerRoutes: [{
      to: String,
      distance: Number,
      efficiency: Number
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
locationSchema.index({ type: 1, status: 1 });
locationSchema.index({ severityScore: -1 });
locationSchema.index({ 'metadata.connectedTo': 1 });
locationSchema.index({ lastUpdated: -1 });

// Virtual for getting load percentage
locationSchema.virtual('loadPercentage').get(function() {
  return Math.round((this.currentLoad / this.capacity) * 100);
});

// Virtual for getting prediction accuracy
locationSchema.virtual('predictionAccuracy').get(function() {
  if (this.loadHistory.length < 2) return null;
  
  const recent = this.loadHistory.slice(-10);
  let totalError = 0;
  let count = 0;
  
  for (let i = 1; i < recent.length; i++) {
    const actual = recent[i].load;
    const predicted = recent[i-1].prediction;
    totalError += Math.abs(actual - predicted);
    count++;
  }
  
  return count > 0 ? Math.max(0, 100 - (totalError / count)) : null;
});

// Static method to calculate status based on load
locationSchema.statics.calculateStatus = function(currentLoad) {
  if (currentLoad <= 65) return 'normal';
  if (currentLoad <= 85) return 'warning';
  return 'critical';
};

// Static method to calculate severity score
locationSchema.statics.calculateSeverityScore = function(currentLoad, predictedLoad) {
  return (0.6 * currentLoad) + (0.4 * predictedLoad);
};

// Instance method to update load and recalculate derived fields
locationSchema.methods.updateLoad = function(newLoad, newPrediction = null) {
  this.currentLoad = Math.max(0, Math.min(100, newLoad));
  
  if (newPrediction !== null) {
    this.predictedLoad = Math.max(0, Math.min(100, newPrediction));
  }
  
  // Update status
  this.status = this.constructor.calculateStatus(this.currentLoad);
  
  // Update severity score
  this.severityScore = this.constructor.calculateSeverityScore(this.currentLoad, this.predictedLoad);
  
  // Add to history (keep last 100 entries)
  this.loadHistory.push({
    timestamp: new Date(),
    load: this.currentLoad,
    prediction: this.predictedLoad
  });
  
  if (this.loadHistory.length > 100) {
    this.loadHistory = this.loadHistory.slice(-100);
  }
  
  this.lastUpdated = new Date();
  
  return this;
};

// Instance method to get power routing information
locationSchema.methods.getPowerRoutes = function() {
  return this.metadata.powerRoutes || [];
};

// Instance method to check if location is BESS
locationSchema.methods.isBESS = function() {
  return this.type === 'bess';
};

// Instance method to get connected locations
locationSchema.methods.getConnectedLocations = function() {
  return this.metadata.connectedTo || [];
};

// Pre-save middleware to ensure data consistency
locationSchema.pre('save', function(next) {
  // Ensure status and severity score are calculated
  this.status = this.constructor.calculateStatus(this.currentLoad);
  this.severityScore = this.constructor.calculateSeverityScore(this.currentLoad, this.predictedLoad);
  this.lastUpdated = new Date();
  
  next();
});

// Static method to find most critical location
locationSchema.statics.findMostCritical = function() {
  return this.findOne().sort({ severityScore: -1 });
};

// Static method to find locations by status
locationSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ severityScore: -1 });
};

// Static method to find BESS locations
locationSchema.statics.findBESS = function() {
  return this.find({ type: 'bess' });
};

module.exports = mongoose.model('Location', locationSchema);