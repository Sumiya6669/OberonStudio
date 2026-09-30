import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Переход между страницами.
 *
 * Обёртка живёт внутри AnimatePresence с mode="wait": сначала уходит
 * старая страница, потом появляется новая. Уход короче прихода — 180 мс
 * против 420: долгий уход читается как задержка сайта, долгий приход —
 * как плавность.
 *
 * Прокрутка наверх стоит здесь, а не в отдельном ScrollToTop по смене
 * адреса, и это главное. Раньше она срабатывала в момент клика, пока
 * старая страница ещё была на экране: человек видел, как содержимое
 * дёргается вверх, и только потом менялось. Теперь скролл происходит в
 * первом кадре новой страницы, когда её прозрачность ещё ноль — рывок
 * есть, но он под затемнением, и глазу его не видно.
 *
 * Мгновенно, а не behavior: 'smooth', тоже намеренно. Плавная докрутка
 * с конца длинной страницы занимает около секунды, и всё это время
 * человек смотрит на пролетающий мимо чужой контент. Это не плавность,
 * это ожидание.
 */
export default function PageTransition({ children, routeKey }) {
  const bezDvizheniya = useReducedMotion();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [routeKey]);

  if (bezDvizheniya) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{
        opacity: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
        y: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
      }}
    >
      {children}
    </motion.div>
  );
}
