import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { LocaleLink as Link, LocaleNavLink as NavLink } from '@/components/nav/LocaleLink';
import {
  Home, Sparkles, FolderKanban, Package, Workflow,
  Layers, Star, HelpCircle, Mail, Menu, X, ChevronRight, ScanSearch, Calculator, ShieldCheck,
} from 'lucide-react';
import { useLang } from '@/lib/i18n/LangContext';
import { SITE_ROUTES, CONTACT_PATH, PRODUCT_GROUPS } from '@/lib/routes';
import { PRODUCTS } from '@/lib/content/site';
import LangSwitcher from './LangSwitcher';
import Mark from '@/components/brand/Mark';

const ICONS = { Home, Sparkles, FolderKanban, Package, Workflow, Layers, Star, HelpCircle, Mail, ScanSearch, Calculator, ShieldCheck };

function Logo({ onClick }) {
  return (
    <Link to="/" onClick={onClick} className="group flex items-center gap-3">
      <Mark size={34} variant="reveal" className="flex-shrink-0 text-white/85 transition-opacity duration-300 group-hover:opacity-80" title="Tinker" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white/85 tracking-tight leading-tight">Tinker</p>
        <p className="text-[10px] text-white/25 leading-tight">1С · интеграции · автоматизация</p>
      </div>
    </Link>
  );
}


/**
 * Сколько карточек в разделе — цифра рядом с подписью.
 *
 * У «Расширений 1С» счёт идёт по группе, а не по метке: метку «1С»
 * несёт и «Сайт с обменом с 1С», и на карточке она уместна, а вот
 * расширением этот сайт не является — в счёте он давал лишнюю
 * тринадцатую позицию.
 */
function schet(g) {
  return PRODUCTS.filter(p =>
    g.group ? (p.group || '1c') === g.group : (p.categories || []).includes(g.cat)
  ).length;
}

/**
 * Разделы каталога, выпадающие сбоку от пункта «Продукты».
 *
 * Открывается по наведению и по фокусу с клавиатуры, закрывается с
 * задержкой в 140 мс: без неё панель гаснет, пока курсор идёт от пункта
 * до неё по диагонали, и попасть в раздел мышью почти невозможно.
 * Слева у панели прозрачная полоса-мостик по той же причине.
 */
/**
 * Разделы каталога, выпадающие сбоку от пункта «Продукты».
 *
 * Панель уходит в портал и позиционируется фиксированно по координатам
 * пункта. Иначе её срезает: колонка меню прокручиваемая, у неё
 * overflow-y-auto, и всё, что вылезает за её правый край, просто
 * не рисуется — сначала так и вышло.
 *
 * Открывается по наведению и по фокусу с клавиатуры, закрывается с
 * задержкой в 140 мс: без неё панель гаснет, пока курсор идёт по
 * диагонали, и попасть в раздел мышью почти невозможно. Слева у панели
 * прозрачная полоса-мостик по той же причине.
 */
function GruppyFlyout({ open, anchor, onEnter, onLeave, onVybor }) {
  const [mesto, setMesto] = useState(null);

  useEffect(() => {
    if (!open || !anchor?.current) return undefined;
    const schitat = () => {
      const r = anchor.current.getBoundingClientRect();
      setMesto({ left: r.right, top: r.top + r.height / 2 });
    };
    schitat();
    window.addEventListener('scroll', schitat, true);
    window.addEventListener('resize', schitat);
    return () => {
      window.removeEventListener('scroll', schitat, true);
      window.removeEventListener('resize', schitat);
    };
  }, [open, anchor]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && mesto && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          style={{ left: mesto.left, top: mesto.top }}
          className="fixed z-[60] -translate-y-1/2 pl-3"
        >
          <div className="relative w-60 rounded-2xl border border-line bg-surface/95 backdrop-blur-2xl
            p-2 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 0% 0%, hsl(252 100% 68% / 0.10), transparent 65%)' }}
            />
            <p className="relative px-3 pt-1.5 pb-2 text-[10px] tracking-[0.2em] uppercase text-white/20">
              Разделы каталога
            </p>
            {PRODUCT_GROUPS.map((g, i) => (
              <motion.div
                key={g.cat}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + i * 0.04, duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                <Link
                  to={`/products?cat=${encodeURIComponent(g.cat)}`}
                  onClick={onVybor}
                  className="group/it flex items-center gap-3 rounded-xl px-3 py-2.5
                    text-white/45 hover:text-white hover:bg-white/[0.05] transition-colors duration-200"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight">{g.label}</span>
                    <span className="block text-[11px] text-white/25 leading-tight mt-0.5 truncate">{g.hint}</span>
                  </span>
                  <span className="flex-shrink-0 text-[11px] font-mono text-white/20
                    group-hover/it:text-primary transition-colors duration-200">{schet(g)}</span>
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-white/15
                    -translate-x-1 opacity-0 group-hover/it:translate-x-0 group-hover/it:opacity-100
                    transition-all duration-200" />
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Те же разделы в выдвижном меню телефона: наведения там нет. */
function GruppySpisok({ onNavigate }) {
  return (
    <div className="ml-7 mt-1 mb-1 pl-3 border-l border-line flex flex-col">
      {PRODUCT_GROUPS.map(g => (
        <Link
          key={g.cat}
          to={`/products?cat=${encodeURIComponent(g.cat)}`}
          onClick={onNavigate}
          className="flex items-center gap-2 py-2 text-sm text-white/35 hover:text-white/80 transition-colors"
        >
          <span className="flex-1">{g.label}</span>
          <span className="text-[11px] font-mono text-white/20">{schet(g)}</span>
        </Link>
      ))}
    </div>
  );
}

function NavItems({ onNavigate, compact }) {
  const { t } = useLang();
  const [gruppy, setGruppy] = useState(false);
  const tajmer = useRef(null);
  const yakor = useRef(null);

  const pokazat = () => { clearTimeout(tajmer.current); setGruppy(true); };
  const skryt = () => { clearTimeout(tajmer.current); tajmer.current = setTimeout(() => setGruppy(false), 140); };
  // После выбора раздела панель должна уйти сразу: иначе она остаётся
  // висеть поверх страницы, на которую человек только что перешёл.
  const zakryt = () => { clearTimeout(tajmer.current); setGruppy(false); };
  useEffect(() => () => clearTimeout(tajmer.current), []);

  return (
    <nav className="flex flex-col gap-0.5">
      {SITE_ROUTES.map(route => {
        const Icon = ICONS[route.icon] || Sparkles;
        const sGruppami = route.navKey === 'products';

        const punkt = (
          <NavLink
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
                {sGruppami && !compact && (
                  <ChevronRight
                    className={`w-3.5 h-3.5 ml-auto flex-shrink-0 transition-all duration-300 ${
                      gruppy ? 'text-primary translate-x-0.5' : 'text-white/15'
                    }`}
                  />
                )}
              </>
            )}
          </NavLink>
        );

        if (!sGruppami) return <React.Fragment key={route.path}>{punkt}</React.Fragment>;

        // На телефоне наведения нет, поэтому разделы просто стоят списком.
        if (compact) {
          return (
            <React.Fragment key={route.path}>
              {punkt}
              <GruppySpisok onNavigate={onNavigate} />
            </React.Fragment>
          );
        }

        return (
          <div
            key={route.path}
            ref={yakor}
            className="relative"
            onMouseEnter={pokazat}
            onMouseLeave={skryt}
            onFocus={pokazat}
            onBlur={skryt}
          >
            {punkt}
            <GruppyFlyout
              open={gruppy}
              anchor={yakor}
              onEnter={pokazat}
              onLeave={skryt}
              onVybor={zakryt}
            />
          </div>
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
