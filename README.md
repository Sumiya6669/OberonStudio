# Oberon Studio

Многостраничный сайт студии на React + Vite. Базы данных нет: весь контент
хранится в коде, заявки с форм уходят в Telegram.

## Запуск локально

```bash
npm install
npm run dev
```

Форма заявок локально работать не будет — `/api/lead` поднимается только на
Vercel. Чтобы проверить её на машине, поставьте `npm i -g vercel` и запустите
`vercel dev`.

Проверки перед деплоем: `npm run lint` и `npm run build`.

## Где править контент

| Что | Файл |
|---|---|
| Контакты (Telegram, WhatsApp, email) | `src/lib/content/site.js` → `SITE_SETTINGS` |
| Каталог готовых решений | `src/lib/content/site.js` → `PRODUCTS` |
| Проекты в портфолио | `src/lib/content/portfolio.js` + тексты в `src/lib/i18n/*.js` → `works.projects` |
| Отзывы | `src/lib/content/portfolio.js` + тексты в `src/lib/i18n/*.js` → `reviews.items` |
| Услуги, FAQ, процесс, тексты интерфейса | `src/lib/i18n/ru.js`, `kz.js`, `en.js` |
| Список страниц и меню | `src/lib/routes.js` |

Правки попадают на сайт обычным коммитом — Vercel пересобирает проект сам.

Цены нигде не хранятся. Если понадобится их показать, в `PRODUCTS` есть поля
`price` и `subscription`: значение `null` выводится как «по запросу», число
(в тенге) — как сумма.

## Страницы

`/` · `/services` · `/projects` · `/products` · `/process` · `/stack` ·
`/reviews` · `/faq` · `/contact`

Маршрутизация клиентская, поэтому прямые ссылки требуют, чтобы сервер отдавал
`index.html` на любой путь — за это отвечает `vercel.json`.

## Форма заявок

`api/lead.js` — serverless-функция Vercel. Принимает POST с формы, проверяет
имя и контакт, обрезает длинные поля и отправляет сообщение в Telegram.

Переменные окружения (Vercel → Settings → Environment Variables):

- `TELEGRAM_BOT_TOKEN` — токен бота от [@BotFather](https://t.me/BotFather)
- `TELEGRAM_CHAT_ID` — id чата, куда слать заявки

Префикс `VITE_` этим переменным не нужен и вреден: всё с этим префиксом
попадает в клиентский бандл и становится видно любому посетителю.

## Деплой

Vercel собирает проект автоматически при push в `main`. Интеграции из
маркетплейса подключать не нужно — хватает двух переменных выше.
"# OberonStudio" 
