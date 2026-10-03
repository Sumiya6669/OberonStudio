import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Выпадающий список вместо системного <select>.
 *
 * Почему не <select>. Список вариантов у него рисует операционная система, а не
 * страница: наши тёмные стили до него не доходят, и на Windows выходит белая
 * простыня, где белый текст на белом фоне не виден вовсе. Поэтому здесь своя
 * панель — та же, что у разделов каталога в меню: тёмное стекло, мягкая тень,
 * появление с лёгким сдвигом.
 *
 * Пишется как обычный <select>: те же <option> внутри, те же value, onChange(e),
 * required, disabled, className — поэтому замена в формах механическая. Внутри
 * остаётся скрытый настоящий <select>: required по-прежнему не даст отправить
 * форму, а значение уходит вместе с формой, если у поля есть name.
 *
 * Панель уходит в портал: страница обёрнута в анимированный переход (transform)
 * и в прокручиваемые колонки — внутри них fixed-позиция и overflow панель
 * срезали бы или сдвигали. Места внизу мало — открывается вверх.
 */

function collectOptions(children, out = []) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      collectOptions(child.props.children, out);
    } else if (child.type === 'option') {
      const { value, children: label, disabled } = child.props;
      out.push({
        value: value === undefined ? String(label ?? '') : String(value),
        label,
        text: typeof label === 'string' || typeof label === 'number' ? String(label)
          : React.Children.toArray(label).filter((x) => typeof x === 'string' || typeof x === 'number').join(''),
        disabled: Boolean(disabled),
      });
    } else if (child.type === 'optgroup') {
      collectOptions(child.props.children, out);
    }
  });
  return out;
}

const PANEL_MAX = 288;

export default function Select({
  value, onChange, children, className = '', disabled = false, required = false, name, id,
  placeholder = '—', 'aria-label': ariaLabel, ...rest
}) {
  const options = useMemo(() => collectOptions(children), [children]);
  const current = String(value ?? '');
  const selected = options.find((o) => o.value === current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState(null);
  const button = useRef(null);
  const panel = useRef(null);
  const typed = useRef({ text: '', at: 0 });
  const listId = useId();

  const measure = useCallback(() => {
    if (!button.current) return;
    const r = button.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < Math.min(PANEL_MAX, options.length * 40 + 16) && r.top > below;
    setPlace({ left: r.left, width: Math.max(r.width, 180), top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined, up });
  }, [options.length]);

  const close = useCallback((focus = true) => {
    setOpen(false);
    if (focus) button.current?.focus();
  }, []);

  const choose = (opt) => {
    if (!opt || opt.disabled) return;
    if (opt.value !== current) onChange?.({ target: { value: opt.value, name }, currentTarget: { value: opt.value, name } });
    close();
  };

  const openList = () => {
    if (disabled) return;
    measure();
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (panel.current?.contains(e.target) || button.current?.contains(e.target)) return;
      close(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, measure, close]);

  // Подсвеченный пункт всегда виден в прокручиваемой панели.
  useEffect(() => {
    if (!open || active < 0) return;
    panel.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const step = (from, dir) => {
    for (let i = 1; i <= options.length; i += 1) {
      const next = (from + dir * i + options.length) % options.length;
      if (!options[next].disabled) return next;
    }
    return from;
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.preventDefault(); close(e.key === 'Escape'); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => step(a, 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => step(a, -1)); return; }
    if (e.key === 'Home') { e.preventDefault(); setActive(step(-1, 1)); return; }
    if (e.key === 'End') { e.preventDefault(); setActive(step(options.length, -1)); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(options[active]); return; }
    if (e.key.length === 1) {
      // Набор первых букв — прыжок к пункту, как у системного списка.
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now };
      const hit = options.findIndex((o) => !o.disabled && o.text.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  };

  return (
    <>
      <button
        {...rest}
        ref={button}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={`${className} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className={`min-w-0 truncate ${selected ? '' : 'opacity-50'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 opacity-50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Настоящий select: required и отправка формы работают как раньше. */}
      <select
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        required={required}
        disabled={disabled}
        value={current}
        onChange={() => {}}
        onFocus={() => button.current?.focus()}
        className="pointer-events-none absolute h-px w-px opacity-0"
        style={{ clip: 'rect(0 0 0 0)' }}
      >
        <option value="" />
        {options.map((o) => <option key={o.value} value={o.value}>{o.text}</option>)}
      </select>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && place && (
            <motion.div
              ref={panel}
              id={listId}
              role="listbox"
              initial={{ opacity: 0, y: place.up ? 6 : -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: place.up ? 6 : -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: PANEL_MAX }}
              className="fixed z-[70] overflow-y-auto rounded-2xl border border-line bg-surface/95 p-1.5 backdrop-blur-2xl
                [scrollbar-width:thin] [scrollbar-color:rgb(255_255_255/0.15)_transparent]
                shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)]"
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(ellipse at 0% 0%, hsl(252 100% 68% / 0.10), transparent 65%)' }}
              />
              {options.map((o, i) => {
                const isSelected = o.value === current;
                return (
                  <div
                    key={`${o.value}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={o.disabled}
                    onMouseEnter={() => !o.disabled && setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                    className={`relative flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[13px] leading-tight
                      transition-colors duration-150
                      ${o.disabled ? 'cursor-not-allowed text-white/20' : isSelected ? 'text-white' : 'text-white/60'}
                      ${i === active && !o.disabled ? 'bg-white/[0.06] text-white' : ''}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.label === '' || o.label == null ? '—' : o.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0 text-primary" />}
                  </div>
                );
              })}
              {options.length === 0 && <div className="px-3 py-2 text-[13px] text-white/30">—</div>}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
