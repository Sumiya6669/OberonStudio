import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function MagBtn({ children, className = '' }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    setPos({
      x: (e.clientX - r.left - r.width / 2) * 0.25,
      y: (e.clientY - r.top - r.height / 2) * 0.25,
    });
  };
  const onLeave = () => setPos({ x: 0, y: 0 });

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      animate={pos}
      transition={{ type: 'spring', stiffness: 180, damping: 12, mass: 0.1 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}