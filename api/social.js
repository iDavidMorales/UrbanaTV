import { neon } from '@neondatabase/serverless';
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
const mail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const video = /^[\w-]{11}$/;
const secret=process.env.AUTH_SECRET;
const sql=process.env.DATABASE_URL?neon(process.env.DATABASE_URL):null;
const json=(res,status,data)=>res.status(status).json(data);
function parseCookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2))}
function sign(id){const payload=Buffer.from(JSON.stringify({id:String(id),exp:Date.now()+14*86400000})).toString('base64url');return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url')}
function check(raw){try{if(!raw)return null;const [payload,mac]=raw.split('.');if(!payload||!mac)return null;const expected=createHmac('sha256',secret).update(payload).digest();const received=Buffer.from(mac,'base64url');if(expected.length!==received.length||!timingSafeEqual(expected,received))return null;const data=JSON.parse(Buffer.from(payload,'base64url').toString());return data.exp>Date.now()&&/^\d+$/.test(data.id)?data.id:null}catch{return null}}
const cookie=(token)=>'urbanatv_session='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600';
const hash=(pass)=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(pass,salt,64).toString('hex')};
function verify(pass,stored){try{const [salt,raw]=stored.split(':');const a=Buffer.from(raw,'hex'),b=scryptSync(pass,salt,64);return a.length===b.length&&timingSafeEqual(a,b)}catch{return false}}
async function user(req){const id=check(parseCookies(req).urbanatv_session);if(!id)return null;const rows=await sql`SELECT id,name,email FROM urbana_tv.users WHERE id=${id} LIMIT 1`;return rows[0]||null}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!sql||!secret||secret.length<32)return json(res,503,{error:'El servicio todavía no está configurado. Faltan DATABASE_URL o AUTH_SECRET.'});
 const action=String(req.query.action||'');
 try{
 if(req.method==='GET'&&action==='me')return json(res,200,{user:await user(req)});
 if(req.method==='GET'&&action==='notifications'){
 const u=await user(req);if(!u)return json(res,401,{error:'Inicia sesión para ver notificaciones'});
 const rows=await sql`SELECT c.id,c.video_id,c.body,c.created_at,a.name FROM urbana_tv.comments c JOIN urbana_tv.users a ON a.id=c.user_id WHERE c.user_id<> ${u.id} ORDER BY c.created_at DESC LIMIT 40`;
 return json(res,200,{notifications:rows});
 }
 if(req.method==='GET'&&action==='comments'){
 const id=String(req.query.video||'');if(!video.test(id))return json(res,400,{error:'Video no válido'});
 const rows=await sql`SELECT c.id,c.body,c.created_at,u.name FROM urbana_tv.comments c JOIN urbana_tv.users u ON u.id=c.user_id WHERE c.video_id=${id} ORDER BY c.created_at DESC LIMIT 100`;
 return json(res,200,{comments:rows});
 }
 if(req.method!=='POST')return json(res,405,{error:'Método no permitido'});
 const origin=req.headers.origin,host=req.headers.host;
 if(origin&&new URL(origin).host!==host)return json(res,403,{error:'Origen no permitido'});
 const data=typeof req.body==='object'&&req.body?req.body:{};
 if(action==='register'){
 const name=String(data.name||'').trim(),email=String(data.email||'').trim().toLowerCase(),pass=String(data.password||'');
 if(name.length<2||name.length>80||!mail.test(email)||email.length>254||pass.length<10||pass.length>128)return json(res,400,{error:'Revisa nombre, correo y contraseña (mínimo 10 caracteres).'});
 const exists=await sql`SELECT id FROM urbana_tv.users WHERE email=${email} LIMIT 1`;if(exists.length)return json(res,409,{error:'El correo ya tiene una cuenta.'});
 const rows=await sql`INSERT INTO urbana_tv.users(name,email,password_hash) VALUES(${name},${email},${hash(pass)}) RETURNING id,name,email`;
 res.setHeader('Set-Cookie',cookie(sign(rows[0].id)));return json(res,201,{user:rows[0]});
 }
 if(action==='login'){
 const email=String(data.email||'').trim().toLowerCase(),pass=String(data.password||'');
 if(!mail.test(email)||pass.length>128)return json(res,401,{error:'Credenciales inválidas'});
 const rows=await sql`SELECT id,name,email,password_hash FROM urbana_tv.users WHERE email=${email} LIMIT 1`;
 if(!rows.length||!verify(pass,rows[0].password_hash))return json(res,401,{error:'Correo o contraseña incorrectos'});
 const {password_hash,...safe}=rows[0];res.setHeader('Set-Cookie',cookie(sign(safe.id)));return json(res,200,{user:safe});
 }
 if(action==='logout'){res.setHeader('Set-Cookie','urbanatv_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');return json(res,200,{ok:true})}
 if(action==='comment'){
 const u=await user(req);if(!u)return json(res,401,{error:'Inicia sesión para comentar'});
 const id=String(data.video||''),body=String(data.body||'').trim();
 if(!video.test(id)||body.length<2||body.length>1500)return json(res,400,{error:'Comentario inválido (2 a 1500 caracteres).'});
 const recent=await sql`SELECT id FROM urbana_tv.comments WHERE user_id=${u.id} AND created_at>now()-interval '20 seconds' LIMIT 1`;
 if(recent.length)return json(res,429,{error:'Espera unos segundos antes de publicar otro comentario.'});
 await sql`INSERT INTO urbana_tv.comments(video_id,user_id,body) VALUES(${id},${u.id},${body})`;return json(res,201,{ok:true});
 }
 return json(res,404,{error:'Ruta no encontrada'});
 }catch(e){console.error('UrbanaTV API error',e);return json(res,500,{error:'No pudimos completar la operación. Intenta nuevamente.'})}
}
