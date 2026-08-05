import React from 'react';
import { motion } from 'framer-motion';
import Reveal from '../core/Reveal';

const LINE1 = 'AI AUTOMATION · INTELLIGENT SYSTEMS · BUSINESS SOLUTIONS · ';
const LINE2 = '· 1C DEVELOPMENT · CRM · AI AGENTS · FULL STACK · ';

function MarqueeLine({ text, reverse = false, duration = 32 }) {
  // Duplicate text so the loop is seamless
  const content = text + text + text;
  return (
    <div className="overflow-hidden">
      <motion.p
        className="text-[clamp(2rem,8vw,7rem)] font-black text-white/[0.04] leading-none whitespace-nowrap tracking-tight"
        animate={{ x: reverse ? ['0%', '33.33%'] : ['0%', '-33.33%'] }}
        transition={{ duration, ease: 'linear', repeat: Infinity }}
        style={{ willChange: 'transform' }}
      >
        {content}
      </motion.p>
    </div>
  );
}

export default function Manifesto() {
  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface to-background" />

      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-5 mb-10">
          <Reveal>
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-line" />
              <span className="text-xs font-medium tracking-[0.3em] text-white/20 uppercase">Albert Gaan</span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-line" />
            </div>
          </Reveal>
        </div>

        <div className="space-y-2">
          <MarqueeLine text={LINE1} reverse={false} duration={36} />
          <MarqueeLine text={LINE2} reverse={true} duration={28} />
        </div>
      </div>
    </section>
  );
}