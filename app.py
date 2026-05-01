import os
from flask import Flask, render_template, request, jsonify
import sqlite3
from pathlib import Path
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

# ==============================
# DATABASE CONFIG
# ==============================
DB_PATH = Path(os.environ.get("DB_PATH", "database/procurement.db"))


def now_text():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_db():
    """Open SQLite connection and create database folder if missing."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def table_columns(conn, table_name):
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {row["name"] for row in rows}


def add_column_if_missing(conn, table_name, column_name, column_sql):
    """Small migration helper for existing old database files."""
    if column_name not in table_columns(conn, table_name):
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_sql}")


# ==============================
# INITIAL DATABASE
# ==============================
def init_db():
    conn = get_db()

    conn.executescript("""
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_code TEXT UNIQUE,
        project_name TEXT NOT NULL,
        location TEXT,
        owner_name TEXT,
        budget REAL DEFAULT 0,
        status TEXT DEFAULT 'Active',
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_code TEXT UNIQUE,
        company_name TEXT NOT NULL,
        tax_id TEXT,
        contact_name TEXT,
        phone TEXT,
        email TEXT,
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_code TEXT UNIQUE,
        department_name TEXT NOT NULL,
        status TEXT DEFAULT 'Active',
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT,
        username TEXT UNIQUE,
        password_hash TEXT,
        role TEXT,
        department TEXT,
        status TEXT DEFAULT 'Active',
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_no TEXT UNIQUE,
        title TEXT NOT NULL,
        project_id INTEGER,
        requester TEXT,
        total_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'Pending',
        created_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_request_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_id INTEGER,
        item_name TEXT,
        description TEXT,
        qty REAL DEFAULT 0,
        unit TEXT,
        unit_price REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        FOREIGN KEY (pr_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_no TEXT UNIQUE,
        pr_id INTEGER,
        vendor_id INTEGER,
        total_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'Draft',
        payment_status TEXT DEFAULT 'Unpaid',
        due_date TEXT,
        created_at TEXT,
        FOREIGN KEY (pr_id) REFERENCES purchase_requests(id),
        FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS grn (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grn_no TEXT UNIQUE,
        po_id INTEGER,
        received_by TEXT,
        received_date TEXT,
        status TEXT DEFAULT 'Received',
        created_at TEXT,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_type TEXT,
        doc_id INTEGER,
        file_name TEXT,
        file_type TEXT,
        file_size_mb REAL,
        file_path TEXT,
        drive_file_id TEXT,
        drive_url TEXT,
        uploaded_by TEXT,
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS approval_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_type TEXT,
        doc_id INTEGER,
        action TEXT,
        action_by TEXT,
        note TEXT,
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT,
        detail TEXT,
        created_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS po_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_id INTEGER NOT NULL,
        pr_item_id INTEGER,
        item_name TEXT,
        qty REAL DEFAULT 0,
        unit TEXT,
        unit_price REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
        FOREIGN KEY (pr_item_id) REFERENCES purchase_request_items(id)
    );

    CREATE TABLE IF NOT EXISTS grn_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grn_id INTEGER NOT NULL,
        po_item_id INTEGER,
        received_qty REAL DEFAULT 0,
        rejected_qty REAL DEFAULT 0,
        remark TEXT,
        FOREIGN KEY (grn_id) REFERENCES grn(id),
        FOREIGN KEY (po_item_id) REFERENCES po_items(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_no TEXT UNIQUE,
        po_id INTEGER NOT NULL,
        amount REAL DEFAULT 0,
        payment_date TEXT,
        payment_method TEXT,
        reference_no TEXT,
        paid_by TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_pr_project        ON purchase_requests(project_id);
    CREATE INDEX IF NOT EXISTS idx_pr_status         ON purchase_requests(status);
    CREATE INDEX IF NOT EXISTS idx_po_pr             ON purchase_orders(pr_id);
    CREATE INDEX IF NOT EXISTS idx_po_vendor         ON purchase_orders(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_po_status         ON purchase_orders(status);
    CREATE INDEX IF NOT EXISTS idx_po_payment_status ON purchase_orders(payment_status);
    CREATE INDEX IF NOT EXISTS idx_po_items_po       ON po_items(po_id);
    CREATE INDEX IF NOT EXISTS idx_grn_po            ON grn(po_id);
    CREATE INDEX IF NOT EXISTS idx_grn_items_grn     ON grn_items(grn_id);
    CREATE INDEX IF NOT EXISTS idx_payments_po       ON payments(po_id);
    """)

    # Migration support: if database/procurement.db was created by an older app.py,
    # CREATE TABLE IF NOT EXISTS will not add new columns automatically.
    # These lines prevent common copy/paste/version mismatch errors.
    existing_tables = {
        r["name"]
        for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    }

    if "projects" in existing_tables:
        add_column_if_missing(conn, "projects", "project_code", "project_code TEXT")
        add_column_if_missing(conn, "projects", "project_name", "project_name TEXT")
        add_column_if_missing(conn, "projects", "location", "location TEXT")
        add_column_if_missing(conn, "projects", "owner_name", "owner_name TEXT")
        add_column_if_missing(conn, "projects", "budget", "budget REAL DEFAULT 0")
        add_column_if_missing(conn, "projects", "status", "status TEXT DEFAULT 'Active'")
        add_column_if_missing(conn, "projects", "created_at", "created_at TEXT")
        cols = table_columns(conn, "projects")
        if "code" in cols:
            conn.execute("UPDATE projects SET project_code = COALESCE(project_code, code)")
        if "name" in cols:
            conn.execute("UPDATE projects SET project_name = COALESCE(project_name, name)")

    if "vendors" in existing_tables:
        add_column_if_missing(conn, "vendors", "vendor_code", "vendor_code TEXT")
        add_column_if_missing(conn, "vendors", "company_name", "company_name TEXT")
        add_column_if_missing(conn, "vendors", "tax_id", "tax_id TEXT")
        add_column_if_missing(conn, "vendors", "contact_name", "contact_name TEXT")
        add_column_if_missing(conn, "vendors", "phone", "phone TEXT")
        add_column_if_missing(conn, "vendors", "email", "email TEXT")
        add_column_if_missing(conn, "vendors", "created_at", "created_at TEXT")
        cols = table_columns(conn, "vendors")
        if "code" in cols:
            conn.execute("UPDATE vendors SET vendor_code = COALESCE(vendor_code, code)")
        if "name" in cols:
            conn.execute("UPDATE vendors SET company_name = COALESCE(company_name, name)")

    if "departments" in existing_tables:
        add_column_if_missing(conn, "departments", "department_code", "department_code TEXT")
        add_column_if_missing(conn, "departments", "department_name", "department_name TEXT")
        add_column_if_missing(conn, "departments", "status", "status TEXT DEFAULT 'Active'")
        add_column_if_missing(conn, "departments", "created_at", "created_at TEXT")
        cols = table_columns(conn, "departments")
        if "code" in cols:
            conn.execute("UPDATE departments SET department_code = COALESCE(department_code, code)")
        if "name" in cols:
            conn.execute("UPDATE departments SET department_name = COALESCE(department_name, name)")

    if "users" in existing_tables:
        add_column_if_missing(conn, "users", "full_name", "full_name TEXT")
        add_column_if_missing(conn, "users", "username", "username TEXT")
        add_column_if_missing(conn, "users", "password_hash", "password_hash TEXT")
        add_column_if_missing(conn, "users", "role", "role TEXT")
        add_column_if_missing(conn, "users", "department", "department TEXT")
        add_column_if_missing(conn, "users", "status", "status TEXT DEFAULT 'Active'")
        add_column_if_missing(conn, "users", "created_at", "created_at TEXT")
        add_column_if_missing(conn, "users", "last_login", "last_login TEXT")
        add_column_if_missing(conn, "users", "login_attempts", "login_attempts INTEGER DEFAULT 0")
        add_column_if_missing(conn, "users", "updated_at", "updated_at TEXT")

    if "projects" in existing_tables:
        add_column_if_missing(conn, "projects", "start_date", "start_date TEXT")
        add_column_if_missing(conn, "projects", "end_date", "end_date TEXT")
        add_column_if_missing(conn, "projects", "notes", "notes TEXT")
        add_column_if_missing(conn, "projects", "updated_at", "updated_at TEXT")

    if "vendors" in existing_tables:
        add_column_if_missing(conn, "vendors", "address", "address TEXT")
        add_column_if_missing(conn, "vendors", "payment_terms", "payment_terms TEXT DEFAULT 'Net30'")
        add_column_if_missing(conn, "vendors", "notes", "notes TEXT")
        add_column_if_missing(conn, "vendors", "updated_at", "updated_at TEXT")

    if "purchase_requests" in existing_tables:
        add_column_if_missing(conn, "purchase_requests", "department", "department TEXT")
        add_column_if_missing(conn, "purchase_requests", "approved_by", "approved_by TEXT")
        add_column_if_missing(conn, "purchase_requests", "approved_at", "approved_at TEXT")
        add_column_if_missing(conn, "purchase_requests", "notes", "notes TEXT")
        add_column_if_missing(conn, "purchase_requests", "updated_at", "updated_at TEXT")

    if "purchase_orders" in existing_tables:
        add_column_if_missing(conn, "purchase_orders", "approved_by", "approved_by TEXT")
        add_column_if_missing(conn, "purchase_orders", "approved_at", "approved_at TEXT")
        add_column_if_missing(conn, "purchase_orders", "notes", "notes TEXT")
        add_column_if_missing(conn, "purchase_orders", "updated_at", "updated_at TEXT")

    if "grn" in existing_tables:
        add_column_if_missing(conn, "grn", "notes", "notes TEXT")
        add_column_if_missing(conn, "grn", "updated_at", "updated_at TEXT")

    # Default admin user
    admin_password_hash = generate_password_hash("admin123")
    conn.execute("""
        INSERT OR IGNORE INTO users
        (full_name, username, password_hash, role, department, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        "System Administrator", "admin", admin_password_hash,
        "Admin", "Management", "Active", now_text()
    ))

    default_departments = [
        ("D001", "Management"),
        ("D002", "Procurement"),
        ("D003", "Engineering"),
        ("D004", "Warehouse"),
        ("D005", "Accounting"),
    ]
    for code, name in default_departments:
        conn.execute("""
            INSERT OR IGNORE INTO departments
            (department_code, department_name, status, created_at)
            VALUES (?, ?, ?, ?)
        """, (code, name, "Active", now_text()))

    conn.commit()
    conn.close()


# ==============================
# COMMON HELPERS
# ==============================
def rows_to_dict(rows):
    return [dict(row) for row in rows]


def get_json():
    return request.get_json(silent=True) or {}


# ==============================
# PAGE ROUTES
# ==============================
@app.route("/")
def index():
    try:
        return render_template("index.html")
    except Exception:
        return """
        <h1>PRO Procurement System</h1>
        <p>Flask server and SQLite database are running.</p>
        <ul>
            <li><a href='/health'>/health</a></li>
            <li><a href='/api/health'>/api/health</a></li>
            <li><a href='/api/projects'>/api/projects</a></li>
            <li><a href='/api/departments'>/api/departments</a></li>
            <li><a href='/api/vendors'>/api/vendors</a></li>
        </ul>
        """


@app.route("/health")
def health():
    return jsonify({
        "success": True,
        "message": "PRO System is running",
        "path": "/health",
        "database": str(DB_PATH),
    })


@app.route("/api/health")
def api_health():
    return jsonify({
        "success": True,
        "message": "PRO System is running",
        "path": "/api/health",
        "database": str(DB_PATH),
    })


# ==============================
# PROJECTS API
# ==============================
@app.route("/api/projects", methods=["GET", "POST"])
def api_projects():
    conn = get_db()
    try:
        if request.method == "POST":
            data = get_json()
            conn.execute("""
                INSERT INTO projects
                (project_code, project_name, location, owner_name, budget, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get("project_code"),
                data.get("project_name"),
                data.get("location"),
                data.get("owner_name"),
                data.get("budget", 0),
                data.get("status", "Active"),
                now_text(),
            ))
            conn.commit()
            return jsonify({"success": True, "message": "เพิ่มโครงการสำเร็จ"})

        rows = conn.execute("SELECT * FROM projects ORDER BY id DESC").fetchall()
        return jsonify(rows_to_dict(rows))
    except sqlite3.IntegrityError as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"ข้อมูลซ้ำหรือไม่ถูกต้อง: {e}"}), 400
    finally:
        conn.close()


# ==============================
# VENDORS API
# ==============================
@app.route("/api/vendors", methods=["GET", "POST"])
def api_vendors():
    conn = get_db()
    try:
        if request.method == "POST":
            data = get_json()
            conn.execute("""
                INSERT INTO vendors
                (vendor_code, company_name, tax_id, contact_name, phone, email, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get("vendor_code"),
                data.get("company_name"),
                data.get("tax_id"),
                data.get("contact_name"),
                data.get("phone"),
                data.get("email"),
                now_text(),
            ))
            conn.commit()
            return jsonify({"success": True, "message": "เพิ่มผู้ขายสำเร็จ"})

        rows = conn.execute("SELECT * FROM vendors ORDER BY id DESC").fetchall()
        return jsonify(rows_to_dict(rows))
    except sqlite3.IntegrityError as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"ข้อมูลซ้ำหรือไม่ถูกต้อง: {e}"}), 400
    finally:
        conn.close()


# ==============================
# DEPARTMENTS API
# ==============================
@app.route("/api/departments", methods=["GET", "POST"])
def api_departments():
    conn = get_db()
    try:
        if request.method == "POST":
            data = get_json()
            conn.execute("""
                INSERT INTO departments
                (department_code, department_name, status, created_at)
                VALUES (?, ?, ?, ?)
            """, (
                data.get("department_code"),
                data.get("department_name"),
                data.get("status", "Active"),
                now_text(),
            ))
            conn.commit()
            return jsonify({"success": True, "message": "เพิ่มแผนกสำเร็จ"})

        rows = conn.execute("SELECT * FROM departments ORDER BY id DESC").fetchall()
        return jsonify(rows_to_dict(rows))
    except sqlite3.IntegrityError as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"ข้อมูลซ้ำหรือไม่ถูกต้อง: {e}"}), 400
    finally:
        conn.close()


# ==============================
# PURCHASE REQUEST API
# ==============================
@app.route("/api/purchase-requests", methods=["GET", "POST"])
def api_purchase_requests():
    conn = get_db()
    try:
        if request.method == "POST":
            data = get_json()
            items = data.get("items", [])
            cursor = conn.execute("""
                INSERT INTO purchase_requests
                (pr_no, title, project_id, requester, total_amount, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get("pr_no"),
                data.get("title"),
                data.get("project_id"),
                data.get("requester"),
                data.get("total_amount", 0),
                data.get("status", "Pending"),
                now_text(),
            ))
            pr_id = cursor.lastrowid

            total_amount = 0
            for item in items:
                qty = float(item.get("qty", 0) or 0)
                unit_price = float(item.get("unit_price", 0) or 0)
                total_price = qty * unit_price
                total_amount += total_price
                conn.execute("""
                    INSERT INTO purchase_request_items
                    (pr_id, item_name, description, qty, unit, unit_price, total_price)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    pr_id,
                    item.get("item_name"),
                    item.get("description"),
                    qty,
                    item.get("unit"),
                    unit_price,
                    total_price,
                ))

            if items and not data.get("total_amount"):
                conn.execute("UPDATE purchase_requests SET total_amount = ? WHERE id = ?", (total_amount, pr_id))

            conn.commit()
            return jsonify({"success": True, "message": "สร้าง PR สำเร็จ", "pr_id": pr_id})

        rows = conn.execute("""
            SELECT pr.*, p.project_code, p.project_name
            FROM purchase_requests pr
            LEFT JOIN projects p ON pr.project_id = p.id
            ORDER BY pr.id DESC
        """).fetchall()
        return jsonify(rows_to_dict(rows))
    except sqlite3.IntegrityError as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"เลข PR ซ้ำหรือข้อมูลไม่ถูกต้อง: {e}"}), 400
    finally:
        conn.close()


@app.route("/api/purchase-requests/<int:pr_id>", methods=["GET"])
def api_purchase_request_detail(pr_id):
    conn = get_db()
    try:
        pr = conn.execute("""
            SELECT pr.*, p.project_code, p.project_name
            FROM purchase_requests pr
            LEFT JOIN projects p ON pr.project_id = p.id
            WHERE pr.id = ?
        """, (pr_id,)).fetchone()
        if not pr:
            return jsonify({"success": False, "message": "ไม่พบ PR"}), 404

        items = conn.execute("""
            SELECT * FROM purchase_request_items
            WHERE pr_id = ?
            ORDER BY id ASC
        """, (pr_id,)).fetchall()
        return jsonify({"success": True, "pr": dict(pr), "items": rows_to_dict(items)})
    finally:
        conn.close()


# ==============================
# PURCHASE ORDER API
# ==============================
@app.route("/api/purchase-orders", methods=["GET", "POST"])
def api_purchase_orders():
    conn = get_db()
    try:
        if request.method == "POST":
            data = get_json()
            cursor = conn.execute("""
                INSERT INTO purchase_orders
                (po_no, pr_id, vendor_id, total_amount, status, payment_status, due_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get("po_no"),
                data.get("pr_id"),
                data.get("vendor_id"),
                data.get("total_amount", 0),
                data.get("status", "Draft"),
                data.get("payment_status", "Unpaid"),
                data.get("due_date"),
                now_text(),
            ))
            conn.commit()
            return jsonify({"success": True, "message": "สร้าง PO สำเร็จ", "po_id": cursor.lastrowid})

        rows = conn.execute("""
            SELECT po.*, pr.pr_no, v.vendor_code, v.company_name
            FROM purchase_orders po
            LEFT JOIN purchase_requests pr ON po.pr_id = pr.id
            LEFT JOIN vendors v ON po.vendor_id = v.id
            ORDER BY po.id DESC
        """).fetchall()
        return jsonify(rows_to_dict(rows))
    except sqlite3.IntegrityError as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"เลข PO ซ้ำหรือข้อมูลไม่ถูกต้อง: {e}"}), 400
    finally:
        conn.close()


# ==============================
# PURCHASE ORDER — APPROVE / STATUS
# ==============================
@app.route("/api/purchase-orders/<int:po_id>", methods=["PATCH"])
def api_update_po(po_id):
    data = get_json()
    action = data.get("action")
    conn = get_db()
    try:
        if action == "approve":
            conn.execute("""
                UPDATE purchase_orders
                SET status = 'Confirmed', approved_by = ?, approved_at = ?, updated_at = ?
                WHERE id = ?
            """, (data.get("approved_by", "admin"), now_text(), now_text(), po_id))
            conn.execute("""
                INSERT INTO approval_logs (doc_type, doc_id, action, action_by, note, created_at)
                VALUES ('PO', ?, 'Approved', ?, ?, ?)
            """, (po_id, data.get("approved_by", "admin"), data.get("note", ""), now_text()))
        elif action == "reject":
            conn.execute("""
                UPDATE purchase_orders
                SET status = 'Cancelled', updated_at = ?
                WHERE id = ?
            """, (now_text(), po_id))
            conn.execute("""
                INSERT INTO approval_logs (doc_type, doc_id, action, action_by, note, created_at)
                VALUES ('PO', ?, 'Rejected', ?, ?, ?)
            """, (po_id, data.get("approved_by", "admin"), data.get("note", ""), now_text()))
        else:
            return jsonify({"success": False, "message": "action ไม่ถูกต้อง"}), 400
        conn.commit()
        return jsonify({"success": True, "message": "อัปเดตสถานะ PO สำเร็จ"})
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 400
    finally:
        conn.close()


# ==============================
# GRN API
# ==============================
@app.route("/api/grn", methods=["GET", "POST"])
def api_grn():
    conn = get_db()
    try:
        if request.method == "POST":
            data = get_json()
            cursor = conn.execute("""
                INSERT INTO grn
                (grn_no, po_id, received_by, received_date, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                data.get("grn_no"),
                data.get("po_id"),
                data.get("received_by"),
                data.get("received_date"),
                data.get("status", "Received"),
                now_text(),
            ))
            conn.commit()
            return jsonify({"success": True, "message": "บันทึกรับสินค้าสำเร็จ", "grn_id": cursor.lastrowid})

        rows = conn.execute("""
            SELECT g.*, po.po_no
            FROM grn g
            LEFT JOIN purchase_orders po ON g.po_id = po.id
            ORDER BY g.id DESC
        """).fetchall()
        return jsonify(rows_to_dict(rows))
    except sqlite3.IntegrityError as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"เลข GRN ซ้ำหรือข้อมูลไม่ถูกต้อง: {e}"}), 400
    finally:
        conn.close()


# ==============================
# USERS API
# ==============================
@app.route("/api/users", methods=["GET", "POST"])
def api_users():
    conn = get_db()
    try:
        if request.method == "POST":
            data = get_json()
            password_hash = generate_password_hash(data.get("password") or "123456")
            conn.execute("""
                INSERT INTO users
                (full_name, username, password_hash, role, department, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get("full_name"),
                data.get("username"),
                password_hash,
                data.get("role", "User"),
                data.get("department"),
                data.get("status", "Active"),
                now_text(),
            ))
            conn.commit()
            return jsonify({"success": True, "message": "เพิ่มผู้ใช้งานสำเร็จ"})

        rows = conn.execute("""
            SELECT id, full_name, username, role, department, status, created_at
            FROM users
            ORDER BY id DESC
        """).fetchall()
        return jsonify(rows_to_dict(rows))
    except sqlite3.IntegrityError as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"username ซ้ำหรือข้อมูลไม่ถูกต้อง: {e}"}), 400
    finally:
        conn.close()


# ==============================
# LOGIN API
# ==============================
@app.route("/api/login", methods=["POST"])
def api_login():
    data = get_json()
    username = data.get("username")
    password = data.get("password")

    conn = get_db()
    try:
        user = conn.execute("""
            SELECT * FROM users
            WHERE username = ? AND status = 'Active'
        """, (username,)).fetchone()
        if not user:
            return jsonify({"success": False, "message": "ไม่พบผู้ใช้งาน"}), 401

        password_hash = user["password_hash"] if "password_hash" in user.keys() else None
        if not password_hash or not check_password_hash(password_hash, password):
            return jsonify({"success": False, "message": "รหัสผ่านไม่ถูกต้อง"}), 401

        return jsonify({
            "success": True,
            "message": "เข้าสู่ระบบสำเร็จ",
            "user": {
                "id": user["id"],
                "full_name": user["full_name"],
                "username": user["username"],
                "role": user["role"],
                "department": user["department"],
            }
        })
    finally:
        conn.close()


# ==============================
# ERROR HANDLERS
# ==============================
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "message": "ไม่พบ URL นี้ในระบบ",
        "hint": "ลองเปิด /health หรือ /api/health เพื่อตรวจสอบว่า server ทำงานอยู่",
    }), 404


# ==============================
# RUN APP
# ==============================
if __name__ == "__main__":
    init_db()
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    port = int(os.environ.get("PORT", 5000))
    print("\n PRO System is running")
    print(f"   Local:   http://127.0.0.1:{port}")
    print(f"   Health:  http://127.0.0.1:{port}/api/health")
    print( "   Login:   admin / admin123\n")
    app.run(debug=debug, host="0.0.0.0", port=port)
