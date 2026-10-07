import React, { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

/**
 * Число с «набегающей» анимацией.
 *
 * Начальное значение — итоговое число, а не 0. Сборка страниц и человек без
 * JavaScript видят первый кадр: если бы он был нулём, поисковик и превью
 * ссылки показывали бы «0 продуктов в каталоге». Анимация запускается только
 * в браузере, когда число попало на экран, и всегда заканчивается на `to`:
 * если её прервали (ушли со страницы, сменились свойства), число ставится
 * итоговым сразу. При «уменьшить движение» анимации нет вовсе.
 */
export default function Counter({ to, suffix = '', duration = 2000, className = '' }) {
  const [val, setVal] = useState(to);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current || reduce) return undefined;
    started.current = true;
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setVal(Math.round(ease * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setVal(0);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setVal(to);
    };
  }, [inView, to, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {val}{suffix}
    </span>
  );
}
