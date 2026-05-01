// ===== SUPPLIERS / PARTY LEDGER MODULE =====
const Suppliers = {
  items: [], filtered: [], query: '', editId: null,

  init() { this.load(); this.bindEvents(); },

  load() {
    this.items = DB.get('suppliers');
    this.filtered = [...this.items];
    this.render();
  },

  render() {
    const el = document.getElementById('suppliers-body');
    if (!el) return;
    const totalDue = this.items.reduce((s, c) => s + (c.due || 0), 0);
    const dashDue = document.getElementById('supp-total-due');
    if (dashDue) dashDue.textContent = Utils.formatCurrency(totalDue);

    if (!this.filtered.length) {
      el.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="ri-truck-line"></i><h3>No parties yet</h3><p>Add your first wholesaler/supplier</p></div></td></tr>`;
      return;
    }
    el.innerHTML = this.filtered.map(s => {
      const initials = s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const dueBadge = s.due > 0 ? `<span class="badge badge-red"><i class="ri-error-warning-line"></i> ₹${s.due.toLocaleString('en-IN')}</span>` : `<span class="badge badge-green">Cleared</span>`;
      return `<tr>
        <td><div style="display:flex;align-items:center;gap:12px">
          <div class="customer-avatar" style="background:var(--accent2);color:#000">${initials}</div>
          <div><div class="fw-600">${Utils.highlight(Utils.escapeHtml(s.name), this.query)}</div><div style="font-size:.75rem;color:var(--text2)">${s.contact || ''}</div></div>
        </div></td>
        <td class="fw-600">${Utils.formatCurrency(s.totalPurchases || 0)}</td>
        <td class="fw-600">${Utils.formatCurrency(s.totalPaid || 0)}</td>
        <td>${dueBadge}</td>
        <td>${Utils.formatDate(s.updatedAt || s.createdAt || Date.now())}</td>
        <td><div style="display:flex;gap:6px">
          <button class="btn-icon btn" onclick="Suppliers.openHistory('${s.id}')" title="Ledger History"><i class="ri-history-line"></i></button>
          <button class="btn-icon btn" onclick="Suppliers.openAddTxn('${s.id}')" title="Add Purchase/Payment" style="color:var(--warn);border-color:rgba(245,158,11,.2)"><i class="ri-add-circle-line"></i></button>
          <button class="btn-icon btn" onclick="Suppliers.openEdit('${s.id}')" title="Edit"><i class="ri-edit-line"></i></button>
          <button class="btn-icon btn" onclick="Suppliers.confirmDelete('${s.id}')" title="Delete" style="color:var(--danger);border-color:rgba(239,68,68,.2)"><i class="ri-delete-bin-line"></i></button>
        </div></td>
      </tr>`;
    }).join('');
  },

  bindEvents() {
    const s = document.getElementById('supp-search');
    if (s) s.addEventListener('input', Utils.debounce(e => { this.query = e.target.value; this.applyFilters(); }, 250));
  },

  applyFilters() {
    const q = this.query.toLowerCase();
    this.filtered = q ? this.items.filter(s => s.name.toLowerCase().includes(q) || (s.contact || '').toLowerCase().includes(q)) : [...this.items];
    this.render();
  },

  openAdd() {
    this.editId = null;
    document.getElementById('supp-modal-title').textContent = 'Add Supplier (Party)';
    document.getElementById('supp-form').reset();
    document.getElementById('supp-modal').classList.add('open');
  },

  openEdit(id) {
    this.editId = id;
    const s = DB.findOne('suppliers', x => x.id === id);
    if (!s) return;
    document.getElementById('supp-modal-title').textContent = 'Edit Supplier';
    document.getElementById('supp-name').value  = s.name || '';
    document.getElementById('supp-contact').value = s.contact || '';
    document.getElementById('supp-address').value = s.address || '';
    document.getElementById('supp-modal').classList.add('open');
  },

  closeModal() { document.getElementById('supp-modal').classList.remove('open'); },

  save() {
    const name    = document.getElementById('supp-name').value.trim();
    const contact = document.getElementById('supp-contact').value.trim();
    const address = document.getElementById('supp-address').value.trim();
    if (!name) { Notify.warning('Supplier name is required'); return; }
    const data = { name, contact, address };
    if (this.editId) {
      DB.update('suppliers', this.editId, data);
      Notify.success('Supplier updated!');
    } else {
      DB.add('suppliers', { ...data, due: 0, totalPurchases: 0, totalPaid: 0 });
      Notify.success('Supplier added!');
    }
    this.closeModal();
    this.load();
  },

  openAddTxn(id) {
    const s = DB.findOne('suppliers', x => x.id === id);
    if (!s) return;
    document.getElementById('supp-txn-name').textContent = s.name;
    document.getElementById('supp-txn-due').textContent = Utils.formatCurrency(s.due || 0);
    document.getElementById('supp-txn-form').reset();
    document.getElementById('supp-txn-file-base64').value = '';
    document.getElementById('supp-txn-modal').setAttribute('data-id', id);
    document.getElementById('supp-txn-modal').classList.add('open');
  },

  closeTxnModal() { document.getElementById('supp-txn-modal').classList.remove('open'); },

  handleTxnFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('supp-txn-file-base64').value = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  saveTxn() {
    const id = document.getElementById('supp-txn-modal').getAttribute('data-id');
    const s = DB.findOne('suppliers', x => x.id === id);
    if (!s) return;

    const type = document.getElementById('supp-txn-type').value;
    const amt = parseFloat(document.getElementById('supp-txn-amt').value) || 0;
    const note = document.getElementById('supp-txn-note').value.trim();
    const date = document.getElementById('supp-txn-date').value || new Date().toISOString().split('T')[0];
    const billFile = document.getElementById('supp-txn-file-base64').value; // Get file

    if (amt <= 0) { Notify.warning('Enter a valid amount'); return; }

    // Log the transaction
    DB.add('supplier_transactions', {
      supplierId: id,
      type: type, // 'purchase' or 'payment'
      amount: amt,
      note: note,
      billFile: billFile, // Store the file
      date: new Date(date).toISOString()
    });

    // Update balances
    const updates = {};
    if (type === 'purchase') {
      updates.due = (s.due || 0) + amt;
      updates.totalPurchases = (s.totalPurchases || 0) + amt;
    } else {
      updates.due = Math.max(0, (s.due || 0) - amt);
      updates.totalPaid = (s.totalPaid || 0) + amt;
    }
    
    DB.update('suppliers', id, updates);
    this.closeTxnModal();
    this.load();
    Notify.success(type === 'purchase' ? 'Purchase added' : 'Payment recorded');
  },

  openHistory(id) {
    const s = DB.findOne('suppliers', x => x.id === id);
    if (!s) return;
    const txns = DB.find('supplier_transactions', t => t.supplierId === id).sort((a,b) => new Date(b.date) - new Date(a.date));
    
    const el = document.getElementById('supp-history-content');
    document.getElementById('supp-history-name').textContent = `${s.name}'s Ledger`;
    
    el.innerHTML = !txns.length
      ? '<div class="empty-state"><i class="ri-file-list-3-line"></i><h3>No ledger history</h3></div>'
      : `<div style="margin-bottom:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          <div style="background:var(--bg3);padding:14px;border-radius:var(--r-sm);text-align:center">
            <div class="fw-700" style="font-size:1.1rem;color:var(--text)">${Utils.formatCurrency(s.totalPurchases || 0)}</div>
            <div style="font-size:.75rem;color:var(--text2)">Total Billed</div>
          </div>
          <div style="background:var(--success-bg);padding:14px;border-radius:var(--r-sm);text-align:center">
            <div class="fw-700" style="font-size:1.1rem;color:var(--success)">${Utils.formatCurrency(s.totalPaid || 0)}</div>
            <div style="font-size:.75rem;color:var(--text2)">Total Paid</div>
          </div>
          <div style="background:var(--${s.due > 0 ? 'danger' : 'border'});padding:14px;border-radius:var(--r-sm);text-align:center">
            <div class="fw-700" style="font-size:1.1rem;color:var(--${s.due > 0 ? 'danger' : 'text'})">${Utils.formatCurrency(s.due || 0)}</div>
            <div style="font-size:.75rem;color:var(--text2)">Current Due</div>
          </div>
        </div>
        <table class="data-table">
          <thead><tr><th>Date</th><th>Type</th><th>Note/Bill No</th><th>Amount</th></tr></thead>
          <tbody>${txns.map(t => {
            const isPur = t.type === 'purchase';
            return `<tr>
              <td>${Utils.formatDate(t.date)}</td>
              <td><span class="badge ${isPur ? 'badge-orange' : 'badge-green'}">${isPur ? 'Purchase (+)' : 'Payment (-)'}</span></td>
              <td style="font-size:.825rem">${Utils.escapeHtml(t.note || '-')} ${t.billFile ? `<br/><a href="${t.billFile}" target="_blank" style="color:var(--accent);display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-weight:600;"><i class="ri-attachment-2"></i> View Bill</a>` : ''}</td>
              <td class="fw-600" style="color:${isPur ? 'var(--warn)' : 'var(--success)'}">${Utils.formatCurrency(t.amount)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>`;
    document.getElementById('supp-history-modal').classList.add('open');
  },

  confirmDelete(id) {
    const s = DB.findOne('suppliers', x => x.id === id);
    if (!s) return;
    const el = document.getElementById('confirm-modal');
    document.getElementById('confirm-msg').textContent = `Delete supplier "${s.name}"?`;
    document.getElementById('confirm-ok').onclick = () => {
      DB.delete('suppliers', id);
      el.classList.remove('open');
      this.load();
      Notify.success('Supplier deleted');
    };
    el.classList.add('open');
  }
};
