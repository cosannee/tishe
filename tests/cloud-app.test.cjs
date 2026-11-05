const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');

test('old browser data moves only after the account owner chooses to import it',async()=>{
  const key='tihiy-ritm:v1';
  const previous={version:1,profile:{name:'Саша',theme:2,style:'friend'},directions:[],tasks:[{id:'one',title:'Моё дело'}],habits:[],inspiration:[],messages:[],meals:[],ideas:[],milestones:[]};
  const storage=new Map([[key,JSON.stringify(previous)]]),nodes=new Map();
  const element=selector=>{
    if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',classList:{add(){},remove(){}},addEventListener(){},showModal(){},close(){}});
    return nodes.get(selector);
  };
  let remote=null,saves=0;
  const store={failed:false,pending:Promise.resolve(),async load(){return remote},save(document){remote=structuredClone(document);saves++;return true},async signedPhotoUrl(){return ''}};
  const client={auth:{onAuthStateChange(){},async getUser(){return {data:{user:null},error:null}}}};
  const context={
    crypto:{randomUUID},document:{querySelector:element,addEventListener(){}},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    window:{location:{hostname:'cosannee.github.io'},TISHE_SUPABASE:{url:'https://example.supabase.co',publishableKey:'public'},tisheSupabase:{create:()=>client},createTisheCloudStore:()=>store,addEventListener(){},scrollTo(){}},
    setTimeout:()=>0,clearTimeout(){},console,Intl,Date,JSON,Promise
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('public/app.js','utf8'),context);
  await vm.runInContext("loadCloudAccount({id:'user-1',email:'sasha@example.com'})",context);
  assert.equal(saves,0);
  assert.ok(storage.has(key));
  vm.runInContext('welcomeVisible=false;render()',context);
  assert.match(nodes.get('#app').innerHTML,/Перенести в аккаунт/);
  await vm.runInContext('importLegacy()',context);
  assert.equal(saves,1);
  assert.equal(remote.tasks[0].title,'Моё дело');
  assert.equal(storage.has(key),false);
  vm.runInContext("data.tasks[0].title='Изменено';save()",context);
  assert.equal(remote.tasks[0].title,'Изменено');
  assert.equal(storage.has(key),false);
});
