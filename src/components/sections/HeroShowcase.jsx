import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PRODUCTS } from '@/lib/content/site';

/**
 * Витрина справа на главной — вместо макета админки с выдуманными цифрами.
 *
 * Пять сцен показывают, что продукты делают на самом деле: утренний дайджест в
 * Telegram, разноску выписки, фото накладной → черновик в 1С, 1С в центре
 * обменов и карусель настоящего каталога (цены — из site.js). Все суммы внутри
 * сцен «Telegram», «выписка» и «накладная» — пример, о чём говорит подпись в углу.
 *
 * Листается стрелками, точками, клавишами ← → и свайпом; сама переключается раз
 * в 10 секунд и стоит, пока на неё навели мышь. При «уменьшить движение» сцены
 * показываются сразу в конечном состоянии, без автопрокрутки.
 */

const CSS = `
@keyframes tks-up{from{opacity:0;transform:translateY(12px) scale(.97);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}
@keyframes tks-shim{to{background-position:200% 0}}
@keyframes tks-beam{0%{top:6%}100%{top:84%}}
@keyframes tks-flow{to{stroke-dashoffset:-40}}
@keyframes tks-dot{0%,80%,100%{opacity:.25}40%{opacity:1}}
@keyframes tks-ring{to{transform:rotateX(-8deg) rotateY(-360deg)}}
@keyframes tks-float{to{transform:translate(24px,-16px) scale(1.12)}}
@keyframes tks-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.tks *{animation:none!important;transition:none!important}}
`;

const UP = 'tks-up .5s cubic-bezier(.2,.8,.2,1) both';
const glass = {
  background: 'linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.025))',
  border: '1px solid rgba(255,255,255,.1)', backdropFilter: 'blur(14px)', borderRadius: 16,
};
const money = (n) => `${Number(n).toLocaleString('ru-RU').replace(/,/g, ' ')} ₸`;

/** Петля сцены: fn(wait) крутится, пока сцена на экране; уход со сцены её обрывает. */
function useScene(fn, reduce, final) {
  useEffect(() => {
    if (reduce) { final(); return undefined; }
    let alive = true;
    const timers = new Set();
    const wait = (ms) => new Promise((resolve, reject) => {
      const t = setTimeout(() => { timers.delete(t); alive ? resolve() : reject(new Error('stop')); }, ms);
      timers.add(t);
    });
    (async () => { try { for (;;) { await fn(wait); } } catch { /* сцену сменили */ } })();
    return () => { alive = false; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
}

function Glow({ style }) {
  return <div className="absolute rounded-full pointer-events-none"
    style={{ filter: 'blur(50px)', animation: 'tks-float 9s ease-in-out infinite alternate', ...style }} />;
}

/* ── 1. Утро в Telegram ─────────────────────────────────────────────────── */
const TG = [
  ['#7C5CFF', 'ЭСФ-контролёр', '2 реализации без ЭСФ', 'под риском НДС 384 000 ₸'],
  ['#ffb547', 'Дебиторка', '3 покупателя просрочили', '1 240 000 ₸ · дольше 30 дней'],
  ['#3fd08a', 'Робот разноски', 'Выписка разнесена', '46 из 48 · 2 вопроса вам'],
  ['#ff6b6b', 'Антикамералка', 'Расхождение по 300.00', 'ТОО «Альфа» · 112 000 ₸'],
];
function TelegramScene({ reduce }) {
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  useScene(async (wait) => {
    setShown(0);
    for (let i = 0; i < TG.length; i += 1) {
      setTyping(true); await wait(650); setTyping(false); setShown(i + 1); await wait(500);
    }
    await wait(3400);
  }, reduce, () => setShown(TG.length));
  return (
    <div className="absolute inset-0" style={{ perspective: 900 }}>
      <Glow style={{ width: 240, height: 240, background: '#6a4cff', opacity: 0.35, left: '30%', top: '18%' }} />
      <div style={{
        position: 'absolute', left: '50%', top: 20, width: 236, height: 392, marginLeft: -118, borderRadius: 34, padding: 10,
        background: 'linear-gradient(160deg,#2a2638,#121018)', border: '1px solid rgba(255,255,255,.14)',
        transform: 'rotateY(-14deg) rotateX(6deg)',
        boxShadow: '-30px 40px 80px -20px rgba(0,0,0,.8),0 0 60px rgba(124,92,255,.25)',
      }}>
        <div style={{ height: '100%', borderRadius: 26, background: '#0e0d16', overflow: 'hidden' }}>
          <div className="flex items-center gap-2.5" style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.03)' }}>
            <div className="grid place-items-center text-white font-bold text-[13px]"
              style={{ width: 30, height: 30, borderRadius: '50%', background: 'conic-gradient(from 200deg,#7C5CFF,#b49bff,#7C5CFF)' }}>T</div>
            <div>
              <div className="text-[12.5px] font-semibold text-white">Tinker</div>
              <div className="text-[10.5px]" style={{ color: '#7fd9a8' }}>бот · в сети</div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5" style={{ padding: '10px 10px' }}>
            <div className="self-center text-[10px] px-2.5 py-0.5 rounded-full" style={{ color: '#6f6c80', background: 'rgba(255,255,255,.05)' }}>сегодня, 09:00</div>
            {TG.slice(0, shown).map((m) => (
              <div key={m[1]} style={{
                animation: UP, background: 'linear-gradient(180deg,#1f1c2e,#191726)', border: '1px solid rgba(255,255,255,.06)',
                borderLeft: `3px solid ${m[0]}`, borderRadius: '14px 14px 14px 4px', padding: '6px 9px',
              }}>
                <div className="text-[10px] font-semibold" style={{ color: m[0] }}>{m[1]}</div>
                <div className="text-[11.5px] font-medium text-white leading-snug">{m[2]}</div>
                <div className="text-[10.5px] leading-snug" style={{ color: '#9a97ad' }}>{m[3]}</div>
              </div>
            ))}
            {typing && (
              <div className="flex gap-1" style={{ padding: '8px 10px', width: 44, borderRadius: 12, background: '#1b1928' }}>
                {[0, 1, 2].map((i) => <i key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#a48bff', animation: `tks-dot 1s ${i * 0.15}s infinite` }} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 2. Выписка разносится сама ──────────────────────────────────────────── */
const BANK = [
  ['KASPI PAY · КНП 710', '+48 500', 'Оплата покупателя'],
  ['ТОО «Альфа» · КНП 859', '−320 000', 'Оплата поставщику'],
  ['Комиссия банка', '−1 200', 'Прочие расходы'],
  ['Свой счёт Halyk', '−500 000', 'Перемещение денег'],
  ['ОПВ · КНП 010', '−21 625', 'Налоги и взносы'],
  ['ИП Серікбай · КНП 710', '+156 000', 'Оплата покупателя'],
  ['Возврат от ТОО «Бета»', '+12 000', 'Возврат поставщика'],
  ['Без назначения', '+7 400', null],
];
function BankScene({ reduce }) {
  const [done, setDone] = useState(0);
  useScene(async (wait) => {
    setDone(0);
    for (let i = 1; i <= BANK.length; i += 1) { await wait(520); setDone(i); }
    await wait(3600);
  }, reduce, () => setDone(BANK.length));
  return (
    <div className="absolute inset-0">
      <Glow style={{ width: 220, height: 220, background: '#5b3df5', opacity: 0.3, right: -40, top: -40 }} />
      <div className="absolute flex flex-col" style={{ ...glass, inset: '26px 22px 40px', padding: '16px 16px' }}>
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="text-[14px] font-semibold text-white">Выписка · Kaspi Bank</div>
            <div className="text-[11px] font-mono" style={{ color: '#6b6980' }}>03.10.2026 · 8 операций</div>
          </div>
          <div className="text-[12px] font-mono" style={{ color: '#a48bff' }}>{done} / {BANK.length}</div>
        </div>
        <div className="mb-2.5 overflow-hidden" style={{ height: 3, borderRadius: 3, background: 'rgba(255,255,255,.07)' }}>
          <div style={{ height: '100%', width: `${(done / BANK.length) * 100}%`, background: 'linear-gradient(90deg,#7C5CFF,#c3b2ff)', boxShadow: '0 0 12px #7C5CFF', transition: 'width .5s' }} />
        </div>
        <div className="flex flex-col text-[12px]">
          {BANK.map((r, i) => {
            const ready = i < done;
            const question = !r[2];
            return (
              <div key={r[0]} className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 70px 128px', padding: '5px 2px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <span className="truncate" style={{ color: '#cfcde0' }}>{r[0]}</span>
                <span className="font-mono text-right" style={{ color: r[1][0] === '+' ? '#7fe0a8' : '#cfcde0' }}>{r[1]}</span>
                {ready ? (
                  <span className="justify-self-end text-[10.5px] px-2 py-0.5 rounded-full truncate max-w-full" style={{
                    animation: UP,
                    background: question ? 'rgba(255,181,71,.14)' : 'rgba(124,92,255,.18)',
                    color: question ? '#ffc56b' : '#c8b9ff',
                    border: `1px solid ${question ? 'rgba(255,181,71,.35)' : 'rgba(164,139,255,.35)'}`,
                  }}>{question ? 'вопрос вам →' : `✓ ${r[2]}`}</span>
                ) : (
                  <span className="justify-self-end rounded-full" style={{
                    width: 90, height: 18, background: 'linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.12),rgba(255,255,255,.04))',
                    backgroundSize: '200% 100%', animation: 'tks-shim 1.2s linear infinite',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── 3. Фото накладной → черновик в 1С ───────────────────────────────────── */
const FIELDS = [
  ['Поставщик', 'ТОО «Пример Трейд»'], ['Номер, дата', '418 от 02.10.2026'],
  ['Строк', '3 · номенклатура найдена'], ['Сумма', '51 500 ₸'], ['НДС', 'в сумме, 16 %'],
];
function ScanScene({ reduce }) {
  const [shown, setShown] = useState(0);
  useScene(async (wait) => {
    setShown(0);
    for (let i = 1; i <= FIELDS.length + 1; i += 1) { await wait(620); setShown(i); }
    await wait(3400);
  }, reduce, () => setShown(FIELDS.length + 1));
  return (
    <div className="absolute inset-0" style={{ perspective: 1000 }}>
      <Glow style={{ width: 200, height: 200, background: '#7C5CFF', opacity: 0.3, left: '38%', top: '30%' }} />
      <div className="absolute overflow-hidden" style={{
        left: 22, top: 56, width: 172, height: 250, padding: 14, borderRadius: 6, color: '#2b2a33', fontSize: 11, lineHeight: 1.85,
        background: 'linear-gradient(170deg,#f7f5ef,#e9e5da)', transform: 'rotateY(18deg) rotateZ(-3deg)', boxShadow: '-20px 30px 60px rgba(0,0,0,.6)',
      }}>
        <div className="font-bold text-[12.5px]">НАКЛАДНАЯ № 418</div>
        <div style={{ color: '#77736a' }}>от 02.10.2026</div>
        <div className="mt-1.5">ТОО «Пример Трейд»</div>
        <div style={{ borderTop: '1px dashed #b9b4a6', margin: '6px 0' }} />
        <div>Мука в/с · 20 кг · 9 600</div><div>Сахар · 50 кг · 27 500</div><div>Масло · 12 л · 14 400</div>
        <div style={{ borderTop: '1px dashed #b9b4a6', margin: '6px 0' }} />
        <div className="font-bold">Итого: 51 500 ₸</div>
        <div className="absolute left-0 right-0" style={{
          height: 44, background: 'linear-gradient(180deg,transparent,rgba(124,92,255,.35),transparent)', borderBottom: '2px solid #7C5CFF',
          boxShadow: '0 0 24px #7C5CFF', animation: 'tks-beam 2.6s cubic-bezier(.6,0,.4,1) infinite alternate',
        }} />
      </div>
      <svg className="absolute" style={{ left: 190, top: 150 }} width="64" height="90" aria-hidden="true">
        <path d="M4 45 C 28 5, 36 85, 60 45" stroke="#8b6cff" strokeWidth="2" fill="none" strokeDasharray="4 6" style={{ animation: 'tks-flow 1s linear infinite' }} />
      </svg>
      <div className="absolute" style={{ ...glass, right: 18, top: 58, width: 232, padding: 14 }}>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="grid place-items-center font-bold" style={{ width: 22, height: 22, borderRadius: 6, background: '#f5c518', color: '#1b1b1b', fontSize: 10 }}>1С</div>
          <div className="text-[12.5px] font-semibold text-white">Поступление товаров</div>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,196,0,.15)', color: '#ffcf5a' }}>черновик</span>
        </div>
        <div className="flex flex-col gap-1.5 text-[11.5px]">
          {FIELDS.slice(0, shown).map((f) => (
            <div key={f[0]} className="flex justify-between gap-2" style={{
              animation: UP, padding: '5px 8px', borderRadius: 9, background: 'rgba(124,92,255,.08)', border: '1px solid rgba(164,139,255,.18)',
            }}>
              <span style={{ color: '#8d8aa3' }}>{f[0]}</span><span className="font-medium text-white text-right">{f[1]}</span>
            </div>
          ))}
          {shown > FIELDS.length && (
            <div className="mt-1 text-[11px]" style={{ color: '#7fe0a8', animation: UP }}>✓ Проверьте и проведите — проводит человек</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 4. 1С в центре всего ────────────────────────────────────────────────── */
const NODES = ['Банк', 'ИС ЭСФ', 'Kaspi', 'Telegram', 'iiko', 'WhatsApp', 'ИС МПТ', 'КГД'];
function HubScene({ reduce }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let w = 0; let h = 0; let raf = 0; let packets = [];
    const resize = () => {
      const r = canvas.getBoundingClientRect(); const d = window.devicePixelRatio || 1;
      w = r.width; h = r.height; canvas.width = w * d; canvas.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const draw = (ms) => {
      const t = reduce ? 0 : ms / 1000;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2; const cy = h / 2; const rx = Math.min(w * 0.39, 210); const ry = h * 0.36;
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx * 1.2);
      halo.addColorStop(0, 'rgba(124,92,255,.22)'); halo.addColorStop(1, 'rgba(124,92,255,0)');
      ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(164,139,255,.12)'; ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      const pos = NODES.map((_, i) => {
        const a = t * 0.12 + (i / NODES.length) * Math.PI * 2;
        return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, Math.sin(a)];
      });
      pos.forEach(([px, py]) => {
        const g = ctx.createLinearGradient(cx, cy, px, py);
        g.addColorStop(0, 'rgba(164,139,255,.5)'); g.addColorStop(1, 'rgba(164,139,255,.06)');
        ctx.strokeStyle = g; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo((cx + px) / 2, (cy + py) / 2 - 30, px, py); ctx.stroke();
      });
      if (!reduce && Math.random() < 0.08) {
        packets.push({ i: Math.floor(Math.random() * NODES.length), t: 0, s: 0.006 + Math.random() * 0.008, out: Math.random() < 0.5 });
      }
      packets = packets.filter((p) => (p.t += p.s) < 1);
      packets.forEach((p) => {
        const [px, py] = pos[p.i]; const u = p.out ? p.t : 1 - p.t;
        const qx = (cx + px) / 2; const qy = (cy + py) / 2 - 30;
        const bx = (1 - u) ** 2 * cx + 2 * (1 - u) * u * qx + u * u * px;
        const by = (1 - u) ** 2 * cy + 2 * (1 - u) * u * qy + u * u * py;
        ctx.shadowBlur = 14; ctx.shadowColor = '#a48bff'; ctx.fillStyle = '#e6dcff';
        ctx.beginPath(); ctx.arc(bx, by, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      });
      pos.map((p, i) => [p, i]).sort((a, b) => a[0][2] - b[0][2]).forEach(([[px, py, z], i]) => {
        const s = 0.85 + 0.15 * (z + 1) / 2;
        ctx.globalAlpha = 0.55 + 0.45 * (z + 1) / 2;
        ctx.font = `500 ${12 * s}px Inter, system-ui, sans-serif`;
        const bw = ctx.measureText(NODES[i]).width + 24 * s; const bh = 26 * s;
        ctx.fillStyle = 'rgba(22,19,36,.92)'; ctx.strokeStyle = 'rgba(164,139,255,.35)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px - bw / 2, py - bh / 2, bw, bh, bh / 2); else ctx.rect(px - bw / 2, py - bh / 2, bw, bh);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e9e6f6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(NODES[i], px, py + 0.5);
        ctx.globalAlpha = 1;
      });
      const pr = 34 + Math.sin(t * 2) * 3;
      const orb = ctx.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, pr + 26);
      orb.addColorStop(0, '#c9b8ff'); orb.addColorStop(0.45, '#7C5CFF'); orb.addColorStop(1, 'rgba(124,92,255,0)');
      ctx.fillStyle = orb; ctx.beginPath(); ctx.arc(cx, cy, pr + 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '700 20px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('1С', cx, cy + 1);
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [reduce]);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" aria-label="1С в центре обменов: банк, ИС ЭСФ, Kaspi, Telegram, iiko, WhatsApp, ИС МПТ, КГД" />;
}

/* ── 7. Витрина продуктов ────────────────────────────────────────────────── */
const RING = PRODUCTS.filter((p) => (p.group || '1c') === '1c').slice(0, 8);
function CatalogScene() {
  const n = RING.length; const radius = 232;
  return (
    <div className="absolute inset-0" style={{ perspective: 1000 }}>
      <Glow style={{ width: 280, height: 190, background: '#7C5CFF', opacity: 0.35, left: '24%', top: '28%' }} />
      <div className="absolute" style={{ left: '50%', top: '46%', width: 0, height: 0, transformStyle: 'preserve-3d', transform: 'translateZ(-170px)' }}>
        <div style={{ transformStyle: 'preserve-3d', animation: 'tks-ring 28s linear infinite' }}>
          {RING.map((p, i) => (
            <div key={p.id} className="absolute flex flex-col" style={{
              left: -90, top: -122, width: 180, height: 244, padding: 15, borderRadius: 18,
              transform: `rotateY(${(i * 360) / n}deg) translateZ(${radius}px)`, backfaceVisibility: 'hidden',
              background: 'linear-gradient(165deg,rgba(255,255,255,.12),rgba(255,255,255,.03))', border: '1px solid rgba(255,255,255,.14)',
              boxShadow: '0 20px 50px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.12)', backdropFilter: 'blur(8px)',
            }}>
              <div className="grid place-items-center text-[17px] mb-2.5" style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#7C5CFF,#b9a5ff)', boxShadow: '0 0 20px rgba(124,92,255,.6)' }}>{p.icon}</div>
              <div className="text-[9.5px] tracking-[0.08em] uppercase" style={{ color: '#a48bff' }}>Расширение 1С</div>
              <div className="text-[14px] font-semibold text-white leading-tight my-1">{p.name}</div>
              <div className="text-[11px] leading-snug" style={{ color: '#9a97ad', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.tagline}</div>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                <div>
                  <div className="text-[8.5px] uppercase tracking-wide" style={{ color: '#7d7a92' }}>Внедрение</div>
                  <div className="text-[12.5px] font-semibold text-white whitespace-nowrap">от {money(p.price)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[8.5px] uppercase tracking-wide" style={{ color: '#7d7a92' }}>Подписка/мес</div>
                  <div className="text-[12.5px] font-semibold text-white whitespace-nowrap">от {money(p.subscription)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute left-0 right-0 bottom-0" style={{ height: 70, background: 'linear-gradient(transparent,#08080b)' }} />
    </div>
  );
}

const SCENES = [
  { key: 'tg', title: 'Утро в Telegram', sub: 'Дайджест всех продуктов в 9:00', Comp: TelegramScene, example: true },
  { key: 'bank', title: 'Выписка разносится сама', sub: 'Робот разноски банка', Comp: BankScene, example: true },
  { key: 'scan', title: 'Фото → черновик в 1С', sub: 'ИИ-разбор первички', Comp: ScanScene, example: true },
  { key: 'hub', title: '1С в центре всего', sub: 'Банк, ИС ЭСФ, Kaspi, мессенджеры', Comp: HubScene },
  { key: 'catalog', title: 'Витрина продуктов', sub: 'Цены из каталога', Comp: CatalogScene },
];
const AUTO_MS = 10000;

export default function HeroShowcase() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const drag = useRef(null);

  const go = useCallback((next, d) => {
    setDir(d);
    setIndex((i) => (typeof next === 'number' ? next : (i + d + SCENES.length) % SCENES.length));
  }, []);

  useEffect(() => {
    if (reduce || paused) return undefined;
    const t = setTimeout(() => go(null, 1), AUTO_MS);
    return () => clearTimeout(t);
  }, [index, paused, reduce, go]);

  const scene = SCENES[index];
  const Comp = scene.Comp;

  return (
    <div
      className="tks relative w-full max-w-lg mx-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <style>{CSS}</style>
      <div className="absolute -inset-8 rounded-3xl bg-primary/5 blur-3xl pointer-events-none" />

      <div className="relative flex items-center gap-3 mb-3">
        <span className="font-mono text-[11px] px-2 py-0.5 rounded-full"
          style={{ color: '#a48bff', background: 'rgba(124,92,255,.12)', border: '1px solid rgba(124,92,255,.3)' }}>
          {String(index + 1).padStart(2, '0')} / {String(SCENES.length).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={scene.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              <p className="text-sm font-semibold text-white truncate">{scene.title}</p>
              <p className="text-[11px] text-white/35 truncate">{scene.sub}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <button type="button" onClick={() => go(null, -1)} aria-label="Предыдущий пример"
          className="w-8 h-8 rounded-full grid place-items-center border border-white/10 text-white/50 hover:text-white hover:border-primary/50 hover:bg-primary/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => go(null, 1)} aria-label="Следующий пример"
          className="w-8 h-8 rounded-full grid place-items-center border border-white/10 text-white/50 hover:text-white hover:border-primary/50 hover:bg-primary/10 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div
        role="region"
        aria-roledescription="карусель"
        aria-label={`Пример ${index + 1} из ${SCENES.length}: ${scene.title}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); go(null, 1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(null, -1); }
        }}
        onPointerDown={(e) => { drag.current = e.clientX; }}
        onPointerUp={(e) => {
          if (drag.current == null) return;
          const dx = e.clientX - drag.current; drag.current = null;
          if (Math.abs(dx) > 50) go(null, dx < 0 ? 1 : -1);
        }}
        className="relative overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary/60 select-none touch-pan-y"
        style={{
          height: 430, borderRadius: 22,
          background: 'radial-gradient(110% 90% at 85% -10%,#24184d 0%,#110d22 38%,#08080b 75%)',
          border: '1px solid rgba(255,255,255,.08)',
          boxShadow: '0 30px 80px -30px rgba(124,92,255,.45),inset 0 1px 0 rgba(255,255,255,.06)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)',
          backgroundSize: '28px 28px', maskImage: 'radial-gradient(80% 70% at 50% 40%,#000,transparent)', WebkitMaskImage: 'radial-gradient(80% 70% at 50% 40%,#000,transparent)',
        }} />
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={scene.key}
            className="absolute inset-0"
            custom={dir}
            initial={reduce ? false : { opacity: 0, x: 40 * dir, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={reduce ? undefined : { opacity: 0, x: -40 * dir, filter: 'blur(6px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <Comp reduce={reduce} />
          </motion.div>
        </AnimatePresence>
        {scene.example && (
          <div className="absolute right-3.5 bottom-2.5 text-[10px] tracking-wide text-white/25 pointer-events-none">данные — пример</div>
        )}
      </div>

      <div className="relative flex items-center justify-center gap-2 mt-3.5">
        {SCENES.map((s, i) => (
          <button key={s.key} type="button" onClick={() => go(i, i > index ? 1 : -1)} aria-label={`Пример ${i + 1}: ${s.title}`}
            aria-current={i === index}
            className="relative h-1.5 rounded-full overflow-hidden transition-all duration-300"
            style={{ width: i === index ? 34 : 10, background: i === index ? 'rgba(124,92,255,.25)' : 'rgba(255,255,255,.12)' }}>
            {i === index && !reduce && (
              <span key={`${index}-${paused}`} className="absolute inset-0 origin-left" style={{
                background: 'linear-gradient(90deg,#7C5CFF,#c3b2ff)',
                animation: paused ? 'none' : `tks-bar ${AUTO_MS}ms linear both`, transform: paused ? 'scaleX(0)' : undefined,
              }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
