import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { LocaleLink as Link, LocaleNavLink as NavLink } from '@/components/nav/LocaleLink';
import {
  Home, Sparkles, FolderKanban, Package, Workflow,
  Layers, Star, HelpCircle, Mail, Menu, X,
} from 'lucide-react';
import { useLang } from '@/lib/i18n/LangContext';
import { SITE_ROUTES, CONTACT_PATH } from '@/lib/routes';
import LangSwitcher from './LangSwitcher';

const ICONS = { Home, Sparkles, FolderKanban, Package, Workflow, Layers, Star, HelpCircle, Mail };

function Logo({ onClick }) {
  return (
    <Link to="/" onClick={onClick} className="group flex items-center gap-3">
      <div className="relative w-9 h-9 flex-shrink-0">
        <div className="absolute inset-0 rounded-xl bg-primary opacity-20 group-hover:opacity-50 blur-md transition-opacity duration-500" />
        <div className="relative w-9 h-9 rounded-xl bg-surface-2 border border-line flex items-center justify-center">
          <span className="text-xs font-black text-gradient-blue">OS</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white/85 tracking-tight leading-tight">Oberon Studio</p>
        <p className="text-[10px] text-white/25 leading-tight">AI · CRM · 1C</p>
      </div>
    </Link>
  );
}

function NavItems({ onNavigate, compact }) {
  const { t } = useLang();

  return (
    <nav className="flex flex-col gap-0.5">
      {SITE_ROUTES.map(route => {
        const Icon = ICONS[route.icon] || Sparkles;
        return (
          <NavLink
            key={route.path}
            to={route.path}
            end={route.path === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3 transition-all duration-300 ${
                compact ? 'py-3.5 text-base' : 'py-2.5 text-sm'
              } ${
                isActive
                  ? 'bg-primary/10 text-white'
                  : 'text-white/40 hover:text-white/85 hover:bg-white/[0.03]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full bg-primary transition-all duration-300 ${
                    isActive ? 'h-5 opacity-100' : 'h-0 opacity-0'
                  }`}
                />
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors duration-300 ${
                    isActive ? 'text-primary' : 'text-white/25 group-hover:text-white/60'
                  }`}
                />
                <span className="font-medium truncate">{t.nav[route.navKey]}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function SiteNav() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  // Пока открыто мобильное меню, страница под ним не скроллится.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Боковая панель — десктоп */}
      <motion.aside
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 w-[248px] flex-col
          border-r border-line bg-background/80 backdrop-blur-2xl px-5 py-7"
      >
        <div className="mb-9">
          <Logo />
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none -mx-1 px-1">
          <NavItems />
        </div>

        <div className="pt-6 mt-6 border-t border-line space-y-4">
          <LangSwitcher />
          <Link
            to={CONTACT_PATH}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl
              bg-primary/10 border border-primary/20 text-sm font-semibold text-primary
              hover:bg-primary/20 hover:border-primary/40 transition-all duration-300"
          >
            {t.nav.cta}
          </Link>
        </div>
      </motion.aside>

      {/* Верхняя полоса — мобильные и планшеты */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 border-b border-line bg-background/85 backdrop-blur-2xl">
        <div className="flex items-center justify-between px-5 py-3.5">
          <Logo />
          <button
            onClick={() => setOpen(true)}
            aria-label="Открыть меню"
            className="p-2 -mr-2 text-white/60 hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Выдвижное меню — мобильные */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[85%] max-w-xs
                flex flex-col border-r border-line bg-background px-5 py-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <Logo onClick={() => setOpen(false)} />
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть меню"
                  className="p-2 -mr-2 text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1">
                <NavItems compact onNavigate={() => setOpen(false)} />
              </div>

              <div className="pt-6 mt-6 border-t border-line space-y-4">
                <LangSwitcher />
                <Link
                  to={CONTACT_PATH}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center w-full px-4 py-3.5 rounded-xl
                    bg-primary text-white text-sm font-bold"
                >
                  {t.nav.cta}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
