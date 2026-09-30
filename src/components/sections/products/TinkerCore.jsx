import React from 'react';
import Reveal from '../../core/Reveal';

/**
 * Одинаковое у всех продуктов.
 *
 * Здесь был блок «Tinker Core»: платформа, одиннадцать модулей и три
 * цифры — «3x быстрее», «60% дешевле», «99.9% uptime». Ни платформы с
 * такими модулями, ни замеров, из которых взялись бы эти проценты, не
 * существует. Вместо них то, что у всех продуктов действительно общее
 * и что клиент проверит в первую же установку.
 */
const OBSHCHEE = [
  {
    icon: '🧩',
    title: 'Расширение, а не правка конфигурации',
    text: 'Ставится как обычное расширение. Типовую конфигурацию не меняет и с поддержки не снимает — обновления 1С продолжают устанавливаться как обычно.',
  },
  {
    icon: '🏠',
    title: 'Работает внутри вашей 1С',
    text: 'Отдельной программы и переноса данных в облако нет: проверки идут прямо в базе, результат — в рабочем месте в разделе «Tinker».',
  },
  {
    icon: '📨',
    title: 'Утренний дайджест в Telegram',
    text: 'Главное за день коротким сообщением: что горит, сколько денег под риском, что сделать.',
  },
  {
    icon: '🔒',
    title: 'Данные только читаются',
    text: 'Документы создаются по кнопке бухгалтера и черновиком, без проведения. В ИС ЭСФ, КГД и банк ничего не уходит без человека.',
  },
  {
    icon: '🔑',
    title: 'Секреты под замком',
    text: 'Токены и ключи хранятся в безопасном хранилище 1С, а не в настройках, куда заглядывает любой пользователь.',
  },
  {
    icon: '♻️',
    title: 'Автообновление с откатом',
    text: 'Новые версии приходят сами, с проверкой целостности и откатом при ошибке. Нормы 2026 года учтены: новый Налоговый кодекс РК и НДС 16 % с 01.01.2026.',
  },
];

/**
 * Конфигурации разделены на две строки намеренно.
 *
 * Продукты написаны и проверены на «Бухгалтерии для Казахстана» и
 * «Комплексной автоматизации»: там они ставятся и работают сегодня.
 * Дописать в ту же строку УТ, УНФ, ERP и остальные — значит пообещать,
 * что расширение встанет и туда, а это выяснится в первый час внедрения
 * и выяснится не в нашу пользу. Поэтому вторая строка называет их
 * отдельно и честно: адаптация под заказ, срок и цена считаются под
 * конкретную базу.
 */
const TEHNICHESKOE = [
  ['Работает сейчас', 'Бухгалтерия для Казахстана 3.0 · Комплексная автоматизация для Казахстана 2.4'],
  ['Адаптируем под заказ', 'Управление торговлей для Казахстана · Управление нашей фирмой (УНФ) · Розница для Казахстана · ERP Управление предприятием · Зарплата и управление персоналом · Управление производственным предприятием (УПП) · самописные конфигурации на управляемых формах'],
  ['Платформа', '1С:Предприятие 8.3.27 и новее'],
  ['Установка', 'Файл расширения .cfe, снять галку «Безопасный режим»'],
];

export default function TinkerCore() {
  return (
    <div className="mb-20">
      <Reveal>
        <div className="rounded-3xl border border-line bg-surface overflow-hidden relative">
          <div className="relative px-8 py-10 border-b border-line">
            <div className="absolute inset-0 grid-bg opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                  <span className="text-sm">⚙️</span>
                </div>
                <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">
                  Одинаково у всех
                </span>
              </div>
              <h3 className="text-2xl font-black text-white mb-3 tracking-tight">
                Что общего у всех расширений 1С
              </h3>
              <p className="text-sm text-white/40 leading-relaxed max-w-2xl">
                Это не платформа, которую надо внедрять отдельно. Каждый продукт — самостоятельное
                расширение, и всё перечисленное ниже одинаково верно для любого из них.
              </p>
            </div>
          </div>

          <div className="p-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {OBSHCHEE.map((item) => (
                <div key={item.title} className="rounded-2xl border border-line bg-surface-2 p-5">
                  <div className="text-lg mb-3">{item.icon}</div>
                  <p className="text-sm font-bold text-white/85 mb-2 leading-snug">{item.title}</p>
                  <p className="text-xs text-white/40 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-line bg-surface-2 divide-y divide-line">
              {TEHNICHESKOE.map(([label, value]) => (
                <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 px-5 py-3.5">
                  <p className="text-[10px] tracking-[0.2em] text-white/25 uppercase sm:w-36 flex-shrink-0">{label}</p>
                  <p className="text-xs text-white/55 leading-relaxed">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
