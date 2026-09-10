/**
 * Ссылки внутри сайта, которые не теряют язык.
 *
 * Стоит человеку на `/kz/faq` нажать «Услуги», и обычная ссылка `/services`
 * молча вернёт его на русскую версию. Никто не сообщит об ошибке — просто
 * язык «слетает» при каждом переходе, и казахская версия оказывается
 * тупиком из одной страницы.
 *
 * Поэтому все внутренние ссылки публичного сайта идут через эти обёртки:
 * они дописывают текущую приставку. Ссылки в панель (`/admin/...`) и
 * внешние адреса не трогаются — там языка нет.
 */
import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useLang } from '@/lib/i18n/LangContext';
import { localePath } from '@/lib/i18n/locales';

/** Дописывает язык к внутреннему адресу; чужие адреса возвращает как есть. */
export function useLocaleHref() {
  const { lang } = useLang();
  return React.useCallback((to) => {
    if (typeof to !== 'string') return to;
    if (!to.startsWith('/') || to.startsWith('/admin')) return to;
    return localePath(lang, to);
  }, [lang]);
}

export function LocaleLink({ to, ...rest }) {
  const href = useLocaleHref();
  return <Link to={href(to)} {...rest} />;
}

export function LocaleNavLink({ to, ...rest }) {
  const href = useLocaleHref();
  return <NavLink to={href(to)} {...rest} />;
}
