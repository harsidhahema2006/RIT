import { useState } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';

export default function Header() {
  const [isPowered, setIsPowered] = useState(true);
  const PowerIcon = isPowered ? Icons.Power : Icons.PowerOff;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full">
      <div className="absolute inset-0 bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-sm" />

      <div className="relative max-w-screen-2xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex items-center gap-2.5 select-none"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500 shadow-md shadow-blue-200">
            <Icons.Zap size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-inter font-extrabold text-base tracking-tight text-gray-800">
              energy<span className="text-blue-500">grid</span>
            </span>
            <span className="font-inter text-[10px] text-gray-500 tracking-widest uppercase">collective</span>
          </div>
        </motion.div>

        {/* Center title */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="absolute left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-0.5"
        >
          <span className="font-inter font-semibold text-sm tracking-[0.12em] uppercase text-gray-700">
            Smart Power Distribution
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="font-inter text-[10px] tracking-[0.18em] uppercase text-gray-500">
              BESS Network Dashboard
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
        </motion.div>

        {/* Right controls */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
          className="flex items-center gap-3"
        >
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200">
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                isPowered ? 'bg-green-500 shadow-sm shadow-green-300' : 'bg-gray-300'
              }`}
            />
            <span className="font-inter text-[10px] font-medium tracking-widest uppercase text-gray-600">
              {isPowered ? 'Online' : 'Offline'}
            </span>
          </div>

          <motion.button
            onClick={() => setIsPowered((prev) => !prev)}
            whileTap={{ scale: 0.93 }}
            aria-label={isPowered ? 'Power off the grid' : 'Power on the grid'}
            aria-pressed={isPowered}
            className={`relative flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              isPowered
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-gray-100 border-gray-200 text-gray-400'
            }`}
          >
            <motion.div
              animate={{ rotate: isPowered ? 0 : 180 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              <PowerIcon size={16} strokeWidth={2} />
            </motion.div>
          </motion.button>
        </motion.div>
      </div>
    </header>
  );
}
