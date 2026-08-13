# Plan · Восстановление домиграционных страниц в pages/legacy/ + переключатель дизайна

## Контекст

Миграция на дизайн-систему Grimdark началась с коммита `54f4d48` («Веб-фундамент
дизайн-системы Grimdark заложен») и продолжилась патчами P0–P4 до текущего HEAD `eac39fa`.

**Источник восстановления — коммит `0cd3688` («v4 в верстку»)**: последний коммит
до начала правок (родитель `54f4d48`). Проверка: `git log --oneline` в корне репо
(репозиторий общий, `.git` в корне, пути через `clubtabletracker.client/`).

## Что восстанавливаем из `0cd3688`

### Страницы → `src/pages/legacy/`

| Текущая страница | Файл для восстановления |
|---|---|
| HomePage | `clubtabletracker.client/src/pages/HomePage.tsx` |
| AdminPage | `clubtabletracker.client/src/pages/AdminPage.tsx` |
| ClubAdminPage | `clubtabletracker.client/src/pages/ClubAdminPage.tsx` |
| SettingsPage | `clubtabletracker.client/src/pages/SettingsPage.tsx` |
| ClubPage | `clubtabletracker.client/src/pages/ClubPage.tsx` |
| MessengerPage | `clubtabletracker.client/src/pages/MessengerPage.tsx` |
| LoginPage | `clubtabletracker.client/src/pages/LoginPage.tsx` |

`OAuthCallbackPage` **не восстанавливаем** — он не содержит UI-кита, только
`oauthConfig`-логику; используем текущую версию для обоих режимов.

### Общие компоненты → `src/components/legacy/`

Импортируются страницами выше (по текущему графу зависимостей):

- `BookingForm.tsx`, `TableTimeline.tsx`, `BookingCalendar.tsx`, `ClubMap.tsx`,
  `CampaignMapView.tsx`, `ClubMapEditor.tsx`, `CampaignMapEditor.tsx`
- Плюс транзитивные зависимости легаси-версий (`Schedule.tsx`, `TableCard.tsx` и
  др.) — уточнить по импортам восстановленных файлов.

### CSS → `src/styles/legacy.css`

`src/App.css` + `src/index.css` из `0cd3688`, объединённые и **изолированные**
от `styles/grimdark.css` (см. ниже).

### НЕ восстанавливаем (используем текущие версии)

`constants.ts`, `utils/auth.ts`, `utils/useIsMobile.ts`, `utils/shareBooking.ts`,
`utils/attachmentName.ts`, `oauthConfig.ts`, `version.ts` — логика без привязки
к дизайну; дублирование привело бы к рассинхронизации auth/API-кода.
У восстановленных файлов правятся только пути импортов.

## Изоляция CSS

Проблема: старый CSS содержит глобальные селекторы (`body`, `.btn`, `.card`,
`.input`…), конфликтующие с токенами Grimdark.

Решение: префиксация всех селекторов `legacy.css` под скоуп `.design-legacy`
через `postcss-prefixwrap` (dev-зависимость, настройка в `vite.config.ts`).
Корневой элемент приложения (и `document.body` через эффект) получает класс
`design-legacy` либо `gd-app` в зависимости от режима.

## Переключатель дизайна

- **Плавающая кнопка на всех страницах** (компонент `DesignToggle.tsx`),
  рендерится в `App.tsx` над `<Routes>`.
- Хук `useDesignMode`: localStorage-ключ `ctt-design` (`'grimdark'` по умолчанию,
  `'legacy'`), смена режима меняет класс на `document.body` и перерисовывает роуты.
- `App.tsx`: одни и те же URL, элемент роута выбирается по режиму:
  `element={design === 'legacy' ? <LegacyHomePage /> : <HomePage />}`.
  Переключение происходит на месте, без смены URL.

## Порядок реализации (code mode)

1. Извлечь файлы из git: `git show 0cd3688:clubtabletracker.client/src/pages/<X>.tsx`
   (и компоненты, и CSS) → разложить по `pages/legacy/`, `components/legacy/`, `styles/legacy.css`.
2. Импортировать и префиксировать `legacy.css` через postcss-prefixwrap.
3. Починить импорты в легаси-файлах: `../../components/legacy/...`, общие utils/constants — без изменений логики.
4. Добавить `useDesignMode` + `DesignToggle.tsx` (плавающая кнопка, стиль — нейтральный, видимый в обоих режимах).
5. Переписать `App.tsx`: выбор элементов роутов по режиму, рендер `DesignToggle`, класс на корне/body.
6. Проверка: `tsc` type-check, eslint, запуск dev-сервера, прогон переключателя на всех 7 роутах + OAuth-колбэки.

## Риски

- Транзитивные импорты легаси-компонентов могут тянуть ещё файлы — выявляются на шаге 3 по ошибкам tsc.
- Глобальные стили `body`/`:root` в старом CSS: prefixwrap не покрывает `:root` —
  токены из `:root` перенести в `.design-legacy` вручную.
- Кнопки Google/Yandex OAuth могли мигрировать не только стилистически —
  при расхождении API сравнить с текущими версиями и Ports: логику брать текущую.
