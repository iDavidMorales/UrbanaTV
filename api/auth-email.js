import {neon} from '@neondatabase/serverless';
import {randomInt,randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {sendRouticketEmail} from './routicket-mail.js';
const mail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const reply=(res,status,data)=>res.status(status).json(data);
const hash=(email,code)=>createHmac('sha256',process.env.AUTH_SECRET).update(email+':'+code).digest('hex');
const session=id=>{const payload=Buffer.from(JSON.stringify({id:String(id),exp:Date.now()+14*86400000})).toString('base64url');return payload+'.'+createHmac('sha256',process.env.AUTH_SECRET).update(payload).digest('base64url')};
async function ensure(sql){
 await sql`CREATE TABLE IF NOT EXISTS urbana_tv.email_codes (id BIGSERIAL PRIMARY KEY,email VARCHAR(254) NOT NULL,name VARCHAR(80),code_hash TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,used_at TIMESTAMPTZ,attempts INTEGER NOT NULL DEFAULT 0,requested_ip TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return reply(res,405,{error:'Método no permitido'});
 if(!process.env.DATABASE_URL||!process.env.AUTH_SECRET)return reply(res,503,{error:'Acceso no configurado'});
 const origin=req.headers.origin;if(origin){try{if(new URL(origin).host!==req.headers.host)return reply(res,403,{error:'Origen no permitido'})}catch{return reply(res,403,{error:'Origen inválido'})}}
 const sql=neon(process.env.DATABASE_URL),data=req.body||{},action=String(req.query.action||'');
 const email=String(data.email||'').trim().toLowerCase(),name=String(data.name||'').trim();
 if(!mail.test(email)||email.length>254||name.length>80)return reply(res,400,{error:'Revisa tu correo y nombre'});
 const ip=String(req.headers['x-forwarded-for']||'').split(',')[0].trim().slice(0,50);
 try{
 await ensure(sql);
 if(action==='request'){
 const recent=await sql`SELECT count(*)::int AS n,max(created_at) AS last FROM urbana_tv.email_codes WHERE email=${email} AND created_at>now()-interval '15 minutes'`;
 if(recent[0].n>=3||recent[0].last&&Date.now()-new Date(recent[0].last).getTime()<60000)return reply(res,429,{error:'Espera antes de solicitar otro código'});
 const byIp=await sql`SELECT count(*)::int AS n FROM urbana_tv.email_codes WHERE requested_ip=${ip} AND created_at>now()-interval '1 hour'`;
 if(byIp[0].n>=15)return reply(res,429,{error:'Demasiadas solicitudes. Intenta más tarde'});
 const code=String(randomInt(100000,1000000)),digest=hash(email,code);
 const rows=await sql`INSERT INTO urbana_tv.email_codes(email,name,code_hash,expires_at,requested_ip) VALUES(${email},${name||null},${digest},now()+interval '10 minutes',${ip}) RETURNING id`;
 try{await sendRouticketEmail(email,'Tu código de acceso a UrbanaTV','Tu código de UrbanaTV es: '+code+'. Vence en 10 minutos. Si no lo solicitaste, ignora este correo.')}catch(err){console.error('Routicket mail failure',err.message);await sql`DELETE FROM urbana_tv.email_codes WHERE id=${rows[0].id}`;return reply(res,502,{error:'No fue posible enviar el correo desde Routicket'})}
 return reply(res,200,{ok:true,message:'Revisa tu correo para obtener el código'});
 }
 if(action==='verify'){
 const code=String(data.code||'').trim();if(!/^\d{6}$/.test(code))return reply(res,400,{error:'Introduce los seis dígitos'});
 const rows=await sql`SELECT id,code_hash,attempts,expires_at FROM urbana_tv.email_codes WHERE email=${email} AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`;
 if(!rows.length)return reply(res,400,{error:'Solicita un nuevo código'});
 const row=rows[0];if(row.attempts>=5||new Date(row.expires_at).getTime()<Date.now())return reply(res,400,{error:'El código venció o alcanzó el límite de intentos'});
 const expected=Buffer.from(row.code_hash,'hex'),received=Buffer.from(hash(email,code),'hex');
 if(expected.length!==received.length||!timingSafeEqual(expected,received)){
 await sql`UPDATE urbana_tv.email_codes SET attempts=attempts+1 WHERE id=${row.id} AND used_at IS NULL`;
 return reply(res,401,{error:'Código incorrecto'});
 }
 const used=await sql`UPDATE urbana_tv.email_codes SET used_at=now() WHERE id=${row.id} AND used_at IS NULL AND attempts<5 AND expires_at>now() RETURNING id`;
 if(!used.length)return reply(res,401,{error:'El código ya fue utilizado'});
 let user=(await sql`SELECT id,name,email FROM urbana_tv.users WHERE email=${email} LIMIT 1`)[0];
 if(!user){
 const display=name.length>=2?name:email.split('@')[0].slice(0,80);
 const password=randomBytes(32).toString('hex'),salt=randomBytes(16).toString('hex');
 const {scryptSync}=await import('node:crypto');const stored=salt+':'+scryptSync(password,salt,64).toString('hex');
 const created=await sql`INSERT INTO urbana_tv.users(name,email,password_hash) VALUES(${display},${email},${stored}) ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING id,name,email`;
 user=created[0];
 }
 res.setHeader('Set-Cookie','urbanatv_session='+session(user.id)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600');
 return reply(res,200,{ok:true,user});
 }
 return reply(res,404,{error:'Operación no encontrada'});
 }catch(e){console.error('email auth',e);return reply(res,500,{error:'El servicio de acceso no pudo completar la operación'})}
}
