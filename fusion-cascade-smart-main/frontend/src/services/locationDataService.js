// Location-specific data service for geographic map integration

// Generate location-specific data based on selected location
export const generateLocationData = (locationId) => {
  const locationDataMap = {
    'bess-main': {
      demandData: {
        actual: Array.from({ length: 20 }, (_, i) => 85 + Math.sin(i * 0.8) * 15 + Math.random() * 8),
        predicted: Array.from({ length: 20 }, (_, i) => 87 + Math.sin(i * 0.8) * 12 + Math.random() * 6)
      },
      allocations: [
        { type: 'Substation', value: 156.8 },
        { type: 'Distribution', value: 89.4 },
        { type: 'Reserve', value: 23.1 }
      ],
      aiDecisions: [
        { id: 'ai-bess-1', action: 'BESS Core operating at optimal capacity — 94% charge maintained', severity: 'info', timestamp: new Date().toLocaleTimeString() },
        { id: 'ai-bess-2', action: 'Predictive charging initiated for evening peak demand', severity: 'info', timestamp: new Date(Date.now() - 45000).toLocaleTimeString() },
        { id: 'ai-bess-3', action: 'Grid frequency stabilization active — fast response mode', severity: 'info', timestamp: new Date(Date.now() - 89000).toLocaleTimeString() },
        { id: 'ai-bess-4', action: 'Battery health monitoring: 96% efficiency maintained', severity: 'info', timestamp: new Date(Date.now() - 134000).toLocaleTimeString() }
      ],
      alerts: [
        { id: 'alert-bess-1', severity: 'info', message: 'BESS Core charge cycle complete — ready for dispatch', node: 'bess-main' }
      ]
    },
    'substation-a': {
      demandData: {
        actual: Array.from({ length: 20 }, (_, i) => 72 + Math.sin(i * 0.6) * 18 + Math.random() * 10),
        predicted: Array.from({ length: 20 }, (_, i) => 74 + Math.sin(i * 0.6) * 15 + Math.random() * 8)
      },
      allocations: [
        { type: 'Residential', value: 45.2 },
        { type: 'Commercial', value: 67.8 },
        { type: 'Industrial', value: 43.8 }
      ],
      aiDecisions: [
        { id: 'ai-sub-a-1', action: 'Manhattan Substation A load at 88% — monitoring threshold', severity: 'warning', timestamp: new Date().toLocaleTimeString() },
        { id: 'ai-sub-a-2', action: 'Voltage regulation optimized for residential district', severity: 'info', timestamp: new Date(Date.now() - 67000).toLocaleTimeString() },
        { id: 'ai-sub-a-3', action: 'Load balancing activated between feeders A1 and A2', severity: 'info', timestamp: new Date(Date.now() - 123000).toLocaleTimeString() }
      ],
      alerts: [
        { id: 'alert-sub-a-1', severity: 'warning', message: 'Substation A load at 88% — approaching threshold', node: 'substation-a' }
      ]
    },
    'substation-b': {
      demandData: {
        actual: Array.from({ length: 20 }, (_, i) => 88 + Math.sin(i * 0.7) * 12 + Math.random() * 6),
        predicted: Array.from({ length: 20 }, (_, i) => 85 + Math.sin(i * 0.7) * 14 + Math.random() * 8)
      },
      allocations: [
        { type: 'Heavy Industry', value: 89.4 },
        { type: 'Manufacturing', value: 67.2 },
        { type: 'Residential', value: 41.6 }
      ],
      aiDecisions: [
        { id: 'ai-sub-b-1', action: 'CRITICAL: Brooklyn Substation B at 95% capacity — emergency protocols active', severity: 'critical', timestamp: new Date().toLocaleTimeString() },
        { id: 'ai-sub-b-2', action: 'Load shedding initiated for non-essential industrial loads', severity: 'critical', timestamp: new Date(Date.now() - 23000).toLocaleTimeString() },
        { id: 'ai-sub-b-3', action: 'Rerouting 15% load to Substation A via interconnect', severity: 'warning', timestamp: new Date(Date.now() - 78000).toLocaleTimeString() },
        { id: 'ai-sub-b-4', action: 'Emergency generator standby activated', severity: 'critical', timestamp: new Date(Date.now() - 145000).toLocaleTimeString() }
      ],
      alerts: [
        { id: 'alert-sub-b-1', severity: 'error', message: 'Critical overload on Brooklyn Substation B — 95% capacity', node: 'substation-b' },
        { id: 'alert-sub-b-2', severity: 'warning', message: 'Emergency load shedding protocols activated', node: 'substation-b' }
      ]
    },
    'residential-1': {
      demandData: {
        actual: Array.from({ length: 20 }, (_, i) => 35 + Math.sin(i * 0.4) * 15 + Math.random() * 8),
        predicted: Array.from({ length: 20 }, (_, i) => 37 + Math.sin(i * 0.4) * 12 + Math.random() * 6)
      },
      allocations: [
        { type: 'Apartments', value: 18.4 },
        { type: 'Condos', value: 12.8 },
        { type: 'Townhouses', value: 8.2 }
      ],
      aiDecisions: [
        { id: 'ai-res-1-1', action: 'Upper East Side residential load stable at 45%', severity: 'info', timestamp: new Date().toLocaleTimeString() },
        { id: 'ai-res-1-2', action: 'Smart meter optimization reduced peak demand by 8%', severity: 'info', timestamp: new Date(Date.now() - 156000).toLocaleTimeString() },
        { id: 'ai-res-1-3', action: 'Evening peak prediction: 15% increase expected at 7 PM', severity: 'info', timestamp: new Date(Date.now() - 234000).toLocaleTimeString() }
      ],
      alerts: []
    },
    'residential-2': {
      demandData: {
        actual: Array.from({ length: 20 }, (_, i) => 58 + Math.sin(i * 0.5) * 20 + Math.random() * 12),
        predicted: Array.from({ length: 20 }, (_, i) => 55 + Math.sin(i * 0.5) * 18 + Math.random() * 10)
      },
      allocations: [
        { type: 'Single Family', value: 28.7 },
        { type: 'Multi Family', value: 19.4 },
        { type: 'Mixed Use', value: 14.0 }
      ],
      aiDecisions: [
        { id: 'ai-res-2-1', action: 'Queens residential zone at 72% — monitoring high usage', severity: 'warning', timestamp: new Date().toLocaleTimeString() },
        { id: 'ai-res-2-2', action: 'HVAC load management activated for peak shaving', severity: 'warning', timestamp: new Date(Date.now() - 89000).toLocaleTimeString() },
        { id: 'ai-res-2-3', action: 'Demand response program engaged — 200 homes participating', severity: 'info', timestamp: new Date(Date.now() - 167000).toLocaleTimeString() }
      ],
      alerts: [
        { id: 'alert-res-2-1', severity: 'warning', message: 'Queens residential zone approaching 75% threshold', node: 'residential-2' }
      ]
    },
    'factory-1': {
      demandData: {
        actual: Array.from({ length: 20 }, (_, i) => 48 + Math.sin(i * 0.3) * 25 + Math.random() * 15),
        predicted: Array.from({ length: 20 }, (_, i) => 52 + Math.sin(i * 0.3) * 22 + Math.random() * 12)
      },
      allocations: [
        { type: 'Production Line A', value: 28.4 },
        { type: 'Production Line B', value: 19.8 },
        { type: 'Support Systems', value: 12.6 }
      ],
      aiDecisions: [
        { id: 'ai-fac-1-1', action: 'Brooklyn Manufacturing operating within normal parameters', severity: 'info', timestamp: new Date().toLocaleTimeString() },
        { id: 'ai-fac-1-2', action: 'Production schedule optimized for off-peak hours', severity: 'info', timestamp: new Date(Date.now() - 234000).toLocaleTimeString() },
        { id: 'ai-fac-1-3', action: 'Energy efficiency improved by 12% through AI optimization', severity: 'info', timestamp: new Date(Date.now() - 345000).toLocaleTimeString() }
      ],
      alerts: []
    },
    'factory-2': {
      demandData: {
        actual: Array.from({ length: 20 }, (_, i) => 78 + Math.sin(i * 0.6) * 18 + Math.random() * 10),
        predicted: Array.from({ length: 20 }, (_, i) => 75 + Math.sin(i * 0.6) * 20 + Math.random() * 12)
      },
      allocations: [
        { type: 'Heavy Machinery', value: 45.8 },
        { type: 'Processing Units', value: 32.4 },
        { type: 'Cooling Systems', value: 22.0 }
      ],
      aiDecisions: [
        { id: 'ai-fac-2-1', action: 'CRITICAL: Queens Industrial Park at 92% capacity — immediate action required', severity: 'critical', timestamp: new Date().toLocaleTimeString() },
        { id: 'ai-fac-2-2', action: 'Emergency load reduction protocols initiated', severity: 'critical', timestamp: new Date(Date.now() - 34000).toLocaleTimeString() },
        { id: 'ai-fac-2-3', action: 'Non-essential equipment shutdown to prevent overload', severity: 'warning', timestamp: new Date(Date.now() - 89000).toLocaleTimeString() },
        { id: 'ai-fac-2-4', action: 'Coordinating with grid operator for additional capacity', severity: 'critical', timestamp: new Date(Date.now() - 156000).toLocaleTimeString() }
      ],
      alerts: [
        { id: 'alert-fac-2-1', severity: 'error', message: 'Critical overload at Queens Industrial Park — 92% capacity', node: 'factory-2' },
        { id: 'alert-fac-2-2', severity: 'warning', message: 'Emergency protocols activated for industrial load management', node: 'factory-2' }
      ]
    },
    'industry-1': {
      demandData: {
        actual: Array.from({ length: 20 }, (_, i) => 62 + Math.sin(i * 0.8) * 22 + Math.random() * 14),
        predicted: Array.from({ length: 20 }, (_, i) => 65 + Math.sin(i * 0.8) * 18 + Math.random() * 10)
      },
      allocations: [
        { type: 'Server Racks', value: 22.4 },
        { type: 'Cooling Systems', value: 18.7 },
        { type: 'Network Equipment', value: 8.6 }
      ],
      aiDecisions: [
        { id: 'ai-ind-1-1', action: 'Manhattan Data Center load at 78% — monitoring cooling systems', severity: 'warning', timestamp: new Date().toLocaleTimeString() },
        { id: 'ai-ind-1-2', action: 'Dynamic cooling optimization reduced energy by 15%', severity: 'info', timestamp: new Date(Date.now() - 123000).toLocaleTimeString() },
        { id: 'ai-ind-1-3', action: 'Server workload balanced across availability zones', severity: 'info', timestamp: new Date(Date.now() - 267000).toLocaleTimeString() }
      ],
      alerts: [
        { id: 'alert-ind-1-1', severity: 'warning', message: 'Data center cooling systems approaching capacity limits', node: 'industry-1' }
      ]
    }
  };

  // Return default data if location not found
  return locationDataMap[locationId] || locationDataMap['bess-main'];
};

// Get the most critical location based on severity score
export const getMostCriticalLocation = () => {
  const locations = [
    { id: 'bess-main', severity: 2 },
    { id: 'substation-a', severity: 6 },
    { id: 'substation-b', severity: 9 },
    { id: 'residential-1', severity: 1 },
    { id: 'residential-2', severity: 5 },
    { id: 'factory-1', severity: 3 },
    { id: 'factory-2', severity: 8 },
    { id: 'industry-1', severity: 4 }
  ];

  return locations.reduce((prev, current) => 
    (prev.severity > current.severity) ? prev : current
  );
};

// Generate location-specific AI decisions with real-time updates
export const generateLocationAIDecisions = (locationId, previousDecisions = []) => {
  const locationData = generateLocationData(locationId);
  const baseDecisions = locationData.aiDecisions;
  
  // Add some dynamic decisions based on current time
  const now = new Date();
  const timeBasedDecisions = [];
  
  if (now.getSeconds() % 30 === 0) {
    timeBasedDecisions.push({
      id: `dynamic-${locationId}-${now.getTime()}`,
      action: `Real-time monitoring update for ${locationId} — all systems operational`,
      severity: 'info',
      timestamp: now.toLocaleTimeString()
    });
  }
  
  return [...baseDecisions, ...timeBasedDecisions];
};