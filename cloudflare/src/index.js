const allowedOrigin = 'https://cosannee.github.io';
const baseHeaders = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'access-control-allow-origin': allowedOrigin,
  'vary': 'Origin'
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...baseHeaders, 'content-type': 'application/json; charset=utf-8' } });
}

function string(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function content(response) {
  return (response.output || []).flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text').map(item => item.text || '').join('\n').trim();
}

function instructions(mode, style) {
  const styles = {
    gentle: 'бережно и спокойно; поддерживай без давления',
    friend: 'по-дружески и живо, как в тёплом разговоре; используй простые слова, короткие естественные реплики и иногда уместный юмор',
    playful: 'игриво и с лёгким остроумием; добавляй энергию и улыбку без клоунады',
    cheeky: 'дерзко, смело и по-доброму; можно поддразнить ситуацию, но никогда не высмеивай пользователя и его чувства',
    direct: 'прямо и ясно; минимум лишних слов, один конкретный следующий шаг'
  };
  const base = `Ты — «тише.», русскоязычный ИИ-помощник. Отвечай на «ты» и звучащим по-человечески языком: без канцелярита, шаблонных сочувственных вступлений, повторения слов пользователя, эмодзи и нравоучений. Выбранный тон: ${styles[style] || styles.gentle}. Подстраивай длину под сообщение. Не утверждай, что ты человек, и не делай вид, что помнишь то, чего нет в переданном контексте. Не ставь диагнозов.`;
  if (mode === 'food') return base + ' Обсуди питание бережно при любом выбранном тоне. По одному дню нельзя судить о здоровье или норме питания. Укажи, что порции и приготовление могут быть неизвестны. Если оценка калорий уместна, дай только очень широкий приблизительный диапазон и явно назови его ориентиром. Без запретов, стыда, поддразнивания тела и категоричных рекомендаций.';
  if (mode === 'motivate') return base + ' Помоги найти один маленький шаг без давления. Уважай усталость и право отдохнуть. Используй личную цель и причину занятия только если они переданы.';
  return base + ' Ты рефлексивный собеседник: поддержи мысль, помоги увидеть её яснее и задай не больше одного мягкого вопроса. Не создавай зависимость от разговора.';
}

async function handleAI(request, env) {
  if (!env.OPENAI_API_KEY) return json({ error: 'AI is not configured' }, 503);
  if (!env.IP_LIMIT || !env.GLOBAL_LIMIT) return json({ error: 'Rate limits are not configured' }, 503);
  if (Number(request.headers.get('content-length') || 0) > 20000) return json({ error: 'Request too large' }, 413);
  let raw;
  try { raw = await request.text(); } catch { return json({ error: 'Invalid request' }, 400); }
  if (raw.length > 20000) return json({ error: 'Request too large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body || !['talk', 'motivate', 'food'].includes(body.mode)) return json({ error: 'Unknown mode' }, 400);
  const prompt = string(body.text, 4000);
  if (!prompt) return json({ error: 'Empty message' }, 400);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const [perIp, global] = await Promise.all([
    env.IP_LIMIT.limit({ key: ip }),
    env.GLOBAL_LIMIT.limit({ key: 'tishe-ai' })
  ]);
  if (!perIp.success || !global.success) return json({ error: 'Please wait a moment' }, 429);
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
  const answer = content(await upstream.json());
  return answer ? json({ text: answer }) : json({ error: 'Empty AI response' }, 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/ai') return json({ error: 'Not found' }, 404);
    if (request.headers.get('origin') !== allowedOrigin) return json({ error: 'Origin rejected' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...baseHeaders, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' } });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    return handleAI(request, env);
  }
};
