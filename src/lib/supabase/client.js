/**
 * Клиент Supabase для админки.
 *
 * Ключ здесь ТОЛЬКО публичный (anon). Ключ service_role в браузер не попадает
 * никогда: строки отсекает RLS по вошедшему пользователю, а не приложение.
 * Если переменные не заданы — публичный сайт работает как обычно,
 * а /admin честно говорит, что не настроен.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      db: { schema: 'public' },
    })
  : null;

/** Клиент для чтения витрин: схема app. */
export const appDb = isSupabaseConfigured ? supabase.schema('app') : null;
/** Заявки, компании, время, документы. */
export const crmDb = isSupabaseConfigured ? supabase.schema('crm') : null;
/** Очередь, журнал, права, эскалации. */
export const coreDb = isSupabaseConfigured ? supabase.schema('core') : null;
/** Конфигурации 1С и отчёты агентов. */
export const devDb = isSupabaseConfigured ? supabase.schema('dev') : null;
/** Управленческий учёт: план счетов, документы, проводки. */
export const accDb = isSupabaseConfigured ? supabase.schema('acc') : null;
/** Содержимое сайта: страницы, блоки, справочники, история правок. */
export const cmsDb = isSupabaseConfigured ? supabase.schema('cms') : null;
