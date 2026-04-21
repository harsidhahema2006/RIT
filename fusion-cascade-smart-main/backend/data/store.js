// In-memory data store — no MongoDB required
const { v4: uuidv4 } = require('uuid');

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED_LOCATIONS = [
  { id:'bess-main',       name:'Manhattan BESS Central',      type:'bess',       latitude:40.7589, longitude:-73.9851, currentLoad:45, predictedLoad:52, capacity:500, efficiency:96 },
  { id:'bess-brooklyn',   name:'Brooklyn BESS Hub',           type:'bess',       latitude:40.6782, longitude:-73.9442, currentLoad:62, predictedLoad:58, capacity:400, efficiency:95 },
  { id:'substation-a',    name:'Manhattan Substation A',      type:'substation', latitude:40.7505, longitude:-73.9934, currentLoad:78, predictedLoad:82, capacity:300, efficiency:94 },
  { id:'substation-b',    name:'Brooklyn Substation B',       type:'substation', latitude:40.6892, longitude:-73.9442, currentLoad:88, predictedLoad:85, capacity:250, efficiency:93 },
  { id:'residential-1',   name:'Upper East Side Residential', type:'house',      latitude:40.7736, longitude:-73.9566, currentLoad:34, predictedLoad:42, capacity:100, efficiency:92 },
  { id:'residential-2',   name:'Queens Residential Zone',     type:'house',      latitude:40.7282, longitude:-73.7949, currentLoad:41, predictedLoad:48, capacity:120, efficiency:91 },
  { id:'residential-3',   name:'Brooklyn Heights Residential',type:'house',      latitude:40.6962, longitude:-73.9961, currentLoad:29, predictedLoad:35, capacity:90,  efficiency:93 },
  { id:'factory-1',       name:'Brooklyn Manufacturing',      type:'factory',    latitude:40.6643, longitude:-73.9442, currentLoad:72, predictedLoad:68, capacity:200, efficiency:89 },
  { id:'factory-2',       name:'Queens Industrial Park',      type:'factory',    latitude:40.7505, longitude:-73.8370, currentLoad:65, predictedLoad:71, capacity:180, efficiency:88 },
  { id:'industry-1',      name:'Manhattan Data Center',       type:'industry',   latitude:40.7505, longitude:-74.0087, currentLoad:89, predictedLoad:91, capacity:150, efficiency:96 },
  { id:'industry-2',      name:'Brooklyn Processing Plant',   type:'industry',   latitude:40.6413, longitude:-74.0187, currentLoad:76, predictedLoad:79, capacity:220, efficiency:91 },
  { id:'residential-4',   name:'Midtown Residential Complex', type:'house',      latitude:40.7549, longitude:-73.9840, currentLoad:52, predictedLoad:58, capacity:110, efficiency:90 },
  { id:'factory-3',       name:'Staten Island Manufacturing', type:'factory',    latitude:40.5795, longitude:-74.1502, currentLoad:43, predictedLoad:47, capacity:160, efficiency:87 },
];

function calcStatus(load) {
  if (load <= 65) return 'normal';
  if (load <= 85) return 'warning';
  return 'critical';
}
function calcSeverity(cur, pred) { return (0.6 * cur) + (0.4 * pred); }

// Build initial store
const locations = new Map();
SEED_LOCATIONS.forEach(l => {
  locations.set(l.id, {
    ...l,
    status: calcStatus(l.currentLoad),
    severityScore: calcSeverity(l.currentLoad, l.predictedLoad),
    lastUpdated: new Date().toISOString(),
    loadHistory: Array.from({ length: 20 }, (_, i) => ({
      timestamp: new Date(Date.now() - (20 - i) * 30000).toISOString(),
      load: Math.max(0, Math.min(100, l.currentLoad + (Math.random() - 0.5) * 10)),
      prediction: Math.max(0, Math.min(100, l.predictedLoad + (Math.random() - 0.5) * 8))
    }))
  });
});

// AI decisions log
const decisions = [];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getAll()       { return Array.from(locations.values()); }
function getById(id)    { return locations.get(id) || null; }
function getMostCritical() {
  return getAll().sort((a, b) => b.severityScore - a.severityScore)[0] || null;
}
function updateLoad(id, currentLoad, predictedLoad) {
  const loc = locations.get(id);
  if (!loc) return null;
  loc.currentLoad   = Math.max(0, Math.min(100, currentLoad));
  if (predictedLoad !== undefined)
    loc.predictedLoad = Math.max(0, Math.min(100, predictedLoad));
  loc.status        = calcStatus(loc.currentLoad);
  loc.severityScore = calcSeverity(loc.currentLoad, loc.predictedLoad);
  loc.lastUpdated   = new Date().toISOString();
  loc.loadHistory.push({ timestamp: loc.lastUpdated, load: loc.currentLoad, prediction: loc.predictedLoad });
  if (loc.loadHistory.length > 100) loc.loadHistory = loc.loadHistory.slice(-100);
  return loc;
}
function addDecision(d) {
  decisions.unshift({ id: uuidv4(), ...d, timestamp: new Date().toISOString() });
  if (decisions.length > 200) decisions.pop();
}
function getDecisions(limit = 20) { return decisions.slice(0, limit); }

module.exports = { getAll, getById, getMostCritical, updateLoad, addDecision, getDecisions, calcStatus, calcSeverity };
