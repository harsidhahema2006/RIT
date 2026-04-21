const logger = require('../utils/logger');

class SocketService {
  constructor(io) {
    this.io = io;
    this.connectedClients = new Map();
    
    // Setup connection handling
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    logger.info(`Client connected: ${socket.id}`);
    
    // Store client info
    this.connectedClients.set(socket.id, {
      id: socket.id,
      connectedAt: new Date(),
      subscriptions: new Set()
    });

    // Handle client subscriptions
    socket.on('subscribe', (data) => {
      this.handleSubscription(socket, data);
    });

    socket.on('unsubscribe', (data) => {
      this.handleUnsubscription(socket, data);
    });

    // Handle location-specific requests
    socket.on('requestLocationData', async (locationId) => {
      try {
        const Location = require('../models/Location');
        const location = await Location.findOne({ id: locationId });
        
        if (location) {
          socket.emit('locationData', {
            locationId,
            data: location,
            timestamp: new Date().toISOString()
          });
        } else {
          socket.emit('error', {
            message: 'Location not found',
            locationId
          });
        }
      } catch (error) {
        logger.error('Error handling location data request:', error);
        socket.emit('error', {
          message: 'Failed to fetch location data',
          locationId
        });
      }
    });

    // Handle system stats requests
    socket.on('requestSystemStats', async () => {
      try {
        const stats = await this.getSystemStats();
        socket.emit('systemStats', stats);
      } catch (error) {
        logger.error('Error handling system stats request:', error);
        socket.emit('error', {
          message: 'Failed to fetch system stats'
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
      this.connectedClients.delete(socket.id);
    });

    // Send initial system state
    this.sendInitialState(socket);
  }

  handleSubscription(socket, data) {
    const client = this.connectedClients.get(socket.id);
    if (client && data.type) {
      client.subscriptions.add(data.type);
      socket.join(data.type);
      
      logger.debug(`Client ${socket.id} subscribed to ${data.type}`);
      
      // Send confirmation
      socket.emit('subscribed', {
        type: data.type,
        timestamp: new Date().toISOString()
      });
    }
  }

  handleUnsubscription(socket, data) {
    const client = this.connectedClients.get(socket.id);
    if (client && data.type) {
      client.subscriptions.delete(data.type);
      socket.leave(data.type);
      
      logger.debug(`Client ${socket.id} unsubscribed from ${data.type}`);
      
      // Send confirmation
      socket.emit('unsubscribed', {
        type: data.type,
        timestamp: new Date().toISOString()
      });
    }
  }

  async sendInitialState(socket) {
    try {
      const Location = require('../models/Location');
      
      // Send current system overview
      const locations = await Location.find({})
        .select('-loadHistory')
        .lean();
      
      const systemStats = await this.getSystemStats();
      
      socket.emit('initialState', {
        locations,
        systemStats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Error sending initial state:', error);
    }
  }

  // Emit load update to all connected clients
  emitLoadUpdate(locationData) {
    this.io.emit('loadUpdate', {
      type: 'loadUpdate',
      data: locationData,
      timestamp: new Date().toISOString()
    });
    
    // Also emit to location-specific room
    this.io.to(`location-${locationData.locationId}`).emit('locationUpdate', {
      type: 'locationUpdate',
      data: locationData,
      timestamp: new Date().toISOString()
    });
  }

  // Emit status change update
  emitStatusUpdate(location) {
    const updateData = {
      locationId: location.id,
      name: location.name,
      type: location.type,
      status: location.status,
      currentLoad: location.currentLoad,
      severityScore: location.severityScore,
      timestamp: location.lastUpdated
    };

    this.io.emit('statusUpdate', {
      type: 'statusUpdate',
      data: updateData,
      timestamp: new Date().toISOString()
    });

    // Emit to subscribers of status updates
    this.io.to('statusUpdates').emit('statusChange', updateData);
    
    logger.debug(`Emitted status update for ${location.name}: ${location.status}`);
  }

  // Emit critical zone alert
  emitCriticalUpdate(location) {
    const criticalData = {
      locationId: location.id,
      name: location.name,
      type: location.type,
      severityScore: location.severityScore,
      currentLoad: location.currentLoad,
      status: location.status,
      message: `Critical overload detected at ${location.name}`,
      timestamp: new Date().toISOString()
    };

    // Emit to all clients (high priority)
    this.io.emit('criticalUpdate', {
      type: 'criticalAlert',
      data: criticalData,
      priority: 'high',
      timestamp: new Date().toISOString()
    });

    // Emit to critical alerts subscribers
    this.io.to('criticalAlerts').emit('criticalAlert', criticalData);
    
    logger.warn(`Emitted critical alert for ${location.name} (severity: ${location.severityScore})`);
  }

  // Emit system-wide statistics update
  emitSystemUpdate(systemStats) {
    this.io.emit('systemUpdate', {
      type: 'systemUpdate',
      data: systemStats,
      timestamp: new Date().toISOString()
    });

    // Emit to system stats subscribers
    this.io.to('systemStats').emit('systemStatsUpdate', systemStats);
  }

  // Emit optimization results
  emitOptimizationUpdate(optimization) {
    this.io.emit('optimizationUpdate', {
      type: 'optimizationUpdate',
      data: optimization,
      timestamp: new Date().toISOString()
    });

    this.io.to('optimization').emit('optimizationResult', optimization);
    
    logger.info(`Emitted optimization update: ${optimization.efficiency}% efficiency`);
  }

  // Emit performance metrics
  emitPerformanceUpdate(performanceStats) {
    this.io.to('performance').emit('performanceUpdate', {
      type: 'performanceUpdate',
      data: performanceStats,
      timestamp: new Date().toISOString()
    });
  }

  // Emit AI decision updates
  emitAIDecision(decision) {
    this.io.emit('aiDecision', {
      type: 'aiDecision',
      data: decision,
      timestamp: new Date().toISOString()
    });

    this.io.to('aiDecisions').emit('newDecision', decision);
    
    logger.debug(`Emitted AI decision: ${decision.message}`);
  }

  // Emit power routing updates
  emitRoutingUpdate(routingData) {
    this.io.emit('routingUpdate', {
      type: 'routingUpdate',
      data: routingData,
      timestamp: new Date().toISOString()
    });

    this.io.to('routing').emit('routeUpdate', routingData);
  }

  // Emit prediction updates
  emitPredictionUpdate(predictionData) {
    this.io.to('predictions').emit('predictionUpdate', {
      type: 'predictionUpdate',
      data: predictionData,
      timestamp: new Date().toISOString()
    });
  }

  // Broadcast custom message to all clients
  broadcast(event, data) {
    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // Send message to specific client
  sendToClient(socketId, event, data) {
    this.io.to(socketId).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // Send message to clients in a specific room
  sendToRoom(room, event, data) {
    this.io.to(room).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // Get system statistics
  async getSystemStats() {
    try {
      const Location = require('../models/Location');
      
      const locations = await Location.find({}).lean();
      
      const stats = {
        totalLocations: locations.length,
        connectedClients: this.connectedClients.size,
        averageLoad: locations.reduce((sum, l) => sum + l.currentLoad, 0) / locations.length,
        statusDistribution: {
          critical: locations.filter(l => l.status === 'critical').length,
          warning: locations.filter(l => l.status === 'warning').length,
          normal: locations.filter(l => l.status === 'normal').length
        },
        typeDistribution: {
          bess: locations.filter(l => l.type === 'bess').length,
          substation: locations.filter(l => l.type === 'substation').length,
          factory: locations.filter(l => l.type === 'factory').length,
          industry: locations.filter(l => l.type === 'industry').length,
          house: locations.filter(l => l.type === 'house').length
        },
        systemHealth: this.calculateSystemHealth(locations),
        timestamp: new Date().toISOString()
      };
      
      return stats;
    } catch (error) {
      logger.error('Error calculating system stats:', error);
      return null;
    }
  }

  calculateSystemHealth(locations) {
    const totalLoad = locations.reduce((sum, l) => sum + l.currentLoad, 0);
    const totalCapacity = locations.reduce((sum, l) => sum + l.capacity, 0);
    const utilization = (totalLoad / totalCapacity) * 100;
    
    const criticalCount = locations.filter(l => l.status === 'critical').length;
    const warningCount = locations.filter(l => l.status === 'warning').length;
    
    let healthScore = 100;
    
    // Penalize for critical and warning locations
    healthScore -= (criticalCount * 20);
    healthScore -= (warningCount * 10);
    
    // Penalize for high utilization
    if (utilization > 85) {
      healthScore -= (utilization - 85) * 2;
    }
    
    return {
      score: Math.max(0, Math.min(100, healthScore)),
      utilization: Math.round(utilization * 100) / 100,
      status: healthScore > 80 ? 'excellent' : 
              healthScore > 60 ? 'good' : 
              healthScore > 40 ? 'fair' : 'poor'
    };
  }

  // Get connection statistics
  getConnectionStats() {
    const clients = Array.from(this.connectedClients.values());
    
    return {
      totalConnections: clients.length,
      averageConnectionTime: clients.reduce((sum, client) => {
        return sum + (Date.now() - client.connectedAt.getTime());
      }, 0) / clients.length,
      subscriptionStats: clients.reduce((stats, client) => {
        client.subscriptions.forEach(sub => {
          stats[sub] = (stats[sub] || 0) + 1;
        });
        return stats;
      }, {})
    };
  }
}

module.exports = SocketService;