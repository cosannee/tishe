const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup(){
  const rows=new Map(),files=new Map(),statuses=[];
  const client={
    from(table){
      assert.equal(table,'tishe_state');
      let action='select',record,filters={};
      const query={
        select(){return query},
        eq(key,value){filters[key]=value;return query},
        insert(value){action='insert';record=value;return query},
        update(value){action='update';record=value;return query},
        async maybeSingle(){
          const row=rows.get(filters.user_id);
          if(action==='select')return {data:row||null,error:null};
          if(!row||row.revision!==filters.revision)return {data:null,error:null};
          rows.set(filters.user_id,{...row,...record});
          return {data:{revision:record.revision},error:null};
        },
        async single(){
          if(rows.has(record.user_id))return {data:null,error:{message:'duplicate'}};
          rows.set(record.user_id,record);
          return {data:{revision:record.revision},error:null};
        }
      };
      return query;
    },
    storage:{from(bucket){
      assert.equal(bucket,'tishe-photos');
      return {
        async upload(path,blob){files.set(path,blob);return {error:null}},
        async createSignedUrl(path){return {data:{signedUrl:`https://private.example/${path}`},error:null}},
        async remove(paths){for(const path of paths)files.delete(path);return {error:null}},
        async download(path){return {data:files.get(path),error:null}}
      };
    }}
  };
  const context={window:{},console,Promise,JSON,Date};
  vm.runInNewContext(fs.readFileSync('public/cloud-sync.js','utf8'),context);
  const store=context.window.createTisheCloudStore(client,(status,error)=>statuses.push({status,error}));
  return {rows,files,statuses,store};
}

test('cloud store saves one document per account and checks revisions',async()=>{
  const {rows,store}=setup();
  assert.equal(await store.load({id:'user-a'}),null);
  assert.equal(store.save({tasks:[{title:'Моё дело'}]}),true);
  await store.pending;
  assert.equal(rows.get('user-a').document.tasks[0].title,'Моё дело');
  assert.equal(rows.get('user-a').revision,1);
  assert.equal(store.save({tasks:[{title:'Изменено'}]}),true);
  await store.pending;
  assert.equal(rows.get('user-a').revision,2);
  rows.set('user-a',{...rows.get('user-a'),revision:3});
  store.save({tasks:[]});
  await store.pending;
  assert.equal(store.failed,true);
  assert.equal(rows.get('user-a').document.tasks[0].title,'Изменено');
});

test('cloud photos use the signed-in user folder',async()=>{
  const {store,files}=setup();
  await store.load({id:'user-b'});
  const path=await store.uploadPhoto(new Blob(['test'],{type:'image/jpeg'}),'photo-1');
  assert.equal(path,'user-b/photo-1.jpg');
  assert.equal(files.has(path),true);
  assert.match(await store.signedPhotoUrl(path),/user-b\/photo-1/);
  assert.equal(await store.signedPhotoUrl('user-a/photo-1.jpg'),'');
  await store.removePhoto(path);
  assert.equal(files.has(path),false);
});
