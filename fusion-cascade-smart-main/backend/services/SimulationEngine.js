const cron = require('node-cron');
const logger = require('../utils/logger');

class SimulationEngine {
  constructor(socketService) {
    this.socketService = socketService;
    this.isRunning = false;
    this.intervalId = null;
    this.updateInterval = parseInt(process.env.SIMULATION_INTERVAL) || 5000;
    this.loadVariance = parseFloat(process.env.LOAD_UPDATE_VARIANCE) || 0.15;
    this.stats = {
      cyclesCompleted: 0,
      lastCycleTime: null,
      averageCycleTime: 0,
      errors: 0
    };
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('Starting Smart Grid Simulation Engine');

    // Run first cycle after a short delay (let DB connect)
    setTimeout(() => this.runCycle(), 3000);

    this.intervalId = setInterval(() => this.runCycle(), this.updateInterval);

    // Hourly optimization
    cron.schedule('0 * * * *', () => this.runOptimizationCycle());

    logger.info(`Simulation engine started — interval: ${this.updateInterval}ms`);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('Simulation engine stopped');
  }

  async runCycle() {
    const cycleStart = Date.now();
    try {
      const Location = require('../models/Location');
      const locations = await Location.find({});
      if (locations.length === 0) return;

      const updates = [];

      for (const location of locations) {
        const newLoad = this.simulateLoadChange(location);
        const newPrediction = this.predictLoad(location, newLoad);

        location.currentLoad = newLoad;
        location.predictedLoad = newPrediction;
        location.status = Location.calculateStatus(newLoad);
        location.severityScore = Location.calculateSeverityScore(newLoad, newPrediction);
        location.lastUpdated = new Date();

        // Keep history trimmed
        location.loadHistory.push({
          timestamp: new Date(),
          load: newLoad,
          prediction: newPrediction
        });
        if (location.loadHistory.length > 100) {
          location.loadHistory = location.loadHistory.slice(-100);
        }

        updates.push(location.save());
      }

      await Promise.all(updates);

      // Emit real-time updates
      const allUpdated = await Location.find({}).select('-loadHistory').lean();
      this.socketService.emitSystemUpdate(this.buildSystemStats(allUpdated));

      // Emit per-location load updates
      for (const loc of allUpdated) {
        this.socketService.emitLoadUpdate({
          locationId: loc.id,
          currentLoad: loc.currentLoad,
          predictedLoad: loc.predictedLoad,
          status: loc.status,
          severityScore: loc.severityScore,
          timestamp: loc.lastUpdated
        });

        if (loc.status === 'critical') {
          this.socketService.emitCriticalUpdate(loc);
        }
      }

      const cycleTime = Date.now() - cycleStart;
      this.updateStats(cycleTime);
      logger.debug(`Simulation cycle done in ${cycleTime}ms`);

    } catch (error) {
      this.stats.errors++;
      logger.error('Simulation cycle error:', error.message);
    }
  }

  simulateLoadChange(location) {
    const hour = new Date().getHours();
    const dow = new Date().getDay();
    let base = location.currentLoad;
    let multiplier = 1;

    switch (location.type) {
      case 'house':
        if ((hour >= 7 && hour <= 9) || (hour >= 18 && hour <= 22)) multiplier = 1.25;
        else if (hour >= 23 || hour <= 5) multiplier = 0.6;
        break;
      case 'factory':
        multiplier = (dow >= 1 && dow <= 5 && hour >= 8 && hour <= 17) ? 1.35 : 0.4;
        break;
      case 'industry':
        multiplier = 0.9 + Math.sin(hour * Math.PI / 12) * 0.2;
        break;
      case 'substation':
        multiplier = 0.8 + Math.sin((hour - 6) * Math.PI / 12) * 0.3;
        break;
      case 'bess':
        multiplier = (hour >= 10 && hour <= 16) ? 0.7 : (hour >= 18 && hour <= 22) ? 1.4 : 1.0;
        break;
    }

    const target = base * multiplier;
    const noise = (Math.random() - 0.5) * 2 * this.loadVariance * 100;
    const maxChange = 5;
    const change = Math.max(-maxChange, Math.min(maxChange, target + noise - base));
    return Math.max(0, Math.min(100, base + change));
  }

  predictLoad(location, currentLoad) {
    const hour = new Date().getHours();
    const history = location.loadHistory || [];

    if (history.length >= 3) {
      const recent = history.slice(-6).map(h => h.load);
      const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
      const trend = recent.length > 1 ? recent[recent.length - 1] - recent[0] : 0;
      return Math.max(0, Math.min(100, avg + trend * 0.3 + (Math.random() - 0.5) * 5));
    }

    // Time-based fallback
    const patterns = {
      house: [0.6,0.5,0.5,0.5,0.6,0.7,0.9,1.2,1.1,0.8,0.7,0.7,0.8,0.8,0.8,0.9,1.0,1.3,1.4,1.3,1.2,1.0,0.8,0.7],
      factory: [0.3,0.3,0.3,0.3,0.4,0.5,0.7,1.0,1.3,1.4,1.4,1.3,1.2,1.3,1.4,1.4,1.3,1.0,0.7,0.5,0.4,0.3,0.3,0.3],
      industry: [0.9,0.8,0.8,0.8,0.9,1.0,1.1,1.2,1.3,1.3,1.2,1.2,1.2,1.2,1.3,1.3,1.2,1.1,1.0,1.0,1.0,1.0,0.9,0.9],
      substation: [0.7,0.6,0.6,0.6,0.7,0.8,1.0,1.2,1.1,1.0,0.9,0.9,1.0,1.0,1.0,1.1,1.2,1.4,1.5,1.4,1.3,1.1,0.9,0.8],
      bess: [1.2,1.1,1.0,1.0,1.0,1.0,0.9,0.8,0.7,0.6,0.5,0.5,0.5,0.5,0.6,0.7,0.8,1.0,1.3,1.4,1.4,1.3,1.3,1.2]
    };
    const m = (patterns[location.type] || patterns.house)[hour];
    return Math.max(0, Math.min(100, currentLoad * m));
  }

  buildSystemStats(locations) {
    const total = locations.length || 1;
    return {
      totalLocations: total,
      averageLoad: locations.reduce((s, l) => s + l.currentLoad, 0) / total,
      criticalCount: locations.filter(l => l.status === 'critical').length,
      warningCount: locations.filter(l => l.status === 'warning').length,
      normalCount: locations.filter(l => l.status === 'normal').length,
      bessCount: locations.filter(l => l.type === 'bess').length,
      timestamp: new Date().toISOString()
    };
  }

  async runOptimizationCycle() {
    try {
      logger.info('Running hourly optimization cycle');
      const Location = require('../models/Location');
      const locations = await Location.find({}).lean();
      const OptimizationService = require('./OptimizationService');
      const optService = new OptimizationService();
      const result = await optService.optimizeDistribution(locations);
      this.socketService.emitOptimizationUpdate(result);
    } catch (error) {
      logger.error('Optimization cycle error:', error.message);
    }
  }

  updateStats(cycleTime) {
    this.stats.cyclesCompleted++;
    this.stats.lastCycleTime = cycleTime;
    this.stats.averageCycleTime = this.stats.averageCycleTime === 0
      ? cycleTime
      : this.stats.averageCycleTime * 0.9 + cycleTime * 0.1;
  }

  getStats() {
    return { ...this.stats, isRunning: this.isRunning, updateInterval: this.updateInterval };
  }
}

module.exports = SimulationEngine;
