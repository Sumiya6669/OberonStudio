import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { LocaleLink as Link, useLocaleHref } from '@/components/nav/LocaleLink';
import {
  Home, Sparkles, FolderKanban, Package, Workflow, Layers, Star, HelpCircle, Mail,
  Menu, X, ChevronRight, ScanSearch, ShieldCheck, Puzzle, Bot, Briefcase, BookOpen, Wrench,
  Building2, PenLine,
} from 'lucide-react';
import { useLang } from '@/lib/i18n/LangContext';
import { splitLocale } from '@/lib/i18n/locales';
import {
  CONTACT_PATH, NAV_MENU, menuHref, isMenuChildActive, isMenuItemActive,
} from '@/lib/routes';
import { PRODUCTS } from '@/lib/content/site';
import LangSwitcher from './LangSwitcher';
import Mark from '@/components/brand/Mark';

const ICONS = {
  Home, Sparkles, FolderKanban, Package, Workflow, Layers, Star, HelpCircle, Mail,
  ScanSearch, ShieldCheck, Puzzle, Bot, Briefcase, BookOpen, Wrench, Building2, PenLine,
};

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
 * Где человек сейчас: путь без языковой приставки и фильтр каталога.
 * По ним меню решает, что подсветить: на /kz/process это «Услуги ▸ Как
 * работаю», на /products?cat=Боты — «Продукты ▸ Боты и сервисы».
 *
 * Фильтр читается после монтирования, а не при первой отрисовке: страница
 * /products собрана заранее без `?cat=`, и меню, нарисованное в браузере
 * сразу с фильтром, не совпало бы с готовым html — React выбросил бы
 * ошибку гидратации и перерисовал всю страницу заново.
 */
function useGdeYa() {
  const { pathname, search } = useLocation();
  const { path } = splitLocale(pathname);
  const [cat, setCat] = useState(null);
  useEffect(() => { setCat(new URLSearchParams(search).get('cat')); }, [search]);
  return { path: path.replace(/\/$/, '') || '/', cat };
}

/**
 * Ссылка пункта меню. Разборы 1С есть только по-русски, поэтому ссылка
 * на них не получает языковой приставки: /kz/1c не существует, и
 * LocaleLink привёл бы человека на страницу «не найдено».
 *
 * Ссылка собрана прямо на RouterLink, а не на LocaleLink: тот не передаёт
 * ref, а он нужен, чтобы вернуть фокус на пункт после Escape в подменю.
 */
const MenuLink = React.forwardRef(function MenuLink({ ruOnly, to, ...rest }, ref) {
  const href = useLocaleHref();
  return <RouterLink ref={ref} to={ruOnly ? to : href(to)} {...rest} />;
});

/**
 * Сколько карточек в разделе каталога — цифра рядом с подписью.
 * Только у подпунктов с фильтром `cat`: у страниц считать нечего.
 */
function schet(item) {
  if (!item.cat) return null;
  return PRODUCTS.filter(p => (p.categories || []).includes(item.cat)).length;
}

/**
 * Подменю, выпадающее сбоку от пункта на десктопе.
 *
 * Панель уходит в портал и позиционируется фиксированно по координатам
 * пункта. Иначе её срезает: колонка меню прокручиваемая, у неё
 * overflow-y-auto, и всё, что вылезает за её правый край, просто
 * не рисуется.
 *
 * Открывается по наведению и по фокусу с клавиатуры, закрывается с
 * задержкой в 140 мс: без неё панель гаснет, пока курсор идёт по
 * диагонали, и попасть в подпункт мышью почти невозможно. Слева у панели
 * прозрачная полоса-мостик по той же причине.
 *
 * С клавиатуры: стрелка вправо (или вниз) на пункте переводит фокус в
 * панель, стрелки вверх/вниз ходят по подпунктам, Escape или стрелка влево
 * закрывают панель и возвращают фокус на пункт. Портал стоит в конце body,
 * и обычным Tab до него не дойти — поэтому стрелки.
 */
function PodmenyuFlyout({ item, id, open, anchor, panelRef, fokusVnutr, onEnter, onLeave, onVybor }) {
  const { t } = useLang();
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

  // Панель появляется не в тот же кадр, что и нажатие стрелки: фокус
  // ставим, когда в ней уже есть ссылки.
  useEffect(() => {
    if (!open || !mesto || !fokusVnutr.current) return;
    fokusVnutr.current = false;
    panelRef.current?.querySelector('a')?.focus();
  }, [open, mesto, fokusVnutr, panelRef]);

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
          <div
            ref={panelRef}
            id={id}
            role="group"
            aria-label={t.nav[item.navKey]}
            className="relative w-[17rem] rounded-2xl border border-line bg-surface/95 backdrop-blur-2xl
              p-2 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] overflow-hidden"
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 0% 0%, hsl(252 100% 68% / 0.10), transparent 65%)' }}
            />
            <p className="relative px-3 pt-1.5 pb-2 text-[10px] tracking-[0.2em] uppercase text-white/20">
              {t.nav[item.navKey]}
            </p>
            {item.children.map((c, i) => {
              const Icon = ICONS[c.icon] || Sparkles;
              const n = schet(c);
              return (
                <motion.div
                  key={menuHref(c)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.04, duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                  className="relative"
                >
                  <MenuLink
                    ruOnly={c.ruOnly}
                    to={menuHref(c)}
                    onClick={onVybor}
                    className="group/it flex items-center gap-3 rounded-xl px-3 py-2.5 outline-none
                      text-white/45 hover:text-white hover:bg-white/[0.05] focus-visible:text-white
                      focus-visible:bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-primary/50
                      transition-colors duration-200"
                  >
                    <Icon aria-hidden="true" className="w-4 h-4 flex-shrink-0 text-white/25 group-hover/it:text-primary transition-colors duration-200" />
                    <span className="flex-1 min-w-0 text-[13px] font-semibold leading-tight truncate">{t.nav[c.navKey]}</span>
                    {n !== null && (
                      <span className="flex-shrink-0 text-[11px] font-mono text-white/20
                        group-hover/it:text-primary transition-colors duration-200">{n}</span>
                    )}
                    <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 flex-shrink-0 text-white/15
                      -translate-x-1 opacity-0 group-hover/it:translate-x-0 group-hover/it:opacity-100
                      transition-all duration-200" />
                  </MenuLink>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Подпункты списком под пунктом: на десктопе — у раздела, в котором
 * человек сейчас (подменю раскрыто и показывает, где он), на телефоне —
 * у раскрытого раздела (наведения там нет).
 */
function PodmenyuSpisok({ item, id, path, cat, compact, onNavigate }) {
  const { t } = useLang();
  return (
    <ul id={id} className="ml-[1.375rem] mt-0.5 mb-1 border-l border-line flex flex-col">
      {item.children.map(c => {
        const active = isMenuChildActive(c, path, cat);
        const n = schet(c);
        return (
          <li key={menuHref(c)} className="relative">
            <span
              aria-hidden="true"
              className={`absolute -left-px top-1/2 -translate-y-1/2 w-0.5 rounded-full bg-primary transition-all duration-300 ${
                active ? 'h-4 opacity-100' : 'h-0 opacity-0'
              }`}
            />
            <MenuLink
              ruOnly={c.ruOnly}
              to={menuHref(c)}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2 pl-3.5 pr-2 rounded-r-lg transition-colors duration-200 ${
                compact ? 'py-2.5 text-[15px]' : 'py-1.5 text-[13px]'
              } ${active ? 'text-white font-medium' : 'text-white/35 hover:text-white/80'}`}
            >
              <span className="flex-1 min-w-0 truncate">{t.nav[c.navKey]}</span>
              {n !== null && <span className="flex-shrink-0 text-[11px] font-mono text-white/20">{n}</span>}
            </MenuLink>
          </li>
        );
      })}
    </ul>
  );
}

const punktClass = (active, compact) =>
  `group relative flex items-center gap-3 rounded-xl px-3 transition-all duration-300 ${
    compact ? 'py-3.5 text-base' : 'py-2.5 text-sm'
  } ${
    active ? 'bg-primary/10 text-white' : 'text-white/40 hover:text-white/85 hover:bg-white/[0.03]'
  }`;

/** Полоска слева, иконка и подпись — общие для пунктов с подменю и без. */
function PunktVnutri({ item, active }) {
  const { t } = useLang();
  const Icon = ICONS[item.icon] || Sparkles;
  return (
    <>
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full bg-primary transition-all duration-300 ${
          active ? 'h-5 opacity-100' : 'h-0 opacity-0'
        }`}
      />
      <Icon
        aria-hidden="true"
        className={`w-4 h-4 flex-shrink-0 transition-colors duration-300 ${
          active ? 'text-primary' : 'text-white/25 group-hover:text-white/60'
        }`}
      />
      <span className="font-medium truncate">{t.nav[item.navKey]}</span>
    </>
  );
}

/**
 * Пункт с подменю на десктопе.
 *
 * Если человек внутри раздела, подпункты стоят списком под пунктом
 * (раскрыто, текущий подсвечен), и выпадающая панель не нужна — она
 * повторила бы тот же список. У остальных разделов — панель сбоку.
 */
function PunktSPodmenyuDesktop({ item, path, cat }) {
  const active = isMenuItemActive(item, path, cat);
  const [open, setOpen] = useState(false);
  const tajmer = useRef(null);
  const yakor = useRef(null);
  const ssylka = useRef(null);
  const panel = useRef(null);
  const fokusVnutr = useRef(false);
  // Фокус вернулся на пункт по Escape — панель при этом снова не открываем.
  const bezOtkrytiya = useRef(false);
  const id = `podmenyu-${item.navKey}`;
  const flyout = !active;

  const pokazat = () => { clearTimeout(tajmer.current); setOpen(true); };
  const priFokuse = () => {
    if (bezOtkrytiya.current) { bezOtkrytiya.current = false; clearTimeout(tajmer.current); return; }
    pokazat();
  };
  const skryt = () => { clearTimeout(tajmer.current); tajmer.current = setTimeout(() => setOpen(false), 140); };
  // После выбора подпункта панель должна уйти сразу: иначе она остаётся
  // висеть поверх страницы, на которую человек только что перешёл.
  const zakryt = () => { clearTimeout(tajmer.current); setOpen(false); };
  useEffect(() => () => clearTimeout(tajmer.current), []);
  useEffect(() => {
    if (active) { clearTimeout(tajmer.current); setOpen(false); }
  }, [active]);

  const onKeyDown = (e) => {
    if (!flyout) return;
    const vPaneli = panel.current?.contains(e.target);
    if (!vPaneli) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (open && panel.current) {
          panel.current.querySelector('a')?.focus();
        } else {
          fokusVnutr.current = true;
          pokazat();
        }
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        zakryt();
      }
      return;
    }
    const items = Array.from(panel.current.querySelectorAll('a'));
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Escape' || e.key === 'ArrowLeft') {
      e.preventDefault();
      zakryt();
      bezOtkrytiya.current = true;
      ssylka.current?.focus();
    }
  };

  return (
    <div
      ref={yakor}
      className="relative"
      onMouseEnter={flyout ? pokazat : undefined}
      onMouseLeave={flyout ? skryt : undefined}
      onFocus={flyout ? priFokuse : undefined}
      onBlur={flyout ? skryt : undefined}
      onKeyDown={onKeyDown}
    >
      <MenuLink
        ref={ssylka}
        ruOnly={item.ruOnly}
        to={item.path}
        aria-haspopup={flyout ? 'true' : undefined}
        aria-expanded={flyout ? open : true}
        aria-controls={flyout && !open ? undefined : id}
        className={punktClass(active, false)}
      >
        <PunktVnutri item={item} active={active} />
        <ChevronRight
          aria-hidden="true"
          className={`w-3.5 h-3.5 ml-auto flex-shrink-0 transition-all duration-300 ${
            active ? 'rotate-90 text-primary/70' : open ? 'text-primary translate-x-0.5' : 'text-white/15'
          }`}
        />
      </MenuLink>
      {active ? (
        <PodmenyuSpisok item={item} id={id} path={path} cat={cat} />
      ) : (
        <PodmenyuFlyout
          item={item}
          id={id}
          open={open}
          anchor={yakor}
          panelRef={panel}
          fokusVnutr={fokusVnutr}
          onEnter={pokazat}
          onLeave={skryt}
          onVybor={zakryt}
        />
      )}
    </div>
  );
}

/**
 * Пункт с подменю в выдвижном меню телефона: сам пункт — ссылка на раздел,
 * стрелка рядом — отдельная кнопка, раскрывает подпункты. Раздел, в котором
 * человек сейчас, раскрыт сразу.
 */
function PunktSPodmenyuMobile({ item, path, cat, onNavigate }) {
  const { t } = useLang();
  const active = isMenuItemActive(item, path, cat);
  const [open, setOpen] = useState(active);
  const id = `podmenyu-m-${item.navKey}`;

  return (
    <div>
      <div className="flex items-stretch gap-1">
        <MenuLink
          ruOnly={item.ruOnly}
          to={item.path}
          onClick={onNavigate}
          className={`${punktClass(active, true)} flex-1 min-w-0`}
        >
          <PunktVnutri item={item} active={active} />
        </MenuLink>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls={id}
          aria-label={`${t.nav.submenu}: ${t.nav[item.navKey]}`}
          className="flex-shrink-0 w-11 flex items-center justify-center rounded-xl
            text-white/35 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          <ChevronRight
            aria-hidden="true"
            className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-90 text-primary' : ''}`}
          />
        </button>
      </div>
      {open && <PodmenyuSpisok item={item} id={id} path={path} cat={cat} compact onNavigate={onNavigate} />}
    </div>
  );
}

function NavItems({ onNavigate, compact }) {
  const { path, cat } = useGdeYa();

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_MENU.map(item => {
        if (item.children) {
          return compact
            ? <PunktSPodmenyuMobile key={item.path} item={item} path={path} cat={cat} onNavigate={onNavigate} />
            : <PunktSPodmenyuDesktop key={item.path} item={item} path={path} cat={cat} />;
        }
        const active = isMenuItemActive(item, path, cat);
        return (
          <MenuLink
            key={item.path}
            ruOnly={item.ruOnly}
            to={item.path}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={punktClass(active, compact)}
          >
            <PunktVnutri item={item} active={active} />
          </MenuLink>
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
              className="lg:hidden fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-[70] w-[85%] max-w-xs
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
