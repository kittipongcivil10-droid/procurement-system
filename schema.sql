-- ==========================================
-- Projects
-- ==========================================
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_code TEXT UNIQUE,
    project_name TEXT NOT NULL,
    location TEXT,
    owner_name TEXT,
    budget REAL DEFAULT 0,
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Inactive','Completed','Cancelled')),
    start_date TEXT,
    end_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ==========================================
-- Vendors
-- ==========================================
CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_code TEXT UNIQUE,
    company_name TEXT NOT NULL,
    tax_id TEXT,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    payment_terms TEXT DEFAULT 'Net30',
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Inactive','Blacklisted')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ==========================================
-- Purchase Requests
-- ==========================================
CREATE TABLE IF NOT EXISTS purchase_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pr_no TEXT UNIQUE,
    title TEXT NOT NULL,
    project_id INTEGER,
    requester TEXT,
    department TEXT,
    total_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected','Cancelled')),
    approved_by TEXT,
    approved_at TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- ==========================================
-- Purchase Request Items
-- ==========================================
CREATE TABLE IF NOT EXISTS purchase_request_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pr_id INTEGER NOT NULL,
    item_name TEXT,
    description TEXT,
    qty REAL DEFAULT 0,
    unit TEXT,
    unit_price REAL DEFAULT 0,
    total_price REAL DEFAULT 0,
    FOREIGN KEY (pr_id) REFERENCES purchase_requests(id)
);

-- ==========================================
-- Purchase Orders
-- ==========================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_no TEXT UNIQUE,
    pr_id INTEGER,
    vendor_id INTEGER,
    total_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'Draft' CHECK(status IN ('Draft','Sent','Confirmed','Cancelled')),
    payment_status TEXT DEFAULT 'Unpaid' CHECK(payment_status IN ('Unpaid','Partial','Paid')),
    approved_by TEXT,
    approved_at TEXT,
    due_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pr_id) REFERENCES purchase_requests(id),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

-- ==========================================
-- Purchase Order Items
-- ==========================================
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

-- ==========================================
-- Goods Receipt Notes (GRN)
-- ==========================================
CREATE TABLE IF NOT EXISTS grn (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grn_no TEXT UNIQUE,
    po_id INTEGER,
    received_by TEXT,
    received_date TEXT,
    status TEXT DEFAULT 'Received' CHECK(status IN ('Received','Partial','Rejected')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
);

-- ==========================================
-- GRN Items
-- ==========================================
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

-- ==========================================
-- Payments
-- ==========================================
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_no TEXT UNIQUE,
    po_id INTEGER NOT NULL,
    amount REAL DEFAULT 0,
    payment_date TEXT,
    payment_method TEXT CHECK(payment_method IN ('Transfer','Cheque','Cash','Other')),
    reference_no TEXT,
    paid_by TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
);

-- ==========================================
-- Approval Logs
-- ==========================================
CREATE TABLE IF NOT EXISTS approval_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_type TEXT NOT NULL CHECK(document_type IN ('PR','PO')),
    document_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('Approved','Rejected','Cancelled','Revised')),
    actor TEXT NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ==========================================
-- Users
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT CHECK(role IN ('Admin','Manager','Purchaser','Viewer')),
    department TEXT,
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
    last_login TEXT,
    login_attempts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ==========================================
-- Indexes
-- ==========================================
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
CREATE INDEX IF NOT EXISTS idx_approval_logs_doc ON approval_logs(document_type, document_id);
