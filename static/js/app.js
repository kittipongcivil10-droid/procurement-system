// ─── Navigation ───
const sectionNames = {
    dashboard:'Dashboard', pr:'Purchase Request', po:'Purchase Order',
    compare:'เปรียบเทียบราคา',
    grn:'รับสินค้า',
    projects:'โครงการ', budget:'งบประมาณ', vendors:'ผู้ขาย',
    departments:'จัดการแผนก', users:'ผู้ใช้งาน',
    reports:'รายงาน', settings:'ตั้งค่า'
};

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        go(this.dataset.section);
    });
});

function go(section) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const nav = document.querySelector(`[data-section="${section}"]`);
    if (nav) nav.classList.add('active');
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(section);
    if (el) el.classList.add('active');
    document.getElementById('topbarTitle').textContent = sectionNames[section] || 'Dashboard';
    window.scrollTo({top:0, behavior:'smooth'});
}

// ─── Modal ───
function setupModalBackdropClose() {
    document.querySelectorAll('.modal-overlay').forEach(m => {
        if (m.dataset.backdropReady === '1') return;
        m.dataset.backdropReady = '1';
        m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
    });
}
function openModal(id) {
    setupModalBackdropClose();
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('active');
    if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
}
setupModalBackdropClose();
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
});

// ─── Toast ───
function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2500);
}

// ─── PR Items ───
let prRowCount = 1;
function addPRRow() {
    prRowCount++;
    const tbody = document.getElementById('prItemsBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${prRowCount}</td><td><input type="text" placeholder="ระบุรายการ..." class="item-desc"></td><td><input type="number" value="1" min="1" class="item-qty" onchange="calcPR(this)"></td><td><input type="text" placeholder="ชิ้น" class="item-unit"></td><td><input type="number" value="0" min="0" step="0.01" class="item-price" onchange="calcPR(this)"></td><td><input type="number" value="0" readonly class="item-total"></td><td><button type="button" class="btn-rm-row" onclick="rmRow(this,'prItemsBody','pr')">×</button></td>`;
    tbody.appendChild(tr);
}
function calcPR(el) {
    const row = el.closest('tr');
    const q = parseFloat(row.querySelector('.item-qty').value)||0;
    const p = parseFloat(row.querySelector('.item-price').value)||0;
    row.querySelector('.item-total').value = (q*p).toFixed(2);
    let total = 0;
    document.querySelectorAll('#prItemsBody .item-total').forEach(i => total += parseFloat(i.value)||0);
    document.getElementById('prGrandTotal').textContent = '฿'+total.toLocaleString('th-TH',{minimumFractionDigits:2});
}
// ─── CRUD State ───
let editingPRNum = null; // null = create mode, 'PR-xxx' = edit mode

function openPRModal(prNum) {
    const f = document.getElementById('prForm');
    f.reset();
    prAttachedFiles = [];
    renderPRFilePreview();
    editingPRNum = prNum || null;
    
    const modalTitle = document.querySelector('#prModal .modal-top h3');
    const submitBtn = document.querySelector('#prModal .modal-footer .btn-primary');
    
    if (prNum && prDB[prNum]) {
        // EDIT mode — pre-fill form
        const pr = prDB[prNum];
        modalTitle.textContent = `✏️ แก้ไข ${prNum}`;
        submitBtn.textContent = '💾 บันทึกการแก้ไข';
        
        f.elements['title'].value = pr.title || '';
        f.elements['department'].value = pr.department || '';
        f.elements['requester'].value = pr.requester || '';
        f.elements['reason'].value = pr.reason || '';
        
        // Priority mapping
        const priMap = {'สูง':'high','ปานกลาง':'medium','ต่ำ':'low'};
        f.elements['priority'].value = priMap[pr.priority] || pr.priority || '';
        populateProjectDropdowns();
        if (f.elements['project_id']) f.elements['project_id'].value = pr.projectId || '';
        onPRProjectSelect();
        
        // Fill items
        const tbody = document.getElementById('prItemsBody');
        tbody.innerHTML = '';
        pr.items.forEach((it, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${i+1}</td>
                <td><input type="text" value="${it.desc}" class="item-desc"></td>
                <td><input type="number" value="${it.qty}" min="1" class="item-qty" onchange="calcPR(this)"></td>
                <td><input type="text" value="${it.unit}" class="item-unit"></td>
                <td><input type="number" value="${it.price}" min="0" step="0.01" class="item-price" onchange="calcPR(this)"></td>
                <td><input type="number" value="${it.total}" readonly class="item-total"></td>
                <td>${i>0?'<button type="button" class="btn-rm-row" onclick="rmRow(this,\'prItemsBody\',\'pr\')">×</button>':''}</td>`;
            tbody.appendChild(tr);
        });
        prRowCount = pr.items.length;
        document.getElementById('prGrandTotal').textContent = '฿' + pr.total.toLocaleString('th-TH',{minimumFractionDigits:2});
    } else {
        // CREATE mode
        modalTitle.textContent = '📝 สร้าง Purchase Request';
        submitBtn.textContent = '💾 บันทึก PR';
        editingPRNum = null;
        // Auto-fill current user info
        if (currentUser) {
            f.elements['requester'].value = currentUser.name;
            f.elements['department'].value = currentUser.dept;
        }
        populateProjectDropdowns();
        document.getElementById('prProjectBudgetInfo').style.display = 'none';
        document.getElementById('prItemsBody').innerHTML = `<tr><td>1</td><td><input type="text" placeholder="ระบุรายการ..." class="item-desc"></td><td><input type="number" value="1" min="1" class="item-qty" onchange="calcPR(this)"></td><td><input type="text" placeholder="ชิ้น" class="item-unit"></td><td><input type="number" value="0" min="0" step="0.01" class="item-price" onchange="calcPR(this)"></td><td><input type="number" value="0" readonly class="item-total"></td><td></td></tr>`;
        prRowCount = 1;
        document.getElementById('prGrandTotal').textContent = '฿0.00';
    }
    openModal('prModal');
}

function collectPRFormData() {
    const f = document.getElementById('prForm');
    const priMap = {'high':'สูง','medium':'ปานกลาง','low':'ต่ำ'};
    const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const now = new Date();
    const dateStr = `${now.getDate()} ${thMonths[now.getMonth()]} ${String(now.getFullYear()+543).slice(-2)}`;
    
    // Collect items from table
    const items = [];
    let total = 0;
    document.querySelectorAll('#prItemsBody tr').forEach(row => {
        const desc = row.querySelector('.item-desc')?.value?.trim();
        const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
        const unit = row.querySelector('.item-unit')?.value?.trim() || 'ชิ้น';
        const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
        const itemTotal = qty * price;
        if (desc && qty > 0) {
            items.push({ desc, qty, unit, price, total: itemTotal });
            total += itemTotal;
        }
    });
    
    const reqDate = f.elements['required_date']?.value;
    let reqDateTh = dateStr;
    if (reqDate) {
        const rd = new Date(reqDate);
        reqDateTh = `${rd.getDate()} ${thMonths[rd.getMonth()]} ${String(rd.getFullYear()+543).slice(-2)}`;
    }
    
    return {
        title: f.elements['title'].value,
        requester: f.elements['requester'].value,
        department: f.elements['department'].value,
        created: dateStr,
        required: reqDateTh,
        priority: priMap[f.elements['priority'].value] || f.elements['priority'].value || 'ปานกลาง',
        projectId: f.elements['project_id']?.value || '',
        budgetType: projectDB[f.elements['project_id']?.value]?.name || 'ไม่ระบุโครงการ',
        reason: f.elements['reason'].value,
        items,
        total,
        attachments: prAttachedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }))
    };
}

function submitPR() {
    const f = document.getElementById('prForm');
    if (!f.checkValidity()) { f.reportValidity(); return; }
    
    const data = collectPRFormData();
    if (data.items.length === 0) return toast('⚠️ กรุณาเพิ่มรายการอย่างน้อย 1 รายการ');
    
    if (editingPRNum && prDB[editingPRNum]) {
        // EDIT — update existing
        const pr = prDB[editingPRNum];
        Object.assign(pr, data);
        pr.created = pr.created; // keep original date
        toast(`✅ แก้ไข ${editingPRNum} สำเร็จ!`);
        savePRToGoogleSheets({ number: editingPRNum, ...pr });
    } else {
        // CREATE — new PR
        const now = new Date();
        const num = `PR-${String(now.getFullYear()).slice(-2)}${String(now.getMonth()+1).padStart(2,'0')}-${String(Math.floor(Math.random()*900)+100)}`;
        prDB[num] = {
            ...data,
            createdBy: currentUser ? currentUser.name : 'ระบบ',
            approvals: APPROVAL_CHAIN.map((_, i) => ({ status: i===0?'current':'waiting', date:null, note:null }))
        };
        toast(`✅ สร้าง ${num} สำเร็จ! (${prAttachedFiles.length} ไฟล์แนบ)`);
        savePRToGoogleSheets({ number: num, ...prDB[num] });
        if (prAttachedFiles.length > 0) uploadFilesToGoogleDrive(prAttachedFiles, num);
    }
    
    closeModal('prModal');
    editingPRNum = null;
    prAttachedFiles = [];
    renderPRTable();
    renderDashPR();
    if (typeof renderExportTables === 'function') renderExportTables();
}

function deletePR(prNum) {
    if (!confirm(`⚠️ ยืนยันลบ ${prNum}?\nการลบจะไม่สามารถกู้คืนได้`)) return;
    delete prDB[prNum];
    toast(`🗑️ ลบ ${prNum} สำเร็จ`);
    renderPRTable();
    renderDashPR();
    if (typeof renderExportTables === 'function') renderExportTables();
}

function canEditPR(prNum) {
    const pr = prDB[prNum];
    if (!pr) return false;
    // Can edit only if first approval step hasn't been completed yet (still current or all waiting)
    const firstDone = pr.approvals.findIndex(a => a.status === 'done');
    return firstDone === -1; // no one approved yet
}

// ─── PO Items ───
let poRowCount = 1;
function addPORow() {
    poRowCount++;
    const tbody = document.getElementById('poItemsBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${poRowCount}</td><td><input type="text" placeholder="ระบุรายการ..." class="item-desc"></td><td><input type="number" value="1" min="1" class="item-qty" onchange="calcPO(this)"></td><td><input type="text" placeholder="ชิ้น" class="item-unit"></td><td><input type="number" value="0" min="0" step="0.01" class="item-price" onchange="calcPO(this)"></td><td><input type="number" value="0" min="0" max="100" class="item-disc" onchange="calcPO(this)"></td><td><input type="number" value="0" readonly class="item-total"></td><td><button type="button" class="btn-rm-row" onclick="rmRow(this,'poItemsBody','po')">×</button></td>`;
    tbody.appendChild(tr);
}
function calcPO(el) {
    const row = el.closest('tr');
    const q = parseFloat(row.querySelector('.item-qty').value)||0;
    const p = parseFloat(row.querySelector('.item-price').value)||0;
    const d = parseFloat(row.querySelector('.item-disc').value)||0;
    const sub = q*p;
    row.querySelector('.item-total').value = (sub - sub*d/100).toFixed(2);
    let total = 0;
    document.querySelectorAll('#poItemsBody .item-total').forEach(i => total += parseFloat(i.value)||0);
    const vat = total * 0.07;
    const fmt = n => '฿'+n.toLocaleString('th-TH',{minimumFractionDigits:2});
    document.getElementById('poSub').textContent = fmt(total);
    document.getElementById('poVat').textContent = fmt(vat);
    document.getElementById('poTotal').textContent = fmt(total+vat);
}
function submitPO() {} // legacy stub

// ─── Vendor data + catalog (ราคาวัสดุแต่ละร้าน) ───
const vendors = {};

// ─── Vendor Catalog: keyword → price per vendor ───
// ค้นหาจาก keyword ในชื่อรายการ → ดึงราคาอัตโนมัติ
const vendorCatalog = {};

// ─── Auto-match item desc to vendor catalog price ───
function findCatalogPrice(vendorId, itemDesc) {
    const catalog = vendorCatalog[vendorId];
    if (!catalog) return null;
    const desc = itemDesc.toLowerCase().trim();
    // Try exact match first, then partial
    for (const [keyword, price] of Object.entries(catalog)) {
        if (desc.includes(keyword.toLowerCase())) return price;
    }
    return null;
}
function loadVendor(sel) {
    const v = vendors[sel.value];
    document.getElementById('vTax').value = v ? v.tax : '';
    document.getElementById('vContact').value = v ? v.contact : '';
    document.getElementById('vPhone').value = v ? v.phone : '';
}
function rmRow(btn, tbodyId, type) {
    btn.closest('tr').remove();
    const rows = document.querySelectorAll(`#${tbodyId} tr`);
    rows.forEach((r,i) => { const td = r.querySelector('td'); if(td) td.textContent = i+1; });
    if (type === 'pr' && rows.length > 0) { const q = rows[0].querySelector('.item-qty'); if(q) calcPR(q); }
    if (type === 'po' && rows.length > 0) { const q = rows[0].querySelector('.item-qty'); if(q) calcPO(q); }
    if (type === 'pr') prRowCount = rows.length;
    if (type === 'po') poRowCount = rows.length;
}

// ═══════════════════════════════════════
// ─── PO DATABASE ───
// ═══════════════════════════════════════
const poDatabase = {};

// ═══════════════════════════════════════
// ─── PO CREATION FROM APPROVED PR ───
// ─── (แยกออก PO ตามร้านค้า)
// ═══════════════════════════════════════
let selectedPRForPO = null;

function getApprovedPRs() {
    const result = [];
    for (const [num, pr] of Object.entries(prDB)) {
        const approvals = pr.approvals || [];
        const isApproved = approvals.length ? approvals.every(a => a.status === 'done') : (pr.status === 'Approved' || pr.statusCls === 'approved');
        if (!isApproved) continue;
        const usedItems = [];
        for (const po of Object.values(poDatabase)) {
            if (po.prRef === num && po.items) po.items.forEach(it => usedItems.push(it.desc));
        }
        const remainItems = (pr.items || []).filter(it => !usedItems.includes(it.desc));
        if (remainItems.length > 0) result.push({ num, ...pr, remainItems });
    }
    return result;
}

function openCreatePO() {
    selectedPRForPO = null;
    document.getElementById('poStep2').style.display = 'none';
    document.getElementById('poSubmitBtn').disabled = true;
    
    const approved = getApprovedPRs();
    const listEl = document.getElementById('approvedPRList');
    const noMsg = document.getElementById('noPRMsg');
    
    if (approved.length === 0) {
        listEl.innerHTML = '';
        noMsg.style.display = 'block';
    } else {
        noMsg.style.display = 'none';
        listEl.innerHTML = approved.map(pr => `
            <div onclick="selectPRForPO('${pr.num}')" style="border:2px solid var(--border);border-radius:var(--radius-sm);padding:14px 18px;margin-bottom:10px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:space-between;" 
                 onmouseover="this.style.borderColor='var(--accent)';this.style.background='var(--accent-light)'" 
                 onmouseout="if(!this.classList.contains('selected')){this.style.borderColor='var(--border)';this.style.background=''}" 
                 id="prCard_${pr.num}">
                <div>
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                        <span style="font-family:var(--font-mono);font-weight:700;color:var(--accent);font-size:14px;">${pr.num}</span>
                        <span class="badge approved" style="font-size:10px;">อนุมัติครบ 3/3</span>
                        ${pr.remainItems.length < pr.items.length ? `<span class="badge pending" style="font-size:10px;">ออก PO แล้วบางส่วน</span>` : ''}
                    </div>
                    <div style="font-weight:600;font-size:14px;">${pr.title}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">ผู้ขอ: ${pr.requester} | แผนก: ${pr.department} | เหลือ ${pr.remainItems.length}/${pr.items.length} รายการ</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-family:var(--font-mono);font-weight:800;font-size:16px;color:var(--accent);">฿${pr.remainItems.reduce((s,it)=>s+it.total,0).toLocaleString()}</div>
                    <div style="font-size:11px;color:var(--text-muted);">มูลค่าคงเหลือ</div>
                </div>
            </div>
        `).join('');
    }
    
    if (document.getElementById('poDeliveryDate')) document.getElementById('poDeliveryDate').value = '';
    openModal('poModal');
}

function selectPRForPO(prNum) {
    selectedPRForPO = prNum;
    const approved = getApprovedPRs();
    const prData = approved.find(p => p.num === prNum);
    if (!prData) return;
    
    // Highlight selected card
    document.querySelectorAll('[id^="prCard_"]').forEach(el => {
        el.classList.remove('selected');
        el.style.borderColor = 'var(--border)';
        el.style.background = '';
    });
    const card = document.getElementById('prCard_' + prNum);
    if (card) {
        card.classList.add('selected');
        card.style.borderColor = 'var(--accent)';
        card.style.background = 'var(--accent-light)';
    }
    
    // Show step 2
    document.getElementById('poStep2').style.display = 'block';
    document.getElementById('poSelectedPR').textContent = prNum + ' — ' + prData.title;
    
    // Build vendor options HTML
    const vendorOpts = Object.entries(vendors).map(([id,v]) => `<option value="${id}">${v.name}</option>`).join('');

    // Build items with vendor dropdown per row
    let html = `<div class="items-wrap"><table>
        <thead><tr>
            <th style="width:30px;"><input type="checkbox" checked onchange="toggleAllItems(this)" title="เลือก/ยกเลิกทั้งหมด"></th>
            <th style="width:30px;">#</th>
            <th>รายการ</th>
            <th style="width:55px;">จำนวน</th>
            <th style="width:45px;">หน่วย</th>
            <th style="width:85px;">ราคา/หน่วย</th>
            <th style="width:85px;">รวม</th>
            <th style="width:180px;">ผู้ขาย / ร้านค้า</th>
        </tr></thead><tbody>`;
    prData.remainItems.forEach((it, i) => {
        html += `<tr style="background:${i%2===0?'#fff':'#fafbfc'};" class="po-item-row">
            <td style="text-align:center;"><input type="checkbox" checked class="po-item-check" data-idx="${i}" onchange="updateVendorSummary()"></td>
            <td style="text-align:center;font-size:12px;">${i+1}</td>
            <td style="font-size:13px;">${it.desc}</td>
            <td style="text-align:center;font-size:13px;">${it.qty}</td>
            <td style="text-align:center;font-size:13px;">${it.unit}</td>
            <td style="text-align:right;font-family:var(--font-mono);font-size:13px;">฿${it.price.toLocaleString()}</td>
            <td style="text-align:right;font-family:var(--font-mono);font-weight:600;font-size:13px;">฿${it.total.toLocaleString()}</td>
            <td><select class="po-item-vendor" data-idx="${i}" onchange="updateVendorSummary()" style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:var(--font-th);font-size:12px;">
                <option value="">-- ยังไม่ระบุผู้ขาย --</option>
                ${vendorOpts}
            </select></td>
        </tr>`;
    });
    html += `</tbody></table></div>`;
    
    document.getElementById('poItemAssignArea').innerHTML = html;
    document.getElementById('poVendorSummarySection').style.display = 'none';
    
    document.getElementById('poStep2').scrollIntoView({behavior:'smooth', block:'start'});
    updateVendorSummary();
}

function toggleAllItems(masterCb) {
    document.querySelectorAll('.po-item-check').forEach(cb => { cb.checked = masterCb.checked; });
    updateVendorSummary();
}

function updateVendorSummary() {
    const prData = getApprovedPRs().find(p => p.num === selectedPRForPO);
    if (!prData) return;
    const groups = {};
    let anyChecked = false;
    document.querySelectorAll('.po-item-row').forEach(row => {
        const cb = row.querySelector('.po-item-check');
        const sel = row.querySelector('.po-item-vendor');
        const idx = parseInt(cb.dataset.idx);
        if (!cb.checked) return;
        anyChecked = true;
        const vId = sel.value || '__NO_VENDOR__';
        if (!groups[vId]) groups[vId] = { items: [], total: 0 };
        groups[vId].items.push(prData.remainItems[idx]);
        groups[vId].total += prData.remainItems[idx].total;
    });
    const summaryEl = document.getElementById('poVendorSummary');
    const summarySection = document.getElementById('poVendorSummarySection');
    if (!anyChecked) {
        summarySection.style.display = 'none';
        document.getElementById('poSubmitBtn').disabled = true;
        document.getElementById('poSubmitBtn').textContent = '💾 สร้าง PO';
        return;
    }
    summarySection.style.display = 'block';
    const vendorCount = Object.keys(groups).length;
    let html = '';
    let poIdx = 1;
    for (const [vId, group] of Object.entries(groups)) {
        const isNoVendor = vId === '__NO_VENDOR__';
        const v = isNoVendor ? { name: 'ยังไม่ระบุผู้ขาย', tax: '-', contact: '-', phone: '-' } : vendors[vId];
        html += `<div style="border:2px solid ${isNoVendor ? 'var(--warning)' : 'var(--success)'};border-radius:var(--radius-sm);padding:14px 18px;margin-bottom:12px;background:${isNoVendor ? 'var(--warning-bg)' : 'var(--success-bg)'};">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><div>
                <span style="font-weight:700;color:${isNoVendor ? 'var(--warning)' : 'var(--success)'};font-size:13px;">PO #${poIdx}</span>
                <span style="font-weight:700;font-size:14px;margin-left:8px;">${v.name}</span>
                <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">${v.tax || '-'}</span>
            </div><div style="font-family:var(--font-mono);font-weight:800;font-size:16px;color:var(--accent);">฿${group.total.toLocaleString()}</div></div>
            <div style="font-size:12px;color:var(--text-secondary);">${group.items.map((it,i) => `<div style="padding:2px 0;">${i+1}. ${it.desc} — ${it.qty} ${it.unit} × ฿${it.price.toLocaleString()} = <strong>฿${it.total.toLocaleString()}</strong></div>`).join('')}</div>
            <div style="margin-top:6px;font-size:11px;color:var(--text-muted);">ผู้ติดต่อ: ${v.contact || '-'} | โทร: ${v.phone || '-'}</div>
        </div>`;
        poIdx++;
    }
    const grandTotal = Object.values(groups).reduce((s,g) => s+g.total, 0);
    html += `<div style="text-align:right;font-size:13px;padding:8px 0;border-top:2px solid var(--border);"><span style="color:var(--text-muted);">จะสร้าง <strong style="color:var(--accent);">${vendorCount} PO</strong> | มูลค่ารวม</span><span style="font-family:var(--font-mono);font-weight:800;font-size:16px;color:var(--accent);margin-left:8px;">฿${grandTotal.toLocaleString()}</span></div>`;
    summaryEl.innerHTML = html;
    document.getElementById('poSubmitBtn').disabled = false;
    document.getElementById('poSubmitBtn').textContent = `💾 สร้าง ${vendorCount} PO`;
}

function checkPOReady() { updateVendorSummary(); }

function submitNewPO() {
    if (!selectedPRForPO) return toast('⚠️ กรุณาเลือก PR');
    const deliveryDate = document.getElementById('poDeliveryDate').value;
    if (!deliveryDate) return toast('⚠️ กรุณาระบุกำหนดส่งมอบ');
    
    const prData = getApprovedPRs().find(p => p.num === selectedPRForPO);
    if (!prData) return;
    
    // Group checked items by vendor
    const groups = {};
    document.querySelectorAll('.po-item-row').forEach(row => {
        const cb = row.querySelector('.po-item-check');
        const sel = row.querySelector('.po-item-vendor');
        const idx = parseInt(cb.dataset.idx);
        if (cb.checked) {
            const vId = sel.value || '__NO_VENDOR__';
            if (!groups[vId]) groups[vId] = [];
            groups[vId].push(prData.remainItems[idx]);
        }
    });
    
    if (Object.keys(groups).length === 0) return toast('⚠️ กรุณาเลือกรายการอย่างน้อย 1 รายการ');
    
    const now = new Date();
    const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const dateStr = `${now.getDate()} ${thMonths[now.getMonth()]} ${String(now.getFullYear()+543).slice(-2)}`;
    const dd = new Date(deliveryDate);
    const ddStr = `${dd.getDate()} ${thMonths[dd.getMonth()]} ${String(dd.getFullYear()+543).slice(-2)}`;
    
    const createdPOs = [];
    
    for (const [vId, items] of Object.entries(groups)) {
        const isNoVendor = vId === '__NO_VENDOR__';
        const vendor = isNoVendor ? { name: 'ยังไม่ระบุผู้ขาย', tax: '-', addr: '-', contact: '-', phone: '-', email: '-' } : vendors[vId];
        const total = items.reduce((s,it) => s + it.total, 0);
        const poNum = `PO-${String(now.getFullYear()).slice(-2)}${String(now.getMonth()+1).padStart(2,'0')}-${String(Object.keys(poDatabase).length + 100)}`;
        
        poDatabase[poNum] = {
            prRef: selectedPRForPO,
            vendor: vendor.name,
            vendorTax: vendor.tax,
            vendorAddr: vendor.addr,
            vendorContact: vendor.contact,
            vendorPhone: vendor.phone,
            vendorEmail: vendor.email,
            date: dateStr,
            deliveryDate: ddStr,
            payTerms: document.getElementById('poPayTerms').value || 'เครดิต 30 วัน',
            deliveryLoc: document.getElementById('poDeliveryLoc').value || '-',
            total: total,
            statusText: 'รออนุมัติ',
            statusCls: 'pending',
            items: items.map(it => ({...it, disc:0})),
            approvals: [
                {status:'current'},{status:'waiting'},{status:'waiting'}
            ]
        };
        createdPOs.push({ poNum, vendor: vendor.name, total });
    }
    
    closeModal('poModal');
    renderPOTable();
    if (typeof renderExportTables === 'function') renderExportTables();
    
    // Sync POs to Google Sheets + auto-save PDF
    createdPOs.forEach(p => {
        const po = poDatabase[p.poNum];
        if (po) {
            savePOToGoogleSheets({ number: p.poNum, ...po });
            autoSavePOPdf(p.poNum);
        }
    });
    
    // Show result
    if (createdPOs.length === 1) {
        toast(`✅ สร้าง ${createdPOs[0].poNum} จาก ${selectedPRForPO} สำเร็จ!`);
    } else {
        toast(`✅ สร้าง ${createdPOs.length} PO จาก ${selectedPRForPO} สำเร็จ!`);
    }
    
    setTimeout(() => {
        go('po');
        const detail = createdPOs.map(p => `${p.poNum} → ${p.vendor} (฿${p.total.toLocaleString()})`).join('\n');
        alert(`✅ สร้าง PO สำเร็จ ${createdPOs.length} รายการ\nจาก ${selectedPRForPO}\n\n${detail}`);
    }, 500);
}

// ─── Render PO Table ───
function renderPOTable() {
    const tbody = document.getElementById('poTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const [num, po] of Object.entries(poDatabase)) {
        const canPay = po.statusCls === 'approved' || po.statusCls === 'completed' || po.statusText === 'อนุมัติแล้ว' || po.statusText === 'เสร็จสิ้น' || po.statusText === 'รอการชำระ';
        const paid = po.payment && po.payment.status === 'paid';
        const partialPaid = po.payment && po.payment.status === 'partial';
        
        let payBadge = '<span class="badge draft">ยังไม่จ่าย</span>';
        let payBtn = '';
        if (paid) {
            payBadge = `<span class="badge approved">จ่ายแล้ว ฿${po.payment.amount.toLocaleString()}</span>`;
            payBtn = `<button class="act-btn view" onclick="viewPaymentDetail('${num}')" style="font-size:11px;">🧾 ดูสลิป</button>`;
        } else if (partialPaid) {
            payBadge = `<span class="badge in-progress">จ่ายบางส่วน ฿${po.payment.amount.toLocaleString()}</span>`;
            payBtn = `<button class="act-btn edit" onclick="openPaymentModal('${num}')" style="font-size:11px;">💳 จ่ายเพิ่ม</button>`;
        } else if (canPay) {
            payBtn = `<button class="btn btn-primary" onclick="openPaymentModal('${num}')" style="padding:4px 12px;font-size:11px;">💳 จ่ายเงิน</button>`;
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="cell-id">${num}</td>
            <td class="cell-id">${po.prRef}</td>
            <td>${po.vendor}</td>
            <td class="cell-money">฿${po.total.toLocaleString()}</td>
            <td style="font-size:12px;">${po.deliveryDate}</td>
            <td><span class="badge ${po.statusCls}">${po.statusText}</span></td>
            <td style="text-align:center;">${payBadge}<div style="margin-top:4px;">${payBtn}</div></td>
            <td class="actions">
                <button class="act-btn view" onclick="viewPODetail('${num}')">ดู</button>
            </td>
        `;
        tbody.appendChild(tr);
    }
}

// ─── Payment Modal ───
function openPaymentModal(poNum) {
    const po = poDatabase[poNum];
    if (!po) return toast('❌ ไม่พบ PO');
    
    const vat = po.total * 0.07;
    const grand = po.total + vat;
    const alreadyPaid = po.payment ? po.payment.amount : 0;
    const remaining = grand - alreadyPaid;
    
    document.getElementById('prDetailTitle').textContent = `💳 จ่ายเงิน — ${poNum}`;
    document.getElementById('prDetailBody').innerHTML = `
        <div style="background:var(--accent-light);border:1.5px solid #c7d2fe;border-radius:var(--radius-sm);padding:18px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                <div>
                    <div style="font-weight:700;font-size:15px;color:var(--accent-dark);">${poNum}</div>
                    <div style="font-size:13px;color:var(--text-secondary);">${po.vendor}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">อ้างอิง: ${po.prRef} | เงื่อนไข: ${po.payTerms}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:11px;color:var(--text-muted);">ยอดสุทธิ (รวม VAT 7%)</div>
                    <div style="font-family:var(--font-mono);font-weight:800;font-size:22px;color:var(--accent);">฿${grand.toLocaleString('th-TH',{minimumFractionDigits:2})}</div>
                    ${alreadyPaid > 0 ? `<div style="font-size:12px;color:var(--success);margin-top:2px;">จ่ายแล้ว ฿${alreadyPaid.toLocaleString()} | คงเหลือ <strong>฿${remaining.toLocaleString('th-TH',{minimumFractionDigits:2})}</strong></div>` : ''}
                </div>
            </div>
        </div>

        <div class="form-section">
            <div class="form-section-title">💰 ข้อมูลการจ่ายเงิน</div>
            <div class="form-row" style="grid-template-columns:1fr 1fr;">
                <div class="form-group">
                    <label>จำนวนเงินที่จ่าย (บาท) <span class="req">*</span></label>
                    <input type="number" id="payAmount" value="${remaining.toFixed(2)}" min="0" step="0.01" style="font-size:16px;font-weight:700;font-family:var(--font-mono);">
                </div>
                <div class="form-group">
                    <label>ช่องทางการจ่ายเงิน <span class="req">*</span></label>
                    <select id="payMethod">
                        <option value="transfer">🏦 โอนเงิน (Bank Transfer)</option>
                        <option value="cheque">📝 เช็ค (Cheque)</option>
                        <option value="cash">💵 เงินสด (Cash)</option>
                        <option value="credit">💳 เครดิต (Credit Term)</option>
                    </select>
                </div>
            </div>
            <div class="form-row" style="grid-template-columns:1fr 1fr;">
                <div class="form-group">
                    <label>วันที่จ่าย <span class="req">*</span></label>
                    <input type="date" id="payDate" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label>เลขที่อ้างอิง / เลขเช็ค</label>
                    <input type="text" id="payRef" placeholder="เช่น TRF-20250217-001">
                </div>
            </div>
            <div class="form-row" style="grid-template-columns:1fr 1fr;">
                <div class="form-group">
                    <label>ธนาคาร</label>
                    <select id="payBank">
                        <option value="">-- เลือก --</option>
                        <option value="กรุงเทพ">ธ.กรุงเทพ (BBL)</option>
                        <option value="กสิกร">ธ.กสิกรไทย (KBANK)</option>
                        <option value="ไทยพาณิชย์">ธ.ไทยพาณิชย์ (SCB)</option>
                        <option value="กรุงไทย">ธ.กรุงไทย (KTB)</option>
                        <option value="กรุงศรี">ธ.กรุงศรี (BAY)</option>
                        <option value="ทหารไทยธนชาต">ธ.ทหารไทยธนชาต (TTB)</option>
                        <option value="อื่นๆ">อื่นๆ</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>ประเภทการจ่าย</label>
                    <select id="payType">
                        <option value="full">💯 จ่ายเต็มจำนวน</option>
                        <option value="partial">📊 จ่ายบางส่วน (มัดจำ/งวด)</option>
                        <option value="deposit">🔒 มัดจำ</option>
                        <option value="retention">📋 หัก Retention</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="form-section">
            <div class="form-section-title">🧾 แนบสลิปโอนเงิน / หลักฐานการจ่าย</div>
            <label class="file-drop" onclick="document.getElementById('paySlipInput').click()" style="padding:20px;">
                <input type="file" id="paySlipInput" accept=".jpg,.jpeg,.png,.pdf" onchange="previewPaySlip(this)" style="display:none;">
                <div class="file-drop-icon">🧾</div>
                <div class="file-drop-text"><strong>คลิกเพื่ออัปโหลดสลิป</strong><br><small>JPG, PNG, PDF (สูงสุด 5 MB)</small></div>
            </label>
            <div id="paySlipPreview" style="display:none;margin-top:12px;text-align:center;"></div>
        </div>

        <div class="form-section">
            <div class="form-section-title">📝 หมายเหตุ</div>
            <div class="form-group">
                <textarea id="payNotes" rows="2" placeholder="หมายเหตุเพิ่มเติม เช่น จ่ายงวดที่ 1, หักภาษี ณ ที่จ่าย 3%..."></textarea>
            </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:10px;">
            <button class="btn btn-success" style="flex:1;justify-content:center;padding:14px;font-size:15px;" onclick="submitPayment('${poNum}')">✅ บันทึกการจ่ายเงิน</button>
        </div>
    `;
    openModal('prDetailModal');
}

let paySlipData = null;

function previewPaySlip(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) return toast('⚠️ ไฟล์เกิน 5MB');
    const reader = new FileReader();
    reader.onload = function(e) {
        paySlipData = { name: file.name, type: file.type, data: e.target.result };
        const preview = document.getElementById('paySlipPreview');
        preview.style.display = 'block';
        if (file.type.startsWith('image/')) {
            preview.innerHTML = `<img src="${e.target.result}" style="max-width:300px;max-height:300px;border-radius:var(--radius-sm);border:2px solid var(--success);box-shadow:var(--shadow-md);">
            <div style="margin-top:8px;font-size:12px;color:var(--success);font-weight:600;">✅ ${file.name} (${(file.size/1024).toFixed(0)} KB)</div>
            <button class="btn btn-ghost" style="margin-top:6px;font-size:11px;padding:4px 12px;" onclick="paySlipData=null;document.getElementById('paySlipPreview').style.display='none';">🗑️ ลบ</button>`;
        } else {
            preview.innerHTML = `<div style="font-size:32px;">📄</div>
            <div style="font-size:12px;color:var(--success);font-weight:600;">✅ ${file.name} (${(file.size/1024).toFixed(0)} KB)</div>
            <button class="btn btn-ghost" style="margin-top:6px;font-size:11px;padding:4px 12px;" onclick="paySlipData=null;document.getElementById('paySlipPreview').style.display='none';">🗑️ ลบ</button>`;
        }
    };
    reader.readAsDataURL(file);
}

function submitPayment(poNum) {
    const po = poDatabase[poNum];
    if (!po) return;
    const amount = parseFloat(document.getElementById('payAmount')?.value) || 0;
    if (amount <= 0) return toast('⚠️ กรุณาระบุจำนวนเงิน');
    
    const now = new Date();
    const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const dateStr = `${now.getDate()} ${thMonths[now.getMonth()]} ${String(now.getFullYear()+543).slice(-2)}`;
    
    const grand = po.total * 1.07;
    const prevAmount = po.payment ? po.payment.amount : 0;
    const totalPaid = prevAmount + amount;
    const payType = document.getElementById('payType')?.value || 'full';
    const isFullPaid = totalPaid >= grand * 0.99; // allow tiny rounding diff

    // Build payment record
    const paymentRecord = {
        date: dateStr,
        inputDate: document.getElementById('payDate')?.value || '',
        method: document.getElementById('payMethod')?.value || 'transfer',
        bank: document.getElementById('payBank')?.value || '',
        ref: document.getElementById('payRef')?.value || '',
        type: payType,
        notes: document.getElementById('payNotes')?.value || '',
        slip: paySlipData ? { name: paySlipData.name, type: paySlipData.type, data: paySlipData.data } : null,
        by: currentUser ? currentUser.name : 'ระบบ'
    };

    // Save
    if (!po.payments) po.payments = [];
    po.payments.push({ ...paymentRecord, amount });
    po.payment = {
        status: isFullPaid ? 'paid' : 'partial',
        amount: totalPaid,
        lastDate: dateStr
    };
    
    // Update PO status
    if (isFullPaid) {
        po.statusText = 'จ่ายแล้ว';
        po.statusCls = 'completed';
    }
    
    paySlipData = null;
    closeModal('prDetailModal');
    renderPOTable();
    if (typeof renderExportTables === 'function') renderExportTables();
    toast(`✅ บันทึกจ่ายเงิน ${poNum} — ฿${amount.toLocaleString()} สำเร็จ!${isFullPaid?' — ชำระครบแล้ว':''}`);
}

function viewPaymentDetail(poNum) {
    const po = poDatabase[poNum];
    if (!po || !po.payments) return toast('❌ ไม่พบข้อมูลจ่ายเงิน');
    
    const grand = po.total * 1.07;
    const methodLabels = {transfer:'🏦 โอนเงิน',cheque:'📝 เช็ค',cash:'💵 เงินสด',credit:'💳 เครดิต'};
    
    document.getElementById('prDetailTitle').textContent = `🧾 ประวัติจ่ายเงิน — ${poNum}`;
    document.getElementById('prDetailBody').innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title">💰 สรุปการจ่ายเงิน</div>
            <div class="detail-grid">
                <div class="detail-item"><label>เลขที่ PO</label><div class="val cell-id">${poNum}</div></div>
                <div class="detail-item"><label>ผู้ขาย</label><div class="val">${po.vendor}</div></div>
                <div class="detail-item"><label>มูลค่า PO</label><div class="val cell-money">฿${po.total.toLocaleString()}</div></div>
                <div class="detail-item"><label>รวม VAT 7%</label><div class="val cell-money">฿${grand.toLocaleString('th-TH',{minimumFractionDigits:2})}</div></div>
                <div class="detail-item"><label>จ่ายแล้ว</label><div class="val cell-money" style="color:var(--success);font-size:18px;">฿${(po.payment?.amount||0).toLocaleString()}</div></div>
                <div class="detail-item"><label>คงเหลือ</label><div class="val cell-money" style="color:${(grand-(po.payment?.amount||0))>0?'var(--danger)':'var(--success)'};">฿${(grand-(po.payment?.amount||0)).toLocaleString('th-TH',{minimumFractionDigits:2})}</div></div>
            </div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">📋 รายการจ่ายเงิน (${po.payments.length} ครั้ง)</div>
            ${po.payments.map((p, i) => `
                <div style="border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:16px;margin-bottom:10px;${i===po.payments.length-1?'border-color:var(--success);background:var(--success-bg);':''}">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                        <div>
                            <span style="font-weight:700;color:var(--accent);">ครั้งที่ ${i+1}</span>
                            <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">${p.date}</span>
                            <span style="margin-left:8px;">${methodLabels[p.method]||p.method}</span>
                        </div>
                        <div style="font-family:var(--font-mono);font-weight:800;font-size:16px;color:var(--success);">฿${p.amount.toLocaleString()}</div>
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:6px;">
                        ${p.bank?'ธนาคาร: '+p.bank+' | ':''}${p.ref?'อ้างอิง: '+p.ref+' | ':''}ผู้บันทึก: ${p.by||'-'}
                        ${p.notes?'<br>📝 '+p.notes:''}
                    </div>
                    ${p.slip && p.slip.data ? `
                        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
                            <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:6px;">🧾 สลิป / หลักฐาน:</div>
                            ${p.slip.type.startsWith('image/') 
                                ? `<img src="${p.slip.data}" style="max-width:240px;max-height:240px;border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer;" onclick="window.open('${p.slip.data}','_blank')" title="คลิกเพื่อดูขนาดเต็ม">`
                                : `<a href="${p.slip.data}" download="${p.slip.name}" style="color:var(--accent);font-size:12px;">📄 ${p.slip.name} — คลิกเพื่อดาวน์โหลด</a>`
                            }
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        <div style="margin-top:10px;">
            ${(grand - (po.payment?.amount||0)) > 1 
                ? `<button class="btn btn-primary" onclick="closeModal('prDetailModal');setTimeout(()=>openPaymentModal('${poNum}'),200)">💳 จ่ายเงินเพิ่ม</button>` 
                : ''}
        </div>
    `;
    openModal('prDetailModal');
}

function viewPODetail(poNum) {
    const po = poDatabase[poNum];
    if (!po) return toast('❌ ไม่พบข้อมูล');
    if (typeof previewPOPdf === 'function') {
        go('reports');
        setTimeout(() => previewPOPdf(poNum), 300);
    } else {
        toast('📋 ' + poNum + ' — ' + po.vendor);
    }
}

// Initialize PO table
renderPOTable();

// ─── PR Detail ───
// ═══════════════════════════════════════
// ─── APPROVAL FLOW SYSTEM ───
// ═══════════════════════════════════════
// ลำดับอนุมัติ SME: หัวหน้างาน → จัดซื้อ → ผู้จัดการ(MD)
// ─── Current User (early declaration for permission checks) ───
let currentUser = null;
function canCurrentUserApprove(stepIndex) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.canApprove && currentUser.approveStep === stepIndex;
}
function canCurrentUserCreatePO() {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.role === 'procurement';
}
function canCurrentUserManageSettings() {
    if (!currentUser) return false;
    return currentUser.role === 'admin';
}

const APPROVAL_CHAIN = [
    { key:'supervisor', label:'หัวหน้างาน', shortLabel:'หัวหน้า', person:'วิชัย ศิริ', role:'หัวหน้างาน / Site Manager', color:'#3b82f6' },
    { key:'procurement', label:'จัดซื้อ', shortLabel:'จัดซื้อ', person:'สุดา พรสวรรค์', role:'ฝ่ายจัดซื้อ / Procurement', color:'#f59e0b' },
    { key:'md', label:'MD', shortLabel:'MD', person:'ประสิทธิ์ ใจดี', role:'กรรมการผู้จัดการ / Managing Director', color:'#10b981' }
];

const prDB = {};

// ─── Helper: get PR status from approvals ───
function getPRStatus(approvals) {
    const hasRejected = approvals.some(a => a.status === 'rejected');
    if (hasRejected) return { text:'ไม่อนุมัติ', cls:'rejected' };
    const allDone = approvals.every(a => a.status === 'done');
    if (allDone) return { text:'อนุมัติแล้ว', cls:'approved' };
    const hasCurrent = approvals.some(a => a.status === 'current');
    const firstCurrent = approvals.findIndex(a => a.status === 'current');
    if (firstCurrent === 0) return { text:'รอส่งอนุมัติ', cls:'draft' };
    if (hasCurrent) return { text:'รออนุมัติ', cls:'pending' };
    return { text:'กำลังดำเนินการ', cls:'in-progress' };
}

// ─── Render approval flow chips (clickable based on user permission) ───
function renderFlowChips(prNum, approvals) {
    return approvals.map((a, i) => {
        const chain = APPROVAL_CHAIN[i];
        let cls = a.status === 'done' ? 'done' : a.status === 'current' ? 'current' : a.status === 'rejected' ? 'rejected-step' : 'waiting';
        let icon = a.status === 'done' ? '✓' : a.status === 'current' ? '⏳' : a.status === 'rejected' ? '✗' : '○';
        let canClick = a.status === 'current' && canCurrentUserApprove(i);
        let clickAttr = canClick ? `onclick="openApprovalDialog('${prNum}', ${i})" title="คลิกเพื่ออนุมัติ — ${chain.person}"` : (a.status === 'current' ? `title="รอ ${chain.person} อนุมัติ"` : '');
        if (a.status === 'current' && !canClick) cls = 'current'; // still show pulsing but not clickable
        let arrow = i < approvals.length - 1 ? '<span class="af-arrow">→</span>' : '';
        return `<span class="af-step ${cls}" ${canClick?'style="cursor:pointer;"':''} ${clickAttr}>${icon} ${chain.shortLabel}</span>${arrow}`;
    }).join('');
}

// ─── Render the PR table ───
function renderPRTable() {
    const tbody = document.getElementById('prTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const [prNum, pr] of Object.entries(prDB)) {
        const st = getPRStatus(pr.approvals);
        const editable = canEditPR(prNum);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="cell-id">${prNum}</td>
            <td>${pr.title}</td>
            <td>${pr.requester}</td>
            <td>${pr.created}</td>
            <td class="cell-money">฿${pr.total.toLocaleString()}</td>
            <td><div class="approval-flow">${renderFlowChips(prNum, pr.approvals)}</div></td>
            <td><span class="badge ${st.cls}">${st.text}</span></td>
            <td class="actions">
                <button class="act-btn view" onclick="viewPRDetail('${prNum}')">ดู</button>
                ${(currentUser && currentUser.role === 'admin' && st.cls !== 'approved') ? `<button class="act-btn edit" style="background:var(--success-bg);color:var(--success);" onclick="quickApprovePR('${prNum}')">อนุมัติทันที</button>` : ''}
                ${editable ? `<button class="act-btn edit" onclick="openPRModal('${prNum}')">แก้ไข</button>
                <button class="act-btn edit" style="background:var(--danger-bg);color:var(--danger);" onclick="deletePR('${prNum}')">ลบ</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    }
}

function quickApprovePR(prNum) {
    const pr = prDB[prNum];
    if (!pr) return toast('❌ ไม่พบ PR');
    if (!currentUser || currentUser.role !== 'admin') return toast('⚠️ เฉพาะ Admin เท่านั้น');
    const now = new Date().toLocaleDateString('th-TH');
    pr.approvals = (pr.approvals || APPROVAL_CHAIN.map(() => ({status:'waiting'}))).map(a => ({ ...a, status: 'done', date: a.date || now, note: a.note || 'Admin อนุมัติทันที' }));
    renderPRTable();
    renderDashPR();
    toast(`✅ อนุมัติ ${prNum} เรียบร้อย — พร้อมสร้าง PO`);
}

// ─── Approval Dialog ───
function openApprovalDialog(prNum, stepIndex) {
    const pr = prDB[prNum];
    if (!pr) return;
    if (!canCurrentUserApprove(stepIndex)) {
        return toast(`⚠️ คุณไม่มีสิทธิ์อนุมัติลำดับนี้ — ต้องเข้าสู่ระบบเป็น ${APPROVAL_CHAIN[stepIndex].person}`);
    }
    const chain = APPROVAL_CHAIN[stepIndex];
    const step = pr.approvals[stepIndex];
    if (step.status !== 'current') return;

    // Build approval dialog inside the detail modal
    document.getElementById('prDetailTitle').textContent = `อนุมัติ ${prNum}`;
    document.getElementById('prDetailBody').innerHTML = `
        <div style="text-align:center;padding:10px 0 20px;">
            <div style="width:64px;height:64px;border-radius:var(--radius-full);background:linear-gradient(135deg,${chain.color},${chain.color}cc);display:inline-grid;place-items:center;color:#fff;font-size:24px;font-weight:700;margin-bottom:12px;">${chain.person.slice(0,2)}</div>
            <div style="font-size:20px;font-weight:700;">${chain.person}</div>
            <div style="color:var(--text-secondary);margin-top:2px;">${chain.role}</div>
            <div style="margin-top:8px;"><span class="badge pending" style="font-size:13px;">ลำดับที่ ${stepIndex+1} / ${APPROVAL_CHAIN.length}</span></div>
        </div>

        <div style="background:var(--accent-light);border-radius:var(--radius-sm);padding:16px;margin-bottom:20px;">
            <div style="font-weight:700;color:var(--accent-dark);margin-bottom:8px;">📋 ${prNum} — ${pr.title}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
                <div><span style="color:var(--text-muted);">ผู้ขอ:</span> ${pr.requester}</div>
                <div><span style="color:var(--text-muted);">แผนก:</span> ${pr.department}</div>
                <div><span style="color:var(--text-muted);">มูลค่า:</span> <strong style="color:var(--accent);">฿${pr.total.toLocaleString()}</strong></div>
                <div><span style="color:var(--text-muted);">ความสำคัญ:</span> ${pr.priority}</div>
            </div>
        </div>

        <div style="margin-bottom:20px;">
            <div style="font-weight:700;margin-bottom:8px;">✅ ลำดับการอนุมัติ</div>
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                ${pr.approvals.map((a, i) => {
                    const c = APPROVAL_CHAIN[i];
                    let cls = a.status==='done'?'done':a.status==='current'?'current':a.status==='rejected'?'rejected-step':'waiting';
                    let icon = a.status==='done'?'✓':a.status==='current'?'⏳':a.status==='rejected'?'✗':'○';
                    let arrow = i < pr.approvals.length-1 ? '<span class="af-arrow">→</span>' : '';
                    let highlight = i === stepIndex ? 'outline:3px solid var(--warning);outline-offset:2px;' : '';
                    return `<span class="af-step ${cls}" style="${highlight}">${icon} ${c.shortLabel}</span>${arrow}`;
                }).join('')}
            </div>
        </div>

        <div class="form-group" style="margin-bottom:20px;">
            <label style="font-weight:600;">💬 ความเห็น / หมายเหตุ</label>
            <textarea id="approvalNote" rows="3" placeholder="ระบุความเห็นในการอนุมัติ (ถ้ามี)..." style="padding:10px 14px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-th);font-size:14px;width:100%;resize:vertical;"></textarea>
        </div>

        <div style="display:flex;gap:10px;">
            <button class="btn btn-success" style="flex:1;justify-content:center;padding:14px;" onclick="doApprove('${prNum}', ${stepIndex}, true)">
                ✓ อนุมัติ
            </button>
            <button class="btn btn-danger" style="flex:1;justify-content:center;padding:14px;" onclick="doApprove('${prNum}', ${stepIndex}, false)">
                ✗ ไม่อนุมัติ
            </button>
        </div>

        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">ประวัติการอนุมัติก่อนหน้า:</div>
            ${pr.approvals.map((a, i) => {
                if (a.status !== 'done') return '';
                const c = APPROVAL_CHAIN[i];
                return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;">
                    <span style="color:var(--success);font-weight:600;">✓</span>
                    <strong>${c.label}</strong>
                    <span style="color:var(--text-muted);">${c.person}</span>
                    <span style="color:var(--text-muted);margin-left:auto;font-size:11px;">${a.date}</span>
                </div>
                ${a.note ? `<div style="font-size:12px;color:var(--text-secondary);padding-left:22px;margin-bottom:4px;">💬 ${a.note}</div>` : ''}`;
            }).join('')}
        </div>
    `;
    openModal('prDetailModal');
}

// ─── Execute Approval / Rejection ───
function doApprove(prNum, stepIndex, isApproved) {
    const pr = prDB[prNum];
    if (!pr) return;
    const chain = APPROVAL_CHAIN[stepIndex];
    const noteEl = document.getElementById('approvalNote');
    const note = noteEl ? noteEl.value.trim() : '';
    const now = new Date();
    const dateStr = `${now.getDate()} ${['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][now.getMonth()]} ${String(now.getFullYear()+543).slice(-2)} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const approverName = currentUser ? currentUser.name : chain.person;

    if (isApproved) {
        pr.approvals[stepIndex] = {
            status: 'done',
            date: dateStr,
            note: note || 'อนุมัติ',
            by: approverName
        };
        if (stepIndex + 1 < pr.approvals.length) {
            pr.approvals[stepIndex + 1].status = 'current';
        }
        const allDone = pr.approvals.every(a => a.status === 'done');
        // Deduct budget from project when fully approved
        if (allDone && pr.projectId && projectDB[pr.projectId]) {
            projectDB[pr.projectId].used += pr.total;
            toast(`✅ ${approverName} อนุมัติ ${prNum} สำเร็จ — ตัดงบ ฿${pr.total.toLocaleString()} จาก ${projectDB[pr.projectId].name}`);
        } else {
            toast(`✅ ${approverName} อนุมัติ ${prNum} สำเร็จ!${allDone ? ' — อนุมัติครบแล้ว!' : ''}`);
        }
        // Auto-save PDF to Google Drive when fully approved
        if (allDone) {
            autoSavePRPdfOnApproval(prNum);
        }
    } else {
        pr.approvals[stepIndex] = {
            status: 'rejected',
            date: dateStr,
            note: note || 'ไม่อนุมัติ',
            by: approverName
        };
        toast(`❌ ${approverName} ไม่อนุมัติ ${prNum}`);
    }

    // Sync to Google Sheets
    savePRToGoogleSheets({ number: prNum, ...pr, lastAction: isApproved?'approved':'rejected', actionBy: approverName });

    closeModal('prDetailModal');
    renderPRTable();
    renderDashPR();
    if (typeof renderAllLinked === 'function') renderAllLinked();
    if (typeof renderExportTables === 'function') renderExportTables();
}

// ─── View PR Detail (full detail modal) ───
function viewPRDetail(prNum) {
    const pr = prDB[prNum];
    if (!pr) return toast('❌ ไม่พบข้อมูล');
    document.getElementById('prDetailTitle').textContent = `รายละเอียด ${prNum}`;
    const st = getPRStatus(pr.approvals);
    
    document.getElementById('prDetailBody').innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title">📋 ข้อมูลทั่วไป</div>
            <div class="detail-grid">
                <div class="detail-item"><label>เลขที่ PR</label><div class="val" style="font-family:var(--font-mono);color:var(--accent);">${prNum}</div></div>
                <div class="detail-item"><label>สถานะ</label><div class="val"><span class="badge ${st.cls}">${st.text}</span></div></div>
                <div class="detail-item"><label>หัวข้อ</label><div class="val">${pr.title}</div></div>
                <div class="detail-item"><label>ผู้ขอ</label><div class="val">${pr.requester}</div></div>
                <div class="detail-item"><label>แผนก</label><div class="val">${pr.department}</div></div>
                <div class="detail-item"><label>วันที่สร้าง</label><div class="val">${pr.created}</div></div>
                <div class="detail-item"><label>วันที่ต้องการ</label><div class="val">${pr.required}</div></div>
                <div class="detail-item"><label>ความสำคัญ</label><div class="val">${pr.priority}</div></div>
                <div class="detail-item"><label>งบประมาณ</label><div class="val">${pr.budgetType}</div></div>
                <div class="detail-item"><label>มูลค่ารวม</label><div class="val" style="font-family:var(--font-mono);font-size:18px;color:var(--accent);">฿${pr.total.toLocaleString()}</div></div>
            </div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">🛒 รายการสินค้า/บริการ</div>
            <table class="detail-table">
                <thead><tr><th>#</th><th>รายการ</th><th>จำนวน</th><th>หน่วย</th><th>ราคา/หน่วย</th><th>รวม</th></tr></thead>
                <tbody>${pr.items.map((it,i)=>`<tr><td>${i+1}</td><td>${it.desc}</td><td>${it.qty}</td><td>${it.unit}</td><td class="cell-money">฿${it.price.toLocaleString()}</td><td class="cell-money">฿${it.total.toLocaleString()}</td></tr>`).join('')}</tbody>
                <tfoot><tr><td colspan="5" style="text-align:right;">รวมทั้งหมด:</td><td class="cell-money">฿${pr.total.toLocaleString()}</td></tr></tfoot>
            </table>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">💬 เหตุผลความจำเป็น</div>
            <p style="color:var(--text-secondary);line-height:1.7;">${pr.reason}</p>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">✅ ลำดับการอนุมัติ (หัวหน้างาน → จัดซื้อ → MD)</div>
            <div class="timeline">
                ${pr.approvals.map((a, i) => {
                    const chain = APPROVAL_CHAIN[i];
                    const dotCls = a.status === 'done' ? 'done' : a.status === 'current' ? 'current' : a.status === 'rejected' ? 'done' : 'waiting';
                    const statusHtml = a.status === 'done' 
                        ? '<span style="color:var(--success);font-weight:600;">✓ อนุมัติแล้ว</span>'
                        : a.status === 'current'
                        ? '<span style="color:var(--warning);font-weight:600;">⏳ รออนุมัติ</span>'
                        : a.status === 'rejected'
                        ? '<span style="color:var(--danger);font-weight:600;">✗ ไม่อนุมัติ</span>'
                        : '<span style="color:var(--text-muted);">○ รอดำเนินการ</span>';
                    const actionBtn = a.status === 'current'
                        ? `<button class="btn btn-primary" style="margin-top:8px;padding:8px 16px;font-size:12px;" onclick="openApprovalDialog('${prNum}', ${i})">⏳ คลิกเพื่ออนุมัติ</button>`
                        : '';
                    return `
                        <div class="timeline-item">
                            <div class="timeline-dot ${dotCls}" ${a.status==='rejected'?'style="border-color:var(--danger);background:var(--danger);"':''}></div>
                            <div>
                                <div class="timeline-name">${i+1}. ${chain.label} — ${chain.person}</div>
                                <div class="timeline-role">${chain.role}</div>
                                <div class="timeline-status">${statusHtml}</div>
                                ${a.date ? `<div class="timeline-date">📅 ${a.date}</div>` : ''}
                                ${a.note ? `<div class="timeline-date">💬 ${a.note}</div>` : ''}
                                ${actionBtn}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    openModal('prDetailModal');
}

// ─── Initialize PR table on load ───
renderPRTable();

// ─── Render Dashboard PR summary (top 3) ───
function renderDashPR() {
    const tbody = document.getElementById('dashPRBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const entries = Object.entries(prDB).slice(0, 3);
    for (const [prNum, pr] of entries) {
        const st = getPRStatus(pr.approvals);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="cell-id" style="cursor:pointer;" onclick="go('pr')">${prNum}</td>
            <td>${pr.title}</td>
            <td>${pr.requester}</td>
            <td class="cell-money">฿${pr.total.toLocaleString()}</td>
            <td><div class="approval-flow">${renderFlowChips(prNum, pr.approvals)}</div></td>
            <td><span class="badge ${st.cls}">${st.text}</span></td>
        `;
        tbody.appendChild(tr);
    }
}
renderDashPR();

// ─── Set default dates ───
const today = new Date().toISOString().split('T')[0];
document.querySelectorAll('input[type="date"]').forEach(i => { if (!i.value) i.value = today; });

// ─── File upload feedback ───
document.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', function() {
        if (this.files.length > 0) {
            const txt = this.closest('.file-drop').querySelector('.file-drop-text');
            txt.innerHTML = `<strong style="color:var(--success);">✓ ${this.files.length} ไฟล์</strong><br><small>${Array.from(this.files).map(f=>f.name).join(', ')}</small>`;
        }
    });
});

// ═══════════════════════════════════════
// ─── VENDOR MANAGEMENT ───
// ═══════════════════════════════════════
const vendorDB = {};

function viewVendorDetail(id) {
    const v = vendorDB[id];
    if (!v) return toast('❌ ไม่พบข้อมูล');
    document.getElementById('vendorDetailTitle').textContent = `${id} — ${v.name}`;
    const stars = '★'.repeat(Math.floor(v.avgRating)) + (v.avgRating%1>=0.5?'½':'');
    document.getElementById('vendorDetailBody').innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title">🏢 ข้อมูลบริษัท</div>
            <div class="detail-grid">
                <div class="detail-item"><label>รหัสผู้ขาย</label><div class="val" style="font-family:var(--font-mono);color:var(--accent);">${id}</div></div>
                <div class="detail-item"><label>ชื่อบริษัท</label><div class="val">${v.name}</div></div>
                <div class="detail-item"><label>ประเภทกิจการ</label><div class="val">${v.type}</div></div>
                <div class="detail-item"><label>เลขผู้เสียภาษี</label><div class="val" style="font-family:var(--font-mono);">${v.tax}</div></div>
                <div class="detail-item"><label>ประเภทสินค้า</label><div class="val">${v.category}</div></div>
                <div class="detail-item"><label>สถานะ</label><div class="val"><span class="badge ${v.status==='ใช้งาน'?'approved':'draft'}">${v.status}</span></div></div>
            </div>
            <div style="margin-top:12px;"><label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px;">ที่อยู่</label><div style="margin-top:4px;color:var(--text-primary);">${v.address}</div></div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">👤 ผู้ติดต่อ</div>
            <div class="detail-grid">
                <div class="detail-item"><label>ชื่อ</label><div class="val">${v.contact}</div></div>
                <div class="detail-item"><label>ตำแหน่ง</label><div class="val">${v.position}</div></div>
                <div class="detail-item"><label>เบอร์โทร</label><div class="val">${v.phone}</div></div>
                <div class="detail-item"><label>อีเมล</label><div class="val">${v.email}</div></div>
                ${v.line?`<div class="detail-item"><label>LINE</label><div class="val">${v.line}</div></div>`:''}
                ${v.website?`<div class="detail-item"><label>เว็บไซต์</label><div class="val">${v.website}</div></div>`:''}
            </div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">💳 เงื่อนไขและประวัติ</div>
            <div class="detail-grid">
                <div class="detail-item"><label>เงื่อนไขชำระ</label><div class="val">${v.terms}</div></div>
                <div class="detail-item"><label>วงเงินเครดิต</label><div class="val cell-money">${v.credit?'฿'+v.credit.toLocaleString():'—'}</div></div>
                <div class="detail-item"><label>จำนวน PO ทั้งหมด</label><div class="val">${v.poCount} รายการ</div></div>
                <div class="detail-item"><label>มูลค่ารวม</label><div class="val cell-money">฿${v.totalValue.toLocaleString()}</div></div>
                <div class="detail-item"><label>คะแนนเฉลี่ย</label><div class="val" style="color:#f59e0b;">${stars} (${v.avgRating})</div></div>
                <div class="detail-item"><label>PO ล่าสุด</label><div class="val">${v.lastPO}</div></div>
            </div>
        </div>
    `;
    openModal('vendorDetailModal');
}

function submitVendor() {
    const f = document.getElementById('vendorForm');
    if (!f.checkValidity()) { f.reportValidity(); return; }

    const fd = new FormData(f);
    const id = 'V' + String(Object.keys(vendors).length + 1).padStart(3, '0');
    const name = (fd.get('company_name') || '').trim();

    vendors[id] = {
        name: name, type: fd.get('vendor_type') || '-', tax: fd.get('tax_id') || '-',
        category: fd.get('category') || '-', addr: fd.get('address') || '-', address: fd.get('address') || '-',
        contact: fd.get('contact_name') || '-', position: fd.get('contact_position') || '-',
        phone: fd.get('phone') || '-', email: fd.get('email') || '-', line: fd.get('line_id') || '', website: fd.get('website') || '',
        terms: fd.get('payment_terms') || 'เครดิต 30 วัน', credit: Number(fd.get('credit_limit') || 0), notes: fd.get('notes') || '',
        status: 'ใช้งาน', poCount: 0, totalValue: 0, avgRating: 5, lastPO: '-'
    };
    vendorDB[id] = { ...vendors[id] };
    vendorCatalog[id] = vendorCatalog[id] || {};

    renderVendorsTable();
    renderVendorStats();
    toast(`✅ บันทึกผู้ขาย ${id} — ${name} สำเร็จ!`);
    closeModal('vendorModal');
    f.reset();
}

// ═══════════════════════════════════════
// ─── DEPARTMENT MANAGEMENT ───
// ═══════════════════════════════════════
const deptDB = {};

function viewDeptDetail(id) {
    const d = deptDB[id];
    if (!d) return toast('❌ ไม่พบข้อมูล');
    document.getElementById('deptDetailTitle').textContent = `${d.code} — ${d.nameTh}`;
    const pct = Math.round(d.used/d.budget*100);
    const barColor = pct>80?'yellow':pct>60?'blue':'green';
    const typeLabels = {engineering:'🏗️ วิศวกรรม',construction:'🚧 ก่อสร้าง',design:'📐 ออกแบบ',management:'🏢 บริหาร',procurement:'🛒 จัดซื้อ',safety:'🦺 ความปลอดภัย',plant:'🔧 เครื่องจักร',support:'👥 สนับสนุน'};
    document.getElementById('deptDetailBody').innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title">🏗️ ข้อมูลแผนก</div>
            <div class="detail-grid">
                <div class="detail-item"><label>รหัส</label><div class="val cell-id">${id}</div></div>
                <div class="detail-item"><label>ชื่อแผนก</label><div class="val">${d.nameTh}</div></div>
                <div class="detail-item"><label>ชื่ออังกฤษ</label><div class="val">${d.nameEn}</div></div>
                <div class="detail-item"><label>รหัสแผนก</label><div class="val" style="font-family:var(--font-mono);">${d.code}</div></div>
                <div class="detail-item"><label>ประเภท</label><div class="val">${typeLabels[d.type]||d.type}</div></div>
                <div class="detail-item"><label>Cost Center</label><div class="val" style="font-family:var(--font-mono);">${d.costCenter}</div></div>
                <div class="detail-item"><label>ที่ตั้ง / ไซต์</label><div class="val">${d.location}</div></div>
                <div class="detail-item"><label>มาตรฐาน / ISO</label><div class="val">${d.iso||'-'}</div></div>
            </div>
            <div style="margin-top:12px;"><label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">ขอบเขตงาน / หน้าที่ความรับผิดชอบ</label><div style="margin-top:4px;color:var(--text-secondary);font-size:13px;line-height:1.7;">${d.desc}</div></div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">👷 ผู้จัดการ / หัวหน้าแผนก</div>
            <div class="detail-grid">
                <div class="detail-item"><label>ชื่อ</label><div class="val">${d.head}</div></div>
                <div class="detail-item"><label>ตำแหน่ง</label><div class="val">${d.headTitle}</div></div>
                <div class="detail-item"><label>วุฒิ / ใบอนุญาต</label><div class="val">${d.qualification||'-'}</div></div>
                <div class="detail-item"><label>อีเมลแผนก</label><div class="val">${d.email}</div></div>
                <div class="detail-item"><label>เบอร์ภายใน</label><div class="val">${d.ext}</div></div>
            </div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">👥 กำลังคน</div>
            <div class="detail-grid">
                <div class="detail-item"><label>พนักงานทั้งหมด</label><div class="val" style="font-size:18px;font-weight:800;">${d.employees} คน</div></div>
                <div class="detail-item"><label>วิศวกร / ช่างเทคนิค</label><div class="val">${d.engineers||0} คน</div></div>
                <div class="detail-item"><label>แรงงาน / ผู้ช่วย</label><div class="val">${d.laborers||0} คน</div></div>
            </div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">💰 งบประมาณ</div>
            <div class="detail-grid">
                <div class="detail-item"><label>งบประมาณทั้งหมด</label><div class="val cell-money">฿${d.budget.toLocaleString()}</div></div>
                <div class="detail-item"><label>ใช้ไปแล้ว</label><div class="val cell-money">฿${d.used.toLocaleString()}</div></div>
                <div class="detail-item"><label>คงเหลือ</label><div class="val cell-money" style="color:var(--success);">฿${(d.budget-d.used).toLocaleString()}</div></div>
                <div class="detail-item"><label>สัดส่วนการใช้</label><div class="val">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div class="progress-bar" style="width:100px;"><div class="progress-bar-fill ${barColor}" style="width:${pct}%;"></div></div>
                        <span>${pct}%</span>
                    </div>
                </div></div>
            </div>
        </div>
    `;
    openModal('deptDetailModal');
}

// ═══════════════════════════════════════
// ─── PROJECT DB (must be before renderAllLinked) ───
// ═══════════════════════════════════════
const projectDB = {};
function getDeptName(deptId) { const d = deptDB[deptId]; return d ? d.nameTh : deptId; }
function getDeptHead(deptId) { const d = deptDB[deptId]; return d ? d.head : '-'; }
function getDeptOptions(selectedId) {
    return Object.entries(deptDB).map(([id, d]) => `<option value="${id}" ${id===selectedId?'selected':''}>${d.nameTh} (${d.code})</option>`).join('');
}

function submitDept() {
    const f = document.getElementById('deptForm');
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const fd = new FormData(f);
    const nameTh = fd.get('dept_name_th') || '';
    const code = (fd.get('dept_code') || '').toUpperCase();
    const id = editingDeptId || 'D' + String(Object.keys(deptDB).length + 1).padStart(3, '0');
    deptDB[id] = {
        code: code, nameTh: nameTh, nameEn: fd.get('dept_name_en') || '', type: fd.get('dept_type') || '',
        parent: fd.get('parent_dept') || '', costCenter: fd.get('cost_center') || '', email: fd.get('dept_email') || '', status: fd.get('status') || 'active',
        head: '-', headTitle: '-', qualification: '-', ext: '-', location: '-', budget: 0, used: 0, engineers: 0, laborers: 0, desc: '-', iso: '-'
    };
    toast(editingDeptId ? `✅ แก้ไขแผนก ${nameTh} สำเร็จ!` : `✅ เพิ่มแผนก ${nameTh} สำเร็จ!`);
    editingDeptId = null; closeModal('deptModal'); f.reset();
    renderDeptTable(); renderDeptStats(); populateDepartmentDropdowns();
}

function deleteDept(deptId) {
    const d = deptDB[deptId];
    if (!d) return;
    // Check if dept is used by projects
    const usedBy = Object.values(projectDB).filter(p => p.deptId === deptId);
    if (usedBy.length > 0) {
        return toast(`⚠️ ไม่สามารถลบได้ — แผนกนี้ใช้ใน ${usedBy.length} โครงการ`);
    }
    if (!confirm(`⚠️ ยืนยันลบแผนก ${deptId} — ${d.nameTh}?`)) return;
    delete deptDB[deptId];
    toast(`🗑️ ลบแผนก ${deptId} สำเร็จ`);
    renderAllLinked();
}

function deleteProject(projId) {
    if (!confirm(`⚠️ ยืนยันลบโครงการ ${projId}?`)) return;
    delete projectDB[projId];
    toast(`🗑️ ลบโครงการ ${projId} สำเร็จ`);
    renderAllLinked();
}

// ═══════════════════════════════════════
// ─── RENDER ALL LINKED (Dept ↔ Budget ↔ Project) ───
// ═══════════════════════════════════════
// ─── GRN Database (must be before renderAllLinked → renderDashStats) ───
const grnDatabase = {};

function renderAllLinked() {
    renderDeptTable();
    renderDeptStats();
    renderBudgetTable();
    renderBudgetStats();
    renderProjectTable();
    renderProjectStats();
    if (typeof populateAllDeptDropdowns === 'function') populateAllDeptDropdowns();
    if (typeof renderDashStats === 'function') renderDashStats();
    if (typeof renderDashPR === 'function') renderDashPR();
}

// ─── Dept Table (dynamic) ───
function renderDeptTable() {
    const tbody = document.getElementById('deptTableBody');
    if (!tbody) return;
    const typeIcons = {engineering:'🏗️',construction:'🚧',design:'📐',management:'🏢',procurement:'🛒',safety:'🦺',plant:'🔧',support:'👥'};
    tbody.innerHTML = '';
    for (const [id, d] of Object.entries(deptDB)) {
        const projCount = Object.values(projectDB).filter(p => p.deptId === id).length;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="cell-id">${id}</td>
            <td><strong>${typeIcons[d.type]||''} ${d.nameTh}</strong><br><span style="font-size:11px;color:var(--text-muted);">${d.desc ? d.desc.substring(0,40)+'...' : ''}</span></td>
            <td>${d.nameEn}</td>
            <td>${d.head}<br><span style="font-size:11px;color:var(--text-muted);">${d.qualification||''}</span></td>
            <td style="text-align:center;">${d.employees}</td>
            <td class="cell-money">฿${d.budget.toLocaleString()}</td>
            <td>${d.location}${projCount?'<br><span style="font-size:10px;color:var(--accent);">'+projCount+' โครงการ</span>':''}</td>
            <td><span class="badge approved">ใช้งาน</span></td>
            <td class="actions">
                <button class="act-btn view" onclick="viewDeptDetail('${id}')">ดู</button>
                <button class="act-btn edit" onclick="openDeptModal('${id}')">แก้ไข</button>
                <button class="act-btn edit" style="background:var(--danger-bg);color:var(--danger);" onclick="deleteDept('${id}')">ลบ</button>
            </td>`;
        tbody.appendChild(tr);
    }
}

function renderDeptStats() {
    const el = document.getElementById('deptStats');
    if (!el) return;
    const depts = Object.values(deptDB);
    const totalEmp = depts.reduce((s,d) => s+d.employees, 0);
    const totalBudget = depts.reduce((s,d) => s+d.budget, 0);
    const activeProj = Object.values(projectDB).filter(p => p.status==='active').length;
    el.innerHTML = `
        <div class="stat-card budget"><div class="stat-top"><div class="stat-label">แผนกทั้งหมด</div><div class="stat-icon">🏗️</div></div><div class="stat-value">${depts.length}</div><div class="stat-sub">แผนกที่ใช้งาน</div></div>
        <div class="stat-card approved"><div class="stat-top"><div class="stat-label">พนักงานทั้งหมด</div><div class="stat-icon">👷</div></div><div class="stat-value">${totalEmp}</div><div class="stat-sub">ทุกแผนกรวม</div></div>
        <div class="stat-card pending"><div class="stat-top"><div class="stat-label">โครงการดำเนินการ</div><div class="stat-icon">🚧</div></div><div class="stat-value">${activeProj}</div><div class="stat-sub">กำลังดำเนินการ</div></div>
        <div class="stat-card approved"><div class="stat-top"><div class="stat-label">งบรวมทุกแผนก</div><div class="stat-icon">💰</div></div><div class="stat-value">฿${(totalBudget/1e6).toFixed(1)}M</div><div class="stat-sub">ปีงบประมาณ 2568</div></div>
    `;
}

// ─── Budget Table (dynamic from deptDB) ───
function renderBudgetTable() {
    const tbody = document.getElementById('budgetTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const [id, d] of Object.entries(deptDB)) {
        const pct = d.budget > 0 ? Math.round(d.used / d.budget * 100) : 0;
        const remain = d.budget - d.used;
        const barColor = pct > 80 ? 'yellow' : pct > 60 ? 'blue' : 'green';
        const statusBadge = pct > 80 ? '<span class="badge low-budget">ใกล้หมด</span>' : '<span class="badge normal">ปกติ</span>';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${d.nameTh}</strong><br><span style="font-size:11px;color:var(--text-muted);">${d.code} — ${d.head}</span></td>
            <td class="cell-money">฿${d.budget.toLocaleString()}</td>
            <td class="cell-money">฿${d.used.toLocaleString()}</td>
            <td class="cell-money" style="color:var(--success);">฿${remain.toLocaleString()}</td>
            <td><div style="display:flex;align-items:center;gap:8px;"><div class="progress-bar" style="width:80px;"><div class="progress-bar-fill ${barColor}" style="width:${pct}%;"></div></div><span style="font-size:12px;">${pct}%</span></div></td>
            <td>${statusBadge}</td>
            <td class="actions">
                <button class="act-btn edit" onclick="editBudget('${id}')">แก้ไขงบ</button>
            </td>`;
        tbody.appendChild(tr);
    }
}

function renderBudgetStats() {
    const el = document.getElementById('budgetStats');
    if (!el) return;
    const depts = Object.values(deptDB);
    const totalBudget = depts.reduce((s,d) => s+d.budget, 0);
    const totalUsed = depts.reduce((s,d) => s+d.used, 0);
    const remain = totalBudget - totalUsed;
    const pct = totalBudget > 0 ? Math.round(totalUsed/totalBudget*100) : 0;
    el.innerHTML = `
        <div class="stat-card budget"><div class="stat-top"><div class="stat-label">งบประมาณรวม</div><div class="stat-icon">💰</div></div><div class="stat-value">฿${(totalBudget/1e6).toFixed(1)}M</div><div class="stat-sub">งบทั้ง ${depts.length} แผนก</div></div>
        <div class="stat-card approved"><div class="stat-top"><div class="stat-label">ใช้ไปแล้ว</div><div class="stat-icon">📊</div></div><div class="stat-value">฿${(totalUsed/1e6).toFixed(1)}M</div><div class="stat-sub">${pct}% ของงบรวม</div></div>
        <div class="stat-card pending"><div class="stat-top"><div class="stat-label">คงเหลือ</div><div class="stat-icon">💵</div></div><div class="stat-value">฿${(remain/1e6).toFixed(1)}M</div><div class="stat-sub">${100-pct}% ของงบรวม</div></div>
        <div class="stat-card rejected"><div class="stat-top"><div class="stat-label">แผนกงบใกล้หมด</div><div class="stat-icon">⚠️</div></div><div class="stat-value">${depts.filter(d=>d.budget>0&&d.used/d.budget>0.8).length}</div><div class="stat-sub">ใช้เกิน 80%</div></div>
    `;
}

function editBudget(deptId) {
    const d = deptDB[deptId];
    if (!d) return;
    const newBudget = prompt(`แก้ไขงบประมาณ — ${d.nameTh}\n\nงบปัจจุบัน: ฿${d.budget.toLocaleString()}\nใช้ไปแล้ว: ฿${d.used.toLocaleString()}\n\nใส่งบใหม่ (บาท):`, d.budget);
    if (newBudget === null) return;
    const val = parseFloat(newBudget);
    if (isNaN(val) || val < 0) return toast('⚠️ จำนวนเงินไม่ถูกต้อง');
    d.budget = val;
    toast(`✅ แก้ไขงบ ${d.nameTh} เป็น ฿${val.toLocaleString()} สำเร็จ`);
    renderAllLinked();
}

// ─── Init all linked on load ───
renderAllLinked();

// ─── Populate all dept dropdowns from deptDB ───
function populateAllDeptDropdowns() {
    const opts = '<option value="">-- เลือกแผนก --</option>' + Object.entries(deptDB).map(([id,d]) => `<option value="${d.nameTh}">${d.code} — ${d.nameTh}</option>`).join('');
    ['prDeptSelect','budgetDeptSelect','userDeptSelect'].forEach(elId => {
        const el = document.getElementById(elId);
        if (el) el.innerHTML = opts;
    });
    const filterDept = document.getElementById('filterDept');
    if (filterDept) {
        filterDept.innerHTML = '<option value="">ทุกแผนก</option>' + Object.entries(deptDB).map(([id,d]) => `<option value="${d.nameTh}">${d.code} — ${d.nameTh}</option>`).join('');
    }
    // Populate project dropdown in PR form
    populateProjectDropdowns();
}

function populateProjectDropdowns() {
    const sel = document.getElementById('prProjectSelect');
    if (!sel) return;
    const saved = sel.value;
    sel.innerHTML = '<option value="">-- เลือกโครงการ --</option>';
    for (const [id, p] of Object.entries(projectDB)) {
        if (p.status === 'completed') continue;
        const remain = p.budget - p.used;
        sel.innerHTML += `<option value="${id}">${id} — ${p.name} (คงเหลือ ฿${remain.toLocaleString()})</option>`;
    }
    if (saved) sel.value = saved;
}

function onPRProjectSelect() {
    const projId = document.getElementById('prProjectSelect')?.value;
    const infoDiv = document.getElementById('prProjectBudgetInfo');
    if (!projId || !projectDB[projId]) {
        if (infoDiv) infoDiv.style.display = 'none';
        return;
    }
    const p = projectDB[projId];
    const remain = p.budget - p.used;
    const pct = p.budget > 0 ? Math.round(p.used / p.budget * 100) : 0;
    const barColor = pct > 80 ? 'yellow' : pct > 60 ? 'blue' : 'green';
    const deptName = getDeptName(p.deptId);
    if (infoDiv) {
        infoDiv.style.display = 'block';
        infoDiv.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <strong>🚧 ${p.name}</strong> | ${p.location}<br>
                    <span style="font-size:12px;color:var(--text-muted);">แผนก: ${deptName} | ผู้จัดการ: ${p.manager}</span>
                </div>
                <div style="text-align:right;">
                    <div style="font-family:var(--font-mono);font-weight:700;color:${remain>0?'var(--success)':'var(--danger)'};">งบคงเหลือ ฿${remain.toLocaleString()}</div>
                    <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;margin-top:4px;">
                        <div class="progress-bar" style="width:80px;"><div class="progress-bar-fill ${barColor}" style="width:${pct}%;"></div></div>
                        <span style="font-size:11px;">${pct}% ใช้ไป</span>
                    </div>
                </div>
            </div>`;
    }
}
populateAllDeptDropdowns();

// ─── Dashboard Stats (dynamic from prDB, poDatabase, deptDB, projectDB) ───

function renderDashStats() {
    const el = document.getElementById('dashStats');
    if (!el) return;
    const prs = Object.values(prDB);
    const prPending = prs.filter(pr => pr.approvals.some(a => a.status === 'current')).length;
    const prApproved = prs.filter(pr => pr.approvals.every(a => a.status === 'done')).length;
    const prRejected = prs.filter(pr => pr.approvals.some(a => a.status === 'rejected')).length;
    const poCount = Object.keys(poDatabase).length;
    const depts = Object.values(deptDB);
    const totalBudget = depts.reduce((s,d) => s+d.budget, 0);
    const totalUsed = depts.reduce((s,d) => s+d.used, 0);
    const remain = totalBudget - totalUsed;
    const pctUsed = totalBudget > 0 ? Math.round(totalUsed/totalBudget*100) : 0;
    const activeProj = Object.values(projectDB).filter(p => p.status === 'active').length;
    const grnCount = Object.keys(grnDatabase).length;
    
    el.innerHTML = `
        <div class="stat-card pending">
            <div class="stat-top"><div class="stat-label">PR รอดำเนินการ</div><div class="stat-icon">⏳</div></div>
            <div class="stat-value">${prPending}</div>
            <div class="stat-sub"><span style="color:var(--success);">${prApproved} อนุมัติ</span> · ${prs.length} ทั้งหมด</div>
        </div>
        <div class="stat-card approved">
            <div class="stat-top"><div class="stat-label">PO + รับสินค้า</div><div class="stat-icon">📦</div></div>
            <div class="stat-value">${poCount}</div>
            <div class="stat-sub">${grnCount} GRN · ${activeProj} โครงการ</div>
        </div>
        <div class="stat-card budget">
            <div class="stat-top"><div class="stat-label">งบคงเหลือ</div><div class="stat-icon">💰</div></div>
            <div class="stat-value">฿${(remain/1e6).toFixed(1)}M</div>
            <div style="margin-top:6px;display:flex;align-items:center;gap:6px;">
                <div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pctUsed}%;background:${pctUsed>80?'var(--danger)':pctUsed>60?'var(--warning)':'var(--success)'};border-radius:3px;transition:width 0.5s;"></div></div>
                <span style="font-size:11px;color:var(--text-muted);">${pctUsed}%</span>
            </div>
        </div>
        <div class="stat-card rejected">
            <div class="stat-top"><div class="stat-label">PR ไม่อนุมัติ</div><div class="stat-icon">❌</div></div>
            <div class="stat-value">${prRejected}</div>
            <div class="stat-sub">${depts.length} แผนก · ${Object.keys(vendors).length} ผู้ขาย</div>
        </div>
    `;
    
    // Update welcome banner
    const hour = new Date().getHours();
    const greeting = hour < 12 ? '🌅 สวัสดีตอนเช้า' : hour < 17 ? '☀️ สวัสดีตอนบ่าย' : '🌙 สวัสดีตอนเย็น';
    const gEl = document.getElementById('dashGreeting');
    const nEl = document.getElementById('dashWelcomeName');
    const rEl = document.getElementById('dashWelcomeRole');
    if (gEl) gEl.textContent = greeting;
    if (nEl && currentUser) nEl.textContent = currentUser.name;
    if (rEl && currentUser) rEl.textContent = `${currentUser.roleLabel} · แผนก${currentUser.dept}`;
    
    // Render budget donut
    renderDashBudgetChart(totalBudget, totalUsed, remain);
    
    // Render activity
    renderDashActivity();
    
    // Render projects
    renderDashProjects();
    
    // Render PO list
    renderDashPOList();
}

function renderDashBudgetChart(total, used, remain) {
    const el = document.getElementById('dashBudgetChart');
    if (!el) return;
    const pct = total > 0 ? Math.round(used/total*100) : 0;
    const r = 54, c = 2 * Math.PI * r;
    const offset = c - (pct/100 * c);
    const color = pct > 80 ? '#dc2626' : pct > 60 ? '#ca8a04' : '#0d9668';
    el.innerHTML = `
        <svg width="140" height="140" viewBox="0 0 140 140" style="margin-bottom:10px;">
            <circle cx="70" cy="70" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="12"/>
            <circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
                stroke-dasharray="${c}" stroke-dashoffset="${offset}" transform="rotate(-90 70 70)" style="transition:stroke-dashoffset 1s ease;"/>
            <text x="70" y="64" text-anchor="middle" style="font-size:22px;font-weight:800;fill:var(--text-primary);font-family:var(--font-mono);">${pct}%</text>
            <text x="70" y="82" text-anchor="middle" style="font-size:10px;fill:var(--text-muted);">ใช้ไปแล้ว</text>
        </svg>
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:0 8px;">
            <div><div style="color:var(--text-muted);">งบทั้งหมด</div><div style="font-weight:700;font-family:var(--font-mono);">฿${(total/1e6).toFixed(1)}M</div></div>
            <div style="text-align:center;"><div style="color:var(--text-muted);">ใช้ไป</div><div style="font-weight:700;color:${color};font-family:var(--font-mono);">฿${(used/1e6).toFixed(1)}M</div></div>
            <div style="text-align:right;"><div style="color:var(--text-muted);">คงเหลือ</div><div style="font-weight:700;color:var(--success);font-family:var(--font-mono);">฿${(remain/1e6).toFixed(1)}M</div></div>
        </div>
    `;
}

function renderDashActivity() {
    const el = document.getElementById('dashActivity');
    if (!el) return;
    // Build activity from PR approvals
    const activities = [];
    for (const [num, pr] of Object.entries(prDB)) {
        pr.approvals.forEach((a, i) => {
            if (a.status === 'done') activities.push({ icon:'✅', text:`${a.by||APPROVAL_CHAIN[i].person} อนุมัติ ${num}`, time:a.date, sort:1 });
            if (a.status === 'rejected') activities.push({ icon:'❌', text:`${a.by||APPROVAL_CHAIN[i].person} ไม่อนุมัติ ${num}`, time:a.date, sort:0 });
        });
        if (pr.approvals[0]?.status === 'current') activities.push({ icon:'📝', text:`${pr.requester} สร้าง ${num}`, time:pr.created, sort:2 });
    }
    for (const [num, po] of Object.entries(poDatabase)) {
        activities.push({ icon:'📋', text:`สร้าง PO ${num} — ${po.vendor}`, time:po.date, sort:3 });
    }
    
    const sorted = activities.slice(-8).reverse();
    if (sorted.length === 0) {
        el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:12px;">ยังไม่มีกิจกรรม</div>';
        return;
    }
    el.innerHTML = sorted.map(a => `
        <div style="display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border-light);">
            <span style="font-size:14px;flex-shrink:0;margin-top:1px;">${a.icon}</span>
            <div style="flex:1;min-width:0;">
                <div style="font-size:12px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.text}</div>
                <div style="font-size:10px;color:var(--text-muted);">${a.time}</div>
            </div>
        </div>
    `).join('');
}

function renderDashProjects() {
    const el = document.getElementById('dashProjects');
    if (!el) return;
    const active = Object.entries(projectDB).filter(([,p]) => p.status === 'active').slice(0, 4);
    if (active.length === 0) {
        el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:16px;font-size:12px;">ไม่มีโครงการที่กำลังดำเนินการ</div>';
        return;
    }
    el.innerHTML = active.map(([id, p]) => {
        const pct = p.budget > 0 ? Math.round(p.used/p.budget*100) : 0;
        const barColor = pct > 80 ? 'var(--danger)' : pct > 60 ? 'var(--warning)' : 'var(--success)';
        return `<div style="padding:10px 0;border-bottom:1px solid var(--border-light);cursor:pointer;" onclick="go('projects')">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div style="font-size:13px;font-weight:600;">${p.name}</div>
                <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">฿${(p.budget/1e6).toFixed(1)}M</span>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin:3px 0;">${p.location} · ${p.manager}</div>
            <div style="display:flex;align-items:center;gap:6px;">
                <div style="flex:1;height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;"></div></div>
                <span style="font-size:10px;color:var(--text-muted);">${pct}%</span>
            </div>
        </div>`;
    }).join('');
}

function renderDashPOList() {
    const el = document.getElementById('dashPOList');
    if (!el) return;
    const pos = Object.entries(poDatabase).slice(-4).reverse();
    if (pos.length === 0) {
        el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:16px;font-size:12px;">ยังไม่มี PO</div>';
        return;
    }
    el.innerHTML = pos.map(([num, po]) => {
        const paid = po.payment?.status === 'paid';
        return `<div style="display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-light);cursor:pointer;" onclick="go('po')">
            <div style="width:36px;height:36px;border-radius:8px;background:${paid?'var(--success-bg)':'var(--accent-light)'};display:grid;place-items:center;font-size:16px;flex-shrink:0;">${paid?'✅':'📋'}</div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:600;color:var(--text-primary);">${num}</div>
                <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${po.vendor}</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:12px;font-weight:700;font-family:var(--font-mono);color:var(--accent);">฿${po.total.toLocaleString()}</div>
                <div style="font-size:10px;"><span class="badge ${po.statusCls}" style="padding:1px 8px;">${po.statusText}</span></div>
            </div>
        </div>`;
    }).join('');
}

renderDashStats();

// ═══════════════════════════════════════
// ─── USER MANAGEMENT ───
// ═══════════════════════════════════════
const userDB = {};

function viewUserDetail(id) {
    const u = userDB[id];
    if (!u) return toast('❌ ไม่พบข้อมูล');
    document.getElementById('userDetailTitle').textContent = `${id} — ${u.name}`;
    const roleBg = {Admin:'#fef3c7',Manager:'var(--info-bg)',Approver:'var(--success-bg)',User:'#f3f4f6'};
    const roleColor = {Admin:'#92400e',Manager:'#1e40af',Approver:'#065f46',User:'#6b7280'};
    document.getElementById('userDetailBody').innerHTML = `
        <div class="detail-section">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
                <div style="width:56px;height:56px;border-radius:var(--radius-full);background:linear-gradient(135deg,${u.color},${u.color}cc);display:grid;place-items:center;color:#fff;font-size:18px;font-weight:700;">${u.name.slice(0,2)}</div>
                <div>
                    <div style="font-size:20px;font-weight:700;">${u.name}</div>
                    <div style="color:var(--text-secondary);">${u.position} — ${u.dept}</div>
                </div>
                <span class="badge ${u.status==='ใช้งาน'?'approved':'draft'}" style="margin-left:auto;">${u.status}</span>
            </div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">📋 ข้อมูลส่วนตัว</div>
            <div class="detail-grid">
                <div class="detail-item"><label>รหัสผู้ใช้</label><div class="val cell-id">${id}</div></div>
                <div class="detail-item"><label>รหัสพนักงาน</label><div class="val" style="font-family:var(--font-mono);">${u.empId}</div></div>
                <div class="detail-item"><label>อีเมล</label><div class="val">${u.email}</div></div>
                <div class="detail-item"><label>เบอร์โทร</label><div class="val">${u.phone}</div></div>
                <div class="detail-item"><label>วันที่เริ่มงาน</label><div class="val">${u.startDate}</div></div>
                <div class="detail-item"><label>เข้าสู่ระบบล่าสุด</label><div class="val">${u.lastLogin}</div></div>
            </div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">🏛️ ตำแหน่ง</div>
            <div class="detail-grid">
                <div class="detail-item"><label>แผนก</label><div class="val">${u.dept}</div></div>
                <div class="detail-item"><label>ตำแหน่ง</label><div class="val">${u.position}</div></div>
                <div class="detail-item"><label>ผู้บังคับบัญชา</label><div class="val">${u.supervisor}</div></div>
            </div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">🔑 สิทธิ์การเข้าถึง</div>
            <div class="detail-grid">
                <div class="detail-item"><label>บทบาทในระบบ</label><div class="val"><span class="badge" style="background:${roleBg[u.role]};color:${roleColor[u.role]};">${u.roleLabel}</span></div></div>
                <div class="detail-item"><label>วงเงินอนุมัติ</label><div class="val cell-money">${u.approvalLimit}</div></div>
                <div class="detail-item"><label>PR ที่สร้าง</label><div class="val">${u.prCreated} รายการ</div></div>
                <div class="detail-item"><label>PR ที่อนุมัติ</label><div class="val">${u.prApproved} รายการ</div></div>
            </div>
        </div>
    `;
    openModal('userDetailModal');
}

// ═══════════════════════════════════════
// ─── USERS CRUD + PERMISSIONS ───
// ═══════════════════════════════════════
let editingUserId = null;

// Default permissions by role
const ROLE_PERMS = {
    admin:       { dashboard:1, pr:1, po:1, compare:1, grn:1, approve:1, payment:1, reports:1, projects:1, budget:1, vendors:1, settings:1 },
    manager:     { dashboard:1, pr:1, po:0, compare:1, grn:1, approve:1, payment:0, reports:1, projects:1, budget:1, vendors:0, settings:0 },
    foreman:     { dashboard:1, pr:1, po:0, compare:0, grn:1, approve:0, payment:0, reports:0, projects:1, budget:0, vendors:0, settings:0 },
    procurement: { dashboard:1, pr:1, po:1, compare:1, grn:1, approve:1, payment:1, reports:1, projects:0, budget:1, vendors:1, settings:0 },
    engineer:    { dashboard:1, pr:1, po:0, compare:0, grn:1, approve:0, payment:0, reports:0, projects:0, budget:0, vendors:0, settings:0 },
    safety:      { dashboard:1, pr:1, po:0, compare:0, grn:0, approve:0, payment:0, reports:0, projects:0, budget:0, vendors:0, settings:0 },
    qs:          { dashboard:1, pr:1, po:0, compare:1, grn:0, approve:0, payment:0, reports:1, projects:0, budget:1, vendors:0, settings:0 },
    admin_hr:    { dashboard:1, pr:1, po:0, compare:0, grn:0, approve:0, payment:0, reports:0, projects:0, budget:0, vendors:0, settings:0 },
    finance:     { dashboard:1, pr:1, po:0, compare:0, grn:0, approve:0, payment:1, reports:1, projects:0, budget:1, vendors:0, settings:0 },
    user:        { dashboard:1, pr:1, po:0, compare:0, grn:0, approve:0, payment:0, reports:0, projects:0, budget:0, vendors:0, settings:0 },
};

const PERM_LABELS = {
    dashboard:'📊 Dashboard', pr:'📝 PR', po:'📋 PO', compare:'⚖️ เปรียบเทียบ',
    grn:'📦 รับสินค้า', approve:'✅ อนุมัติ', payment:'💳 จ่ายเงิน', reports:'📈 รายงาน',
    projects:'📂 โครงการ', budget:'💰 งบ', vendors:'🏢 ผู้ขาย', settings:'⚙️ ตั้งค่า'
};

function onRoleChange() {
    const f = document.getElementById('userForm');
    const role = f.elements['role'].value;
    const perms = ROLE_PERMS[role];
    if (!perms) return;
    Object.keys(perms).forEach(k => {
        const cb = f.elements['perm_' + k];
        if (cb) cb.checked = !!perms[k];
    });
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    const roleLabels = {admin:'👔 Admin',manager:'👨‍💼 Manager',foreman:'🔨 Foreman',procurement:'🛒 จัดซื้อ',engineer:'👷 วิศวกร',safety:'🦺 จป.',qs:'📐 QS',admin_hr:'🏢 ธุรการ',finance:'💰 บัญชี',user:'👤 User'};
    tbody.innerHTML = '';
    TEAM_USERS.forEach(u => {
        // Build permission badges
        const perms = u.permissions || ROLE_PERMS[u.role] || {};
        const permBadges = Object.entries(perms).filter(([,v])=>v).map(([k]) => {
            const icons = {dashboard:'📊',pr:'📝',po:'📋',compare:'⚖️',grn:'📦',approve:'✅',payment:'💳',reports:'📈',projects:'📂',budget:'💰',vendors:'🏢',settings:'⚙️'};
            return `<span style="display:inline-block;background:var(--accent-light);color:var(--accent);padding:1px 6px;border-radius:4px;font-size:9px;margin:1px;">${icons[k]||k}</span>`;
        }).join('');
        
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="cell-id">${u.id}</td>
            <td><div style="display:flex;align-items:center;gap:10px;">${userAvatarHTML(u,32)}<div><strong>${u.name}</strong><br><span style="font-size:11px;color:var(--text-muted);">${u.roleLabel}</span></div></div></td>
            <td><code style="font-size:12px;">${u.username||''}</code></td>
            <td>${u.dept}</td>
            <td>${roleLabels[u.role]||u.role}</td>
            <td style="max-width:200px;">${permBadges}</td>
            <td><span class="badge approved">ใช้งาน</span></td>
            <td class="actions">
                <button class="act-btn edit" onclick="openUserModal('${u.id}')">แก้ไข</button>
                <button class="act-btn edit" style="background:var(--danger-bg);color:var(--danger);" onclick="deleteUser('${u.id}')">ลบ</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

function renderUserStats() {
    const el = document.getElementById('userStats');
    if (!el) return;
    el.innerHTML = `
        <div class="stat-card approved"><div class="stat-top"><div class="stat-label">ผู้ใช้ทั้งหมด</div><div class="stat-icon">👤</div></div><div class="stat-value">${TEAM_USERS.length}</div><div class="stat-sub">บัญชีที่ลงทะเบียน</div></div>
        <div class="stat-card budget"><div class="stat-top"><div class="stat-label">ผู้อนุมัติ</div><div class="stat-icon">🔑</div></div><div class="stat-value">${TEAM_USERS.filter(u=>u.canApprove).length}</div><div class="stat-sub">มีสิทธิ์อนุมัติ PR</div></div>
        <div class="stat-card pending"><div class="stat-top"><div class="stat-label">Admin</div><div class="stat-icon">⚙️</div></div><div class="stat-value">${TEAM_USERS.filter(u=>u.role==='admin').length}</div><div class="stat-sub">จัดการระบบทั้งหมด</div></div>`;
}

function openUserModal(userId) {
    const f = document.getElementById('userForm');
    f.reset();
    editingUserId = userId || null;
    const title = document.getElementById('userModalTitle');
    if (userId) {
        const u = TEAM_USERS.find(x => x.id === userId);
        if (!u) return;
        title.textContent = '✏️ แก้ไข ' + u.name;
        f.elements['fullname'].value = u.name;
        f.elements['initials'].value = u.initials;
        f.elements['department'].value = u.dept;
        f.elements['position'].value = u.roleLabel;
        f.elements['username'].value = u.username || '';
        f.elements['password'].value = u.password || '1234';
        f.elements['role'].value = u.role;
        f.elements['color'].value = u.color;
        // Load permissions
        const perms = u.permissions || ROLE_PERMS[u.role] || {};
        Object.keys(PERM_LABELS).forEach(k => {
            const cb = f.elements['perm_' + k];
            if (cb) cb.checked = !!perms[k];
        });
    } else {
        title.textContent = '👤 เพิ่มผู้ใช้งานใหม่';
        f.elements['password'].value = '1234';
        // Default: user role
        f.elements['role'].value = 'user';
        onRoleChange();
    }
    openModal('userModal');
}

function submitUser() {
    const f = document.getElementById('userForm');
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const role = f.elements['role'].value;
    const approveMap = {admin:{can:true,step:2},manager:{can:true,step:0},foreman:{can:false,step:-1},procurement:{can:true,step:1}};
    const ap = approveMap[role] || {can:false,step:-1};
    
    // Collect permissions from checkboxes
    const permissions = {};
    Object.keys(PERM_LABELS).forEach(k => {
        const cb = f.elements['perm_' + k];
        permissions[k] = cb ? (cb.checked ? 1 : 0) : 0;
    });
    
    const data = {
        name: f.elements['fullname'].value, initials: f.elements['initials'].value,
        dept: f.elements['department'].value, roleLabel: f.elements['position'].value,
        username: f.elements['username'].value.toLowerCase().trim(),
        password: f.elements['password'].value, role: role,
        color: f.elements['color'].value, canApprove: ap.can || !!permissions.approve, approveStep: ap.step,
        photo: '', permissions: permissions
    };
    const dup = TEAM_USERS.find(u => u.username === data.username && u.id !== editingUserId);
    if (dup) return toast('⚠️ Username "' + data.username + '" ใช้แล้วโดย ' + dup.name);
    if (editingUserId) {
        const idx = TEAM_USERS.findIndex(u => u.id === editingUserId);
        if (idx >= 0) { data.id = editingUserId; data.photo = TEAM_USERS[idx].photo||''; TEAM_USERS[idx] = data; }
        toast('✅ แก้ไข ' + data.name + ' สำเร็จ!');
    } else {
        data.id = 'U' + String(TEAM_USERS.length+1).padStart(3,'0');
        TEAM_USERS.push(data);
        toast('✅ เพิ่มผู้ใช้ ' + data.name + ' (' + data.username + ') สำเร็จ!');
    }
    editingUserId = null; closeModal('userModal'); f.reset();
    renderUsersTable(); renderUserStats();
}

function deleteUser(userId) {
    const u = TEAM_USERS.find(x => x.id === userId);
    if (!u) return;
    if (currentUser && currentUser.id === userId) return toast('⚠️ ไม่สามารถลบตัวเองได้');
    if (!confirm('⚠️ ยืนยันลบผู้ใช้ ' + u.name + ' (' + u.username + ')?')) return;
    const idx = TEAM_USERS.findIndex(x => x.id === userId);
    if (idx >= 0) TEAM_USERS.splice(idx, 1);
    localStorage.removeItem('pro_photo_' + userId);
    toast('🗑️ ลบ ' + u.name + ' สำเร็จ');
    renderUsersTable(); renderUserStats();
}

// ═══════════════════════════════════════
// ─── VENDORS Dynamic Render + Delete ───
// ═══════════════════════════════════════
function renderVendorsTable() {
    const tbody = document.getElementById('vendorsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const [id, v] of Object.entries(vendors)) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="cell-id">${id}</td>
            <td><strong>${v.name}</strong><br><span style="font-size:11px;color:var(--text-muted);">${v.addr||''}</span></td>
            <td style="font-family:var(--font-mono);font-size:12px;">${v.tax||''}</td>
            <td>${v.contact||''}</td><td>${v.phone||''}</td>
            <td style="font-size:12px;">${v.email||''}</td>
            <td class="actions">
                <button class="act-btn view" onclick="viewVendorDetail('${id}')">ดู</button>
                <button class="act-btn edit" onclick="openModal('vendorModal')">แก้ไข</button>
                <button class="act-btn edit" style="background:var(--danger-bg);color:var(--danger);" onclick="deleteVendor('${id}')">ลบ</button>
            </td>`;
        tbody.appendChild(tr);
    }
}

function renderVendorStats() {
    const el = document.getElementById('vendorStats');
    if (!el) return;
    el.innerHTML = `
        <div class="stat-card approved"><div class="stat-top"><div class="stat-label">ผู้ขายทั้งหมด</div><div class="stat-icon">🏢</div></div><div class="stat-value">${Object.keys(vendors).length}</div><div class="stat-sub">คู่ค้าที่ลงทะเบียน</div></div>
        <div class="stat-card budget"><div class="stat-top"><div class="stat-label">PO ที่ออก</div><div class="stat-icon">📋</div></div><div class="stat-value">${Object.keys(poDatabase).length}</div><div class="stat-sub">ใบสั่งซื้อทั้งหมด</div></div>`;
}

function deleteVendor(vendorId) {
    const v = vendors[vendorId];
    if (!v) return;
    const usedInPO = Object.values(poDatabase).filter(po => po.vendor === v.name).length;
    if (usedInPO > 0) return toast('⚠️ ไม่สามารถลบ — ผู้ขายนี้ใช้ใน ' + usedInPO + ' PO');
    if (!confirm('⚠️ ยืนยันลบผู้ขาย ' + v.name + '?')) return;
    delete vendors[vendorId];
    if (vendorCatalog[vendorId]) delete vendorCatalog[vendorId];
    toast('🗑️ ลบ ' + v.name + ' สำเร็จ');
    renderVendorsTable(); renderVendorStats();
}

function filterUsers() { /* deprecated */ }
function toggleApprovalLimit() { /* deprecated */ }

// Init render (called by initLogin and go() after TEAM_USERS is ready)
function initUsersAndVendors() { renderUsersTable(); renderUserStats(); renderVendorsTable(); renderVendorStats(); }

// ═══════════════════════════════════════
// ─── PDF EXPORT SYSTEM ───
// ═══════════════════════════════════════

// ─── Render export tables ───
function renderExportTables() {
    // PR table
    const prBody = document.getElementById('exportPRBody');
    if (prBody) {
        prBody.innerHTML = '';
        for (const [num, pr] of Object.entries(prDB)) {
            const st = getPRStatus(pr.approvals);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="cell-id">${num}</td>
                <td>${pr.title}</td>
                <td>${pr.requester}</td>
                <td class="cell-money">฿${pr.total.toLocaleString()}</td>
                <td><span class="badge ${st.cls}">${st.text}</span></td>
                <td class="actions" style="white-space:nowrap;">
                    <button class="act-btn view" onclick="previewPRPdf('${num}')" title="ดูตัวอย่าง">👁️ ดู</button>
                    <button class="btn btn-primary" style="padding:5px 12px;font-size:12px;" onclick="exportPRPdf('${num}')" title="ดาวน์โหลด PDF">📥 PDF</button>
                </td>
            `;
            prBody.appendChild(tr);
        }
    }
    // PO table
    const poBody = document.getElementById('exportPOBody');
    if (poBody) {
        poBody.innerHTML = '';
        for (const [num, po] of Object.entries(poDatabase)) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="cell-id">${num}</td>
                <td class="cell-id">${po.prRef}</td>
                <td>${po.vendor}</td>
                <td class="cell-money">฿${po.total.toLocaleString()}</td>
                <td><span class="badge ${po.statusCls}">${po.statusText}</span></td>
                <td class="actions" style="white-space:nowrap;">
                    <button class="act-btn view" onclick="previewPOPdf('${num}')" title="ดูตัวอย่าง">👁️ ดู</button>
                    <button class="btn btn-primary" style="padding:5px 12px;font-size:12px;" onclick="exportPOPdf('${num}')" title="ดาวน์โหลด PDF">📥 PDF</button>
                </td>
            `;
            poBody.appendChild(tr);
        }
    }
}
renderExportTables();

// ─── Generate PDF Form HTML (shared) ───
let currentPdfHtml = '';
let currentPdfName = '';

function buildPdfFormHTML(type, data) {
    const isPR = type === 'PR';
    const accentColor = isPR ? '#3b82f6' : '#10b981';
    const typeLabel = isPR ? 'ใบขอซื้อ / PURCHASE REQUEST' : 'ใบสั่งซื้อ / PURCHASE ORDER';
    const co = getCompanySettings();
    
    const chainLabels = APPROVAL_CHAIN.map(c => c.shortLabel);
    const chainPersons = APPROVAL_CHAIN.map(c => c.person);
    
    function approvalChipHtml(approvals) {
        return (approvals||[]).map((a, i) => {
            const bg = a.status==='done'?'#d1fae5':a.status==='current'?'#fef3c7':a.status==='rejected'?'#fee2e2':'#f1f5f9';
            const bc = a.status==='done'?'#10b981':a.status==='current'?'#f59e0b':a.status==='rejected'?'#ef4444':'#cbd5e1';
            const fc = a.status==='done'?'#065f46':a.status==='current'?'#92400e':a.status==='rejected'?'#991b1b':'#94a3b8';
            const icon = a.status==='done'?'✓':a.status==='current'?'⏳':a.status==='rejected'?'✗':'○';
            const arrow = i<chainLabels.length-1?'<span style="margin:0 2px;color:#cbd5e1;">→</span>':'';
            return `<span style="display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:20px;font-size:9px;font-weight:600;border:1.5px solid ${bc};background:${bg};color:${fc};">${icon} ${chainLabels[i]}</span>${arrow}`;
        }).join('');
    }

    function signBlock(role) {
        return `<td style="text-align:center;padding:8px;vertical-align:top;">
            <div style="font-weight:700;font-size:9px;color:#1e3a8a;margin-bottom:28px;">${role}</div>
            <div style="border-bottom:1px solid #cbd5e1;margin:0 10px;"></div>
            <div style="font-size:7px;color:#94a3b8;margin-top:3px;">ลงชื่อ / Signed</div>
            <div style="margin-top:14px;border-bottom:1px solid #cbd5e1;margin:14px 10px 0;"></div>
            <div style="font-size:7px;color:#94a3b8;margin-top:3px;">(                                              )</div>
            <div style="margin-top:10px;border-bottom:1px solid #cbd5e1;margin:10px 10px 0;"></div>
            <div style="font-size:7px;color:#94a3b8;margin-top:3px;">วันที่ / Date</div>
        </td>`;
    }

    // Items rows
    let itemsHtml = '';
    const items = data.items || [];
    items.forEach((it, i) => {
        const bg = i%2===0?'#ffffff':'#f8fafc';
        const discCol = !isPR ? `<td style="padding:6px 8px;border:0.5px solid #e2e8f0;text-align:center;font-size:9px;background:${bg};">${it.disc||it.discount?((it.disc||it.discount)+'%'):'-'}</td>` : '';
        itemsHtml += `<tr>
            <td style="padding:6px 8px;border:0.5px solid #e2e8f0;text-align:center;font-size:9px;background:${bg};">${i+1}</td>
            <td style="padding:6px 8px;border:0.5px solid #e2e8f0;font-size:9px;background:${bg};">${it.desc}</td>
            <td style="padding:6px 8px;border:0.5px solid #e2e8f0;text-align:center;font-size:9px;background:${bg};">${it.qty}</td>
            <td style="padding:6px 8px;border:0.5px solid #e2e8f0;text-align:center;font-size:9px;background:${bg};">${it.unit}</td>
            <td style="padding:6px 8px;border:0.5px solid #e2e8f0;text-align:right;font-size:9px;background:${bg};">฿${it.price.toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
            ${discCol}
            <td style="padding:6px 8px;border:0.5px solid #e2e8f0;text-align:right;font-size:9px;font-weight:600;background:${bg};">฿${it.total.toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
        </tr>`;
    });
    // Empty rows
    for (let j=0; j < Math.max(0, (isPR?6:5) - items.length); j++) {
        const discCol = !isPR ? '<td style="padding:6px 8px;border:0.5px solid #e2e8f0;">&nbsp;</td>' : '';
        itemsHtml += `<tr><td style="padding:6px 8px;border:0.5px solid #e2e8f0;text-align:center;font-size:9px;">${items.length+j+1}</td><td style="padding:6px 8px;border:0.5px solid #e2e8f0;">&nbsp;</td><td style="padding:6px 8px;border:0.5px solid #e2e8f0;">&nbsp;</td><td style="padding:6px 8px;border:0.5px solid #e2e8f0;">&nbsp;</td><td style="padding:6px 8px;border:0.5px solid #e2e8f0;">&nbsp;</td>${discCol}<td style="padding:6px 8px;border:0.5px solid #e2e8f0;">&nbsp;</td></tr>`;
    }
    
    const sub = data.total;
    const vat = sub * 0.07;
    const grand = sub + vat;
    const discTh = !isPR ? '<th style="padding:6px;font-size:8px;background:#1e3a8a;color:white;border:0.5px solid #1e3a8a;">ส่วนลด<br>Disc.</th>' : '';
    const discTotCol = !isPR ? '<td style="padding:6px 8px;border:none;"></td>' : '';
    const totColspan = isPR ? 4 : 5;

    // ─── Vendor section (PO only) ───
    let vendorSection = '';
    if (!isPR) {
        vendorSection = `
        <div style="margin-bottom:14px;">
            <div style="background:#f1f5f9;padding:5px 10px;border-left:3px solid #1e3a8a;font-weight:700;font-size:10px;color:#1e3a8a;margin-bottom:8px;">🏢 ข้อมูลผู้ขาย / Vendor Information</div>
            <table style="width:100%;border-collapse:collapse;font-size:9px;">
                <tr><td style="width:13%;color:#64748b;padding:3px 0;">บริษัท:</td><td style="font-weight:600;" colspan="3">${data.vendor||''}</td></tr>
                <tr><td style="color:#64748b;padding:3px 0;">เลขภาษี:</td><td>${data.vendorTax||''}</td><td style="color:#64748b;">ผู้ติดต่อ:</td><td>${data.vendorContact||''}</td></tr>
                <tr><td style="color:#64748b;padding:3px 0;">ที่อยู่:</td><td colspan="3">${data.vendorAddr||''}</td></tr>
                <tr><td style="color:#64748b;padding:3px 0;">โทร:</td><td>${data.vendorPhone||''}</td><td style="color:#64748b;">อีเมล:</td><td>${data.vendorEmail||''}</td></tr>
            </table>
        </div>`;
    }

    // ─── General info fields ───
    let infoHtml = '';
    if (isPR) {
        infoHtml = `
            <tr><td style="width:13%;color:#64748b;padding:3px 0;">เลขที่ PR:</td><td style="font-weight:600;font-family:monospace;">${data.number||''}</td><td style="width:13%;color:#64748b;">วันที่:</td><td>${data.created||data.date||''}</td></tr>
            <tr><td style="color:#64748b;padding:3px 0;">หัวข้อ:</td><td style="font-weight:600;">${data.title||''}</td><td style="color:#64748b;">แผนก:</td><td>${data.department||''}</td></tr>
            <tr><td style="color:#64748b;padding:3px 0;">ผู้ขอ:</td><td>${data.requester||''}</td><td style="color:#64748b;">วันที่ต้องการ:</td><td>${data.required||data.required_date||''}</td></tr>
            <tr><td style="color:#64748b;padding:3px 0;">ความสำคัญ:</td><td>${data.priority||''} ${data.priority==='สูง'?'<span style="background:#fee2e2;color:#ef4444;font-size:7px;padding:1px 6px;border-radius:8px;font-weight:700;">URGENT</span>':''}</td><td style="color:#64748b;">ประเภทงบ:</td><td>${data.budgetType||''}</td></tr>`;
    } else {
        infoHtml = `
            <tr><td style="width:13%;color:#64748b;padding:3px 0;">เลขที่ PO:</td><td style="font-weight:600;font-family:monospace;">${data.number||''}</td><td style="width:13%;color:#64748b;">วันที่:</td><td>${data.date||''}</td></tr>
            <tr><td style="color:#64748b;padding:3px 0;">อ้างอิง PR:</td><td style="font-family:monospace;">${data.prRef||''}</td><td style="color:#64748b;">กำหนดส่ง:</td><td>${data.deliveryDate||''}</td></tr>
            <tr><td style="color:#64748b;padding:3px 0;">เงื่อนไข:</td><td>${data.payTerms||''}</td><td style="color:#64748b;">สถานที่ส่ง:</td><td>${data.deliveryLoc||''}</td></tr>`;
    }

    // ─── Reason (PR only) ───
    let reasonSection = '';
    if (isPR && data.reason) {
        reasonSection = `
        <div style="margin-bottom:14px;">
            <div style="background:#f1f5f9;padding:5px 10px;border-left:3px solid #1e3a8a;font-weight:700;font-size:10px;color:#1e3a8a;margin-bottom:8px;">💬 เหตุผลความจำเป็น / Justification</div>
            <div style="border:0.5px solid #e2e8f0;border-radius:4px;padding:8px 10px;font-size:9px;color:#334155;min-height:30px;line-height:1.6;">${data.reason}</div>
        </div>`;
    }

    // ─── Terms (PO only) ───
    let termsSection = '';
    if (!isPR) {
        termsSection = `
        <div style="margin-bottom:14px;">
            <div style="background:#f1f5f9;padding:5px 10px;border-left:3px solid #1e3a8a;font-weight:700;font-size:10px;color:#1e3a8a;margin-bottom:8px;">📜 เงื่อนไข / Terms & Conditions</div>
            <div style="font-size:8px;color:#64748b;line-height:1.7;padding-left:8px;">
                1. สินค้าต้องตรงตามรายละเอียดและคุณภาพที่ระบุ<br>
                2. กำหนดส่งมอบตามวันที่ระบุ หากล่าช้าจะถูกหักค่าปรับ<br>
                3. การชำระเงินจะดำเนินการหลังจากตรวจรับสินค้าเรียบร้อยแล้ว<br>
                4. ผู้ขายต้องรับประกันสินค้าไม่น้อยกว่า 1 ปี นับจากวันส่งมอบ
            </div>
        </div>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
</head><body>

<!-- HEADER -->
<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
<tr>
<td style="width:70px;vertical-align:top;">
    ${co.logo
        ? '<img src="'+co.logo+'" style="width:56px;height:56px;object-fit:contain;border-radius:10px;">'
        : '<div style="width:56px;height:56px;background:#1e3a8a;border-radius:10px;display:flex;align-items:center;justify-content:center;"><span style="color:white;font-weight:800;font-size:18px;display:block;text-align:center;line-height:56px;">PRO</span></div>'
    }
</td>
<td style="vertical-align:top;">
    <div style="font-size:16px;font-weight:800;color:#1e3a8a;">${co.nameTh}</div>
    <div style="font-size:9px;color:#64748b;">${co.nameEn}</div>
    <div style="font-size:8px;color:#94a3b8;margin-top:2px;">${co.addr1} ${co.addr2} | โทร: ${co.phone} | เลขภาษี: ${co.taxId}${co.branch?' ('+co.branch+')':''}</div>
</td>
<td style="text-align:right;vertical-align:top;width:200px;">
    <div style="background:${accentColor};color:white;font-weight:700;font-size:11px;padding:6px 16px;border-radius:6px;display:inline-block;">${typeLabel}</div>
    <div style="margin-top:6px;background:#eef1ff;border:1.5px solid #3b82f6;border-radius:6px;padding:5px 12px;font-weight:700;font-size:12px;color:#1e3a8a;font-family:monospace;">เลขที่: ${data.number||''}</div>
</td>
</tr>
</table>

<!-- GENERAL INFO -->
<div style="margin-bottom:14px;">
    <div style="background:#f1f5f9;padding:5px 10px;border-left:3px solid #1e3a8a;font-weight:700;font-size:10px;color:#1e3a8a;margin-bottom:8px;">📋 ข้อมูลทั่วไป / General Information</div>
    <table style="width:100%;border-collapse:collapse;font-size:9px;">${infoHtml}</table>
</div>

${vendorSection}

<!-- ITEMS TABLE -->
<div style="margin-bottom:14px;">
    <div style="background:#f1f5f9;padding:5px 10px;border-left:3px solid #1e3a8a;font-weight:700;font-size:10px;color:#1e3a8a;margin-bottom:8px;">🛒 รายการสินค้า / บริการ / Items & Services</div>
    <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
            <th style="padding:6px;font-size:8px;background:#1e3a8a;color:white;border:0.5px solid #1e3a8a;width:30px;">ลำดับ<br>No.</th>
            <th style="padding:6px;font-size:8px;background:#1e3a8a;color:white;border:0.5px solid #1e3a8a;">รายการ / รายละเอียด<br>Description</th>
            <th style="padding:6px;font-size:8px;background:#1e3a8a;color:white;border:0.5px solid #1e3a8a;width:45px;">จำนวน<br>Qty</th>
            <th style="padding:6px;font-size:8px;background:#1e3a8a;color:white;border:0.5px solid #1e3a8a;width:40px;">หน่วย<br>Unit</th>
            <th style="padding:6px;font-size:8px;background:#1e3a8a;color:white;border:0.5px solid #1e3a8a;width:80px;">ราคา/หน่วย<br>Unit Price</th>
            ${discTh}
            <th style="padding:6px;font-size:8px;background:#1e3a8a;color:white;border:0.5px solid #1e3a8a;width:90px;">จำนวนเงิน<br>Amount</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-top:0;">
        <tr><td colspan="${totColspan}" style="text-align:right;padding:4px 8px;font-size:9px;font-weight:600;border-top:1.5px solid #1e3a8a;">รวมเงิน / Subtotal</td>${discTotCol}<td style="text-align:right;padding:4px 8px;font-size:9px;font-weight:600;border-top:1.5px solid #1e3a8a;">฿${sub.toLocaleString('th-TH',{minimumFractionDigits:2})}</td></tr>
        <tr><td colspan="${totColspan}" style="text-align:right;padding:4px 8px;font-size:9px;">ภาษีมูลค่าเพิ่ม VAT 7%</td>${discTotCol}<td style="text-align:right;padding:4px 8px;font-size:9px;">฿${vat.toLocaleString('th-TH',{minimumFractionDigits:2})}</td></tr>
        <tr><td colspan="${totColspan}" style="text-align:right;padding:6px 8px;font-size:11px;font-weight:800;color:#1e3a8a;">รวมทั้งสิ้น / Grand Total</td>${discTotCol}<td style="text-align:right;padding:6px 8px;font-size:11px;font-weight:800;color:#1e3a8a;background:#eef1ff;border-radius:4px;">฿${grand.toLocaleString('th-TH',{minimumFractionDigits:2})}</td></tr>
    </table>
</div>

${reasonSection}
${termsSection}

<!-- APPROVAL CHAIN -->
<div style="margin-bottom:14px;">
    <div style="background:#f1f5f9;padding:5px 10px;border-left:3px solid #1e3a8a;font-weight:700;font-size:10px;color:#1e3a8a;margin-bottom:8px;">✅ ลำดับการอนุมัติ / Approval Chain (${chainLabels.join(' → ')})</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:2px;flex-wrap:wrap;padding:6px 0;">
        ${approvalChipHtml(data.approvals)}
    </div>
</div>

<!-- SIGNATURES -->
<div style="margin-bottom:10px;">
    <div style="background:#f1f5f9;padding:5px 10px;border-left:3px solid #1e3a8a;font-weight:700;font-size:10px;color:#1e3a8a;margin-bottom:8px;">✍️ ลงนามอนุมัติ / Approval Signatures</div>
    <table style="width:100%;border-collapse:collapse;">
        <tr>${APPROVAL_CHAIN.map(c=>signBlock(c.label)).join('')}</tr>
    </table>
</div>

<!-- FOOTER -->
<div style="margin-top:16px;border-top:0.5px solid #e2e8f0;padding-top:6px;font-size:7px;color:#94a3b8;display:flex;justify-content:space-between;">
    <span>PRO System — ${co.nameTh}</span>
    <span>เอกสารนี้จัดทำโดยระบบอัตโนมัติ</span>
</div>

</body></html>`;
}

// ─── Preview in page ───
function showPdfPreview(html, title) {
    currentPdfHtml = html;
    const area = document.getElementById('pdfPreviewArea');
    const content = document.getElementById('pdfPreviewContent');
    document.getElementById('pdfPreviewTitle').textContent = 'ตัวอย่าง: ' + title;
    content.innerHTML = `<iframe id="pdfFrame" srcdoc="${html.replace(/"/g,'&quot;')}" style="width:100%;height:75vh;border:none;background:white;display:block;margin:0 auto;max-width:210mm;box-shadow:0 4px 20px rgba(0,0,0,0.3);"></iframe>`;
    area.style.display = 'block';
    area.scrollIntoView({behavior:'smooth'});
}

// ─── Download as PDF via print ───
function downloadCurrentPDF() {
    const frame = document.getElementById('pdfFrame');
    if (frame) {
        frame.contentWindow.print();
    }
}
function printCurrentPDF() {
    downloadCurrentPDF();
}

// ─── PR Export ───
function previewPRPdf(prNum) {
    const pr = prDB[prNum];
    if (!pr) return toast('❌ ไม่พบข้อมูล');
    const d = {...pr, number:prNum };
    currentPdfName = prNum;
    const html = buildPdfFormHTML('PR', d);
    showPdfPreview(html, prNum + ' — ' + pr.title);
    toast('📄 แสดงตัวอย่าง ' + prNum);
}
function exportPRPdf(prNum) {
    const pr = prDB[prNum];
    if (!pr) return toast('❌ ไม่พบข้อมูล');
    const d = {...pr, number:prNum };
    currentPdfName = prNum;
    const html = buildPdfFormHTML('PR', d);
    // Open print dialog directly
    const w = window.open('', '_blank', 'width=800,height=1000');
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
    toast('📥 กำลังส่งออก ' + prNum + ' เป็น PDF');
}

// ─── PO Export ───
function previewPOPdf(poNum) {
    const po = poDatabase[poNum];
    if (!po) return toast('❌ ไม่พบข้อมูล');
    const d = {...po, number:poNum };
    currentPdfName = poNum;
    const html = buildPdfFormHTML('PO', d);
    showPdfPreview(html, poNum + ' — ' + po.vendor);
    toast('📄 แสดงตัวอย่าง ' + poNum);
}
function exportPOPdf(poNum) {
    const po = poDatabase[poNum];
    if (!po) return toast('❌ ไม่พบข้อมูล');
    const d = {...po, number:poNum };
    currentPdfName = poNum;
    const html = buildPdfFormHTML('PO', d);
    const w = window.open('', '_blank', 'width=800,height=1000');
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
    toast('📥 กำลังส่งออก ' + poNum + ' เป็น PDF');
}

// ═══════════════════════════════════════
// ─── PROJECT MANAGEMENT (rendering + forms) ───
// ═══════════════════════════════════════

function renderProjectStats() {
    const projects = Object.values(projectDB);
    const total = projects.length;
    const active = projects.filter(p => p.status==='active').length;
    const totalBudget = projects.reduce((s,p) => s+p.budget, 0);
    const totalUsed = projects.reduce((s,p) => s+p.used, 0);
    const el = document.getElementById('projStats');
    if (!el) return;
    el.innerHTML = `
        <div class="stat-card budget"><div class="stat-top"><div class="stat-label">โครงการทั้งหมด</div><div class="stat-icon">🚧</div></div><div class="stat-value">${total}</div><div class="stat-sub">${active} กำลังดำเนินการ</div></div>
        <div class="stat-card approved"><div class="stat-top"><div class="stat-label">งบประมาณรวม</div><div class="stat-icon">💰</div></div><div class="stat-value">฿${(totalBudget/1e6).toFixed(1)}M</div><div class="stat-sub">ทุกโครงการ</div></div>
        <div class="stat-card pending"><div class="stat-top"><div class="stat-label">ใช้ไปแล้ว</div><div class="stat-icon">📊</div></div><div class="stat-value">฿${(totalUsed/1e6).toFixed(1)}M</div><div class="stat-sub">${totalBudget>0?Math.round(totalUsed/totalBudget*100):0}% ของงบรวม</div></div>
        <div class="stat-card approved"><div class="stat-top"><div class="stat-label">คงเหลือ</div><div class="stat-icon">💵</div></div><div class="stat-value">฿${((totalBudget-totalUsed)/1e6).toFixed(1)}M</div><div class="stat-sub">${totalBudget>0?Math.round((totalBudget-totalUsed)/totalBudget*100):0}%</div></div>
    `;
}

function renderProjectTable() {
    const tbody = document.getElementById('projectsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const typeIcons = {building:'🏢',civil:'🛤️',renovation:'🔧',mep:'⚡',other:'📋'};
    const statusMap = {planning:{text:'วางแผน',cls:'draft'},active:{text:'กำลังดำเนินการ',cls:'in-progress'},onhold:{text:'ระงับ',cls:'pending'},completed:{text:'เสร็จสิ้น',cls:'completed'}};

    for (const [id, p] of Object.entries(projectDB)) {
        const pct = p.budget>0 ? Math.round((p.budget-p.used)/p.budget*100) : 0;
        const usedPct = p.budget>0 ? Math.round(p.used/p.budget*100) : 0;
        const barColor = usedPct>80?'yellow':usedPct>60?'blue':'green';
        const st = statusMap[p.status] || {text:p.status,cls:'draft'};
        const deptName = getDeptName(p.deptId);
        const supportNames = (p.supportDepts||[]).map(getDeptName).join(', ');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="cell-id">${id}</td>
            <td><strong>${typeIcons[p.type]||''} ${p.name}</strong><br><span style="font-size:11px;color:var(--text-muted);">${p.location} | ${p.client||'-'}</span></td>
            <td><strong style="font-size:12px;">${deptName}</strong>${supportNames?`<br><span style="font-size:10px;color:var(--text-muted);">+ ${supportNames}</span>`:''}</td>
            <td style="font-size:12px;">${p.manager}</td>
            <td class="cell-money">฿${p.budget.toLocaleString()}</td>
            <td class="cell-money">฿${p.used.toLocaleString()}</td>
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div class="progress-bar" style="width:60px;"><div class="progress-bar-fill ${barColor}" style="width:${usedPct}%;"></div></div>
                    <span style="font-size:11px;color:var(--text-muted);">${pct}%</span>
                </div>
            </td>
            <td style="font-size:12px;">${p.start} — ${p.end}</td>
            <td><span class="badge ${st.cls}">${st.text}</span></td>
            <td class="actions"><button class="act-btn view" onclick="viewProjectDetail('${id}')">ดู</button><button class="act-btn edit" onclick="openProjectModal('${id}')">แก้ไข</button><button class="act-btn edit" style="background:var(--danger-bg);color:var(--danger);" onclick="deleteProject('${id}')">ลบ</button></td>
        `;
        tbody.appendChild(tr);
    }
}

function openProjectModal(editId) {
    // Populate dept dropdown from deptDB
    const deptSelect = document.getElementById('projDept');
    deptSelect.innerHTML = '<option value="">-- เลือกแผนก --</option>' + getDeptOptions('');

    // Populate support dept checkboxes
    const supportDiv = document.getElementById('projSupportDepts');
    supportDiv.innerHTML = Object.entries(deptDB).map(([id, d]) =>
        `<label class="check-label" style="font-size:12px;background:var(--bg-main);padding:4px 10px;border-radius:var(--radius-full);border:1px solid var(--border);"><input type="checkbox" class="proj-support-cb" value="${id}"> ${d.nameTh}</label>`
    ).join('');

    // Reset
    document.getElementById('projName').value = '';
    document.getElementById('projType').value = '';
    document.getElementById('projLocation').value = '';
    document.getElementById('projClient').value = '';
    document.getElementById('projManager').value = '';
    document.getElementById('projBudget').value = '';
    document.getElementById('projContract').value = '';
    document.getElementById('projScope').value = '';
    document.getElementById('projDeptInfo').style.display = 'none';

    openModal('projectModal');
}

function onProjDeptChange() {
    const deptId = document.getElementById('projDept').value;
    const d = deptDB[deptId];
    const mgrInput = document.getElementById('projManager');
    const infoDiv = document.getElementById('projDeptInfo');
    const detailDiv = document.getElementById('projDeptDetail');

    if (d) {
        mgrInput.value = d.head;
        infoDiv.style.display = 'block';
        detailDiv.innerHTML = `<strong>${d.nameTh}</strong> (${d.nameEn})<br>
            หัวหน้า: ${d.head} — ${d.headTitle} | ${d.qualification||''}<br>
            พนักงาน: ${d.employees} คน (วิศวกร ${d.engineers||0} / แรงงาน ${d.laborers||0}) | ที่ตั้ง: ${d.location}<br>
            งบคงเหลือ: ฿${(d.budget-d.used).toLocaleString()} จาก ฿${d.budget.toLocaleString()}`;
    } else {
        mgrInput.value = '';
        infoDiv.style.display = 'none';
    }
}

function submitProject() {
    const name = document.getElementById('projName').value;
    const deptId = document.getElementById('projDept').value;
    const budget = parseFloat(document.getElementById('projBudget').value);
    const start = document.getElementById('projStart').value;
    const end = document.getElementById('projEnd').value;
    if (!name || !deptId || !budget || !start || !end) return toast('⚠️ กรุณากรอกข้อมูลที่จำเป็น');

    const supportDepts = [];
    document.querySelectorAll('.proj-support-cb:checked').forEach(cb => supportDepts.push(cb.value));

    const now = new Date();
    const projId = `PROJ-${String(now.getFullYear()+543).slice(-2)}-${String(Object.keys(projectDB).length+1).padStart(3,'0')}`;

    projectDB[projId] = {
        name, type: document.getElementById('projType').value,
        location: document.getElementById('projLocation').value,
        client: document.getElementById('projClient').value,
        deptId, supportDepts,
        manager: document.getElementById('projManager').value,
        budget, used: 0,
        contract: parseFloat(document.getElementById('projContract').value)||0,
        start: formatThaiDate(start), end: formatThaiDate(end),
        status: document.getElementById('projStatus').value,
        priority: document.getElementById('projPriority').value,
        scope: document.getElementById('projScope').value
    };

    toast(`✅ สร้างโครงการ ${projId} สำเร็จ!`);
    closeModal('projectModal');
    renderProjectTable();
    renderProjectStats();
}

function formatThaiDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()+543).slice(-2)}`;
}

function viewProjectDetail(projId) {
    const p = projectDB[projId];
    if (!p) return toast('❌ ไม่พบข้อมูล');
    const pct = p.budget>0 ? Math.round(p.used/p.budget*100) : 0;
    const barColor = pct>80?'yellow':pct>60?'blue':'green';
    const deptName = getDeptName(p.deptId);
    const d = deptDB[p.deptId];
    const supportNames = (p.supportDepts||[]).map(id => getDeptName(id)).join(', ');
    const statusMap = {planning:'วางแผน',active:'กำลังดำเนินการ',onhold:'ระงับ',completed:'เสร็จสิ้น'};

    document.getElementById('prDetailTitle').textContent = `${projId} — ${p.name}`;
    document.getElementById('prDetailBody').innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title">🚧 ข้อมูลโครงการ</div>
            <div class="detail-grid">
                <div class="detail-item"><label>รหัส</label><div class="val cell-id">${projId}</div></div>
                <div class="detail-item"><label>ชื่อโครงการ</label><div class="val">${p.name}</div></div>
                <div class="detail-item"><label>สถานที่</label><div class="val">${p.location}</div></div>
                <div class="detail-item"><label>ลูกค้า</label><div class="val">${p.client||'-'}</div></div>
                <div class="detail-item"><label>สถานะ</label><div class="val">${statusMap[p.status]||p.status}</div></div>
                <div class="detail-item"><label>ระยะเวลา</label><div class="val">${p.start} — ${p.end}</div></div>
            </div>
            ${p.scope?`<div style="margin-top:10px;"><label style="font-size:11px;color:var(--text-muted);">ขอบเขตงาน:</label><div style="margin-top:4px;font-size:13px;color:var(--text-secondary);">${p.scope}</div></div>`:''}
        </div>
        <div class="detail-section">
            <div class="detail-section-title">🏗️ แผนกที่เกี่ยวข้อง</div>
            <div style="border:2px solid var(--accent);border-radius:var(--radius-sm);padding:14px 18px;margin-bottom:10px;background:var(--accent-light);">
                <div style="font-weight:700;color:var(--accent-dark);font-size:14px;">แผนกหลัก: ${deptName}</div>
                ${d?`<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">หัวหน้า: ${d.head} (${d.headTitle}) | ${d.employees} คน | งบ: ฿${d.budget.toLocaleString()}</div>`:''}
            </div>
            ${supportNames?`<div style="font-size:13px;color:var(--text-secondary);">แผนกสนับสนุน: <strong>${supportNames}</strong></div>`:''}
        </div>
        <div class="detail-section">
            <div class="detail-section-title">💰 งบประมาณ</div>
            <div class="detail-grid">
                <div class="detail-item"><label>งบประมาณ</label><div class="val cell-money">฿${p.budget.toLocaleString()}</div></div>
                <div class="detail-item"><label>มูลค่าสัญญา</label><div class="val cell-money">฿${(p.contract||0).toLocaleString()}</div></div>
                <div class="detail-item"><label>ใช้ไปแล้ว</label><div class="val cell-money">฿${p.used.toLocaleString()}</div></div>
                <div class="detail-item"><label>คงเหลือ</label><div class="val cell-money" style="color:var(--success);">฿${(p.budget-p.used).toLocaleString()}</div></div>
                <div class="detail-item"><label>สัดส่วน</label><div class="val"><div style="display:flex;align-items:center;gap:8px;"><div class="progress-bar" style="width:100px;"><div class="progress-bar-fill ${barColor}" style="width:${pct}%;"></div></div><span>${pct}%</span></div></div></div>
            </div>
        </div>
    `;
    openModal('prDetailModal');
}

// Initialize
// (renderProjectTable + renderProjectStats called by renderAllLinked above)

// ═══════════════════════════════════════
// ═══════════════════════════════════════
// ─── PRICE COMPARISON SYSTEM ───
// ═══════════════════════════════════════
const compareDB = {};
let compareVendorCount = 0;

function renderCompareTable() {
    const tbody = document.getElementById('compareTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const [id, c] of Object.entries(compareDB)) {
        const vendorNames = c.quotes.map(q => q.vendorName).join(', ');
        const prices = c.quotes.map(q => q.total);
        const minPrice = Math.min(...prices);
        const winner = c.selectedVendor || '-';
        const stCls = c.status === 'completed' ? 'approved' : c.status === 'selected' ? 'in-progress' : 'pending';
        const stText = c.status === 'completed' ? 'เสร็จสิ้น' : c.status === 'selected' ? 'เลือกแล้ว' : 'รอเปรียบเทียบ';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="cell-id">${id}</td>
            <td class="cell-id">${c.prRef}</td>
            <td style="font-size:12px;">${c.itemsSummary}</td>
            <td style="font-size:12px;">${vendorNames}</td>
            <td class="cell-money" style="color:var(--success);">฿${minPrice.toLocaleString()}</td>
            <td><strong>${winner}</strong></td>
            <td style="font-size:12px;">${c.date}</td>
            <td><span class="badge ${stCls}">${stText}</span></td>
            <td class="actions">
                <button class="act-btn view" onclick="viewCompareDetail('${id}')">ดู</button>
                <button class="act-btn edit" style="background:var(--danger-bg);color:var(--danger);" onclick="deleteCompare('${id}')">ลบ</button>
            </td>`;
        tbody.appendChild(tr);
    }
}

function renderCompareStats() {
    const el = document.getElementById('compareStats');
    if (!el) return;
    const items = Object.values(compareDB);
    const total = items.length;
    const completed = items.filter(c => c.status === 'completed' || c.status === 'selected').length;
    const pending = total - completed;
    const totalSaved = items.reduce((s, c) => {
        if (c.quotes.length < 2) return s;
        const prices = c.quotes.map(q => q.total);
        return s + (Math.max(...prices) - Math.min(...prices));
    }, 0);
    el.innerHTML = `
        <div class="stat-card budget"><div class="stat-top"><div class="stat-label">ใบเปรียบเทียบทั้งหมด</div><div class="stat-icon">⚖️</div></div><div class="stat-value">${total}</div><div class="stat-sub">${completed} เสร็จแล้ว</div></div>
        <div class="stat-card pending"><div class="stat-top"><div class="stat-label">รอเปรียบเทียบ</div><div class="stat-icon">⏳</div></div><div class="stat-value">${pending}</div><div class="stat-sub">ยังไม่เลือกผู้ขาย</div></div>
        <div class="stat-card approved"><div class="stat-top"><div class="stat-label">ส่วนต่างราคาที่ประหยัด</div><div class="stat-icon">💰</div></div><div class="stat-value">฿${totalSaved.toLocaleString()}</div><div class="stat-sub">จากการเปรียบเทียบ</div></div>
    `;
}

function openCompareModal() {
    compareVendorCount = 0;
    document.getElementById('compareStep2').style.display = 'none';
    document.getElementById('compareSubmitBtn').disabled = true;
    document.getElementById('compareSummarySection').style.display = 'none';
    
    // Populate PR dropdown
    const sel = document.getElementById('comparePRSelect');
    sel.innerHTML = '<option value="">-- เลือก PR --</option>';
    for (const [num, pr] of Object.entries(prDB)) {
        sel.innerHTML += `<option value="${num}">${num} — ${pr.title} (฿${pr.total.toLocaleString()})</option>`;
    }
    document.getElementById('comparePRItems').style.display = 'none';
    document.getElementById('compareVendorQuotes').innerHTML = '';
    openModal('compareModal');
}

function onComparePRSelect() {
    const prNum = document.getElementById('comparePRSelect').value;
    const pr = prDB[prNum];
    const itemsDiv = document.getElementById('comparePRItems');
    
    if (!pr) { itemsDiv.style.display = 'none'; document.getElementById('compareStep2').style.display = 'none'; return; }
    
    itemsDiv.style.display = 'block';
    itemsDiv.innerHTML = `<div class="items-wrap"><table>
        <thead><tr><th>#</th><th>รายการ</th><th>จำนวน</th><th>หน่วย</th><th>ราคา PR</th><th>รวม</th></tr></thead>
        <tbody>${pr.items.map((it,i) => `<tr><td>${i+1}</td><td>${it.desc}</td><td style="text-align:center;">${it.qty}</td><td style="text-align:center;">${it.unit}</td><td class="cell-money">฿${it.price.toLocaleString()}</td><td class="cell-money">฿${it.total.toLocaleString()}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="5" style="text-align:right;font-weight:700;">รวม PR:</td><td class="cell-money" style="color:var(--accent);">฿${pr.total.toLocaleString()}</td></tr></tfoot>
    </table></div>`;
    
    document.getElementById('compareStep2').style.display = 'block';
    document.getElementById('compareVendorQuotes').innerHTML = '';
    compareVendorCount = 0;
    addCompareVendor();
    addCompareVendor();
}

function addCompareVendor() {
    compareVendorCount++;
    const prNum = document.getElementById('comparePRSelect').value;
    const pr = prDB[prNum];
    if (!pr) return;
    
    const vendorOpts = Object.entries(vendors).map(([id,v]) => {
        // Show how many items this vendor has in catalog
        const matchCount = pr.items.filter(it => findCatalogPrice(id, it.desc) !== null).length;
        const badge = matchCount > 0 ? ` (มี ${matchCount}/${pr.items.length} รายการ)` : ' (ไม่มีในราคา)';
        return `<option value="${id}">${v.name}${badge}</option>`;
    }).join('');
    const idx = compareVendorCount;
    
    const div = document.createElement('div');
    div.id = `compareVendor_${idx}`;
    div.style.cssText = 'border:2px solid var(--border);border-radius:var(--radius-sm);padding:16px;margin-bottom:12px;position:relative;';
    div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <strong style="color:var(--accent);">ผู้ขายรายที่ ${idx}</strong>
            ${idx > 2 ? `<button class="btn-rm-row" onclick="document.getElementById('compareVendor_${idx}').remove();updateCompareSummary()">×</button>` : ''}
        </div>
        <div class="form-row">
            <div class="form-group"><label>ผู้ขาย <span class="req">*</span></label>
                <select class="cmp-vendor-select" data-idx="${idx}" onchange="autofillCatalogPrices(${idx});updateCompareSummary()">
                    <option value="">-- เลือก --</option>${vendorOpts}
                </select>
            </div>
            <div class="form-group"><label>เลขที่ใบเสนอราคา</label><input type="text" class="cmp-quote-num" data-idx="${idx}" placeholder="เช่น QT-2025-001"></div>
            <div class="form-group"><label>ระยะส่งมอบ</label><input type="text" class="cmp-delivery" data-idx="${idx}" placeholder="เช่น 3 วัน"></div>
        </div>
        <div class="cmp-autofill-msg" data-idx="${idx}" style="display:none;font-size:11px;padding:6px 10px;border-radius:6px;margin-bottom:6px;"></div>
        <div style="font-size:12px;font-weight:600;margin:8px 0 4px;">ราคาแต่ละรายการ:</div>
        <div class="items-wrap"><table>
            <thead><tr><th>รายการ</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>รวม</th></tr></thead>
            <tbody>
                ${pr.items.map((it, i) => `<tr>
                    <td style="font-size:12px;">${it.desc}</td>
                    <td style="text-align:center;">${it.qty} ${it.unit}</td>
                    <td><input type="number" class="cmp-price" data-idx="${idx}" data-item="${i}" value="0" min="0" step="0.01" onchange="calcCompareRow(this)" style="width:90px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;text-align:right;font-size:12px;"></td>
                    <td class="cell-money cmp-row-total" data-idx="${idx}" data-item="${i}">฿0</td>
                </tr>`).join('')}
            </tbody>
            <tfoot><tr><td colspan="3" style="text-align:right;font-weight:700;">รวมทั้งหมด:</td><td class="cell-money cmp-vendor-total" data-idx="${idx}" style="color:var(--accent);font-weight:700;">฿0</td></tr></tfoot>
        </table></div>
        <div class="form-group" style="margin-top:8px;"><label>หมายเหตุ</label><input type="text" class="cmp-remark" data-idx="${idx}" placeholder="เช่น ฟรีค่าขนส่ง, รับประกัน 1 ปี"></div>
    `;
    document.getElementById('compareVendorQuotes').appendChild(div);
    updateCompareSummary();
}

// ─── Auto-fill prices from vendor catalog ───
function autofillCatalogPrices(idx) {
    const container = document.getElementById(`compareVendor_${idx}`);
    if (!container) return;
    const vendorSel = container.querySelector('.cmp-vendor-select');
    const vendorId = vendorSel?.value;
    if (!vendorId) return;
    
    const prNum = document.getElementById('comparePRSelect').value;
    const pr = prDB[prNum];
    if (!pr) return;
    
    let filledCount = 0;
    let totalFilled = 0;
    const priceInputs = container.querySelectorAll('.cmp-price');
    
    priceInputs.forEach((inp, i) => {
        const item = pr.items[i];
        if (!item) return;
        const catalogPrice = findCatalogPrice(vendorId, item.desc);
        if (catalogPrice !== null) {
            inp.value = catalogPrice;
            inp.style.borderColor = 'var(--success)';
            inp.style.background = '#f0fdf4';
            filledCount++;
            totalFilled += item.qty * catalogPrice;
            // Update row total
            const totalEl = document.querySelector(`.cmp-row-total[data-idx="${idx}"][data-item="${i}"]`);
            if (totalEl) totalEl.textContent = '฿' + (item.qty * catalogPrice).toLocaleString();
        } else {
            inp.value = 0;
            inp.style.borderColor = 'var(--danger)';
            inp.style.background = '#fef2f2';
        }
    });
    
    // Update vendor total
    const vtEl = container.querySelector('.cmp-vendor-total');
    if (vtEl) vtEl.textContent = '฿' + totalFilled.toLocaleString();
    
    // Show autofill message
    const msgEl = container.querySelector('.cmp-autofill-msg');
    if (msgEl) {
        msgEl.style.display = 'block';
        if (filledCount === pr.items.length) {
            msgEl.style.background = 'var(--success-bg)';
            msgEl.style.color = '#065f46';
            msgEl.textContent = `✅ ดึงราคาอัตโนมัติครบ ${filledCount}/${pr.items.length} รายการ จากราคาร้านค้า`;
        } else if (filledCount > 0) {
            msgEl.style.background = 'var(--warning-bg)';
            msgEl.style.color = '#92400e';
            msgEl.textContent = `⚠️ ดึงราคาได้ ${filledCount}/${pr.items.length} รายการ — รายการที่เหลือกรุณาใส่ราคาเอง (พื้นแดง)`;
        } else {
            msgEl.style.background = 'var(--danger-bg)';
            msgEl.style.color = '#991b1b';
            msgEl.textContent = `❌ ไม่พบราคาในร้านนี้ — กรุณาใส่ราคาเอง`;
        }
    }
}

function calcCompareRow(el) {
    const idx = el.dataset.idx;
    const itemIdx = parseInt(el.dataset.item);
    const prNum = document.getElementById('comparePRSelect').value;
    const pr = prDB[prNum];
    if (!pr) return;
    const qty = pr.items[itemIdx].qty;
    const price = parseFloat(el.value) || 0;
    const total = qty * price;
    const totalEl = document.querySelector(`.cmp-row-total[data-idx="${idx}"][data-item="${itemIdx}"]`);
    if (totalEl) totalEl.textContent = '฿' + total.toLocaleString();
    // Recalc vendor total
    let vendorTotal = 0;
    document.querySelectorAll(`.cmp-price[data-idx="${idx}"]`).forEach((inp, i) => {
        vendorTotal += (pr.items[i]?.qty || 0) * (parseFloat(inp.value) || 0);
    });
    const vtEl = document.querySelector(`.cmp-vendor-total[data-idx="${idx}"]`);
    if (vtEl) vtEl.textContent = '฿' + vendorTotal.toLocaleString();
    updateCompareSummary();
}

function updateCompareSummary() {
    const prNum = document.getElementById('comparePRSelect').value;
    const pr = prDB[prNum];
    if (!pr) return;
    
    const quotes = [];
    for (let idx = 1; idx <= compareVendorCount; idx++) {
        const container = document.getElementById(`compareVendor_${idx}`);
        if (!container) continue;
        const vendorSel = container.querySelector('.cmp-vendor-select');
        const vendorId = vendorSel?.value;
        if (!vendorId) continue;
        const v = vendors[vendorId];
        let total = 0;
        const itemPrices = [];
        container.querySelectorAll('.cmp-price').forEach((inp, i) => {
            const p = parseFloat(inp.value) || 0;
            const t = (pr.items[i]?.qty || 0) * p;
            itemPrices.push({ price: p, total: t });
            total += t;
        });
        quotes.push({
            idx, vendorId, vendorName: v?.name || '-', total, itemPrices,
            quoteNum: container.querySelector('.cmp-quote-num')?.value || '',
            delivery: container.querySelector('.cmp-delivery')?.value || '',
            remark: container.querySelector('.cmp-remark')?.value || ''
        });
    }
    
    const section = document.getElementById('compareSummarySection');
    const summary = document.getElementById('compareSummary');
    const btn = document.getElementById('compareSubmitBtn');
    
    if (quotes.length < 2) {
        section.style.display = 'none';
        btn.disabled = true;
        return;
    }
    
    section.style.display = 'block';
    const minTotal = Math.min(...quotes.map(q => q.total));
    const maxTotal = Math.max(...quotes.map(q => q.total));
    const saved = maxTotal - minTotal;
    
    let html = `<div class="items-wrap"><table>
        <thead><tr><th>รายการ</th><th>จำนวน</th>`;
    quotes.forEach(q => { html += `<th style="text-align:right;">${q.vendorName}</th>`; });
    html += `<th style="text-align:right;">ส่วนต่าง</th></tr></thead><tbody>`;
    
    pr.items.forEach((it, i) => {
        const prices = quotes.map(q => q.itemPrices[i]?.price || 0);
        const minP = Math.min(...prices);
        html += `<tr><td style="font-size:12px;">${it.desc}</td><td style="text-align:center;">${it.qty} ${it.unit}</td>`;
        quotes.forEach(q => {
            const p = q.itemPrices[i]?.price || 0;
            const isMin = p === minP && p > 0;
            html += `<td style="text-align:right;font-family:var(--font-mono);font-size:12px;${isMin?'color:var(--success);font-weight:700;':''}">${isMin?'✓ ':''}฿${p.toLocaleString()}</td>`;
        });
        const diff = Math.max(...prices) - Math.min(...prices);
        html += `<td style="text-align:right;font-size:12px;color:var(--danger);">฿${diff.toLocaleString()}</td></tr>`;
    });
    
    html += `</tbody><tfoot><tr><td colspan="2" style="text-align:right;font-weight:700;">รวมทั้งหมด:</td>`;
    quotes.forEach(q => {
        const isMin = q.total === minTotal;
        html += `<td style="text-align:right;font-family:var(--font-mono);font-weight:700;font-size:14px;${isMin?'color:var(--success);background:var(--success-bg);':''}">${isMin?'⭐ ':''}฿${q.total.toLocaleString()}</td>`;
    });
    html += `<td style="text-align:right;font-weight:700;color:var(--danger);">฿${saved.toLocaleString()}</td></tr></tfoot></table></div>`;
    
    // Vendor selection
    html += `<div style="margin-top:16px;"><strong>🏆 เลือกผู้ขายที่ดีที่สุด:</strong></div>
    <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;">`;
    quotes.forEach(q => {
        const isMin = q.total === minTotal;
        html += `<label style="display:flex;align-items:center;gap:8px;padding:10px 16px;border:2px solid ${isMin?'var(--success)':'var(--border)'};border-radius:var(--radius-sm);cursor:pointer;background:${isMin?'var(--success-bg)':'#fff'};">
            <input type="radio" name="selectedVendor" value="${q.vendorName}" ${isMin?'checked':''} onchange="document.getElementById('compareSubmitBtn').disabled=false;">
            <div>
                <div style="font-weight:700;">${q.vendorName}</div>
                <div style="font-family:var(--font-mono);font-size:14px;font-weight:700;color:var(--accent);">฿${q.total.toLocaleString()}</div>
                <div style="font-size:11px;color:var(--text-muted);">${q.delivery?'ส่ง: '+q.delivery:''} ${q.remark?'| '+q.remark:''}</div>
            </div>
            ${isMin?'<span class="badge approved" style="font-size:10px;">ราคาต่ำสุด</span>':''}
        </label>`;
    });
    html += `</div>`;
    
    summary.innerHTML = html;
    btn.disabled = false;
}

function submitCompare() {
    const prNum = document.getElementById('comparePRSelect').value;
    if (!prNum) return toast('⚠️ กรุณาเลือก PR');
    const pr = prDB[prNum];
    const selectedRadio = document.querySelector('input[name="selectedVendor"]:checked');
    if (!selectedRadio) return toast('⚠️ กรุณาเลือกผู้ขาย');
    
    // Collect quotes
    const quotes = [];
    for (let idx = 1; idx <= compareVendorCount; idx++) {
        const container = document.getElementById(`compareVendor_${idx}`);
        if (!container) continue;
        const vendorSel = container.querySelector('.cmp-vendor-select');
        if (!vendorSel?.value) continue;
        const v = vendors[vendorSel.value];
        let total = 0;
        container.querySelectorAll('.cmp-price').forEach((inp, i) => { total += (pr.items[i]?.qty||0) * (parseFloat(inp.value)||0); });
        quotes.push({
            vendorName: v?.name||'-', total,
            quoteNum: container.querySelector('.cmp-quote-num')?.value||'',
            delivery: container.querySelector('.cmp-delivery')?.value||'',
            remark: container.querySelector('.cmp-remark')?.value||''
        });
    }
    
    const now = new Date();
    const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const dateStr = `${now.getDate()} ${thMonths[now.getMonth()]} ${String(now.getFullYear()+543).slice(-2)}`;
    const cmpNum = `CMP-${String(now.getFullYear()).slice(-2)}${String(now.getMonth()+1).padStart(2,'0')}-${String(Object.keys(compareDB).length+1).padStart(3,'0')}`;
    
    compareDB[cmpNum] = {
        prRef: prNum,
        itemsSummary: pr.items.map(it=>it.desc).join(', ').substring(0,60)+'...',
        quotes,
        selectedVendor: selectedRadio.value,
        notes: document.getElementById('compareNotes')?.value||'',
        date: dateStr,
        status: 'selected',
        createdBy: currentUser?.name||'ระบบ'
    };
    
    closeModal('compareModal');
    renderCompareTable();
    renderCompareStats();
    toast(`✅ บันทึก ${cmpNum} สำเร็จ — เลือก ${selectedRadio.value}`);
}

function deleteCompare(id) {
    if (!confirm(`⚠️ ลบใบเปรียบเทียบ ${id}?`)) return;
    delete compareDB[id];
    renderCompareTable();
    renderCompareStats();
    toast(`🗑️ ลบ ${id} สำเร็จ`);
}

function viewCompareDetail(id) {
    const c = compareDB[id];
    if (!c) return toast('❌ ไม่พบข้อมูล');
    const minTotal = Math.min(...c.quotes.map(q=>q.total));
    document.getElementById('prDetailTitle').textContent = `⚖️ ${id} — เปรียบเทียบราคา`;
    document.getElementById('prDetailBody').innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title">📋 ข้อมูลเปรียบเทียบ</div>
            <div class="detail-grid">
                <div class="detail-item"><label>เลขที่</label><div class="val cell-id">${id}</div></div>
                <div class="detail-item"><label>อ้างอิง PR</label><div class="val cell-id">${c.prRef}</div></div>
                <div class="detail-item"><label>วันที่</label><div class="val">${c.date}</div></div>
                <div class="detail-item"><label>ผู้ขายที่เลือก</label><div class="val" style="color:var(--success);font-weight:700;">🏆 ${c.selectedVendor}</div></div>
                <div class="detail-item"><label>สร้างโดย</label><div class="val">${c.createdBy}</div></div>
            </div>
            ${c.notes?`<div style="margin-top:10px;"><label style="font-size:11px;color:var(--text-muted);">หมายเหตุ:</label><div>${c.notes}</div></div>`:''}
        </div>
        <div class="detail-section">
            <div class="detail-section-title">💰 ใบเสนอราคาแต่ละราย</div>
            ${c.quotes.map(q => {
                const isWinner = q.vendorName === c.selectedVendor;
                return `<div style="border:2px solid ${isWinner?'var(--success)':'var(--border)'};border-radius:var(--radius-sm);padding:14px;margin-bottom:10px;background:${isWinner?'var(--success-bg)':''};">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div><strong>${q.vendorName}</strong> ${isWinner?'<span class="badge approved">เลือก</span>':''}<br>
                        <span style="font-size:11px;color:var(--text-muted);">${q.quoteNum?'เลขที่: '+q.quoteNum:''} ${q.delivery?'| ส่ง: '+q.delivery:''} ${q.remark?'| '+q.remark:''}</span></div>
                        <div style="font-family:var(--font-mono);font-weight:800;font-size:18px;color:${isWinner?'var(--success)':'var(--accent)'};">฿${q.total.toLocaleString()}</div>
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
    openModal('prDetailModal');
}

renderCompareTable();
renderCompareStats();

// ─── GOODS RECEIPT (GRN) SYSTEM ───
// ═══════════════════════════════════════

function renderGRNPage() {
    // Find POs that need goods receipt (not completed GRN)
    const pendingBody = document.getElementById('grnPendingBody');
    const historyBody = document.getElementById('grnHistoryBody');
    if (!pendingBody || !historyBody) return;

    let pendingCount = 0, doneCount = 0, partialCount = 0, rejectedCount = 0;
    pendingBody.innerHTML = '';

    for (const [poNum, po] of Object.entries(poDatabase)) {
        // Check how many items are received
        const grnForPO = Object.values(grnDatabase).filter(g => g.poRef === poNum);
        const receivedItems = grnForPO.reduce((s, g) => s + g.items.length, 0);
        const totalItems = po.items ? po.items.length : 0;
        const allReceived = receivedItems >= totalItems && grnForPO.length > 0;
        const someReceived = receivedItems > 0 && !allReceived;

        if (allReceived) {
            doneCount++;
        } else if (someReceived) {
            partialCount++;
        } else {
            pendingCount++;
        }

        if (!allReceived) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="cell-id">${poNum}</td>
                <td>${po.vendor}</td>
                <td style="font-size:12px;">${(po.items||[]).map(it=>it.desc).join(', ')}</td>
                <td class="cell-money">฿${po.total.toLocaleString()}</td>
                <td>${po.deliveryDate || '-'}</td>
                <td>${someReceived
                    ? `<span class="badge in-progress">รับแล้ว ${receivedItems}/${totalItems}</span>`
                    : `<span class="badge pending">รอรับสินค้า</span>`}</td>
                <td><button class="btn btn-primary" style="padding:5px 14px;font-size:12px;" onclick="openGRNForm('${poNum}')">📦 รับสินค้า</button></td>
            `;
            pendingBody.appendChild(tr);
        }
    }

    // GRN History
    historyBody.innerHTML = '';
    for (const [grnNum, grn] of Object.entries(grnDatabase)) {
        const statusCls = grn.status === 'received' ? 'approved' : grn.status === 'partial' ? 'in-progress' : 'rejected';
        const statusText = grn.status === 'received' ? 'รับครบ' : grn.status === 'partial' ? 'รับบางส่วน' : 'ตีกลับ';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="cell-id">${grnNum}</td>
            <td class="cell-id">${grn.poRef}</td>
            <td>${grn.vendor}</td>
            <td>${grn.date}</td>
            <td class="cell-money">฿${grn.total.toLocaleString()}</td>
            <td>${grn.receiver}</td>
            <td><span class="badge ${statusCls}">${statusText}</span></td>
            <td class="actions"><button class="act-btn view" onclick="viewGRNDetail('${grnNum}')">ดู</button></td>
        `;
        historyBody.appendChild(tr);
    }
    rejectedCount = Object.values(grnDatabase).filter(g => g.status === 'rejected').length;

    // Update stats
    const setS = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
    setS('grnPendingStat', pendingCount);
    setS('grnDoneStat', doneCount);
    setS('grnPartialStat', partialCount);
    setS('grnRejectedStat', rejectedCount);
}

function openGRNForm(poNum) {
    const po = poDatabase[poNum];
    if (!po) return toast('❌ ไม่พบข้อมูล PO');

    // Find items already received
    const grnForPO = Object.values(grnDatabase).filter(g => g.poRef === poNum);
    const receivedDescs = grnForPO.flatMap(g => g.items.map(it => it.desc));
    const remainItems = (po.items||[]).filter(it => !receivedDescs.includes(it.desc));

    if (remainItems.length === 0) return toast('✅ PO นี้รับสินค้าครบแล้ว');

    // Build modal content
    document.getElementById('prDetailTitle').textContent = `📦 รับสินค้า — ${poNum}`;
    document.getElementById('prDetailBody').innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:14px 18px;background:var(--accent-light);border-radius:var(--radius-sm);">
            <div>
                <div style="font-weight:700;color:var(--accent-dark);">${poNum} — ${po.vendor}</div>
                <div style="font-size:12px;color:var(--text-muted);">กำหนดส่ง: ${po.deliveryDate} | เงื่อนไข: ${po.payTerms}</div>
            </div>
            <div style="margin-left:auto;font-family:var(--font-mono);font-weight:800;color:var(--accent);">฿${po.total.toLocaleString()}</div>
        </div>

        <div style="font-weight:700;margin-bottom:10px;">📋 เลือกรายการที่รับ (เหลือ ${remainItems.length} รายการ)</div>
        <div class="items-wrap"><table>
            <thead><tr>
                <th style="width:30px;"><input type="checkbox" checked onchange="document.querySelectorAll('.grn-item-check').forEach(c=>c.checked=this.checked)"></th>
                <th>#</th><th>รายการ</th><th>จำนวน PO</th><th>จำนวนที่รับ</th><th>หน่วย</th><th>สถานะ</th>
            </tr></thead>
            <tbody>
                ${remainItems.map((it, i) => `<tr>
                    <td style="text-align:center;"><input type="checkbox" checked class="grn-item-check" data-idx="${i}"></td>
                    <td style="text-align:center;">${i+1}</td>
                    <td>${it.desc}</td>
                    <td style="text-align:center;font-weight:600;">${it.qty}</td>
                    <td style="text-align:center;"><input type="number" value="${it.qty}" min="0" max="${it.qty}" class="grn-item-qty" data-idx="${i}" style="width:60px;padding:4px 8px;border:1.5px solid var(--border);border-radius:6px;text-align:center;font-size:13px;"></td>
                    <td style="text-align:center;">${it.unit}</td>
                    <td><select class="grn-item-status" data-idx="${i}" style="padding:4px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--font-th);">
                        <option value="ok">✅ ผ่าน — สมบูรณ์</option>
                        <option value="damaged">⚠️ ชำรุด — รับบางส่วน</option>
                        <option value="reject">❌ ตีกลับ — ไม่รับ</option>
                    </select></td>
                </tr>`).join('')}
            </tbody>
        </table></div>

        <div class="form-section" style="margin-top:16px;">
            <div class="form-row">
                <div class="form-group"><label>ผู้รับสินค้า <span class="req">*</span></label><input type="text" id="grnReceiver" placeholder="ชื่อ-นามสกุล ผู้ตรวจรับ" value=""></div>
                <div class="form-group"><label>วันที่รับ</label><input type="date" id="grnDate" value="${new Date().toISOString().split('T')[0]}"></div>
            </div>
            <div class="form-group"><label>หมายเหตุ</label><textarea id="grnNotes" rows="2" placeholder="บันทึกการรับสินค้า เช่น สินค้าครบ, ตรงตามสเปค" style="padding:10px 14px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-th);font-size:13px;width:100%;"></textarea></div>
        </div>

        <div style="display:flex;gap:10px;margin-top:16px;">
            <button class="btn btn-success" style="flex:1;justify-content:center;padding:14px;" onclick="submitGRN('${poNum}','received')">✅ รับสินค้าครบ</button>
            <button class="btn btn-primary" style="flex:1;justify-content:center;padding:14px;" onclick="submitGRN('${poNum}','partial')">📦 รับบางส่วน</button>
            <button class="btn btn-danger" style="flex:1;justify-content:center;padding:14px;" onclick="submitGRN('${poNum}','rejected')">🔄 ตีกลับทั้งหมด</button>
        </div>
    `;
    openModal('prDetailModal');
}

function submitGRN(poNum, status) {
    const receiver = document.getElementById('grnReceiver')?.value;
    if (!receiver) return toast('⚠️ กรุณาระบุผู้รับสินค้า');

    const po = poDatabase[poNum];
    const grnForPO = Object.values(grnDatabase).filter(g => g.poRef === poNum);
    const receivedDescs = grnForPO.flatMap(g => g.items.map(it => it.desc));
    const remainItems = (po.items||[]).filter(it => !receivedDescs.includes(it.desc));

    // Collect checked items
    const checkedItems = [];
    document.querySelectorAll('.grn-item-check').forEach(cb => {
        if (cb.checked) {
            const idx = parseInt(cb.dataset.idx);
            const qtyInput = document.querySelector(`.grn-item-qty[data-idx="${idx}"]`);
            const statusSel = document.querySelector(`.grn-item-status[data-idx="${idx}"]`);
            checkedItems.push({
                ...remainItems[idx],
                receivedQty: parseInt(qtyInput?.value) || 0,
                itemStatus: statusSel?.value || 'ok'
            });
        }
    });

    if (checkedItems.length === 0) return toast('⚠️ กรุณาเลือกรายการอย่างน้อย 1 รายการ');

    const now = new Date();
    const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const dateStr = `${now.getDate()} ${thMonths[now.getMonth()]} ${String(now.getFullYear()+543).slice(-2)}`;
    const grnNum = `GRN-${String(now.getFullYear()).slice(-2)}${String(now.getMonth()+1).padStart(2,'0')}-${String(Object.keys(grnDatabase).length + 1).padStart(3,'0')}`;

    grnDatabase[grnNum] = {
        poRef: poNum,
        vendor: po.vendor,
        date: dateStr,
        total: checkedItems.reduce((s, it) => s + it.total, 0),
        receiver: receiver,
        status: status,
        notes: document.getElementById('grnNotes')?.value || '',
        items: checkedItems
    };

    // Update PO status if fully received
    const allGRN = Object.values(grnDatabase).filter(g => g.poRef === poNum);
    const totalReceived = allGRN.reduce((s, g) => s + g.items.length, 0);
    if (totalReceived >= (po.items||[]).length) {
        po.statusText = 'เสร็จสิ้น';
        po.statusCls = 'completed';
        renderPOTable();
    }

    closeModal('prDetailModal');
    renderGRNPage();
    if (typeof renderExportTables === 'function') renderExportTables();

    // Sync GRN to Google Sheets
    saveGRNToGoogleSheets({ grnNumber: grnNum, ...grnDatabase[grnNum] });

    // Auto-save GRN PDF to Google Drive
    autoSaveGRNPdf(grnNum);

    const statusLabel = status === 'received' ? 'รับครบ' : status === 'partial' ? 'รับบางส่วน' : 'ตีกลับ';
    toast(`✅ ${grnNum} — ${statusLabel} — ${checkedItems.length} รายการ`);
}

function viewGRNDetail(grnNum) {
    const grn = grnDatabase[grnNum];
    if (!grn) return toast('❌ ไม่พบข้อมูล');
    const statusCls = grn.status === 'received' ? 'approved' : grn.status === 'partial' ? 'in-progress' : 'rejected';
    const statusText = grn.status === 'received' ? 'รับครบ' : grn.status === 'partial' ? 'รับบางส่วน' : 'ตีกลับ';

    document.getElementById('prDetailTitle').textContent = `รายละเอียด ${grnNum}`;
    document.getElementById('prDetailBody').innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title">📦 ข้อมูลการรับสินค้า</div>
            <div class="detail-grid">
                <div class="detail-item"><label>เลขที่ GRN</label><div class="val cell-id">${grnNum}</div></div>
                <div class="detail-item"><label>อ้างอิง PO</label><div class="val cell-id">${grn.poRef}</div></div>
                <div class="detail-item"><label>ผู้ขาย</label><div class="val">${grn.vendor}</div></div>
                <div class="detail-item"><label>วันที่รับ</label><div class="val">${grn.date}</div></div>
                <div class="detail-item"><label>ผู้รับ</label><div class="val">${grn.receiver}</div></div>
                <div class="detail-item"><label>สถานะ</label><div class="val"><span class="badge ${statusCls}">${statusText}</span></div></div>
                <div class="detail-item"><label>มูลค่า</label><div class="val cell-money" style="font-size:16px;color:var(--accent);">฿${grn.total.toLocaleString()}</div></div>
            </div>
            ${grn.notes ? `<div style="margin-top:10px;"><label style="font-size:11px;color:var(--text-muted);">หมายเหตุ:</label><div style="margin-top:4px;">${grn.notes}</div></div>` : ''}
        </div>
        <div class="detail-section">
            <div class="detail-section-title">🛒 รายการที่รับ</div>
            <table class="detail-table">
                <thead><tr><th>#</th><th>รายการ</th><th>จำนวน PO</th><th>จำนวนรับ</th><th>หน่วย</th><th>สถานะ</th></tr></thead>
                <tbody>${grn.items.map((it,i) => {
                    const stCls = it.itemStatus === 'ok' ? 'approved' : it.itemStatus === 'damaged' ? 'pending' : 'rejected';
                    const stTxt = it.itemStatus === 'ok' ? 'ผ่าน' : it.itemStatus === 'damaged' ? 'ชำรุด' : 'ตีกลับ';
                    return `<tr><td>${i+1}</td><td>${it.desc}</td><td style="text-align:center;">${it.qty}</td><td style="text-align:center;font-weight:600;">${it.receivedQty}</td><td>${it.unit}</td><td><span class="badge ${stCls}">${stTxt}</span></td></tr>`;
                }).join('')}</tbody>
            </table>
        </div>
    `;
    openModal('prDetailModal');
}

// Initialize GRN on page load
renderGRNPage();

// Re-render GRN when navigating to it
const origGo = go;
go = function(section) {
    origGo(section);
    if (section === 'grn') renderGRNPage();
    if (section === 'compare') { renderCompareTable(); renderCompareStats(); }
    if (section === 'dashboard') { renderDashStats(); renderDashPR(); }
    if (section === 'users') { renderUsersTable(); renderUserStats(); }
    if (section === 'vendors') { renderVendorsTable(); renderVendorStats(); }
    if (section === 'projects' || section === 'budget' || section === 'departments') renderAllLinked();
    if (section === 'settings') { updateHeaderPreview(); initGASUI(); }
};

// ═══════════════════════════════════════
// ─── COMPANY SETTINGS (Logo + Info) ───
// ═══════════════════════════════════════
let companyLogo = null; // base64

function handleLogoUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('⚠️ กรุณาเลือกไฟล์รูปภาพ');
    if (file.size > 5 * 1024 * 1024) return toast('⚠️ ไฟล์ใหญ่เกิน 5MB');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        companyLogo = e.target.result;
        document.getElementById('logoImg').src = companyLogo;
        document.getElementById('logoImg').style.display = 'block';
        document.getElementById('logoPlaceholder').style.display = 'none';
        document.getElementById('logoPreviewBox').style.borderStyle = 'solid';
        document.getElementById('logoPreviewBox').style.borderColor = 'var(--success)';
        toast('✅ อัปโหลดโลโก้สำเร็จ!');
        updateHeaderPreview();
    };
    reader.readAsDataURL(file);
}

function removeLogo() {
    companyLogo = null;
    document.getElementById('logoImg').src = '';
    document.getElementById('logoImg').style.display = 'none';
    document.getElementById('logoPlaceholder').style.display = '';
    document.getElementById('logoPreviewBox').style.borderStyle = 'dashed';
    document.getElementById('logoPreviewBox').style.borderColor = 'var(--border)';
    toast('🗑️ ลบโลโก้แล้ว');
    updateHeaderPreview();
}

function getCompanySettings() {
    return {
        nameTh: document.getElementById('compNameTh')?.value || 'บริษัท ตัวอย่าง จำกัด',
        nameEn: document.getElementById('compNameEn')?.value || 'EXAMPLE COMPANY LIMITED',
        taxId: document.getElementById('compTaxId')?.value || '0-1234-56789-01-2',
        branch: document.getElementById('compBranch')?.value || 'สำนักงานใหญ่',
        addr1: document.getElementById('compAddr1')?.value || '123 ถนนพระราม 4 แขวงสีลม เขตบางรัก',
        addr2: document.getElementById('compAddr2')?.value || 'กรุงเทพมหานคร 10500',
        phone: document.getElementById('compPhone')?.value || '02-123-4567',
        fax: document.getElementById('compFax')?.value || '02-123-4568',
        email: document.getElementById('compEmail')?.value || '',
        website: document.getElementById('compWebsite')?.value || '',
        logo: companyLogo
    };
}

function saveCompanySettings() {
    updateHeaderPreview();
}

function updateHeaderPreview() {
    const c = getCompanySettings();
    const preview = document.getElementById('headerPreview');
    if (!preview) return;
    const logoHtml = c.logo
        ? `<img src="${c.logo}" style="width:56px;height:56px;object-fit:contain;border-radius:8px;">`
        : `<div style="width:56px;height:56px;background:#1e3a8a;border-radius:8px;display:grid;place-items:center;"><span style="color:white;font-weight:800;font-size:18px;">PRO</span></div>`;
    
    preview.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
        <tr>
            <td style="width:70px;vertical-align:top;">${logoHtml}</td>
            <td style="vertical-align:top;">
                <div style="font-size:16px;font-weight:800;color:#1e3a8a;">${c.nameTh}</div>
                <div style="font-size:9px;color:#64748b;">${c.nameEn}</div>
                <div style="font-size:8px;color:#94a3b8;margin-top:2px;">
                    ${c.addr1} ${c.addr2} | โทร: ${c.phone} ${c.fax?'| แฟกซ์: '+c.fax:''} | เลขภาษี: ${c.taxId} ${c.branch?'('+c.branch+')':''}
                </div>
            </td>
            <td style="text-align:right;vertical-align:top;width:200px;">
                <div style="background:#3b82f6;color:white;font-weight:700;font-size:11px;padding:6px 16px;border-radius:6px;display:inline-block;">ใบขอซื้อ / PURCHASE REQUEST</div>
                <div style="margin-top:6px;background:#eef1ff;border:1.5px solid #3b82f6;border-radius:6px;padding:5px 12px;font-weight:700;font-size:12px;color:#1e3a8a;font-family:monospace;">เลขที่: PR-XXXX-XXX</div>
            </td>
        </tr>
        </table>
        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0;font-size:11px;color:#10b981;font-weight:600;">✅ ตัวอย่างหัวเอกสาร — ข้อมูลนี้จะถูกใช้ใน PDF Export ทั้งหมด</div>
    `;
}

// Initialize preview safely after DOM ready
setTimeout(function(){ try { updateHeaderPreview(); } catch(e){} }, 200);

// ═══════════════════════════════════════
// ─── FILE ATTACHMENT SYSTEM ───
// ═══════════════════════════════════════
let prAttachedFiles = [];

function handlePRFiles(input) {
    const files = Array.from(input.files);
    files.forEach(file => {
        if (file.size > 10 * 1024 * 1024) { toast('⚠️ ' + file.name + ' เกิน 10MB'); return; }
        const reader = new FileReader();
        reader.onload = function(e) {
            prAttachedFiles.push({ name: file.name, size: file.size, type: file.type, data: e.target.result });
            renderPRFilePreview();
        };
        if (file.type.startsWith('image/')) { reader.readAsDataURL(file); }
        else { reader.readAsDataURL(file); }
    });
}

function renderPRFilePreview() {
    const preview = document.getElementById('prFilePreview');
    const list = document.getElementById('prFileList');
    const count = document.getElementById('prFileCount');
    if (!preview) return;
    
    if (prAttachedFiles.length === 0) { preview.style.display = 'none'; return; }
    preview.style.display = 'block';
    count.textContent = prAttachedFiles.length;
    
    const fileIcons = { 'application/pdf':'📄', 'application/msword':'📝', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'📝', 'application/vnd.ms-excel':'📊', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'📊' };
    
    list.innerHTML = prAttachedFiles.map((f, i) => {
        const isImg = f.type.startsWith('image/');
        const icon = fileIcons[f.type] || '📁';
        const sizeKB = (f.size / 1024).toFixed(0);
        const thumb = isImg
            ? `<img src="${f.data}" alt="${f.name}">`
            : `<div class="file-icon">${icon}</div>`;
        return `<div class="file-card">
            <button class="file-card-rm" onclick="removePRFile(${i})" title="ลบ">×</button>
            <div class="file-card-thumb">${thumb}</div>
            <div class="file-card-info" title="${f.name}">${f.name}<br><span style="color:var(--text-muted);">${sizeKB} KB</span></div>
        </div>`;
    }).join('');
}

function removePRFile(index) {
    prAttachedFiles.splice(index, 1);
    renderPRFilePreview();
}

// ═══════════════════════════════════════
// ─── GOOGLE SHEETS + DRIVE INTEGRATION ───
// ═══════════════════════════════════════
const GAS_CONFIG = {
    webAppUrl: localStorage.getItem('pro_gas_url') || '',
    enabled: !!localStorage.getItem('pro_gas_url')
};

// ─── Connection UI ───
function initGASUI() {
    const urlInput = document.getElementById('gasUrlInput');
    if (urlInput && GAS_CONFIG.webAppUrl) urlInput.value = GAS_CONFIG.webAppUrl;
    updateGASStatus();
}

function updateGASStatus() {
    const banner = document.getElementById('gasStatusBanner');
    const text = document.getElementById('gasStatusText');
    const sub = document.getElementById('gasStatusSub');
    const info = document.getElementById('gasConnectedInfo');
    if (!banner) return;
    
    if (GAS_CONFIG.enabled && GAS_CONFIG.webAppUrl) {
        banner.style.background = '#d1fae5';
        banner.style.borderColor = '#10b981';
        text.textContent = '🟢 เชื่อมต่อ Google Sheets + Drive แล้ว';
        sub.textContent = 'ข้อมูลจะถูกบันทึกไป Google Sheets อัตโนมัติทุกครั้ง';
        if (info) info.style.display = 'block';
    } else {
        banner.style.background = '#fee2e2';
        banner.style.borderColor = '#ef4444';
        text.textContent = '🔴 ยังไม่ได้เชื่อมต่อ — ข้อมูลจะเก็บใน Browser เท่านั้น';
        sub.textContent = 'วาง URL ของ Google Apps Script Web App แล้วกดเชื่อมต่อ';
        if (info) info.style.display = 'none';
    }
}

async function connectGAS() {
    const url = document.getElementById('gasUrlInput')?.value?.trim();
    if (!url) return toast('⚠️ กรุณาวาง URL');
    if (!url.startsWith('https://script.google.com/')) return toast('⚠️ URL ไม่ถูกต้อง');
    
    const btn = document.getElementById('gasConnectBtn');
    btn.textContent = '⏳ กำลังเชื่อมต่อ...';
    btn.disabled = true;
    
    // Save URL first
    GAS_CONFIG.webAppUrl = url;
    GAS_CONFIG.enabled = true;
    localStorage.setItem('pro_gas_url', url);
    
    try {
        const response = await fetch(url, { method: 'GET', redirect: 'follow' });
        const text = await response.text();
        try { JSON.parse(text); } catch(e) {}
    } catch (e) { /* CORS ok — URL looks valid */ }
    
    updateGASStatus();
    toast('✅ เชื่อมต่อสำเร็จ! กำลัง sync ข้อมูล...');
    btn.textContent = '🔗 เชื่อมต่อ';
    btn.disabled = false;
    
    // === AUTO SYNC: ดึงข้อมูลจาก Sheets ก่อน ===
    const el = document.getElementById('gasLastSync');
    
    // Step 1: ดึงข้อมูลจาก Sheets
    toast('📥 ขั้นตอน 1/2: ดึงข้อมูลจาก Google Sheets...');
    await loadFromSheets();
    
    // Step 2: ส่งข้อมูลที่ยังไม่มีใน Sheets กลับไป
    toast('📤 ขั้นตอน 2/2: ส่งข้อมูลใหม่ไป Google Sheets...');
    await syncAllToSheets();
    
    if (el) el.textContent = 'เชื่อมต่อ + Sync เมื่อ: ' + new Date().toLocaleString('th-TH');
    toast('🎉 เชื่อมต่อ + sync ข้อมูลสำเร็จ! ข้อมูลเป็นปัจจุบันแล้ว');
}

async function testGASConnection() {
    if (!GAS_CONFIG.webAppUrl) return toast('⚠️ ยังไม่ได้ตั้งค่า URL');
    toast('🔄 กำลัง sync ข้อมูล...');
    await loadFromSheets();
    toast('✅ ดึงข้อมูลล่าสุดสำเร็จ');
}

function disconnectGAS() {
    GAS_CONFIG.webAppUrl = '';
    GAS_CONFIG.enabled = false;
    localStorage.removeItem('pro_gas_url');
    const urlInput = document.getElementById('gasUrlInput');
    if (urlInput) urlInput.value = '';
    updateGASStatus();
    toast('🔌 ยกเลิกการเชื่อมต่อแล้ว');
}

// ─── Generic save to Sheets (auto on every action) ───
async function saveToSheets(action, data) {
    if (!GAS_CONFIG.enabled || !GAS_CONFIG.webAppUrl) return null;
    try {
        const response = await fetch(GAS_CONFIG.webAppUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action, data })
        });
        const text = await response.text();
        try { return JSON.parse(text); } catch(e) { return { success: response.ok }; }
    } catch (error) {
        console.error('GAS Error:', error);
        return null;
    }
}

// ─── Auto-load on page open if connected ───
async function autoSyncOnLoad() {
    if (!GAS_CONFIG.enabled || !GAS_CONFIG.webAppUrl) return;
    try {
        await loadFromSheets();
        const el = document.getElementById('gasLastSync');
        if (el) el.textContent = 'Auto-sync เมื่อ: ' + new Date().toLocaleString('th-TH');
    } catch(e) { console.log('Auto-sync skipped:', e); }
}

// ─── Save PR ───
async function savePRToGoogleSheets(prData) {
    const result = await saveToSheets('savePR', prData);
    if (result?.success) toast('☁️ PR บันทึกไป Google Sheets แล้ว');
}

// ─── Save PO ───
async function savePOToGoogleSheets(poData) {
    const result = await saveToSheets('savePO', poData);
    if (result?.success) toast('☁️ PO บันทึกไป Google Sheets แล้ว');
}

// ─── Save GRN ───
async function saveGRNToGoogleSheets(grnData) {
    const result = await saveToSheets('saveGRN', grnData);
    if (result?.success) toast('☁️ GRN บันทึกไป Google Sheets แล้ว');
}

// ─── Upload files to Google Drive ───
async function uploadFilesToGoogleDrive(files, prNumber) {
    if (!GAS_CONFIG.enabled || !GAS_CONFIG.webAppUrl) return;
    try {
        let uploadCount = 0;
        for (const file of files) {
            const result = await saveToSheets('uploadFile', {
                fileName: file.name,
                mimeType: file.type,
                base64Data: file.data.split(',')[1],
                folder: prNumber
            });
            if (result?.success) uploadCount++;
        }
        if (uploadCount > 0) toast(`☁️ อัปโหลด ${uploadCount} ไฟล์ไป Google Drive แล้ว`);
    } catch (error) {
        console.error('Upload error:', error);
    }
}

// ─── Upload HTML → PDF to Google Drive ───
async function uploadPdfToDrive(docType, docNum, htmlContent) {
    if (!GAS_CONFIG.enabled || !GAS_CONFIG.webAppUrl) return;
    try {
        toast(`📄 กำลังสร้าง ${docNum}.pdf...`);
        const result = await saveToSheets('uploadHtmlAsPdf', {
            fileName: docNum,
            base64Data: btoa(unescape(encodeURIComponent(htmlContent))),
            folder: `PDF-${docType}`
        });
        if (result?.success) {
            toast(`✅ ${docNum}.pdf → Google Drive แล้ว`);
            if (docType === 'PR' && prDB[docNum]) prDB[docNum].pdfUrl = result.viewUrl || result.fileUrl;
            if (docType === 'PO' && poDatabase[docNum]) poDatabase[docNum].pdfUrl = result.viewUrl || result.fileUrl;
            if (docType === 'GRN' && grnDatabase[docNum]) grnDatabase[docNum].pdfUrl = result.viewUrl || result.fileUrl;
        }
        return result;
    } catch (error) {
        console.error('PDF upload error:', error);
    }
}

// ─── Auto-save PR PDF (เมื่ออนุมัติครบ) ───
function autoSavePRPdfOnApproval(prNum) {
    const pr = prDB[prNum];
    if (!pr) return;
    const html = buildPdfFormHTML('PR', { ...pr, number: prNum });
    uploadPdfToDrive('PR', prNum, html);
}

// ─── Auto-save PO PDF (เมื่อสร้าง PO) ───
function autoSavePOPdf(poNum) {
    const po = poDatabase[poNum];
    if (!po) return;
    const html = buildPdfFormHTML('PO', { ...po, number: poNum });
    uploadPdfToDrive('PO', poNum, html);
}

// ─── Build GRN PDF HTML ───
function buildGRNPdfHTML(grnNum, grn) {
    const co = getCompanySettings();
    const stText = grn.status==='received'?'รับครบ':grn.status==='partial'?'รับบางส่วน':'ตีกลับ';
    const stColor = grn.status==='received'?'#0d9668':grn.status==='partial'?'#ca8a04':'#dc2626';
    const itemRows = (grn.items||[]).map((it,i) => {
        const chk = it.itemStatus==='ok'?'✅ผ่าน':it.itemStatus==='damaged'?'⚠️ชำรุด':'❌ตีกลับ';
        const chkC = it.itemStatus==='ok'?'#0d9668':it.itemStatus==='damaged'?'#ca8a04':'#dc2626';
        return `<tr style="background:${i%2===0?'#fff':'#f8fafc'}"><td style="padding:5px 8px;border:0.5px solid #ddd;text-align:center;font-size:9px;">${i+1}</td><td style="padding:5px 8px;border:0.5px solid #ddd;font-size:9px;">${it.desc}</td><td style="padding:5px 8px;border:0.5px solid #ddd;text-align:center;font-size:9px;">${it.qty}</td><td style="padding:5px 8px;border:0.5px solid #ddd;text-align:center;font-size:9px;">${it.receivedQty||it.qty}</td><td style="padding:5px 8px;border:0.5px solid #ddd;text-align:center;font-size:9px;">${it.unit||'ชิ้น'}</td><td style="padding:5px 8px;border:0.5px solid #ddd;text-align:right;font-size:9px;">฿${(it.total||0).toLocaleString()}</td><td style="padding:5px 8px;border:0.5px solid #ddd;text-align:center;font-size:9px;color:${chkC}">${chk}</td></tr>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<table style="width:100%;margin-bottom:14px;"><tr>
<td style="width:65px;">${co.logo?'<img src="'+co.logo+'" style="width:50px;height:50px;object-fit:contain;">':'<div style="width:50px;height:50px;background:#1e3a8a;border-radius:8px;color:white;font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center;">PRO</div>'}</td>
<td><div style="font-size:15px;font-weight:800;color:#1e3a8a;">${co.nameTh||'บริษัท'}</div><div style="font-size:9px;color:#64748b;">${co.nameEn||''}</div><div style="font-size:8px;color:#94a3b8;">${co.addr1||''} ${co.addr2||''} | โทร: ${co.phone||''}</div></td>
<td style="text-align:right;width:200px;"><div style="background:${stColor};color:white;font-weight:700;font-size:11px;padding:5px 14px;border-radius:6px;display:inline-block;">ใบรับสินค้า / GRN</div><div style="margin-top:5px;background:#eef1ff;border:1.5px solid #3b82f6;border-radius:6px;padding:4px 10px;font-weight:700;font-size:12px;color:#1e3a8a;font-family:monospace;">${grnNum}</div></td>
</tr></table>
<div style="background:#f1f5f9;padding:5px 10px;border-left:3px solid #1e3a8a;font-weight:700;font-size:10px;color:#1e3a8a;margin-bottom:8px;">📋 ข้อมูลรับสินค้า</div>
<table style="width:100%;font-size:9px;margin-bottom:12px;"><tr><td style="color:#64748b;width:12%;">อ้างอิง PO:</td><td style="font-weight:600;">${grn.poRef}</td><td style="color:#64748b;">วันที่รับ:</td><td>${grn.date}</td></tr><tr><td style="color:#64748b;">ผู้ขาย:</td><td>${grn.vendor}</td><td style="color:#64748b;">ผู้รับ:</td><td>${grn.receiver}</td></tr><tr><td style="color:#64748b;">สถานะ:</td><td style="color:${stColor};font-weight:700;">${stText}</td><td style="color:#64748b;">มูลค่า:</td><td style="font-weight:700;">฿${(grn.total||0).toLocaleString()}</td></tr>${grn.notes?'<tr><td style="color:#64748b;">หมายเหตุ:</td><td colspan="3">'+grn.notes+'</td></tr>':''}</table>
<div style="background:#f1f5f9;padding:5px 10px;border-left:3px solid #1e3a8a;font-weight:700;font-size:10px;color:#1e3a8a;margin-bottom:8px;">📦 รายการสินค้าที่ตรวจรับ</div>
<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#1e3a8a;color:white;"><th style="padding:5px;font-size:8px;">ลำดับ</th><th style="padding:5px;font-size:8px;">รายการ</th><th style="padding:5px;font-size:8px;">จำนวน PO</th><th style="padding:5px;font-size:8px;">รับจริง</th><th style="padding:5px;font-size:8px;">หน่วย</th><th style="padding:5px;font-size:8px;">มูลค่า</th><th style="padding:5px;font-size:8px;">ผลตรวจ</th></tr></thead><tbody>${itemRows}</tbody></table>
<div style="margin-top:24px;"><table style="width:100%;"><tr><td style="text-align:center;width:33%;padding-top:8px;"><div style="font-weight:700;font-size:9px;color:#1e3a8a;margin-bottom:30px;">ผู้ส่งมอบ</div><div style="border-bottom:1px solid #cbd5e1;margin:0 16px;"></div><div style="font-size:7px;color:#94a3b8;margin-top:3px;">ลงชื่อ / วันที่</div></td><td style="text-align:center;width:33%;padding-top:8px;"><div style="font-weight:700;font-size:9px;color:#1e3a8a;margin-bottom:30px;">ผู้รับสินค้า</div><div style="border-bottom:1px solid #cbd5e1;margin:0 16px;"></div><div style="font-size:7px;color:#94a3b8;margin-top:3px;">ลงชื่อ / วันที่</div></td><td style="text-align:center;width:33%;padding-top:8px;"><div style="font-weight:700;font-size:9px;color:#1e3a8a;margin-bottom:30px;">ผู้ตรวจสอบ</div><div style="border-bottom:1px solid #cbd5e1;margin:0 16px;"></div><div style="font-size:7px;color:#94a3b8;margin-top:3px;">ลงชื่อ / วันที่</div></td></tr></table></div>
<div style="margin-top:14px;border-top:0.5px solid #e2e8f0;padding-top:4px;font-size:7px;color:#94a3b8;display:flex;justify-content:space-between;"><span>PRO System — ${co.nameTh||''}</span><span>เอกสารจัดทำโดยระบบอัตโนมัติ</span></div>
</body></html>`;
}

// ─── Auto-save GRN PDF (เมื่อรับสินค้า) ───
function autoSaveGRNPdf(grnNum) {
    const grn = grnDatabase[grnNum];
    if (!grn) return;
    const html = buildGRNPdfHTML(grnNum, grn);
    uploadPdfToDrive('GRN', grnNum, html);
}

// ─── Sync all current data to Sheets ───
async function syncAllToSheets() {
    if (!GAS_CONFIG.enabled) return toast('⚠️ ยังไม่ได้เชื่อมต่อ');
    toast('☁️ กำลังส่งข้อมูลทั้งหมด...');
    let count = 0;
    
    for (const [num, pr] of Object.entries(prDB)) { await saveToSheets('savePR', { number: num, ...pr }); count++; }
    for (const [num, po] of Object.entries(poDatabase)) { await saveToSheets('savePO', { number: num, ...po }); count++; }
    for (const u of TEAM_USERS) { await saveToSheets('saveUser', u); count++; }
    for (const [id, v] of Object.entries(vendors)) { await saveToSheets('saveVendor', { id, ...v }); count++; }
    for (const [id, p] of Object.entries(projectDB)) { await saveToSheets('saveProject', { id, ...p }); count++; }
    for (const [id, d] of Object.entries(deptDB)) { await saveToSheets('saveDept', { id, ...d }); count++; }
    await saveToSheets('saveSettings', getCompanySettings()); count++;
    
    const el = document.getElementById('gasLastSync');
    if (el) el.textContent = 'Sync ล่าสุด: ' + new Date().toLocaleString('th-TH');
    toast(`✅ ส่งข้อมูล ${count} รายการไป Google Sheets สำเร็จ!`);
}

// ─── Save individual dept to Sheets ───
async function saveDeptToSheets(deptId) {
    const d = deptDB[deptId];
    if (!d || !GAS_CONFIG.enabled) return;
    await saveToSheets('saveDept', { id: deptId, ...d });
}

// ─── Full Sync (pull then push) ───
async function fullSync() {
    if (!GAS_CONFIG.enabled) return toast('⚠️ ยังไม่ได้เชื่อมต่อ');
    toast('🔄 กำลัง Full Sync...');
    await loadFromSheets();
    await syncAllToSheets();
    const el = document.getElementById('gasLastSync');
    if (el) el.textContent = 'Full Sync เมื่อ: ' + new Date().toLocaleString('th-TH');
    toast('🎉 Full Sync สำเร็จ! ข้อมูลเป็นปัจจุบันทั้ง 2 ทาง');
}

// ═══════════════════════════════════════
// ─── LOAD DATA FROM GOOGLE SHEETS ───
// ═══════════════════════════════════════
async function loadFromSheets() {
    if (!GAS_CONFIG.enabled || !GAS_CONFIG.webAppUrl) return toast('⚠️ ยังไม่ได้เชื่อมต่อ Google Sheets');
    toast('☁️ กำลังดึงข้อมูลจาก Google Sheets...');
    
    try {
        const result = await saveToSheets('loadAllData', {});
        if (!result || !result.success) { toast('❌ ดึงข้อมูลไม่สำเร็จ'); return; }
        
        let loaded = 0;
        
        // Load Departments
        if (result.departments && result.departments.length > 0) {
            // Clear and reload
            Object.keys(deptDB).forEach(k => delete deptDB[k]);
            result.departments.forEach(row => {
                const id = row['Dept ID'];
                if (!id) return;
                deptDB[id] = {
                    nameTh: row['Name TH']||'', nameEn: row['Name EN']||'', code: row['Code']||'',
                    type: row['Type']||'support', head: row['Head']||'', headTitle: row['Head Title']||'',
                    email: row['Email']||'', location: row['Location']||'',
                    budget: parseFloat(row['Budget'])||0, used: parseFloat(row['Used'])||0,
                    employees: parseInt(row['Employees'])||0, desc: row['Description']||''
                };
                loaded++;
            });
        }
        
        // Load Projects
        if (result.projects && result.projects.length > 0) {
            Object.keys(projectDB).forEach(k => delete projectDB[k]);
            result.projects.forEach(row => {
                const id = row['Project ID'] || row['ID'];
                if (!id) return;
                projectDB[id] = {
                    name: row['Name']||'', type: row['Type']||'', location: row['Location']||'',
                    client: row['Client']||'', deptId: row['Dept ID']||'', manager: row['Manager']||'',
                    budget: parseFloat(row['Budget'])||0, used: parseFloat(row['Used'])||0,
                    contract: parseFloat(row['Contract'])||0, start: row['Start']||'', end: row['End']||'',
                    status: row['Status']||'active', priority: row['Priority']||'medium',
                    scope: row['Scope']||''
                };
                loaded++;
            });
        }
        
        // Load Vendors
        if (result.vendors && result.vendors.length > 0) {
            Object.keys(vendors).forEach(k => delete vendors[k]);
            result.vendors.forEach(row => {
                const id = row['Vendor ID'] || row['ID'];
                if (!id) return;
                vendors[id] = {
                    name: row['Name']||'', tax: row['Tax ID']||'', contact: row['Contact']||'',
                    phone: row['Phone']||'', email: row['Email']||'', addr: row['Address']||''
                };
                loaded++;
            });
        }
        
        // Load Users
        if (result.users && result.users.length > 0) {
            TEAM_USERS.length = 0; // clear
            result.users.forEach(row => {
                const id = row['User ID'];
                if (!id) return;
                let perms = {};
                try { perms = JSON.parse(row['Permissions']||'{}'); } catch(e) {}
                TEAM_USERS.push({
                    id: id, name: row['Name']||'', initials: row['Initials']||'',
                    role: row['Role']||'user', roleLabel: row['Role Label']||'',
                    dept: row['Department']||'', canApprove: row['Can Approve']==='Yes',
                    approveStep: parseInt(row['Approve Step'])||-1,
                    username: row['Username']||'', password: row['Password']||'1234',
                    color: '#8b5cf6', photo: '', permissions: perms
                });
                loaded++;
            });
        }
        
        // Load PR
        if (result.pr && result.pr.length > 0) {
            Object.keys(prDB).forEach(k => delete prDB[k]);
            result.pr.forEach(row => {
                const num = row['PR Number'] || row['Number'];
                if (!num) return;
                let items = [], approvals = [];
                try { items = JSON.parse(row['Items']||'[]'); } catch(e) {}
                try { approvals = JSON.parse(row['Approvals']||'[]'); } catch(e) {}
                if (approvals.length === 0) approvals = [{status:'current',date:null,note:null},{status:'waiting',date:null,note:null},{status:'waiting',date:null,note:null}];
                prDB[num] = {
                    title: row['Title']||'', requester: row['Requester']||'',
                    department: row['Department']||'', created: row['Created']||'',
                    required: row['Required Date']||'', priority: row['Priority']||'ปานกลาง',
                    projectId: row['Project ID']||'', reason: row['Reason']||'',
                    items: items, total: parseFloat(row['Total'])||0, approvals: approvals
                };
                loaded++;
            });
        }
        
        // Load PO
        if (result.po && result.po.length > 0) {
            Object.keys(poDatabase).forEach(k => delete poDatabase[k]);
            result.po.forEach(row => {
                const num = row['PO Number'] || row['Number'];
                if (!num) return;
                let items = [];
                try { items = JSON.parse(row['Items']||'[]'); } catch(e) {}
                poDatabase[num] = {
                    prRef: row['PR Ref']||'', vendor: row['Vendor']||'',
                    vendorTax: row['Vendor Tax']||'', vendorAddr: row['Vendor Address']||'',
                    vendorContact: row['Vendor Contact']||'', vendorPhone: row['Vendor Phone']||'',
                    date: row['Date']||'', deliveryDate: row['Delivery Date']||'',
                    payTerms: row['Pay Terms']||'', total: parseFloat(row['Total'])||0,
                    statusText: row['Status']||'อนุมัติแล้ว', statusCls: row['Status Class']||'approved',
                    items: items
                };
                loaded++;
            });
        }
        
        // Refresh all UI
        if (typeof renderAllLinked === 'function') renderAllLinked();
        if (typeof renderPRTable === 'function') renderPRTable();
        if (typeof renderPOTable === 'function') renderPOTable();
        if (typeof renderDashStats === 'function') renderDashStats();
        if (typeof renderDashPR === 'function') renderDashPR();
        if (typeof initUsersAndVendors === 'function') initUsersAndVendors();
        
        const el = document.getElementById('gasLastSync');
        if (el) el.textContent = 'ดึงข้อมูลล่าสุด: ' + new Date().toLocaleString('th-TH');
        toast(`✅ ดึงข้อมูล ${loaded} รายการจาก Google Sheets สำเร็จ!`);
    } catch (error) {
        console.error('Load error:', error);
        toast('❌ ดึงข้อมูลไม่สำเร็จ: ' + error.message);
    }
}

// ═══════════════════════════════════════
// ─── USER SESSION (Multi-user) ───
// ═══════════════════════════════════════
const TEAM_USERS = [
    { id:'U001', username:'admin', password:'admin123', name:'ผู้ดูแลระบบ', initials:'AD', role:'admin', roleLabel:'Admin / ผู้ดูแลระบบ', dept:'บริหาร', canApprove:true, approveStep:2, color:'#3870ff', photo:'', permissions:{dashboard:1,pr:1,po:1,compare:1,grn:1,approve:1,payment:1,reports:1,projects:1,budget:1,vendors:1,departments:1,users:1,settings:1} },
    { id:'U002', username:'procurement', password:'123456', name:'ฝ่ายจัดซื้อ', initials:'PC', role:'procurement', roleLabel:'Procurement / ฝ่ายจัดซื้อ', dept:'จัดซื้อ', canApprove:false, approveStep:null, color:'#0d9668', photo:'', permissions:{dashboard:1,pr:1,po:1,compare:1,grn:1,reports:1,projects:1,budget:1,vendors:1} },
    { id:'U003', username:'engineer1', password:'123456', name:'วิศวกรสนาม', initials:'SE', role:'engineer', roleLabel:'Site Engineer / วิศวกรสนาม', dept:'วิศวกรรม', canApprove:true, approveStep:0, color:'#ca8a04', photo:'', permissions:{dashboard:1,pr:1,grn:1,reports:1,projects:1} },
];

// Load saved photos from localStorage
TEAM_USERS.forEach(u => {
    const saved = localStorage.getItem('pro_photo_' + u.id);
    if (saved) u.photo = saved;
});

// ─── Avatar HTML helper (reusable everywhere) ───
function userAvatarHTML(user, size) {
    size = size || 40;
    const rad = size > 36 ? '10px' : '8px';
    if (user.photo) {
        return `<img src="${user.photo}" style="width:${size}px;height:${size}px;border-radius:${rad};object-fit:cover;flex-shrink:0;border:2px solid ${user.color};">`;
    }
    return `<div style="width:${size}px;height:${size}px;border-radius:${rad};background:${user.color};display:grid;place-items:center;color:#fff;font-weight:800;font-size:${Math.round(size*0.35)}px;flex-shrink:0;">${user.initials}</div>`;
}

// ─── Login System (Username + Password) ───
function initLogin() {
    // Auto-login if saved
    const savedId = localStorage.getItem('pro_current_user');
    if (savedId) {
        const user = TEAM_USERS.find(u => u.id === savedId);
        if (user) {
            currentUser = user;
            hideLogin();
            updateUserDisplay();
            renderPRTable(); renderDashPR();
            return;
        }
    }
    document.getElementById('loginOverlay').style.display = 'flex';
    // Focus username field
    setTimeout(() => document.getElementById('loginUsername')?.focus(), 300);
}

function doLogin() {
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');
    
    const username = usernameInput?.value?.trim().toLowerCase();
    const password = passwordInput?.value;
    
    if (!username) {
        showLoginError('⚠️ กรุณากรอกชื่อผู้ใช้');
        usernameInput?.focus();
        return;
    }
    if (!password) {
        showLoginError('⚠️ กรุณากรอกรหัสผ่าน');
        passwordInput?.focus();
        return;
    }
    
    // Animate button
    btn.textContent = '⏳ กำลังเข้าสู่ระบบ...';
    btn.disabled = true;
    
    setTimeout(() => {
        // Find user
        const user = TEAM_USERS.find(u => u.username === username);
        
        if (!user) {
            showLoginError('❌ ไม่พบชื่อผู้ใช้ "' + username + '" ในระบบ');
            btn.textContent = 'เข้าสู่ระบบ';
            btn.disabled = false;
            usernameInput?.focus();
            return;
        }
        
        if (user.password !== password) {
            showLoginError('❌ รหัสผ่านไม่ถูกต้อง');
            btn.textContent = 'เข้าสู่ระบบ';
            btn.disabled = false;
            passwordInput?.value && (passwordInput.value = '');
            passwordInput?.focus();
            return;
        }
        
        // Success!
        currentUser = user;
        const remember = document.getElementById('loginRemember')?.checked;
        if (remember) localStorage.setItem('pro_current_user', user.id);
        
        hideLogin();
        updateUserDisplay();
        renderPRTable(); renderDashPR();
        
        btn.textContent = 'เข้าสู่ระบบ';
        btn.disabled = false;
        
        toast(`👋 สวัสดี ${user.name} — ${user.roleLabel}`);
    }, 400);
}

function showLoginError(msg) {
    const el = document.getElementById('loginError');
    if (el) {
        el.textContent = msg;
        el.style.display = 'block';
        // Shake animation
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = 'shake 0.4s ease-out';
    }
}

function fillLogin(username, password) {
    document.getElementById('loginUsername').value = username;
    document.getElementById('loginPassword').value = password;
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginUsername').focus();
}

// ─── One-click Admin Login ───
function quickAdminLogin() {
    document.getElementById('loginUsername').value = 'admin';
    document.getElementById('loginPassword').value = 'admin123';
    const remember = document.getElementById('loginRemember');
    if (remember) remember.checked = true;
    doLogin();
}


function togglePasswordVisibility() {
    const input = document.getElementById('loginPassword');
    const btn = document.getElementById('togglePwdBtn');
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🔒';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

function quickLogin(userId) { quickAdminLogin(); }
function showLoginInfo() { /* backward compat */ }

function hideLogin() {
    document.getElementById('loginOverlay').style.display = 'none';
}

function updateUserDisplay() {
    if (!currentUser) return;
    const nameEl = document.getElementById('currentUserName');
    const roleEl = document.getElementById('currentUserRole');
    const avatarEl = document.getElementById('currentUserAvatar');
    if (nameEl) nameEl.textContent = currentUser.name;
    if (roleEl) roleEl.textContent = currentUser.roleLabel;
    if (avatarEl) {
        if (currentUser.photo) {
            avatarEl.innerHTML = `<img src="${currentUser.photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            avatarEl.style.background = 'none';
            avatarEl.style.overflow = 'hidden';
        } else {
            avatarEl.innerHTML = '';
            avatarEl.textContent = currentUser.initials;
            avatarEl.style.background = `linear-gradient(135deg, ${currentUser.color}, ${currentUser.color}cc)`;
        }
    }
}

function showUserMenu() {
    if (!currentUser) return;
    const photoBtn = currentUser.photo ? '🗑️ ลบรูปโปรไฟล์' : '📷 เพิ่มรูปโปรไฟล์';
    const action = prompt(`👤 ${currentUser.name}\n📋 ${currentUser.roleLabel}\n🏢 ${currentUser.dept}\n\nพิมพ์ตัวเลือก:\n1 = ${photoBtn}\n2 = ออกจากระบบ\n\n(หรือกด Cancel ปิด)`);
    if (action === '1') {
        if (currentUser.photo) {
            removeUserPhoto();
        } else {
            document.getElementById('userPhotoInput').click();
        }
    } else if (action === '2') {
        doLogout();
    }
}

function handleUserPhoto(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('⚠️ เลือกไฟล์รูปภาพเท่านั้น');
    if (file.size > 2 * 1024 * 1024) return toast('⚠️ รูปเกิน 2MB');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        // Resize image
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxSize = 200;
            let w = img.width, h = img.height;
            if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
            else { w = Math.round(w * maxSize / h); h = maxSize; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            // Save to user + localStorage
            currentUser.photo = dataUrl;
            const userInList = TEAM_USERS.find(u => u.id === currentUser.id);
            if (userInList) userInList.photo = dataUrl;
            localStorage.setItem('pro_photo_' + currentUser.id, dataUrl);
            
            updateUserDisplay();
            toast('✅ อัปโหลดรูปโปรไฟล์สำเร็จ!');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function removeUserPhoto() {
    if (!currentUser) return;
    currentUser.photo = '';
    const userInList = TEAM_USERS.find(u => u.id === currentUser.id);
    if (userInList) userInList.photo = '';
    localStorage.removeItem('pro_photo_' + currentUser.id);
    updateUserDisplay();
    toast('🗑️ ลบรูปโปรไฟล์แล้ว');
}

function doLogout() {
    currentUser = null;
    localStorage.removeItem('pro_current_user');
    location.reload();
}

// Initialize login
setTimeout(initLogin, 100);
setTimeout(initUsersAndVendors, 200);

// Init on page load
setTimeout(initGASUI, 300);

// Auto-sync from Google Sheets on page load (if connected)
setTimeout(autoSyncOnLoad, 1500);

console.log('🎉 PRO System พร้อมใช้งาน!');

/* === Patch v3 helpers === */
function hideRemovedSettingsCards() {
    document.querySelectorAll('#settings .table-card-title').forEach(title => {
        const text = title.textContent || '';
        if (text.includes('การตั้งค่างบประมาณ') || text.includes('Google Sheets') || text.includes('Drive')) {
            const card = title.closest('.table-card');
            if (card) card.remove();
        }
    });
}
document.addEventListener('DOMContentLoaded', () => {
    setupModalBackdropClose();
    hideRemovedSettingsCards();
});

/* === Patch v4: Department works + linked dropdowns + local save === */
var editingDeptId = null;
const DEPT_STORAGE_KEY_V4 = 'pro_system_departments_v4';

function normalizeDeptV4(d) {
    return {
        code: String(d.code || '').toUpperCase(),
        nameTh: d.nameTh || '',
        nameEn: d.nameEn || '',
        type: d.type || 'support',
        parent: d.parent || '',
        costCenter: d.costCenter || '',
        email: d.email || '',
        status: d.status || 'active',
        head: d.head || '-', headTitle: d.headTitle || '-', qualification: d.qualification || '-',
        ext: d.ext || '-', location: d.location || '-',
        budget: Number(d.budget || 0), used: Number(d.used || 0), employees: Number(d.employees || 0),
        engineers: Number(d.engineers || 0), laborers: Number(d.laborers || 0), desc: d.desc || '-', iso: d.iso || '-'
    };
}

function defaultDepartmentsV4() {
    return {
        D001: normalizeDeptV4({ code:'ADMIN', nameTh:'ฝ่ายบริหาร', nameEn:'Administration', type:'management', costCenter:'CC-ADMIN-001', email:'admin@company.co.th' }),
        D002: normalizeDeptV4({ code:'PROC', nameTh:'ฝ่ายจัดซื้อ', nameEn:'Procurement', type:'procurement', costCenter:'CC-PROC-001', email:'procurement@company.co.th' }),
        D003: normalizeDeptV4({ code:'ENG', nameTh:'ฝ่ายวิศวกรรม', nameEn:'Engineering', type:'engineering', costCenter:'CC-ENG-001', email:'engineering@company.co.th' }),
        D004: normalizeDeptV4({ code:'SITE', nameTh:'ฝ่ายก่อสร้าง', nameEn:'Construction', type:'construction', costCenter:'CC-SITE-001', email:'site@company.co.th' })
    };
}

function loadDepartmentsLocalV4() {
    try {
        const raw = localStorage.getItem(DEPT_STORAGE_KEY_V4);
        const source = raw ? JSON.parse(raw) : (Object.keys(deptDB).length ? deptDB : defaultDepartmentsV4());
        Object.keys(deptDB).forEach(k => delete deptDB[k]);
        Object.entries(source).forEach(([id, d]) => { deptDB[id] = normalizeDeptV4(d); });
    } catch (e) {
        console.warn('Department load failed:', e);
        Object.assign(deptDB, defaultDepartmentsV4());
    }
}

function saveDepartmentsLocalV4() {
    try { localStorage.setItem(DEPT_STORAGE_KEY_V4, JSON.stringify(deptDB)); }
    catch (e) { console.warn('Department save failed:', e); }
}

function nextDeptIdV4() {
    const nums = Object.keys(deptDB).map(id => parseInt(String(id).replace(/\D/g,''), 10)).filter(n => !isNaN(n));
    return 'D' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
}

function fillParentDeptOptionsV4(selectedValue) {
    const sel = document.querySelector('#deptForm [name="parent_dept"]');
    if (!sel) return;
    const currentId = editingDeptId;
    sel.innerHTML = '<option value="">— ไม่มี (แผนกหลัก) —</option>' +
        Object.entries(deptDB)
            .filter(([id]) => id !== currentId)
            .map(([id, d]) => `<option value="${d.nameTh}" ${d.nameTh===selectedValue?'selected':''}>${d.code} — ${d.nameTh}</option>`)
            .join('');
}

function openDeptModal(deptId) {
    const f = document.getElementById('deptForm');
    if (!f) return toast('❌ ไม่พบฟอร์มแผนก');
    f.reset();
    editingDeptId = deptId || null;
    const title = document.querySelector('#deptModal .modal-top h3');
    if (title) title.textContent = editingDeptId ? '✏️ แก้ไขแผนก' : '🏗️ เพิ่มแผนกใหม่';
    const d = editingDeptId ? deptDB[editingDeptId] : null;
    fillParentDeptOptionsV4(d?.parent || '');
    if (d) {
        f.elements['dept_name_th'].value = d.nameTh || '';
        f.elements['dept_name_en'].value = d.nameEn || '';
        f.elements['dept_code'].value = d.code || '';
        f.elements['dept_type'].value = d.type || '';
        f.elements['parent_dept'].value = d.parent || '';
        f.elements['cost_center'].value = d.costCenter || '';
        f.elements['dept_email'].value = d.email || '';
        f.elements['status'].value = d.status || 'active';
    } else {
        f.elements['cost_center'].value = `CC-${nextDeptIdV4()}`;
    }
    openModal('deptModal');
}

function submitDept() {
    const f = document.getElementById('deptForm');
    if (!f) return toast('❌ ไม่พบฟอร์มแผนก');
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const fd = new FormData(f);
    const nameTh = String(fd.get('dept_name_th') || '').trim();
    const code = String(fd.get('dept_code') || '').trim().toUpperCase();
    if (!nameTh || !code) return toast('⚠️ กรุณากรอกชื่อแผนกและรหัสแผนก');
    const duplicate = Object.entries(deptDB).find(([id, d]) => id !== editingDeptId && String(d.code).toUpperCase() === code);
    if (duplicate) return toast(`⚠️ รหัสแผนก ${code} ถูกใช้แล้ว`);
    const id = editingDeptId || nextDeptIdV4();
    const old = deptDB[id] || {};
    deptDB[id] = normalizeDeptV4({
        ...old,
        code,
        nameTh,
        nameEn: String(fd.get('dept_name_en') || '').trim(),
        type: fd.get('dept_type') || 'support',
        parent: fd.get('parent_dept') || '',
        costCenter: String(fd.get('cost_center') || '').trim(),
        email: String(fd.get('dept_email') || '').trim(),
        status: fd.get('status') || 'active',
        budget: Number(old.budget || 0), used: Number(old.used || 0), employees: Number(old.employees || 0)
    });
    saveDepartmentsLocalV4();
    const wasEditing = !!editingDeptId;
    editingDeptId = null;
    closeModal('deptModal');
    f.reset();
    renderAllLinked();
    populateAllDeptDropdowns();
    if (typeof saveDeptToSheets === 'function') saveDeptToSheets(id);
    toast(wasEditing ? `✅ แก้ไขแผนก ${nameTh} สำเร็จ` : `✅ เพิ่มแผนก ${nameTh} สำเร็จ`);
}

function deleteDept(deptId) {
    const d = deptDB[deptId];
    if (!d) return;
    const usedBy = Object.values(projectDB).filter(p => p.deptId === deptId);
    if (usedBy.length > 0) return toast(`⚠️ ลบไม่ได้ — แผนกนี้ใช้ใน ${usedBy.length} โครงการ`);
    if (!confirm(`ยืนยันลบแผนก ${deptId} — ${d.nameTh}?`)) return;
    delete deptDB[deptId];
    saveDepartmentsLocalV4();
    renderAllLinked();
    toast(`🗑️ ลบแผนก ${deptId} สำเร็จ`);
}

function viewDeptDetail(id) {
    const d = deptDB[id];
    if (!d) return toast('❌ ไม่พบข้อมูล');
    const typeLabels = {engineering:'🏗️ วิศวกรรม',construction:'🚧 ก่อสร้าง',design:'📐 ออกแบบ',management:'🏢 บริหาร',procurement:'🛒 จัดซื้อ',safety:'🦺 ความปลอดภัย',plant:'🔧 เครื่องจักร',support:'👥 สนับสนุน'};
    const projectCount = Object.values(projectDB).filter(p => p.deptId === id).length;
    document.getElementById('deptDetailTitle').textContent = `${d.code} — ${d.nameTh}`;
    document.getElementById('deptDetailBody').innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title">🏗️ ข้อมูลแผนก</div>
            <div class="detail-grid">
                <div class="detail-item"><label>รหัสระบบ</label><div class="val cell-id">${id}</div></div>
                <div class="detail-item"><label>รหัสแผนก</label><div class="val" style="font-family:var(--font-mono);">${d.code}</div></div>
                <div class="detail-item"><label>ชื่อแผนก</label><div class="val">${d.nameTh}</div></div>
                <div class="detail-item"><label>ชื่ออังกฤษ</label><div class="val">${d.nameEn || '-'}</div></div>
                <div class="detail-item"><label>ประเภท</label><div class="val">${typeLabels[d.type] || '-'}</div></div>
                <div class="detail-item"><label>สังกัด</label><div class="val">${d.parent || 'แผนกหลัก'}</div></div>
                <div class="detail-item"><label>Cost Center</label><div class="val" style="font-family:var(--font-mono);">${d.costCenter || '-'}</div></div>
                <div class="detail-item"><label>อีเมล</label><div class="val">${d.email || '-'}</div></div>
                <div class="detail-item"><label>โครงการที่เชื่อม</label><div class="val">${projectCount} โครงการ</div></div>
                <div class="detail-item"><label>สถานะ</label><div class="val">${d.status === 'inactive' ? 'ปิดใช้งาน' : 'ใช้งาน'}</div></div>
            </div>
        </div>`;
    openModal('deptDetailModal');
}

function renderDeptTable() {
    const tbody = document.getElementById('deptTableBody');
    if (!tbody) return;
    const typeIcons = {engineering:'🏗️',construction:'🚧',design:'📐',management:'🏢',procurement:'🛒',safety:'🦺',plant:'🔧',support:'👥'};
    const typeLabels = {engineering:'วิศวกรรม',construction:'ก่อสร้าง',design:'ออกแบบ',management:'บริหาร',procurement:'จัดซื้อ',safety:'ความปลอดภัย',plant:'เครื่องจักร',support:'สนับสนุน'};
    tbody.innerHTML = '';
    for (const [id, d] of Object.entries(deptDB)) {
        const statusCls = d.status === 'inactive' ? 'draft' : 'approved';
        const statusText = d.status === 'inactive' ? 'ปิดใช้งาน' : 'ใช้งาน';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="cell-id">${id}</td>
            <td><strong>${typeIcons[d.type]||'🏛️'} ${d.nameTh}</strong><br><span style="font-size:11px;color:var(--text-muted);">${d.parent || 'แผนกหลัก'}</span></td>
            <td>${d.nameEn || '-'}</td>
            <td>${typeLabels[d.type] || '-'}</td>
            <td style="font-family:var(--font-mono);">${d.costCenter || '-'}</td>
            <td>${d.email || '-'}</td>
            <td><span class="badge ${statusCls}">${statusText}</span></td>
            <td class="actions">
                <button class="act-btn view" onclick="viewDeptDetail('${id}')">ดู</button>
                <button class="act-btn edit" onclick="openDeptModal('${id}')">แก้ไข</button>
                <button class="act-btn edit" style="background:var(--danger-bg);color:var(--danger);" onclick="deleteDept('${id}')">ลบ</button>
            </td>`;
        tbody.appendChild(tr);
    }
}

function renderDeptStats() {
    const el = document.getElementById('deptStats');
    if (!el) return;
    const depts = Object.values(deptDB);
    const activeDept = depts.filter(d => d.status !== 'inactive').length;
    const activeProj = Object.values(projectDB).filter(p => p.status==='active').length;
    const linkedProj = Object.values(projectDB).filter(p => p.deptId).length;
    el.innerHTML = `
        <div class="stat-card budget"><div class="stat-top"><div class="stat-label">แผนกทั้งหมด</div><div class="stat-icon">🏗️</div></div><div class="stat-value">${depts.length}</div><div class="stat-sub">รวมทุกสถานะ</div></div>
        <div class="stat-card approved"><div class="stat-top"><div class="stat-label">ใช้งานอยู่</div><div class="stat-icon">✅</div></div><div class="stat-value">${activeDept}</div><div class="stat-sub">พร้อมเลือกในฟอร์ม</div></div>
        <div class="stat-card pending"><div class="stat-top"><div class="stat-label">โครงการดำเนินการ</div><div class="stat-icon">🚧</div></div><div class="stat-value">${activeProj}</div><div class="stat-sub">กำลังดำเนินการ</div></div>
        <div class="stat-card approved"><div class="stat-top"><div class="stat-label">เชื่อมกับโครงการ</div><div class="stat-icon">📂</div></div><div class="stat-value">${linkedProj}</div><div class="stat-sub">รายการที่เลือกแผนกแล้ว</div></div>`;
}

function populateDepartmentDropdowns() { populateAllDeptDropdowns(); }

loadDepartmentsLocalV4();
document.addEventListener('DOMContentLoaded', () => {
    renderAllLinked();
    populateAllDeptDropdowns();
});
setTimeout(() => { renderAllLinked(); populateAllDeptDropdowns(); }, 350);

/* =========================================================
   API DATABASE BRIDGE — SQLite Backend Connection
   Added for procurement-system package.
   Goal: replace local-only master data with Flask API calls.
   Connected modules: Departments, Projects, Vendors, Users, Login.
   ========================================================= */

const API_BASE = "";

async function apiRequest(url, options = {}) {
    const opts = {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options
    };
    const res = await fetch(API_BASE + url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
        throw new Error(data.message || `API Error ${res.status}`);
    }
    return data;
}

function clearObject(obj) {
    Object.keys(obj).forEach(k => delete obj[k]);
}

function statusToThai(status) {
    if (!status) return "ใช้งาน";
    const s = String(status).toLowerCase();
    if (s === "active" || s === "ใช้งาน") return "ใช้งาน";
    if (s === "inactive" || s === "ปิดใช้งาน") return "ปิดใช้งาน";
    return status;
}

function statusToApi(status) {
    if (!status) return "Active";
    const s = String(status).toLowerCase();
    if (s === "active" || s === "ใช้งาน") return "Active";
    if (s === "inactive" || s === "ปิดใช้งาน") return "Inactive";
    return status;
}

function roleLabel(role) {
    const map = {
        admin: "Admin / ผู้ดูแลระบบ",
        manager: "Manager / หัวหน้างาน",
        procurement: "Procurement / ฝ่ายจัดซื้อ",
        engineer: "Engineer / วิศวกร",
        foreman: "Foreman / โฟร์แมน",
        safety: "Safety / จป.",
        qs: "QS / ประมาณราคา",
        admin_hr: "HR / ธุรการ",
        finance: "Finance / บัญชี",
        user: "User / ผู้ใช้งานทั่วไป"
    };
    return map[role] || role || "User";
}

function initialsFromName(name) {
    const txt = (name || "U").trim();
    if (!txt) return "U";
    const parts = txt.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return txt.slice(0, 2).toUpperCase();
}

async function loadDepartmentsFromDB() {
    const rows = await apiRequest("/api/departments");
    clearObject(deptDB);
    rows.forEach((r, index) => {
        const id = r.department_code || `D${String(index + 1).padStart(3, "0")}`;
        deptDB[id] = {
            dbId: r.id,
            code: r.department_code || id,
            nameTh: r.department_name || "-",
            nameEn: r.department_name || "",
            type: "",
            parent: "",
            costCenter: "",
            email: "",
            status: String(r.status || "Active").toLowerCase() === "active" ? "active" : "inactive",
            head: "-",
            headTitle: "-",
            qualification: "",
            employees: 0,
            engineers: 0,
            laborers: 0,
            budget: 0,
            used: 0,
            location: "-",
            created_at: r.created_at || ""
        };
    });

    if (typeof renderDeptTable === "function") renderDeptTable();
    if (typeof renderDeptStats === "function") renderDeptStats();
    if (typeof populateAllDeptDropdowns === "function") populateAllDeptDropdowns();
    if (typeof populateDepartmentDropdowns === "function") populateDepartmentDropdowns();
}

async function submitDept() {
    const f = document.getElementById("deptForm");
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const fd = new FormData(f);
    try {
        await apiRequest("/api/departments", {
            method: "POST",
            body: JSON.stringify({
                department_code: String(fd.get("dept_code") || "").trim().toUpperCase(),
                department_name: String(fd.get("dept_name_th") || "").trim(),
                status: statusToApi(fd.get("status") || "active")
            })
        });
        toast("✅ บันทึกแผนกลง Database สำเร็จ");
        closeModal("deptModal");
        f.reset();
        await loadDepartmentsFromDB();
    } catch (err) {
        console.error(err);
        toast("❌ " + err.message);
    }
}

async function loadVendorsFromDB() {
    const rows = await apiRequest("/api/vendors");
    clearObject(vendors);
    if (typeof vendorDB !== "undefined") clearObject(vendorDB);
    rows.forEach((r, index) => {
        const id = r.vendor_code || `V${String(index + 1).padStart(3, "0")}`;
        const item = {
            dbId: r.id,
            code: r.vendor_code || id,
            name: r.company_name || "-",
            type: "-",
            tax: r.tax_id || "-",
            category: "-",
            addr: "-",
            address: "-",
            contact: r.contact_name || "-",
            position: "-",
            phone: r.phone || "-",
            email: r.email || "-",
            line: "",
            website: "",
            terms: "เครดิต 30 วัน",
            credit: 0,
            notes: "",
            status: "ใช้งาน",
            poCount: 0,
            totalValue: 0,
            avgRating: 5,
            lastPO: "-"
        };
        vendors[id] = item;
        if (typeof vendorDB !== "undefined") vendorDB[id] = { ...item };
        if (typeof vendorCatalog !== "undefined") vendorCatalog[id] = vendorCatalog[id] || {};
    });
    if (typeof renderVendorsTable === "function") renderVendorsTable();
    if (typeof renderVendorStats === "function") renderVendorStats();
}

async function submitVendor() {
    const f = document.getElementById("vendorForm");
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const fd = new FormData(f);
    const nextNo = Object.keys(vendors).length + 1;
    const vendorCode = `V${String(nextNo).padStart(3, "0")}`;
    try {
        await apiRequest("/api/vendors", {
            method: "POST",
            body: JSON.stringify({
                vendor_code: vendorCode,
                company_name: String(fd.get("company_name") || "").trim(),
                tax_id: fd.get("tax_id") || "",
                contact_name: fd.get("contact_name") || "",
                phone: fd.get("phone") || "",
                email: fd.get("email") || ""
            })
        });
        toast("✅ บันทึกผู้ขายลง Database สำเร็จ");
        closeModal("vendorModal");
        f.reset();
        await loadVendorsFromDB();
    } catch (err) {
        console.error(err);
        toast("❌ " + err.message);
    }
}

async function loadProjectsFromDB() {
    const rows = await apiRequest("/api/projects");
    clearObject(projectDB);
    rows.forEach((r, index) => {
        const id = r.project_code || `PROJ-${String(index + 1).padStart(3, "0")}`;
        projectDB[id] = {
            dbId: r.id,
            name: r.project_name || "-",
            type: "building",
            location: r.location || "-",
            client: r.owner_name || "-",
            deptId: Object.keys(deptDB)[0] || "",
            supportDepts: [],
            manager: r.owner_name || "-",
            budget: Number(r.budget || 0),
            used: 0,
            contract: 0,
            start: "-",
            end: "-",
            status: String(r.status || "Active").toLowerCase() === "active" ? "active" : "planning",
            priority: "medium",
            scope: ""
        };
    });
    if (typeof renderProjectTable === "function") renderProjectTable();
    if (typeof renderProjectStats === "function") renderProjectStats();
    if (typeof populateProjectDropdowns === "function") populateProjectDropdowns();
}

async function submitProject() {
    const name = document.getElementById("projName")?.value?.trim();
    const location = document.getElementById("projLocation")?.value?.trim();
    const owner = document.getElementById("projClient")?.value?.trim();
    const budget = Number(document.getElementById("projBudget")?.value || 0);
    if (!name || !location || !budget) return toast("⚠️ กรุณากรอกชื่อโครงการ / สถานที่ / งบประมาณ");

    const now = new Date();
    const projectCode = `PJ-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Object.keys(projectDB).length + 1).padStart(3, "0")}`;
    try {
        await apiRequest("/api/projects", {
            method: "POST",
            body: JSON.stringify({
                project_code: projectCode,
                project_name: name,
                location,
                owner_name: owner,
                budget,
                status: "Active"
            })
        });
        toast("✅ บันทึกโครงการลง Database สำเร็จ");
        closeModal("projectModal");
        document.getElementById("projectForm")?.reset();
        await loadProjectsFromDB();
    } catch (err) {
        console.error(err);
        toast("❌ " + err.message);
    }
}

async function loadUsersFromDB() {
    const rows = await apiRequest("/api/users");
    if (typeof TEAM_USERS === "undefined") return;
    TEAM_USERS.splice(0, TEAM_USERS.length);
    rows.forEach((r) => {
        const role = String(r.role || "user").toLowerCase();
        TEAM_USERS.push({
            id: `U${String(r.id).padStart(3, "0")}`,
            dbId: r.id,
            username: r.username || "",
            password: "",
            name: r.full_name || r.username || "User",
            initials: initialsFromName(r.full_name || r.username),
            role,
            roleLabel: roleLabel(role),
            dept: r.department || "-",
            canApprove: ["admin", "manager", "procurement"].includes(role),
            approveStep: role === "manager" ? 0 : role === "procurement" ? 1 : role === "admin" ? 2 : null,
            color: role === "admin" ? "#3870ff" : "#0d9668",
            photo: "",
            permissions: ROLE_PERMS?.[role] || ROLE_PERMS?.user || {}
        });
    });
    if (typeof renderUsersTable === "function") renderUsersTable();
    if (typeof renderUserStats === "function") renderUserStats();
}

async function submitUser() {
    const f = document.getElementById("userForm");
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const fd = new FormData(f);
    try {
        await apiRequest("/api/users", {
            method: "POST",
            body: JSON.stringify({
                full_name: fd.get("fullname") || "",
                username: fd.get("username") || "",
                password: fd.get("password") || "123456",
                role: fd.get("role") || "User",
                department: fd.get("department") || "",
                status: "Active"
            })
        });
        toast("✅ บันทึกผู้ใช้งานลง Database สำเร็จ");
        closeModal("userModal");
        f.reset();
        await loadUsersFromDB();
    } catch (err) {
        console.error(err);
        toast("❌ " + err.message);
    }
}

async function doLogin() {
    const usernameInput = document.getElementById("loginUsername");
    const passwordInput = document.getElementById("loginPassword");
    const errorEl = document.getElementById("loginError");
    try {
        const data = await apiRequest("/api/login", {
            method: "POST",
            body: JSON.stringify({
                username: usernameInput?.value || "",
                password: passwordInput?.value || ""
            })
        });
        const u = data.user;
        const role = String(u.role || "user").toLowerCase();
        currentUser = {
            id: `U${String(u.id).padStart(3, "0")}`,
            dbId: u.id,
            username: u.username,
            name: u.full_name,
            initials: initialsFromName(u.full_name),
            role,
            roleLabel: roleLabel(role),
            dept: u.department || "-",
            canApprove: ["admin", "manager", "procurement"].includes(role),
            approveStep: role === "manager" ? 0 : role === "procurement" ? 1 : role === "admin" ? 2 : null,
            color: role === "admin" ? "#3870ff" : "#0d9668",
            permissions: ROLE_PERMS?.[role] || ROLE_PERMS?.user || {}
        };
        localStorage.setItem("pro_current_user", currentUser.id);
        if (typeof hideLogin === "function") hideLogin();
        if (typeof updateUserDisplay === "function") updateUserDisplay();
        toast("✅ เข้าสู่ระบบสำเร็จ");
    } catch (err) {
        if (errorEl) {
            errorEl.style.display = "block";
            errorEl.textContent = err.message;
        }
    }
}

function quickAdminLogin() {
    const u = document.getElementById("loginUsername");
    const p = document.getElementById("loginPassword");
    if (u) u.value = "admin";
    if (p) p.value = "admin123";
    doLogin();
}

async function loadMasterDataFromDB() {
    try {
        await loadDepartmentsFromDB();
        await Promise.all([
            loadProjectsFromDB(),
            loadVendorsFromDB(),
            loadUsersFromDB()
        ]);
        if (typeof renderDashStats === "function") renderDashStats();
        console.log("✅ Master data loaded from SQLite API");
    } catch (err) {
        console.error("Load master data failed", err);
        toast("❌ โหลดข้อมูลจาก Database ไม่สำเร็จ: " + err.message);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    // Delay shortly to let the original UI initialization finish first.
    setTimeout(loadMasterDataFromDB, 300);
});
