import { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { faker } from '@faker-js/faker';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import SystemMap from '../components/SystemMap.jsx';
import GeographicMapSimple from '../components/GeographicMapSimple.jsx';
import DemandRoutingAi from '../components/DemandRoutingAi.jsx';
import AlertsAndControlsBar from '../components/AlertsAndControlsBar.jsx';
import { generateLocationData, getMostCriticalLocation } from '../services/locationDataService.js';

const Icon = ({ name, ...props }) => {
  const LIcon = Icons?.[name] || Icons.HelpCircle;
  return <LIcon {...props} />;
};

const BESS_NODES = [
  { id: 'bess', label: 'BESS Core', type: 'bess', x: 50, y: 50, load: 94, capacity: 100, voltage: 480, status: 'nominal', system: 'Battery Energy Storage' },
  { id: 'node-a', label: 'Grid Feeder A', type: 'feeder', x: 15, y: 18, load: 72, capacity: 100, voltage: 415, status: 'nominal', system: 'Distribution Feeder' },
  { id: 'node-b', label: 'Grid Feeder B', type: 'feeder', x: 85, y: 18, load: 88, capacity: 100, voltage: 415, status: 'warning', system: 'Distribution Feeder' },
  { id: 'node-c', label: 'Industrial Zone C', type: 'load', x: 15, y: 82, load: 61, capacity: 100, voltage: 380, status: 'nominal', system: 'Industrial Load' },
  { id: 'node-d', label: 'Residential Zone D', type: 'load', x: 85, y: 82, load: 45, capacity: 100, voltage: 220, status: 'nominal', system: 'Residential Load' },
  { id: 'node-e', label: 'Solar Array E', type: 'source', x: 50, y: 12, load: 78, capacity: 100, voltage: 600, status: 'nominal', system: 'Renewable Source' },
  { id: 'node-f', label: 'Substation F', type: 'substation', x: 50, y: 88, load: 55, capacity: 100, voltage: 132000, status: 'critical', system: 'HV Substation' },
];

const BESS_CONNECTIONS = [
  { id: 'c1', from: 'bess', to: 'node-a', flow: 0.72 },
  { id: 'c2', from: 'bess', to: 'node-b', flow: 0.88 },
  { id: 'c3', from: 'bess', to: 'node-c', flow: 0.61 },
  { id: 'c4', from: 'bess', to: 'node-d', flow: 0.45 },
  { id: 'c5', from: 'node-e', to: 'bess', flow: 0.78 },
  { id: 'c6', from: 'node-f', to: 'bess', flow: 0.55 },
];

function generateDemandData() {
  const pts = 20;
  const actual = Array.from({ length: pts }, (_, i) => 40 + Math.sin(i * 0.6) * 18 + Math.random() * 10);
  const predicted = actual.map((v) => v + (Math.random() - 0.5) * 14);
  return { actual, predicted };
}

function generateAllocations() {
  return [
    { type: 'Home', value: faker?.number?.float?.({ min: 18, max: 42, fractionDigits: 1 }) ?? 28.4 },
    { type: 'Factory', value: faker?.number?.float?.({ min: 30, max: 65, fractionDigits: 1 }) ?? 48.2 },
    { type: 'Industry', value: faker?.number?.float?.({ min: 22, max: 50, fractionDigits: 1 }) ?? 35.7 },
  ];
}

function generateAIDecisions() {
  const actions = [
    'Rerouting load from Feeder B to Feeder A — threshold exceeded',
    'Solar surplus detected — charging BESS Core at 94%',
    'Substation F voltage nominal — resuming full load',
    'Predictive load shedding activated for Industrial Zone C',
    'Grid frequency stabilized via BESS fast-response discharge',
    'Demand peak in 12 min — pre-charging reserves initiated',
    'Residential Zone D load optimized — 8% efficiency gain',
    'AI model retrained — LSTM accuracy improved to 97.3%',
    'Emergency reserve threshold: 20% — alert dispatched',
    'Solar Array E output: 78 MW — exceeding forecast by 6%',
  ];
  const severities = ['info', 'info', 'info', 'warning', 'info', 'warning', 'info', 'info', 'critical', 'info'];
  const now = Date.now();
  return actions.map((action, i) => ({
    id: `ai-${i}`,
    action,
    severity: severities[i],
    timestamp: new Date(now - i * 47000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }));
}

function generateAlerts() {
  return [
    { id: 'a1', severity: 'error', message: 'Critical fault on Substation F — HV breaker open', node: 'node-f' },
    { id: 'a2', severity: 'warning', message: 'Grid Feeder B load at 88% — approaching threshold', node: 'node-b' },
    { id: 'a3', severity: 'info', message: 'BESS Core charge cycle complete — ready for dispatch', node: 'bess' },
    { id: 'a4', severity: 'warning', message: 'Solar Array E forecast deviation: +6% above predicted', node: 'node-e' },
    { id: 'a5', severity: 'info', message: 'Demand routing algorithm updated — v4.2.1 deployed', node: null },
  ];
}

function generateBessStats() {
  return {
    chargePercent: faker?.number?.int?.({ min: 68, max: 97 }) ?? 83,
    chargeStatus: 'Charging',
    inputKw: faker?.number?.float?.({ min: 180, max: 320, fractionDigits: 1 }) ?? 247.3,
    outputKw: faker?.number?.float?.({ min: 90, max: 210, fractionDigits: 1 }) ?? 152.8,
    temperature: faker?.number?.float?.({ min: 28, max: 41, fractionDigits: 1 }) ?? 33.4,
    cycles: faker?.number?.int?.({ min: 420, max: 680 }) ?? 534,
    health: faker?.number?.int?.({ min: 91, max: 99 }) ?? 96,
    efficiency: faker?.number?.float?.({ min: 94.2, max: 98.8, fractionDigits: 1 }) ?? 97.1,
    gridFrequency: faker?.number?.float?.({ min: 49.95, max: 50.05, fractionDigits: 3 }) ?? 50.002,
    activeCells: faker?.number?.int?.({ min: 1840, max: 1920 }) ?? 1896,
    totalCells: 1920,
  };
}

function generateGraphPoints() {
  return Array.from({ length: 30 }, (_, i) => ({
    x: i,
    y: 45 + Math.sin(i * 0.45) * 22 + Math.sin(i * 0.18) * 14 + Math.random() * 8,
  }));
}

function DemandChart({ actual, predicted }) {
  const CHART_H = 80;
  const CHART_W = 260;
  
  const buildPath = (data, maxVal, w, h) => {
    if (!data || data.length < 2) return '';
    const step = w / (data.length - 1);
    return data
      .map((v, i) => {
        const x = i * step;
        const y = h - (v / maxVal) * (h - 8) - 4;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const allVals = [...(actual || []), ...(predicted || [])];
  const maxVal = Math.max(...allVals, 1) * 1.1;
  const actualPath = buildPath(actual, maxVal, CHART_W, CHART_H);
  const predictedPath = buildPath(predicted, maxVal, CHART_W, CHART_H);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-inter font-semibold tracking-widest uppercase text-gray-400">Demand Forecast</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-blue-600 font-inter">
            <span className="w-3 h-0.5 rounded-full bg-blue-500 inline-block"></span>Actual
          </span>
          <span className="flex items-center gap-1 text-[10px] text-purple-600 font-inter">
            <span className="w-3 h-0.5 rounded-full bg-purple-500 inline-block"></span>LSTM
          </span>
        </div>
      </div>
      <div className="relative w-full rounded-2xl overflow-hidden bg-gray-700 border border-gray-600 p-2">
        <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H + 8}`} preserveAspectRatio="none" className="block">
          <defs>
            <linearGradient id="actualGradWhite" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="predGradWhite" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {predictedPath && (
            <>
              <path d={`${predictedPath} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`} fill="url(#predGradWhite)" />
              <path d={predictedPath} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="5 3" />
            </>
          )}
          {actualPath && (
            <>
              <path d={`${actualPath} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`} fill="url(#actualGradWhite)" />
              <path d={actualPath} fill="none" stroke="#3b82f6" strokeWidth="2" />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
function RoutingPanel({ allocations }) {
  const CONSUMER_COLORS = {
    Home: { bar: 'bg-blue-500', glow: 'shadow-blue-400/40', text: 'text-blue-400', bg: 'bg-blue-900/30 border-blue-500/30' },
    Factory: { bar: 'bg-yellow-500', glow: 'shadow-yellow-400/40', text: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-500/30' },
    Industry: { bar: 'bg-green-500', glow: 'shadow-green-400/40', text: 'text-green-400', bg: 'bg-green-900/30 border-green-500/30' },
  };

  const sorted = [...(allocations || [])].sort((a, b) => b.value - a.value);
  const maxVal = Math.max(...sorted.map((a) => a.value), 1);
  const iconMap = { Home: 'Home', Factory: 'Factory', Industry: 'Zap' };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-inter font-semibold tracking-widest uppercase text-gray-400">Routing Allocation</span>
        <span className="text-[10px] text-green-400 font-inter tracking-wide uppercase">Live</span>
      </div>
      <div className="flex flex-col gap-3">
        {sorted.map((item) => {
          const pct = Math.round((item.value / maxVal) * 100);
          const colors = CONSUMER_COLORS[item.type] || CONSUMER_COLORS.Industry;
          const IconComp = Icons?.[iconMap[item.type]] || Icons.HelpCircle;
          return (
            <motion.div
              key={item.type}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className={`flex flex-col gap-1.5 rounded-2xl p-3 ${colors.bg} border`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center bg-gray-800 border border-gray-600`}>
                    <IconComp size={12} className={colors.text} />
                  </div>
                  <span className={`text-xs font-inter font-medium ${colors.text}`}>{item.type}</span>
                </div>
                <span className={`text-xs font-inter font-semibold tabular-nums ${colors.text}`}>
                  {item.value.toFixed(1)} MW
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-600 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${colors.bar} shadow-md ${colors.glow}`}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function AIDecisionFeed({ decisions }) {
  const [visibleDecisions, setVisibleDecisions] = useState(decisions?.slice(0, 6) || []);
  const containerRef = useRef(null);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!decisions || decisions.length === 0) return;
    const interval = setInterval(() => {
      tickRef.current = (tickRef.current + 1) % decisions.length;
      setVisibleDecisions((prev) => {
        const next = [
          ...prev.slice(1),
          decisions[(tickRef.current + prev.length) % decisions.length],
        ];
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [decisions]);

  const severityStyle = (severity) => {
    if (severity === 'critical') return 'text-red-600 bg-red-50 border-red-200';
    if (severity === 'warning') return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const severityIcon = (severity) => {
    if (severity === 'critical') return 'AlertOctagon';
    if (severity === 'warning') return 'AlertTriangle';
    return 'CheckCircle';
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Brain" size={16} color="#3b82f6" strokeWidth={1.5} />
          <span className="text-lg font-inter font-semibold tracking-tight text-white">AI Decision Feed</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-900/30 border border-blue-500/30">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-blue-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="text-xs font-inter font-medium text-blue-400">LSTM Active</span>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="bg-gray-900 rounded-2xl border border-gray-600 shadow-sm overflow-hidden"
        style={{ minHeight: '300px', maxHeight: '400px' }}
      >
        <div className="p-4 border-b border-gray-600 bg-gray-800">
          <div className="flex items-center gap-2">
            <Icon name="Activity" size={14} color="#3b82f6" strokeWidth={1.5} />
            <span className="text-sm font-inter font-medium text-gray-300">Live Decision Stream</span>
            <div className="flex-1"></div>
            <span className="text-xs font-mono text-green-400">●</span>
            <span className="text-xs font-mono text-gray-400">ONLINE</span>
          </div>
        </div>
        
        <div className="p-4 space-y-2 overflow-y-auto font-mono text-sm" style={{ maxHeight: '480px', backgroundColor: '#0f172a' }}>
          <AnimatePresence mode="popLayout">
            {visibleDecisions.map((item, idx) => {
              const isRecent = idx >= visibleDecisions.length - 1;
              const SeverityIcon = Icons?.[severityIcon(item.severity)] || Icons.Info;
              
              return (
                <motion.div
                  key={`${item.id}-${idx}`}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ 
                    opacity: isRecent ? 1 : 0.7, 
                    y: 0, 
                    scale: 1
                  }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className={`flex items-start gap-3 p-2 rounded border-l-2 ${
                    item.severity === 'critical' ? 'border-l-red-500 bg-red-950/20' :
                    item.severity === 'warning' ? 'border-l-yellow-500 bg-yellow-950/20' : 
                    'border-l-green-500 bg-green-950/20'
                  }`}
                >
                  <span className="text-xs text-gray-500 font-mono shrink-0 mt-0.5">
                    {item.timestamp}
                  </span>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className={`text-xs font-mono shrink-0 ${
                        item.severity === 'critical' ? 'text-red-400' :
                        item.severity === 'warning' ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        [{item.severity.toUpperCase()}]
                      </span>
                      <p className="text-xs font-mono text-gray-300 leading-relaxed">
                        {item.action}
                      </p>
                      {isRecent && (
                        <motion.div
                          className="w-1 h-1 rounded-full bg-green-400 shrink-0 mt-1"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function PowerFlowGraph({ points }) {
  const width = 280;
  const height = 100;
  const maxY = Math.max(...points.map((p) => p.y), 1);
  const minY = Math.min(...points.map((p) => p.y), 0);
  const range = maxY - minY || 1;
  const step = width / (points.length - 1);
  
  const path = points
    .map((p, i) => {
      const x = (i * step).toFixed(1);
      const y = (height - ((p.y - minY) / range) * (height - 20) - 10).toFixed(1);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  
  const fillPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="block">
        <defs>
          <linearGradient id="powerFlowGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
          </linearGradient>
          <filter id="powerFlowGlow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        <path d={fillPath} fill="url(#powerFlowGradient)" />
        
        <path 
          d={path} 
          fill="none" 
          stroke="#10b981" 
          strokeWidth="2.5" 
          filter="url(#powerFlowGlow)"
        />
        
        {points.map((p, i) => {
          const x = i * step;
          const y = height - ((p.y - minY) / range) * (height - 20) - 10;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="2"
              fill="#10b981"
              opacity={i === points.length - 1 ? 1 : 0.6}
            />
          );
        })}
      </svg>
    </div>
  );
}
function MiniSparklineDark({ points, color, height = 44 }) {
  const width = 200;
  const maxY = Math.max(...points.map((p) => p.y), 1);
  const minY = Math.min(...points.map((p) => p.y), 0);
  const range = maxY - minY || 1;
  const step = width / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = (i * step).toFixed(1);
      const y = (height - ((p.y - minY) / range) * (height - 6) - 3).toFixed(1);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  const fillPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block w-full">
      <defs>
        <linearGradient id={`spark-grad-dark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id="spark-glow-dark">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={fillPath} fill={`url(#spark-grad-dark-${color.replace('#', '')})`} />
      <path 
        d={path} 
        fill="none" 
        stroke={color} 
        strokeWidth="2.5" 
        filter="url(#spark-glow-dark)"
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      />
    </svg>
  );
}

function BatteryBar({ percent, status }) {
  const segments = 20;
  const filled = Math.round((percent / 100) * segments);
  const barColor = percent > 60 ? '#10b981' : percent > 25 ? '#f59e0b' : '#ef4444';
  const bgFilled = percent > 60 ? 'bg-green-500' : percent > 25 ? 'bg-yellow-500' : 'bg-red-500';
  const bgEmpty = 'bg-gray-200';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-inter text-xs tracking-widest uppercase text-gray-400">State of Charge</span>
        <span className="font-inter text-sm font-bold" style={{ color: barColor }}>{percent}%</span>
      </div>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: segments }, (_, i) => (
          <motion.div
            key={i}
            className={`flex-1 h-4 rounded-sm ${i < filled ? bgFilled : bgEmpty}`}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.03, duration: 0.25, ease: 'easeOut' }}
          />
        ))}
        <div className="w-2 h-2.5 rounded-r-sm ml-0.5 bg-gray-300" />
      </div>
      <div className="flex items-center gap-1.5">
        <motion.div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: barColor }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="font-inter text-xs text-gray-400">{status}</span>
      </div>
    </div>
  );
}

function StatRow({ icon, label, value, valueColor = 'text-gray-700', unit = '' }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-700 border border-gray-600">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={12} color="#3b82f6" strokeWidth={1.5} />
        <span className="font-inter text-xs text-gray-300">{label}</span>
      </div>
      <span className={`font-inter text-xs font-semibold tabular-nums ${valueColor}`}>
        {value}<span className="font-normal text-gray-400 ml-0.5">{unit}</span>
      </span>
    </div>
  );
}

function BESSPanel({ stats, graphPoints }) {
  const [localStats, setLocalStats] = useState(stats);
  const [localPoints, setLocalPoints] = useState(graphPoints);

  useEffect(() => {
    const interval = setInterval(() => {
      setLocalStats((prev) => ({
        ...prev,
        inputKw: Math.max(80, prev.inputKw + (Math.random() - 0.48) * 12),
        outputKw: Math.max(40, prev.outputKw + (Math.random() - 0.5) * 8),
        gridFrequency: 49.98 + Math.random() * 0.04,
        chargePercent: Math.min(100, Math.max(5, prev.chargePercent + (Math.random() > 0.5 ? 0.3 : -0.2))),
      }));
      setLocalPoints((prev) => {
        const newPt = { x: prev[prev.length - 1].x + 1, y: 45 + Math.sin(Date.now() / 1800) * 22 + Math.random() * 10 };
        return [...prev.slice(1), newPt];
      });
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
      className="w-full"
    >
      <div className="rounded-2xl p-6 bg-gray-800 border border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-green-900/30 border border-green-500/30">
              <Icon name="Battery" size={20} color="#10b981" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-inter text-lg font-semibold text-white leading-tight">BESS Core</p>
              <p className="font-inter text-sm text-gray-400">Battery Energy Storage System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1.5 rounded-full bg-green-900/30 border border-green-500/30">
              <span className="font-inter text-sm font-medium text-green-400">Online</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-900/30 border border-blue-500/30">
              <motion.div
                className="w-2 h-2 rounded-full bg-blue-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span className="font-inter text-sm font-medium text-blue-400">Live Data</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <BatteryBar percent={Math.round(localStats.chargePercent)} status={localStats.chargeStatus} />
          </div>

          <div className="lg:col-span-1">
            <div className="flex flex-col gap-3">
              <span className="font-inter text-xs tracking-widest uppercase text-gray-400 mb-1">Power Flow</span>
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-xl p-4 flex flex-col gap-2 bg-green-900/30 border border-green-500/30">
                  <div className="flex items-center gap-2">
                    <Icon name="ArrowDownRight" size={14} color="#10b981" strokeWidth={2} />
                    <span className="font-inter text-xs text-gray-300">INPUT</span>
                  </div>
                  <span className="font-inter text-2xl font-bold tabular-nums text-green-400">
                    {localStats.inputKw.toFixed(1)}
                  </span>
                  <span className="font-inter text-sm text-green-400">kW</span>
                </div>
                <div className="rounded-xl p-4 flex flex-col gap-2 bg-blue-900/30 border border-blue-500/30">
                  <div className="flex items-center gap-2">
                    <Icon name="ArrowUpRight" size={14} color="#3b82f6" strokeWidth={2} />
                    <span className="font-inter text-xs text-gray-300">OUTPUT</span>
                  </div>
                  <span className="font-inter text-2xl font-bold tabular-nums text-blue-400">
                    {localStats.outputKw.toFixed(1)}
                  </span>
                  <span className="font-inter text-sm text-blue-400">kW</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-inter text-xs tracking-widest uppercase text-gray-400">Power Flow</span>
                <motion.div
                  className="flex items-center gap-1"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="w-1 h-1 rounded-full bg-green-400" />
                  <span className="font-inter text-xs text-green-400">LIVE</span>
                </motion.div>
              </div>
              <div className="rounded-xl overflow-hidden bg-gray-700 border border-gray-600 h-32 p-3">
                <PowerFlowGraph points={localPoints} />
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="flex flex-col gap-3">
              <span className="font-inter text-xs tracking-widest uppercase text-gray-400 mb-1">System Metrics</span>
              <div className="flex flex-col gap-2">
                <StatRow icon="Thermometer" label="Temperature" value={localStats.temperature.toFixed(1)} unit="°C" />
                <StatRow icon="RefreshCw" label="Cycles" value={localStats.cycles} />
                <StatRow icon="ShieldCheck" label="Health" value={`${localStats.health}%`} valueColor="text-green-600" />
                <StatRow icon="Zap" label="Efficiency" value={`${localStats.efficiency.toFixed(1)}%`} valueColor="text-blue-600" />
                <StatRow icon="Activity" label="Grid Freq." value={localStats.gridFrequency.toFixed(3)} unit="Hz" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const DEMAND_DATA = generateDemandData();
const AI_DECISIONS = generateAIDecisions();
const ALLOCATIONS = generateAllocations();
const ALERTS = generateAlerts();
const BESS_STATS = generateBessStats();
const GRAPH_POINTS = generateGraphPoints();
export default function Home() {
  const [bessStats] = useState(() => BESS_STATS);
  const [graphPoints] = useState(() => GRAPH_POINTS);
  
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationData, setLocationData] = useState(() => {
    const mostCritical = getMostCriticalLocation();
    return generateLocationData(mostCritical.id);
  });
  
  useEffect(() => {
    if (!selectedLocation) {
      const mostCritical = getMostCriticalLocation();
      setSelectedLocation(mostCritical.id);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedLocation) {
      const newData = generateLocationData(selectedLocation);
      setLocationData(newData);
    } else {
      const mostCritical = getMostCriticalLocation();
      setSelectedLocation(mostCritical.id);
    }
  }, [selectedLocation]);

  const handleLocationSelect = (location) => {
    if (location) {
      setSelectedLocation(location.id);
    } else {
      const mostCritical = getMostCriticalLocation();
      setSelectedLocation(mostCritical.id);
    }
  };

  return (
    <div className="min-h-screen w-full font-inter bg-gray-900">
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(59,130,246,0.05) 0%, rgba(16,185,129,0.03) 35%, transparent 65%), radial-gradient(ellipse 50% 40% at 80% 80%, rgba(16,185,129,0.03) 0%, transparent 60%)',
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(59,130,246,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />

      <Header />

      <main className="relative z-10 pt-24 pb-24">
        <div
          className="mx-auto px-4 md:px-6 lg:px-8"
          style={{ maxWidth: '1920px' }}
        >
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Icon name="LayoutDashboard" size={13} color="#3b82f6" strokeWidth={1.5} />
                <span
                  className="font-inter text-xs tracking-widest uppercase text-blue-400"
                >
                  Distributed BESS Architecture
                </span>
              </div>
              <h1 className="font-inter text-xl md:text-2xl font-bold text-white tracking-tight">
                Power Network Dashboard
              </h1>
              {selectedLocation && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 mt-2"
                >
                  <Icon name="MapPin" size={12} color="#6b7280" strokeWidth={1.5} />
                  <span className="font-inter text-sm text-gray-400">
                    Viewing: <span className="font-medium text-white">
                      {(() => {
                        const locationNames = {
                          'bess-main': 'BESS Main Station',
                          'substation-a': 'Manhattan Substation A',
                          'substation-b': 'Brooklyn Substation B',
                          'residential-1': 'Upper East Side Residential',
                          'residential-2': 'Queens Residential Zone',
                          'factory-1': 'Brooklyn Manufacturing',
                          'factory-2': 'Queens Industrial Park',
                          'industry-1': 'Manhattan Data Center'
                        };
                        return locationNames[selectedLocation] || 'Unknown Location';
                      })()}
                    </span>
                  </span>
                </motion.div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-900/30 border border-green-500/30"
              >
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-green-400"
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <span className="font-inter text-xs font-medium text-green-400">Grid Online</span>
              </div>
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-600 shadow-sm"
              >
                <Icon name="Clock" size={11} color="#9ca3af" strokeWidth={1.5} />
                <span className="font-inter text-xs text-gray-400">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          </motion.div>

          <div className="flex flex-col gap-4">
            <div className="w-full">
              <BESSPanel stats={bessStats} graphPoints={graphPoints} />
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-1">
                  <Suspense
                    fallback={
                      <div
                        className="w-full rounded-2xl flex items-center justify-center bg-gray-800 border border-gray-700 shadow-sm"
                        style={{ minHeight: '700px' }}
                      >
                        <motion.div
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                          className="flex items-center gap-2"
                        >
                          <Icon name="Loader" size={16} color="#3b82f6" strokeWidth={1.5} />
                          <span className="font-inter text-sm text-blue-400">Loading system map…</span>
                        </motion.div>
                      </div>
                    }
                  >
                    <div className="rounded-2xl overflow-hidden bg-gray-800 border border-gray-700 shadow-sm" style={{ minHeight: '700px' }}>
                      <SystemMap
                        nodes={BESS_NODES}
                        connections={BESS_CONNECTIONS}
                        power_flow_status="warning"
                      />
                    </div>
                  </Suspense>
                </div>

                <div className="lg:col-span-1 flex flex-col gap-4">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="rounded-2xl bg-gray-800 border border-gray-700 shadow-sm p-4"
                    style={{ minHeight: '180px' }}
                  >
                    <DemandChart actual={locationData.demandData.actual} predicted={locationData.demandData.predicted} />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                    className="rounded-2xl bg-gray-800 border border-gray-700 shadow-sm p-4"
                    style={{ minHeight: '180px' }}
                  >
                    <RoutingPanel allocations={locationData.allocations} />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
                    className="flex-1"
                    style={{ minHeight: '320px' }}
                  >
                    <div className="rounded-2xl bg-gray-800 border border-gray-700 shadow-sm p-6 h-full">
                      <AIDecisionFeed decisions={locationData.aiDecisions} />
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AlertsAndControlsBar alerts_list={locationData.alerts} />
      <Footer />
    </div>
  );
}