const assets = __ASSETS__;
const rate = new Map();
const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
}

function string(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function content(response) {
  return (response.output || []).flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text').map(item => item.text || '').join('\n').trim();
}

function instructions(mode, style) {
  const base = `Ты — «тише.», бережный русскоязычный помощник. Отвечай на «ты», коротко, естественно, без эмодзи и нравоучений. Стиль поддержки: ${style}. Не делай вид, что помнишь то, чего нет в переданном контексте. Не ставь диагнозов.`;
  if (mode === 'food') return base + ' Обсуди питание бережно. По одному дню нельзя судить о здоровье или норме питания. Укажи, что порции и приготовление могут быть неизвестны. Если оценка калорий уместна, дай только очень широкий приблизительный диапазон и явно назови его ориентиром. Без запретов, стыда и категоричных рекомендаций.';
  if (mode === 'motivate') return base + ' Помоги найти один маленький шаг без давления. Уважай усталость и право отдохнуть. Используй личную цель и причину занятия только если они переданы.';
  return base + ' Ты рефлексивный собеседник: поддержи мысль, помоги увидеть её яснее и задай не больше одного мягкого вопроса. Не создавай зависимость от разговора.';
}

async function ai(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const user = request.headers.get('oai-authenticated-user-id');
  if (!user) return json({ error: 'Sign in required' }, 401);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origin rejected' }, 403);
  if (!env.OPENAI_API_KEY) return json({ error: 'AI is not configured' }, 503);
  if (Number(request.headers.get('content-length') || 0) > 20000) return json({ error: 'Request too large' }, 413);
  const now = Date.now(), recent = (rate.get(user) || []).filter(time => now - time < 60000);
  if (recent.length >= 15) return json({ error: 'Please wait a moment' }, 429);
  recent.push(now); rate.set(user, recent);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!['talk', 'motivate', 'food'].includes(body.mode)) return json({ error: 'Unknown mode' }, 400);
  const prompt = string(body.text, 4000);
  if (!prompt) return json({ error: 'Empty message' }, 400);
  const profile = body.profile && typeof body.profile === 'object' ? body.profile : {};
  const history = Array.isArray(body.history) ? body.history.slice(-8).map(m => `${m.role === 'assistant' ? 'Помощник' : 'Пользователь'}: ${string(m.text, 1000)}`).join('\n') : '';
  const context = [
    string(profile.name, 50) && `Имя: ${string(profile.name, 50)}`,
    string(profile.goal, 2000) && `Личная цель: ${string(profile.goal, 2000)}`,
    string(profile.memory, 2000) && `Заметки, которые пользователь разрешил использовать: ${string(profile.memory, 2000)}`,
    string(body.reason, 1000) && `Зачем это пользователю: ${string(body.reason, 1000)}`,
    history && `Последние реплики:\n${history}`,
    `Текущее сообщение:\n${prompt}`
  ].filter(Boolean).join('\n\n');
  let upstream;
  try {
    upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-6-luna', instructions: instructions(body.mode, string(profile.style, 30)), input: context, max_output_tokens: 500, store: false })
    });
  } catch { return json({ error: 'AI service unavailable' }, 502); }
  if (!upstream.ok) return json({ error: 'AI service unavailable' }, 502);
  const text = content(await upstream.json());
  return text ? json({ text }) : json({ error: 'Empty AI response' }, 502);
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/ai') return ai(request, env);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    const asset = assets[path === '/' ? '/index.html' : path];
    if (!asset) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : asset.body, {
      headers: { 'content-type': asset.type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
    });
  }
};
