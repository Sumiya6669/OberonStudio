/**
 * Ставка и точка безубыточности.
 *
 * Экран отвечает на вопрос, который обычно не задают вовремя: ниже какой
 * ставки час работы уносит деньги.
 *
 * Считается не «сколько я хочу за час», а обратное. Все расходы месяца
 * ложатся на ПРОДАННЫЕ часы, а не на все отработанные: переписка, продажи,
 * счета, обновления и собственная система тоже занимают время, но их никто
 * не оплачивает. Поэтому минимальная ставка = расходы / проданные часы,
 * и она всегда выше, чем кажется.
 *
 * Прикидка «что если» намеренно живёт здесь, а не в базе: это черновик
 * решения, а не факт. В базе только то, что было.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { fetchRateHealth, fetchRateBaseline } from '@/lib/supabase/queries';
import {
  Empty, ErrorNote, Field, Panel, Spinner, Stat, Table,
  cx, dateOnly, inputClass, money,
} from '@/components/admin/ui';

const monthName = (value) => new Date(value).toLocaleDateString('ru-RU', {
  month: 'long', year: 'numeric',
});

export default function MoneyRate() {
  const health = useAsync(() => fetchRateHealth(12));
  const base = useAsync(fetchRateBaseline);

  // Прикидка. Значения по умолчанию — не «правильные», а обычные для
  // одного человека: 40 часов в неделю, из них продаётся половина.
  const [want, setWant] = React.useState(600000);   // сколько хочется себе
  const [hoursWeek, setHoursWeek] = React.useState(40);
  const [billablePct, setBillablePct] = React.useState(50);

  const rows = health.data || [];
  const b = base.data;

  // Основа для прикидки: средние за три закрытых месяца, а если их ещё
  // нет — последний месяц с цифрами. Пустая основа честнее подставленной:
  // прикидка на выдуманных расходах вреднее отсутствия прикидки.
  const expenses = b?.avg_expenses ?? rows.find((r) => Number(r.expenses) > 0)?.expenses ?? null;
  const measuredPct = b?.avg_billable_pct ?? rows[0]?.billable_pct ?? null;

  const calc = React.useMemo(() => {
    const hoursMonth = (Number(hoursWeek) || 0) * 4.33;
    const billable = hoursMonth * ((Number(billablePct) || 0) / 100);
    if (!billable) return null;
    const exp = Number(expenses) || 0;
    return {
      hoursMonth: Math.round(hoursMonth),
      billable: Math.round(billable),
      // Ставка, при которой покрываются расходы и остаётся желаемое.
      needRate: Math.round((exp + (Number(want) || 0)) / billable),
      // Ставка, при которой только покрываются расходы.
      breakEvenRate: Math.round(exp / billable),
    };
  }, [want, hoursWeek, billablePct, expenses]);

  if (health.loading) return <Spinner />;

  const last = rows[0];
  const lossMonths = rows.filter((r) => Number(r.margin_per_hour) < 0).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Ставка и безубыточность</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Расходы месяца ложатся на проданные часы, а не на все отработанные.
          Поэтому минимальная ставка всегда выше, чем кажется.
        </p>
      </div>

      <ErrorNote error={health.error || base.error} />

      {!rows.length ? (
        <Empty>
          Цифр пока нет. Внесите расходы за прошлые месяцы в «Расходы» и
          отметьте отработанные часы в «Время» — после этого себестоимость
          часа станет цифрой, а не прочерком. Это работа на один вечер,
          и она отвечает на вопрос, ниже какой ставки нельзя работать.
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Минимальная ставка"
                  hint={b ? `по ${b.months} закрытым месяцам` : 'по последнему месяцу'}
                  value={(b?.cost_per_hour ?? last?.cost_per_hour)
                    ? money(b?.cost_per_hour ?? last.cost_per_hour) : '—'}
                  tone="warn" />
            <Stat label="Фактическая ставка"
                  value={(b?.actual_rate ?? last?.actual_rate)
                    ? money(b?.actual_rate ?? last.actual_rate) : '—'}
                  tone={(b?.actual_rate ?? last?.actual_rate ?? 0)
                        >= (b?.cost_per_hour ?? last?.cost_per_hour ?? 0) ? 'good' : 'bad'} />
            <Stat label="Оплачиваемая загрузка"
                  value={measuredPct != null ? `${measuredPct}%` : '—'}
                  hint="какая доля отработанного продана" />
            <Stat label="Месяцев в убыток"
                  value={lossMonths}
                  hint={`из ${rows.length} с цифрами`}
                  tone={lossMonths ? 'bad' : 'good'} />
          </div>

          {last && Number(last.margin_per_hour) < 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              В {monthName(last.month)} каждый проданный час уносил{' '}
              {money(Math.abs(last.margin_per_hour))}. Это не значит, что не было
              выручки — значит, что она не покрыла расходов, которые на этот час легли.
            </div>
          )}
        </>
      )}

      <Panel title="Прикидка: какая ставка нужна"
             action={<span className="text-xs text-muted-foreground">
               расходы берутся из учёта, остальное — ваши предположения
             </span>}>
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <Field label="Хочу себе в месяц, ₸" hint="сверх расходов">
              <input className={inputClass} type="number" min="0" step="50000"
                     value={want} onChange={(e) => setWant(e.target.value)} />
            </Field>
            <Field label="Часов работы в неделю">
              <input className={inputClass} type="number" min="1" max="80"
                     value={hoursWeek} onChange={(e) => setHoursWeek(e.target.value)} />
            </Field>
            <Field
              label="Из них продаётся, %"
              hint={measuredPct != null
                ? `по вашим замерам сейчас ${measuredPct}%`
                : 'пока не замерено; у одного человека редко больше 50–60%'}>
              <input className={inputClass} type="number" min="1" max="100"
                     value={billablePct} onChange={(e) => setBillablePct(e.target.value)} />
            </Field>
          </div>

          <div className="space-y-3 rounded-xl border border-line bg-surface/40 p-5">
            {expenses == null ? (
              <p className="text-sm text-muted-foreground">
                Расходы в учёте пока нулевые, поэтому прикидка считается только
                от желаемого дохода и не учитывает, во что вам обходится месяц.
                Внесите расходы — цифра станет настоящей.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Расходы в основе: {money(expenses)} в месяц
                {b ? ` — среднее за ${b.months} закрытых месяца` : ' — последний месяц с цифрами'}.
              </p>
            )}

            {calc && (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Продаётся часов в месяц</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {calc.billable} <span className="text-xs text-muted-foreground">из {calc.hoursMonth}</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Ставка, чтобы выйти в ноль</span>
                  <span className="text-lg font-semibold tabular-nums text-amber-300">
                    {money(calc.breakEvenRate)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
                  <span className="text-sm">Ставка, чтобы получить желаемое</span>
                  <span className="text-2xl font-semibold tabular-nums text-blue">
                    {money(calc.needRate)}
                  </span>
                </div>
                {(b?.actual_rate ?? last?.actual_rate) > 0 && (
                  <p className={cx('text-xs',
                    calc.needRate > (b?.actual_rate ?? last.actual_rate)
                      ? 'text-amber-300' : 'text-emerald-400')}>
                    {calc.needRate > (b?.actual_rate ?? last.actual_rate)
                      ? `Сейчас вы получаете ${money(b?.actual_rate ?? last.actual_rate)} за час — на ${money(calc.needRate - (b?.actual_rate ?? last.actual_rate))} меньше нужного.`
                      : `Текущая ставка ${money(b?.actual_rate ?? last.actual_rate)} эту цель уже закрывает.`}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </Panel>

      {rows.length > 0 && (
        <Panel title="По месяцам">
          <Table
            cols={[
              { key: 'month', title: 'Месяц', render: (r) => dateOnly(r.month) },
              { key: 'expenses', title: 'Расходы', render: (r) => money(r.expenses) },
              { key: 'income', title: 'Доход', render: (r) => money(r.income) },
              {
                key: 'hours',
                title: 'Часов',
                render: (r) => (
                  <span>
                    {r.hours_billable} <span className="text-muted-foreground">из {r.hours_total}</span>
                    {r.billable_pct != null && (
                      <span className="ml-1 text-xs text-muted-foreground">({r.billable_pct}%)</span>
                    )}
                  </span>
                ),
              },
              { key: 'cost_per_hour', title: 'Себестоимость часа', render: (r) => (r.cost_per_hour ? money(r.cost_per_hour) : '—') },
              { key: 'actual_rate', title: 'Вышло за час', render: (r) => (r.actual_rate ? money(r.actual_rate) : '—') },
              {
                key: 'margin_per_hour',
                title: 'Осталось с часа',
                render: (r) => (r.margin_per_hour == null ? '—' : (
                  <span className={Number(r.margin_per_hour) < 0 ? 'text-red-400' : 'text-emerald-400'}>
                    {money(r.margin_per_hour)}
                  </span>
                )),
              },
              {
                key: 'breakeven_hours',
                title: 'Нужно было продать',
                render: (r) => (r.breakeven_hours
                  ? <span className={Number(r.breakeven_hours) > Number(r.hours_billable) ? 'text-amber-300' : ''}>
                      {r.breakeven_hours} ч
                    </span>
                  : '—'),
              },
            ]}
            rows={rows}
          />
        </Panel>
      )}
    </div>
  );
}
