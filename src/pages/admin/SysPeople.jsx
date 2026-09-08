/**
 * Люди и доступ.
 *
 * Два разных списка, и путать их нельзя.
 *
 * «Допущенные адреса» — это то, кто ВООБЩЕ может войти в панель. Публичная
 * регистрация в Supabase включена по умолчанию, и без этого списка любой
 * желающий зарегистрировался бы и стал владельцем ваших заявок. Список живёт
 * таблицей в базе, а не галочкой в настройках: галочку можно случайно вернуть.
 *
 * «Люди» — те, кто уже вошёл хотя бы раз, плюс те, кому шлёт сообщения Вестник.
 * Отдельно видно, нажал ли человек «Старт» у бота: бот не может написать
 * первым, и «есть chat_id» с «нам разрешено писать» — два разных факта.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  fetchPeople, savePerson, fetchRoles, setPersonRoles,
  fetchAllowedEmails, addAllowedEmail, removeAllowedEmail,
} from '@/lib/supabase/queries';
import {
  Badge, Button, ErrorNote, Field, Modal, Panel, Spinner, Stat, Table,
  dateTime, inputClass, num,
} from '@/components/admin/ui';

export default function SysPeople() {
  const { person } = useAuth();
  const people = useAsync(fetchPeople);
  const roles = useAsync(fetchRoles);
  const allowed = useAsync(fetchAllowedEmails);
  const [form, setForm] = React.useState(null);
  const [invite, setInvite] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  if (people.loading) return <Spinner />;

  const rows = people.data || [];

  const submitPerson = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      const saved = await savePerson({
        id: form.id,
        tenant_id: person.tenant_id,
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        position: form.position.trim() || null,
        tg_chat_id: form.tg_chat_id === '' ? null : Number(form.tg_chat_id),
        is_active: form.is_active,
      });
      await setPersonRoles(person.tenant_id, saved.id, form.roles);
      setForm(null); people.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const submitInvite = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      await addAllowedEmail({
        email: invite.email.trim().toLowerCase(),
        tenant_id: person.tenant_id,
        role_code: invite.role_code,
        note: invite.note.trim() || null,
      });
      setInvite(null); allowed.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold tracking-tight">Люди и доступ</h1>
      <ErrorNote error={people.error || error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Людей" value={rows.length} />
        <Stat label="Вошли хотя бы раз" value={rows.filter((r) => r.auth_user_id).length} />
        <Stat label="Готовы получать сообщения" value={rows.filter((r) => r.tg_ready).length}
              hint="нажали «Старт» у бота" />
        <Stat label="Допущенных адресов" value={(allowed.data || []).length}
              tone={(allowed.data || []).length ? 'default' : 'bad'} />
      </div>

      <Panel title="Кто может войти в панель"
             action={<Button onClick={() => { setError(null); setInvite({ email: '', role_code: 'owner', note: '' }); }}>
               Допустить адрес
             </Button>}>
        <p className="mb-3 text-xs text-muted-foreground">
          Вход разрешён только адресам из этого списка. Регистрация в Supabase может быть
          включена — она не даёт доступа к данным: при первом входе база сверяет адрес
          из <code className="font-mono">auth.users</code> с этим списком и отказывает,
          если его там нет. Сверяется именно подтверждённый адрес, а не тот, что прислал браузер.
        </p>
        {allowed.loading ? <Spinner /> : (
          <Table
            empty="Список пуст. Это значит, что войти не может никто — включая вас после выхода."
            rowKey={(r) => r.email}
            cols={[
              { key: 'email', title: 'Адрес',
                render: (r) => <span className="font-mono text-xs">{r.email}</span> },
              { key: 'role_code', title: 'Роль при первом входе',
                render: (r) => <Badge>{r.role_code}</Badge> },
              { key: 'note', title: 'Примечание',
                render: (r) => r.note || <span className="text-muted-foreground">—</span> },
              { key: 'added_at', title: 'Добавлен', align: 'right',
                render: (r) => <span className="text-xs text-muted-foreground">{dateTime(r.added_at)}</span> },
              { key: 'act', title: '', align: 'right',
                render: (r) => (
                  <Button variant="danger" onClick={async () => {
                    if (!window.confirm(`Убрать ${r.email} из допущенных? Если этот человек ещё не входил, войти он больше не сможет.`)) return;
                    try { await removeAllowedEmail(r.email); allowed.reload(); }
                    catch (err) { setError(err); }
                  }}>
                    Убрать
                  </Button>
                ) },
            ]}
            rows={allowed.data || []}
          />
        )}
      </Panel>

      <Panel title="Люди"
             action={<Button onClick={() => {
               setError(null);
               setForm({ full_name: '', email: '', position: '', tg_chat_id: '', is_active: true, roles: [] });
             }}>Добавить</Button>}>
        <Table
          empty="Людей нет."
          cols={[
            { key: 'full_name', title: 'Имя',
              render: (r) => (
                <div>
                  <div>{r.full_name}</div>
                  {r.position && <div className="text-xs text-muted-foreground">{r.position}</div>}
                </div>
              ) },
            { key: 'email', title: 'Почта',
              render: (r) => r.email
                ? <span className="font-mono text-xs">{r.email}</span>
                : <span className="text-muted-foreground">—</span> },
            { key: 'roles', title: 'Роли',
              render: (r) => !r.roles?.length
                ? <span className="text-xs text-muted-foreground">нет</span>
                : <div className="flex flex-wrap gap-1">
                    {r.roles.map((code) => <Badge key={code}>{code}</Badge>)}
                  </div> },
            { key: 'tg', title: 'Telegram',
              render: (r) => !r.tg_chat_id
                ? <span className="text-xs text-muted-foreground">не привязан</span>
                : r.tg_ready
                  ? <span className="text-xs text-emerald-400">получает сообщения</span>
                  : <span className="text-xs text-amber-400">не нажал «Старт»</span> },
            { key: 'steps_month', title: 'Шагов за месяц', align: 'right',
              render: (r) => num(r.steps_month) },
            { key: 'is_active', title: 'Состояние',
              render: (r) => r.is_active
                ? <Badge tone="approved">работает</Badge>
                : <Badge tone="cancelled">отключён</Badge> },
            { key: 'act', title: '', align: 'right',
              render: (r) => (
                <Button variant="ghost" onClick={() => {
                  setError(null);
                  setForm({
                    ...r,
                    email: r.email || '', position: r.position || '',
                    tg_chat_id: r.tg_chat_id ?? '', roles: r.roles || [],
                  });
                }}>Изменить</Button>
              ) },
          ]}
          rows={rows}
        />
      </Panel>

      {invite && (
        <Modal title="Допустить адрес" onClose={() => setInvite(null)}>
          <form onSubmit={submitInvite} className="space-y-4">
            <ErrorNote error={error} />
            <Field label="Адрес почты"
                   hint="Ровно тот, которым человек войдёт. Регистр не важен, пробелы убираются.">
              <input className={inputClass} type="email" required value={invite.email}
                     onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            </Field>
            <Field label="Роль при первом входе">
              <select className={inputClass} value={invite.role_code}
                      onChange={(e) => setInvite({ ...invite, role_code: e.target.value })}>
                {(roles.data || []).map((r) => (
                  <option key={r.code} value={r.code}>{r.title} ({r.code})</option>
                ))}
              </select>
            </Field>
            <Field label="Примечание">
              <input className={inputClass} value={invite.note}
                     onChange={(e) => setInvite({ ...invite, note: e.target.value })}
                     placeholder="например: бухгалтер на аутсорсе" />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>Допустить</Button>
              <Button type="button" variant="ghost" onClick={() => setInvite(null)}>Отмена</Button>
            </div>
          </form>
        </Modal>
      )}

      {form && (
        <Modal title={form.id ? form.full_name : 'Новый человек'} onClose={() => setForm(null)}>
          <form onSubmit={submitPerson} className="space-y-4">
            <ErrorNote error={error} />
            <Field label="Имя">
              <input className={inputClass} required value={form.full_name}
                     onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Почта">
                <input className={inputClass} type="email" value={form.email}
                       onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Должность">
                <input className={inputClass} value={form.position}
                       onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </Field>
            </div>
            <Field label="Telegram chat_id"
                   hint="Узнать можно у @userinfobot. Сообщения начнут приходить только после того, как человек нажмёт «Старт» у вашего бота.">
              <input className={inputClass} value={form.tg_chat_id}
                     onChange={(e) => setForm({ ...form, tg_chat_id: e.target.value.replace(/[^0-9-]/g, '') })} />
            </Field>
            <Field label="Роли">
              <div className="flex flex-wrap gap-2">
                {(roles.data || []).map((r) => {
                  const on = form.roles.includes(r.code);
                  return (
                    <button key={r.code} type="button"
                      onClick={() => setForm({
                        ...form,
                        roles: on ? form.roles.filter((c) => c !== r.code) : [...form.roles, r.code],
                      })}
                      className={`rounded-lg border px-2.5 py-1 text-xs ${
                        on ? 'border-blue/50 bg-blue/10 text-blue' : 'border-line text-muted-foreground'}`}>
                      {r.title}
                    </button>
                  );
                })}
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active}
                     onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Работает
            </label>
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
