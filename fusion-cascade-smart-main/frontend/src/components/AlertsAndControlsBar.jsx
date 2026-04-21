import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';

const ALERT_DISPLAY_INTERVAL = 3200;

const SEVERITY_CONFIG = {
  error: {
    icon: 'AlertOctagon',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/60',
    glowClass: 'shadow-[0_0_10px_rgba(239,68,68,0.45)]',
    dotColor: 'bg-red-500',
    badgeBg: 'bg-red-500/15',
  },
  warning: {
    icon: 'AlertTriangle',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/50',
    glowClass: 'shadow-[0_0_8px_rgba(245,158,11,0.35)]',
    dotColor: 'bg-amber-400',
    badgeBg: 'bg-amber-500/12',
  },
  info: {
    icon: 'Info',
    textColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/40',
    glowClass: '',
    dotColor: 'bg-cyan-400',
    badgeBg: 'bg-cyan-500/10',
  },
};

const CONTROL_BUTTONS = [
  {
    id: 'reroute',
    label: 'Reroute',
    icon: 'GitBranch',
    borderColor: 'border-emerald-400/70',
    textColor: 'text-emerald-400',
    hoverBg: 'hover:bg-emerald-400/10',
    glowColor: 'shadow-[0_0_18px_rgba(52,211,153,0.55)]',
    activeGlow: 'shadow-[0_0_28px_rgba(52,211,153,0.85)]',
    pulseColor: 'emerald',
  },
  {
    id: 'emergency',
    label: 'Emergency',
    icon: 'ShieldAlert',
    borderColor: 'border-red-400/70',
    textColor: 'text-red-400',
    hoverBg: 'hover:bg-red-400/10',
    glowColor: 'shadow-[0_0_18px_rgba(248,113,113,0.55)]',
    activeGlow: 'shadow-[0_0_28px_rgba(248,113,113,0.9)]',
    pulseColor: 'red',
  },
  {
    id: 'reset',
    label: 'Reset',
    icon: 'RotateCcw',
    borderColor: 'border-amber-400/70',
    textColor: 'text-amber-400',
    hoverBg: 'hover:bg-amber-400/10',
    glowColor: 'shadow-[0_0_18px_rgba(251,191,36,0.5)]',
    activeGlow: 'shadow-[0_0_28px_rgba(251,191,36,0.85)]',
    pulseColor: 'amber',
  },
];

function AlertsAndControlsBar({ alerts_list = [] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [activeControls, setActiveControls] = useState({});
  const [feedbackMap, setFeedbackMap] = useState({});
  const intervalRef = useRef(null);

  const alerts = alerts_list.length > 0 ? alerts_list : [];

  useEffect(() => {
    if (alerts.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setActiveIndex(prev => (prev + 1) % alerts.length);
        setIsVisible(true);
      }, 350);
    }, ALERT_DISPLAY_INTERVAL);

    return () => clearInterval(intervalRef.current);
  }, [alerts.length]);

  const handleControlClick = (controlId) => {
    setActiveControls(prev => ({ ...prev, [controlId]: true }));
    setFeedbackMap(prev => ({ ...prev, [controlId]: 'active' }));

    setTimeout(() => {
      setFeedbackMap(prev => ({ ...prev, [controlId]: 'done' }));
    }, 1200);

    setTimeout(() => {
      setActiveControls(prev => ({ ...prev, [controlId]: false }));
      setFeedbackMap(prev => ({ ...prev, [controlId]: null }));
    }, 2200);
  };

  const currentAlert = alerts[activeIndex] ?? null;
  const severity = currentAlert?.severity ?? 'info';
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;
  const AlertIcon = Icons?.[config.icon] ?? Icons.HelpCircle;

  const errorCount = alerts.filter(a => a?.severity === 'error').length;
  const warningCount = alerts.filter(a => a?.severity === 'warning').length;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-60 px-4 pb-4">
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
        className="max-w-screen-xl mx-auto"
      >
        <div
          className={`
            relative flex items-center justify-between gap-4
            rounded-2xl border px-5 py-3
            bg-white/98 backdrop-blur-[20px]
            border-gray-200
            shadow-[0_8px_32px_rgba(0,0,0,0.08),0_1px_0_rgba(255,255,255,0.9)_inset]
          `}
        >
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/3 via-transparent to-green-500/3" />
          </div>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              {errorCount > 0 && (
                <div className="flex items-center gap-1 bg-red-500/15 border border-red-500/30 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs font-semibold font-inter tabular-nums">{errorCount}</span>
                </div>
              )}
              {warningCount > 0 && (
                <div className="flex items-center gap-1 bg-amber-500/12 border border-amber-500/25 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-amber-400 text-xs font-semibold font-inter tabular-nums">{warningCount}</span>
                </div>
              )}
              {alerts.length === 0 && (
                <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-emerald-400 text-xs font-semibold font-inter">OK</span>
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-gray-300 shrink-0" />

            <div className="flex-1 min-w-0 overflow-hidden">
              {alerts.length === 0 ? (
                <div className="flex items-center gap-2">
                  <Icons.CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-green-600 text-sm font-inter font-medium truncate">
                    All systems nominal — no active alerts
                  </span>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {isVisible && currentAlert && (
                    <motion.div
                      key={activeIndex}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="flex items-center gap-2.5 min-w-0"
                    >
                      <div
                        className={`
                          flex items-center gap-2 px-2.5 py-1.5 rounded-xl border
                          ${config.badgeBg} ${config.borderColor}
                          ${severity === 'error' ? config.glowClass : ''}
                          shrink-0
                        `}
                      >
                        <AlertIcon className={`w-3.5 h-3.5 ${config.textColor} shrink-0`} />
                        <span className={`text-xs font-inter font-bold uppercase tracking-wider ${config.textColor}`}>
                          {severity}
                        </span>
                      </div>

                      <span className="text-gray-800 text-sm font-inter font-medium truncate leading-tight">
                        {currentAlert?.message ?? 'System alert'}
                      </span>

                      {currentAlert?.node && (
                        <span className="text-gray-500 text-xs font-inter shrink-0 hidden sm:block">
                          · {currentAlert.node}
                        </span>
                      )}

                      {alerts.length > 1 && (
                        <span className="text-gray-400 text-xs font-inter tabular-nums shrink-0 hidden md:block">
                          {activeIndex + 1}/{alerts.length}
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </div>

          <div className="w-px h-8 bg-gray-300 shrink-0 hidden sm:block" />

          <div className="flex items-center gap-2 shrink-0">
            {CONTROL_BUTTONS.map((btn) => {
              const BtnIcon = Icons?.[btn.icon] ?? Icons.HelpCircle;
              const isActive = activeControls[btn.id];
              const feedback = feedbackMap[btn.id];

              return (
                <motion.button
                  key={btn.id}
                  onClick={() => handleControlClick(btn.id)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                  animate={isActive ? { scale: [1, 1.06, 1] } : {}}
                  transition={isActive ? { duration: 0.4, repeat: 2, ease: 'easeInOut' } : { duration: 0.15 }}
                  aria-label={`${btn.label} control`}
                  className={`
                    relative flex items-center gap-2
                    rounded-full border px-3.5 py-2
                    font-inter font-semibold text-xs tracking-wide
                    transition-all duration-200 cursor-pointer
                    ${btn.borderColor} ${btn.textColor} ${btn.hoverBg}
                    bg-transparent
                    ${isActive ? btn.activeGlow : btn.glowColor}
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40
                  `}
                >
                  {feedback === 'done' ? (
                    <Icons.Check className="w-3.5 h-3.5" />
                  ) : (
                    <BtnIcon className={`w-3.5 h-3.5 ${isActive ? 'animate-spin' : ''}`} />
                  )}
                  <span className="hidden sm:inline">
                    {feedback === 'active' ? 'Processing…' : feedback === 'done' ? 'Done' : btn.label}
                  </span>
                  {isActive && (
                    <motion.span
                      className={`absolute inset-0 rounded-full border ${btn.borderColor} opacity-60`}
                      animate={{ scale: [1, 1.45], opacity: [0.6, 0] }}
                      transition={{ duration: 0.75, repeat: Infinity, ease: 'easeOut' }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default AlertsAndControlsBar;
