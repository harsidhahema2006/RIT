import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';

const CONSUMER_COLORS = {
  Home: { bar: 'bg-cyan-400', glow: 'shadow-cyan-400/40', text: 'text-cyan-300', bg: 'bg-cyan-400/10' },
  Factory: { bar: 'bg-yellow-400', glow: 'shadow-yellow-400/40', text: 'text-yellow-300', bg: 'bg-yellow-400/10' },
  Industry: { bar: 'bg-emerald-400', glow: 'shadow-emerald-400/40', text: 'text-emerald-300', bg: 'bg-emerald-400/10' },
};

const CHART_H = 80;
const CHART_W = 260;

function buildPath(data, maxVal, w, h) {
  if (!data || data.length < 2) return '';
  const step = w / (data.length - 1);
  return data
    .map((v, i) => {
      const x = i * step;
      const y = h - (v / maxVal) * (h - 8) - 4;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function DemandChart({ actual, predicted }) {
  const allVals = [...(actual || []), ...(predicted || [])];
  const maxVal = Math.max(...allVals, 1) * 1.1;
  const actualPath = buildPath(actual, maxVal, CHART_W, CHART_H);
  const predictedPath = buildPath(predicted, maxVal, CHART_W, CHART_H);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-inter font-semibold tracking-widest uppercase text-slate-400">Demand Forecast</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-cyan-300 font-inter">
            <span className="w-3 h-0.5 rounded-full bg-cyan-400 inline-block"></span>Actual
          </span>
          <span className="flex items-center gap-1 text-[10px] text-violet-300 font-inter">
            <span className="w-3 h-0.5 rounded-full bg-violet-400 inline-block"></span>LSTM
          </span>
        </div>
      </div>
      <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900/60 border border-cyan-500/10 p-2">
        <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H + 8}`} preserveAspectRatio="none" className="block">
          <defs>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
            <filter id="glowCyan">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glowViolet">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1="0" y1={(CHART_H - t * (CHART_H - 8) - 4).toFixed(1)}
              x2={CHART_W} y2={(CHART_H - t * (CHART_H - 8) - 4).toFixed(1)}
              stroke="#334155" strokeWidth="0.5" strokeDasharray="3 4"
            />
          ))}
          {predictedPath && (
            <>
              <path d={`${predictedPath} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`} fill="url(#predGrad)" />
              <path d={predictedPath} fill="none" stroke="#a78bfa" strokeWidth="1.5" filter="url(#glowViolet)" strokeDasharray="5 3" />
            </>
          )}
          {actualPath && (
            <>
              <path d={`${actualPath} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`} fill="url(#actualGrad)" />
              <path d={actualPath} fill="none" stroke="#22d3ee" strokeWidth="2" filter="url(#glowCyan)" />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

function RoutingPanel({ allocations }) {
  const sorted = [...(allocations || [])].sort((a, b) => b.value - a.value);
  const maxVal = Math.max(...sorted.map((a) => a.value), 1);

  const iconMap = { Home: 'Home', Factory: 'Factory', Industry: 'Zap' };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-inter font-semibold tracking-widest uppercase text-slate-400">Routing Allocation</span>
        <span className="text-[10px] text-emerald-400 font-inter tracking-wide uppercase">Live</span>
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
              className={`flex flex-col gap-1.5 rounded-2xl p-3 ${colors.bg} border border-white/5`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${colors.bg}`}>
                    <IconComp size={12} className={colors.text} />
                  </div>
                  <span className={`text-xs font-inter font-medium ${colors.text}`}>{item.type}</span>
                </div>
                <span className={`text-xs font-inter font-semibold tabular-nums ${colors.text}`}>
                  {item.value.toFixed(1)} MW
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
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
  const [blink, setBlink] = useState(true);
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
    }, 2000);
    return () => clearInterval(interval);
  }, [decisions]);

  useEffect(() => {
    const blinkInterval = setInterval(() => setBlink((b) => !b), 600);
    return () => clearInterval(blinkInterval);
  }, []);

  const severityStyle = (severity) => {
    if (severity === 'critical') return 'text-red-400';
    if (severity === 'warning') return 'text-yellow-300';
    return 'text-emerald-300';
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-inter font-semibold tracking-widest uppercase text-slate-400">AI Decision Feed</span>
        <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-inter">
          <Icons.Brain size={10} />
          LSTM Active
        </span>
      </div>
      <div
        ref={containerRef}
        className="relative flex flex-col gap-1.5 overflow-hidden rounded-2xl bg-slate-900/70 border border-emerald-500/10 p-3"
        style={{ minHeight: '160px', maxHeight: '200px' }}
      >
        <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ boxShadow: 'inset 0 0 20px 0 rgba(16,251,223,0.04)' }} />
        <AnimatePresence mode="popLayout">
          {visibleDecisions.map((item, idx) => {
            const isLast = idx === visibleDecisions.length - 1;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: isLast ? 1 : 0.55 + idx * 0.07, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex items-start gap-2 min-w-0"
              >
                {isLast ? (
                  <span
                    className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-150 ${
                      blink ? 'bg-emerald-400 shadow-emerald-400/80 shadow-sm' : 'bg-emerald-900'
                    }`}
                  />
                ) : (
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                )}
                <div className="flex flex-col min-w-0">
                  <span
                    className={`text-[11px] font-inter font-medium leading-snug truncate ${
                      isLast ? severityStyle(item.severity) : 'text-slate-400'
                    }`}
                  >
                    {item.action}
                  </span>
                  <span className="text-[9px] text-slate-600 font-inter tabular-nums">{item.timestamp}</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function DemandRoutingAi({
  actual_demand_data,
  predicted_demand_data,
  allocation_per_consumer,
  ai_decision_feed,
}) {
  return (
    <div className="w-80 shrink-0 flex flex-col gap-4 font-inter">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="rounded-2xl bg-slate-950/80 border border-cyan-500/10 backdrop-blur-md p-4 flex flex-col gap-1"
        style={{ boxShadow: '0 0 32px 0 rgba(14,251,233,0.06), inset 0 1px 0 rgba(255,255,255,0.04)' }}
      >
        <DemandChart actual={actual_demand_data} predicted={predicted_demand_data} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
        className="rounded-2xl bg-slate-950/80 border border-cyan-500/10 backdrop-blur-md p-4 flex flex-col gap-1"
        style={{ boxShadow: '0 0 32px 0 rgba(14,251,233,0.06), inset 0 1px 0 rgba(255,255,255,0.04)' }}
      >
        <RoutingPanel allocations={allocation_per_consumer} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
        className="rounded-2xl bg-slate-950/80 border border-emerald-500/10 backdrop-blur-md p-4 flex flex-col gap-1"
        style={{ boxShadow: '0 0 32px 0 rgba(13,252,114,0.06), inset 0 1px 0 rgba(255,255,255,0.04)' }}
      >
        <AIDecisionFeed decisions={ai_decision_feed} />
      </motion.div>
    </div>
  );
}
