# ИИ для GitHub Pages через Cloudflare Worker

Этот Worker принимает запросы с `https://cosannee.github.io`, хранит `OPENAI_API_KEY` как секрет Cloudflare и обращается к OpenAI с сервера. Ключ не попадает в файлы GitHub Pages. Опубликованный адрес: `https://tishe-ai.zaytsevalexandara.workers.dev/api/ai`. Он указан в корневом `ai-config.js`.

## Публикация

Worker опубликован в аккаунте владельца. Для последующих обновлений из папки `cloudflare/` можно выполнить `npx wrangler deploy`; для замены секрета — `npx wrangler secret put OPENAI_API_KEY`. Значение секрета нельзя помещать в Git или `ai-config.js`. В `wrangler.jsonc` находятся только публичный адрес и publishable key Supabase. После изменения адреса Worker обновить `ai-config.js` и опубликовать GitHub Pages.

`wrangler.jsonc` задаёт три запроса в минуту на подтверждённого пользователя и двенадцать запросов в минуту суммарно на каждый узел Cloudflare. Worker запрашивает Supabase Auth по переданному токену и использует подтверждённый ID для лимита. Эти лимиты приблизительные и не заменяют финансовый лимит проекта OpenAI. Заголовок `Origin` и CORS дополняют проверку токена, но сами по себе не удостоверяют личность вызывающего.
