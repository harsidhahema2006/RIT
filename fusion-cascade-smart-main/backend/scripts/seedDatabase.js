#!/usr/bin/env node

const mongoose = require('mongoose');
const Location = require('../models/Location');
const logger = require('../utils/logger');
require('dotenv').config();

// Sample location data for New York City area
const sampleLocations = [
  // BESS Locations
  {
    id: 'bess-main',
    name: 'Manhattan BESS Central',
    type: 'bess',
    latitude: 40.7589,
    longitude: -73.9851,
    currentLoad: 45,
    predictedLoad: 52,
    capacity: 500,
    efficiency: 96,
    metadata: {
      batteryCapacity: 500,
      chargeLevel: 45,
      connectedTo: ['substation-a', 'substation-b'],
      powerRoutes: [
        { to: 'substation-a', distance: 2.1, efficiency: 98 },
        { to: 'substation-b', distance: 3.4, efficiency: 97 }
      ]
    }
  },
  {
    id: 'bess-brooklyn',
    name: 'Brooklyn BESS Hub',
    type: 'bess',
    latitude: 40.6782,
    longitude: -73.9442,
    currentLoad: 62,
    predictedLoad: 58,
    capacity: 400,
    efficiency: 95,
    metadata: {
      batteryCapacity: 400,
      chargeLevel: 62,
      connectedTo: ['substation-b', 'factory-1'],
      powerRoutes: [
        { to: 'substation-b', distance: 1.8, efficiency: 98 },
        { to: 'factory-1', distance: 0.9, efficiency: 99 }
      ]
    }
  },
  
  // Substation Locations
  {
    id: 'substation-a',
    name: 'Manhattan Substation A',
    type: 'substation',
    latitude: 40.7505,
    longitude: -73.9934,
    currentLoad: 78,
    predictedLoad: 82,
    capacity: 300,
    efficiency: 94,
    metadata: {
      voltage: 138000,
      transformerCapacity: 300,
      connectedTo: ['bess-main', 'residential-1', 'industry-1'],
      powerRoutes: [
        { to: 'residential-1', distance: 1.2, efficiency: 96 },
        { to: 'industry-1', distance: 0.7, efficiency: 97 }
      ]
    }
  },
  {
    id: 'substation-b',
    name: 'Brooklyn Substation B',
    type: 'substation',
    latitude: 40.6892,
    longitude: -73.9442,
    currentLoad: 88,
    predictedLoad: 85,
    capacity: 250,
    efficiency: 93,
    metadata: {
      voltage: 138000,
      transformerCapacity: 250,
      connectedTo: ['bess-main', 'bess-brooklyn', 'residential-2', 'factory-1'],
      powerRoutes: [
        { to: 'residential-2', distance: 2.1, efficiency: 95 },
        { to: 'factory-1', distance: 1.5, efficiency: 96 }
      ]
    }
  },
  
  // Residential Locations
  {
    id: 'residential-1',
    name: 'Upper East Side Residential',
    type: 'house',
    latitude: 40.7736,
    longitude: -73.9566,
    currentLoad: 34,
    predictedLoad: 42,
    capacity: 100,
    efficiency: 92,
    metadata: {
      peakDemandTime: '18:00-22:00',
      averageConsumption: 38,
      connectedTo: ['substation-a']
    }
  },
  {
    id: 'residential-2',
    name: 'Queens Residential Zone',
    type: 'house',
    latitude: 40.7282,
    longitude: -73.7949,
    currentLoad: 41,
    predictedLoad: 48,
    capacity: 120,
    efficiency: 91,
    metadata: {
      peakDemandTime: '17:30-21:30',
      averageConsumption: 44,
      connectedTo: ['substation-b']
    }
  },
  {
    id: 'residential-3',
    name: 'Brooklyn Heights Residential',
    type: 'house',
    latitude: 40.6962,
    longitude: -73.9961,
    currentLoad: 29,
    predictedLoad: 35,
    capacity: 90,
    efficiency: 93,
    metadata: {
      peakDemandTime: '18:30-22:00',
      averageConsumption: 32,
      connectedTo: ['substation-b']
    }
  },
  
  // Factory Locations
  {
    id: 'factory-1',
    name: 'Brooklyn Manufacturing',
    type: 'factory',
    latitude: 40.6643,
    longitude: -73.9442,
    currentLoad: 72,
    predictedLoad: 68,
    capacity: 200,
    efficiency: 89,
    metadata: {
      peakDemandTime: '08:00-17:00',
      averageConsumption: 70,
      connectedTo: ['bess-brooklyn', 'substation-b']
    }
  },
  {
    id: 'factory-2',
    name: 'Queens Industrial Park',
    type: 'factory',
    latitude: 40.7505,
    longitude: -73.8370,
    currentLoad: 65,
    predictedLoad: 71,
    capacity: 180,
    efficiency: 88,
    metadata: {
      peakDemandTime: '07:30-16:30',
      averageConsumption: 68,
      connectedTo: ['substation-b']
    }
  },
  
  // Industry Locations
  {
    id: 'industry-1',
    name: 'Manhattan Data Center',
    type: 'industry',
    latitude: 40.7505,
    longitude: -74.0087,
    currentLoad: 89,
    predictedLoad: 91,
    capacity: 150,
    efficiency: 96,
    metadata: {
      peakDemandTime: '24/7',
      averageConsumption: 87,
      connectedTo: ['substation-a']
    }
  },
  {
    id: 'industry-2',
    name: 'Brooklyn Processing Plant',
    type: 'industry',
    latitude: 40.6413,
    longitude: -74.0187,
    currentLoad: 76,
    predictedLoad: 79,
    capacity: 220,
    efficiency: 91,
    metadata: {
      peakDemandTime: '06:00-22:00',
      averageConsumption: 78,
      connectedTo: ['substation-b']
    }
  },
  
  // Additional locations for comprehensive testing
  {
    id: 'residential-4',
    name: 'Midtown Residential Complex',
    type: 'house',
    latitude: 40.7549,
    longitude: -73.9840,
    currentLoad: 52,
    predictedLoad: 58,
    capacity: 110,
    efficiency: 90,
    metadata: {
      peakDemandTime: '19:00-23:00',
      averageConsumption: 55,
      connectedTo: ['substation-a']
    }
  },
  {
    id: 'factory-3',
    name: 'Staten Island Manufacturing',
    type: 'factory',
    latitude: 40.5795,
    longitude: -74.1502,
    currentLoad: 43,
    predictedLoad: 47,
    capacity: 160,
    efficiency: 87,
    metadata: {
      peakDemandTime: '09:00-18:00',
      averageConsumption: 45,
      connectedTo: ['substation-b']
    }
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info('Connected to MongoDB for seeding');
    
    // Clear existing locations
    const deleteResult = await Location.deleteMany({});
    logger.info(`Cleared ${deleteResult.deletedCount} existing locations`);
    
    // Insert sample locations
    const locations = [];
    
    for (const locationData of sampleLocations) {
      const location = new Location(locationData);
      
      // Generate some historical data
      const historyCount = Math.floor(Math.random() * 20) + 10; // 10-30 entries
      const now = new Date();
      
      for (let i = historyCount; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - (i * 30 * 60 * 1000)); // 30 min intervals
        const baseLoad = locationData.currentLoad;
        const variation = (Math.random() - 0.5) * 20; // ±10% variation
        const load = Math.max(0, Math.min(100, baseLoad + variation));
        const prediction = Math.max(0, Math.min(100, load + (Math.random() - 0.5) * 10));
        
        location.loadHistory.push({
          timestamp,
          load,
          prediction
        });
      }
      
      locations.push(location);
    }
    
    // Save all locations
    const savedLocations = await Location.insertMany(locations);
    logger.info(`Successfully seeded ${savedLocations.length} locations`);
    
    // Log summary statistics
    const stats = await generateSeedingStats();
    logger.info('Seeding statistics:', stats);
    
    // Verify data integrity
    await verifyDataIntegrity();
    
    logger.info('Database seeding completed successfully');
    
  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    logger.info('Database connection closed');
  }
}

async function generateSeedingStats() {
  try {
    const totalLocations = await Location.countDocuments();
    
    const typeStats = await Location.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgLoad: { $avg: '$currentLoad' },
          avgCapacity: { $avg: '$capacity' }
        }
      }
    ]);
    
    const statusStats = await Location.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const systemMetrics = await Location.aggregate([
      {
        $group: {
          _id: null,
          totalCapacity: { $sum: '$capacity' },
          totalLoad: { $sum: '$currentLoad' },
          avgEfficiency: { $avg: '$efficiency' },
          avgSeverityScore: { $avg: '$severityScore' }
        }
      }
    ]);
    
    return {
      totalLocations,
      typeDistribution: typeStats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          avgLoad: Math.round(stat.avgLoad * 100) / 100,
          avgCapacity: Math.round(stat.avgCapacity * 100) / 100
        };
        return acc;
      }, {}),
      statusDistribution: statusStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      systemMetrics: systemMetrics[0] ? {
        totalCapacity: systemMetrics[0].totalCapacity,
        totalLoad: Math.round(systemMetrics[0].totalLoad * 100) / 100,
        utilization: Math.round((systemMetrics[0].totalLoad / systemMetrics[0].totalCapacity) * 10000) / 100,
        avgEfficiency: Math.round(systemMetrics[0].avgEfficiency * 100) / 100,
        avgSeverityScore: Math.round(systemMetrics[0].avgSeverityScore * 100) / 100
      } : null
    };
  } catch (error) {
    logger.error('Error generating seeding stats:', error);
    return {};
  }
}

async function verifyDataIntegrity() {
  try {
    // Check for duplicate IDs
    const duplicates = await Location.aggregate([
      {
        $group: {
          _id: '$id',
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    
    if (duplicates.length > 0) {
      throw new Error(`Found duplicate location IDs: ${duplicates.map(d => d._id).join(', ')}`);
    }
    
    // Check for invalid coordinates
    const invalidCoords = await Location.find({
      $or: [
        { latitude: { $lt: -90, $gt: 90 } },
        { longitude: { $lt: -180, $gt: 180 } }
      ]
    });
    
    if (invalidCoords.length > 0) {
      throw new Error(`Found locations with invalid coordinates: ${invalidCoords.map(l => l.id).join(', ')}`);
    }
    
    // Check for invalid load values
    const invalidLoads = await Location.find({
      $or: [
        { currentLoad: { $lt: 0, $gt: 100 } },
        { predictedLoad: { $lt: 0, $gt: 100 } }
      ]
    });
    
    if (invalidLoads.length > 0) {
      throw new Error(`Found locations with invalid load values: ${invalidLoads.map(l => l.id).join(', ')}`);
    }
    
    // Verify status calculations
    const locations = await Location.find({});
    for (const location of locations) {
      const expectedStatus = Location.calculateStatus(location.currentLoad);
      if (location.status !== expectedStatus) {
        logger.warn(`Status mismatch for ${location.id}: expected ${expectedStatus}, got ${location.status}`);
      }
      
      const expectedSeverity = Location.calculateSeverityScore(location.currentLoad, location.predictedLoad);
      if (Math.abs(location.severityScore - expectedSeverity) > 0.1) {
        logger.warn(`Severity score mismatch for ${location.id}: expected ${expectedSeverity}, got ${location.severityScore}`);
      }
    }
    
    logger.info('Data integrity verification completed successfully');
    
  } catch (error) {
    logger.error('Data integrity verification failed:', error);
    throw error;
  }
}

// Add command line options
const args = process.argv.slice(2);
const options = {
  force: args.includes('--force'),
  verbose: args.includes('--verbose'),
  skipVerification: args.includes('--skip-verification')
};

if (options.verbose) {
  logger.level = 'debug';
}

// Confirmation prompt for production
if (process.env.NODE_ENV === 'production' && !options.force) {
  console.log('WARNING: You are about to seed the production database!');
  console.log('This will DELETE all existing location data.');
  console.log('Use --force flag to proceed without this warning.');
  process.exit(1);
}

// Run seeding
if (require.main === module) {
  logger.info('Starting database seeding...');
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Database: ${process.env.MONGODB_URI}`);
  
  seedDatabase()
    .then(() => {
      logger.info('Seeding process completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding process failed:', error);
      process.exit(1);
    });
}

module.exports = {
  seedDatabase,
  sampleLocations,
  generateSeedingStats,
  verifyDataIntegrity
};