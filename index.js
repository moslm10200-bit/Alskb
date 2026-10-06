const express=require('express'),helmet=require('helmet'),rateLimit=require('express-rate-limit'),bcrypt=require('bcryptjs'),
jwt=require('jsonwebtoken'),cookieParser=require('cookie-parser'),crypto=require('crypto');

/* حساب المشرف يُقرأ من Vercel فقط: Settings > Environment Variables
   ADMIN_EMAIL  و  ADMIN_PASSWORD  (8 خانات فأكثر) — لا تكتب أي بيانات هنا */
const ADMINS=['','_2','_3'].map(k=>({e:(process.env['ADMIN_EMAIL'+k]||'').trim().toLowerCase(),p:process.env['ADMIN_PASSWORD'+k]||''})).filter(x=>x.e.length>3&&x.p.length>=8);
const ADMIN_SET=ADMINS.length>0;

/* المنتجات والأسعار (الأسعار تُحسب من هنا فقط حتى لا يتلاعب بها أحد)
   img: صورة المنتج اختيارية — ضع رابط الصورة في src وعدّل x,y (إزاحة بالبكسل) و scale (التكبير) */
const mk=(id,name,icon,color,items)=>({id,name,icon,color,img:{src:'',x:0,y:0,scale:1},
  items:items.map((it,i)=>({id:id+'_'+i,name:it[0],price:it[1],icon,img:{src:'',x:0,y:0,scale:1}}))});
const PRODUCTS=[
 mk('p1','المشروبات','🥤','#ffd9e3',[['عصير برتقال',8],['شاي مثلج',6],['قهوة باردة',12],['ليمون نعناع',9]]),
 mk('p2','الحلويات','🍰','#fff1b8',[['كيك شوكولاتة',15],['كنافة',14],['دونات',7],['بسبوسة',10]]),
 mk('p3','الوجبات','🍔','#d6f5dc',[['برجر',22],['شاورما',18],['بيتزا',30],['دجاج مقلي',25]]),
 mk('p4','الإلكترونيات','🎧','#d9e8ff',[['سماعات',60],['شاحن سريع',25],['كفر جوال',15],['باور بانك',70]]),
 mk('p5','الهدايا','🎁','#eadcff',[['علبة هدية',35],['وردة',12],['شوكولاتة فاخرة',28],['دبدوب',40]])];

/* ---- التخزين: Upstash Redis (يُربط من Vercel Storage) ---- */
const RU=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,RT=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
const rc=async cmd=>{if(!RU||!RT)throw E(500,'قاعدة البيانات غير مربوطة');
  const r=await fetch(RU,{method:'POST',headers:{Authorization:'Bearer '+RT,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
  const d=await r.json();if(d.error)throw new Error(d.error);return d.result};
const E=(s,m)=>Object.assign(new Error(m),{s});
const fresh=()=>({users:[],orders:[],tx:[],secret:crypto.randomBytes(48).toString('hex')});
async function load(){let s=await rc(['GET','db']);if(!s){await rc(['SET','db',JSON.stringify(fresh()),'NX']);s=await rc(['GET','db'])}return JSON.parse(s)}
async function mut(fn){const id=crypto.randomUUID();let ok=false;
  for(let i=0;i<40&&!ok;i++){ok=(await rc(['SET','lock',id,'NX','EX','10']))==='OK';if(!ok)await new Promise(r=>setTimeout(r,150))}
  if(!ok)throw E(503,'الخادم مشغول، حاول مرة أخرى');
  try{const db=await load();const out=await fn(db);await rc(['SET','db',JSON.stringify(db)]);return out}finally{await rc(['DEL','lock'])}}

const app=express();app.set('trust proxy',1);
app.use(helmet());app.use(express.json({limit:'10kb'}));app.use(cookieParser());
app.use('/api',rateLimit({windowMs:60000,max:120}));
const authLimit=rateLimit({windowMs:15*60000,max:10,message:{error:'محاولات كثيرة، انتظر 15 دقيقة'}});
const w=fn=>(req,res,next)=>fn(req,res,next).catch(e=>{if(!e.s)console.error(e);res.status(e.s||500).json({error:e.s?e.message:'خطأ في الخادم'})});

const safeEq=(a,b)=>{const x=crypto.createHash('sha256').update(String(a)).digest(),y=crypto.createHash('sha256').update(String(b)).digest();return crypto.timingSafeEqual(x,y)};
const emailOk=e=>typeof e==='string'&&/^[a-z0-9._+-]{3,64}@gmail\.com$/i.test(e);
const passOk=p=>typeof p==='string'&&p.length<=64&&(p.match(/[A-Za-z]/g)||[]).length>=6&&(p.match(/\d/g)||[]).length>=6&&/[^A-Za-z0-9]/.test(p);
const setCookie=(req,res,db,payload)=>res.cookie('t',jwt.sign(payload,db.secret,{expiresIn:'12h'}),{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:12*3600e3});
const auth=w(async(req,res,next)=>{req.db=await load();try{req.u=jwt.verify(req.cookies.t,req.db.secret)}catch(e){throw E(401,'سجّل الدخول')}next()});
const admin=(req,res,next)=>req.u.admin?next():res.status(403).json({error:'غير مصرح'});
const pub=u=>({id:u.id,username:u.username,email:u.email,balance:u.balance});

app.post('/api/register',authLimit,w(async(req,res)=>{
  const{username,email,password}=req.body||{};
  if(typeof username!=='string'||username.trim().length<2||username.length>30)throw E(400,'اسم المستخدم غير صالح');
  if(!emailOk(email))throw E(400,'استخدم حساب جيميل صحيح');
  if(!passOk(password))throw E(400,'كلمة السر: 6 أحرف + رمز (مثل النقطة .) + 6 أرقام على الأقل');
  const em=email.toLowerCase(),hash=await bcrypt.hash(password,12);
  if(ADMINS.some(x=>x.e===em))throw E(409,'هذا الجيميل مسجل مسبقاً');
  let secretDb;const u=await mut(db=>{secretDb=db;if(db.users.find(x=>x.email===em))throw E(409,'هذا الجيميل مسجل مسبقاً');
    const n={id:crypto.randomUUID(),username:username.trim(),email:em,hash,balance:0,created:Date.now()};db.users.push(n);return n});
  setCookie(req,res,secretDb,{id:u.id});res.json({user:pub(u)})}));

app.post('/api/login',authLimit,w(async(req,res)=>{
  const{email,password}=req.body||{};
  if(typeof email!=='string'||typeof password!=='string')throw E(400,'بيانات ناقصة');
  const db=await load(),em=email.toLowerCase();
  if(ADMINS.some(x=>safeEq(em,x.e)&&safeEq(password,x.p))){setCookie(req,res,db,{admin:true});return res.json({admin:true})}
  const u=db.users.find(x=>x.email===em);
  if(!u||!(await bcrypt.compare(password,u.hash)))throw E(401,'الجيميل أو كلمة السر غير صحيحة');
  setCookie(req,res,db,{id:u.id});res.json({user:pub(u)})}));

app.get('/api/health',w(async(req,res)=>{let ok=false;try{await rc(['PING']);ok=true}catch(e){}res.json({db:ok,admin:ADMIN_SET})}));
app.post('/api/logout',(req,res)=>{res.clearCookie('t');res.json({ok:1})});
app.get('/api/me',auth,w(async(req,res)=>{
  if(req.u.admin)return res.json({admin:true});
  const u=req.db.users.find(x=>x.id===req.u.id);if(!u)throw E(401,'سجّل الدخول');res.json({user:pub(u)})}));
app.get('/api/products',auth,(req,res)=>res.json(PRODUCTS));

app.post('/api/order',auth,w(async(req,res)=>{
  if(req.u.admin)throw E(403,'غير مصرح');
  const qty=parseInt(req.body.qty,10);let item=null;
  PRODUCTS.forEach(p=>p.items.forEach(i=>{if(i.id===req.body.itemId)item=i}));
  if(!item||!(qty>=1&&qty<=20))throw E(400,'طلب غير صالح');
  const balance=await mut(db=>{const u=db.users.find(x=>x.id===req.u.id);if(!u)throw E(403,'غير مصرح');
    const total=item.price*qty;if(u.balance<total)throw E(400,'رصيدك غير كافٍ');u.balance-=total;
    db.orders.push({id:crypto.randomUUID(),userId:u.id,email:u.email,username:u.username,name:item.name,qty,total,status:'pending',date:Date.now()});return u.balance});
  res.json({balance})}));

app.get('/api/history',auth,(req,res)=>{const id=req.u.id;
  res.json({orders:req.db.orders.filter(o=>o.userId===id).reverse(),topups:req.db.tx.filter(t=>t.userId===id).reverse()})});

app.get('/api/admin/users',auth,admin,(req,res)=>res.json(req.db.users.map(u=>({...pub(u),created:u.created}))));
app.get('/api/admin/orders',auth,admin,(req,res)=>res.json([...req.db.orders].reverse()));
app.post('/api/admin/balance',auth,admin,w(async(req,res)=>{
  const a=Number(req.body.amount);if(!isFinite(a)||a===0||Math.abs(a)>1e7)throw E(400,'قيمة غير صالحة');
  const balance=await mut(db=>{const u=db.users.find(x=>x.id===req.body.userId);if(!u)throw E(400,'مشترك غير موجود');
    u.balance+=a;db.tx.push({userId:u.id,amount:a,date:Date.now()});return u.balance});res.json({balance})}));
app.post('/api/admin/order/:id',auth,admin,w(async(req,res)=>{
  await mut(db=>{const o=db.orders.find(x=>x.id===req.params.id);if(!o)throw E(404,'غير موجود');
    if(req.body.action==='done'&&o.status==='pending')o.status='done';
    else if(req.body.action==='cancel'&&o.status!=='cancelled'){o.status='cancelled';const u=db.users.find(x=>x.id===o.userId);if(u)u.balance+=o.total}
    else throw E(400,'إجراء غير صالح')});res.json({ok:1})}));

module.exports=app;
