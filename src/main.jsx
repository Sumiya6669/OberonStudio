import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { captureCampaign } from '@/lib/analytics/campaign'

// Снимаем метки кампании до отрисовки: адрес ещё тот, с которого зашли.
captureCampaign()

/**
 * Содержимое сайта, вшитое в собранную страницу.
 *
 * Читается ДО отрисовки и передаётся в приложение как начальное состояние.
 * Иначе первый кадр в браузере рисуется на запасных текстах из кода, не
 * совпадает с собранной разметкой, и React перерисовывает страницу —
 * это видно глазом.
 */
function readInitialContent() {
  const node = document.getElementById('site-content')
  if (!node) return null
  try {
    return JSON.parse(node.textContent)
  } catch {
    return null
  }
}

const initialContent = readInitialContent()
const root = document.getElementById('root')

/**
 * Страницы сайта собираются заранее, поэтому в #root уже лежит разметка.
 * Её надо подхватить (hydrateRoot), а не отрисовать заново: повторная
 * отрисовка выбросила бы готовый HTML и заставила человека увидеть, как
 * страница собирается второй раз.
 *
 * Панель /admin заранее не собирается — там обычная отрисовка.
 */
if (root.hasChildNodes()) {
  ReactDOM.hydrateRoot(root, <App initialContent={initialContent} />)
} else {
  ReactDOM.createRoot(root).render(<App initialContent={initialContent} />)
}
