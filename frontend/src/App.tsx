import React, { useEffect, useMemo, useState } from "react";
import { Sidebar } from "./Sidebar";

type Doc = {
  id: number;
  name: string;
  filename: string;
  category: string;
  uploadedAt: string;
  expiresAt: string;
  url?: string | null;
};

const THEME_CSS = `
:root{
  --bg:#0b1020;
  --card:#11182d;
  --muted:#8aa1c7;
  --text:#e7eefc;
  --accent:#2d6cdf;
  --accent-2:#1e4aa8;
  --danger:#ef4444;
  --ok:#16a34a;
  --border:#1d2a4a;
  --chip:#0f1a33;
}
*{box-sizing:border-box}
body,html,#root{height:100%}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.4 system-ui,Segoe UI,Roboto,Helvetica,Arial}
a{color:var(--accent);text-decoration:none}
.app main{max-width:1100px;margin:16px auto;padding:16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px}
.btn{display:inline-flex;gap:8px;align-items:center;border:1px solid var(--border);background:#0e152b;border-radius:10px;padding:8px 12px;cursor:pointer}
.btn:hover{background:#0b1327}
.btn-primary{background:var(--accent);border-color:var(--accent-2);color:white}
.btn-primary:hover{background:var(--accent-2)}
.input,select{background:#0e152b;border:1px solid var(--border);border-radius:10px;color:var(--text);padding:8px 10px}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.h1{font-size:20px;margin:0}
.badge{padding:4px 8px;border-radius:999px;border:1px solid var(--border);background:var(--chip)}
.muted{color:var(--muted)}
.table{width:100%;border-collapse:collapse}
.table th,.table td{border-bottom:1px solid var(--border);padding:8px;text-align:left}
`;

function fmtDate(iso: string){
  try{
    const d = new Date(iso);
    return d.toLocaleString();
  }catch{ return iso }
}

function useApiUrl(){
  const preset = (import.meta as any)?.env?.VITE_API_URL || "";
  const [apiUrl, setApiUrl] = useState<string>(() => (localStorage.getItem("apiUrl") || preset || ""));
  useEffect(()=>{
    if(apiUrl) localStorage.setItem("apiUrl", apiUrl);
  },[apiUrl]);
  return { apiUrl, setApiUrl, preset };
}

async function safeFetch(url: string | URL, init?: RequestInit): Promise<Response|null>{
  try{ return await fetch(url.toString(), init); }catch{ return null }
}

function StatusChip({ ok, text }: { ok: boolean; text: string }){
  return <span className="badge" style={{borderColor: ok ? "#1b5e20" : "#5e1b1b", background: ok ? "#0f2914" : "#290f0f"}}>
    {text}
  </span>;
}

/** ===== Consolă (Dashboard + Magic Inbox + Documente) ===== */
export function PreviewApp(){
  const { apiUrl, setApiUrl } = useApiUrl();
  const [active, setActive] = useState("dashboard");
  const go = (id: string) => { setActive(id); const el = document.getElementById(id); if (el) el.scrollIntoView({behavior:"smooth", block:"start"}); };
  const [checking, setChecking] = useState(false);
  const [online, setOnline] = useState<boolean>(false);
  const [addresses, setAddresses] = useState<Array<{category:string;address:string}>>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [upCat, setUpCat] = useState<string>("facturi");
  const [upFile, setUpFile] = useState<File| null>(null);
  const [upName, setUpName] = useState<string>("");

  async function refresh(){
    if(!apiUrl) return;
    setChecking(true);
    const resA = await safeFetch(`${apiUrl.replace(/\/+$/,'')}/me/magic-inbox/addresses`);
    const resD = await safeFetch(`${apiUrl.replace(/\/+$/,'')}/documents/list`);
    setOnline(!!(resA?.ok && resD?.ok));
    setAddresses(resA?.ok ? await resA!.json() : []);
    setDocs(resD?.ok ? await resD!.json() : []);
    setChecking(false);
  }

  useEffect(()=>{ if(apiUrl){ void refresh(); } },[apiUrl]);

  async function doUpload(){
    if(!apiUrl || !upFile) return;
    setUploading(true);
    try{
      const fd = new FormData();
      fd.append("category", upCat);
      fd.append("file", upFile);
      if(upName) fd.append("name", upName);
      const r = await safeFetch(`${apiUrl.replace(/\/+$/,'')}/documents/upload`, { method:"POST", body: fd });
      if(!r || !r.ok){
        alert("Upload eșuat");
      } else {
        await refresh();
        setUpFile(null); setUpName("");
      }
    } finally { setUploading(false); }
  }

  return (
    <div className="app">
      <style dangerouslySetInnerHTML={{__html: THEME_CSS}} />
<main>
  <div style={{display:"grid", gridTemplateColumns:"260px 1fr", gap:16}}>
    <Sidebar active={active} onNavigate={go} />
    <div>
      {/* Dashboard */}
      <section id="dashboard" className="card" style={{marginBottom:12}}>
        <div className="row">
          <label className="muted">API URL</label>
          <input className="input" style={{minWidth:360}} placeholder="https://docs-ilegal-api-...a.run.app" value={apiUrl} onChange={e=>setApiUrl(e.target.value)} />
          <button className="btn btn-primary" onClick={refresh} disabled={!apiUrl || checking}>{checking? "..." : "Check connection"}</button>
          <StatusChip ok={online} text={online? `Online ✅` : `Offline / Eroare ⚠️`} />
        </div>
      </section>

      {/* Magic Inbox */}
      <section id="magic" className="card" style={{marginBottom:12}}>
        <h3 style={{marginTop:0}}>Magic Inbox</h3>
        {addresses.length===0 ? <div className="muted">Nicio adresă încă (setează și verifică API-ul).</div> :
          <ul style={{margin:0,paddingLeft:18}}>
            {addresses.map((a,i)=> <li key={i}><strong>{a.category}</strong>: <span className="muted">{a.address}</span></li>)}
          </ul>
        }
      </section>

      {/* Upload */}
      <section id="upload" className="card" style={{marginBottom:12}}>
        <h3 style={{marginTop:0}}>Upload</h3>
        <div className="row">
          <label className="muted">Categorie</label>
          <select value={upCat} onChange={e=>setUpCat(e.target.value)}>
            <option value="facturi">facturi</option>
            <option value="contracte">contracte</option>
            <option value="hr">hr</option>
            <option value="ssm">ssm</option>
          </select>
          <input className="input" placeholder="Nume (opțional)" value={upName} onChange={e=>setUpName(e.target.value)} />
          <input className="input" type="file" onChange={e=>setUpFile(e.target.files?.[0] || null)} />
          <button className="btn btn-primary" onClick={doUpload} disabled={!apiUrl || !upFile || uploading}>{uploading? "..." : "Încarcă"}</button>
        </div>
      </section>

      {/* Documente */}
      <section id="docs" className="card" style={{marginBottom:12}}>
        <h3 style={{marginTop:0}}>Documente</h3>
        {docs.length===0 ? <div className="muted">Niciun document.</div> :
          <table className="table">
            <thead>
              <tr><th>Nume</th><th>Fișier</th><th>Categorie</th><th>Încărcat</th><th>Expiră</th><th>Acțiuni</th></tr>
            </thead>
            <tbody>
              {docs.map(d=>{
                const canOpen = !!d.url;
                return (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td className="muted">{d.filename}</td>
                    <td>{d.category}</td>
                    <td className="muted">{fmtDate(d.uploadedAt)}</td>
                    <td className="muted">{fmtDate(d.expiresAt)}</td>
                    <td>{canOpen ? <a className="btn" href={d.url!} target="_blank" rel="noreferrer">Descarcă</a> : <span className="muted">fără link public</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        }
      </section>

      {/* Placeholder secțiuni (vor primi funcționalitate ulterior) */}
      <section id="categories" className="card" style={{marginBottom:12}}>
        <h3 style={{marginTop:0}}>Categorii</h3>
        <div className="muted">În curând: navigare pe categorie, back, multi-select & share.</div>
      </section>

      <section id="search" className="card" style={{marginBottom:12}}>
        <h3 style={{marginTop:0}}>Căutare AI</h3>
        <div className="muted">În curând: căutare semantică în documentele încărcate.</div>
      </section>

      <section id="share" className="card" style={{marginBottom:12}}>
        <h3 style={{marginTop:0}}>Partajare</h3>
        <div className="muted">În curând: UI pentru crearea și gestionarea linkurilor de partajare.</div>
      </section>

      <section id="settings" className="card" style={{marginBottom:12}}>
        <h3 style={{marginTop:0}}>Setări</h3>
        <div className="muted">Aici vom muta configurările persistente (ex: API URL salvat, control Magic Inbox, etc.).</div>
      </section>
    </div>
  </div>
</main>

    </div>
  );
}
function getShareIdFromPath(): string | null {
  const m = window.location.pathname.match(/^\/s\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}
function getQueryParam(name: string): string | null {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function PublicShareView(){
  const [apiUrl, setApiUrl] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const id = getShareIdFromPath();

  useEffect(()=>{
    const fromQuery = getQueryParam("api") || "";
    const fromLS = localStorage.getItem("apiUrl") || "";
    const initial = fromQuery || fromLS;
    setApiUrl(initial);
    if(initial && id){ void fetchShare(initial, id, ""); }
  },[]);

  async function fetchShare(api: string, shareId: string, pass: string){
    setLoading(true); setError("");
    try{
      const url = new URL(`${api.replace(/\/+$/,'')}/shares/${shareId}`);
      if(pass) url.searchParams.set("password", pass);
      const res = await safeFetch(url.toString());
      if(!res) throw new Error("Conexiune eșuată");
      if(res.status === 401){ setError("Acest link necesită parolă."); setDocs([]); return; }
      if(res.status === 410){ setError("Link expirat."); setDocs([]); return; }
      if(!res.ok){ const t = await res.text(); throw new Error(`Eroare API (${res.status}): ${t}`); }
      const data = await res.json();
      setDocs(Array.isArray(data?.docs)? data.docs : []);
      localStorage.setItem("apiUrl", api);
    }catch(e:any){ setError(e?.message || "Eroare necunoscută"); setDocs([]); }
    finally{ setLoading(false); }
  }

  if(!id){
    return (
      <div className="app">
        <style dangerouslySetInnerHTML={{__html: THEME_CSS}} />
        <main style={{maxWidth:820, margin:"40px auto", padding:16}}>
          <div className="card"><h2>ID de partajare invalid.</h2></div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <style dangerouslySetInnerHTML={{__html: THEME_CSS}} />
      <main style={{maxWidth:940, margin:"24px auto", padding:16}}>
        <div className="card" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <h1 className="h1" style={{margin:0}}>Fișiere partajate</h1>
            <div className="muted">Share ID: <code>{id}</code></div>
          </div>
          <a className="btn" href="/" rel="noreferrer">Deschide panoul</a>
        </div>

        <section className="card" style={{marginTop:12, display:"grid", gap:10}}>
          <div className="row">
            <label className="muted">API URL</label>
            <input className="input" placeholder="https://docs-ilegal-api-...a.run.app" value={apiUrl} onChange={e=>setApiUrl(e.target.value)} />
            <label className="muted">Parolă</label>
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
            <button className="btn btn-primary" disabled={!apiUrl || !id || loading} onClick={()=>fetchShare(apiUrl, id, password)}>{loading? "..." : "Accesează"}</button>
          </div>
          {error && <div className="card" style={{background:"#2a1a1a",borderColor:"#5e1b1b"}}>{error}</div>}
        </section>

        <section className="card" style={{marginTop:12}}>
          {docs.length===0 ? (
            <div className="muted">Niciun fișier disponibil sau lipsește parola corectă.</div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Nume</th><th>Fișier</th><th>Categorie</th><th>Încărcat</th><th>Acțiuni</th></tr>
              </thead>
              <tbody>
                {docs.map(d=>{
                  const canOpen = !!d.url;
                  return (
                    <tr key={d.id}>
                      <td>{d.name}</td>
                      <td className="muted">{d.filename}</td>
                      <td>{d.category}</td>
                      <td className="muted">{fmtDate(d.uploadedAt)}</td>
                      <td>{canOpen ? <a className="btn" href={d.url!} target="_blank" rel="noreferrer">Descarcă</a> : <span className="muted">fără link public</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

// Router minim: dacă path-ul începe cu /s/, pagina publică; altfel consola
export default function App(){
  return window.location.pathname.startsWith("/s/")
    ? <PublicShareView />
    : <PreviewApp />;
}
