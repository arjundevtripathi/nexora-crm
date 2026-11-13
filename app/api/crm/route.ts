import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { mutationSchema, schemas } from '../../../lib/validation';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function handle(req:Request){
 const requestId=crypto.randomUUID();
 try{
 const user=await getChatGPTUser(); if(!user)return json({error:'Sign in to access your CRM.'},401);
 if(!env.DB)return json({error:'Database unavailable',requestId},503);
 const db=env.DB; const owner=user.userId;
 if(req.method==='GET'){
 const [r,a]=await Promise.all([db.prepare('SELECT * FROM records WHERE owner = ? ORDER BY updated_at DESC LIMIT 5001').bind(owner).all(),db.prepare('SELECT * FROM audit WHERE owner = ? ORDER BY created_at DESC LIMIT 50').bind(owner).all()]);
 return json({records:r.results.slice(0,5000).map((v:any)=>({...v,data:JSON.parse(v.data)})),activity:a.results,truncated:r.results.length>5000,user:{name:user.displayName,email:user.email,role:(user as any).role||(user.userId==='admin_user'?'admin':'member')}});
 }
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid request origin'},403);
 if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'JSON required'},415);
 const body=await req.text();if(body.length>16000)return json({error:'Request too large'},413);
 let raw;try{raw=JSON.parse(body)}catch{return json({error:'Invalid JSON'},400)}
 const p=mutationSchema.safeParse(raw);if(!p.success)return json({error:'Invalid request',details:p.error.flatten()},400);
 const {kind,id,version,data}=p.data;
 if(req.method!=='POST'&&(!id||!version))return json({error:'Record ID and version required'},400);
 const parsed=req.method==='DELETE'?null:schemas[kind].safeParse(data);
 if(parsed&&!parsed.success)return json({error:'Check your fields',details:parsed.error.flatten()},400);
 const now=new Date().toISOString(),rid=id??crypto.randomUUID(),aid=crypto.randomUUID();
 const label=parsed?.success?parsed.data.name:'Record';
 let statements;
 if(req.method==='POST'){
 if(id||version)return json({error:'New records must not supply an ID'},400);
 statements=[db.prepare('INSERT INTO records(id,owner,kind,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(rid,owner,kind,JSON.stringify(parsed&&parsed.success?parsed.data:{}),now,now),db.prepare('INSERT INTO audit(id,owner,record_id,action,label,created_at) VALUES(?,?,?,?,?,?)').bind(aid,owner,rid,'created',label,now)];
 }else{
 const existing=await db.prepare('SELECT data FROM records WHERE id=? AND owner=? AND kind=? AND version=?').bind(rid,owner,kind,version).first<{data:string}>();
 if(!existing)return json({error:'Record changed or no longer exists. Refresh and try again.'},409);
 const mutation=req.method==='DELETE'?db.prepare('DELETE FROM records WHERE id=? AND owner=? AND kind=? AND version=?').bind(rid,owner,kind,version):db.prepare('UPDATE records SET data=?,updated_at=?,version=version+1 WHERE id=? AND owner=? AND kind=? AND version=?').bind(JSON.stringify(parsed&&parsed.success?parsed.data:{}),now,rid,owner,kind,version);
 statements=[mutation,db.prepare('INSERT INTO audit(id,owner,record_id,action,label,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(aid,owner,rid,req.method==='DELETE'?'deleted':'updated',JSON.parse(existing.data).name,now)];
 }
 const result=await db.batch(statements);if(!result[0].meta.changes)return json({error:'Record changed. Refresh and try again.'},409);
 return json({id:rid},req.method==='POST'?201:200);
 }catch(error){console.error(JSON.stringify({requestId,error:error instanceof Error?error.message:'Unknown error'}));return json({error:'Unable to complete request',requestId},500)}
}
export const GET=handle;export const POST=handle;export const PATCH=handle;export const DELETE=handle;
