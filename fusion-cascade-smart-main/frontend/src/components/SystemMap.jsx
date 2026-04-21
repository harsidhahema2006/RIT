import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';

const DEFAULT_NODES = [
  { id: 'bess', label: 'BESS Core', type: 'bess', x: 50, y: 50, load: 94, capacity: 100, voltage: 480, status: 'nominal', system: 'Battery Energy Storage' },
  { id: 'node-a', label: 'Grid Feeder A', type: 'feeder', x: 15, y: 18, load: 72, capacity: 100, voltage: 415, status: 'nominal', system: 'Distribution Feeder' },
  { id: 'node-b', label: 'Grid Feeder B', type: 'feeder', x: 85, y: 18, load: 88, capacity: 100, voltage: 415, status: 'warning', system: 'Distribution Feeder' },
  { id: 'node-c', label: 'Industrial Zone C', type: 'load', x: 15, y: 82, load: 61, capacity: 100, voltage: 380, status: 'nominal', system: 'Industrial Load' },
  { id: 'node-d', label: 'Residential Zone D', type: 'load', x: 85, y: 82, load: 45, capacity: 100, voltage: 220, status: 'nominal', system: 'Residential Load' },
  { id: 'node-e', label: 'Solar Array E', type: 'source', x: 50, y: 12, load: 78, capacity: 100, voltage: 600, status: 'nominal', system: 'Renewable Source' },
  { id: 'node-f', label: 'Substation F', type: 'substation', x: 50, y: 88, load: 55, capacity: 100, voltage: 132000, status: 'critical', system: 'HV Substation' },
];

const DEFAULT_CONNECTIONS = [
  { id: 'c1', from: 'bess', to: 'node-a', flow: 0.72 },
  { id: 'c2', from: 'bess', to: 'node-b', flow: 0.88 },
  { id: 'c3', from: 'bess', to: 'node-c', flow: 0.61 },
  { id: 'c4', from: 'bess', to: 'node-d', flow: 0.45 },
  { id: 'c5', from: 'node-e', to: 'bess', flow: 0.78 },
  { id: 'c6', from: 'node-f', to: 'bess', flow: 0.55 },
];

const NODE_ICONS = {
  bess: 'Battery',
  feeder: 'Zap',
  load: 'Building2',
  source: 'Sun',
  substation: 'GitBranch',
};

const STATUS_COLORS = {
  nominal: { line: '#13fc72', glow: 'rgba(19,252,114,0.6)', bg: 'rgba(19,252,114,0.12)', border: 'rgba(19,252,114,0.5)', text: '#13fc72' },
  warning: { line: '#f59e0b', glow: 'rgba(245,158,11,0.6)', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.5)', text: '#f59e0b' },
  critical: { line: '#ef4444', glow: 'rgba(239,68,68,0.6)', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.5)', text: '#ef4444' },
};

function getNodeColor(node) {
  return STATUS_COLORS[node.status] || STATUS_COLORS.nominal;
}

function getConnectionColor(flow, power_flow_status) {
  if (power_flow_status === 'critical' || flow > 0.85) return STATUS_COLORS.critical;
  if (power_flow_status === 'warning' || flow > 0.7) return STATUS_COLORS.warning;
  return STATUS_COLORS.nominal;
}

function FlowLine({ connection, fromNode, toNode, power_flow_status, svgWidth, svgHeight }) {
  const x1 = (fromNode.x / 100) * svgWidth;
  const y1 = (fromNode.y / 100) * svgHeight;
  const x2 = (toNode.x / 100) * svgWidth;
  const y2 = (toNode.y / 100) * svgHeight;
  const color = getConnectionColor(connection.flow, power_flow_status);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const dashId = `dash-${connection.id}`;
  const glowId = `glow-${connection.id}`;

  return (
    <g>
      <defs>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={dashId} gradientUnits="userSpaceOnUse"
          x1={x1} y1={y1} x2={x2} y2={y2}>
          <motion.stop
            offset="0%"
            stopColor={color.line}
            stopOpacity="0"
          />
          <motion.stop
            offset="50%"
            stopColor={color.line}
            stopOpacity="1"
          />
          <motion.stop
            offset="100%"
            stopColor={color.line}
            stopOpacity="0.3"
          />
        </linearGradient>
      </defs>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color.line}
        strokeWidth="1"
        strokeOpacity="0.15"
      />
      <motion.line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color.line}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${len * 0.25} ${len * 0.75}`}
        filter={`url(#${glowId})`}
        animate={{ strokeDashoffset: [0, -len] }}
        transition={{ duration: 2.5 / (connection.flow + 0.3), repeat: Infinity, ease: 'linear' }}
      />
      <polygon
        points={`-5,-3 5,0 -5,3`}
        fill={color.line}
        opacity="0.85"
        transform={`translate(${mx},${my}) rotate(${angle})`}
      />
    </g>
  );
}

function NetworkNode({ node, isHovered, isSelected, onHover, onLeave, onClick, svgWidth, svgHeight }) {
  const cx = (node.x / 100) * svgWidth;
  const cy = (node.y / 100) * svgHeight;
  const color = getNodeColor(node);
  const isBess = node.type === 'bess';
  const baseR = isBess ? 28 : 18;
  const iconName = NODE_ICONS[node.type] || 'Circle';
  const IconComp = Icons?.[iconName] || Icons.HelpCircle;

  return (
    <g
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={onLeave}
      onClick={() => onClick(node)}
      role="button"
      aria-label={`Node ${node.label}`}
    >
      <motion.circle
        cx={cx}
        cy={cy}
        r={baseR + 10}
        fill={color.bg}
        opacity={isHovered || isSelected ? 0.5 : 0.15}
        animate={{ scale: isHovered ? 1.15 : 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      />
      {isBess && (
        <motion.circle
          cx={cx}
          cy={cy}
          r={baseR + 20}
          fill="none"
          stroke={color.line}
          strokeWidth="1"
          strokeOpacity="0.2"
          animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.1, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <motion.circle
        cx={cx}
        cy={cy}
        r={baseR}
        fill="rgba(20,24,36,0.9)"
        stroke={color.line}
        strokeWidth={isHovered || isSelected ? 2.5 : 1.5}
        animate={{
          scale: isHovered ? 1.12 : 1,
          filter: isHovered
            ? `drop-shadow(0 0 12px ${color.glow})`
            : `drop-shadow(0 0 4px ${color.glow})`,
        }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      />
      <foreignObject
        x={cx - 10}
        y={cy - 10}
        width={20}
        height={20}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          className="flex items-center justify-center w-5 h-5"
        >
          <IconComp size={isBess ? 16 : 12} color={color.line} strokeWidth={1.5} />
        </div>
      </foreignObject>
      {(isHovered || isBess) && (
        <text
          x={cx}
          y={cy + baseR + 14}
          textAnchor="middle"
          fill="rgba(255,255,255,0.7)"
          fontSize="9"
          fontFamily="Inter, sans-serif"
          fontWeight="500"
          letterSpacing="0.5"
        >
          {node.label.toUpperCase()}
        </text>
      )}
    </g>
  );
}

function NodeModal({ node, onClose }) {
  if (!node) return null;
  const color = getNodeColor(node);
  const iconName = NODE_ICONS[node.type] || 'Circle';
  const IconComp = Icons?.[iconName] || Icons.HelpCircle;

  const statusLabel = node.status.charAt(0).toUpperCase() + node.status.slice(1);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label={`Details for ${node.label}`}
    >
      <motion.div
        className="relative rounded-2xl p-8 w-80 max-w-full"
        style={{
          background: 'rgba(14,18,30,0.92)',
          border: `1px solid ${color.border}`,
          boxShadow: `0 0 40px ${color.glow}, 0 8px 32px rgba(0,0,0,0.6)`,
          backdropFilter: 'blur(20px)',
        }}
        initial={{ scale: 0.88, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 12 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ background: color.bg, border: `1px solid ${color.border}` }}
            >
              <IconComp size={18} color={color.line} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-white font-inter text-sm font-semibold leading-tight">{node.label}</p>
              <p className="font-inter text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{node.system}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 hover:bg-white/10"
            aria-label="Close modal"
          >
            <Icons.X size={14} color="rgba(255,255,255,0.5)" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>STATUS</span>
            <span className="font-inter text-xs font-semibold" style={{ color: color.text }}>{statusLabel}</span>
          </div>
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>LOAD</span>
            <span className="font-inter text-xs font-semibold text-white">{node.load}%</span>
          </div>
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>VOLTAGE</span>
            <span className="font-inter text-xs font-semibold text-white">{node.voltage >= 1000 ? `${(node.voltage / 1000).toFixed(0)} kV` : `${node.voltage} V`}</span>
          </div>
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>CAPACITY</span>
            <span className="font-inter text-xs font-semibold text-white">{node.capacity} MW</span>
          </div>
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>NODE ID</span>
            <span className="font-inter text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{node.id.toUpperCase()}</span>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>LOAD UTILIZATION</span>
            <span className="font-inter text-xs font-semibold" style={{ color: color.text }}>{node.load}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              className="h-1.5 rounded-full"
              style={{ background: `linear-gradient(90deg, ${color.line}, ${color.glow})` }}
              initial={{ width: '0%' }}
              animate={{ width: `${node.load}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SystemMap({ nodes: propNodes, connections: propConnections, power_flow_status = 'nominal' }) {
  const [nodes] = useState(() => propNodes && propNodes.length > 0 ? propNodes : DEFAULT_NODES);
  const [connections] = useState(() => propConnections && propConnections.length > 0 ? propConnections : DEFAULT_CONNECTIONS);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [svgSize, setSvgSize] = useState({ width: 720, height: 480 });
  const [containerRef, setContainerRef] = useState(null);
  const [_tick, setTick] = useState(0);

  const refCallback = useCallback((el) => {
    setContainerRef(el);
  }, []);

  useEffect(() => {
    if (!containerRef) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSvgSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(containerRef);
    return () => ro.disconnect();
  }, [containerRef]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(interval);
  }, []);

  const statusMap = {
    nominal: { label: 'All Systems Nominal', color: '#13fc72', icon: 'CheckCircle2' },
    warning: { label: 'Load Warning Detected', color: '#f59e0b', icon: 'AlertTriangle' },
    critical: { label: 'Critical Fault Active', color: '#ef4444', icon: 'AlertOctagon' },
  };
  const currentStatus = statusMap[power_flow_status] || statusMap.nominal;
  const StatusIcon = Icons?.[currentStatus.icon] || Icons.HelpCircle;

  const nodeMap = nodes.reduce((acc, n) => { acc[n.id] = n; return acc; }, {});


  const nodeStats = [
    { label: 'Total Nodes', value: nodes.length, icon: 'Network' },
    { label: 'Active Flows', value: connections.length, icon: 'Activity' },
    { label: 'Avg Load', value: `${Math.round(nodes.reduce((s, n) => s + n.load, 0) / nodes.length)}%`, icon: 'BarChart2' },
    { label: 'Critical', value: nodes.filter(n => n.status === 'critical').length, icon: 'ShieldAlert' },
  ];

  return (
    <div className="relative w-full min-h-screen font-inter" style={{ background: '#0a0d16' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 55% at 50% 40%, rgba(15,251,223,0.06) 0%, rgba(19,252,114,0.04) 30%, transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(15,251,223,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,251,223,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 max-w-screen-xl mx-auto px-6 md:px-10 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Icons.Zap size={14} color="#0ffbdf" strokeWidth={1.5} />
              <span className="font-inter text-xs tracking-widest" style={{ color: 'rgba(15,251,223,0.6)' }}>BESS NETWORK VISUALIZATION</span>
            </div>
            <h1 className="font-inter text-2xl md:text-3xl font-semibold text-white tracking-tight">System Map</h1>
            <p className="font-inter text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Smart Power Distribution — Interactive Network Graph</p>
          </div>
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
            style={{
              background: `rgba(${power_flow_status === 'critical' ? '239,68,68' : power_flow_status === 'warning' ? '245,158,11' : '19,252,114'},0.08)`,
              border: `1px solid ${currentStatus.color}30`,
            }}
          >
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <StatusIcon size={14} color={currentStatus.color} strokeWidth={1.5} />
            </motion.div>
            <span className="font-inter text-xs font-medium" style={{ color: currentStatus.color }}>{currentStatus.label}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {nodeStats.map((stat, i) => {
            const StatIcon = Icons?.[stat.icon] || Icons.HelpCircle;
            return (
              <motion.div
                key={stat.label}
                className="rounded-2xl px-5 py-4"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(8px)',
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4, ease: 'easeOut' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <StatIcon size={12} color="#0ffbdf" strokeWidth={1.5} />
                  <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{stat.label.toUpperCase()}</span>
                </div>
                <span className="font-inter text-xl font-semibold text-white">{stat.value}</span>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(10,13,22,0.95)',
            border: '1px solid rgba(15,251,223,0.1)',
            boxShadow: '0 0 60px rgba(15,251,223,0.04), 0 4px 32px rgba(0,0,0,0.5)',
            minHeight: '640px',
          }}
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(15,251,223,0.03) 0%, transparent 65%)',
            }}
          />

          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-2">
              <Icons.GitBranch size={14} color="#0ffbdf" strokeWidth={1.5} />
              <span className="font-inter text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>NETWORK TOPOLOGY</span>
            </div>
            <div className="flex items-center gap-4">
              {['nominal', 'warning', 'critical'].map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: STATUS_COLORS[s].line, boxShadow: `0 0 4px ${STATUS_COLORS[s].glow}` }}
                  />
                  <span className="font-inter text-xs capitalize" style={{ color: 'rgba(255,255,255,0.3)' }}>{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            ref={refCallback}
            className="relative w-full"
            style={{ height: '560px' }}
          >
            <svg
              width={svgSize.width}
              height={svgSize.height}
              className="absolute inset-0"
              aria-label="Power network topology graph"
            >
              <defs>
                <radialGradient id="bessCoreGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#0ffbdf" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0ffbdf" stopOpacity="0" />
                </radialGradient>
              </defs>

              {connections.map((conn) => {
                const fromNode = nodeMap[conn.from];
                const toNode = nodeMap[conn.to];
                if (!fromNode || !toNode) return null;
                return (
                  <FlowLine
                    key={conn.id}
                    connection={conn}
                    fromNode={fromNode}
                    toNode={toNode}
                    power_flow_status={power_flow_status}
                    svgWidth={svgSize.width}
                    svgHeight={svgSize.height}
                  />
                );
              })}

              {nodes.map((node) => (
                <NetworkNode
                  key={node.id}
                  node={node}
                  isHovered={hoveredId === node.id}
                  isSelected={selectedNode?.id === node.id}
                  onHover={setHoveredId}
                  onLeave={() => setHoveredId(null)}
                  onClick={setSelectedNode}
                  svgWidth={svgSize.width}
                  svgHeight={svgSize.height}
                />
              ))}
            </svg>

            <AnimatePresence>
              {selectedNode && (
                <NodeModal
                  node={selectedNode}
                  onClose={() => setSelectedNode(null)}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="px-6 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icons.MousePointer size={11} color="rgba(255,255,255,0.25)" strokeWidth={1.5} />
                <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Click a node to inspect · Hover to highlight</span>
              </div>
              <motion.div
                className="flex items-center gap-1.5"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#13fc72', boxShadow: '0 0 6px rgba(19,252,114,0.8)' }} />
                <span className="font-inter text-xs" style={{ color: 'rgba(19,252,114,0.6)' }}>LIVE</span>
              </motion.div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
          {nodes.filter(n => n.id !== 'bess').map((node, i) => {
            const color = getNodeColor(node);
            const iconName = NODE_ICONS[node.type] || 'Circle';
            const NodeIcon = Icons?.[iconName] || Icons.HelpCircle;
            return (
              <motion.button
                key={node.id}
                className="text-left rounded-2xl px-5 py-4 transition-all duration-200"
                style={{
                  background: selectedNode?.id === node.id ? color.bg : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${selectedNode?.id === node.id ? color.border : 'rgba(255,255,255,0.06)'}`,
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05, duration: 0.35, ease: 'easeOut' }}
                whileHover={{ scale: 1.015 }}
                onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                aria-label={`Select node ${node.label}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex items-center justify-center w-7 h-7 rounded-xl"
                      style={{ background: color.bg, border: `1px solid ${color.border}` }}
                    >
                      <NodeIcon size={13} color={color.line} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="font-inter text-xs font-semibold text-white leading-tight">{node.label}</p>
                      <p className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{node.system}</p>
                    </div>
                  </div>
                  <div
                    className="px-2 py-0.5 rounded-lg"
                    style={{ background: color.bg }}
                  >
                    <span className="font-inter text-xs font-medium capitalize" style={{ color: color.text }}>{node.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div
                      className="h-1 rounded-full transition-all duration-700"
                      style={{ width: `${node.load}%`, background: `linear-gradient(90deg, ${color.line}, ${color.glow})` }}
                    />
                  </div>
                  <span className="font-inter text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>{node.load}%</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default SystemMap;
