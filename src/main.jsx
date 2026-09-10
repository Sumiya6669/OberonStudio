import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { captureCampaign } from '@/lib/analytics/campaign'

// Снимаем метки кампании до отрисовки: адрес ещё тот, с которого зашли.
captureCampaign()

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
  ReactDOM.hydrateRoot(root, <App />)
} else {
  ReactDOM.createRoot(root).render(<App />)
}
