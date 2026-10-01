/**
 * Налоги ИП: упрощёнка (910.00), ЭСФ, соцплатежи за себя.
 *
 * Деньги остаются в «Счета и акты» и «Оплаты» — здесь налоговый слой поверх них:
 * когда акт подписан (это дата дохода, НК ст. 725 п. 4, и начало 15 дней на ЭСФ),
 * выписан ли ЭСФ, кто покупатель (от этого зависит ЭСФ), что из выписки доход.
 *
 * Считает и напоминает ИИ-бухгалтер в Telegram (Products for AI Tinker / ИИ-бухгалтер),
 * там же точные сроки с праздниками и 910.00 по строкам. Экран ничего не подписывает
 * и не отправляет в ИС ЭСФ и КГД: номер ЭСФ вносит человек после выписки.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import {
  fetchTaxProfile, saveTaxProfile, fetchTaxActs, saveTaxAct, saveCompanyKind,
  fetchTaxIncome, fetchTaxEsf, fetchTaxBank, setBankLine,
} from '@/lib/supabase/queries';
import {
  BANK_KIND, BOOKKEEPING_MRP, BUYER_KIND, CHECKED, ESF_STATUS, LIMIT_MRP, MRP, PAY_METHOD, PREPARE,
  form910Due, halfLabel, halfYear, selfPayments,
} from '@/lib/admin/tax';
import {
  Badge, Button, Empty, ErrorNote, Field, Modal, Panel, Spinner, Stat, Table, Tabs,
  dateOnly, inputClass, money, num,
} from '@/components/admin/ui';

const today = () => new Date().toISOString().slice(0, 10);

export default function MoneyTax() {
  const profile = useAsync(fetchTaxProfile);
  const acts = useAsync(fetchTaxActs);
  const esf = useAsync(fetchTaxEsf);
  const bank = useAsync(() => fetchTaxBank());
  const year = today().slice(0, 4);
  const income = useAsync(() => fetchTaxIncome({ from: `${year}-01-01`, to: `${year}-12-31` }));
  const [tab, setTab] = React.useState('overview');
  const [edit, setEdit] = React.useState(null);      // { kind: 'act' | 'profile', row }
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  if (profile.loading || acts.loading) return <Spinner />;

  const p = profile.data;
  const rows = income.data || [];
  const [hStart, hEnd] = halfYear(today());
  const half = rows.filter((r) => r.income_date >= hStart && r.income_date <= hEnd);
  const halfIncome = half.reduce((s, r) => s + Number(r.amount || 0), 0);
  const ytd = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const mrp = MRP[year] || MRP[2026];
  const limit = LIMIT_MRP * mrp;
  const rate = Number(p?.rate || 4);
  const due = form910Due(hStart);
  const esfRows = esf.data || [];
  const esfOpen = esfRows.filter((r) => r.status === 'due' || r.status === 'overdue');
  const esfOverdue = esfRows.filter((r) => r.status === 'overdue');
  const unsigned = (acts.data || []).filter((r) => !r.signed_on);
  const bankOpen = bank.data || [];
  const social = selfPayments(Number(year), Number(p?.declared_self_income || 0));
  const socialTotal = social.reduce((s, x) => s + x.amount, 0);

  const run = async (fn) => {
    setError(null); setBusy(true);
    try { await fn(); setEdit(null); acts.reload(); esf.reload(); income.reload(); bank.reload(); profile.reload(); }
    catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Налоги ИП</h1>
        <span className="text-xs text-muted-foreground">
          Упрощёнка, 910.00. Нормы сверены {CHECKED}. Подписывает, отправляет и платит ИП — экран только ведёт учёт.
        </span>
      </div>
      <ErrorNote error={profile.error || acts.error || esf.error || income.error || bank.error || error} />

      {!p && (
        <Panel title="Режим подготовки: ИП ещё не зарегистрирован"
               action={<Button variant="ghost" onClick={() => setEdit({ kind: 'profile', row: {} })}>Заполнить профиль</Button>}>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            {PREPARE.map((x) => <li key={x}>{x}</li>)}
          </ol>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <Stat label={`Доход, ${halfLabel(hStart)}`} value={money(halfIncome)}
              hint={`налог ${num(rate, 1)} % — ${money(Math.round(Math.max(halfIncome, 0) * rate / 100))}`} />
        <Stat label="Сдать / уплатить 910.00" value={due.submit} hint={`уплатить до ${due.pay}`} />
        <Stat label="Доход с начала года" value={money(ytd)}
              hint={`${num(ytd / limit * 100, 2)} % лимита упрощёнки`}
              tone={ytd > limit * 0.8 ? 'warn' : 'default'} />
        <Stat label="ЭСФ выписать" value={esfOpen.length}
              hint={esfOverdue.length ? `срок прошёл: ${esfOverdue.length}` : 'просрочки нет'}
              tone={esfOverdue.length ? 'bad' : esfOpen.length ? 'warn' : 'good'} />
        <Stat label="Соцплатежи за себя в месяц" value={money(socialTotal)} hint="до 25-го следующего месяца" />
      </div>

      <Tabs value={tab} onChange={setTab} items={[
        { value: 'overview', label: 'Что сделать' },
        { value: 'esf', label: 'ЭСФ', count: esfOpen.length },
        { value: 'acts', label: 'Акты', count: unsigned.length },
        { value: 'bank', label: 'Выписка', count: bankOpen.length },
        { value: 'register', label: 'Регистр доходов' },
        { value: 'profile', label: 'Профиль ИП' },
      ]} />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Соцплатежи ИП за себя">
            <Table rowKey={(r) => r.code} rows={social} cols={[
              { key: 'code', title: 'Платёж' },
              { key: 'knp', title: 'КНП', render: (r) => <span className="font-mono text-xs">{r.knp}</span> },
              { key: 'amount', title: 'В месяц', align: 'right', render: (r) => money(r.amount) },
            ]} />
            <p className="mt-3 text-xs text-muted-foreground">
              С дохода {money(Number(p?.declared_self_income) > 0 ? p.declared_self_income : 85000)} в месяц.
              Декларируются в 910.00 (строки 005–010) — 200.00 без работников не сдаётся.
              Точный срок с учётом праздников — в сводке бота.
            </p>
          </Panel>
          <Panel title="Проверить">
            <ul className="space-y-2 text-sm">
              {esfOverdue.map((r) => (
                <li key={r.act} className="text-red-400">ЭСФ по акту {r.act} ({r.company}) — срок прошёл {dateOnly(r.esf_deadline)}</li>
              ))}
              {esfOpen.filter((r) => r.status === 'due').map((r) => (
                <li key={r.act} className="text-amber-400">ЭСФ по акту {r.act} — до {dateOnly(r.esf_deadline)}</li>
              ))}
              {unsigned.map((r) => (
                <li key={r.doc_id} className="text-muted-foreground">Акт {r.number} от {dateOnly(r.issued_on)} не подписан — нет даты дохода</li>
              ))}
              {bankOpen.filter((r) => r.kind === 'unknown').map((r) => (
                <li key={r.id} className="text-amber-400">Непонятное поступление {dateOnly(r.line_date)} {money(r.amount)} от {r.payer || '—'}</li>
              ))}
              {p && !p.kkm && (acts.data || []).some((r) => r.pay_method === 'qr_card' || r.pay_method === 'cash') && (
                <li className="text-red-400">Оплаты QR/картой/наличными без ККМ — подключить Kaspi Кассу (НК ст. 110)</li>
              )}
              {ytd > BOOKKEEPING_MRP * mrp && (
                <li className="text-amber-400">Доход выше {num(BOOKKEEPING_MRP)} МРП — нужен бухучёт (Закон о бухучёте ст. 2 п. 2)</li>
              )}
            </ul>
            {!esfOpen.length && !unsigned.length && !bankOpen.some((r) => r.kind === 'unknown') && (
              <Empty>Всё разобрано.</Empty>
            )}
          </Panel>
        </div>
      )}

      {tab === 'esf' && (
        <Panel title="ЭСФ по подписанным актам">
          <Table empty="Подписанных актов нет — ЭСФ выписывать не по чему." rowKey={(r) => r.act} rows={esfRows} cols={[
            { key: 'act', title: 'Акт', render: (r) => <span className="font-mono text-xs">{r.act}</span> },
            { key: 'company', title: 'Покупатель' },
            { key: 'buyer_kind', title: 'Вид', render: (r) => BUYER_KIND[r.buyer_kind] },
            { key: 'amount', title: 'Сумма', align: 'right', render: (r) => money(r.amount) },
            { key: 'signed_on', title: 'Подписан', render: (r) => dateOnly(r.signed_on) },
            { key: 'esf_deadline', title: 'Выписать до', render: (r) => dateOnly(r.esf_deadline) },
            { key: 'status', title: '', render: (r) => (
              <Badge tone={ESF_STATUS[r.status]?.tone}>{r.esf_number || ESF_STATUS[r.status]?.label}</Badge>
            ) },
          ]} />
          <p className="mt-3 text-xs text-muted-foreground">
            ЭСФ выписывается в ИС ЭСФ не позже 15 календарных дней после подписания акта (НК ст. 209 п. 7).
            Физлицу при чеке ККМ или оплате QR/картой — только по требованию (ст. 208 п. 2, 4).
            Номер ЭСФ внесите во вкладке «Акты».
          </p>
        </Panel>
      )}

      {tab === 'acts' && (
        <Panel title="Акты: подписание, оплата, ЭСФ">
          <Table empty="Актов ещё нет — их создают в «Счета и акты»." rowKey={(r) => r.doc_id}
                 rows={acts.data || []} onRowClick={(r) => setEdit({ kind: 'act', row: r })} cols={[
            { key: 'number', title: 'Акт', render: (r) => <span className="font-mono text-xs">{r.number}</span> },
            { key: 'issued_on', title: 'Составлен', render: (r) => dateOnly(r.issued_on) },
            { key: 'company', title: 'Покупатель' },
            { key: 'buyer_kind', title: 'Вид', render: (r) => BUYER_KIND[r.buyer_kind] },
            { key: 'amount', title: 'Сумма', align: 'right', render: (r) => money(r.amount) },
            { key: 'signed_on', title: 'Подписан', render: (r) => r.signed_on
              ? dateOnly(r.signed_on) : <span className="text-amber-400">нет</span> },
            { key: 'esf_number', title: 'ЭСФ', render: (r) => r.esf_number
              ? <span className="font-mono text-xs">{r.esf_number}</span> : '—' },
          ]} />
        </Panel>
      )}

      {tab === 'bank' && (
        <Panel title="Строки выписки, которые ждут вас">
          <Table empty="Неподтверждённых строк нет. Выписку Kaspi Pay загружают боту или из раннера."
                 rows={bankOpen} cols={[
            { key: 'line_date', title: 'Дата', render: (r) => dateOnly(r.line_date) },
            { key: 'amount', title: 'Сумма', align: 'right', render: (r) => (
              <span className={r.direction === 'in' ? 'text-emerald-400' : ''}>
                {r.direction === 'in' ? '+' : '−'}{money(r.amount)}
              </span>
            ) },
            { key: 'payer', title: 'Контрагент', render: (r) => r.company || r.payer || '—' },
            { key: 'purpose', title: 'Назначение', render: (r) => (
              <span className="text-xs text-muted-foreground">{r.purpose}</span>
            ) },
            { key: 'kind', title: 'Что это', render: (r) => (
              <select className={inputClass} value={r.kind} disabled={busy}
                      onChange={(e) => run(() => setBankLine(r.id, e.target.value))}>
                {Object.entries(BANK_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ) },
            { key: 'confirm', title: '', render: (r) => (
              <Button variant="ghost" disabled={busy || r.kind === 'unknown'}
                      onClick={() => run(() => setBankLine(r.id, r.kind, true))}>Подтвердить</Button>
            ) },
          ]} />
          <p className="mt-3 text-xs text-muted-foreground">
            Бухгалтер классифицирует строки сам (КНП, назначение, свои счета); подтверждает только человек.
            Оплата клиента — доход в дату акта, а не в дату денег: до акта это аванс.
          </p>
        </Panel>
      )}

      {tab === 'register' && (
        <Panel title={`Регистр доходов ${year}`}>
          <Table empty="Доходов нет: доход появляется, когда покупатель подписал акт." rows={rows}
                 rowKey={(r, i) => `${r.document}-${i}`} cols={[
            { key: 'income_date', title: 'Дата', render: (r) => dateOnly(r.income_date) },
            { key: 'document', title: 'Основание' },
            { key: 'company', title: 'Покупатель' },
            { key: 'amount', title: 'Доход', align: 'right', render: (r) => money(r.amount) },
          ]} />
          <p className="mt-3 text-xs text-muted-foreground">
            Подписанные акты (НК ст. 725 п. 4) и возвраты покупателям (ст. 724 п. 3). Регистр в Word — команда боту /register.
          </p>
        </Panel>
      )}

      {tab === 'profile' && (
        <Panel title="Профиль ИП"
               action={<Button variant="ghost" onClick={() => setEdit({ kind: 'profile', row: p || {} })}>Изменить</Button>}>
          {!p ? <Empty>Профиля нет — заполните после регистрации ИП.</Empty> : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">ИП</dt><dd>{p.name}</dd>
              <dt className="text-muted-foreground">ИИН</dt><dd className="font-mono">{p.iin}</dd>
              <dt className="text-muted-foreground">Зарегистрирован</dt><dd>{dateOnly(p.registered_on)}</dd>
              <dt className="text-muted-foreground">Ставка</dt><dd>{num(p.rate, 1)} % ({p.city || 'город не указан'})</dd>
              <dt className="text-muted-foreground">ОКЭД</dt><dd>{(p.okved || []).join(', ') || '—'}</dd>
              <dt className="text-muted-foreground">Счёт</dt><dd className="font-mono text-xs">{p.iban || '—'} {p.bik || ''}</dd>
              <dt className="text-muted-foreground">ККМ</dt><dd>{p.kkm ? 'есть' : 'нет'}</dd>
            </dl>
          )}
        </Panel>
      )}

      {edit?.kind === 'act' && (
        <ActForm row={edit.row} busy={busy} error={error} onClose={() => setEdit(null)}
                 onSave={(patch, kind) => run(async () => {
                   if (kind !== edit.row.buyer_kind) await saveCompanyKind(edit.row.company_id, kind);
                   await saveTaxAct(edit.row.doc_id, patch);
                 })} />
      )}
      {edit?.kind === 'profile' && (
        <ProfileForm row={edit.row} busy={busy} error={error} onClose={() => setEdit(null)}
                     onSave={(values) => run(() => saveTaxProfile(values))} />
      )}
    </div>
  );
}

function ActForm({ row, busy, error, onClose, onSave }) {
  const [f, setF] = React.useState({
    signed_on: row.signed_on || '', pay_method: row.pay_method || 'transfer', kkm_receipt: !!row.kkm_receipt,
    esf_number: row.esf_number || '', esf_date: row.esf_date || '', kind: row.buyer_kind || 'ul',
  });
  const submit = (e) => {
    e.preventDefault();
    const { kind, ...rest } = f;
    onSave({ ...rest, signed_on: rest.signed_on || null, esf_date: rest.esf_number ? (rest.esf_date || today()) : null },
           kind);
  };
  return (
    <Modal title={`Акт ${row.number} · ${row.company} · ${money(row.amount)}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorNote error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Покупатель — это" hint="От этого зависит, нужен ли ЭСФ">
            <select className={inputClass} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              {Object.entries(BUYER_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Подписан покупателем" hint="Дата дохода и начало 15 дней на ЭСФ">
            <input className={inputClass} type="date" min={row.issued_on} value={f.signed_on}
                   onChange={(e) => setF({ ...f, signed_on: e.target.value })} />
          </Field>
        </div>
        {f.kind === 'fl' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Как платил">
              <select className={inputClass} value={f.pay_method} onChange={(e) => setF({ ...f, pay_method: e.target.value })}>
                {Object.entries(PAY_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" checked={f.kkm_receipt} onChange={(e) => setF({ ...f, kkm_receipt: e.target.checked })} />
              выдан чек ККМ
            </label>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Номер ЭСФ" hint="Регистрационный номер из ИС ЭСФ — после выписки">
            <input className={inputClass} value={f.esf_number} disabled={!f.signed_on}
                   onChange={(e) => setF({ ...f, esf_number: e.target.value })} />
          </Field>
          <Field label="Дата ЭСФ">
            <input className={inputClass} type="date" value={f.esf_date} disabled={!f.esf_number}
                   onChange={(e) => setF({ ...f, esf_date: e.target.value })} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>Записать</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Отмена</Button>
        </div>
      </form>
    </Modal>
  );
}

function ProfileForm({ row, busy, error, onClose, onSave }) {
  const [f, setF] = React.useState({
    name: row.name || '', iin: row.iin || '', registered_on: row.registered_on || '', rate: row.rate ?? 4,
    city: row.city || '', okved: (row.okved || []).join(', '), iban: row.iban || '', bik: row.bik || 'CASPKZKA',
    kbe: row.kbe || '19', kkm: !!row.kkm, declared_self_income: row.declared_self_income ?? 0,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = (e) => {
    e.preventDefault();
    onSave({ ...f, rate: Number(f.rate), declared_self_income: Number(f.declared_self_income),
             okved: f.okved.split(/[\s,;]+/).filter(Boolean) });
  };
  return (
    <Modal title="Профиль ИП" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorNote error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Наименование"><input className={inputClass} required value={f.name} onChange={set('name')}
                                             placeholder="ИП Фамилия И." /></Field>
          <Field label="ИИН"><input className={inputClass} required pattern="\d{12}" value={f.iin} onChange={set('iin')} /></Field>
          <Field label="Дата регистрации"><input className={inputClass} type="date" required value={f.registered_on}
                                                 onChange={set('registered_on')} /></Field>
          <Field label="Ставка, %" hint="Решение маслихата, 2–6 % (НК ст. 726)">
            <input className={inputClass} type="number" min="2" max="6" step="0.5" required value={f.rate} onChange={set('rate')} />
          </Field>
          <Field label="Город"><input className={inputClass} value={f.city} onChange={set('city')} /></Field>
          <Field label="ОКЭД" hint="Через запятую, раздел 62"><input className={inputClass} value={f.okved} onChange={set('okved')} /></Field>
          <Field label="ИИК Kaspi Pay"><input className={inputClass} value={f.iban} onChange={set('iban')} /></Field>
          <Field label="БИК"><input className={inputClass} value={f.bik} onChange={set('bik')} /></Field>
          <Field label="Доход для соцплатежей, ₸" hint="0 — минимум 1 МЗП">
            <input className={inputClass} type="number" min="0" value={f.declared_self_income} onChange={set('declared_self_income')} />
          </Field>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input type="checkbox" checked={f.kkm} onChange={set('kkm')} /> есть онлайн-ККМ (Kaspi Касса)
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>Записать</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Отмена</Button>
        </div>
      </form>
    </Modal>
  );
}
