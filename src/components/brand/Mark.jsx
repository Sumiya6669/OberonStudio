/**
 * Знак Tinker: буква T, зажатая в тисках.
 *
 * Губки держат заготовку, пока мастер её чинит, — это и есть работа студии.
 * Второй слой: то же самое читается как квадратные скобки, уместные для тех,
 * кто пишет код.
 *
 * Почему T — одна залитая фигура, а не две обводки.
 * Раньше перекладина и стойка были отдельными path со скруглёнными концами.
 * На полупрозрачном цвете (а в шапке он именно такой) они накладывались друг
 * на друга в месте стыка, и перекрытие давало не 0.85, а 0.98 — стойка
 * выглядела светлее перекладины, буква переставала быть единой. Одна заливка
 * такого стыка не имеет и держит ровный тон при любой прозрачности.
 *
 * variant:
 *   static — по умолчанию, без движения
 *   reveal — губки сводятся, буква садится на место (0,85 с, один раз)
 *   loop   — губки дышат, буква чуть поджимается: это загрузчик
 *
 * Обе анимации отключаются системной настройкой «меньше движения».
 */
export default function Mark({ size = 32, className = '', title, variant = 'static' }) {
  const v = variant === 'static' ? '' : `mark--${variant}`;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} fill="none"
         className={`${v} ${className}`.trim()}
         role={title ? 'img' : 'presentation'}
         aria-label={title} aria-hidden={title ? undefined : true}>
      <g className="mark__jaw mark__jaw--l">
        <path d="M 44 40 L 26 40 L 26 160 L 44 160" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="16"
              strokeLinejoin="round" strokeLinecap="round" />
      </g>
      <g className="mark__jaw mark__jaw--r">
        <path d="M 156 40 L 174 40 L 174 160 L 156 160" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="16"
              strokeLinejoin="round" strokeLinecap="round" />
      </g>
      {/* Буква — цветом текста, поэтому знак живёт на любом фоне */}
      <path className="mark__tee" fill="currentColor"
            d="M 48 47 L 152 47 A 11 11 0 0 1 152 69 L 111 69 L 111 150
               A 11 11 0 0 1 89 150 L 89 69 L 48 69 A 11 11 0 0 1 48 47 Z" />
    </svg>
  );
}
