/**
 * Откуда приходят заявки.
 *
 * Экран существует ради одного вопроса, на который иначе отвечают верой:
 * какая страница приводит клиентов, а какая просто существует. Поэтому
 * здесь не «просмотры» и не «позиции», а заявки, взятые в работу, и деньги.
 *
 * Про деньги честно: один счёт может закрывать несколько заявок, и тогда
 * сумма делится между ними поровну. При обычном «один счёт — одна заявка»
 * это точная цифра.
 *
 * Пустой экран здесь — нормальное состояние до первой заявки с сайта,
 * и он так и написан.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { fetchLeadSources } from '@/lib/supabase/queries';
import {
  Badge, Empty, ErrorNote, Panel, Spinner, Stat, Table, Tabs,
  dateOnly, money, num, pct,
} from '@/components/admin/ui';

const CHANNELS = {
  site: 'сайт', email: 'почта', telegram: 'Telegram',
  phone: 'телефон', manual: 'вручную',
};

/** Сворачивает строки витрины по выбранному признаку. */
function group(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const name = row[key] || '—';
    const cur = map.get(name) || {
      name, leads: 0, recognised: 0, taken: 0, done: 0, cancelled: 0,
      hours: 0, invoiced: 0, paid: 0, first_at: null, last_at: null,
    };
    cur.leads += Number(row.leads || 0);
    cur.recognised += Number(row.recognised || 0);
    cur.taken += Number(row.taken || 0);
    cur.done += Number(row.done || 0);
    cur.cancelled += Number(row.cancelled || 0);
    cur.hours += Number(row.hours || 0);
    cur.invoiced += Number(row.invoiced || 0);
    cur.paid += Number(row.paid || 0);
    if (!cur.first_at || row.first_at < cur.first_at) cur.first_at = row.first_at;
    if (!cur.last_at || row.last_at > cur.last_at) cur.last_at = row.last_at;
    map.set(name, cur);
  }
  return [...map.values()].sort((a, b) => b.leads - a.leads);
}

export default function Sources() {
  const list = useAsync(fetchLeadSources);
  const [by, setBy] = React.useState('page');

  if (list.loading) return <Spinner />;

  const rows = list.data || [];
  const grouped = group(rows, by === 'page' ? 'page' : by === 'source' ? 'source' : 'channel');

  const total = rows.reduce((acc, row) => ({
    leads: acc.leads + Number(row.leads || 0),
    taken: acc.taken + Number(row.taken || 0),
    done: acc.done + Number(row.done || 0),
    paid: acc.paid + Number(row.paid || 0),
    invoiced: acc.invoiced + Number(row.invoiced || 0),
  }), { leads: 0, taken: 0, done: 0, paid: 0, invoiced: 0 });

  const conversion = total.leads ? (100 * total.taken) / total.leads : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Источники заявок</h1>
        <span className="text-xs text-muted-foreground">
          Метки снимаются при входе на сайт, а не при отправке формы
        </span>
      </div>
      <ErrorNote error={list.error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Заявок всего" value={num(total.leads)} />
        <Stat label="Взято в работу" value={num(total.taken)}
              hint={conversion != null ? `${num(conversion, 1)} % от заявок` : undefined} />
        <Stat label="Закрыто" value={num(total.done)} />
        <Stat label="Выставлено" value={money(total.invoiced)} />
        <Stat label="Оплачено" value={money(total.paid)}
              tone={total.paid > 0 ? 'good' : 'default'} />
      </div>

      {!rows.length ? (
        <Panel title="Пока считать нечего">
          <Empty>
            Заявок с сайта ещё не было. Как только придёт первая, здесь появится
            страница входа, переход и метки кампании — и вопрос «что работает»
            перестанет быть вопросом веры.
          </Empty>
        </Panel>
      ) : (
        <>
          <Tabs
            value={by} onChange={setBy}
            items={[
              { value: 'page', label: 'По странице входа' },
              { value: 'source', label: 'По источнику' },
              { value: 'channel', label: 'По каналу' },
            ]}
          />

          <Panel title={
            by === 'page' ? 'Страница, с которой начался визит'
              : by === 'source' ? 'Откуда пришли на сайт'
                : 'Канал обращения'
          }>
            <Table
              rowKey={(r) => r.name}
              cols={[
                { key: 'name', title: by === 'channel' ? 'Канал' : 'Значение',
                  render: (r) => (
                    <span className={by === 'page' ? 'font-mono text-xs' : ''}>
                      {by === 'channel' ? (CHANNELS[r.name] || r.name) : r.name}
                    </span>
                  ) },
                { key: 'leads', title: 'Заявок', align: 'right', render: (r) => num(r.leads) },
                { key: 'recognised', title: 'Клиент узнан', align: 'right',
                  render: (r) => (
                    <span className="text-muted-foreground">
                      {num(r.recognised)}
                    </span>
                  ) },
                { key: 'taken', title: 'В работу', align: 'right',
                  render: (r) => (
                    <div>
                      <div>{num(r.taken)}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.leads ? pct((100 * r.taken) / r.leads) : '—'}
                      </div>
                    </div>
                  ) },
                { key: 'hours', title: 'Часы', align: 'right', render: (r) => num(r.hours, 1) },
                { key: 'invoiced', title: 'Выставлено', align: 'right',
                  render: (r) => (Number(r.invoiced) ? money(r.invoiced) : '—') },
                { key: 'paid', title: 'Оплачено', align: 'right',
                  render: (r) => (Number(r.paid)
                    ? <span className="text-emerald-400">{money(r.paid)}</span>
                    : '—') },
                { key: 'last_at', title: 'Последняя', align: 'right',
                  render: (r) => (
                    <span className="text-xs text-muted-foreground">{dateOnly(r.last_at)}</span>
                  ) },
              ]}
              rows={grouped}
            />
          </Panel>

          <Panel title="Подробно: страница, источник, кампания, месяц">
            <Table
              rowKey={(r, i) => `${r.page}|${r.source}|${r.month}|${i}`}
              cols={[
                { key: 'month', title: 'Месяц',
                  render: (r) => dateOnly(r.month) },
                { key: 'page', title: 'Страница входа',
                  render: (r) => <span className="font-mono text-xs">{r.page}</span> },
                { key: 'source', title: 'Источник' },
                { key: 'campaign', title: 'Кампания',
                  render: (r) => r.campaign
                    ? <Badge>{r.campaign}</Badge>
                    : <span className="text-muted-foreground">—</span> },
                { key: 'channel', title: 'Канал',
                  render: (r) => CHANNELS[r.channel] || r.channel },
                { key: 'leads', title: 'Заявок', align: 'right' },
                { key: 'taken', title: 'В работу', align: 'right' },
                { key: 'paid', title: 'Оплачено', align: 'right',
                  render: (r) => (Number(r.paid) ? money(r.paid) : '—') },
              ]}
              rows={rows}
            />
          </Panel>
        </>
      )}

      <Panel title="Как это считается">
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>
            <b className="text-foreground">Страница входа</b> — та, с которой начался
            визит, а не та, где нажали кнопку. Иначе источником всех заявок
            оказалась бы страница контактов.
          </li>
          <li>
            <b className="text-foreground">Источник</b> — метка utm_source, если она
            была в ссылке; иначе сайт, с которого перешли; иначе «прямой заход».
            Переходы внутри сайта источником не считаются.
          </li>
          <li>
            <b className="text-foreground">Деньги</b> — доля счёта, приходящаяся на
            заявку. Один счёт на несколько заявок делится поровну.
          </li>
          <li>
            Метки хранятся на время визита и не переживают закрытие вкладки:
            это не слежка между визитами.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
