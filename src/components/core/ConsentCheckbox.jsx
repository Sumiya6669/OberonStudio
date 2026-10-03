import React from 'react';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import { useLang } from '@/lib/i18n/LangContext';

/**
 * Галочка согласия на обработку персональных данных — общая для всех форм
 * заявки. Не отмечена по умолчанию и обязательна (required): без неё браузер
 * не отправит форму, а сервер не примет заявку.
 *
 * Ссылка на условия открывается в новой вкладке: уход со страницы стёр бы
 * уже заполненную форму, а модалка демо при переходе и вовсе закрывается.
 */
export default function ConsentCheckbox({ checked, onChange, className = '' }) {
  const { t } = useLang();
  const ct = t.consent;

  return (
    <label className={`flex items-start gap-2.5 text-[11px] leading-relaxed text-white/45 cursor-pointer ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        required
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-line bg-surface-2 accent-primary cursor-pointer"
      />
      <span>
        {ct.text}{' '}
        <Link
          to="/privacy#consent"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-white underline underline-offset-2 transition-colors"
        >
          {ct.link}
        </Link>
      </span>
    </label>
  );
}
