import {build} from 'esbuild';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new DatabaseSync(':memory:');
db.exec(readFileSync('drizzle/0000_dapper_joshua_kane.sql','utf8'));
class Statement{constructor(sql,args=[]){this.sql=sql;this.args=args}bind(...args){return new Statement(this.sql,args)}async all(){return {results:db.prepare(this.sql).all(...this.args)}}async first(){return db.prepare(this.sql).get(...this.args)??null}}
globalThis.__testEnv={DB:{prepare(sql){return new Statement(sql)},async batch(statements){db.exec('BEGIN');try{const results=statements.map(s=>({meta:{changes:Number(db.prepare(s.sql).run(...s.args).changes)}}));db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}}}};
globalThis.__testUser={userId:'alice',email:'alice@example.com',displayName:'Alice'};
mkdirSync('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['app/api/crm/route.ts'],outfile:'.sites-runtime/tests/route.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test-bindings',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='env'?'export const env=globalThis.__testEnv':'export async function getChatGPTUser(){return globalThis.__testUser}'}))}}]});
const api=await import('../.sites-runtime/tests/route.mjs');
const origin='https://crm.example';
async function call(method='GET',payload,requestOrigin=origin){const r=await api[method](new Request(origin+'/api/crm',{method,headers:{'Content-Type':'application/json','Origin':requestOrigin},...(payload?{body:JSON.stringify(payload)}:{})}));return [r.status,await r.json()]}
const alice=globalThis.__testUser;
globalThis.__testUser=null;assert.equal((await call())[0],401);globalThis.__testUser=alice;
assert.equal((await call('POST',{},'https://evil.example'))[0],403);
assert.equal((await call('POST',{kind:'contacts',data:{name:'bad'}}))[0],400);
for(const [kind,data]of [['contacts',{name:'Test',email:'test@example.com',company:'Test'}],['deals',{name:'Deal',company:'Test',value:100,stage:'Lead',closeDate:'2026-11-13'}],['tasks',{name:'Call',dueDate:'2026-11-13',priority:'High'}]]){
 const [status,created]=await call('POST',{kind,data});assert.equal(status,201);
 const row=(await call())[1].records.find(r=>r.id===created.id);assert.ok(row);
 const payload={kind,id:row.id,version:row.version,data:{...row.data,name:'Updated'}};
 globalThis.__testUser={...alice,userId:'bob'};assert.equal((await call())[1].records.length,0);assert.equal((await call('PATCH',payload))[0],409);assert.equal((await call('DELETE',{kind,id:row.id,version:1}))[0],409);
 globalThis.__testUser=alice;assert.equal((await call('PATCH',payload))[0],200);assert.equal((await call('PATCH',payload))[0],409);
 assert.equal((await call('DELETE',{kind,id:row.id,version:2}))[0],200);
}
const final=(await call())[1];assert.equal(final.records.length,0);assert.equal(final.activity.length,9);
for(const action of ['created','updated','deleted'])assert.equal(final.activity.filter(x=>x.action===action).length,3);
console.log('PASS: real API handlers with SQLite — CRUD across all 3 entities, authentication, origin protection, validation, ownership isolation, stale writes, and atomic audit events.');
