const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('cloudflare/src/index.js','utf8');
const worker=import('data:text/javascript,'+encodeURIComponent(source)).then(m=>m.default);
const endpoint='https://tishe-ai.example.workers.dev/api/ai';
const origin='https://cosannee.github.io';
const env={OPENAI_API_KEY:'test-only',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test-key',USER_LIMIT:{limit:async()=>({success:true})},GLOBAL_LIMIT:{limit:async()=>({success:true})}};
const request=()=>new Request(endpoint,{method:'POST',headers:{origin,authorization:'Bearer test-session','content-type':'application/json'},body:JSON.stringify({mode:'talk',text:'Привет',profile:{style:'cheeky',memory:'Только с разрешения'}})});

test('Cloudflare AI Worker accepts only the GitHub origin',async()=>{
  const w=await worker;
  const denied=await w.fetch(new Request(endpoint,{method:'POST',headers:{origin:'https://other.example'}}),env);
  assert.equal(denied.status,403);
  const preflight=await w.fetch(new Request(endpoint,{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST'}}),env);
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
});

test('Cloudflare AI Worker requires a verified user and rate limits',async()=>{
  const w=await worker;
  assert.equal((await w.fetch(request(),{...env,OPENAI_API_KEY:''})).status,503);
  assert.equal((await w.fetch(new Request(endpoint,{method:'POST',headers:{origin}}),env)).status,401);
  const original=global.fetch;
  global.fetch=async()=>new Response(JSON.stringify({id:'user-a'}),{status:200});
  try{assert.equal((await w.fetch(request(),{...env,USER_LIMIT:{limit:async()=>({success:false})}})).status,429)}
  finally{global.fetch=original}
});

test('Cloudflare AI Worker keeps the chosen tone and memory opt in',async()=>{
  const w=await worker;
  const original=global.fetch;
  let sent;
  global.fetch=async(url,options)=>{
    if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'user-a'}),{status:200});
    sent=JSON.parse(options.body);
    return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'Давай начнём с малого.'}]}]}),{status:200});
  };
  try{
    const response=await w.fetch(request(),env);
    assert.equal(response.status,200);
    assert.equal((await response.json()).text,'Давай начнём с малого.');
    assert.match(sent.instructions,/дерзко, смело и по-доброму/);
    assert.match(sent.input,/Только с разрешения/);
    assert.equal(sent.store,false);
  }finally{global.fetch=original}
});
