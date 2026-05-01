// ===== CUSTOMERS MODULE =====
const Customers = {
  items: [], filtered: [], query: '', editId: null,

  init() { this.load(); this.bindEvents(); },

  load() {
    this.items = DB.get('customers');
    this.filtered = [...this.items];
    this.render();
  },

  render() {
    const el = document.getElementById('customers-body');
    if (!el) return;
    if (!this.filtered.length) {
      el.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="ri-user-3-line"></i><h3>No customers yet</h3><p>Add your first customer</p></div></td></tr>`;
      return;
    }
    el.innerHTML = this.filtered.map(c => {
      const initials = c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const udharBadge = c.udhar > 0 ? `<span class="badge badge-red"><i class="ri-error-warning-line"></i> ₹${c.udhar.toLocaleString('en-IN')}</span>` : `<span class="badge badge-green">Cleared</span>`;
      return `<tr>
        <td><div style="display:flex;align-items:center;gap:12px">
          <div class="customer-avatar">${initials}</div>
          <div><div class="fw-600">${Utils.highlight(Utils.escapeHtml(c.name), this.query)}</div><div style="font-size:.75rem;color:var(--text2)">${c.email || ''}</div></div>
        </div></td>
        <td>${c.phone || '-'}</td>
        <td style="font-size:.825rem;color:var(--text2)">${c.address || '-'}</td>
        <td class="fw-600">${Utils.formatCurrency(c.totalPurchases || 0)}</td>
        <td>${udharBadge}</td>
        <td>${Utils.formatDate(c.createdAt)}</td>
        <td><div style="display:flex;gap:6px">
          <button class="btn-icon btn" onclick="Customers.openHistory('${c.id}')" title="History"><i class="ri-history-line"></i></button>
          <button class="btn-icon btn" onclick="Customers.openEdit('${c.id}')" title="Edit"><i class="ri-edit-line"></i></button>
          <button class="btn-icon btn" onclick="Customers.openUdhar('${c.id}')" title="Udhar" style="color:var(--warn);border-color:rgba(245,158,11,.2)"><i class="ri-money-dollar-circle-line"></i></button>
          <button class="btn-icon btn" onclick="Customers.confirmDelete('${c.id}')" title="Delete" style="color:var(--danger);border-color:rgba(239,68,68,.2)"><i class="ri-delete-bin-line"></i></button>
        </div></td>
      </tr>`;
    }).join('');
  },

  bindEvents() {
    const s = document.getElementById('cust-search');
    if (s) s.addEventListener('input', Utils.debounce(e => { this.query = e.target.value; this.applyFilters(); }, 250));
  },

  applyFilters() {
    const q = this.query.toLowerCase();
    if (!q) {
      this.filtered = [...this.items];
    } else {
      const allBills = DB.get('bills');
      this.filtered = this.items.filter(c => {
        const matchName = c.name.toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q);
        const matchBills = allBills.some(b => b.customerId === c.id && String(b.billNumber).toLowerCase().includes(q));
        return matchName || matchBills;
      });
    }
    this.render();
  },

  openAdd() {
    this.editId = null;
    document.getElementById('cust-modal-title').textContent = 'Add Customer';
    document.getElementById('cust-form').reset();
    document.getElementById('cust-modal').classList.add('open');
  },

  openEdit(id) {
    this.editId = id;
    const c = DB.findOne('customers', x => x.id === id);
    if (!c) return;
    document.getElementById('cust-modal-title').textContent = 'Edit Customer';
    document.getElementById('cust-name').value  = c.name || '';
    document.getElementById('cust-phone').value = c.phone || '';
    document.getElementById('cust-email').value = c.email || '';
    document.getElementById('cust-address').value = c.address || '';
    document.getElementById('cust-modal').classList.add('open');
  },

  closeModal() { document.getElementById('cust-modal').classList.remove('open'); },

  save() {
    const name    = document.getElementById('cust-name').value.trim();
    const phone   = document.getElementById('cust-phone').value.trim();
    const email   = document.getElementById('cust-email').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    if (!name) { Notify.warning('Customer name is required'); return; }
    const data = { name, phone, email, address };
    if (this.editId) {
      DB.update('customers', this.editId, data);
      Notify.success('Customer updated!');
    } else {
      DB.add('customers', { ...data, udhar: 0, totalPurchases: 0 });
      Notify.success('Customer added!');
    }
    this.closeModal();
    this.load();
    Dashboard.renderKPIs();
  },

  openUdhar(id) {
    const c = DB.findOne('customers', x => x.id === id);
    if (!c) return;
    document.getElementById('udhar-cust-name').textContent = c.name;
    document.getElementById('udhar-current').textContent = Utils.formatCurrency(c.udhar || 0);
    document.getElementById('udhar-amt').value = '';
    document.getElementById('udhar-note').value = '';
    document.getElementById('udhar-modal').setAttribute('data-id', id);
    document.getElementById('udhar-modal').classList.add('open');
  },

  saveUdhar(action) {
    const id  = document.getElementById('udhar-modal').getAttribute('data-id');
    const amt = parseFloat(document.getElementById('udhar-amt').value) || 0;
    if (!amt || amt <= 0) { Notify.warning('Enter a valid amount'); return; }
    const c = DB.findOne('customers', x => x.id === id);
    if (!c) return;
    const cur = c.udhar || 0;
    const newUdhar = action === 'add' ? cur + amt : Math.max(0, cur - amt);
    DB.update('customers', id, { udhar: newUdhar });
    document.getElementById('udhar-modal').classList.remove('open');
    this.load();
    Dashboard.renderKPIs();
    Notify.success(action === 'add' ? `₹${amt} udhar added` : `₹${amt} payment recorded`);
  },

  openHistory(id) {
    const c = DB.findOne('customers', x => x.id === id);
    if (!c) return;
    const bills = DB.find('bills', b => b.customerId === id).reverse();
    const el = document.getElementById('cust-history-content');
    document.getElementById('cust-history-name').textContent = `${c.name}'s Purchase History`;
    el.innerHTML = !bills.length
      ? '<div class="empty-state"><i class="ri-receipt-line"></i><h3>No purchases yet</h3></div>'
      : `<div style="margin-bottom:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          <div style="background:var(--gradient-soft);padding:14px;border-radius:var(--r-sm);text-align:center">
            <div class="fw-700" style="font-size:1.1rem;color:var(--accent)">${bills.length}</div>
            <div style="font-size:.75rem;color:var(--text2)">Total Orders</div>
          </div>
          <div style="background:var(--success-bg);padding:14px;border-radius:var(--r-sm);text-align:center">
            <div class="fw-700" style="font-size:1.1rem;color:var(--success)">${Utils.formatCurrency(c.totalPurchases || 0)}</div>
            <div style="font-size:.75rem;color:var(--text2)">Total Spent</div>
          </div>
          <div style="background:var(--${c.udhar > 0 ? 'danger' : 'success'}-bg);padding:14px;border-radius:var(--r-sm);text-align:center">
            <div class="fw-700" style="font-size:1.1rem;color:var(--${c.udhar > 0 ? 'danger' : 'success'})">${Utils.formatCurrency(c.udhar || 0)}</div>
            <div style="font-size:.75rem;color:var(--text2)">Pending Udhar</div>
          </div>
        </div>
        <table class="data-table">
          <thead><tr><th>Bill No.</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>${bills.map(b => `<tr>
            <td onclick="Billing.viewBill('${b.id}')" style="cursor:pointer;"><span class="fw-600" style="color:var(--accent);text-decoration:underline;">${b.billNumber}</span></td>
            <td>${b.items.length} item(s)</td>
            <td class="fw-600">${Utils.formatCurrency(b.total)}</td>
            <td><span class="badge ${b.status === 'paid' ? 'badge-green' : 'badge-orange'}">${b.status}</span></td>
            <td>${Utils.formatDate(b.createdAt)}</td>
            <td><div style="display:flex;gap:6px;justify-content:flex-end">
              <button class="btn-icon btn" onclick="Billing.viewBill('${b.id}')" title="View"><i class="ri-eye-line"></i></button>
              <button class="btn-icon btn" onclick="Billing.downloadGSTPDF(null,'${b.id}')" title="Download PDF"><i class="ri-file-pdf-line"></i></button>
            </div></td>
          </tr>`).join('')}</tbody>
        </table>`;
    document.getElementById('cust-history-modal').classList.add('open');
  },

  confirmDelete(id) {
    const c = DB.findOne('customers', x => x.id === id);
    if (!c) return;
    const el = document.getElementById('confirm-modal');
    document.getElementById('confirm-msg').textContent = `Delete customer "${c.name}"?`;
    document.getElementById('confirm-ok').onclick = () => {
      DB.delete('customers', id);
      el.classList.remove('open');
      this.load();
      Notify.success('Customer deleted');
    };
    el.classList.add('open');
  },

  exportExcel() {
    const data = this.items.map(c => ({ Name: c.name, Phone: c.phone, Email: c.email, Address: c.address, 'Total Purchases': c.totalPurchases || 0, 'Udhar (₹)': c.udhar || 0 }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, 'customers_export.xlsx');
    Notify.success('Customers exported!');
  },

  importExcel(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      let added = 0;
      const existingPhones = new Set(this.items.map(c => String(c.phone).replace(/\D/g, '')).filter(p => p));
      
      rows.forEach(r => {
        const phoneKey = Object.keys(r).find(k => /phone|mobile|number|contact|tel|whatsapp/i.test(k));
        const rawPhone = String(r[phoneKey] || '');
        const cleanPhone = rawPhone.replace(/\D/g, ''); 
        
        const nameKey = Object.keys(r).find(k => /name|customer|client|party/i.test(k));
        let name = r[nameKey] || '';
        
        if (!name && cleanPhone.length >= 10) name = 'Dear Customer';
        
        if (name && cleanPhone.length >= 10 && !existingPhones.has(cleanPhone)) { 
          DB.add('customers', { name, phone: cleanPhone, email: r.Email || r.email || '', address: r.Address || r.address || '', udhar: 0, totalPurchases: 0 }); 
          existingPhones.add(cleanPhone);
          added++; 
        }
      });
      this.load();
      Notify.success(`${added} unique customers imported!`);
    };
    reader.readAsBinaryString(file);
  },

  openPasteModal() {
    const modal = document.getElementById('paste-numbers-modal');
    const area = document.getElementById('paste-numbers-area');
    const btn = document.getElementById('paste-confirm-btn');
    area.value = '';
    modal.classList.add('open');
    btn.onclick = () => {
      this.pasteNumbers(area.value);
      modal.classList.remove('open');
    };
  },

  pasteNumbers(text) {
    if (!text.trim()) return;
    const lines = text.split(/[\n,;]+/);
    let added = 0;
    const existingPhones = new Set(this.items.map(c => String(c.phone).replace(/\D/g, '')).filter(p => p));
    
    lines.forEach(line => {
      const cleanPhone = line.replace(/\D/g, '');
      if (cleanPhone.length >= 10 && !existingPhones.has(cleanPhone)) {
        DB.add('customers', { name: 'Dear Customer', phone: cleanPhone, email: '', address: '', udhar: 0, totalPurchases: 0 });
        existingPhones.add(cleanPhone);
        added++;
      }
    });
    this.load();
    Notify.success(`${added} customers added from paste!`);
  }
};
