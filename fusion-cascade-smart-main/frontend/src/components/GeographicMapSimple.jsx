import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';

// Mock geographic locations (same as before but without Leaflet)
const GEOGRAPHIC_LOCATIONS = [
  {
    id: 'bess-main',
    name: 'BESS Main Station',
    type: 'bess',
    coordinates: [40.7589, -73.9851],
    status: 'normal',
    load: 94,
    capacity: 100,
    voltage: 480,
    consumption: 247.3,
    severity: 2,
    description: 'Main Battery Energy Storage System',
    x: 50, y: 30 // Position on our custom map
  },
  {
    id: 'substation-a',
    name: 'Manhattan Substation A',
    type: 'substation',
    coordinates: [40.7505, -73.9934],
    status: 'warning',
    load: 88,
    capacity: 100,
    voltage: 132000,
    consumption: 156.8,
    severity: 6,
    description: 'Primary Distribution Substation',
    x: 35, y: 45
  },
  {
    id: 'substation-b',
    name: 'Brooklyn Substation B',
    type: 'substation',
    coordinates: [40.6892, -73.9442],
    status: 'critical',
    load: 95,
    capacity: 100,
    voltage: 132000,
    consumption: 198.2,
    severity: 9,
    description: 'Secondary Distribution Substation',
    x: 65, y: 70
  },
  {
    id: 'residential-1',
    name: 'Upper East Side Residential',
    type: 'residential',
    coordinates: [40.7736, -73.9566],
    status: 'normal',
    load: 45,
    capacity: 100,
    voltage: 220,
    consumption: 28.4,
    severity: 1,
    description: 'Residential District - 2,400 homes',
    x: 25, y: 25
  },
  {
    id: 'residential-2',
    name: 'Queens Residential Zone',
    type: 'residential',
    coordinates: [40.7282, -73.7949],
    status: 'warning',
    load: 72,
    capacity: 100,
    voltage: 220,
    consumption: 42.1,
    severity: 5,
    description: 'Residential District - 3,200 homes',
    x: 75, y: 35
  },
  {
    id: 'factory-1',
    name: 'Brooklyn Manufacturing',
    type: 'factory',
    coordinates: [40.6782, -73.9442],
    status: 'normal',
    load: 61,
    capacity: 100,
    voltage: 380,
    consumption: 48.2,
    severity: 3,
    description: 'Industrial Manufacturing Complex',
    x: 60, y: 75
  },
  {
    id: 'factory-2',
    name: 'Queens Industrial Park',
    type: 'factory',
    coordinates: [40.7489, -73.8648],
    status: 'critical',
    load: 92,
    capacity: 100,
    voltage: 380,
    consumption: 67.8,
    severity: 8,
    description: 'Heavy Industrial Zone',
    x: 80, y: 50
  },
  {
    id: 'industry-1',
    name: 'Manhattan Data Center',
    type: 'industry',
    coordinates: [40.7505, -74.0134],
    status: 'warning',
    load: 78,
    capacity: 100,
    voltage: 600,
    consumption: 35.7,
    severity: 4,
    description: 'High-Tech Data Processing Center',
    x: 20, y: 55
  }
];

// Power flow connections
const POWER_ROUTES = [
  { from: 'bess-main', to: 'substation-a', active: true },
  { from: 'bess-main', to: 'substation-b', active: true },
  { from: 'substation-a', to: 'residential-1', active: true },
  { from: 'substation-a', to: 'industry-1', active: true },
  { from: 'substation-b', to: 'residential-2', active: true },
  { from: 'substation-b', to: 'factory-1', active: true },
  { from: 'substation-b', to: 'factory-2', active: true }
];

export default function GeographicMapSimple({ 
  onLocationSelect, 
  selectedLocation, 
  className = "" 
}) {
  const [locations] = useState(GEOGRAPHIC_LOCATIONS);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);

  // Find most critical location for auto-focus
  const mostCriticalLocation = locations.reduce((prev, current) => 
    (prev.severity > current.severity) ? prev : current
  );

  const handleMarkerClick = (location) => {
    onLocationSelect(location);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'bess': return '🔋';
      case 'substation': return '⚡';
      case 'residential': return '🏠';
      case 'factory': return '🏭';
      case 'industry': return '🏢';
      default: return '📍';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'critical': return 'Critical Zone';
      case 'warning': return 'High Load Area';
      default: return 'Normal Operation';
    }
  };

  // Get route coordinates for drawing lines
  const getRouteLines = () => {
    return POWER_ROUTES.map(route => {
      const fromLoc = locations.find(loc => loc.id === route.from);
      const toLoc = locations.find(loc => loc.id === route.to);
      
      if (fromLoc && toLoc) {
        return {
          ...route,
          x1: fromLoc.x,
          y1: fromLoc.y,
          x2: toLoc.x,
          y2: toLoc.y,
          color: route.active ? '#3b82f6' : '#9ca3af'
        };
      }
      return null;
    }).filter(Boolean);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <motion.button
          onClick={() => setShowHeatmap(!showHeatmap)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            showHeatmap 
              ? 'bg-blue-500 text-white shadow-lg' 
              : 'bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50'
          }`}
        >
          <Icons.Thermometer size={14} className="inline mr-1" />
          Heatmap
        </motion.button>
        
        <motion.button
          onClick={() => setShowRoutes(!showRoutes)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            showRoutes 
              ? 'bg-blue-500 text-white shadow-lg' 
              : 'bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50'
          }`}
        >
          <Icons.GitBranch size={14} className="inline mr-1" />
          Routes
        </motion.button>

        <motion.button
          onClick={() => onLocationSelect(null)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-3 py-2 rounded-lg text-xs font-medium bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 transition-all"
        >
          <Icons.RotateCcw size={14} className="inline mr-1" />
          Reset
        </motion.button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg p-3 shadow-lg border border-gray-200">
        <h4 className="text-xs font-semibold text-gray-900 mb-2">Status Legend</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-600">Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-gray-600">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-gray-600">Critical</span>
          </div>
        </div>
      </div>

      {/* Custom Map Container */}
      <div className="w-full h-full bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl overflow-hidden relative">
        {/* Background Grid */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(rgba(59,130,246,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.1) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />
        
        {/* Geographic Areas Background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-1/3 h-1/2 bg-blue-100/30 rounded-br-3xl"></div>
          <div className="absolute top-0 right-0 w-1/3 h-1/2 bg-green-100/30 rounded-bl-3xl"></div>
          <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-yellow-100/30 rounded-tr-3xl"></div>
          <div className="absolute bottom-0 right-0 w-1/2 h-1/3 bg-purple-100/30 rounded-tl-3xl"></div>
        </div>

        {/* SVG for routes and heatmap */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Heatmap circles */}
          {showHeatmap && locations.map(location => {
            const radius = Math.max(location.load / 10, 3);
            const opacity = location.load / 100 * 0.4;
            const color = getStatusColor(location.status);

            return (
              <circle
                key={`heatmap-${location.id}`}
                cx={location.x}
                cy={location.y}
                r={radius}
                fill={color}
                opacity={opacity}
                className="animate-pulse"
              />
            );
          })}

          {/* Power Routes */}
          {showRoutes && getRouteLines().map((route, index) => (
            <motion.line
              key={`route-${index}`}
              x1={route.x1}
              y1={route.y1}
              x2={route.x2}
              y2={route.y2}
              stroke={route.color}
              strokeWidth="0.5"
              opacity="0.7"
              strokeDasharray={route.active ? "0" : "2 2"}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: index * 0.1 }}
            />
          ))}
        </svg>

        {/* Location Markers */}
        {locations.map(location => (
          <motion.div
            key={location.id}
            className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
            style={{ 
              left: `${location.x}%`, 
              top: `${location.y}%`,
            }}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleMarkerClick(location)}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: location.severity * 0.1 }}
          >
            <div 
              className={`w-8 h-8 rounded-full border-3 border-white shadow-lg flex items-center justify-center text-sm font-bold ${
                location.status === 'critical' ? 'animate-pulse' : ''
              }`}
              style={{ 
                backgroundColor: getStatusColor(location.status),
                color: 'white'
              }}
            >
              {getTypeIcon(location.type)}
            </div>
            
            {/* Status indicator */}
            {location.status !== 'normal' && (
              <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white ${
                location.status === 'critical' ? 'bg-red-500 animate-ping' : 'bg-yellow-500'
              }`} />
            )}
          </motion.div>
        ))}
      </div>

      {/* Selected Location Info */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute top-4 left-4 z-10 bg-white rounded-lg p-4 shadow-lg border border-gray-200 max-w-xs"
          >
            {(() => {
              const location = locations.find(loc => loc.id === selectedLocation);
              if (!location) return null;
              
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className={`w-3 h-3 rounded-full ${
                        location.status === 'critical' ? 'bg-red-500 animate-pulse' :
                        location.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                    />
                    <h3 className="font-semibold text-sm text-gray-900">{location.name}</h3>
                  </div>
                  
                  <div className="text-xs text-gray-600 space-y-1">
                    <p><strong>Status:</strong> {getStatusLabel(location.status)}</p>
                    <p><strong>Current Load:</strong> {location.load}%</p>
                    <p><strong>Power:</strong> {location.consumption} MW</p>
                  </div>

                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        location.status === 'critical' ? 'bg-red-500' :
                        location.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${location.load}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}