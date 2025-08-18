import React from "react";

export function Sidebar(
  { active, onNavigate }:{
    active: string;
    onNavigate: (id: string)=>void;
  }
){
  const items: Array<{id:string; label:string}> = [
    {id:"dashboard",  label:"Dashboard"},
    {id:"docs",       label:"Documente"},
    {id:"categories", label:"Categorii"},
    {id:"search",     label:"Căutare AI"},
    {id:"share",      label:"Partajare"},
    {id:"magic",      label:"Magic Inbox"},
    {id:"settings",   label:"Setări"},
  ];

  const linkStyle: React.CSSProperties = {
    display:"flex", alignItems:"center", gap:10,
    padding:"10px 12px", borderRadius:10, textDecoration:"none",
    color:"var(--text)",
  };

  return (
    <aside style={{
      background:"var(--card)",
      border:"1px solid var(--border)",
      borderRadius:14,
      padding:12,
      position:"sticky",
      top:12,
      height:"calc(100vh - 24px)",
      display:"flex",
      flexDirection:"column",
      minWidth:0
    }}>
      <div style={{fontWeight:700, margin:"4px 6px 10px 6px"}}>Docs Ilegal</div>
      <nav style={{display:"flex", flexDirection:"column", gap:6}}>
        {items.map(it => (
          <a
            key={it.id}
            href={`#${it.id}`}
            onClick={(e)=>{ e.preventDefault(); onNavigate(it.id); }}
            style={{
              ...linkStyle,
              background: active===it.id ? "#0e152b" : "transparent",
              border: active===it.id ? "1px solid var(--border)" : "1px solid transparent"
            }}
          >
            {it.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
