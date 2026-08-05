import React, { useEffect, useRef } from 'react';

export default function CursorGlow() {
  const glowRef = useRef(null);
  const ringRef = useRef(null);
  let raf;
  let cx = -200, cy = -200;
  let tx = -200, ty = -200;

  useEffect(() => {
    const glow = glowRef.current;
    const ring = ringRef.current;
    if (!glow || !ring) return;

    const onMove = (e) => {
      tx = e.clientX;
      ty = e.clientY;
    };

    const animate = () => {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      if (glow) {
        glow.style.transform = `translate(${tx - 300}px, ${ty - 300}px)`;
      }
      if (ring) {
        ring.style.transform = `translate(${cx - 20}px, ${cy - 20}px)`;
      }
      raf = requestAnimationFrame(animate);
    };
    animate();

    window.addEventListener('mousemove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <>
      {/* Ambient glow */}
      <div
        ref={glowRef}
        className="pointer-events-none fixed top-0 left-0 z-0 w-[600px] h-[600px] rounded-full opacity-[0.06]"
        style={{
          background: 'radial-gradient(circle, hsl(220 100% 60%) 0%, transparent 70%)',
          willChange: 'transform',
        }}
      />
      {/* Ring cursor */}
      <div
        ref={ringRef}
        className="pointer-events-none fixed top-0 left-0 z-50 w-10 h-10 rounded-full border border-blue/30"
        style={{ willChange: 'transform' }}
      />
    </>
  );
}