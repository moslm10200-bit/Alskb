require('dotenv').config();
const express = require('express'), helmet = require('helmet'), rateLimit = require('express-rate-limit'),
  bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), cookieParser = require('cookie-parser'),
  fs = require('fs'), path = require('path'), crypto = require('crypto');

/* ===== الإعدادات من ملف .env ===== */
const { PORT = 3000, JWT_SECRET, ADMIN_KEY, NODE_ENV } = process.env;
const DEFAULT_BALANCE = Number(process.env.DEFAULT_BALANCE || 0);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'db.json');
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('خطأ: ضع JWT_SECRET في ملف .env (32 حرفاً على الأقل)');
  process.exit(1);
}

/* ===== قاعدة البيانات (ملف JSON) — كتابة آمنة عبر ملف مؤقت ===== */
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ users: [] }));
const readDb = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const writeDb = db => { fs.writeFileSync(DB_PATH + '.tmp', JSON.stringify(db, null, 2)); fs.renameSync(DB_PATH + '.tmp', DB_PATH); };
const money = n => Math.round(n * 100) / 100;
const validAmount = a => typeof a === 'number' && Number.isFinite(a) && Math.abs(a) <= 1e7 && a !== 0;

/* ===== التطبيق ===== */
const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, max: 100 }));
const authLimit = rateLimit({ windowMs: 15 * 60_000, max: 10, message: { error: 'محاولات كثيرة، حاول لاحقاً' } });

const auth = (req, res, next) => {
  try { req.user = jwt.verify(req.cookies.token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'سجّل الدخول أولاً' }); }
};

/* تسجيل حساب جديد */
app.post('/api/register', authLimit, async (req, res) => {