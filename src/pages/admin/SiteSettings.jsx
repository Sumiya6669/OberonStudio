/**
 * Сайт: настройки.
 *
 * Контакты, которые сегодня лежат в коде. Пока в базе нет значения, сайт берёт
 * зашитое — поэтому пустое поле здесь не обнуляет контакт на сайте, а просто
 * оставляет его как был.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { useAuth } from '@/lib/auth/AuthContext';
import { fetchSiteSettings, saveSiteSettings, fetchSiteContent } from '@/lib/supabase/queries';
import {
  Button, ErrorNote, Field, Panel, Spinner, Stat, inputClass, dateTime,
} from '@/components/admin/ui';
import SiteFreshness from '@/components/admin/SiteFreshness';

const FIELDS = [
  ['telegram', 'Telegram, имя', '@DeveloperAI0'],
  ['telegram_url', 'Telegram, ссылка', 'https://t.me/...'],
  ['whatsapp', 'WhatsApp, номер', '+7 ...'],
  ['whatsapp_url', 'WhatsApp, ссылка', 'https://wa.me/...'],
  ['email', 'Почта', 'hello@...'],
  ['phone', 'Телефон', '+7 ...'],
  ['address', 'Адрес', 'город, улица'],
  ['bin', 'БИН', ''],
  ['company_legal', 'Юридическое название', 'ТОО ...'],
  // Подтверждение прав на сайт. Код выдают Search Console и Вебмастер;
  // он появляется в мета-тегах после ближайшей сборки сайта.
  ['google_verify', 'Google Search Console: код подтверждения', 'например aBcD…'],
  ['yandex_verify', 'Яндекс.Вебмастер: код подтверждения', 'например 1a2b3c…'],
  // Ссылки на карточки в картах: из них собирается разметка «это одна и
  // та же организация». Пусто — в разметку ничего не попадёт.
  ['maps_2gis_url', '2ГИС: ссылка на карточку', 'https://2gis.kz/...'],
  ['maps_google_url', 'Google Карты: ссылка на карточку', 'https://maps.app.goo.gl/...'],
];

export default function SiteSettings() {
  const { person } = useAuth();
  const settings = useAsync(fetchSiteSettings);
  const preview = useAsync(() => fetchSiteContent('ru'));
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (settings.data && data === null) setData(settings.data.data || {});
  }, [settings.data, data]);

  if (settings.loading || data === null) return <Spinner />;

  const submit = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true); setSaved(false);
    try {
      const clean = Object.fromEntries(
        Object.entries(data).filter(([, v]) => String(v ?? '').trim() !== ''),
      );
      await saveSiteSettings(person.tenant_id, clean);
      setSaved(true); settings.reload(); preview.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const content = preview.data || {};
  const collections = content.collections || {};

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold tracking-tight">Сайт: настройки</h1>
      <SiteFreshness reason="settings" />
      <ErrorNote error={settings.error || error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Опубликованных страниц" value={(content.pages || []).length} />
        <Stat label="Записей в справочниках"
              value={Object.values(collections).reduce((s, arr) => s + (arr?.length || 0), 0)} />
        <Stat label="Настроек задано" value={Object.keys(data).filter((k) => data[k]).length} />
        <Stat label="Последнее изменение"
              value={content.updated_at ? dateTime(content.updated_at) : '—'} />
      </div>

      <Panel title="Контакты"
             action={saved ? <span className="text-xs text-emerald-400">сохранено</span> : null}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(([key, label, placeholder]) => (
              <Field key={key} label={label}>
                <input className={inputClass} value={data[key] ?? ''} placeholder={placeholder}
                       onChange={(e) => { setSaved(false); setData({ ...data, [key]: e.target.value }); }} />
              </Field>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Пустое поле не стирает контакт на сайте: значение просто не попадает в базу,
            и страница показывает зашитое в код.
          </p>
          <Button type="submit" disabled={busy}>Сохранить</Button>
        </form>
      </Panel>

      <Panel title="Что сайт получает прямо сейчас"
             action={<Button variant="ghost" onClick={preview.reload}>Перечитать</Button>}>
        <p className="mb-3 text-xs text-muted-foreground">
          Это ответ той же функции, которую вызывает публичный сайт. Если здесь чего-то нет,
          значит этого нет и на сайте — проверять больше нигде не нужно.
        </p>
        {preview.loading ? <Spinner /> : (
          <pre className="max-h-96 overflow-auto rounded-lg border border-line bg-background px-3 py-2 text-[11px]">
            {JSON.stringify(preview.data, null, 2)}
          </pre>
        )}
      </Panel>
    </div>
  );
}
