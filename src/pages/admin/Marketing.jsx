/**
 * Маркетинг — всё, что не касается рекламных кабинетов (Meta и Яндекс Директ
 * подключатся отдельно): откуда приходят заявки, ссылки с метками для
 * каналов, где реклама не настраивается кабинетом, очередь тем Контентщика
 * просмотры статей /stati и свой учёт посещений сайта (без Метрики и cookie).
 *
 * Вкладка живёт в адресе (?tab=links), чтобы ссылку на нужную вкладку можно
 * было переслать, а «Назад» в браузере возвращал туда, где вы были.
 *
 * Права проверяет база (RLS), а не экран: тот же клиент и те же правила, что
 * у «Заявок» и «Источников заявок».
 */
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs } from '@/components/admin/ui';
import LeadOrigins from './marketing/LeadOrigins';
import LinkBuilder from './marketing/LinkBuilder';
import ContentTopics from './marketing/ContentTopics';
import ArticleViews from './marketing/ArticleViews';
import SiteVisits from './marketing/SiteVisits';

const TABS = [
  { value: 'origins', label: 'Откуда заявки' },
  { value: 'visits', label: 'Посещения' },
  { value: 'links', label: 'Ссылки с метками' },
  { value: 'topics', label: 'Темы статей' },
  { value: 'views', label: 'Просмотры статей' },
];

export default function Marketing() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'origins';
  const setTab = (value) => setParams(value === 'origins' ? {} : { tab: value });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Маркетинг</h1>
        <span className="text-xs text-muted-foreground">
          Рекламные кабинеты Meta и Яндекс Директа подключим отдельно
        </span>
      </div>

      <Tabs items={TABS} value={tab} onChange={setTab} />

      {tab === 'origins' && <LeadOrigins />}
      {tab === 'visits' && <SiteVisits />}
      {tab === 'links' && <LinkBuilder />}
      {tab === 'topics' && <ContentTopics />}
      {tab === 'views' && <ArticleViews />}
    </div>
  );
}
