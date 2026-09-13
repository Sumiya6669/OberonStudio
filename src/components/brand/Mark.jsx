/**
 * Знак Tinker: буква T, зажатая в тисках.
 *
 * Губки держат заготовку, пока мастер её чинит, — это и есть работа студии.
 * Второй слой: то же самое читается как квадратные скобки, уместные для тех,
 * кто пишет код.
 *
 * Сетка 200×200, шаг 20. Три фигуры и две губки, плоско, без градиентов:
 * блеск на знаке превращает логотип в иконку виджета.
 */
export default function Mark({ size = 32, className = '', title }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} fill="none"
         className={className} role={title ? 'img' : 'presentation'}
         aria-label={title} aria-hidden={title ? undefined : true}>
      {/* губки тисков — акцентный цвет */}
      <path d="M 44 40 L 26 40 L 26 160 L 44 160" fill="none" stroke="currentColor"
            strokeWidth="16" strokeLinejoin="round" strokeLinecap="round"
            className="text-primary" style={{ stroke: 'hsl(var(--primary))' }} />
      <path d="M 156 40 L 174 40 L 174 160 L 156 160" fill="none"
            strokeWidth="16" strokeLinejoin="round" strokeLinecap="round"
            style={{ stroke: 'hsl(var(--primary))' }} />
      {/* буква T — цветом текста, поэтому знак работает на любом фоне */}
      <path d="M 48 58 L 152 58" stroke="currentColor" strokeWidth="22" strokeLinecap="round" />
      <path d="M 100 58 L 100 150" stroke="currentColor" strokeWidth="22" strokeLinecap="round" />
    </svg>
  );
}
