/**
 * Компании. Домены и телефоны здесь — не справочная информация, а рабочее
 * правило: по ним Регистратор опознаёт клиента во входящем письме.
 * Пустой список доменов означает, что заявки этого клиента придут «ничьими».
 */
import React, { useState } from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { useAuth } from '@/lib/auth/AuthContext';
import { fetchCompanies, saveCompany } from '@/lib/supabase/queries';
import {
  Badge, Button, Empty, ErrorNote, Field, Panel, Spinner, inputClass, money,
} from '@/components/admin/ui';

const EMPTY = {
  title: '', bin: '', domains: '', phones: '', hourly_rate: '', status: 'lead',
  bank_name: '', bank_iban: '', bank_bic: '', address: '', note: '',
};

const STATUSES = [
  ['lead', 'лид'], ['active', 'в работе'], ['support', 'на сопровождении'], ['archived', 'в архиве'],
];

const digitsOnly = (value) => value.replace(/[^0-9]/g, '');

export default function Companies() {
  const { person } = useAuth();
  const list = useAsync(fetchCompanies);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const edit = (company) => setForm(company ? {
    ...EMPTY, ...company,
    domains: (company.domains || []).join(', '),
    phones: (company.phones || []).join(', '),
    hourly_rate: company.hourly_rate ?? '',
  } : { ...EMPTY });

  const submit = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      await saveCompany({
        id: form.id,
        tenant_id: person.tenant_id,
        title: form.title.trim(),
        bin: form.bin.trim() || null,
        address: form.address.trim() || null,
        bank_name: form.bank_name.trim() || null,
        bank_iban: form.bank_iban.trim() || null,
        bank_bic: form.bank_bic.trim() || null,
        // Домены в нижнем регистре, телефоны только цифрами — иначе
        // сопоставление в crm.resolve_company не сработает.
        domains: form.domains.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        phones: form.phones.split(',').map(digitsOnly).filter(Boolean),
        hourly_rate: form.hourly_rate === '' ? null : Number(form.hourly_rate),
        status: form.status,
        note: form.note.trim() || null,
      });
      setForm(null); list.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Компании</h1>
        <Button onClick={() => edit(null)}>Добавить</Button>
      </div>

      {/* Ошибка формы и ошибка загрузки списка — разные вещи, и обе должны
          быть видны. Экран, который сломан, но выглядит пустым, — это тот
          самый мёртвый канал, который живёт незамеченным. */}
      <ErrorNote error={error} />
      <ErrorNote error={list.error} />

      {form && (
        <Panel title={form.id ? 'Правка компании' : 'Новая компания'}>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Название"><input required className={inputClass} value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="БИН / ИИН"><input className={inputClass} value={form.bin}
              onChange={(e) => setForm({ ...form, bin: e.target.value })} /></Field>
            <Field label="Статус">
              <select className={inputClass} value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Домены почты" hint="через запятую: alfa.kz, alfa-group.kz">
              <input className={inputClass} value={form.domains}
                     onChange={(e) => setForm({ ...form, domains: e.target.value })} /></Field>
            <Field label="Телефоны" hint="через запятую, любые разделители">
              <input className={inputClass} value={form.phones}
                     onChange={(e) => setForm({ ...form, phones: e.target.value })} /></Field>
            <Field label="Ставка, ₸/час" hint="пусто — берётся общая">
              <input type="number" className={inputClass} value={form.hourly_rate}
                     onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} /></Field>
            <Field label="Банк"><input className={inputClass} value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></Field>
            <Field label="IBAN"><input className={inputClass} value={form.bank_iban}
              onChange={(e) => setForm({ ...form, bank_iban: e.target.value })} /></Field>
            <Field label="БИК"><input className={inputClass} value={form.bank_bic}
              onChange={(e) => setForm({ ...form, bank_bic: e.target.value })} /></Field>
            <Field label="Адрес"><input className={inputClass} value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Заметка"><input className={inputClass} value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>

            <div className="flex items-end gap-2">
              <Button type="submit" disabled={busy}>Сохранить</Button>
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>Отмена</Button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title={`Список${list.data ? `: ${list.data.length}` : ''}`}>
        {list.loading ? <Spinner /> : !list.data?.length ? (
          <Empty>Ни одной компании. Занесите текущих клиентов — это выборка для проверки опознания.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Компания</th>
                  <th className="pb-2 font-medium">Статус</th>
                  <th className="pb-2 font-medium">Домены</th>
                  <th className="pb-2 font-medium">Телефоны</th>
                  <th className="pb-2 font-medium">Ставка</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {list.data.map((c) => (
                  <tr key={c.id} className="border-t border-line/60">
                    <td className="py-2 pr-3">{c.title}
                      {c.bin && <div className="text-[11px] text-muted-foreground">БИН {c.bin}</div>}</td>
                    <td className="py-2 pr-3"><Badge>{c.status}</Badge></td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {(c.domains || []).join(', ') || <span className="text-amber-400">не заданы</span>}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{(c.phones || []).join(', ') || '—'}</td>
                    <td className="py-2 pr-3 tabular-nums">{c.hourly_rate ? money(c.hourly_rate) : '—'}</td>
                    <td className="py-2 text-right">
                      <Button variant="ghost" onClick={() => edit(c)}>Править</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
