===== نشر موقع السكب على Vercel =====
(1) حساب المشرف: لا يوجد في الكود. ضعه في Vercel بعد النشر:
   Settings > Environment Variables:  ADMIN_EMAIL  و  ADMIN_PASSWORD (8 خانات فأكثر)  ثم Redeploy.
   مشرف ثانٍ/ثالث اختياري: ADMIN_EMAIL_2 و ADMIN_PASSWORD_2 ، ADMIN_EMAIL_3 و ADMIN_PASSWORD_3
   حساب المشرف يبقى معطلاً حتى تضعهما.
(2) ارفع المجلد كله إلى GitHub (مستودع جديد) ثم Vercel > Add New > Project > اختر المستودع > Framework: Other > Deploy.
    بدون GitHub: ثبّت Node ثم نفّذ داخل المجلد:  npx vercel --prod
(3) داخل مشروعك في Vercel: Storage > Create Database (أو Marketplace) > Upstash Redis > الخطة المجانية > اربطه بالمشروع.
(4) Deployments > ... > Redeploy.
(5) افتح الموقع. سجّل الدخول بحساب المشرف لإضافة الرصيد وإدارة الطلبات.

الفحص السريع: افتح  https://موقعك/api/health
   {"db":true,"admin":true}  = كل شيء سليم
   db:false    = لم تربط Upstash أو لم تعمل Redeploy (خطوة 3 و 4)
   admin:false = لم تضع حساب المشرف (خطوة 1)

التعديلات:
 - الشعار (مكانه/حجمه) + رقم الدعم + جملة الفوتر: public/config.js
 - صورتك: ضعها داخل public (مثلاً logo.png) واكتب في config.js:  src:'logo.png'
 - صور المنتجات والأسعار: داخل PRODUCTS في api/index.js (img: src, x, y, scale)
 
