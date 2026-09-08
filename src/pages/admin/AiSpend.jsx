/**
 * Расход и квоты.
 *
 * Квота здесь не украшение: резерв берётся ДО обращения к внешней службе,
 * поэтому «свободно» — это предел минус истраченное минус зарезервированное.
 * Проверить, а потом истратить — значит перерасходовать при параллельной работе.
 *
 * Не задана квота — обращения к службе запрещены. Пустая строка в таблице
 * означает не «без ограничений», а «нельзя».
 */
import React from 'react';
import {
  Bar as RBar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAsync } from '@/lib/admin/useAsync';
import { useAuth } from '@/lib/auth/AuthContext';
import { fetchSpendDays, fetchQuotas, saveQuota } from '@/lib/supabase/queries';
import {
  Bar, Button, Empty, ErrorNote, Field, Modal, Panel, Spinner, Stat, Table,
  dateOnly, inputClass, num, usd,
} from '@/components/admin/ui';

export default function AiSpend() {
  const { person } = useAuth();
  const days = useAsync(fetchSpendDays);
  const quotas = useAsync(fetchQuotas);
  const [form, setForm] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  // Хуки — до любого раннего выхода. Иначе на переходе «загрузка → данные»
  // порядок хуков меняется, и React снимает компонент с ошибкой.
  const rows = days.data || [];
  const byDay = React.useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.day;
      map.set(key, (map.get(key) || 0) + Number(r.cost_usd || 0));
    }
    return [...map.entries()]
      .map(([day, cost]) => ({ day, cost, label: dateOnly(day) }))
      .sort((a, b) => new Date(a.day) - new Date(b.day))
      .slice(-30);
  }, [rows]);

  const byProvider = React.useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const cur = map.get(r.provider) || {
        provider: r.provider, title: r.provider_title, unit: r.unit,
        units: 0, cost: 0, events: 0,
      };
      cur.units += Number(r.units || 0);
      cur.cost += Number(r.cost_usd || 0);
      cur.events += Number(r.events || 0);
      map.set(r.provider, cur);
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost);
  }, [rows]);

  if (days.loading || quotas.loading) return <Spinner />;

  const monthStart = new Date();
  monthStart.setDate(1);
  const costMonth = rows
    .filter((r) => new Date(r.day) >= new Date(monthStart.toDateString()))
    .reduce((sum, r) => sum + Number(r.cost_usd || 0), 0);
  const costTotal = rows.reduce((sum, r) => sum + Number(r.cost_usd || 0), 0);

  const submit = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      await saveQuota({
        tenant_id: person.tenant_id,
        provider: form.provider,
        period: form.period,
        limit_units: Number(form.limit_units),
        soft_pct: Number(form.soft_pct),
      });
      setForm(null); quotas.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold tracking-tight">Расход и квоты</h1>
      <ErrorNote error={days.error || quotas.error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="За месяц" value={usd(costMonth)} />
        <Stat label="За 60 дней" value={usd(costTotal)} />
        <Stat label="Служб задействовано" value={byProvider.length} />
        <Stat label="Квот задано" value={(quotas.data || []).length}
              hint="без квоты обращение запрещено"
              tone={(quotas.data || []).length ? 'default' : 'warn'} />
      </div>

      <Panel title="Расход по дням, $">
        {!byDay.length ? (
          <Empty>Обращений к внешним службам ещё не было.</Empty>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor"
                       strokeOpacity={0.3} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.3} width={48} />
                <Tooltip
                  contentStyle={{ background: 'rgba(12,14,20,0.95)', border: '1px solid rgba(255,255,255,0.12)',
                                  borderRadius: 12, fontSize: 12 }}
                  formatter={(value) => [usd(value), 'расход']} />
                <RBar dataKey="cost" radius={[4, 4, 0, 0]}>
                  {byDay.map((d) => <Cell key={d.day} fill="#4d7fff" />)}
                </RBar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Квоты по службам"
             action={<span className="text-xs text-muted-foreground">
               свободно = предел − истрачено − резерв
             </span>}>
        <Table
          empty="Квот не задано. Это значит, что обращения к внешним службам запрещены — и это не ошибка, а исходное состояние."
          rowKey={(r) => `${r.provider}-${r.period}`}
          cols={[
            { key: 'provider_title', title: 'Служба',
              render: (r) => (
                <div>
                  <div>{r.provider_title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.period === 'day' ? 'сутки' : 'месяц'} · {r.unit}
                  </div>
                </div>
              ) },
            { key: 'bar', title: 'Заполнение', width: '30%',
              render: (r) => (
                <div className="min-w-[160px]">
                  <Bar value={Number(r.used) + Number(r.reserved)} max={Number(r.limit_units)} />
                  <div className="mt-1 text-xs text-muted-foreground">
                    {num(r.used)} + резерв {num(r.reserved)} из {num(r.limit_units)}
                  </div>
                </div>
              ) },
            { key: 'free', title: 'Свободно', align: 'right',
              render: (r) => <span className={Number(r.free) <= 0 ? 'text-red-400' : ''}>
                {num(r.free)}
              </span> },
            { key: 'cost_usd', title: 'Стоило', align: 'right', render: (r) => usd(r.cost_usd) },
            { key: 'state', title: 'Состояние',
              render: (r) => r.exhausted
                ? <span className="text-xs text-red-400">выбрана</span>
                : r.soft_reached
                  ? <span className="text-xs text-amber-400">порог {r.soft_pct} % пройден</span>
                  : <span className="text-xs text-emerald-400">в норме</span> },
            { key: 'act', title: '', align: 'right',
              render: (r) => (
                <Button variant="ghost" onClick={() => setForm({
                  provider: r.provider, provider_title: r.provider_title,
                  period: r.period, limit_units: r.limit_units, soft_pct: r.soft_pct,
                })}>
                  Изменить
                </Button>
              ) },
          ]}
          rows={quotas.data || []}
        />
      </Panel>

      <Panel title="Итого по службам за 60 дней">
        <Table
          empty="Пока нет ни одного обращения."
          rowKey={(r) => r.provider}
          cols={[
            { key: 'title', title: 'Служба' },
            { key: 'units', title: 'Единиц', align: 'right', render: (r) => `${num(r.units)} ${r.unit}` },
            { key: 'events', title: 'Обращений', align: 'right', render: (r) => num(r.events) },
            { key: 'cost', title: 'Стоило', align: 'right', render: (r) => usd(r.cost) },
          ]}
          rows={byProvider}
        />
      </Panel>

      {form && (
        <Modal title={`Квота: ${form.provider_title}`} onClose={() => setForm(null)}>
          <form onSubmit={submit} className="space-y-4">
            <ErrorNote error={error} />
            <Field label="Период">
              <select className={inputClass} value={form.period}
                      onChange={(e) => setForm({ ...form, period: e.target.value })}>
                <option value="month">месяц</option>
                <option value="day">сутки</option>
              </select>
            </Field>
            <Field label="Предел, единиц"
                   hint="Ноль означает полный запрет обращений, а не отсутствие ограничения.">
              <input className={inputClass} type="number" min="0" step="1" required
                     value={form.limit_units}
                     onChange={(e) => setForm({ ...form, limit_units: e.target.value })} />
            </Field>
            <Field label="Порог предупреждения, %"
                   hint="При достижении этой доли расход помечается в панели, но не блокируется.">
              <input className={inputClass} type="number" min="10" max="100" step="5" required
                     value={form.soft_pct}
                     onChange={(e) => setForm({ ...form, soft_pct: e.target.value })} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>Сохранить</Button>
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>Отмена</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
