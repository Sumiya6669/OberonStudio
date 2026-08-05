import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SiteNav from '../nav/SiteNav';
import SiteFooter from './SiteFooter';
import Consultant from '../chat/Consultant';
import CursorGlow from '../core/CursorGlow';

/**
 * Раскладка публичного сайта.
 * На десктопе слева фиксированная панель навигации — контент сдвинут на её ширину.
 * На мобильных панель превращается в верхнюю полосу с выдвижным меню.
 */
export default function SiteLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <div className="min-h-screen bg-background font-inter">
      <CursorGlow />
      <SiteNav />

      <div className="lg:pl-[248px] flex flex-col min-h-screen overflow-x-hidden">
        <main className={isHome ? 'flex-1 pt-16 lg:pt-0' : 'flex-1 pt-24 lg:pt-16'}>
          <Outlet />
        </main>
        <SiteFooter />
      </div>

      <Consultant />
    </div>
  );
}
