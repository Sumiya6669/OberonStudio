/**
 * Права агентов и путь к самостоятельности.
 *
 * Матрица строится от полного набора «агент × действие», а не от выданных прав.
 * Причина простая: отсутствие записи о праве означает запрет, и этот запрет
 * надо ВИДЕТЬ. Таблица, показывающая только выданное, оставляет вопрос
 * «а что с остальным?» без ответа — и на него отвечают догадкой.
 *
 * Три режима:
 *   запрещено  — агент не может даже предложить;
 *   предложить — агент готовит, решение принимает человек;
 *   сам        — агент делает и отчитывается.
 *
 * Право «сам» не выдаётся за красивые слова: рядом видно, сколько подтверждений
 * без правок агент собрал подряд и сколько осталось до порога. Порог задан
 * в реестре действий и для записи в базу 1С равен 999 — то есть практически
 * никогда, и это сделано намеренно.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { useAuth } from '@/lib/auth/AuthContext';
import { fetchGrantMatrix, setGrant, fetchApprovals } from '@/lib/supabase/queries';
import {
  Badge, Bar, Button, ErrorNote, Modal, Panel, Spinner, Stat, Table, Tabs,
  cx, dateTime, num,
} from '@/components/admin/ui';

const MODES = [
  ['deny', 'запрещено', 'text-muted-foreground'],
  ['propose', 'предложить', 'text-gold'],
  ['auto', 'сам', 'text-emerald-400'],
];

const modeLabel = (mode) => (MODES.find((m) => m[0] === mode) || [, mode])[1];

export default function AiRights() {
  const { person } = useAuth();
  const matrix = useAsync(fetchGrantMatrix);
  const approvals = useAsync(() => fetchApprovals({
    status: ['pending', 'approved', 'approved_edited', 'rejected', 'expired'],
  }));
  const [agent, setAgent] = React.useState('all');
  const [edit, setEdit] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  if (matrix.loading) return <Spinner />;

  const rows = matrix.data || [];
  const agents = [...new Map(rows.map((r) => [r.agent_kind, r.agent_title])).entries()];
  const shown = agent === 'all' ? rows : rows.filter((r) => r.agent_kind === agent);

  const counts = {
    auto: rows.filter((r) => r.mode === 'auto').length,
    propose: rows.filter((r) => r.mode === 'propose').length,
    deny: rows.filter((r) => r.mode === 'deny').length,
  };

  const apply = async (mode) => {
    setBusy(true); setError(null);
    try {
      await setGrant({
        grantId: edit.grant_id,
        tenantId: person.tenant_id,
        agentKind: edit.agent_kind,
        actionType: edit.action_type,
        mode,
        grantedBy: person.id,
        note: edit.note || null,
        limits: edit.limits,
      });
      setEdit(null);
      matrix.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold tracking-tight">Права и самостоятельность</h1>
      <ErrorNote error={matrix.error} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Действуют сами" value={counts.auto} tone={counts.auto ? 'good' : 'default'} />
        <Stat label="Только предлагают" value={counts.propose} />
        <Stat label="Запрещено" value={counts.deny} hint="из них большинство — по умолчанию" />
      </div>

      <Tabs
        value={agent}
        onChange={setAgent}
        items={[
          { value: 'all', label: 'Все агенты', count: rows.length },
          ...agents.map(([code, title]) => ({
            value: code, label: title,
            count: rows.filter((r) => r.agent_kind === code).length,
          })),
        ]}
      />

      <Panel title="Матрица прав">
        <Table
          empty="Реестры агентов и действий пусты."
          rowKey={(r) => `${r.agent_kind}-${r.action_type}`}
          cols={[
            { key: 'agent_title', title: 'Агент', hide: agent !== 'all' },
            { key: 'action_title', title: 'Действие',
              render: (r) => (
                <div>
                  <div>{r.action_title}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {r.action_type} · {r.target_system}
                    {r.has_side_effect && <span className="text-amber-400/80"> · вне системы</span>}
                  </div>
                </div>
              ) },
            { key: 'mode', title: 'Режим',
              render: (r) => {
                const cls = (MODES.find((m) => m[0] === r.mode) || [])[2] || '';
                return (
                  <div>
                    <span className={cx('text-sm font-medium', cls)}>{modeLabel(r.mode)}</span>
                    {r.implicit && (
                      <div className="text-xs text-muted-foreground">по умолчанию, записи нет</div>
                    )}
                    {!r.implicit && r.granted_by_name && (
                      <div className="text-xs text-muted-foreground">
                        выдал {r.granted_by_name}, {dateTime(r.granted_at)}
                      </div>
                    )}
                  </div>
                );
              } },
            { key: 'autonomy', title: 'До самостоятельности', width: '24%',
              render: (r) => {
                if (r.mode === 'auto') {
                  return <span className="text-xs text-emerald-400">уже действует сам</span>;
                }
                return (
                  <div className="min-w-[150px]">
                    <Bar value={r.streak_clean} max={r.autonomy_threshold} />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.streak_clean} из {r.autonomy_threshold} подряд без правок
                      {r.to_autonomy > 0 && <> · осталось {r.to_autonomy}</>}
                    </div>
                  </div>
                );
              } },
            { key: 'stat', title: 'Замеры', align: 'right',
              render: (r) => (
                <div className="text-xs text-muted-foreground">
                  <div>без правок: {r.total_approved}</div>
                  <div>с правкой: {r.total_edited}</div>
                  <div>отклонено: {r.total_rejected}</div>
                </div>
              ) },
            { key: 'act', title: '', align: 'right',
              render: (r) => (
                <Button variant="ghost" onClick={() => { setEdit(r); setError(null); }}>
                  Изменить
                </Button>
              ) },
          ]}
          rows={shown}
        />
      </Panel>

      <Panel title="История подтверждений"
             action={<span className="text-xs text-muted-foreground">
               подтверждение с правкой и без — разные события
             </span>}>
        {approvals.loading ? <Spinner /> : (
          <Table
            empty="Подтверждений ещё не было. Пока агенты работают в режиме «предложить», здесь появится каждое решение."
            cols={[
              { key: 'action_title', title: 'Действие' },
              { key: 'job_title', title: 'Задание',
                render: (r) => r.job_title || '—' },
              { key: 'confidence', title: 'Уверенность', align: 'right',
                render: (r) => `${num((r.confidence || 0) * 100, 0)} %` },
              { key: 'status', title: 'Решение',
                render: (r) => <Badge tone={
                  r.status === 'approved' ? 'approved'
                  : r.status === 'approved_edited' ? 'estimated'
                  : r.status === 'rejected' ? 'dead'
                  : r.status === 'expired' ? 'cancelled' : 'awaiting'
                }>{
                  { pending: 'ждёт', approved: 'как есть', approved_edited: 'с правкой',
                    rejected: 'отклонено', expired: 'истекло' }[r.status] || r.status
                }</Badge> },
              { key: 'decided_by_name', title: 'Кто', render: (r) => r.decided_by_name || '—' },
              { key: 'created_at', title: 'Когда', align: 'right',
                render: (r) => <span className="text-xs text-muted-foreground">
                  {dateTime(r.decided_at || r.created_at)}
                </span> },
            ]}
            rows={approvals.data || []}
          />
        )}
      </Panel>

      {edit && (
        <Modal title={`${edit.agent_title}: ${edit.action_title}`} onClose={() => setEdit(null)}>
          <div className="space-y-4">
            <ErrorNote error={error} />
            <div className="rounded-lg border border-line px-3 py-2 text-sm">
              <div className="font-mono text-xs text-muted-foreground">
                {edit.action_type} → {edit.target_system}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">минимальная уверенность: </span>
                  {num(edit.min_confidence * 100, 1)} %
                </div>
                <div>
                  <span className="text-muted-foreground">порог самостоятельности: </span>
                  {edit.autonomy_threshold}
                </div>
              </div>
            </div>

            {edit.has_side_effect && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                Это действие меняет что-то вне системы. Режим «сам» здесь означает,
                что агент выполнит его без вашего участия и вы узнаете об этом из журнала.
              </p>
            )}

            {edit.action_type === 'cfg.write_src' && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                Запись в выгрузку клиента. Разрешать её не следует: агент должен писать
                только в свои папки _index и _reports. Изменить чужую конфигурацию
                и потом не суметь объяснить, что именно изменилось, — это тот случай,
                после которого клиент не возвращается.
              </p>
            )}

            <div className="space-y-2">
              {MODES.map(([mode, label, cls]) => (
                <button key={mode} disabled={busy} onClick={() => apply(mode)}
                  className={cx('flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition',
                    edit.mode === mode
                      ? 'border-blue/50 bg-blue/10'
                      : 'border-line hover:border-blue/40')}>
                  <span className={cls}>{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {mode === 'deny' && 'не может даже предложить'}
                    {mode === 'propose' && 'готовит, решаете вы'}
                    {mode === 'auto' && 'делает и отчитывается'}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Отзыв права не стирает запись: прежняя строка помечается отозванной,
              и в базе остаётся след того, что право когда-то выдавалось.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
