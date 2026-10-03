import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLang } from '@/lib/i18n/LangContext';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import {
  forgetMetrika, hit, loadMetrika, metrikaEnabled, readConsent, resetConsent, saveConsent,
} from '@/lib/analytics/metrika';

/**
 * Согласие на cookie и Яндекс Метрику — и отправка просмотров при переходах.
 *
 * Баннер появляется, только когда счётчик настроен (VITE_YM_ID) и посетитель
 * ещё не выбирал. До выбора Метрика не загружается. Показывается после
 * монтирования, а не на сборке страниц: в предрендере его нет, поэтому
 * разметка, которую видит робот, от выбора человека не зависит.
 *
 * Метрика — сервис Яндекса, данные уходят за пределы РК; об этом сказано
 * прямо, чтобы согласие было осознанным (закон о персональных данных, ст. 16).
 *
 * Тексты — из «Cookie и аналитика.md» юридического пакета. Значения в
 * хранилище прежние: «Принять» → yes, «Только необходимые» → no, — чтобы
 * уже сделанный посетителями выбор не потерялся.
 */
const TEXT = {
  ru: {
    title: 'Cookie и аналитика',
    body: 'Сайт хранит в браузере только то, что нужно для работы: язык и ваш выбор в этом окне. Яндекс Метрику включаем только с вашего согласия — она показывает, откуда приходят посетители и какие страницы полезны. Данные о визите обрабатывает Яндекс, в том числе за пределами Казахстана.',
    link: 'Политика обработки персональных данных',
    yes: 'Принять',
    no: 'Только необходимые',
  },
  kz: {
    title: 'Cookie және аналитика',
    body: 'Сайт браузерде тек жұмысқа қажеттісін сақтайды: тіл мен осы терезедегі таңдауыңыз. Яндекс Метриканы тек сіздің келісіміңізбен қосамыз — ол келушілер қайдан келетінін және қай беттер пайдалы екенін көрсетеді. Сапар деректерін Яндекс өңдейді, оның ішінде Қазақстаннан тыс жерде.',
    link: 'Дербес деректерді өңдеу саясаты',
    yes: 'Қабылдау',
    no: 'Тек қажеттілері',
  },
  en: {
    title: 'Cookies and analytics',
    body: 'The site keeps in your browser only what it needs to work: language and your choice in this window. Yandex Metrica is switched on only with your consent — it shows where visitors come from and which pages help. Visit data is processed by Yandex, including outside Kazakhstan.',
    link: 'Personal data policy',
    yes: 'Accept',
    no: 'Necessary only',
  },
};

/** Событие «показать баннер снова» — его шлёт openCookieSettings. */
const REOPEN_EVENT = 'tk:cookie-settings';

/**
 * «Настройки cookie» в подвале: стирает выбор и снова показывает баннер.
 * Через событие окна, а не общее состояние: подвал и баннер — соседи в
 * раскладке, и протаскивать между ними контекст ради одной кнопки незачем.
 */
export function openCookieSettings() {
  if (typeof window === 'undefined') return;
  const previous = resetConsent();
  window.dispatchEvent(new CustomEvent(REOPEN_EVENT, { detail: { previous } }));
}

export default function CookieConsent() {
  const { lang } = useLang();
  const { pathname, search } = useLocation();
  const [ask, setAsk] = useState(false);
  const first = useRef(true);
  // Выбор до «Настроек cookie»: если счётчик уже работал, отказ его останавливает.
  const previous = useRef('');

  useEffect(() => {
    if (!metrikaEnabled) return;
    const consent = readConsent();
    if (consent === 'yes') loadMetrika();
    else if (!consent) setAsk(true);
  }, []);

  // Кнопка в подвале показывает баннер, даже если выбор уже был сделан.
  useEffect(() => {
    const reopen = (event) => {
      previous.current = event.detail?.previous || '';
      setAsk(true);
    };
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
  }, []);

  // Первый просмотр отправляет сам loadMetrika; дальше — каждый переход.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    hit(pathname + search, window.location.href);
  }, [pathname, search]);

  if (!ask) return null;
  const t = TEXT[lang] || TEXT.ru;
  const choose = (value) => {
    saveConsent(value);
    setAsk(false);
    // Согласие отозвано, а счётчик уже загружен — стираем его следы и
    // перезагружаем страницу без него.
    if (value === 'no' && previous.current === 'yes') forgetMetrika();
    previous.current = '';
  };

  return (
    <div
      role="dialog"
      aria-label={t.title}
      className="fixed bottom-4 left-4 right-4 lg:left-[264px] lg:right-auto lg:max-w-md z-40 rounded-2xl
                 border border-line bg-background/95 backdrop-blur px-5 py-4 shadow-2xl"
    >
      <p className="text-xs leading-relaxed text-white/70">{t.body}</p>
      <Link
        to="/privacy#cookie"
        className="mt-2 inline-block text-xs text-primary hover:text-white underline underline-offset-2 transition-colors"
      >
        {t.link}
      </Link>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => choose('yes')}
          className="text-xs font-semibold px-4 py-2 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          {t.yes}
        </button>
        <button
          type="button"
          onClick={() => choose('no')}
          className="text-xs px-4 py-2 rounded-full border border-white/[0.12] text-white/70 hover:text-white transition-colors"
        >
          {t.no}
        </button>
      </div>
    </div>
  );
}
