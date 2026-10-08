import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLang } from '@/lib/i18n/LangContext';
import { PRODUCT_MEDIA, MEDIA_UI, pick } from '@/lib/productMedia';

/**
 * «Смотреть в работе»: экран 1С, сообщение в Telegram и ролик одного продукта.
 *
 * Окно, а не блок в карточке: в сетке из двенадцати карточек три картинки
 * на каждую — это сотни килобайт, которые никто не просил. Здесь всё
 * грузится только при открытии: картинки — loading="lazy", видео —
 * preload="none" с постером, пока человек сам не нажмёт «Play».
 *
 * Доступность: role="dialog" с заголовком, вкладки по образцу WAI-ARIA
 * (стрелки, Home/End), Esc закрывает, фокус возвращается на кнопку,
 * которая окно открыла. У каждой картинки — alt с тем, что на ней
 * написано по сути, и подпись под ней.
 */
const TABS = [
  { key: 'screen', label: MEDIA_UI.tabScreen },
  { key: 'telegram', label: MEDIA_UI.tabTelegram },
  { key: 'video', label: MEDIA_UI.tabVideo },
];

export function hasProductMedia(id) {
  return Boolean(PRODUCT_MEDIA[id]);
}

function Figure({ children, caption, note }) {
  return (
    <figure className="m-0">
      {children}
      <figcaption className="mt-3 text-sm leading-relaxed text-white/60">
        {caption}
        {note && <span className="mt-1 block text-xs text-white/35">{note}</span>}
      </figcaption>
    </figure>
  );
}

function Panel({ tab, media, lang }) {
  if (tab === 'screen') {
    // У продукта может быть несколько экранов 1С (у пульта — «Закрытие месяца» и клиенты) — один под другим
    return (
      <div className="space-y-8">
        {media.screens.map((s) => (
          <Figure key={s.src} caption={pick(s.caption, lang)} note={pick(s.note, lang)}>
            <picture>
              <source media="(max-width: 640px)" srcSet={s.srcSmall} />
              <img
                src={s.src}
                width={s.width}
                height={s.height}
                alt={pick(s.alt, lang)}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full rounded-xl border border-line bg-white"
              />
            </picture>
          </Figure>
        ))}
      </div>
    );
  }
  if (tab === 'telegram') {
    const g = media.telegram;
    return (
      <Figure caption={pick(g.caption, lang)} note={pick(g.note, lang)}>
        {/* Длинный дайджест прокручивается внутри рамки, а не растягивает окно */}
        <div
          className="mx-auto max-h-[60vh] max-w-[420px] overflow-y-auto overscroll-contain rounded-xl border border-line"
          tabIndex={0}
        >
          <img
            src={g.src}
            width={g.width}
            height={g.height}
            alt={pick(g.alt, lang)}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
        </div>
      </Figure>
    );
  }
  const v = media.video;
  return (
    <Figure caption={pick(v.caption, lang)} note={pick(v.note, lang)}>
      <video
        className="mx-auto block h-auto w-full max-w-[min(100%,60vh)] rounded-xl border border-line bg-black"
        width={v.width}
        height={v.height}
        poster={v.poster}
        controls
        playsInline
        muted
        preload="none"
      >
        <source src={v.src} type="video/mp4" />
        {pick(MEDIA_UI.noVideo, lang)}
      </video>
    </Figure>
  );
}

export default function ProductMedia({ product, onClose }) {
  const { lang } = useLang();
  const media = PRODUCT_MEDIA[product.id];
  const [tab, setTab] = useState('screen');
  const tabRefs = useRef({});
  const closeRef = useRef(null);
  const uid = useId();
  const closeCb = useRef(onClose);
  closeCb.current = onClose;
  const titleId = `${uid}-title`;

  // Esc закрывает; фокус — на «Закрыть», при закрытии вернётся туда, откуда открыли
  useEffect(() => {
    const before = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') closeCb.current(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (before && typeof before.focus === 'function') before.focus();
    };
  }, []);

  if (!media || typeof document === 'undefined') return null;

  const onTabKey = (e, i) => {
    const last = TABS.length - 1;
    const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setTab(TABS[next].key);
    tabRefs.current[TABS[next].key]?.focus();
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl sm:max-h-[92vh] sm:rounded-3xl"
      >
        <div className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-6">
          <span className="text-xl" aria-hidden="true">{product.icon}</span>
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="font-bold leading-tight text-white">{product.name}</h3>
            <p className="mt-0.5 text-xs text-white/35">
              {pick(MEDIA_UI.title, lang)} · {pick(MEDIA_UI.example, lang)}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={pick(MEDIA_UI.close, lang)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div role="tablist" aria-label={pick(MEDIA_UI.title, lang)} className="flex gap-1 border-b border-line px-3 pt-2 sm:px-5">
          {TABS.map((tb, i) => {
            const on = tab === tb.key;
            return (
              <button
                key={tb.key}
                ref={(el) => { tabRefs.current[tb.key] = el; }}
                type="button"
                role="tab"
                id={`${uid}-tab-${tb.key}`}
                aria-selected={on}
                aria-controls={`${uid}-panel`}
                tabIndex={on ? 0 : -1}
                onClick={() => setTab(tb.key)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:px-4 sm:text-sm ${on ? 'border-primary text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}
              >
                {pick(tb.label, lang)}
              </button>
            );
          })}
        </div>

        <div
          id={`${uid}-panel`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${tab}`}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6"
        >
          <Panel tab={tab} media={media} lang={lang} />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
