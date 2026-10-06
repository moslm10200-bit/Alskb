const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(u,b){const r=await fetch(u,{method:b?'POST':'GET',headers:b?{'Content-Type':'application/json'}:{},body:b?JSON.stringify(b):undefined,credentials:'same-origin'});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'حدث خطأ');return d}
let tt;const toast=m=>{const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,3000)};
const fmt=d=>new Date(d).toLocaleString('ar-SA');
const tf=i=>`transform:translate(${i.x||0}px,${i.y||0}px) scale(${i.scale||1})`;
const pic=(o)=>o.img&&o.img.src?`<img src="${esc(o.img.src)}" alt="" style="${tf(o.img)}">`:`<span class="emoji" style="${tf(o.img||{})}">${o.icon}</span>`;
function confirmBox(msg){return new Promise(r=>{const m=$('#modal');m.hidden=false;
 m.innerHTML=`<div class="mbox"><p>${esc(msg)}</p><div class="btns"><button class="btn" id="y">نعم أنا متأكد</button><button class="btn gray" id="n">إلغاء</button></div></div>`;
 $('#y').onclick=()=>{m.hidden=true;r(true)};$('#n').onclick=()=>{m.hidden=true;r(false)}})}
const defLogo=`<svg width="${CONFIG.logo.size}" height="${CONFIG.logo.size}" viewBox="0 0 48 48"><rect width="48" height="48" rx="14" fill="#ff7a59"/><path d="M14 18h20l-3 16H17z" fill="#fff"/><path d="M19 18a5 5 0 0 1 10 0" stroke="#fff" stroke-width="3" fill="none"/></svg>`;
function paintLogo(){const L=CONFIG.logo,st=`transform:translate(${L.x}px,${L.y}px) scale(${L.scale})`;
 const h=L.src?`<img src="${esc(L.src)}" alt="شعار" width="${L.size}" height="${L.size}" style="${st};object-fit:contain">`:defLogo.replace('<svg','<svg style="'+st+'"');
 $('#hLogo').innerHTML=h;$('#authLogo').innerHTML=h}
/* ---- theme ---- */
const setTheme=t=>{document.documentElement.dataset.theme=t;localStorage.setItem('theme',t)};
setTheme(localStorage.getItem('theme')||'light');
$('#theme').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
/* ---- drawer ---- */
const drawer=o=>{$('#drawer').hidden=!o;$('#drawerBg').hidden=!o};
$('#gear').onclick=()=>drawer(true);$('#drawerBg').onclick=()=>drawer(false);
$('#logout').onclick=async()=>{drawer(false);if(await confirmBox('هل تريد تسجيل الخروج من حسابك؟')){await api('/api/logout',{});location.reload()}};
/* ---- auth ---- */
let reg=false;
$('#aSwitch').onclick=e=>{e.preventDefault();reg=!reg;$('#aUser').hidden=!reg;$('#aHint').hidden=!reg;
 $('#authTitle').textContent=reg?'إنشاء حساب':'تسجيل دخول';$('#aGo').textContent=reg?'إنشاء الحساب':'دخول';
 $('#aSwitch').textContent=reg?'لديك حساب؟ سجّل دخولك':'ليس لديك حساب؟ أنشئ حساباً'};
const passOk=p=>(p.match(/[A-Za-z]/g)||[]).length>=6&&(p.match(/\d/g)||[]).length>=6&&/[^A-Za-z0-9]/.test(p);
$('#aGo').onclick=async()=>{try{
 const email=$('#aMail').value.trim(),password=$('#aPass').value;
 if(reg&&!passOk(password))return toast('كلمة السر ضعيفة: 6 أحرف + رمز (.) + 6 أرقام على الأقل');
 await api(reg?'/api/register':'/api/login',reg?{username:$('#aUser').value,email,password}:{email,password});
 $('#aPass').value='';start()}catch(e){toast(e.message)}};
/* ---- app ---- */
let me,products=[],isAdmin=false;
async function start(){try{const d=await api('/api/me');isAdmin=!!d.admin;me=d.user;
 $('#auth').hidden=true;$('#app').hidden=false;$('#siteName').textContent=CONFIG.siteName;$('#foot').textContent=CONFIG.footer;$('#support').textContent=CONFIG.supportNumber;
 paintLogo();$('#histBtn').hidden=isAdmin;
 if(isAdmin){$('#bal').textContent='المشرف';adminView('users')}else{products=await api('/api/products');setBal();home()}}
 catch(e){$('#app').hidden=true;$('#auth').hidden=false;paintLogo();
  api('/api/health').then(h=>{if(!h.db)toast('قاعدة البيانات غير مربوطة — راجع ملف README')}).catch(()=>toast('تعذر الاتصال بالخادم'))}}
const setBal=()=>$('#bal').textContent='الرصيد: '+me.balance;
const setBack=f=>{const b=$('#back');b.hidden=!f;b.onclick=f||null};
function home(){setBack(null);
 $('#view').innerHTML=products.map(p=>`<div class="card big" data-id="${esc(p.id)}" style="background:${esc(p.color)}22"><div class="imgbox">${pic(p)}</div><div class="name">${esc(p.name)}</div></div>`).join('');
 document.querySelectorAll('.big').forEach(c=>c.onclick=()=>sub(c.dataset.id))}
function sub(id){const p=products.find(x=>x.id===id);setBack(home);
 $('#view').innerHTML=`<h3>${esc(p.name)}</h3><div class="row">${p.items.map(i=>`<div class="card small"><div class="imgbox">${pic(i)}</div><div class="name">${esc(i.name)}</div><div class="price">${i.price} ر.س</div><button class="buy" data-id="${esc(i.id)}">شراء</button></div>`).join('')}</div>`;
 document.querySelectorAll('.buy').forEach(b=>b.onclick=()=>buyModal(p.items.find(i=>i.id===b.dataset.id)))}
function buyModal(it){let q=1;const m=$('#modal');m.hidden=false;
 const draw=()=>{m.innerHTML=`<div class="mbox"><div class="imgbox">${pic(it)}</div><h3>${esc(it.name)}</h3><div class="mut">سعر الواحد: ${it.price}</div>
 <div class="qty"><button id="pl">+</button><span>${q}</span><button id="mn">−</button></div><h3>الإجمالي: ${it.price*q} ر.س</h3>
 <div class="btns"><button class="btn" id="ok">تأكيد الشراء</button><button class="btn gray" id="no">إغلاق</button></div></div>`;
 $('#pl').onclick=()=>{if(q<20){q++;draw()}};$('#mn').onclick=()=>{if(q>1){q--;draw()}};$('#no').onclick=()=>m.hidden=true;
 $('#ok').onclick=async()=>{try{const d=await api('/api/order',{itemId:it.id,qty:q});me.balance=d.balance;setBal();m.hidden=true;toast('تم إرسال طلبك — قيد التنفيذ')}catch(e){toast(e.message)}}};
 draw();m.onclick=e=>{if(e.target===m)m.hidden=true}}
const stTxt={pending:'قيد التنفيذ',done:'تم الشراء',cancelled:'ملغي'};
$('#histBtn').onclick=async()=>{setBack(home);const h=await api('/api/history');
 $('#view').innerHTML=`<h3>سجل مشترياتي</h3><div class="card">${h.orders.map(o=>`<div class="li"><div><b>${esc(o.name)}</b> × ${o.qty}<div class="mut">${fmt(o.date)} · ${o.total} ر.س</div></div><span class="st ${o.status}">${stTxt[o.status]}</span></div>`).join('')||'<div class="li mut">لا توجد مشتريات بعد</div>'}</div>
 <h3>عمليات إضافة الرصيد</h3><div class="card">${h.topups.map(t=>`<div class="li"><span>${t.amount>0?'+':''}${t.amount} ر.س</span><span class="mut">${fmt(t.date)}</span></div>`).join('')||'<div class="li mut">لا توجد عمليات</div>'}</div>`};
/* ---- admin ---- */
async function adminView(tab){setBack(null);
 const tabs=`<div class="tabs"><button class="btn ${tab==='users'?'':'gray'}" id="t1">المشتركون</button><button class="btn ${tab==='orders'?'':'gray'}" id="t2">الطلبات</button></div>`;
 if(tab==='users'){const us=await api('/api/admin/users');
  $('#view').innerHTML=tabs+`<div class="card">${us.map(u=>`<div class="li"><div><b>${esc(u.username)}</b><div class="mut">${esc(u.email)}</div><div>الرصيد: <b>${u.balance}</b></div></div><div class="mini"><input type="number" placeholder="المبلغ" id="a${esc(u.id)}"><button data-id="${esc(u.id)}">إضافة</button></div></div>`).join('')||'<div class="li mut">لا يوجد مشتركون</div>'}</div>`;
  document.querySelectorAll('.mini button').forEach(b=>b.onclick=async()=>{try{await api('/api/admin/balance',{userId:b.dataset.id,amount:$('#a'+b.dataset.id).value});toast('تمت الإضافة');adminView('users')}catch(e){toast(e.message)}})}
 else{const os=await api('/api/admin/orders');
  $('#view').innerHTML=tabs+`<div class="card">${os.map(o=>`<div class="li"><div><b>${esc(o.name)}</b> × ${o.qty} · ${o.total}<div class="mut">${esc(o.username)} · ${esc(o.email)}<br>${fmt(o.date)}</div><span class="st ${o.status}">${stTxt[o.status]}</span></div>
  <div class="mini">${o.status==='pending'?`<button data-a="done" data-id="${esc(o.id)}">✔ تم</button>`:''}${o.status!=='cancelled'?`<button style="background:#e5484d" data-a="cancel" data-id="${esc(o.id)}">✖ إلغاء</button>`:''}</div></div>`).join('')||'<div class="li mut">لا توجد طلبات</div>'}</div>`;
  document.querySelectorAll('.mini button').forEach(b=>b.onclick=async()=>{if(b.dataset.a==='cancel'&&!await confirmBox('إلغاء الطلب وإرجاع المبلغ للعميل؟'))return;
   try{await api('/api/admin/order/'+b.dataset.id,{action:b.dataset.a});adminView('orders')}catch(e){toast(e.message)}})}
 $('#t1').onclick=()=>adminView('users');$('#t2').onclick=()=>adminView('orders')}
start();
