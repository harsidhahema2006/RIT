const axios = require('axios');
const logger = require('../utils/logger');

class PredictionService {
  constructor() {
    this.pythonServiceUrl = process.env.PYTHON_ML_SERVICE_URL || 'http://localhost:8000';
    this.fallbackEnabled = true;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async predictLoad(location) {
    try {
      // Check cache first
      const cacheKey = `${location.id}-${Math.floor(Date.now() / this.cacheTimeout)}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // Try Python ML service first
      let prediction;
      try {
        prediction = await this.callPythonMLService(location);
      } catch (error) {
        logger.warn(`Python ML service unavailable for ${location.id}, using fallback`);
        prediction = await this.fallbackPrediction(location);
      }

      // Cache the result
      this.cache.set(cacheKey, prediction);
      
      // Clean old cache entries
      this.cleanCache();

      return prediction;
    } catch (error) {
      logger.error(`Error predicting load for ${location.id}:`, error);
      return location.currentLoad; // Return current load as fallback
    }
  }

  async callPythonMLService(location) {
    const payload = {
      location_id: location.id,
      location_type: location.type,
      current_load: location.currentLoad,
      historical_data: this.prepareHistoricalData(location),
      metadata: {
        capacity: location.capacity,
        efficiency: location.efficiency,
        time_of_day: new Date().getHours(),
        day_of_week: new Date().getDay(),
        timestamp: new Date().toISOString()
      }
    };

    const response = await axios.post(`${this.pythonServiceUrl}/predict`, payload, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data && typeof response.data.predicted_load === 'number') {
      return Math.max(0, Math.min(100, response.data.predicted_load));
    } else {
      throw new Error('Invalid response from Python ML service');
    }
  }

  prepareHistoricalData(location) {
    if (!location.loadHistory || location.loadHistory.length === 0) {
      return [];
    }

    // Get last 24 hours of data
    const cutoffTime = new Date(Date.now() - (24 * 60 * 60 * 1000));
    
    return location.loadHistory
      .filter(entry => new Date(entry.timestamp) >= cutoffTime)
      .map(entry => ({
        timestamp: entry.timestamp,
        load: entry.load,
        prediction: entry.prediction
      }))
      .slice(-48); // Last 48 data points (assuming 30-min intervals)
  }

  async fallbackPrediction(location) {
    // Implement multiple fallback prediction methods
    const methods = [
      () => this.movingAveragePrediction(location),
      () => this.timeBasedPrediction(location),
      () => this.trendAnalysisPrediction(location),
      () => this.seasonalPrediction(location)
    ];

    // Try each method and return the first successful one
    for (const method of methods) {
      try {
        const prediction = await method();
        if (typeof prediction === 'number' && !isNaN(prediction)) {
          return Math.max(0, Math.min(100, prediction));
        }
      } catch (error) {
        logger.debug(`Fallback method failed: ${error.message}`);
      }
    }

    // Ultimate fallback: return current load with small random variation
    return Math.max(0, Math.min(100, location.currentLoad + (Math.random() - 0.5) * 10));
  }

  movingAveragePrediction(location) {
    if (!location.loadHistory || location.loadHistory.length < 3) {
      return location.currentLoad;
    }

    // Simple moving average of last N data points
    const windowSize = Math.min(12, location.loadHistory.length);
    const recentData = location.loadHistory.slice(-windowSize);
    
    const average = recentData.reduce((sum, entry) => sum + entry.load, 0) / recentData.length;
    
    // Apply time-based adjustment
    const timeAdjustment = this.getTimeBasedAdjustment(location.type);
    
    return average * timeAdjustment;
  }

  timeBasedPrediction(location) {
    const currentHour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    const currentLoad = location.currentLoad;

    // Define load patterns by location type and time
    const patterns = {
      house: {
        // Residential patterns: peaks at morning and evening
        hourlyMultipliers: [
          0.6, 0.5, 0.5, 0.5, 0.6, 0.7, 0.9, 1.2, 1.1, 0.8, 0.7, 0.7,
          0.8, 0.8, 0.8, 0.9, 1.0, 1.3, 1.4, 1.3, 1.2, 1.0, 0.8, 0.7
        ],
        weekendFactor: 0.9
      },
      factory: {
        // Industrial patterns: high during business hours
        hourlyMultipliers: [
          0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 1.0, 1.3, 1.4, 1.4, 1.3,
          1.2, 1.3, 1.4, 1.4, 1.3, 1.0, 0.7, 0.5, 0.4, 0.3, 0.3, 0.3
        ],
        weekendFactor: 0.4
      },
      industry: {
        // 24/7 operations with moderate variations
        hourlyMultipliers: [
          0.9, 0.8, 0.8, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.3, 1.2, 1.2,
          1.2, 1.2, 1.3, 1.3, 1.2, 1.1, 1.0, 1.0, 1.0, 1.0, 0.9, 0.9
        ],
        weekendFactor: 0.95
      },
      substation: {
        // Aggregate demand pattern
        hourlyMultipliers: [
          0.7, 0.6, 0.6, 0.6, 0.7, 0.8, 1.0, 1.2, 1.1, 1.0, 0.9, 0.9,
          1.0, 1.0, 1.0, 1.1, 1.2, 1.4, 1.5, 1.4, 1.3, 1.1, 0.9, 0.8
        ],
        weekendFactor: 0.85
      },
      bess: {
        // BESS charging/discharging patterns
        hourlyMultipliers: [
          1.2, 1.1, 1.0, 1.0, 1.0, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.5,
          0.5, 0.5, 0.6, 0.7, 0.8, 1.0, 1.3, 1.4, 1.4, 1.3, 1.3, 1.2
        ],
        weekendFactor: 0.9
      }
    };

    const pattern = patterns[location.type] || patterns.house;
    const hourlyMultiplier = pattern.hourlyMultipliers[currentHour];
    const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? pattern.weekendFactor : 1.0;

    return currentLoad * hourlyMultiplier * weekendMultiplier;
  }

  trendAnalysisPrediction(location) {
    if (!location.loadHistory || location.loadHistory.length < 6) {
      return location.currentLoad;
    }

    // Linear trend analysis
    const recentData = location.loadHistory.slice(-12); // Last 12 data points
    const n = recentData.length;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    recentData.forEach((entry, index) => {
      const x = index;
      const y = entry.load;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    // Calculate linear regression slope
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict next value
    const nextX = n;
    const prediction = slope * nextX + intercept;

    // Apply bounds and smoothing
    const maxChange = 15; // Maximum 15% change from current
    const smoothedPrediction = location.currentLoad + 
      Math.max(-maxChange, Math.min(maxChange, prediction - location.currentLoad));

    return smoothedPrediction;
  }

  seasonalPrediction(location) {
    const currentHour = new Date().getHours();
    const currentLoad = location.currentLoad;

    // Find similar time periods in history
    if (!location.loadHistory || location.loadHistory.length < 24) {
      return currentLoad;
    }

    const similarPeriods = location.loadHistory.filter(entry => {
      const entryHour = new Date(entry.timestamp).getHours();
      return Math.abs(entryHour - currentHour) <= 1; // Within 1 hour
    });

    if (similarPeriods.length === 0) {
      return currentLoad;
    }

    // Calculate weighted average (more recent data has higher weight)
    let weightedSum = 0;
    let totalWeight = 0;

    similarPeriods.forEach((entry, index) => {
      const weight = Math.exp(-index * 0.1); // Exponential decay
      weightedSum += entry.load * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : currentLoad;
  }

  getTimeBasedAdjustment(locationType) {
    const currentHour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    // Base adjustments by time and location type
    const adjustments = {
      house: {
        morning: (currentHour >= 6 && currentHour <= 9) ? 1.2 : 1.0,
        evening: (currentHour >= 17 && currentHour <= 22) ? 1.3 : 1.0,
        night: (currentHour >= 23 || currentHour <= 5) ? 0.6 : 1.0,
        weekend: (dayOfWeek === 0 || dayOfWeek === 6) ? 0.9 : 1.0
      },
      factory: {
        business: (currentHour >= 8 && currentHour <= 17) ? 1.4 : 0.4,
        weekend: (dayOfWeek === 0 || dayOfWeek === 6) ? 0.3 : 1.0
      },
      industry: {
        base: 1.0 + (Math.sin((currentHour - 12) * Math.PI / 12) * 0.2)
      }
    };

    const typeAdjustments = adjustments[locationType] || adjustments.house;
    
    let multiplier = 1.0;
    Object.values(typeAdjustments).forEach(adj => {
      multiplier *= adj;
    });

    return multiplier;
  }

  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      const keyTime = parseInt(key.split('-').pop()) * this.cacheTimeout;
      if (now - keyTime > this.cacheTimeout * 2) {
        this.cache.delete(key);
      }
    }
  }

  // Batch prediction for multiple locations
  async batchPredict(locations) {
    const predictions = [];
    
    // Process in chunks to avoid overwhelming the Python service
    const chunkSize = 10;
    for (let i = 0; i < locations.length; i += chunkSize) {
      const chunk = locations.slice(i, i + chunkSize);
      
      const chunkPromises = chunk.map(location => 
        this.predictLoad(location).catch(error => {
          logger.warn(`Batch prediction failed for ${location.id}:`, error.message);
          return location.currentLoad;
        })
      );
      
      const chunkResults = await Promise.all(chunkPromises);
      predictions.push(...chunkResults);
    }
    
    return predictions;
  }

  // Get prediction accuracy metrics
  async getPredictionAccuracy(locationId, hours = 24) {
    try {
      const Location = require('../models/Location');
      const location = await Location.findOne({ id: locationId });
      
      if (!location || !location.loadHistory) {
        return null;
      }

      const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
      const recentHistory = location.loadHistory.filter(entry => 
        new Date(entry.timestamp) >= cutoffTime
      );

      if (recentHistory.length < 2) {
        return null;
      }

      let totalError = 0;
      let count = 0;

      for (let i = 1; i < recentHistory.length; i++) {
        const actual = recentHistory[i].load;
        const predicted = recentHistory[i-1].prediction;
        
        if (predicted !== undefined) {
          totalError += Math.abs(actual - predicted);
          count++;
        }
      }

      const meanAbsoluteError = count > 0 ? totalError / count : 0;
      const accuracy = Math.max(0, 100 - meanAbsoluteError);

      return {
        locationId,
        accuracy: Math.round(accuracy * 100) / 100,
        meanAbsoluteError: Math.round(meanAbsoluteError * 100) / 100,
        sampleCount: count,
        timeRange: hours
      };
    } catch (error) {
      logger.error(`Error calculating prediction accuracy for ${locationId}:`, error);
      return null;
    }
  }
}

module.exports = PredictionService;