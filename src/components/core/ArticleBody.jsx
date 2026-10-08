/**
 * Текст статьи в упрощённой разметке — без библиотеки.
 *
 * react-markdown в зависимостях есть, но он поехал бы в общий кусок
 * публичного сайта и утяжелил каждую страницу ради одного раздела. Статьям
 * нужно немного: абзацы, подзаголовки, списки, врезка, жирный и ссылки.
 *
 *   ## Подзаголовок         ### Подзаголовок поменьше
 *   - пункт списка           1. пункт нумерованного списка
 *   > врезка                 **жирный**, [текст](/адрес) или [текст](https://…)
 *
 * Блоки разделяются пустой строкой. HTML в тексте не исполняется: всё,
 * что не разметка, выводится как текст.
 */
import React from 'react';
import { Link } from 'react-router-dom';

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;

function Inline({ text }) {
  const parts = String(text).split(INLINE).filter((p) => p !== '');
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white/85">{part.slice(2, -2)}</strong>;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      const cls = 'text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:text-white';
      // Статьи живут без языковой приставки, поэтому внутренние ссылки — как есть.
      if (href.startsWith('/')) return <Link key={i} to={href} className={cls}>{label}</Link>;
      return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={cls}>{label}</a>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/** Разбирает текст на блоки: заголовки, списки, врезки и абзацы. */
export function parseBlocks(source) {
  const blocks = [];
  for (const chunk of String(source || '').trim().split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const first = lines[0];
    if (first.startsWith('### ')) blocks.push({ type: 'h3', text: first.slice(4) });
    else if (first.startsWith('## ')) blocks.push({ type: 'h2', text: first.slice(3) });
    else if (lines.every((l) => l.startsWith('- '))) blocks.push({ type: 'ul', items: lines.map((l) => l.slice(2)) });
    else if (lines.every((l) => /^\d+\.\s/.test(l))) blocks.push({ type: 'ol', items: lines.map((l) => l.replace(/^\d+\.\s+/, '')) });
    else if (lines.every((l) => l.startsWith('>'))) blocks.push({ type: 'note', text: lines.map((l) => l.replace(/^>\s?/, '')).join(' ') });
    else blocks.push({ type: 'p', text: lines.join(' ') });
  }
  return blocks;
}

/** Подзаголовки второго уровня — для оглавления. */
export function headings(source) {
  return parseBlocks(source).filter((b) => b.type === 'h2').map((b) => b.text);
}

export const anchorId = (index) => `razdel-${index + 1}`;

export default function ArticleBody({ source }) {
  let h2 = -1;
  return (
    <div className="space-y-5 text-[15px] leading-[1.75] text-white/60 sm:text-base">
      {parseBlocks(source).map((block, i) => {
        switch (block.type) {
          case 'h2':
            h2 += 1;
            return (
              <h2 key={i} id={anchorId(h2)}
                  className="scroll-mt-28 pt-6 text-[clamp(1.3rem,2.4vw,1.7rem)] font-bold leading-tight tracking-[-0.02em] text-white">
                <Inline text={block.text} />
              </h2>
            );
          case 'h3':
            return <h3 key={i} className="pt-2 text-lg font-semibold text-white/85"><Inline text={block.text} /></h3>;
          case 'ul':
            return (
              <ul key={i} className="space-y-2.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[1px] shrink-0 select-none text-primary/60">—</span>
                    <span><Inline text={item} /></span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="space-y-2.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[1px] w-5 shrink-0 select-none text-right font-mono text-sm text-primary/70">{j + 1}.</span>
                    <span><Inline text={item} /></span>
                  </li>
                ))}
              </ol>
            );
          case 'note':
            return (
              <p key={i} className="rounded-xl border border-primary/20 bg-primary/[0.05] px-5 py-4 text-sm leading-relaxed text-white/65">
                <Inline text={block.text} />
              </p>
            );
          default:
            return <p key={i}><Inline text={block.text} /></p>;
        }
      })}
    </div>
  );
}
