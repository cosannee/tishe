const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('cloudflare/src/index.js','utf8');
const worker=import('data:text/javascript,'+encodeURIComponent(source)).then(m=>m.default);
const endpoint='https://tishe-ai.example.workers.dev/api/ai';
const origin='https://cosannee.github.io';
const env={OPENAI_API_KEY:'test-only',IP_LIMIT:{limit:async()=>({success:true})},GLOBAL_LIMIT:{limit:async()=>({success:true})}};

test('Cloudflare AI Worker accepts only the GitHub origin',async()=>{
  const w=await worker;
  const denied=await w.fetch(new Request(endpoint,{method:'POST',headers:{origin:'https://other.example'}}),env);
  assert.equal(denied.status,403);
  const preflight=await w.fetch(new Request(endpoint,{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST'}}),env);
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
});

test('Cloudflare AI Worker requires secret and rate limits',async()=>{
  const w=await worker;
  const req=()=>new Request(endpoint,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({mode:'talk',text:'Привет'})});
  assert.equal((await w.fetch(req(),{...env,OPENAI_API_KEY:''})).status,503);
  assert.equal((await w.fetch(req(),{...env,IP_LIMIT:{limit:async()=>({success:false})}})).status,429);
});

test('Cloudflare AI Worker keeps the chosen tone and memory opt in',async()=>{
  const w=await worker;
  const original=global.fetch;
  let sent;
  global.fetch=async(_url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'Давай начнём с малого.'}]}]}),{status:200})};
  try{
    const req=new Request(endpoint,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({mode:'talk',text:'Привет',profile:{style:'cheeky',memory:'Только с разрешения'}})});
    const response=await w.fetch(req,env);
    assert.equal(response.status,200);
    assert.equal((await response.json()).text,'Давай начнём с малого.');
    assert.match(sent.instructions,/дерзко, смело и по-доброму/);
    assert.match(sent.input,/Только с разрешения/);
    assert.equal(sent.store,false);
  }finally{global.fetch=original}
});
