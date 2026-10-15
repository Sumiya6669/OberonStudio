import React from 'react';
import { Monitor, Sun, Moon } from 'lucide-react';
import { useLang } from '@/lib/i18n/LangContext';
import { useThemeChoice } from '@/lib/theme';

const OPTIONS = [
  { value: 'system', icon: Monitor, key: 'themeSystem' },
  { value: 'light', icon: Sun, key: 'themeLight' },
  { value: 'dark', icon: Moon, key: 'themeDark' },
];

/**
 * Переключатель темы: три кнопки рядом — «Системная», «Светлая», «Тёмная».
 *
 * Сегментами, а не выпадающим меню: один нажим вместо двух и на телефоне,
 * и с клавиатуры (каждая кнопка в порядке Tab, состояние — aria-pressed).
 * В выдвижном меню телефона (`withLabels`) рядом с иконкой подпись.
 *
 * До монтирования нажата «Системная» — так же, как в собранной странице;
 * сохранённый выбор подставляется после гидратации (src/lib/theme.js).
 */
export default function ThemeSwitcher({ withLabels = false, className = '' }) {
  const { t } = useLang();
  const [choice, setChoice] = useThemeChoice();

  return (
    <div
      role="group"
      aria-label={t.nav.theme}
      className={`inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface-2 p-0.5 ${
        withLabels ? 'w-full' : ''
      } ${className}`}
    >
      {OPTIONS.map(({ value, icon: Icon, key }) => {
        const on = choice === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setChoice(value)}
            aria-pressed={on}
            aria-label={withLabels ? undefined : t.nav[key]}
            title={t.nav[key]}
            className={`flex items-center justify-center gap-1.5 rounded-[10px] transition-colors duration-200
              outline-none focus-visible:ring-2 focus-visible:ring-primary/60
              ${withLabels ? 'flex-1 px-2 py-2.5 text-xs font-semibold' : 'w-8 h-8'}
              ${on ? 'bg-primary/15 text-primary' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.05]'}`}
          >
            <Icon aria-hidden="true" className="w-3.5 h-3.5 flex-shrink-0" />
            {withLabels && <span className="truncate">{t.nav[key]}</span>}
          </button>
        );
      })}
    </div>
  );
}
