// ===== CUSTOMER DUE MANAGEMENT SYSTEM =====
const Dues = {

  // ---- Load / Render ----
  init() {
    this.updateBadge();
    this.render();
    this.checkOverdueStatus();
  },

  // Get all dues from DB
  getAll() {
    return DB.get('dues') || [];
  },

  // Update sidebar badge with count of pending
  updateBadge() {
    const badge = document.getElementById('nav-badge-dues');
    if (!badge) return;
    const pending = this.getAll().filter(d => d.status !== 'paid').length;
    if (pending > 0) {
      badge.textContent = pending;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  },

  // Check and update overdue status
  checkOverdueStatus() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const dues = this.getAll();
    let changed = false;
    dues.forEach(due => {
      if (due.status !== 'paid') {
        const dueDate = new Date(due.dueDate);
        dueDate.setHours(0,0,0,0);
        const shouldBeOverdue = dueDate < today;
        if (shouldBeOverdue && due.status !== 'overdue') {
          due.status = 'overdue';
          changed = true;
        } else if (!shouldBeOverdue && due.status === 'overdue') {
          due.status = due.paidAmount > 0 ? 'partial' : 'pending';
          changed = true;
        }
      }
    });
    if (changed) {
      localStorage.setItem('shopapp_dues', JSON.stringify(dues));
    }
  },

  // ---- Called after saving unpaid bill ----
  openSetDueDate(bill) {
    const modal = document.getElementById('due-date-modal');
    if (!modal) return;

    // Prefill bill info
    document.getElementById('duemod-bill-no').textContent = bill.billNumber;
    document.getElementById('duemod-cust-name').textContent = bill.customerName;
    document.getElementById('duemod-amount').textContent = Utils.formatCurrency(bill.total);

    // Items summary
    const items = (bill.items || []).map((it, i) =>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border2)">
        <span style="font-size:.85rem">${i+1}. ${Utils.escapeHtml(it.name)}${it.sn ? ` <span style="color:var(--text3);font-size:.75rem">(SN: ${it.sn})</span>` : ''}</span>
        <span style="font-weight:700;color:var(--accent)">${Utils.formatCurrency(it.total)}</span>
      </div>`
    ).join('');
    document.getElementById('duemod-items-list').innerHTML = items;

    // Default due date: 30 days from now
    const def = new Date(); def.setDate(def.getDate() + 30);
    document.getElementById('duemod-due-date').value = def.toISOString().split('T')[0];
    document.getElementById('duemod-note').value = '';
    document.getElementById('duemod-auto-wa').checked = true;

    // Store bill ref
    modal._pendingBill = bill;
    modal.classList.add('open');
  },

  // ---- Confirm due date and create due record ----
  confirmDue() {
    const modal = document.getElementById('due-date-modal');
    const bill = modal._pendingBill;
    if (!bill) return;

    const dueDate = document.getElementById('duemod-due-date').value;
    const note    = document.getElementById('duemod-note').value;
    const autoWA  = document.getElementById('duemod-auto-wa').checked;

    if (!dueDate) { Notify.warning('Please select a due date!'); return; }

    const due = {
      billId: bill.id,
      billNumber: bill.billNumber,
      customerId: bill.customerId || '',
      customerName: bill.customerName,
      customerMobile: bill.customerMobile || '',
      customerAddress: bill.customerAddress || '',
      items: bill.items || [],
      totalAmount: bill.total,
      dueDate,
      dateTaken: bill.createdAt || new Date().toISOString(),
      status: 'pending',
      payments: [],
      paidAmount: 0,
      remainingAmount: bill.total,
      note,
      whatsappSentAt: null,
      createdAt: new Date().toISOString()
    };

    // Save to DB
    const saved = DB.add('dues', due);
    modal.classList.remove('open');

    // Auto WhatsApp
    if (autoWA && bill.customerMobile) {
      setTimeout(() => this.sendWhatsAppOnCreation(saved), 500);
    }

    Notify.success(`Due recorded for ${bill.customerName}!`);
    this.updateBadge();

    return saved;
  },

  // ---- WhatsApp message on udhar creation ----
  sendWhatsAppOnCreation(due) {
    const session = JSON.parse(localStorage.getItem('shopapp_session') || '{}');
    const shopName = session.shop || 'Our Shop';
    const dueDate = new Date(due.dueDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    const dateTaken = new Date(due.dateTaken).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

    const itemsList = (due.items || []).map(it =>
      `🔹 ${it.name}${it.model ? ` (${it.model})` : ''}${it.sn ? `\n    SN: ${it.sn}` : ''}\n    Qty: ${it.qty} × ₹${it.price.toLocaleString('en-IN')} = *₹${it.total.toLocaleString('en-IN')}*`
    ).join('\n');

    const msg = `🛒 *CREDIT PURCHASE — ${shopName.toUpperCase()}*\n\n`
      + `Dear *${due.customerName}*,\n`
      + `You have taken goods on credit from us. Please find details below:\n\n`
      + `📋 *Bill No:* ${due.billNumber}\n`
      + `📅 *Date Taken:* ${dateTaken}\n`
      + `⏰ *Due By:* *${dueDate}*\n\n`
      + `🛍️ *Items Purchased:*\n${itemsList}\n\n`
      + `💰 *Total Due: ₹${due.totalAmount.toLocaleString('en-IN')}*\n\n`
      + `⚠️ Please clear the payment on or before *${dueDate}* to avoid any inconvenience.\n\n`
      + `_Thank you for shopping with us!_\n*${shopName}*`;

    const phone = (due.customerMobile || '').replace(/\D/g, '');
    if (!phone) { Notify.warning('No mobile number for WhatsApp!'); return; }
    const intlPhone = phone.startsWith('91') ? phone : (phone.length === 10 ? '91' + phone : phone);

    // Update whatsapp sent time
    DB.update('dues', due.id, { whatsappSentAt: new Date().toISOString() });

    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    Notify.success('WhatsApp message opened!');
  },

  // ---- Send reminder WhatsApp ----
  sendReminder(dueId) {
    const due = DB.findOne('dues', d => d.id === dueId);
    if (!due) return;

    const session = JSON.parse(localStorage.getItem('shopapp_session') || '{}');
    const shopName = session.shop || 'Our Shop';
    const dueDate = new Date(due.dueDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    const today = new Date();
    const dueDt = new Date(due.dueDate);
    const diffDays = Math.ceil((dueDt - today) / (1000 * 60 * 60 * 24));
    const delayText = diffDays < 0
      ? `⚠️ *OVERDUE by ${Math.abs(diffDays)} days!*`
      : `⏰ *Due in ${diffDays} day(s)*`;

    const msg = `🔔 *PAYMENT REMINDER — ${shopName.toUpperCase()}*\n\n`
      + `Dear *${due.customerName}*,\n\n`
      + `This is a gentle reminder for your pending due:\n\n`
      + `📋 *Bill No:* ${due.billNumber}\n`
      + `💰 *Total Amount:* ₹${due.totalAmount.toLocaleString('en-IN')}\n`
      + `✅ *Paid:* ₹${(due.paidAmount || 0).toLocaleString('en-IN')}\n`
      + `🔴 *Remaining:* ₹${(due.remainingAmount || due.totalAmount).toLocaleString('en-IN')}\n`
      + `📅 *Due Date:* ${dueDate}\n`
      + `${delayText}\n\n`
      + `Please make the payment at your earliest convenience.\n\n`
      + `_Regards,_\n*${shopName}*`;

    const phone = (due.customerMobile || '').replace(/\D/g, '');
    if (!phone) { Notify.warning('No mobile number!'); return; }
    const intlPhone = phone.startsWith('91') ? phone : (phone.length === 10 ? '91' + phone : phone);

    DB.update('dues', due.id, { whatsappSentAt: new Date().toISOString() });
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    Notify.success('Reminder sent!');
  },

  // ---- Open Record Payment Modal ----
  openRecordPayment(dueId) {
    const modal = document.getElementById('record-payment-modal');
    const due = DB.findOne('dues', d => d.id === dueId);
    if (!due || !modal) return;

    document.getElementById('rpmod-cust-name').textContent = due.customerName;
    document.getElementById('rpmod-bill-no').textContent = due.billNumber;
    document.getElementById('rpmod-total').textContent = Utils.formatCurrency(due.totalAmount);
    document.getElementById('rpmod-paid').textContent = Utils.formatCurrency(due.paidAmount || 0);
    document.getElementById('rpmod-remaining').textContent = Utils.formatCurrency(due.remainingAmount || due.totalAmount);
    document.getElementById('rpmod-amount').value = '';
    document.getElementById('rpmod-mode').value = 'cash';
    document.getElementById('rpmod-note').value = '';
    document.getElementById('rpmod-screenshot-preview').style.display = 'none';
    document.getElementById('rpmod-screenshot-preview').src = '';
    document.getElementById('rpmod-screenshot-input').value = '';
    this._toggleScreenshotField('cash');
    modal._dueId = dueId;
    modal.classList.add('open');
  },

  _toggleScreenshotField(mode) {
    const wrap = document.getElementById('rpmod-screenshot-wrap');
    if (wrap) wrap.style.display = (mode === 'online' || mode === 'mixed') ? '' : 'none';
  },

  onScreenshotChange(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const preview = document.getElementById('rpmod-screenshot-preview');
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  },

  // ---- Save Payment ----
  savePayment() {
    const modal = document.getElementById('record-payment-modal');
    const dueId = modal._dueId;
    const due = DB.findOne('dues', d => d.id === dueId);
    if (!due) return;

    const amount = parseFloat(document.getElementById('rpmod-amount').value);
    const mode = document.getElementById('rpmod-mode').value;
    const note = document.getElementById('rpmod-note').value;
    const screenshotEl = document.getElementById('rpmod-screenshot-preview');
    const screenshot = screenshotEl.style.display !== 'none' ? screenshotEl.src : null;

    if (!amount || amount <= 0) { Notify.warning('Enter a valid amount!'); return; }
    if (amount > (due.remainingAmount || due.totalAmount)) {
      Notify.warning('Amount exceeds remaining due!'); return;
    }

    const payment = {
      id: 'pay_' + Date.now(),
      date: new Date().toISOString(),
      amount,
      mode,
      note,
      screenshotBase64: screenshot
    };

    const newPaid = (due.paidAmount || 0) + amount;
    const newRemaining = due.totalAmount - newPaid;
    const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

    const updatedPayments = [...(due.payments || []), payment];
    DB.update('dues', dueId, {
      payments: updatedPayments,
      paidAmount: newPaid,
      remainingAmount: Math.max(0, newRemaining),
      status: newStatus
    });

    modal.classList.remove('open');
    Notify.success(`Payment of ${Utils.formatCurrency(amount)} recorded!`);
    this.render();
    this.updateBadge();
  },

  // ---- View Due Detail ----
  viewDetail(dueId) {
    const modal = document.getElementById('due-detail-modal');
    const due = DB.findOne('dues', d => d.id === dueId);
    if (!due || !modal) return;

    const today = new Date(); today.setHours(0,0,0,0);
    const dueDt = new Date(due.dueDate); dueDt.setHours(0,0,0,0);
    const diffDays = Math.ceil((dueDt - today) / (1000 * 60 * 60 * 24));
    const delayHtml = diffDays < 0
      ? `<span class="badge badge-red" style="font-size:.85rem">Overdue by ${Math.abs(diffDays)} days</span>`
      : diffDays === 0
        ? `<span class="badge badge-orange" style="font-size:.85rem">Due Today!</span>`
        : `<span class="badge badge-green" style="font-size:.85rem">${diffDays} days remaining</span>`;

    // Items
    const itemsHtml = (due.items || []).map((it, i) => `
      <tr>
        <td>${i+1}</td>
        <td><div class="fw-600">${Utils.escapeHtml(it.name)}</div>
          ${it.sn ? `<div style="font-size:.75rem;color:var(--text3)">SN: ${it.sn} | Model: ${it.model||''}</div>` : ''}
        </td>
        <td>${it.qty}</td>
        <td>${Utils.formatCurrency(it.price)}</td>
        <td class="fw-700" style="color:var(--accent)">${Utils.formatCurrency(it.total)}</td>
      </tr>`).join('');

    // Payment timeline
    const paymentsHtml = (due.payments || []).length === 0
      ? `<div style="text-align:center;padding:20px;color:var(--text3);font-style:italic">No payments recorded yet</div>`
      : (due.payments || []).map(pay => `
        <div style="display:flex;gap:14px;padding:14px;background:var(--bg3);border-radius:12px;margin-bottom:10px;border-left:4px solid ${pay.mode === 'cash' ? 'var(--success)' : 'var(--accent)'}">
          <div style="width:44px;height:44px;border-radius:12px;background:${pay.mode === 'cash' ? 'rgba(16,185,129,.15)' : 'rgba(123,97,255,.15)'};display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">
            ${pay.mode === 'cash' ? '💵' : pay.mode === 'online' ? '📱' : '💳'}
          </div>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="fw-700" style="font-size:1rem;color:var(--success)">+${Utils.formatCurrency(pay.amount)}</span>
              <span style="font-size:.75rem;color:var(--text3)">${new Date(pay.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
            </div>
            <div style="font-size:.8rem;color:var(--text2);margin-top:2px">Mode: <b>${pay.mode.toUpperCase()}</b>${pay.note ? ` · ${pay.note}` : ''}</div>
            ${pay.screenshotBase64 ? `
              <div style="margin-top:8px">
                <img src="${pay.screenshotBase64}" style="max-width:100%;max-height:180px;border-radius:8px;border:2px solid var(--accent);cursor:pointer" onclick="Dues.viewScreenshot('${pay.id}', \`${pay.screenshotBase64}\`)"/>
                <div style="font-size:.7rem;color:var(--text3);margin-top:3px">📸 Payment Screenshot</div>
              </div>` : ''}
          </div>
        </div>`).join('');

    const statusColors = { paid: 'badge-green', partial: 'badge-orange', pending: 'badge-blue', overdue: 'badge-red' };

    document.getElementById('detail-modal-body').innerHTML = `
      <!-- Customer + Status -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px;background:var(--bg3);border-radius:16px;margin-bottom:18px">
        <div>
          <div style="font-size:1.3rem;font-weight:800;font-family:'Space Grotesk',sans-serif">${Utils.escapeHtml(due.customerName)}</div>
          ${due.customerMobile ? `<div style="font-size:.875rem;color:var(--text2);margin-top:4px">📱 ${due.customerMobile}</div>` : ''}
          ${due.customerAddress ? `<div style="font-size:.8rem;color:var(--text3);margin-top:2px">📍 ${Utils.escapeHtml(due.customerAddress)}</div>` : ''}
        </div>
        <div style="text-align:right">
          <span class="badge ${statusColors[due.status] || 'badge-blue'}" style="font-size:.9rem;padding:8px 14px;margin-bottom:8px;display:block">${due.status.toUpperCase()}</span>
          ${delayHtml}
        </div>
      </div>

      <!-- Bill Info -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:18px">
        <div style="background:var(--bg3);padding:14px;border-radius:12px;text-align:center;cursor:pointer" onclick="Billing.viewBill('${due.billId}')">
          <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Bill No (Click to View)</div>
          <div class="fw-700" style="color:var(--accent);text-decoration:underline">${due.billNumber}</div>
        </div>
        <div style="background:var(--bg3);padding:14px;border-radius:12px;text-align:center">
          <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Date Taken</div>
          <div class="fw-600">${new Date(due.dateTaken).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>
        </div>
        <div style="background:var(--bg3);padding:14px;border-radius:12px;text-align:center">
          <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Due Date</div>
          <div class="fw-600" style="color:${diffDays < 0 ? 'var(--danger)' : diffDays <= 3 ? 'var(--warning)' : 'var(--text)'}">${new Date(due.dueDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>
        </div>
      </div>

      <!-- Amount Summary -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:18px">
        <div style="background:rgba(123,97,255,.1);padding:14px;border-radius:12px;text-align:center;border:1px solid rgba(123,97,255,.2)">
          <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Total Due</div>
          <div class="fw-800" style="font-size:1.1rem;color:var(--accent)">${Utils.formatCurrency(due.totalAmount)}</div>
        </div>
        <div style="background:rgba(16,185,129,.1);padding:14px;border-radius:12px;text-align:center;border:1px solid rgba(16,185,129,.2)">
          <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Paid</div>
          <div class="fw-800" style="font-size:1.1rem;color:var(--success)">${Utils.formatCurrency(due.paidAmount || 0)}</div>
        </div>
        <div style="background:rgba(239,68,68,.1);padding:14px;border-radius:12px;text-align:center;border:1px solid rgba(239,68,68,.2)">
          <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Remaining</div>
          <div class="fw-800" style="font-size:1.1rem;color:var(--danger)">${Utils.formatCurrency(due.remainingAmount || due.totalAmount)}</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div style="margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--text3);margin-bottom:6px">
          <span>Payment Progress</span>
          <span>${due.totalAmount > 0 ? Math.round(((due.paidAmount||0)/due.totalAmount)*100) : 0}%</span>
        </div>
        <div style="height:10px;background:var(--bg3);border-radius:99px;overflow:hidden">
          <div style="height:100%;width:${due.totalAmount > 0 ? Math.min(100,((due.paidAmount||0)/due.totalAmount)*100) : 0}%;background:linear-gradient(90deg,var(--success),var(--accent));border-radius:99px;transition:width .5s"></div>
        </div>
      </div>

      <!-- Items Table -->
      <div style="margin-bottom:18px">
        <div style="font-size:.75rem;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px">Items Purchased</div>
        <table class="data-table">
          <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>

      <!-- Payment Timeline -->
      <div>
        <div style="font-size:.75rem;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px">Payment History</div>
        ${paymentsHtml}
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
        ${due.status !== 'paid' ? `<button class="btn btn-primary" style="flex:1;justify-content:center" onclick="document.getElementById('due-detail-modal').classList.remove('open');Dues.openRecordPayment('${due.id}')"><i class="ri-money-dollar-circle-line"></i> Record Payment</button>` : ''}
        ${due.customerMobile ? `<button class="btn" style="background:#25D366;color:#fff;flex:1;justify-content:center" onclick="Dues.sendReminder('${due.id}')"><i class="ri-whatsapp-line"></i> Send Reminder</button>` : ''}
        <button class="btn btn-secondary" onclick="Billing.downloadGSTPDF(null,'${due.billId}')"><i class="ri-file-pdf-line"></i> Bill PDF</button>
      </div>
    `;

    modal._dueId = dueId;
    modal.classList.add('open');
  },

  viewScreenshot(payId, src) {
    const w = window.open('', '_blank');
    w.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${src}" style="max-width:100%;max-height:100vh;object-fit:contain"/></body></html>`);
    w.document.close();
  },

  // ---- Delete due ----
  deleteDue(dueId) {
    if (!confirm('Delete this due record permanently?')) return;
    const dues = this.getAll().filter(d => d.id !== dueId);
    localStorage.setItem('shopapp_dues', JSON.stringify(dues));
    this.render();
    this.updateBadge();
    Notify.success('Due deleted.');
  },

  // ---- Main Render ----
  render() {
    const tbody = document.getElementById('dues-table-body');
    if (!tbody) return;

    this.checkOverdueStatus();
    const allDues = this.getAll().reverse();

    // Search filter
    const q = (document.getElementById('dues-search')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('dues-status-filter')?.value || '';
    const filtered = allDues.filter(d => {
      const matchQ = !q || d.customerName.toLowerCase().includes(q) || d.billNumber.toLowerCase().includes(q) || (d.customerMobile||'').includes(q);
      const matchS = !statusFilter || d.status === statusFilter;
      return matchQ && matchS;
    });

    // KPIs
    const totalDue = allDues.filter(d => d.status !== 'paid').reduce((s, d) => s + (d.remainingAmount || d.totalAmount), 0);
    const overdueCount = allDues.filter(d => d.status === 'overdue').length;
    const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0);
    const paidMonth = allDues.filter(d => d.status === 'paid' && new Date(d.createdAt) >= thisMonth)
      .reduce((s, d) => s + d.totalAmount, 0);

    const kpiTotal = document.getElementById('due-kpi-total');
    const kpiOverdue = document.getElementById('due-kpi-overdue');
    const kpiPaid = document.getElementById('due-kpi-paid');
    if (kpiTotal) kpiTotal.textContent = Utils.formatCurrency(totalDue);
    if (kpiOverdue) kpiOverdue.textContent = overdueCount + ' customers';
    if (kpiPaid) kpiPaid.textContent = Utils.formatCurrency(paidMonth);

    // Header badge
    const hdrBadge = document.getElementById('dues-page-total-badge');
    if (hdrBadge) hdrBadge.textContent = `Total Pending: ${Utils.formatCurrency(totalDue)}`;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><i class="ri-checkbox-circle-line" style="color:var(--success)"></i><h3>No dues found</h3><p>${q || statusFilter ? 'Try changing filter' : 'All customers have cleared their dues!'}</p></div></td></tr>`;
      return;
    }

    const today = new Date(); today.setHours(0,0,0,0);
    const statusColors = { paid: 'badge-green', partial: 'badge-orange', pending: 'badge-blue', overdue: 'badge-red' };
    const statusIcons  = { paid: '✅', partial: '🟡', pending: '🔵', overdue: '🔴' };

    tbody.innerHTML = filtered.map(due => {
      const dueDt = new Date(due.dueDate); dueDt.setHours(0,0,0,0);
      const diffDays = Math.ceil((dueDt - today) / (1000 * 60 * 60 * 24));
      const delayText = diffDays < 0 ? `<span style="color:var(--danger);font-size:.75rem;font-weight:700">${Math.abs(diffDays)}d late</span>`
        : diffDays === 0 ? `<span style="color:var(--warning);font-size:.75rem;font-weight:700">Today!</span>`
        : `<span style="color:var(--success);font-size:.75rem">${diffDays}d left</span>`;
      const pct = due.totalAmount > 0 ? Math.round(((due.paidAmount||0) / due.totalAmount) * 100) : 0;
      const products = (due.items || []).slice(0,2).map(it => it.name).join(', ') + (due.items.length > 2 ? ` +${due.items.length-2} more` : '');

      return `<tr onclick="Dues.viewDetail('${due.id}')" style="cursor:pointer" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">
        <td>
          <div class="fw-700">${Utils.escapeHtml(due.customerName)}</div>
          <div style="font-size:.75rem;color:var(--text3)">${due.customerMobile || '—'}</div>
        </td>
        <td style="font-size:.8rem;color:var(--text2);max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${products || '—'}</td>
        <td onclick="event.stopPropagation(); Billing.viewBill('${due.billId}')"><span class="fw-600" style="color:var(--accent);text-decoration:underline;cursor:pointer">${due.billNumber}</span></td>
        <td class="fw-700">${Utils.formatCurrency(due.totalAmount)}</td>
        <td style="color:var(--success)">${Utils.formatCurrency(due.paidAmount || 0)}</td>
        <td>
          <div style="font-weight:800;color:${due.status === 'paid' ? 'var(--success)' : 'var(--danger)'}">${Utils.formatCurrency(due.remainingAmount || due.totalAmount)}</div>
          <div style="height:4px;background:var(--border);border-radius:99px;margin-top:4px;width:80px">
            <div style="height:100%;width:${pct}%;background:var(--${pct >= 100 ? 'success' : 'accent'});border-radius:99px"></div>
          </div>
        </td>
        <td style="font-size:.8rem">${new Date(due.dateTaken).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</td>
        <td style="font-size:.8rem">${new Date(due.dueDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}<br>${delayText}</td>
        <td><span class="badge ${statusColors[due.status]}">${statusIcons[due.status]} ${due.status}</span></td>
        <td onclick="event.stopPropagation()">
          <div style="display:flex;gap:5px;flex-wrap:nowrap">
            ${due.status !== 'paid' ? `<button class="btn-icon btn btn-sm" onclick="Dues.openRecordPayment('${due.id}')" title="Record Payment" style="color:var(--success)"><i class="ri-money-dollar-circle-line"></i></button>` : ''}
            ${due.customerMobile ? `<button class="btn-icon btn btn-sm" onclick="Dues.sendReminder('${due.id}')" title="WhatsApp" style="color:#25D366"><i class="ri-whatsapp-line"></i></button>` : ''}
            <button class="btn-icon btn btn-sm" onclick="Billing.downloadGSTPDF(null,'${due.billId}')" title="Bill PDF"><i class="ri-file-pdf-line"></i></button>
            <button class="btn-icon btn btn-sm" style="color:var(--danger)" onclick="Dues.deleteDue('${due.id}')" title="Delete"><i class="ri-delete-bin-line"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  // Send reminders to ALL overdue customers
  sendAllReminders() {
    const overdue = this.getAll().filter(d => d.status === 'overdue' && d.customerMobile);
    if (!overdue.length) { Notify.info('No overdue customers with mobile numbers.'); return; }
    if (!confirm(`Send WhatsApp reminders to ${overdue.length} overdue customers?`)) return;
    let delay = 0;
    overdue.forEach(due => {
      setTimeout(() => this.sendReminder(due.id), delay);
      delay += 1500;
    });
    Notify.success(`Sending reminders to ${overdue.length} customers...`);
  }
};

// Override DB.get/add for 'dues' to use separate localStorage key
const _origDBGet = DB.get.bind(DB);
const _origDBAdd = DB.add.bind(DB);
const _origDBUpdate = DB.update.bind(DB);
const _origDBFindOne = DB.findOne.bind(DB);

DB.get = function(key) {
  if (key === 'dues') {
    try { return JSON.parse(localStorage.getItem('shopapp_dues') || '[]'); } catch(e) { return []; }
  }
  return _origDBGet(key);
};

DB.add = function(key, data) {
  if (key === 'dues') {
    const all = DB.get('dues');
    const item = { ...data, id: 'due_' + Date.now() + '_' + Math.random().toString(36).substr(2,5) };
    all.push(item);
    localStorage.setItem('shopapp_dues', JSON.stringify(all));
    return item;
  }
  return _origDBAdd(key, data);
};

DB.update = function(key, id, updates) {
  if (key === 'dues') {
    const all = DB.get('dues');
    const idx = all.findIndex(d => d.id === id);
    if (idx !== -1) { all[idx] = { ...all[idx], ...updates }; localStorage.setItem('shopapp_dues', JSON.stringify(all)); }
    return;
  }
  return _origDBUpdate(key, id, updates);
};

DB.findOne = function(key, fn) {
  if (key === 'dues') return DB.get('dues').find(fn) || null;
  return _origDBFindOne(key, fn);
};
