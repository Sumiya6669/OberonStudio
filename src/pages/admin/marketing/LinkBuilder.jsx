/**
 * Маркетинг → Ссылки с метками.
 *
 * Ссылка для места, где нет рекламного кабинета: пост в канале, чат
 * бухгалтеров, карточка 2ГИС, партнёр, рассылка, личное сообщение. Метки
 * снимаются при первом заходе в визите (campaign.js) и уходят с заявкой в
 * crm.ticket.utm — дальше их видно на вкладке «Откуда заявки».
 *
 * Последние 20 ссылок хранятся только в этом браузере (localStorage): это
 * памятка, а не учёт. Почистили браузер — список пропал, ссылки работают.
 */
import React from 'react';
import { Check, Copy, Trash2 } from 'lucide-react';
import Select from '@/components/core/Select';
import { SITE_URL } from '@/lib/seo/pages';
import {
  HISTORY_LIMIT, LANGS, LINK_PAGES, LINK_PRESETS, UTM_HINTS,
  buildCampaignUrl, cleanPath, cleanTag, loadLinkHistory, pushLinkHistory, saveLinkHistory,
} from '@/lib/admin/marketing';
import { Button, Empty, Field, Panel, ago, cx, inputClass } from '@/components/admin/ui';

const CUSTOM = '__custom';

const FIELDS = [
  { key: 'utm_source', label: 'utm_source — откуда', hint: 'Площадка: telegram, 2gis, partner…' },
  { key: 'utm_medium', label: 'utm_medium — тип размещения', hint: 'channel, chat, listing, email…' },
  { key: 'utm_campaign', label: 'utm_campaign — кампания', hint: 'Тема или акция: esf_snt, kaspi…' },
  { key: 'utm_content', label: 'utm_content — вариант', hint: 'Чем отличаются ссылки одной кампании: post, pinned, bio…' },
];

const EMPTY_TAGS = { utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '' };

/**
 * Копирование: сначала буфер обмена, потом старый способ через выделение
 * поля. Если не вышло ни то ни другое — текст остаётся выделенным, и его
 * можно скопировать сочетанием клавиш.
 */
async function copyText(text, input) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return 'ok';
    }
  } catch { /* нет прав на буфер — пробуем выделением */ }
  try {
    if (input) {
      input.focus();
      input.select();
      if (document.execCommand && document.execCommand('copy')) return 'ok';
    }
  } catch { /* старый способ тоже недоступен */ }
  return 'manual';
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={cx('rounded-md border px-2 py-0.5 text-[11px] transition',
        active ? 'border-violet/40 bg-violet/15 text-violet'
          : 'border-line text-muted-foreground hover:border-violet/40 hover:text-foreground')}>
      {children}
    </button>
  );
}

export default function LinkBuilder() {
  const [page, setPage] = React.useState('/');
  const [customPath, setCustomPath] = React.useState('');
  const [lang, setLang] = React.useState('ru');
  const [tags, setTags] = React.useState(EMPTY_TAGS);
  const [note, setNote] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const urlInput = React.useRef(null);

  // Только после монтирования: при сборке страниц на сервере localStorage нет.
  React.useEffect(() => { setHistory(loadLinkHistory()); }, []);

  const pageInfo = LINK_PAGES.find((p) => p.path === page);
  const isCustom = page === CUSTOM;
  const path = isCustom ? cleanPath(customPath) : page;
  const localised = !isCustom && Boolean(pageInfo?.localised);
  const effectiveLang = localised ? lang : 'ru';
  const url = buildCampaignUrl({ base: SITE_URL, lang: effectiveLang, path, tags });
  const ready = Boolean(cleanTag(tags.utm_source)) && (!isCustom || Boolean(path));

  const setTag = (key, value) => { setTags((t) => ({ ...t, [key]: value })); setNote(null); };
  const applyPreset = (preset) => {
    setTags((t) => ({ ...t, utm_source: preset.utm_source, utm_medium: preset.utm_medium }));
    setNote(null);
  };
  const presetActive = (preset) =>
    cleanTag(tags.utm_source) === preset.utm_source && cleanTag(tags.utm_medium) === preset.utm_medium;

  const remember = () => {
    const pageLabel = isCustom ? path : pageInfo?.label || path;
    const parts = [cleanTag(tags.utm_source), cleanTag(tags.utm_medium)].filter(Boolean).join(' / ');
    const campaign = cleanTag(tags.utm_campaign);
    setHistory((list) => pushLinkHistory(list, {
      url,
      at: new Date().toISOString(),
      label: [pageLabel, localised ? effectiveLang : null, parts, campaign].filter(Boolean).join(' · '),
    }));
  };

  const copyMain = async () => {
    const result = await copyText(url, urlInput.current);
    remember();
    setNote(result === 'ok'
      ? { tone: 'ok', text: 'Ссылка скопирована и добавлена в «Последние ссылки».' }
      : { tone: 'warn', text: 'Скопировать автоматически не вышло: ссылка выделена — нажмите Ctrl+C.' });
  };

  const [copiedAt, setCopiedAt] = React.useState(null);
  const copyFromHistory = async (entry, event) => {
    const input = event.currentTarget.closest('li')?.querySelector('input');
    const result = await copyText(entry.url, input);
    setCopiedAt(result === 'ok' ? entry.url : null);
    if (result !== 'ok') setNote({ tone: 'warn', text: 'Ссылка выделена в списке — нажмите Ctrl+C.' });
  };

  const removeFromHistory = (entryUrl) => {
    setHistory((list) => {
      const next = list.filter((x) => x.url !== entryUrl);
      saveLinkHistory(next);
      return next;
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-4">
        <Panel title="Куда ставите ссылку">
          <div className="flex flex-wrap gap-1.5">
            {LINK_PRESETS.map((preset) => (
              <Chip key={preset.code} active={presetActive(preset)} onClick={() => applyPreset(preset)}>
                {preset.label}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Подставляет utm_source и utm_medium. Кампанию и вариант допишите сами — по ним потом
            отличите одну публикацию от другой.
          </p>
        </Panel>

        <Panel title="Страница и метки">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Страница сайта">
              <Select className={inputClass} value={page} onChange={(e) => { setPage(e.target.value); setNote(null); }}
                      aria-label="Страница сайта">
                {LINK_PAGES.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.label} — {p.path}{p.localised ? '' : ' (только ru)'}
                  </option>
                ))}
                <option value={CUSTOM}>Другой адрес…</option>
              </Select>
            </Field>
            <Field label="Язык"
                   hint={localised ? null : isCustom
                     ? 'Для своего адреса язык пишите в самом адресе: /kz/… или /en/….'
                     : 'Эта страница есть только по-русски.'}>
              <Select className={inputClass} value={effectiveLang} disabled={!localised}
                      onChange={(e) => { setLang(e.target.value); setNote(null); }} aria-label="Язык">
                {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </Select>
            </Field>
            {isCustom && (
              <div className="sm:col-span-2">
                <Field label="Адрес на сайте" hint="Только путь, например /uslugi/esf-snt или /1c/esf-oshibka. Домен и метки подставятся сами.">
                  <input className={inputClass} value={customPath} placeholder="/uslugi/…"
                         onChange={(e) => { setCustomPath(e.target.value); setNote(null); }} />
                </Field>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <input className={inputClass} value={tags[f.key]} spellCheck={false}
                       onChange={(e) => setTag(f.key, e.target.value)} />
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {UTM_HINTS[f.key].map((value) => (
                    <Chip key={value} active={cleanTag(tags[f.key]) === value}
                          onClick={() => setTag(f.key, value)}>{value}</Chip>
                  ))}
                </span>
              </Field>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Значения приводятся к нижнему регистру, пробелы заменяются на «_»: «Telegram» и «telegram»
            в отчёте иначе стали бы двумя разными источниками. Пишите латиницей.
          </p>
        </Panel>

        <Panel title="Готовая ссылка">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input ref={urlInput} readOnly value={url} onFocus={(e) => e.target.select()}
                   className={cx(inputClass, 'font-mono text-xs')} aria-label="Готовая ссылка" />
            <Button onClick={copyMain} disabled={!ready} className="shrink-0">
              <Copy className="h-4 w-4" /> Скопировать
            </Button>
          </div>
          {!ready && (
            <p className="mt-2 text-xs text-amber-400">
              {isCustom && !path ? 'Укажите адрес на сайте. ' : ''}
              {!cleanTag(tags.utm_source) ? 'Нужен хотя бы utm_source — без него ссылка не скажет, откуда пришла заявка.' : ''}
            </p>
          )}
          {note && (
            <p className={cx('mt-2 text-xs', note.tone === 'ok' ? 'text-emerald-400' : 'text-amber-400')}>{note.text}</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Адрес сайта — {SITE_URL} (переменная VITE_SITE_URL). Метки запоминаются при первом заходе в
            визите: если человек потом походит по страницам, заявка всё равно придёт с ними.
          </p>
        </Panel>
      </div>

      <Panel title={`Последние ссылки · ${history.length} из ${HISTORY_LIMIT}`}
        action={history.length > 0 && (
          <button onClick={() => { saveLinkHistory([]); setHistory([]); }}
                  className="text-xs text-muted-foreground hover:text-red-400">
            очистить
          </button>
        )}>
        <p className="-mt-1 mb-3 text-xs text-muted-foreground">
          Хранятся только в этом браузере. Ссылка попадает сюда при копировании.
        </p>
        {history.length === 0 ? <Empty>Пока пусто.</Empty> : (
          <ul className="space-y-2">
            {history.map((entry) => (
              <li key={entry.url} className="rounded-lg border border-line/70 bg-background/40 p-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-foreground">{entry.label || 'ссылка'}</span>
                  <span className="shrink-0 text-muted-foreground">{ago(entry.at)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input readOnly value={entry.url} onFocus={(e) => e.target.select()}
                         className="min-w-0 flex-1 rounded-md border border-line bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground outline-none focus:border-violet/60"
                         aria-label="Ссылка" />
                  <button type="button" onClick={(e) => copyFromHistory(entry, e)}
                          title="Скопировать" aria-label="Скопировать"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground">
                    {copiedAt === entry.url ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => removeFromHistory(entry.url)}
                          title="Убрать из списка" aria-label="Убрать из списка"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-white/5 hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
