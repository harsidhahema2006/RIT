import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Mock geographic locations (you can replace with real coordinates)
const GEOGRAPHIC_LOCATIONS = [
  {
    id: 'bess-main',
    name: 'BESS Main Station',
    type: 'bess',
    coordinates: [40.7589, -73.9851], // New York area
    status: 'normal',
    load: 94,
    capacity: 100,
    voltage: 480,
    consumption: 247.3,
    severity: 2,
    description: 'Main Battery Energy Storage System'
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
    description: 'Primary Distribution Substation'
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
    description: 'Secondary Distribution Substation'
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
    description: 'Residential District - 2,400 homes'
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
    description: 'Residential District - 3,200 homes'
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
    description: 'Industrial Manufacturing Complex'
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
    description: 'Heavy Industrial Zone'
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
    description: 'High-Tech Data Processing Center'
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

// Custom marker icons
const createCustomIcon = (type, status) => {
  const getIconColor = (status) => {
    switch (status) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const getIconSymbol = (type) => {
    switch (type) {
      case 'bess': return '🔋';
      case 'substation': return '⚡';
      case 'residential': return '🏠';
      case 'factory': return '🏭';
      case 'industry': return '🏢';
      default: return '📍';
    }
  };

  const color = getIconColor(status);
  const symbol = getIconSymbol(type);
  const pulse = status === 'critical' ? 'animation: pulse 1s infinite;' : '';

  return L.divIcon({
    html: `
      <div style="
        width: 32px; 
        height: 32px; 
        background: ${color}; 
        border: 3px solid white; 
        border-radius: 50%; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ${pulse}
      ">
        ${symbol}
      </div>
    `,
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// Component to handle map updates
function MapController({ selectedLocation, locations }) {
  const map = useMap();

  useEffect(() => {
    if (selectedLocation) {
      const location = locations.find(loc => loc.id === selectedLocation);
      if (location) {
        map.setView(location.coordinates, 13, { animate: true, duration: 1 });
      }
    } else {
      // Auto-focus on most critical location
      const mostCritical = locations.reduce((prev, current) => 
        (prev.severity > current.severity) ? prev : current
      );
      map.setView(mostCritical.coordinates, 12, { animate: true, duration: 1 });
    }
  }, [selectedLocation, locations, map]);

  return null;
}

// Heatmap overlay component (simplified version)
function HeatmapOverlay({ locations, showHeatmap }) {
  if (!showHeatmap) return null;

  return (
    <>
      {locations.map(location => {
        const radius = Math.max(location.load * 50, 200); // Minimum 200m radius
        const opacity = location.load / 100 * 0.3;
        const color = location.status === 'critical' ? '#ef4444' : 
                     location.status === 'warning' ? '#f59e0b' : '#10b981';

        return (
          <Circle
            key={`heatmap-${location.id}`}
            center={location.coordinates}
            radius={radius}
            pathOptions={{
              fillColor: color,
              fillOpacity: opacity,
              color: color,
              weight: 1,
              opacity: 0.5
            }}
          />
        );
      })}
    </>
  );
}

export default function GeographicMap({ 
  onLocationSelect, 
  selectedLocation, 
  className = "" 
}) {
  const [locations] = useState(GEOGRAPHIC_LOCATIONS);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const mapRef = useRef();

  // Find most critical location for auto-focus
  const mostCriticalLocation = locations.reduce((prev, current) => 
    (prev.severity > current.severity) ? prev : current
  );

  // Get route coordinates
  const getRouteCoordinates = () => {
    return POWER_ROUTES.map(route => {
      const fromLoc = locations.find(loc => loc.id === route.from);
      const toLoc = locations.find(loc => loc.id === route.to);
      
      if (fromLoc && toLoc) {
        return {
          ...route,
          coordinates: [fromLoc.coordinates, toLoc.coordinates],
          color: route.active ? '#3b82f6' : '#9ca3af'
        };
      }
      return null;
    }).filter(Boolean);
  };

  const handleMarkerClick = (location) => {
    onLocationSelect(location);
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'critical': return 'Critical Zone';
      case 'warning': return 'High Load Area';
      default: return 'Normal Operation';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
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
      <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg p-3 shadow-lg border border-gray-200">
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

      {/* Map Container */}
      <MapContainer
        ref={mapRef}
        center={mostCriticalLocation.coordinates}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        className="rounded-2xl overflow-hidden"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController selectedLocation={selectedLocation} locations={locations} />
        
        {/* Power Routes */}
        {showRoutes && getRouteCoordinates().map((route, index) => (
          <Polyline
            key={`route-${index}`}
            positions={route.coordinates}
            pathOptions={{
              color: route.color,
              weight: 3,
              opacity: 0.7,
              dashArray: route.active ? null : '10, 10'
            }}
          />
        ))}

        {/* Location Markers */}
        {locations.map(location => (
          <Marker
            key={location.id}
            position={location.coordinates}
            icon={createCustomIcon(location.type, location.status)}
            eventHandlers={{
              click: () => handleMarkerClick(location)
            }}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${
                    location.status === 'critical' ? 'bg-red-500' :
                    location.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}></div>
                  <h3 className="font-semibold text-sm text-gray-900">{location.name}</h3>
                </div>
                
                <div className="space-y-1 text-xs text-gray-600">
                  <p><strong>Status:</strong> {getStatusLabel(location.status)}</p>
                  <p><strong>Load:</strong> {location.load}%</p>
                  <p><strong>Consumption:</strong> {location.consumption} MW</p>
                  <p><strong>Voltage:</strong> {location.voltage >= 1000 ? `${(location.voltage/1000).toFixed(0)} kV` : `${location.voltage} V`}</p>
                  <p className="text-gray-500 mt-2">{location.description}</p>
                </div>

                <button
                  onClick={() => handleMarkerClick(location)}
                  className="mt-2 w-full px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                >
                  View Details
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Heatmap Overlay */}
        <HeatmapOverlay locations={locations} showHeatmap={showHeatmap} />
      </MapContainer>

      {/* Selected Location Info */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute top-4 left-4 z-[1000] bg-white rounded-lg p-4 shadow-lg border border-gray-200 max-w-xs"
          >
            {(() => {
              const location = locations.find(loc => loc.id === selectedLocation);
              if (!location) return null;
              
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${
                      location.status === 'critical' ? 'bg-red-500 animate-pulse' :
                      location.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}></div>
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
                    ></div>
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