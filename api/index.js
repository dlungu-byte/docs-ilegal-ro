const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// === GCS config ===
const BUCKET_NAME = process.env.BUCKET_NAME || '';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || ''; // ex: https://docs-ilegal-web-....a.run.app
const useGCS = !!BUCKET_NAME;
const storage = useGCS ? new Storage() : null;
const bucket = useGCS ? storage.bucket(BUCKET_NAME) : null;

// === Local demo storage (fallback) ===
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    control: "1",
    user: "demo",
    categories: ["facturi","contracte","hr","ssm"],
    docs: [
      { id:1, name:"Contract de angajare", filename:"contract-angajare.pdf", category:"hr", uploadedAt:new Date(Date.now()-12*86400000).toISOString(), expiresAt:new Date(Date.now()+365*86400000).toISOString(), url: null },
      { id:2, name:"Factura #1234", filename:"factura_1234.pdf", category:"facturi", uploadedAt:new Date(Date.now()-4*86400000).toISOString(), expiresAt:new Date(Date.now()+180*86400000).toISOString(), url: null },
      { id:3, name:"Contract furnizor ACME", filename:"contract-furnizor-ACME.pdf", category:"contracte", uploadedAt:new Date(Date.now()-40*86400000).toISOString(), expiresAt:new Date(Date.now()+200*86400000).toISOString(), url: null },
      { id:4, name:"Instructaj SSM inițial", filename:"ssm-instructaj-initial.docx", category:"ssm", uploadedAt:new Date(Date.now()-2*86400000).toISOString(), expiresAt:new Date(Date.now()+365*86400000).toISOString(), url: null }
    ],
    shares: []
  }, null, 2));
}
function loadDB(){ return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); }
function saveDB(db){ fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function makeAddress(cat, control, user){ return `${cat}.${control}.${user}@docs.ilegal.ro`; }
function randomId(){ return Math.random().toString(36).slice(2,10); }
function isExpired(iso){ return new Date(iso).getTime() < Date.now(); }

// === Multer storage: GCS (memory) sau local (disk) ===
const upload = useGCS
  ? multer({ storage: multer.memoryStorage() })
  : multer({ storage: multer.diskStorage({
      destination: function (_req, _file, cb) { cb(null, UPLOAD_DIR); },
      filename: function (_req, file, cb) { cb(null, Date.now() + '-' + file.originalname); }
    })});

// === Routes ===
app.get('/healthz', (_req, res)=> res.json({ok:true, storage: useGCS ? 'gcs' : 'local'}));

app.get('/me/magic-inbox/addresses', (_req, res)=>{
  const db = loadDB();
  const a = db.categories.map(cat => ({ category: cat, address: makeAddress(cat, db.control, db.user) }));
  res.json(a);
});

app.post('/me/magic-inbox/control', (req, res)=>{
  const { control } = req.body || {};
  if(!control || !/^[a-zA-Z0-9]{1,5}$/.test(control)) return res.status(400).json({error:"control invalid (1-5 alfanumeric)"});
  const db = loadDB();
  db.control = control;
  saveDB(db);
  res.json({ok:true, control});
});

app.get('/documents/list', (_req, res)=>{
  const db = loadDB();
  res.json(db.docs);
});

app.post('/documents/upload', upload.single('file'), async (req, res)=>{
  try{
    const db = loadDB();
    const { category, name, expires_in_days } = req.body || {};
    if(!category || !db.categories.includes(category)) return res.status(400).json({error:"categorie invalidă"});
    if(!req.file) return res.status(400).json({error:"fișier lipsă"});

    const now = new Date();
    const days = Math.max(1, parseInt(expires_in_days||'365',10));
    const originalName = req.file.originalname;
    const safeName = originalName.replace(/[^\w.\-]+/g,'_');
    let publicUrl = null;

    if(useGCS){
      const destName = `${Date.now()}-${safeName}`;
      const file = bucket.file(destName);
      await file.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype },
        resumable: false,
        validation: false,
      });
      publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${encodeURIComponent(destName)}`;
    } else {
      publicUrl = null;
    }

    const doc = {
      id: (db.docs.reduce((m,d)=>Math.max(m,d.id),0) + 1),
      name: name || safeName.replace(/\.[^.]+$/, ''),
      filename: originalName,
      category,
      uploadedAt: now.toISOString(),
      expiresAt: new Date(now.getTime()+days*86400000).toISOString(),
      url: publicUrl
    };
    db.docs.unshift(doc);
    saveDB(db);
    res.json(doc);
  } catch(e){
    console.error('upload error', e);
    res.status(500).json({error:'upload failed', details: String(e && e.message || e)});
  }
});

// === Shares ===
app.post('/shares', (req, res)=>{
  const db = loadDB();
  const { doc_ids, categories, password, expires_in_days } = req.body || {};
  const days = Math.max(1, parseInt(expires_in_days||'30',10));
  const id = randomId();
  const share = {
    id,
    items: { docs: Array.isArray(doc_ids)? doc_ids : [], categories: Array.isArray(categories)? categories : [] },
    url: FRONTEND_ORIGIN
      ? `${FRONTEND_ORIGIN.replace(/\/+$/,'')}/s/${id}`
      : `${req.protocol}://${req.get('host')}/s/${id}`,
    expiresAt: new Date(Date.now()+days*86400000).toISOString(),
    password: password || null
  };
  db.shares.unshift(share);
  saveDB(db);
  res.json(share);
});

// JSON pentru clienți (frontend public): verifică parolă + expirare
app.get('/shares/:id', (req, res)=>{
  const db = loadDB();
  const s = db.shares.find(x=>x.id === req.params.id);
  if(!s) return res.status(404).json({error:"not_found"});
  if(isExpired(s.expiresAt)) return res.status(410).json({error:"expired"});

  const needPass = !!s.password;
  const provided = (req.query.password || '').toString();
  if(needPass && provided !== s.password) return res.status(401).json({error:"password_required"});

  const docIds = new Set(Array.isArray(s.items?.docs)? s.items.docs : []);
  const cats = new Set(Array.isArray(s.items?.categories)? s.items.categories : []);
  const docs = db.docs.filter(d => docIds.has(d.id) || cats.has(d.category));

  res.json({ id: s.id, expiresAt: s.expiresAt, items: s.items, docs });
});

// HTML minim (doar pentru test rapid în lipsa frontend-ului public)
app.get('/s/:id', (req, res)=>{
  res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Share ${req.params.id}</title></head>
<body style="font-family:system-ui,Arial;padding:20px">
<h1>Share ${req.params.id}</h1>
<p>Folosește <code>/shares/${req.params.id}?password=PAROLA</code> pentru JSON sau deschide linkul în frontend: ${FRONTEND_ORIGIN ? FRONTEND_ORIGIN : '(neconfigurat)'}/s/${req.params.id}</p>
</body></html>`);
});

app.use('/uploads', express.static(UPLOAD_DIR)); // fallback demo

app.listen(PORT, ()=>{ console.log(`API listening on :${PORT} — storage=${useGCS?'gcs':'local'}`); });
