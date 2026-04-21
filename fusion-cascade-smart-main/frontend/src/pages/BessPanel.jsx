import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';

const Icon = ({ name, ...props }) => {
  const LIcon = Icons?.[name] || Icons.HelpCircle;
  return <LIcon {...props} />;
};

function MiniSparkline({ points, color, height = 44 }) {
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
  const gradId = `bess-spark-${color.replace('#', '')}`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block w-full">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id="bess-spark-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" filter="url(#bess-spark-glow)" />
    </svg>
  );
}

function BatteryBar({ percent, status }) {
  const segments = 20;
  const filled = Math.round((percent / 100) * segments);
  const barColor = percent > 60 ? '#13fc72' : percent > 25 ? '#f59e0b' : '#ef4444';
  const glowColor = percent > 60 ? 'rgba(19,252,114,0.5)' : percent > 25 ? 'rgba(245,158,11,0.5)' : 'rgba(239,68,68,0.5)';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-inter text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>State of Charge</span>
        <span className="font-inter text-sm font-bold" style={{ color: barColor }}>{percent}%</span>
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: segments }, (_, i) => (
          <motion.div
            key={i}
            className="flex-1 h-4 rounded-sm"
            style={{
              background: i < filled ? barColor : 'rgba(255,255,255,0.06)',
              boxShadow: i < filled ? `0 0 6px ${glowColor}` : 'none',
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.03, duration: 0.25, ease: 'easeOut' }}
          />
        ))}
        <div className="w-2 h-2.5 rounded-r-sm ml-0.5" style={{ background: 'rgba(255,255,255,0.12)' }} />
      </div>
      <div className="flex items-center gap-1.5">
        <motion.div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: barColor }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{status}</span>
      </div>
    </div>
  );
}

function StatRow({ icon, label, value, valueColor, unit }) {
  return (
    <div
      className="flex items-center justify-between py-2.5 px-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.03)' }}
    >
      <div className="flex items-center gap-2">
        <Icon name={icon} size={12} color="rgba(15,251,223,0.55)" strokeWidth={1.5} />
        <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>{label}</span>
      </div>
      <span className={`font-inter text-xs font-semibold tabular-nums ${valueColor || 'text-white'}`}>
        {value}{unit ? <span className="font-normal text-white/30 ml-0.5">{unit}</span> : null}
      </span>
    </div>
  );
}

export default function BessPanel({ stats, graphPoints }) {
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
    <motion.aside
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
      className="flex flex-col gap-4 w-full"
    >
      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{
          background: 'rgba(10,13,22,0.92)',
          border: '1px solid rgba(19,252,114,0.12)',
          boxShadow: '0 0 40px rgba(19,252,114,0.05), 0 4px 24px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-xl"
              style={{ background: 'rgba(19,252,114,0.1)', border: '1px solid rgba(19,252,114,0.25)' }}
            >
              <Icon name="Battery" size={15} color="#13fc72" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-inter text-sm font-semibold text-white leading-tight">BESS Core</p>
              <p className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Battery Storage Unit</p>
            </div>
          </div>
          <div
            className="px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(19,252,114,0.1)', border: '1px solid rgba(19,252,114,0.25)' }}
          >
            <span className="font-inter text-xs font-medium" style={{ color: '#13fc72' }}>Online</span>
          </div>
        </div>

        <BatteryBar percent={Math.round(localStats.chargePercent)} status={localStats.chargeStatus} />

        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-xl p-3 flex flex-col gap-1"
            style={{ background: 'rgba(19,252,114,0.06)', border: '1px solid rgba(19,252,114,0.12)' }}
          >
            <div className="flex items-center gap-1.5">
              <Icon name="ArrowDownRight" size={11} color="#13fc72" strokeWidth={2} />
              <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>INPUT</span>
            </div>
            <span className="font-inter text-lg font-bold tabular-nums" style={{ color: '#13fc72' }}>
              {localStats.inputKw.toFixed(1)}
            </span>
            <span className="font-inter text-xs" style={{ color: 'rgba(19,252,114,0.5)' }}>kW</span>
          </div>
          <div
            className="rounded-xl p-3 flex flex-col gap-1"
            style={{ background: 'rgba(15,251,223,0.06)', border: '1px solid rgba(15,251,223,0.12)' }}
          >
            <div className="flex items-center gap-1.5">
              <Icon name="ArrowUpRight" size={11} color="#0ffbdf" strokeWidth={2} />
              <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>OUTPUT</span>
            </div>
            <span className="font-inter text-lg font-bold tabular-nums" style={{ color: '#0ffbdf' }}>
              {localStats.outputKw.toFixed(1)}
            </span>
            <span className="font-inter text-xs" style={{ color: 'rgba(15,251,223,0.5)' }}>kW</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-inter text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.28)' }}>Power Flow</span>
            <motion.div
              className="flex items-center gap-1"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="w-1 h-1 rounded-full" style={{ background: '#13fc72' }} />
              <span className="font-inter text-xs" style={{ color: 'rgba(19,252,114,0.6)' }}>LIVE</span>
            </motion.div>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <MiniSparkline points={localPoints} color="#13fc72" height={52} />
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl p-5 flex flex-col gap-2"
        style={{
          background: 'rgba(10,13,22,0.88)',
          border: '1px solid rgba(15,251,223,0.09)',
          boxShadow: '0 0 24px rgba(15,251,223,0.04)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <span className="font-inter text-xs tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>System Metrics</span>
        <div className="flex flex-col gap-1">
          <StatRow icon="Thermometer" label="Temperature" value={`${localStats.temperature.toFixed(1)}`} unit="°C" />
          <StatRow icon="RefreshCw" label="Cycles" value={`${localStats.cycles}`} />
          <StatRow icon="ShieldCheck" label="Cell Health" value={`${localStats.health}%`} valueColor="text-emerald-400" />
          <StatRow icon="Zap" label="Efficiency" value={`${localStats.efficiency.toFixed(1)}%`} valueColor="text-cyan-400" />
          <StatRow icon="Activity" label="Grid Freq." value={`${localStats.gridFrequency.toFixed(3)}`} unit="Hz" />
          <StatRow
            icon="Layers"
            label="Active Cells"
            value={`${localStats.activeCells}/${localStats.totalCells}`}
            valueColor={localStats.activeCells >= 1900 ? 'text-emerald-400' : 'text-amber-400'}
          />
        </div>
      </div>
    </motion.aside>
  );
}
