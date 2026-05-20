
import { useState, useEffect, useRef } from "react";
const API = "http://localhost:8000";

function useAuth() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("vb_user")); } catch { return null; } });
  const [token, setToken] = useState(() => localStorage.getItem("vb_token") || "");
  const login = async (email, password) => {
    const form = new FormData();
    form.append("username", email); form.append("password", password);
    const r = await fetch(API + "/auth/login", { method: "POST", body: form });
    if (!r.ok) throw new Error("Email ou mot de passe incorrect");
    const d = await r.json();
    localStorage.setItem("vb_token", d.access_token);
    localStorage.setItem("vb_user", JSON.stringify(d.user));
    setToken(d.access_token); setUser(d.user); return d.user;
  };
  const logout = () => { localStorage.removeItem("vb_token"); localStorage.removeItem("vb_user"); setToken(""); setUser(null); };
  const authFetch = async (url, opts = {}) => {
    const r = await fetch(API + url, { ...opts, headers: { ...opts.headers, Authorization: "Bearer " + token } });
    if (r.status === 401) { logout(); throw new Error("Session expirée"); }
    return r;
  };
  return { user, token, login, logout, authFetch };
}

const Badge = ({ role }) => <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: role === "admin" ? "#1F4E79" : "#009A44", color: "#fff" }}>{role.toUpperCase()}</span>;

const Card = ({ title, children, action }) => (
  <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px #0001", marginBottom: 24, overflow: "hidden" }}>
    <div style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <h3 style={{ margin: 0, fontSize: 15, color: "#1F4E79", fontWeight: 600 }}>{title}</h3>
      {action}
    </div>
    <div style={{ padding: 24 }}>{children}</div>
  </div>
);

const Btn = ({ children, onClick, variant = "primary", small, disabled }) => {
  const s = { primary: { background: "#1F4E79", color: "#fff" }, success: { background: "#009A44", color: "#fff" }, danger: { background: "#dc3545", color: "#fff" }, secondary: { background: "#f0f0f0", color: "#333" } };
  return <button onClick={onClick} disabled={disabled} style={{ ...s[variant], border: "none", borderRadius: 8, padding: small ? "6px 14px" : "10px 20px", fontSize: small ? 12 : 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>{children}</button>;
};

const Input = ({ label, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#555", fontWeight: 500 }}>{label}</label>}
    <input {...props} style={{ width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", ...props.style }}/>
  </div>
);

const Textarea = ({ label, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#555", fontWeight: 500 }}>{label}</label>}
    <textarea {...props} style={{ width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", minHeight: 100, resize: "vertical", ...props.style }}/>
  </div>
);

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (e) => { e.preventDefault(); setErr(""); setLoading(true); try { await onLogin(email, pass); } catch (e) { setErr(e.message); } finally { setLoading(false); } };
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0a1628 0%,#1F4E79 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, width: 380, boxShadow: "0 20px 60px #0004" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 16 }}>
            {["#009A44","#FDEF42","#E31B23"].map(c => <span key={c} style={{ width: 28, height: 6, borderRadius: 3, background: c, display: "inline-block" }}/>)}
          </div>
          <h1 style={{ margin: 0, color: "#1F4E79", fontSize: 24, fontWeight: 800 }}>VoiceBot Admin</h1>
          <p style={{ color: "#888", marginTop: 6, fontSize: 13 }}>Connexion à l&apos;espace d&apos;administration</p>
        </div>
        <form onSubmit={submit}>
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@voicebot.sn" required/>
          <Input label="Mot de passe" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" required/>
          {err && <p style={{ color: "#dc3545", fontSize: 13, marginBottom: 12 }}>{err}</p>}
          <Btn disabled={loading}>{ loading ? "Connexion..." : "Se connecter" }</Btn>
        </form>
        <p style={{ marginTop: 16, fontSize: 12, color: "#aaa", textAlign: "center" }}>Demo: admin@voicebot.sn / admin123</p>
      </div>
    </div>
  );
}

function Sidebar({ active, setActive, user, onLogout }) {
  const links = user.role === "admin"
    ? [["dashboard","Tableau de bord","📊"],["users","Utilisateurs","👥"],["upload","Upload fichiers","📁"],["knowledge","Base de connaissances","🧠"],["history","Historique global","📜"]]
    : [["history","Mon historique","📜"],["docs","Mes documents","📄"]];
  return (
    <div style={{ width: 240, minHeight: "100vh", background: "#0d1f35", color: "#fff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "24px 20px 16px" }}>
        <div style={{ display: "flex", gap: 3, marginBottom: 12 }}>{["#009A44","#FDEF42","#E31B23"].map(c => <span key={c} style={{ flex: 1, height: 4, borderRadius: 2, background: c }}/>)}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#C9943A" }}>VoiceBot</div>
        <div style={{ fontSize: 12, color: "#8899aa", marginTop: 2 }}>Administration</div>
      </div>
      <div style={{ padding: "8px 12px", flex: 1 }}>
        {links.map(([id, label, icon]) => (
          <button key={id} onClick={() => setActive(id)} style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 4, background: active === id ? "rgba(201,148,58,.25)" : "transparent", color: active === id ? "#C9943A" : "#ccd6e0", fontWeight: active === id ? 600 : 400, fontSize: 13, borderLeft: active === id ? "3px solid #C9943A" : "3px solid transparent" }}>
            {icon} &nbsp; {label}
          </button>
        ))}
      </div>
      <div style={{ padding: 16, borderTop: "1px solid #1e3550" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{user.prenom} {user.nom}</div>
        <div style={{ fontSize: 11, color: "#8899aa" }}>{user.email}</div>
        <div style={{ marginTop: 4, marginBottom: 8 }}><Badge role={user.role}/></div>
        <button onClick={onLogout} style={{ background: "none", border: "1px solid #dc3545", color: "#dc3545", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, width: "100%" }}>Déconnexion</button>
      </div>
    </div>
  );
}

function Dashboard({ authFetch }) {
  const [stats, setStats] = useState(null);
  useEffect(() => { authFetch("/admin/stats").then(r => r.json()).then(setStats).catch(() => {}); }, []);
  const items = stats ? [["Utilisateurs",stats.total_users,"#1F4E79","👥"],["Conversations",stats.total_convs,"#009A44","💬"],["Messages",stats.total_messages,"#C9943A","✉️"],["PDFs générés",stats.total_pdfs,"#6c5ce7","📄"],["Fichiers KB",stats.total_files,"#e17055","📁"],["Entrées KB",stats.total_kb,"#00b894","🧠"]] : [];
  return (
    <div>
      <h2 style={{ color: "#1F4E79", marginBottom: 24 }}>Tableau de bord</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {items.map(([label,val,color,icon]) => (
          <div key={label} style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 12px #0001", borderLeft: "4px solid " + color }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color }}>{val ?? "—"}</div>
            <div style={{ color: "#888", fontSize: 13 }}>{label}</div>
          </div>
        ))}
      </div>
      {!stats && <p style={{ color: "#888", marginTop: 24 }}>Chargement...</p>}
    </div>
  );
}

function UsersPage({ authFetch }) {
  const [users, setUsers] = useState([]);
  const load = () => authFetch("/admin/users").then(r => r.json()).then(setUsers).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <div>
      <h2 style={{ color: "#1F4E79", marginBottom: 24 }}>Gestion des utilisateurs</h2>
      <Card title={users.length + " utilisateur(s)"}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#f8f9fa" }}>{["Nom","Email","Rôle","Statut","Créé le","Actions"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#555", fontWeight: 600 }}>{h}</th>)}</tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                <td style={{ padding: "10px 14px" }}>{u.prenom} {u.nom}</td>
                <td style={{ padding: "10px 14px", color: "#666" }}>{u.email}</td>
                <td style={{ padding: "10px 14px" }}><Badge role={u.role}/></td>
                <td style={{ padding: "10px 14px" }}><span style={{ color: u.actif ? "#009A44" : "#dc3545", fontWeight: 600 }}>{u.actif ? "✓ Actif" : "✗ Inactif"}</span></td>
                <td style={{ padding: "10px 14px", color: "#888", fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString("fr-SN")}</td>
                <td style={{ padding: "10px 14px", display: "flex", gap: 8 }}>
                  <Btn small variant="secondary" onClick={async () => { await authFetch("/admin/users/" + u.id + "/role?role=" + (u.role === "admin" ? "user" : "admin"), { method: "PUT" }); load(); }}>{u.role === "admin" ? "→ User" : "→ Admin"}</Btn>
                  {u.actif && <Btn small variant="danger" onClick={async () => { if (confirm("Désactiver ?")) { await authFetch("/admin/users/" + u.id, { method: "DELETE" }); load(); } }}>Désactiver</Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function UploadPage({ authFetch }) {
  const [files, setFiles] = useState([]); const [categorie, setCategorie] = useState("general");
  const [uploading, setUploading] = useState(false); const [list, setList] = useState([]); const [msg, setMsg] = useState("");
  const inputRef = useRef();
  const load = () => authFetch("/admin/files").then(r => r.json()).then(setList).catch(() => {});
  useEffect(() => { load(); }, []);
  const upload = async () => {
    if (!files.length) return; setUploading(true); setMsg(""); let ok = 0;
    for (const f of files) { const form = new FormData(); form.append("file", f); form.append("categorie", categorie); const r = await authFetch("/admin/upload", { method: "POST", body: form }); if (r.ok) ok++; }
    setMsg(ok + "/" + files.length + " fichier(s) uploadé(s)"); setFiles([]); setUploading(false); load();
  };
  const typeIcon = { pdf: "📕", image: "🖼️", texte: "📝", autre: "📎" };
  return (
    <div>
      <h2 style={{ color: "#1F4E79", marginBottom: 24 }}>Upload de fichiers</h2>
      <Card title="Uploader">
        <div onDrop={e => { e.preventDefault(); setFiles(Array.from(e.dataTransfer.files)); }} onDragOver={e => e.preventDefault()} onClick={() => inputRef.current.click()}
          style={{ border: "2px dashed #1F4E79", borderRadius: 12, padding: 40, textAlign: "center", cursor: "pointer", marginBottom: 16, background: files.length ? "#e8f4e8" : "#f8fbff" }}>
          <div style={{ fontSize: 40 }}>📁</div>
          <div style={{ color: "#1F4E79", fontWeight: 600, marginTop: 8 }}>Glisser-déposer ou cliquer</div>
          <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>PDF, images, TXT, MD, CSV, DOCX — max 10 MB</div>
          <input ref={inputRef} type="file" multiple style={{ display: "none" }} onChange={e => setFiles(Array.from(e.target.files))}/>
        </div>
        {files.length > 0 && <div style={{ marginBottom: 12 }}>{files.map((f,i) => <div key={i} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>📄 {f.name} — {(f.size/1024).toFixed(1)} KB</div>)}</div>}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select value={categorie} onChange={e => setCategorie(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}>
            {["general","casier_judiciaire","extrait_naissance","certificat_residence","mairie","tribunal"].map(c => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
          </select>
          <Btn onClick={upload} variant="success" disabled={!files.length || uploading}>{uploading ? "Upload..." : "Uploader " + files.length + " fichier(s)"}</Btn>
        </div>
        {msg && <p style={{ color: "#009A44", fontWeight: 600, marginTop: 12 }}>{msg}</p>}
      </Card>
      <Card title={list.length + " fichier(s)"}>
        {list.map(f => (
          <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
            <span style={{ fontSize: 22 }}>{typeIcon[f.type_fichier] || "📎"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{f.nom_original}</div>
              <div style={{ color: "#888", fontSize: 11 }}>{f.type_fichier} · {(f.taille_bytes/1024).toFixed(1)} KB · <span style={{ color: f.statut === "traite" ? "#009A44" : "#e17055" }}>{f.statut}</span></div>
            </div>
            <a href={API + "/uploads/" + f.nom_stockage} target="_blank" rel="noreferrer"><Btn small variant="secondary">Voir</Btn></a>
            <Btn small variant="danger" onClick={async () => { if (confirm("Supprimer ?")) { await authFetch("/admin/files/" + f.id, { method: "DELETE" }); load(); } }}>Suppr.</Btn>
          </div>
        ))}
      </Card>
    </div>
  );
}

function KnowledgePage({ authFetch }) {
  const [entries, setEntries] = useState([]); const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ categorie: "general", question: "", reponse: "", langue: "fr" }); const [editId, setEditId] = useState(null);
  const load = () => authFetch("/admin/knowledge").then(r => r.json()).then(setEntries).catch(() => {});
  useEffect(() => { load(); }, []);
  const save = async () => {
    const method = editId ? "PUT" : "POST"; const url = editId ? "/admin/knowledge/" + editId : "/admin/knowledge";
    await authFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ categorie: "general", question: "", reponse: "", langue: "fr" }); setEditId(null); setShowForm(false); load();
  };
  const cats = [...new Set(entries.map(e => e.categorie))];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ color: "#1F4E79", margin: 0 }}>Base de connaissances</h2>
        <Btn onClick={() => { setShowForm(!showForm); setEditId(null); }} variant="success" small>+ Nouvelle entrée</Btn>
      </div>
      {showForm && (
        <Card title={editId ? "Modifier" : "Nouvelle entrée"}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, color: "#555", fontWeight: 500, display: "block", marginBottom: 6 }}>Catégorie</label>
              <select value={form.categorie} onChange={e => setForm({...form, categorie: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, marginBottom: 16 }}>
                {["general","casier_judiciaire","extrait_naissance","certificat_residence","mairie","tribunal","impots","sante"].map(c => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
              </select>
              <label style={{ fontSize: 13, color: "#555", fontWeight: 500, display: "block", marginBottom: 6 }}>Langue</label>
              <select value={form.langue} onChange={e => setForm({...form, langue: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}>
                <option value="fr">Français</option><option value="wo">Wolof</option><option value="fr_wo">Bilingue</option>
              </select>
            </div>
            <Textarea label="Question" value={form.question} onChange={e => setForm({...form, question: e.target.value})} style={{ minHeight: 80 }}/>
          </div>
          <Textarea label="Réponse" value={form.reponse} onChange={e => setForm({...form, reponse: e.target.value})} style={{ minHeight: 120 }}/>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={save} variant="primary">{editId ? "Mettre à jour" : "Créer"}</Btn>
            <Btn onClick={() => { setShowForm(false); setEditId(null); }} variant="secondary">Annuler</Btn>
          </div>
        </Card>
      )}
      {cats.map(cat => (
        <Card key={cat} title={"📂 " + cat.replace(/_/g," ") + " (" + entries.filter(e => e.categorie === cat && e.actif).length + ")"}>
          {entries.filter(e => e.categorie === cat && e.actif).map(e => (
            <div key={e.id} style={{ padding: "12px 0", borderBottom: "1px solid #f5f5f5" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#1F4E79", marginBottom: 4 }}>Q : {e.question}</div>
                  <div style={{ color: "#555", fontSize: 13 }}>R : {e.reponse}</div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{e.langue} · {new Date(e.created_at).toLocaleDateString("fr-SN")}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Btn small variant="secondary" onClick={() => { setForm({ categorie: e.categorie, question: e.question, reponse: e.reponse, langue: e.langue }); setEditId(e.id); setShowForm(true); }}>Modifier</Btn>
                  <Btn small variant="danger" onClick={async () => { if (confirm("Désactiver ?")) { await authFetch("/admin/knowledge/" + e.id, { method: "DELETE" }); load(); } }}>Suppr.</Btn>
                </div>
              </div>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

function HistoryPage({ authFetch, user }) {
  const [convs, setConvs] = useState([]); const [selected, setSelected] = useState(null); const [msgs, setMsgs] = useState([]);
  const load = () => { const url = user.role === "admin" ? "/admin/conversations" : "/conversations/history"; authFetch(url).then(r => r.json()).then(setConvs).catch(() => {}); };
  useEffect(() => { load(); }, []);
  const openConv = async (sid) => { setSelected(sid); const r = await authFetch("/conversations/" + sid + "/messages"); const d = await r.json(); setMsgs(d.messages || []); };
  const statusColor = { en_cours: "#C9943A", terminee: "#009A44", abandonnee: "#dc3545" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 24 }}>
      <Card title={convs.length + " conversation(s)"}>
        {convs.length === 0 && <p style={{ color: "#888" }}>Aucune conversation</p>}
        {convs.map(c => (
          <div key={c.id} onClick={() => openConv(c.session_id)} style={{ padding: 12, borderRadius: 8, marginBottom: 8, cursor: "pointer", background: selected === c.session_id ? "#e8f4ff" : "#f8f9fa", border: selected === c.session_id ? "1px solid #1F4E79" : "1px solid transparent" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "#1F4E79" }}>{c.intent || "Sans intention"}</span>
              <span style={{ fontSize: 11, color: statusColor[c.statut], fontWeight: 600 }}>{c.statut}</span>
            </div>
            {user.role === "admin" && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{c.prenom} {c.nom}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "#aaa" }}>{new Date(c.created_at).toLocaleString("fr-SN")}</span>
              <span style={{ fontSize: 11, color: "#888" }}>{c.nb_messages} msg</span>
            </div>
          </div>
        ))}
      </Card>
      <Card title={selected ? "Messages" : "Sélectionner une conversation"}>
        {!selected && <p style={{ color: "#888" }}>Cliquez sur une conversation</p>}
        {msgs.map(m => (
          <div key={m.id} style={{ marginBottom: 12, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: 12, background: m.role === "user" ? "#1F4E79" : "#f0f0f0", color: m.role === "user" ? "#fff" : "#333" }}>
              {m.contenu_wolof && <div style={{ fontSize: 12, opacity: .8, marginBottom: 4 }}>🗣 {m.contenu_wolof}</div>}
              <div style={{ fontSize: 14 }}>{m.contenu_fr}</div>
              {m.intent_detecte && <div style={{ fontSize: 10, opacity: .7, marginTop: 4 }}>intent: {m.intent_detecte}</div>}
              <div style={{ fontSize: 10, opacity: .6, marginTop: 4 }}>{new Date(m.created_at).toLocaleTimeString("fr-SN")}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export default function App() {
  const { user, login, logout, authFetch } = useAuth();
  const [page, setPage] = useState("dashboard");
  if (!user) return <LoginPage onLogin={login}/>;
  const pages = { dashboard: <Dashboard authFetch={authFetch}/>, users: <UsersPage authFetch={authFetch}/>, upload: <UploadPage authFetch={authFetch}/>, knowledge: <KnowledgePage authFetch={authFetch}/>, history: <HistoryPage authFetch={authFetch} user={user}/> };
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f4f6fb", fontFamily: "Inter,sans-serif" }}>
      <Sidebar active={page} setActive={setPage} user={user} onLogout={logout}/>
      <main style={{ flex: 1, padding: 32, overflowY: "auto" }}>{pages[page] || <p>Page en construction</p>}</main>
    </div>
  );
}
