const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const logger = require('../utils/logger');

// GET /api/routes/:id - Get power routing path for location
router.get('/:id', async (req, res) => {
  try {
    const targetLocation = await Location.findOne({ id: req.params.id });
    
    if (!targetLocation) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }
    
    // Find BESS locations (power sources)
    const bessLocations = await Location.find({ type: 'bess' }).lean();
    
    if (bessLocations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No BESS locations found'
      });
    }
    
    // Find optimal BESS based on capacity and distance
    const optimalBess = findOptimalBESS(bessLocations, targetLocation);
    
    // Generate routing path
    const route = await generatePowerRoute(optimalBess, targetLocation);
    
    res.json({
      success: true,
      data: route,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting power route:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get power route',
      message: error.message
    });
  }
});

// GET /api/routes/system/overview - Get system-wide routing overview
router.get('/system/overview', async (req, res) => {
  try {
    const locations = await Location.find({}).lean();
    const bessLocations = locations.filter(l => l.type === 'bess');
    const nonBessLocations = locations.filter(l => l.type !== 'bess');
    
    const systemRoutes = [];
    
    // Generate routes for all non-BESS locations
    for (const location of nonBessLocations) {
      try {
        const optimalBess = findOptimalBESS(bessLocations, location);
        const route = await generatePowerRoute(optimalBess, location);
        systemRoutes.push(route);
      } catch (error) {
        logger.warn(`Failed to generate route for ${location.id}:`, error.message);
      }
    }
    
    // Calculate system routing metrics
    const metrics = calculateRoutingMetrics(systemRoutes);
    
    res.json({
      success: true,
      data: {
        routes: systemRoutes,
        metrics,
        totalRoutes: systemRoutes.length,
        bessCount: bessLocations.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting system routing overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system routing overview',
      message: error.message
    });
  }
});

// POST /api/routes/optimize - Optimize routing for multiple locations
router.post('/optimize', async (req, res) => {
  try {
    const { locationIds, objectives = ['minimize_distance', 'balance_load'] } = req.body;
    
    if (!Array.isArray(locationIds)) {
      return res.status(400).json({
        success: false,
        error: 'locationIds must be an array'
      });
    }
    
    const locations = await Location.find({ id: { $in: locationIds } }).lean();
    const bessLocations = await Location.find({ type: 'bess' }).lean();
    
    if (locations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No locations found'
      });
    }
    
    // Optimize routing based on objectives
    const optimizedRoutes = await optimizeRouting(locations, bessLocations, objectives);
    
    res.json({
      success: true,
      data: optimizedRoutes,
      objectives,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error optimizing routes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize routes',
      message: error.message
    });
  }
});

// GET /api/routes/network/topology - Get network topology for visualization
router.get('/network/topology', async (req, res) => {
  try {
    const locations = await Location.find({}).lean();
    
    // Build network topology
    const nodes = locations.map(location => ({
      id: location.id,
      name: location.name,
      type: location.type,
      position: {
        lat: location.latitude,
        lng: location.longitude
      },
      status: location.status,
      load: location.currentLoad,
      capacity: location.capacity || 100
    }));
    
    // Generate connections based on power routing
    const connections = await generateNetworkConnections(locations);
    
    // Calculate network statistics
    const networkStats = calculateNetworkStats(nodes, connections);
    
    res.json({
      success: true,
      data: {
        nodes,
        connections,
        stats: networkStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting network topology:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get network topology',
      message: error.message
    });
  }
});

// Helper functions

function findOptimalBESS(bessLocations, targetLocation) {
  if (bessLocations.length === 0) {
    throw new Error('No BESS locations available');
  }
  
  // Score each BESS based on multiple factors
  const scoredBess = bessLocations.map(bess => {
    // Distance factor (closer is better)
    const distance = calculateDistance(
      bess.latitude, bess.longitude,
      targetLocation.latitude, targetLocation.longitude
    );
    const distanceScore = Math.max(0, 100 - distance * 10); // Assume distance in km
    
    // Capacity factor (more available capacity is better)
    const availableCapacity = (bess.capacity || 100) - bess.currentLoad;
    const capacityScore = Math.max(0, availableCapacity);
    
    // Status factor (better status is preferred)
    const statusScore = bess.status === 'normal' ? 100 : 
                       bess.status === 'warning' ? 70 : 30;
    
    // Combined score (weighted)
    const totalScore = (distanceScore * 0.4) + (capacityScore * 0.4) + (statusScore * 0.2);
    
    return {
      ...bess,
      score: totalScore,
      distance,
      availableCapacity
    };
  });
  
  // Return BESS with highest score
  return scoredBess.reduce((best, current) => 
    current.score > best.score ? current : best
  );
}

async function generatePowerRoute(sourceBess, targetLocation) {
  try {
    // Find intermediate substations if needed
    const substations = await Location.find({ 
      type: 'substation',
      id: { $ne: targetLocation.id }
    }).lean();
    
    let route = {
      source: {
        id: sourceBess.id,
        name: sourceBess.name,
        type: sourceBess.type,
        position: {
          lat: sourceBess.latitude,
          lng: sourceBess.longitude
        },
        availableCapacity: sourceBess.availableCapacity || 0
      },
      target: {
        id: targetLocation.id,
        name: targetLocation.name,
        type: targetLocation.type,
        position: {
          lat: targetLocation.latitude,
          lng: targetLocation.longitude
        },
        currentLoad: targetLocation.currentLoad
      },
      path: [],
      metrics: {}
    };
    
    // Determine if intermediate substations are needed
    const directDistance = calculateDistance(
      sourceBess.latitude, sourceBess.longitude,
      targetLocation.latitude, targetLocation.longitude
    );
    
    if (directDistance > 5 && substations.length > 0) {
      // Find optimal intermediate substation
      const optimalSubstation = findOptimalIntermediate(
        sourceBess, targetLocation, substations
      );
      
      if (optimalSubstation) {
        route.path = [
          {
            id: sourceBess.id,
            position: { lat: sourceBess.latitude, lng: sourceBess.longitude },
            type: 'source'
          },
          {
            id: optimalSubstation.id,
            position: { lat: optimalSubstation.latitude, lng: optimalSubstation.longitude },
            type: 'intermediate'
          },
          {
            id: targetLocation.id,
            position: { lat: targetLocation.latitude, lng: targetLocation.longitude },
            type: 'target'
          }
        ];
      }
    } else {
      // Direct route
      route.path = [
        {
          id: sourceBess.id,
          position: { lat: sourceBess.latitude, lng: sourceBess.longitude },
          type: 'source'
        },
        {
          id: targetLocation.id,
          position: { lat: targetLocation.latitude, lng: targetLocation.longitude },
          type: 'target'
        }
      ];
    }
    
    // Calculate route metrics
    route.metrics = calculateRouteMetrics(route.path);
    
    return route;
  } catch (error) {
    logger.error('Error generating power route:', error);
    throw error;
  }
}

function findOptimalIntermediate(source, target, substations) {
  if (substations.length === 0) return null;
  
  const scoredSubstations = substations.map(substation => {
    // Calculate total distance through this substation
    const distanceToSub = calculateDistance(
      source.latitude, source.longitude,
      substation.latitude, substation.longitude
    );
    const distanceFromSub = calculateDistance(
      substation.latitude, substation.longitude,
      target.latitude, target.longitude
    );
    const totalDistance = distanceToSub + distanceFromSub;
    
    // Calculate direct distance for comparison
    const directDistance = calculateDistance(
      source.latitude, source.longitude,
      target.latitude, target.longitude
    );
    
    // Score based on efficiency and substation status
    const efficiencyScore = Math.max(0, 100 - ((totalDistance - directDistance) * 20));
    const statusScore = substation.status === 'normal' ? 100 : 
                       substation.status === 'warning' ? 70 : 30;
    const loadScore = Math.max(0, 100 - substation.currentLoad);
    
    const totalScore = (efficiencyScore * 0.5) + (statusScore * 0.3) + (loadScore * 0.2);
    
    return {
      ...substation,
      score: totalScore,
      totalDistance,
      efficiency: efficiencyScore
    };
  });
  
  // Return best substation if it provides meaningful benefit
  const best = scoredSubstations.reduce((best, current) => 
    current.score > best.score ? current : best
  );
  
  return best.score > 50 ? best : null;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  // Haversine formula for calculating distance between two points
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateRouteMetrics(path) {
  if (path.length < 2) {
    return {
      totalDistance: 0,
      efficiency: 100,
      powerLoss: 0,
      hops: 0
    };
  }
  
  let totalDistance = 0;
  
  // Calculate total distance
  for (let i = 0; i < path.length - 1; i++) {
    const current = path[i];
    const next = path[i + 1];
    
    const segmentDistance = calculateDistance(
      current.position.lat, current.position.lng,
      next.position.lat, next.position.lng
    );
    
    totalDistance += segmentDistance;
  }
  
  // Calculate power loss (simplified model)
  const powerLoss = Math.min(20, totalDistance * 0.5); // 0.5% loss per km, max 20%
  
  // Calculate efficiency
  const efficiency = Math.max(0, 100 - powerLoss);
  
  return {
    totalDistance: Math.round(totalDistance * 100) / 100,
    efficiency: Math.round(efficiency * 100) / 100,
    powerLoss: Math.round(powerLoss * 100) / 100,
    hops: path.length - 1
  };
}

function calculateRoutingMetrics(routes) {
  if (routes.length === 0) {
    return {
      averageDistance: 0,
      averageEfficiency: 0,
      totalPowerLoss: 0,
      routeCount: 0
    };
  }
  
  const totalDistance = routes.reduce((sum, route) => sum + route.metrics.totalDistance, 0);
  const totalEfficiency = routes.reduce((sum, route) => sum + route.metrics.efficiency, 0);
  const totalPowerLoss = routes.reduce((sum, route) => sum + route.metrics.powerLoss, 0);
  
  return {
    averageDistance: Math.round((totalDistance / routes.length) * 100) / 100,
    averageEfficiency: Math.round((totalEfficiency / routes.length) * 100) / 100,
    totalPowerLoss: Math.round(totalPowerLoss * 100) / 100,
    routeCount: routes.length,
    networkUtilization: Math.min(100, (routes.length / 20) * 100) // Assume max 20 routes
  };
}

async function optimizeRouting(locations, bessLocations, objectives) {
  try {
    const optimizedRoutes = [];
    
    // Group locations by priority
    const criticalLocations = locations.filter(l => l.status === 'critical');
    const warningLocations = locations.filter(l => l.status === 'warning');
    const normalLocations = locations.filter(l => l.status === 'normal');
    
    // Process in priority order
    const prioritizedLocations = [...criticalLocations, ...warningLocations, ...normalLocations];
    
    // Track BESS utilization
    const bessUtilization = bessLocations.map(bess => ({
      ...bess,
      allocatedLoad: 0,
      remainingCapacity: (bess.capacity || 100) - bess.currentLoad
    }));
    
    for (const location of prioritizedLocations) {
      // Find best BESS considering current allocations
      const availableBess = bessUtilization.filter(bess => bess.remainingCapacity > 0);
      
      if (availableBess.length > 0) {
        const optimalBess = findOptimalBESS(availableBess, location);
        const route = await generatePowerRoute(optimalBess, location);
        
        // Update BESS utilization
        const bessIndex = bessUtilization.findIndex(b => b.id === optimalBess.id);
        if (bessIndex !== -1) {
          const allocation = Math.min(location.currentLoad, bessUtilization[bessIndex].remainingCapacity);
          bessUtilization[bessIndex].allocatedLoad += allocation;
          bessUtilization[bessIndex].remainingCapacity -= allocation;
        }
        
        optimizedRoutes.push({
          ...route,
          priority: location.status === 'critical' ? 3 : (location.status === 'warning' ? 2 : 1),
          allocation: allocation || 0
        });
      }
    }
    
    // Calculate optimization metrics
    const metrics = calculateRoutingMetrics(optimizedRoutes);
    
    return {
      routes: optimizedRoutes,
      metrics,
      bessUtilization: bessUtilization.map(bess => ({
        id: bess.id,
        name: bess.name,
        totalCapacity: bess.capacity || 100,
        currentLoad: bess.currentLoad,
        allocatedLoad: bess.allocatedLoad,
        utilization: ((bess.currentLoad + bess.allocatedLoad) / (bess.capacity || 100)) * 100
      })),
      objectives
    };
  } catch (error) {
    logger.error('Error optimizing routing:', error);
    throw error;
  }
}

async function generateNetworkConnections(locations) {
  const connections = [];
  const bessLocations = locations.filter(l => l.type === 'bess');
  const substations = locations.filter(l => l.type === 'substation');
  const otherLocations = locations.filter(l => l.type !== 'bess' && l.type !== 'substation');
  
  // BESS to Substation connections
  for (const bess of bessLocations) {
    for (const substation of substations) {
      const distance = calculateDistance(
        bess.latitude, bess.longitude,
        substation.latitude, substation.longitude
      );
      
      if (distance <= 10) { // Within 10km
        connections.push({
          id: `${bess.id}-${substation.id}`,
          source: bess.id,
          target: substation.id,
          type: 'primary',
          distance,
          capacity: Math.min(bess.capacity || 100, substation.capacity || 100)
        });
      }
    }
  }
  
  // Substation to Load connections
  for (const substation of substations) {
    for (const location of otherLocations) {
      const distance = calculateDistance(
        substation.latitude, substation.longitude,
        location.latitude, location.longitude
      );
      
      if (distance <= 5) { // Within 5km
        connections.push({
          id: `${substation.id}-${location.id}`,
          source: substation.id,
          target: location.id,
          type: 'secondary',
          distance,
          capacity: location.capacity || 100
        });
      }
    }
  }
  
  // Direct BESS to Load connections (for nearby locations)
  for (const bess of bessLocations) {
    for (const location of otherLocations) {
      const distance = calculateDistance(
        bess.latitude, bess.longitude,
        location.latitude, location.longitude
      );
      
      if (distance <= 3) { // Within 3km for direct connection
        connections.push({
          id: `${bess.id}-${location.id}`,
          source: bess.id,
          target: location.id,
          type: 'direct',
          distance,
          capacity: Math.min(bess.capacity || 100, location.capacity || 100)
        });
      }
    }
  }
  
  return connections;
}

function calculateNetworkStats(nodes, connections) {
  const bessNodes = nodes.filter(n => n.type === 'bess');
  const substationNodes = nodes.filter(n => n.type === 'substation');
  const loadNodes = nodes.filter(n => n.type !== 'bess' && n.type !== 'substation');
  
  const totalCapacity = nodes.reduce((sum, node) => sum + node.capacity, 0);
  const totalLoad = nodes.reduce((sum, node) => sum + node.load, 0);
  
  const criticalNodes = nodes.filter(n => n.status === 'critical').length;
  const warningNodes = nodes.filter(n => n.status === 'warning').length;
  
  return {
    nodeCount: {
      total: nodes.length,
      bess: bessNodes.length,
      substations: substationNodes.length,
      loads: loadNodes.length
    },
    connectionCount: {
      total: connections.length,
      primary: connections.filter(c => c.type === 'primary').length,
      secondary: connections.filter(c => c.type === 'secondary').length,
      direct: connections.filter(c => c.type === 'direct').length
    },
    systemMetrics: {
      totalCapacity,
      totalLoad,
      utilization: (totalLoad / totalCapacity) * 100,
      criticalNodes,
      warningNodes,
      healthScore: Math.max(0, 100 - (criticalNodes * 20 + warningNodes * 10))
    },
    networkEfficiency: calculateNetworkEfficiency(connections)
  };
}

function calculateNetworkEfficiency(connections) {
  if (connections.length === 0) return 0;
  
  const avgDistance = connections.reduce((sum, conn) => sum + conn.distance, 0) / connections.length;
  const avgCapacity = connections.reduce((sum, conn) => sum + conn.capacity, 0) / connections.length;
  
  // Efficiency based on short distances and high capacity
  const distanceEfficiency = Math.max(0, 100 - (avgDistance * 10));
  const capacityEfficiency = Math.min(100, avgCapacity);
  
  return Math.round(((distanceEfficiency + capacityEfficiency) / 2) * 100) / 100;
}

module.exports = router;