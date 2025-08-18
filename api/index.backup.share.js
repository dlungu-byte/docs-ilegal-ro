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
const BUCKET_NAME = process.env.BUCKET_NAME || ''; // dacă e gol, folosim fallback pe disc (demo)
const storage = BUCKET_NAME ? new Storage() : null;
const bucket = BUCKET_NAME ? (new Storage()).bucket(BUCKET_NAME) : null;

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

// === Multer storage: GCS (memory) sau local (disk) ===
const useGCS = !!BUCKET_NAME;
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
      // upload în GCS din memorie
      const destName = `${Date.now()}-${safeName}`;
      const file = bucket.file(destName);
      await file.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype },
        resumable: false,
        validation: false,
      });
      // obiectele sunt publice la bucket-level (Viewer pe allUsers); asigurăm URL-ul public
      publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${encodeURIComponent(destName)}`;
    } else {
      // fallback demo: păstrează pe disc
      publicUrl = null; // nu servim fișierele locale public în MVP
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

app.post('/shares', (req, res)=>{
  const db = loadDB();
  const { doc_ids, categories, password, expires_in_days } = req.body || {};
  const days = Math.max(1, parseInt(expires_in_days||'30',10));
  const id = randomId();
  const share = {
    id,
    items: { docs: Array.isArray(doc_ids)? doc_ids : [], categories: Array.isArray(categories)? categories : [] },
    url: `${req.protocol}://${req.get('host')}/s/${id}`,
    expiresAt: new Date(Date.now()+days*86400000).toISOString(),
    password: password || null
  };
  db.shares.unshift(share);
  saveDB(db);
  res.json(share);
});

app.delete('/shares/:id', (req, res)=>{
  const db = loadDB();
  const { id } = req.params;
  const before = db.shares.length;
  db.shares = db.shares.filter(s=> s.id !== id);
  saveDB(db);
  if(before === db.shares.length) return res.status(404).json({error:"not found"});
  res.json({ok:true});
});

app.use('/uploads', express.static(UPLOAD_DIR)); // doar pentru fallback demo

app.listen(PORT, ()=>{ console.log(`API listening on :${PORT} — storage=${useGCS?'gcs':'local'}`); });
