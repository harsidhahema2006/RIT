import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';

function BessPanel({
  battery_percentage = 72,
  charging_status = 'charging',
  input_power_kw = 48.3,
  output_power_kw = 31.7,
  energy_level_data = [],
}) {
  const canvasRef = useRef(null);

  const [displayPercent, setDisplayPercent] = useState(0);

  const clampedPercent = Math.min(100, Math.max(0, battery_percentage));
  const isCharging = charging_status === 'charging';

  const graphData =
    energy_level_data.length >= 2
      ? energy_level_data
      : Array.from({ length: 24 }, (_, i) => {
          const base = 60 + Math.sin(i * 0.4) * 20;
          return Math.max(10, Math.min(100, base + (Math.random() - 0.5) * 10));
        });

  useEffect(() => {
    let frame;
    let current = 0;
    const target = clampedPercent;
    const step = () => {
      current += (target - current) * 0.06;
      setDisplayPercent(Math.round(current));
      if (Math.abs(target - current) > 0.5) {
        frame = requestAnimationFrame(step);
      } else {
        setDisplayPercent(target);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [clampedPercent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const pts = graphData.slice(-24);
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;

    ctx.clearRect(0, 0, W, H);

    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#13fc72');
    grad.addColorStop(1, '#0ffbdf');

    const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
    fillGrad.addColorStop(0, 'rgba(19,252,114,0.22)');
    fillGrad.addColorStop(1, 'rgba(15,251,223,0.01)');

    const xStep = W / (pts.length - 1);
    const getY = (v) => H - ((v - min) / range) * (H * 0.82) - H * 0.06;

    ctx.beginPath();
    pts.forEach((v, i) => {
      const x = i * xStep;
      const y = getY(v);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const px = (i - 1) * xStep;
        const py = getY(pts[i - 1]);
        const cpx = (px + x) / 2;
        ctx.bezierCurveTo(cpx, py, cpx, y, x, y);
      }
    });
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.lineTo((pts.length - 1) * xStep, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    return () => {};
  }, [graphData]);

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (clampedPercent / 100) * circumference;
  const gap = circumference - strokeDash;

  const BoltIcon = Icons.Zap;
  const ArrowDownIcon = Icons.ArrowDownCircle;
  const ArrowUpIcon = Icons.ArrowUpCircle;
  const ActivityIcon = Icons.Activity;

  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative w-80 flex flex-col gap-5 rounded-2xl p-6 overflow-hidden"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 30% 10%, rgba(19,252,114,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 90%, rgba(15,251,223,0.06) 0%, transparent 55%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          backgroundColor: 'rgba(14,18,32,0.82)',
        }}
      />

      <div className="relative z-10 flex flex-col gap-5">

        <div className="flex items-center justify-between">
          <span className="text-xs font-inter font-semibold tracking-widest uppercase text-white/40">
            BESS Monitor
          </span>
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-inter text-white/30 tracking-widest uppercase">Live</span>
          </motion.span>
        </div>

        <div className="flex flex-col items-center justify-center py-2">
          <div className="relative w-48 h-48">
            <svg
              width="192"
              height="192"
              viewBox="0 0 192 192"
              className="absolute inset-0 -rotate-90"
            >
              <circle
                cx="96"
                cy="96"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="10"
              />
              <motion.circle
                cx="96"
                cy="96"
                r={radius}
                fill="none"
                stroke="url(#bessGrad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${strokeDash} ${gap}`}
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${strokeDash} ${gap}` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{ filter: 'drop-shadow(0 0 8px rgba(19,252,114,0.6))' }}
              />
              <defs>
                <linearGradient id="bessGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#13fc72" />
                  <stop offset="100%" stopColor="#0ffbdf" />
                </linearGradient>
              </defs>
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                key={displayPercent}
                initial={{ scale: 0.9, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="text-5xl font-inter font-black leading-none tracking-tight"
                style={{ color: '#13fc72', textShadow: '0 0 20px rgba(19,252,114,0.7)' }}
              >
                {displayPercent}
              </motion.span>
              <span className="text-sm font-inter font-semibold text-white/40 mt-0.5">%</span>
              <span className="text-[10px] font-inter tracking-widest text-white/25 uppercase mt-1">Capacity</span>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={charging_status}
              initial={{ opacity: 0, scale: 0.9, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex items-center gap-2 px-4 py-2"
              style={{
                borderRadius: '8px',
                background: isCharging
                  ? 'rgba(19,252,114,0.12)'
                  : 'rgba(255,72,72,0.12)',
                border: isCharging
                  ? '1px solid rgba(19,252,114,0.3)'
                  : '1px solid rgba(255,72,72,0.3)',
                boxShadow: isCharging
                  ? '0 0 14px rgba(19,252,114,0.15)'
                  : '0 0 14px rgba(255,72,72,0.15)',
              }}
            >
              <BoltIcon
                size={14}
                className={isCharging ? 'text-emerald-400' : 'text-red-400'}
              />
              <span
                className="text-xs font-inter font-bold tracking-widest uppercase"
                style={{ color: isCharging ? '#13fc72' : '#ff4848' }}
              >
                {isCharging ? 'Charging' : 'Discharging'}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex flex-col gap-2 rounded-xl p-4"
            style={{
              background: 'rgba(19,252,114,0.07)',
              border: '1px solid rgba(19,252,114,0.18)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <ArrowDownIcon size={12} className="text-emerald-400" />
              <span className="text-[10px] font-inter font-semibold uppercase tracking-widest text-white/35">
                Input
              </span>
            </div>
            <div className="flex items-end gap-1">
              <span
                className="text-xl font-inter font-black leading-none"
                style={{ color: '#13fc72', textShadow: '0 0 10px rgba(19,252,114,0.5)' }}
              >
                {input_power_kw.toFixed(1)}
              </span>
              <span className="text-[10px] font-inter text-white/30 mb-0.5">kW</span>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex flex-col gap-2 rounded-xl p-4"
            style={{
              background: 'rgba(255,72,72,0.07)',
              border: '1px solid rgba(255,72,72,0.18)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <ArrowUpIcon size={12} className="text-red-400" />
              <span className="text-[10px] font-inter font-semibold uppercase tracking-widest text-white/35">
                Output
              </span>
            </div>
            <div className="flex items-end gap-1">
              <span
                className="text-xl font-inter font-black leading-none"
                style={{ color: '#ff4848', textShadow: '0 0 10px rgba(255,72,72,0.5)' }}
              >
                {output_power_kw.toFixed(1)}
              </span>
              <span className="text-[10px] font-inter text-white/30 mb-0.5">kW</span>
            </div>
          </motion.div>
        </div>

        <div
          className="flex flex-col gap-3 rounded-xl p-4"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ActivityIcon size={12} className="text-white/40" />
              <span className="text-[10px] font-inter font-semibold uppercase tracking-widest text-white/35">
                Energy Flux
              </span>
            </div>
            <span className="text-[10px] font-inter text-white/20">24h</span>
          </div>
          <div className="w-full" style={{ height: '64px' }}>
            <canvas
              ref={canvasRef}
              width={272}
              height={64}
              className="w-full h-full"
              style={{ display: 'block' }}
            />
          </div>
        </div>

      </div>
    </motion.div>
  );
}

export default BessPanel;