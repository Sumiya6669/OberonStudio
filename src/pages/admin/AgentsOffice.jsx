/**
 * ИИ → 3D-офис агентов.
 *
 * Живые данные — одна функция базы public.agents_office() (миграция 068) раз в 20 секунд; вкладка
 * в фоне — опрос стоит (usePoll). Пока миграции нет, офис рисуется из статичного реестра
 * (src/lib/admin/agentsRegistry.js) с надписью «живые данные включатся после 068», а опрос
 * не повторяется впустую.
 *
 * Права проверяет база: функция отвечает только вошедшему в панель с ролью owner / approver /
 * operator / viewer и только по своему клиенту. payload заданий экран не получает вообще.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { usePoll } from '@/lib/admin/usePoll';
import { fetchAgentOfficeJobs, fetchAgentsOffice } from '@/lib/supabase/queries';
import { MISSING_FN, buildOffice } from '@/lib/admin/agentsOffice';
import { Spinner } from '@/components/admin/ui';
import OfficeView from '@/components/admin/office/OfficeView';

export function NotLiveBanner() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-violet/30 bg-violet/10 px-3 py-2 text-xs text-violet-200">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Живые данные включатся после миграции 068 (supabase/migrations/068_agents_office.sql) —
        сейчас агенты показаны по реестру экрана, без очереди и журнала.
      </span>
    </div>
  );
}

export default function AgentsOffice() {
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      return await fetchAgentsOffice(24);
    } catch (err) {
      if (MISSING_FN.test(String(err?.message || err))) {
        setMissing(true);
        return null;
      }
      throw err;
    }
  }, []);

  const live = usePoll(load, { interval: 20000, enabled: !missing });
  const office = useMemo(() => buildOffice(missing ? null : live.data), [missing, live.data]);
  const loadJobs = useCallback((code) => fetchAgentOfficeJobs(code, 20), []);

  if (live.loading && !live.data && !missing) return <Spinner label="собираем офис" />;

  return (
    <OfficeView
      office={office}
      loadJobs={missing ? null : loadJobs}
      status={{ at: live.at, stale: live.stale, error: live.error, missing }}
      // Надпись «после 068» — только когда функции нет. Другая ошибка (права, сеть) показывается
      // как ошибка, а офис остаётся на реестре.
      banner={missing ? <NotLiveBanner /> : null}
    />
  );
}
