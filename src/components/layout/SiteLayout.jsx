import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLocation, useOutlet } from 'react-router-dom';
import SiteNav from '../nav/SiteNav';
import SiteFooter from './SiteFooter';
import Consultant from '../chat/Consultant';
import CursorGlow from '../core/CursorGlow';
import RouteSeo from '@/lib/seo/RouteSeo';
import PageTransition from './PageTransition';

/**
 * Раскладка публичного сайта.
 * На десктопе слева фиксированная панель навигации — контент сдвинут на её ширину.
 * На мобильных панель превращается в верхнюю полосу с выдвижным меню.
 */
export default function SiteLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  // useOutlet, а не <Outlet />, и это не стилистика.
  //
  // <Outlet /> читает текущий маршрут в момент отрисовки. AnimatePresence
  // держит уходящую страницу как сохранённый элемент, но внутри него
  // <Outlet /> при следующей отрисовке показывал бы уже НОВУЮ страницу:
  // старая подменялась в кадре, высота документа менялась, и скролл
  // прыгал ещё до затухания. Замерами это и вылезло.
  //
  // useOutlet отдаёт готовый узел. Сохранённый элемент держит его в себе,
  // и уходящая страница остаётся собой до конца анимации.
  const stranica = useOutlet();

  return (
    <div className="min-h-screen bg-background font-inter">
      {/* Заголовок, описание и разметка страницы. Ничего не рисует. */}
      <RouteSeo />
      <CursorGlow />
      <SiteNav />

      <div className="lg:pl-[248px] flex flex-col min-h-screen overflow-x-hidden">
        <main className={isHome ? 'flex-1 pt-16 lg:pt-0' : 'flex-1 pt-24 lg:pt-16'}>
          {/* mode="wait": новая страница не наезжает на уходящую. Ключ —
              путь без параметров: смена раздела каталога через ?cat= это
              фильтр внутри страницы, а не переход, и гасить её ради этого
              нельзя. */}
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={pathname} routeKey={pathname}>
              {stranica}
            </PageTransition>
          </AnimatePresence>
        </main>
        <SiteFooter />
      </div>

      <Consultant />
    </div>
  );
}
