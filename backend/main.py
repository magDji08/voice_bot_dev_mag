"""
VoiceBot Admin Backend — FastAPI
Endpoints : auth, users, upload, knowledge base, historique
"""
import os, uuid, shutil, json, logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List

from fastapi import (FastAPI, Depends, HTTPException, UploadFile,
                     File, Form, status, Request)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
import mysql.connector
import bcrypt
import jwt
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────
SECRET_KEY    = os.getenv("JWT_SECRET", "voicebot_secret_senegal_2025")
ALGORITHM     = "HS256"
TOKEN_EXPIRE  = 60 * 24  # 24 heures
UPLOAD_DIR    = Path(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "port":     int(os.getenv("DB_PORT", "3306")),
    "user":     os.getenv("DB_USER",     "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME",     "voicebot_db"),
    "charset":  "utf8mb4",
}

ALLOWED_EXTENSIONS = {
    "pdf": "pdf", "png": "image", "jpg": "image", "jpeg": "image",
    "gif": "image", "txt": "texte", "md": "texte", "csv": "texte",
    "docx": "autre", "doc": "autre"
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

app = FastAPI(title="VoiceBot Admin API", version="1.0.0")
FRONTEND_ORIGINS = [os.getenv("FRONTEND_URL", "http://localhost:5173")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

@app.on_event("startup")
def startup_bootstrap_admin():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        try:
            ensure_default_admin(conn)
        finally:
            conn.close()
    except Exception as e:
        logger.warning("Bootstrap admin ignore (DB indisponible): %s", e)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ── Base de données ────────────────────────────────────────────
def get_db():
    conn = mysql.connector.connect(**DB_CONFIG)
    try:
        yield conn
    finally:
        conn.close()

def query(conn, sql: str, params=None, fetch="all"):
    cur = conn.cursor(dictionary=True)
    cur.execute(sql, params or ())
    if fetch == "all":    return cur.fetchall()
    if fetch == "one":    return cur.fetchone()
    if fetch == "insert": conn.commit(); return cur.lastrowid
    conn.commit(); return None

def ensure_default_admin(conn):
    """Guarantee a working default admin account for first login/demo."""
    admin_email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@voicebot.sn")
    admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")
    admin_nom = os.getenv("DEFAULT_ADMIN_NOM", "Admin")
    admin_prenom = os.getenv("DEFAULT_ADMIN_PRENOM", "VoiceBot")

    existing = query(conn, "SELECT * FROM users WHERE email=%s", (admin_email,), "one")
    hashed = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode()

    if not existing:
        query(
            conn,
            """INSERT INTO users (nom,prenom,email,password,role,actif)
               VALUES(%s,%s,%s,%s,'admin',1)""",
            (admin_nom, admin_prenom, admin_email, hashed),
            "exec",
        )
        logger.info("Compte admin par defaut cree: %s", admin_email)
        return

    needs_update = (
        existing.get("role") != "admin"
        or int(existing.get("actif", 0)) != 1
        or not bcrypt.checkpw(admin_password.encode(), existing["password"].encode())
    )

    if needs_update:
        query(
            conn,
            "UPDATE users SET password=%s, role='admin', actif=1 WHERE id=%s",
            (hashed, existing["id"]),
            "exec",
        )
        logger.info("Compte admin par defaut reinitialise: %s", admin_email)

# ── JWT ────────────────────────────────────────────────────────
def create_token(user_id: int, role: str) -> str:
    exp = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE)
    return jwt.encode(
        {"sub": str(user_id), "role": role, "exp": exp},
        SECRET_KEY, algorithm=ALGORITHM
    )

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expiré")
    except jwt.JWTError:
        raise HTTPException(401, "Token invalide")

def get_current_user(token: str = Depends(oauth2_scheme),
                     db=Depends(get_db)) -> dict:
    payload = decode_token(token)
    user = query(db, "SELECT * FROM users WHERE id=%s AND actif=1",
                 (int(payload["sub"]),), "one")
    if not user:
        raise HTTPException(401, "Utilisateur introuvable")
    return user

def require_admin(user=Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Accès réservé aux administrateurs")
    return user

# ── Schémas Pydantic ───────────────────────────────────────────
class UserCreate(BaseModel):
    nom: str; prenom: str; email: EmailStr; password: str
    role: str = "user"

class KnowledgeEntryCreate(BaseModel):
    categorie: str; question: str; reponse: str
    langue: str = "fr"; file_id: Optional[int] = None

class MessageSave(BaseModel):
    session_id: str; role: str
    contenu_wolof: Optional[str] = None
    contenu_fr: Optional[str] = None
    intent_detecte: Optional[str] = None
    slots_json: Optional[dict] = None

class ConversationCreate(BaseModel):
    session_id: str; intent: Optional[str] = None

# ══════════════════════════════════════════════════════════════
# AUTH
# ══════════════════════════════════════════════════════════════
@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends(),
          db=Depends(get_db)):
    user = query(db,
        "SELECT * FROM users WHERE email=%s AND actif=1",
        (form.username,), "one")
    if not user:
        raise HTTPException(401, "Email ou mot de passe incorrect")
    if not bcrypt.checkpw(form.password.encode(), user["password"].encode()):
        raise HTTPException(401, "Email ou mot de passe incorrect")
    token = create_token(user["id"], user["role"])
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": {
            "id":     user["id"],
            "nom":    user["nom"],
            "prenom": user["prenom"],
            "email":  user["email"],
            "role":   user["role"],
        }
    }

@app.get("/auth/me")
def me(user=Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password"}

@app.post("/auth/register")
def register(data: UserCreate, db=Depends(get_db)):
    existing = query(db, "SELECT id FROM users WHERE email=%s",
                     (data.email,), "one")
    if existing:
        raise HTTPException(400, "Email déjà utilisé")
    hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    uid = query(db,
        "INSERT INTO users (nom,prenom,email,password,role) VALUES(%s,%s,%s,%s,%s)",
        (data.nom, data.prenom, data.email, hashed, "user"), "insert")
    return {"message": "Compte créé", "id": uid}

# ══════════════════════════════════════════════════════════════
# ADMIN — USERS
# ══════════════════════════════════════════════════════════════
@app.get("/admin/users")
def list_users(admin=Depends(require_admin), db=Depends(get_db)):
    return query(db,
        "SELECT id,nom,prenom,email,role,actif,created_at FROM users ORDER BY created_at DESC")

@app.put("/admin/users/{uid}/role")
def change_role(uid: int, role: str, admin=Depends(require_admin),
                db=Depends(get_db)):
    if role not in ("admin", "user"):
        raise HTTPException(400, "Rôle invalide")
    query(db, "UPDATE users SET role=%s WHERE id=%s", (role, uid), "exec")
    return {"message": "Rôle mis à jour"}

@app.delete("/admin/users/{uid}")
def deactivate_user(uid: int, admin=Depends(require_admin),
                    db=Depends(get_db)):
    query(db, "UPDATE users SET actif=0 WHERE id=%s", (uid,), "exec")
    return {"message": "Utilisateur désactivé"}

# ══════════════════════════════════════════════════════════════
# ADMIN — UPLOAD FICHIERS
# ══════════════════════════════════════════════════════════════
@app.post("/admin/upload")
async def upload_file(
    file: UploadFile = File(...),
    categorie: str = Form("general"),
    admin=Depends(require_admin),
    db=Depends(get_db)
):
    # Validation extension
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Format non supporté. Autorisés : {list(ALLOWED_EXTENSIONS.keys())}")

    # Lecture et validation taille
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "Fichier trop grand (max 10 MB)")

    # Sauvegarde sur disque dans un dossier par categorie
    category_dir = UPLOAD_DIR / categorie
    category_dir.mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    dest = category_dir / unique_name
    dest.write_bytes(content)

    type_fichier = ALLOWED_EXTENSIONS[ext]

    # Extraction texte si .txt ou .md
    contenu_extrait = None
    if type_fichier == "texte":
        try:
            contenu_extrait = content.decode("utf-8", errors="ignore")
        except Exception:
            pass

    # Enregistrement DB
    fid = query(db,
        """INSERT INTO knowledge_files
           (admin_id,nom_original,nom_stockage,type_fichier,mime_type,
            taille_bytes,contenu_extrait,chemin,statut,categorie)
           VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (admin["id"], file.filename, unique_name, type_fichier,
         file.content_type, len(content), contenu_extrait,
         str(dest), "traite" if contenu_extrait else "en_attente", categorie),
        "insert"
    )

    logger.info(f"Upload: {file.filename} ({type_fichier}) par admin {admin['id']}")
    return {
        "id":            fid,
        "nom":           file.filename,
        "type":          type_fichier,
        "taille":        len(content),
        "url":           f"/uploads/{categorie}/{unique_name}",
        "statut":        "traite" if contenu_extrait else "en_attente",
        "categorie":     categorie,
    }

@app.get("/admin/files")
def list_files(admin=Depends(require_admin), db=Depends(get_db)):
    rows = query(db,
        """SELECT f.*, u.nom, u.prenom
           FROM knowledge_files f
           JOIN users u ON f.admin_id = u.id
           ORDER BY f.created_at DESC""")
    # Normalize the stockage path so frontend can build correct /uploads/... URL
    for r in rows:
        cat = r.get("categorie") or ""
        if cat:
            r["nom_stockage"] = f"{cat}/{r.get('nom_stockage')}"
        else:
            r["nom_stockage"] = r.get("nom_stockage")
    return rows

@app.delete("/admin/files/{fid}")
def delete_file(fid: int, admin=Depends(require_admin), db=Depends(get_db)):
    f = query(db, "SELECT * FROM knowledge_files WHERE id=%s", (fid,), "one")
    if not f:
        raise HTTPException(404, "Fichier introuvable")
    # Supprimer du disque (chemin complet sauvegardé en DB)
    try:
        path = Path(f["chemin"])
    except Exception:
        path = UPLOAD_DIR / f["nom_stockage"]
    if path.exists():
        path.unlink()
    query(db, "DELETE FROM knowledge_files WHERE id=%s", (fid,), "exec")
    return {"message": "Fichier supprimé"}

# ══════════════════════════════════════════════════════════════
# ADMIN — KNOWLEDGE BASE
# ══════════════════════════════════════════════════════════════
@app.get("/admin/knowledge")
def list_knowledge(
    categorie: Optional[str] = None,
    admin=Depends(require_admin),
    db=Depends(get_db)
):
    if categorie:
        return query(db,
            "SELECT * FROM knowledge_entries WHERE categorie=%s ORDER BY created_at DESC",
            (categorie,))
    return query(db,
        "SELECT * FROM knowledge_entries ORDER BY created_at DESC")

@app.post("/admin/knowledge")
def create_knowledge(data: KnowledgeEntryCreate,
                     admin=Depends(require_admin), db=Depends(get_db)):
    kid = query(db,
        """INSERT INTO knowledge_entries
           (admin_id,file_id,categorie,question,reponse,langue)
           VALUES(%s,%s,%s,%s,%s,%s)""",
        (admin["id"], data.file_id, data.categorie,
         data.question, data.reponse, data.langue),
        "insert"
    )
    return {"message": "Entrée créée", "id": kid}

@app.put("/admin/knowledge/{kid}")
def update_knowledge(kid: int, data: KnowledgeEntryCreate,
                     admin=Depends(require_admin), db=Depends(get_db)):
    query(db,
        """UPDATE knowledge_entries
           SET categorie=%s, question=%s, reponse=%s, langue=%s
           WHERE id=%s""",
        (data.categorie, data.question, data.reponse, data.langue, kid),
        "exec"
    )
    return {"message": "Entrée mise à jour"}

@app.delete("/admin/knowledge/{kid}")
def delete_knowledge(kid: int, admin=Depends(require_admin),
                     db=Depends(get_db)):
    query(db, "UPDATE knowledge_entries SET actif=0 WHERE id=%s",
          (kid,), "exec")
    return {"message": "Entrée désactivée"}

# ══════════════════════════════════════════════════════════════
# CONVERSATIONS & HISTORIQUE (accessible admin + user)
# ══════════════════════════════════════════════════════════════
@app.post("/conversations")
def create_conversation(data: ConversationCreate,
                        user=Depends(get_current_user),
                        db=Depends(get_db)):
    cid = query(db,
        "INSERT INTO conversations (user_id,session_id,intent) VALUES(%s,%s,%s)",
        (user["id"], data.session_id, data.intent), "insert")
    return {"id": cid, "session_id": data.session_id}

@app.post("/conversations/message")
def save_message(data: MessageSave,
                 user=Depends(get_current_user),
                 db=Depends(get_db)):
    conv = query(db,
        "SELECT * FROM conversations WHERE session_id=%s AND user_id=%s",
        (data.session_id, user["id"]), "one")
    if not conv:
        raise HTTPException(404, "Conversation introuvable")

    slots_str = json.dumps(data.slots_json) if data.slots_json else None
    mid = query(db,
        """INSERT INTO messages
           (conversation_id,role,contenu_wolof,contenu_fr,intent_detecte,slots_json)
           VALUES(%s,%s,%s,%s,%s,%s)""",
        (conv["id"], data.role, data.contenu_wolof, data.contenu_fr,
         data.intent_detecte, slots_str),
        "insert"
    )
    # Mettre à jour intent de la conversation
    if data.intent_detecte:
        query(db,
            "UPDATE conversations SET intent=%s WHERE id=%s",
            (data.intent_detecte, conv["id"]), "exec")
    return {"id": mid}

@app.put("/conversations/{session_id}/end")
def end_conversation(session_id: str, statut: str = "terminee",
                     user=Depends(get_current_user),
                     db=Depends(get_db)):
    query(db,
        """UPDATE conversations
           SET statut=%s, ended_at=NOW()
           WHERE session_id=%s AND user_id=%s""",
        (statut, session_id, user["id"]), "exec")
    return {"message": "Conversation terminée"}

@app.get("/conversations/history")
def get_history(limit: int = 20, user=Depends(get_current_user),
                db=Depends(get_db)):
    """Historique des conversations de l'utilisateur connecté."""
    convs = query(db,
        """SELECT c.*, COUNT(m.id) as nb_messages
           FROM conversations c
           LEFT JOIN messages m ON c.id = m.conversation_id
           WHERE c.user_id=%s
           GROUP BY c.id
           ORDER BY c.created_at DESC LIMIT %s""",
        (user["id"], limit))
    return convs

@app.get("/conversations/{session_id}/messages")
def get_messages(session_id: str, user=Depends(get_current_user),
                 db=Depends(get_db)):
    """Messages d'une conversation spécifique."""
    conv = query(db,
        "SELECT * FROM conversations WHERE session_id=%s",
        (session_id,), "one")

    # Admin peut voir toutes les conv, user seulement les siennes
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    if user["role"] != "admin" and conv["user_id"] != user["id"]:
        raise HTTPException(403, "Accès refusé")

    msgs = query(db,
        "SELECT * FROM messages WHERE conversation_id=%s ORDER BY created_at ASC",
        (conv["id"],))
    return {"conversation": conv, "messages": msgs}

# ══════════════════════════════════════════════════════════════
# ADMIN — HISTORIQUE GLOBAL
# ══════════════════════════════════════════════════════════════
@app.get("/admin/conversations")
def admin_all_conversations(
    limit: int = 50,
    admin=Depends(require_admin),
    db=Depends(get_db)
):
    return query(db,
        """SELECT c.*, u.nom, u.prenom, u.email,
                  COUNT(m.id) as nb_messages
           FROM conversations c
           JOIN users u ON c.user_id = u.id
           LEFT JOIN messages m ON c.id = m.conversation_id
           GROUP BY c.id
           ORDER BY c.created_at DESC LIMIT %s""",
        (limit,))

@app.get("/admin/stats")
def admin_stats(admin=Depends(require_admin), db=Depends(get_db)):
    return {
        "total_users":    query(db, "SELECT COUNT(*) as n FROM users WHERE role='user'", fetch="one")["n"],
        "total_convs":    query(db, "SELECT COUNT(*) as n FROM conversations", fetch="one")["n"],
        "total_messages": query(db, "SELECT COUNT(*) as n FROM messages", fetch="one")["n"],
        "total_pdfs":     query(db, "SELECT COUNT(*) as n FROM documents_generes", fetch="one")["n"],
        "total_files":    query(db, "SELECT COUNT(*) as n FROM knowledge_files", fetch="one")["n"],
        "total_kb":       query(db, "SELECT COUNT(*) as n FROM knowledge_entries WHERE actif=1", fetch="one")["n"],
    }

# ══════════════════════════════════════════════════════════════
# DOCUMENTS PDF GÉNÉRÉS
# ══════════════════════════════════════════════════════════════
@app.post("/documents/save")
def save_document(
    session_id: str = Form(...),
    type_document: str = Form(...),
    nom_fichier: str = Form(...),
    slots_json: str = Form("{}"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    conv = query(db,
        "SELECT * FROM conversations WHERE session_id=%s AND user_id=%s",
        (session_id, user["id"]), "one")
    if not conv:
        raise HTTPException(404, "Conversation introuvable")

    did = query(db,
        """INSERT INTO documents_generes
           (conversation_id,user_id,type_document,nom_fichier,slots_json)
           VALUES(%s,%s,%s,%s,%s)""",
        (conv["id"], user["id"], type_document, nom_fichier, slots_json),
        "insert"
    )
    return {"id": did, "message": "Document enregistré"}

@app.get("/documents/history")
def doc_history(user=Depends(get_current_user), db=Depends(get_db)):
    return query(db,
        """SELECT * FROM documents_generes
           WHERE user_id=%s ORDER BY created_at DESC""",
        (user["id"],))

@app.get("/")
def root():
    return {"status": "ok", "version": "1.0.0", "service": "VoiceBot Admin API"}
