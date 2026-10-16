/**
 * ТОЛЬКО ДЛЯ РАЗРАБОТКИ: /admin/dev-office (адрес под /admin — чтобы тема была тёмной, как в панели) — экран «3D-офис» с тестовыми данными, без входа в панель.
 * Подключается в App.jsx под import.meta.env.DEV — в прод-сборке маршрута и этого кода нет
 * (проверка: в dist нет строки «officeMock» / «OfficeDemo»).
 *
 * ?nolive — как будто миграция 068 не применена (только реестр).
 */
import React, { useCallback, useMemo, useState } from 'react';
import OfficeView from '@/components/admin/office/OfficeView';
import { NotLiveBanner } from '@/pages/admin/AgentsOffice';
import { buildOffice } from '@/lib/admin/agentsOffice';
import { mockJobs, mockOffice } from './officeMock';

export default function OfficeDemo() {
  const [noLive, setNoLive] = useState(() => new URLSearchParams(window.location.search).has('nolive'));
  const office = useMemo(() => buildOffice(noLive ? null : mockOffice()), [noLive]);
  const loadJobs = useCallback(async (code) => {
    await new Promise((r) => setTimeout(r, 250));
    return mockJobs(code);
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 font-inter text-foreground lg:p-6">
      <div className="mb-3 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        Демо для разработки: тестовые данные, без базы. В прод-сборку не попадает.
        <label className="ml-auto inline-flex items-center gap-1.5">
          <input type="checkbox" checked={noLive} onChange={(e) => setNoLive(e.target.checked)} />
          как без миграции 068
        </label>
      </div>
      <OfficeView
        office={office}
        loadJobs={noLive ? null : loadJobs}
        status={{ at: new Date().toISOString() }}
        banner={noLive ? <NotLiveBanner /> : null}
      />
    </div>
  );
}
