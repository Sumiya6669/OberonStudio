/**
 * Поля справочников CMS рисуются по описанию из базы, а не разметкой.
 *
 * Состав полей каждого справочника лежит в cms.collection.fields — там же
 * написано, что обязательно и что переводится. Значит добавить справочник
 * или поле — это вставка строки, а не новый экран и не миграция. Тому, кто
 * работает в 1С, эта развилка знакома: справочник описывается метаданными,
 * а форма строится по ним.
 *
 * Обязательность здесь показывается, но НЕ проверяется: проверяет база при
 * публикации. Проверка в двух местах однажды разойдётся, и разойдётся именно
 * та, которую видно.
 */
import React from 'react';
import { Field, Tabs, cx, inputClass } from './ui';

export const LOCALES = [
  { value: 'ru', label: 'Русский' },
  { value: 'kz', label: 'Қазақша' },
  { value: 'en', label: 'English' },
];

const asTags = (value) =>
  Array.isArray(value) ? value.join(', ') : (value ?? '');

const fromTags = (raw) =>
  raw.split(',').map((s) => s.trim()).filter(Boolean);

function Input({ field, value, onChange }) {
  const common = { className: inputClass, value: value ?? '' };

  switch (field.type) {
    case 'textarea':
      return <textarea {...common} rows={3}
        onChange={(e) => onChange(e.target.value)} />;
    case 'markdown':
      return (
        <textarea {...common} rows={8} className={cx(inputClass, 'font-mono text-xs')}
          onChange={(e) => onChange(e.target.value)} />
      );
    case 'number':
      return <input {...common} type="number" step="any"
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(value)}
                 onChange={(e) => onChange(e.target.checked)} />
          {value ? 'да' : 'нет'}
        </label>
      );
    case 'tags':
      return (
        <input className={inputClass} value={asTags(value)}
               onChange={(e) => onChange(fromTags(e.target.value))}
               placeholder="через запятую" />
      );
    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input type="color" value={value || '#4d7fff'}
                 onChange={(e) => onChange(e.target.value)}
                 className="h-9 w-12 cursor-pointer rounded border border-line bg-background" />
          <input className={inputClass} value={value ?? ''}
                 onChange={(e) => onChange(e.target.value)} placeholder="#4d7fff" />
        </div>
      );
    case 'image':
      return (
        <div>
          <input {...common} onChange={(e) => onChange(e.target.value)}
                 placeholder="/images/case.webp или полный адрес" />
          {value && (
            <img src={value} alt="" loading="lazy"
                 className="mt-2 max-h-32 rounded-lg border border-line object-contain" />
          )}
        </div>
      );
    case 'url':
      return <input {...common} type="url" onChange={(e) => onChange(e.target.value)} />;
    default:
      return <input {...common} onChange={(e) => onChange(e.target.value)} />;
  }
}

/**
 * Форма записи справочника.
 * value: { slug, text, props, status, sort }
 */
export function ItemFields({ collection, value, onChange }) {
  const [locale, setLocale] = React.useState('ru');
  const fields = collection?.fields || [];
  const locFields = fields.filter((f) => f.loc);
  const commonFields = fields.filter((f) => !f.loc);

  const setText = (key, v) => onChange({
    ...value,
    text: { ...value.text, [locale]: { ...(value.text?.[locale] || {}), [key]: v } },
  });
  const setProp = (key, v) => onChange({
    ...value, props: { ...(value.props || {}), [key]: v },
  });

  const filled = (loc) => {
    const bag = value.text?.[loc] || {};
    return locFields.some((f) => {
      const x = bag[f.key];
      return Array.isArray(x) ? x.length > 0 : String(x ?? '').trim() !== '';
    });
  };

  return (
    <div className="space-y-4">
      {collection?.has_slug && (
        <Field label="Короткое имя (slug)"
               hint="Латиницей, через дефис. Попадает в адрес страницы и потому не меняется просто так.">
          <input className={inputClass} value={value.slug ?? ''}
                 onChange={(e) => onChange({
                   ...value,
                   slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                 })} />
        </Field>
      )}

      {locFields.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={locale} onChange={setLocale}
                  items={LOCALES.map((l) => ({ value: l.value, label: l.label }))} />
            <span className="text-xs text-muted-foreground">
              заполнено: {LOCALES.filter((l) => filled(l.value)).map((l) => l.value).join(', ') || 'ничего'}
            </span>
          </div>

          {locale !== 'ru' && (
            <p className="rounded-lg border border-line px-3 py-2 text-xs text-muted-foreground">
              Незаполненное поле на этом языке сайт покажет по-русски. Это правило живёт
              в базе, а не в браузере, — поэтому оно одинаково на всех страницах.
            </p>
          )}

          {locFields.map((f) => (
            <Field key={f.key}
                   label={`${f.label}${f.required && locale === 'ru' ? ' *' : ''}`}
                   hint={f.required && locale === 'ru'
                     ? 'Обязательно для публикации'
                     : undefined}>
              <Input field={f} value={value.text?.[locale]?.[f.key]}
                     onChange={(v) => setText(f.key, v)} />
            </Field>
          ))}
        </div>
      )}

      {commonFields.length > 0 && (
        <div className="space-y-3 border-t border-line pt-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Одинаково для всех языков
          </div>
          {commonFields.map((f) => (
            <Field key={f.key} label={`${f.label}${f.required ? ' *' : ''}`}>
              <Input field={f} value={value.props?.[f.key]}
                     onChange={(v) => setProp(f.key, v)} />
            </Field>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
        <Field label="Состояние">
          <select className={inputClass} value={value.status}
                  onChange={(e) => onChange({ ...value, status: e.target.value })}>
            <option value="draft">черновик</option>
            <option value="published">опубликовано</option>
            <option value="hidden">скрыто</option>
          </select>
        </Field>
        <Field label="Порядок" hint="Меньше — выше в списке на сайте.">
          <input className={inputClass} type="number" value={value.sort ?? 0}
                 onChange={(e) => onChange({ ...value, sort: Number(e.target.value) })} />
        </Field>
      </div>
    </div>
  );
}
