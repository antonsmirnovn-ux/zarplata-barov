# Ежедневное обновление (для Claude)
Обновлять, если штамп в index.html (`"stamp":"YYYY-MM-DDTHH:MM"`) раньше сегодняшних 11:00 по Москве и сейчас ≥ 11:00.
1. Built-in browser на компьютере пользователя: открыть https://app.gainbp.com/13ruleskirov/retail/shifts (вход уже выполнен).
2. Выполнить там через javascript_tool код из tools/scrape.js (обёрнутый в `window.__r = await (...)` ; затем вернуть `window.__r`).
3. Результат (JSON-строку) сохранить в scratchpad как data.json — НЕ в репозиторий.
4. `node tools/build.mjs <путь к data.json>` → пересобирает index.html (шифрует публичными ключами из tools/keys.json, пароли не нужны).
5. `git add index.html && git commit && git push origin main`. GitHub Pages обновится за 1–2 минуты.
