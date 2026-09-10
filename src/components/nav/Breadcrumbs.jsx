/**
 * Путь до страницы.
 *
 * Раньше здесь была одна ссылка «← Все разборы». Она отвечает на «как
 * вернуться», но не на «где я оказался» — а человек из поиска попадает
 * сразу на разбор, минуя главную, и не знает, что рядом есть раздел.
 * Тот же путь уходит в разметку страницы (breadcrumbLd), чтобы выдача и
 * страница говорили одно и то же.
 */
import React from 'react';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';

export default function Breadcrumbs({ items, current }) {
  return (
    <nav aria-label="Где я" className="flex flex-wrap items-center gap-2 text-xs text-white/25">
      {items.map((item) => (
        <React.Fragment key={item.to}>
          <Link to={item.to} className="transition-colors hover:text-white/60">{item.label}</Link>
          <span aria-hidden="true" className="select-none text-white/15">/</span>
        </React.Fragment>
      ))}
      {/* Текущая страница — не ссылка: ссылка на саму себя никуда не ведёт. */}
      <span className="text-white/40">{current}</span>
    </nav>
  );
}
