import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLang } from '@/lib/i18n/LangContext';
import { hit, loadMetrika, metrikaEnabled, readConsent, saveConsent } from '@/lib/analytics/metrika';

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
 */
const TEXT = {
  ru: {
    body: 'Мы используем cookie и Яндекс Метрику, чтобы понимать, откуда приходят посетители и какие страницы им полезны. Данные о визите обрабатывает Яндекс, в том числе за пределами Казахстана. Без вашего согласия счётчик не включается.',
    yes: 'Принять',
    no: 'Отклонить',
  },
  kz: {
    body: 'Келушілер қайдан келетінін және қай беттер пайдалы екенін түсіну үшін cookie мен Яндекс Метриканы қолданамыз. Сапар деректерін Яндекс өңдейді, оның ішінде Қазақстаннан тыс жерде. Келісіміңізсіз есептегіш қосылмайды.',
    yes: 'Келісемін',
    no: 'Бас тарту',
  },
  en: {
    body: 'We use cookies and Yandex Metrica to understand where visitors come from and which pages help them. Visit data is processed by Yandex, including outside Kazakhstan. The counter stays off unless you agree.',
    yes: 'Accept',
    no: 'Decline',
  },
};

export default function CookieConsent() {
  const { lang } = useLang();
  const { pathname, search } = useLocation();
  const [ask, setAsk] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (!metrikaEnabled) return;
    const consent = readConsent();
    if (consent === 'yes') loadMetrika();
    else if (!consent) setAsk(true);
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
  };

  return (
    <div
      role="dialog"
      aria-label="cookie"
      className="fixed bottom-4 left-4 right-4 lg:left-[264px] lg:right-auto lg:max-w-md z-40 rounded-2xl
                 border border-white/[0.08] bg-background/95 backdrop-blur px-5 py-4 shadow-2xl"
    >
      <p className="text-xs leading-relaxed text-white/70">{t.body}</p>
      <div className="mt-3 flex gap-2">
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
