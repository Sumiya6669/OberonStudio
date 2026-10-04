import React from 'react';
import Mark from '@/components/brand/Mark';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import Reveal from '../core/Reveal';
import { openCookieSettings } from './CookieConsent';
import { useLang } from '@/lib/i18n/LangContext';
import { SITE_ROUTES } from '@/lib/routes';
import { SITE_SETTINGS } from '@/lib/content/site';
import { useSettings } from '@/lib/site/SiteContentContext';
import { InstagramIcon, TelegramIcon, WhatsAppIcon } from '@/components/brand/SocialIcons';

export default function SiteFooter() {
  // Контакты из панели поверх зашитых. Пустое поле в панели ничего не стирает.
  const SETTINGS = useSettings(SITE_SETTINGS);
  const { t } = useLang();
  const ft = t.footer;
  const rights = ft.rights.replace('{year}', new Date().getFullYear());

  return (
    <footer className="relative border-t border-line pt-12 pb-28 px-5">
      <div className="max-w-7xl mx-auto">
        <Reveal>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-10 mb-10">
            <Link to="/" className="flex items-center gap-3">
              <Mark size={30} className="text-white/70" title="Tinker" />
              <div>
                <p className="text-sm font-semibold text-white/70">Tinker</p>
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
              {/* Разборы и офферы только по-русски, поэтому ссылки ведут в
                  русскую версию из любой языковой: страниц на других языках
                  нет, и притворяться незачем. */}
              <a
                href="/uslugi"
                className="text-xs text-white/25 hover:text-white/60 transition-colors duration-300"
              >
                Работы и цены
              </a>
              <a
                href="/1c"
                className="text-xs text-white/25 hover:text-white/60 transition-colors duration-300"
              >
                Ответы по 1С
              </a>
              <a
                href="/keysy"
                className="text-xs text-white/25 hover:text-white/60 transition-colors duration-300"
              >
                Кейсы
              </a>
            </nav>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-line">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2">
              <p className="text-xs text-white/15">{rights}</p>
              {/* Политика и смена выбора по cookie — обязаны быть доступны с
                  любой страницы (Политика, п. 9.3). */}
              <Link
                to="/privacy"
                className="text-xs text-white/25 hover:text-white/60 transition-colors duration-300"
              >
                {ft.privacy}
              </Link>
              <button
                type="button"
                onClick={openCookieSettings}
                className="text-xs text-white/25 hover:text-white/60 transition-colors duration-300"
              >
                {ft.cookieSettings}
              </button>
            </div>
            {/* Соцсети — иконками. Внизу справа висят кнопки чата и мессенджеров, поэтому у подвала
                отступ снизу (pb-28): последняя строка не уходит под них. */}
            <div className="flex items-center gap-2.5">
              {[
                { href: SETTINGS.telegram_channel_url, label: `${ft.channel || 'Telegram-канал'} ${SETTINGS.telegram_channel || ''}`, Icon: TelegramIcon,
                  tone: 'text-sky-400 border-sky-400/25 bg-sky-500/10 hover:bg-sky-500/20 hover:border-sky-400/50' },
                { href: SETTINGS.instagram_url, label: `Instagram ${SETTINGS.instagram || ''}`, Icon: InstagramIcon,
                  tone: 'text-pink-400 border-pink-400/25 bg-pink-500/10 hover:bg-pink-500/20 hover:border-pink-400/50' },
                { href: SETTINGS.whatsapp_url, label: `WhatsApp ${SETTINGS.whatsapp || ''}`, Icon: WhatsAppIcon,
                  tone: 'text-emerald-400 border-emerald-400/25 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-400/50' },
              ].filter((s) => s.href).map(({ href, label, Icon, tone }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label.trim()}
                  title={label.trim()}
                  className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors duration-300 ${tone}`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </a>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
