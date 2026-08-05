const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Ayarlar — .env yerine doğrudan burada
const CONFIG = {
  ADMIN_PASSWORD: 'dijital2025',
  EMAIL_USER: 'kubilayhokelek7145@gmail.com',
  EMAIL_PASS: '',          // Gmail App Password buraya yazılacak (kurulum sonrası)
  EMAIL_TO:   'kubilayhokelek7145@gmail.com',
  MESSAGES_FILE: path.join(__dirname, 'messages.json'),
};

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));   // HTML/CSS/JS dosyalarını serve et

// ── YARDIMCI: JSON dosyasına oku/yaz ──────────────────────────────────────
function readMessages() {
  if (!fs.existsSync(CONFIG.MESSAGES_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(CONFIG.MESSAGES_FILE, 'utf8')); }
  catch { return []; }
}
function writeMessages(data) {
  fs.writeFileSync(CONFIG.MESSAGES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── E-POSTA GÖNDER ────────────────────────────────────────────────────────
async function sendEmail(msg) {
  if (!CONFIG.EMAIL_PASS) {
    console.log('⚠️  Gmail App Password ayarlanmadı. E-posta atlandı. (mesaj kaydedildi)');
    return;
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: CONFIG.EMAIL_USER, pass: CONFIG.EMAIL_PASS },
  });
  await transporter.sendMail({
    from: `"DijitalRestoranım İletişim Formu" <${CONFIG.EMAIL_USER}>`,
    to: CONFIG.EMAIL_TO,
    subject: `🍽️ Yeni Mesaj: ${msg.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#ff4500,#ff9800);padding:24px 32px">
          <h2 style="color:#fff;margin:0">🍽️ DijitalRestoranım — Yeni Mesaj</h2>
        </div>
        <div style="padding:28px 32px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:140px">Ad Soyad</td>
                <td style="padding:8px 0;font-weight:600;color:#1a1a2e">${msg.name}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Telefon</td>
                <td style="padding:8px 0;font-weight:600;color:#1a1a2e">${msg.phone}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Restoran</td>
                <td style="padding:8px 0;font-weight:600;color:#1a1a2e">${msg.restaurant || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Mesaj</td>
                <td style="padding:8px 0;color:#1a1a2e">${msg.message || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Tarih</td>
                <td style="padding:8px 0;color:#1a1a2e">${msg.date}</td></tr>
          </table>
          <a href="http://localhost:${PORT}/admin.html" 
             style="display:inline-block;margin-top:20px;background:linear-gradient(135deg,#ff4500,#ff9800);
                    color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:700">
            Admin Paneline Git →
          </a>
        </div>
      </div>
    `,
  });
  console.log(`✅ E-posta gönderildi → ${CONFIG.EMAIL_TO}`);
}

// ══════════════════════════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════════════════════════

// POST /api/contact  —  form gönderimi
app.post('/api/contact', async (req, res) => {
  const { name, phone, restaurant, message } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Ad ve telefon zorunlu.' });

  const msg = {
    id: Date.now().toString(),
    name, phone,
    restaurant: restaurant || '',
    message: message || '',
    date: new Date().toLocaleString('tr-TR'),
    read: false,
  };

  const all = readMessages();
  all.unshift(msg);
  writeMessages(all);

  try { await sendEmail(msg); } catch (e) { console.error('E-posta hatası:', e.message); }

  res.json({ ok: true, message: 'Mesajınız alındı!' });
});

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === CONFIG.ADMIN_PASSWORD) {
    res.json({ ok: true, token: Buffer.from(CONFIG.ADMIN_PASSWORD).toString('base64') });
  } else {
    res.status(401).json({ error: 'Hatalı şifre.' });
  }
});

// ── Auth middleware ──────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token === Buffer.from(CONFIG.ADMIN_PASSWORD).toString('base64')) return next();
  res.status(401).json({ error: 'Yetkisiz erişim.' });
}

// GET /api/messages
app.get('/api/messages', auth, (req, res) => {
  res.json(readMessages());
});

// PATCH /api/messages/:id/read
app.patch('/api/messages/:id/read', auth, (req, res) => {
  const all = readMessages();
  const msg = all.find(m => m.id === req.params.id);
  if (!msg) return res.status(404).json({ error: 'Bulunamadı.' });
  msg.read = true;
  writeMessages(all);
  res.json({ ok: true });
});

// DELETE /api/messages/:id
app.delete('/api/messages/:id', auth, (req, res) => {
  let all = readMessages();
  all = all.filter(m => m.id !== req.params.id);
  writeMessages(all);
  res.json({ ok: true });
});

// ── Sunucuyu başlat ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 DijitalRestoranım sunucusu çalışıyor!`);
  console.log(`   Ana site  → http://localhost:${PORT}`);
  console.log(`   Admin     → http://localhost:${PORT}/admin.html`);
  console.log(`   Şifre     → ${CONFIG.ADMIN_PASSWORD}\n`);
});
