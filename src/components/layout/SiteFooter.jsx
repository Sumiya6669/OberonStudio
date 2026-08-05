import React from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../core/Reveal';
import { useLang } from '@/lib/i18n/LangContext';
import { SITE_ROUTES, CONTACT_PATH } from '@/lib/routes';

export default function SiteFooter() {
  const { t } = useLang();
  const ft = t.footer;
  const rights = ft.rights.replace('{year}', new Date().getFullYear());

  return (
    <footer className="relative border-t border-line py-12 px-5">
      <div className="max-w-7xl mx-auto">
        <Reveal>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-10 mb-10">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-2 border border-line flex items-center justify-center">
                <span className="text-xs font-black text-gradient-blue">OS</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white/70">Oberon Studio</p>
                <p className="text-xs text-white/25">{ft.subtitle}</p>
              </div>
            </Link>

            {/* Карта страниц */}
            <nav className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2">
              {SITE_ROUTES.map(route => (
                <Link
                  key={route.path}
                  to={route.path}
                  className="text-xs text-white/25 hover:text-white/60 transition-colors duration-300"
                >
                  {t.nav[route.navKey]}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-line">
            <p className="text-xs text-white/15">{rights}</p>
            <div className="flex items-center gap-4">
              {['Telegram', 'WhatsApp', 'Instagram'].map(l => (
                <Link key={l} to={CONTACT_PATH} className="text-xs text-white/20 hover:text-white/50 transition-colors duration-300">{l}</Link>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
