import React, { useState } from 'react';
import { MessageSquare, Phone, X, HelpCircle } from 'lucide-react';
import { useCart } from '../CartContext';
import { motion, AnimatePresence } from 'motion/react';

export const LineContact: React.FC = () => {
  const { settings } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  // If settings are not loaded yet, or contact information is not provided, we can fall back to defaults
  const lineLink = settings?.lineLink || 'https://line.me';
  const phone = settings?.phone || '081-234-5678';

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 select-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="flex flex-col gap-3 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 min-w-[220px]"
          >
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider px-1">
              ช่องทางการติดต่อ
            </div>
            
            {/* Line Link Button */}
            <a
              href={lineLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md shadow-emerald-500/10 active:scale-95 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-[10px] text-emerald-100 font-medium">คุยผ่านเมสเซนเจอร์</div>
                <div>LINE Official</div>
              </div>
            </a>

            {/* Phone Dial Button */}
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-md shadow-orange-500/10 active:scale-95 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-[10px] text-orange-100 font-medium">โทรติดต่อด่วน</div>
                <div>{phone}</div>
              </div>
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Floating Bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all cursor-pointer ${
          isOpen 
            ? 'bg-slate-800 hover:bg-slate-900 shadow-slate-900/10' 
            : 'bg-gradient-to-tr from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/20'
        }`}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close-icon"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="chat-icon"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative flex items-center justify-center"
            >
              <HelpCircle className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
};
