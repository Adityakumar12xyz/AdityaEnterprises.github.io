// ===== BILLING / POS MODULE (GST Invoice) =====
const Billing = {
  cart: [],
  customer: { name: '', mobile: '', address: '', gstin: '', isNew: false },

  init() {
    this.cart = [];
    this.populatePOSCategoryFilter();
    this.renderProductList();
    this.renderCustomerSearchList();
    this.renderMobileSearchList();
    this.renderBillHistory();
    this.updateCart();
    this.updateCustomerDisplay();
  },

  // ===== CUSTOMER =====
  renderCustomerSearchList() {
    const list = document.getElementById('customer-search-list');
    if (!list) return;
    const customers = DB.get('customers');
    list.innerHTML = customers.map(c => `<option value="${Utils.escapeHtml(c.name)} - ${Utils.escapeHtml(c.mobile || c.phone || 'No Mobile')}" data-id="${c.id}"></option>`).join('');
  },

  onCustomerSearchInput() {
    const val = document.getElementById('bill-customer-search').value;
    const list = document.getElementById('customer-search-list');
    if (!list) return;

    // Find if exact match exists in the datalist options
    const option = Array.from(list.options).find(opt => opt.value === val);
    if (option) {
      const id = option.getAttribute('data-id');
      const c = DB.findOne('customers', x => x.id === id);
      if (c) {
        this.customer = { id: c.id, name: c.name, mobile: c.mobile || c.phone || '', address: c.address || '', gstin: c.gstin || '', isNew: false };
        document.getElementById('bill-customer-id').value = c.id;
        document.getElementById('bill-cust-name').value = c.name;
        document.getElementById('bill-cust-mobile').value = c.mobile || c.phone || '';
        document.getElementById('bill-cust-address').value = c.address || '';
        document.getElementById('bill-cust-gstin').value = c.gstin || '';
      }
    } else {
      // Clear tracking id, means manual entry
      document.getElementById('bill-customer-id').value = '';
      this.customer.id = '';
      
      // If user clears the search completely, clear the fields too
      if (!val.trim()) {
        document.getElementById('bill-cust-name').value = '';
        document.getElementById('bill-cust-mobile').value = '';
        document.getElementById('bill-cust-address').value = '';
        document.getElementById('bill-cust-gstin').value = '';
      }
    }
    this.updateCustomerDisplay();
  },

  renderMobileSearchList() {
    const list = document.getElementById('mobile-search-list');
    if (!list) return;
    const customers = DB.get('customers');
    // Get unique mobile numbers
    const phones = [...new Set(customers.map(c => c.mobile || c.phone).filter(Boolean))];
    list.innerHTML = phones.map(p => `<option value="${p}"></option>`).join('');
  },

  onMobileInput() {
    const val = document.getElementById('bill-cust-mobile').value.trim();
    
    // Check if we have a direct match in DB for auto-fill
    if (val.length >= 10) {
      const c = DB.findOne('customers', x => (x.mobile === val || x.phone === val));
      if (c) {
        document.getElementById('bill-customer-id').value = c.id;
        document.getElementById('bill-cust-name').value = c.name;
        document.getElementById('bill-cust-address').value = c.address || '';
        document.getElementById('bill-cust-gstin').value = c.gstin || '';
        
        // Sync internal state
        this.customer = { 
          id: c.id, 
          name: c.name, 
          mobile: val, 
          address: c.address || '', 
          gstin: c.gstin || '', 
          isNew: false 
        };
        
        Notify.info(`⚡ Old Customer Found: ${c.name}`, 1200);
      }
    }
    
    this.updateCustomerDisplay();
  },

  updateCustomerDisplay() {
    const nEl = document.getElementById('bill-cust-name');
    this.customer.name = (nEl && nEl.value.trim()) || 'Walk-in Customer';
    const mEl = document.getElementById('bill-cust-mobile');
    this.customer.mobile = (mEl && mEl.value.trim()) || '';
    const aEl = document.getElementById('bill-cust-address');
    this.customer.address = (aEl && aEl.value.trim()) || '';
    const gEl = document.getElementById('bill-cust-gstin');
    this.customer.gstin = (gEl && gEl.value.trim()) || '';
  },

  autoSaveCustomerInfo() {
    const name = this.customer.name;
    const mobile = this.customer.mobile;
    const address = this.customer.address;
    const gstin = this.customer.gstin;

    if (!name || name === 'Walk-in Customer') return ''; // Don't save empty walk-ins

    let existing = null;
    if (this.customer.id) {
      existing = DB.findOne('customers', c => c.id === this.customer.id);
    } else if (mobile) {
      existing = DB.findOne('customers', c => c.mobile === mobile && c.name.toLowerCase() === name.toLowerCase());
      if (!existing) {
         existing = DB.findOne('customers', c => c.mobile === mobile);
      }
    }

    if (!existing) {
      existing = DB.add('customers', { name, mobile, phone: mobile, address, gstin, udhar: 0, totalPurchases: 0 });
    } else {
      DB.update('customers', existing.id, { 
        name: name,
        address: address || existing.address,
        gstin: gstin || existing.gstin
      });
    }

    this.customer.id = existing.id;
    this.renderCustomerSearchList();
    return existing.id;
  },

  // ===== PRODUCTS =====
  renderProductList() {
    const el = document.getElementById('pos-products');
    if (!el) return;
    const products = DB.get('products');
    const sEl = document.getElementById('pos-search');
    const q = (sEl && sEl.value && sEl.value.toLowerCase()) || '';
    const cEl = document.getElementById('pos-category-filter');
    const catF = (cEl && cEl.value) || '';
    const filtered = products.filter(p => {
      const avail = (p.serialNumbers || []).filter(s => !s.sold).length || p.quantity || 0;
      if (avail <= 0) return false;
      const matchQ = !q || p.name.toLowerCase().includes(q) || (p.model||'').toLowerCase().includes(q);
      const matchCat = !catF || p.category === catF;
      return matchQ && matchCat;
    });

    // Make the container a grid
    el.style.display = 'grid';
    el.style.gridTemplateColumns = 'repeat(auto-fill, minmax(170px, 1fr))';
    el.style.gap = '16px';
    el.style.alignContent = 'start';

    if (!filtered.length) {
      el.style.display = 'block'; // Fallback to block for empty state
      el.innerHTML = `<div class="empty-state" style="padding:30px 14px"><i class="ri-tv-2-line"></i><h3>No products available</h3><p>Add products in Inventory first</p></div>`;
      return;
    }

    el.innerHTML = filtered.map(p => {
      const avail = (p.serialNumbers || []).filter(s => !s.sold).length || p.quantity || 0;
      
      const cat = (p.category || '').toLowerCase();
      let icon = '📦';
      if (cat.includes('refrigerator') || cat.includes('fridge')) icon = '🧊';
      else if (cat.includes('tv') || cat.includes('television')) icon = '📺';
      else if (cat.includes('battery') || cat.includes('inverter') || cat.includes('ups')) icon = '🔋';
      else if (cat.includes('ac') || cat.includes('air conditioner') || cat.includes('cooler')) icon = '❄️';
      else if (cat.includes('washing')) icon = '🧺';
      else if (cat.includes('mobile') || cat.includes('phone') || cat.includes('smart')) icon = '📱';
      else if (cat.includes('laptop') || cat.includes('computer')) icon = '💻';
      else if (cat.includes('microwave') || cat.includes('oven')) icon = '🍱';
      else if (cat.includes('purifier') || cat.includes('water')) icon = '💧';
      else if (cat.includes('geyser') || cat.includes('heater') || cat.includes('iron')) icon = '♨️';

      const brand = p.brand || 'No Brand';
      const model = p.model || p.name || '-';
      const categoryName = p.category || 'Other';

      return `
      <div onclick="Billing.addToCart('${p.id}')" style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:22px 14px;border:1px solid var(--border);border-radius:20px;cursor:pointer;transition:all .25s cubic-bezier(0.34, 1.56, 0.64, 1);background:var(--card-bg);box-shadow:var(--shadow-sm);position:relative;overflow:hidden;min-height:220px;" onmouseover="this.style.borderColor='var(--accent)';this.style.transform='translateY(-6px)';this.style.boxShadow='var(--shadow)'" onmouseout="this.style.borderColor='var(--border)';this.style.transform='none';this.style.boxShadow='var(--shadow-sm)'">
        <div style="width:56px;height:56px;border-radius:18px;background:var(--gradient-soft);display:flex;align-items:center;justify-content:center;font-size:2.2rem;line-height:1;margin-bottom:12px;transition:transform 0.3s ease;box-shadow:inset 0 0 10px rgba(123,97,255,0.1)" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
          <span style="display:block;transform:translateY(2px)">${icon}</span>
        </div>
        <div class="fw-800" style="font-size:1.05rem;line-height:1.4;margin-bottom:4px;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'Space Grotesk', sans-serif;">${Utils.escapeHtml(brand)}</div>
        <div style="font-size:.7rem;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${Utils.escapeHtml(categoryName)}</div>
        <div style="font-size:.8rem;color:var(--text);margin-bottom:14px;background:var(--bg3);padding:4px 10px;border-radius:6px;border:1px solid var(--border);font-weight:600;">Model: ${Utils.escapeHtml(model)}</div>
        
        <div style="font-size:.8rem;color:${avail>0?'var(--success)':'var(--danger)'};margin-bottom:14px;font-weight:700;background:${avail>0?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.1)'};padding:4px 10px;border-radius:8px;">${avail} In Stock</div>
        <div class="fw-800" style="color:var(--accent);font-size:1.2rem;margin-top:auto;letter-spacing:0.5px">${Utils.formatCurrency(p.price)}</div>
      </div>`;
    }).join('');
  },

  populatePOSCategoryFilter() {
    const sel = document.getElementById('pos-category-filter');
    if (!sel) return;
    const cats = [...new Set(DB.get('products').map(p => p.category).filter(Boolean))];
    sel.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  },

  addToCart(productId) {
    const p = DB.findOne('products', x => x.id === productId);
    if (!p) return;
    const availSNs = (p.serialNumbers || []).filter(s => !s.sold);
    const hasSNs = availSNs.length > 0;

    if (hasSNs) {
      // Show SN selection modal
      this._pendingProductId = productId;
      this.showSNPicker(p, availSNs);
    } else {
      // No SNs, just add directly
      if (!p.quantity || p.quantity <= 0) { Notify.warning('Out of stock!'); return; }
      const existing = this.cart.find(i => i.productId === productId && !i.sn);
      const selPrice = parseFloat(p.price) || 0;
      const mrpPrice = parseFloat(p.mrp) || selPrice;
      if (existing) { existing.qty++; existing.total = existing.qty * existing.price; }
      else { this.cart.push({ productId, name: p.name, model: p.model||'', category: p.category||'', brand: p.brand||'', mrp: mrpPrice, qty: 1, price: selPrice, total: selPrice, sn: '' }); }
      this.updateCart();
      Notify.success(p.name + ' added', 1200);
    }
  },

  showSNPicker(p, availSNs) {
    const modal = document.getElementById('sn-picker-modal');
    document.getElementById('sn-picker-title').textContent = p.name + (p.model ? ` — Model: ${p.model}` : '');
    document.getElementById('sn-picker-list').innerHTML = availSNs.map(s => `
      <div onclick="Billing.selectSN('${p.id}','${s.sn.replace(/'/g,'\\\'')}')" style="display:flex;align-items:center;gap:12px;padding:13px 16px;border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer;transition:all .15s;background:var(--bg3)" onmouseover="this.style.borderColor='var(--accent)';this.style.background='var(--gradient-soft)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--bg3)'">
        <i class="ri-barcode-line" style="font-size:1.3rem;color:var(--accent)"></i>
        <div>
          <div class="fw-600" style="font-size:.9rem">${Utils.escapeHtml(s.sn)}</div>
          <div style="font-size:.75rem;color:var(--success)">✓ Available</div>
        </div>
        <i class="ri-arrow-right-line" style="margin-left:auto;color:var(--text3)"></i>
      </div>
    `).join('');
    modal.classList.add('open');
  },

  selectSN(productId, sn) {
    const p = DB.findOne('products', x => x.id === productId);
    if (!p) return;
    const existing = this.cart.find(i => i.sn === sn);
    if (existing) { Notify.warning('This serial number is already in cart'); return; }
    const selPrice = parseFloat(p.price) || 0;
    const mrpPrice = parseFloat(p.mrp) || selPrice;
    this.cart.push({ productId, name: p.name, model: p.model||'', category: p.category||'', brand: p.brand||'', mrp: mrpPrice, qty: 1, price: selPrice, total: selPrice, sn });
    document.getElementById('sn-picker-modal').classList.remove('open');
    this.updateCart();
    Notify.success(`Added: SN ${sn}`, 1500);
  },

  updateCart() {
    const el = document.getElementById('cart-items');
    const countEl = document.getElementById('cart-count');
    if (!el) return;

    if (!this.cart.length) {
      el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text2)">
        <i class="ri-shopping-cart-line" style="font-size:2.5rem;color:var(--text3);display:block;margin-bottom:10px"></i>
        <div style="font-size:.875rem">Cart is empty<br/>Click a product to add</div>
      </div>`;
    } else {
      el.innerHTML = this.cart.map((item, i) => `
        <div class="cart-item-row" style="padding:14px 0;">
          <div style="flex:1;min-width:0">
            <div style="font-size:1rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'Space Grotesk', sans-serif;">${Utils.escapeHtml(item.name)}</div>
            <div style="font-size:.8rem;color:var(--text2);margin-top:2px;">${item.model ? `Model: ${item.model}` : ''}${item.sn ? ` · SN: ${item.sn}` : ''}</div>
            <div style="font-size:.85rem;color:var(--text2);margin-top:2px;font-weight:600;">${Utils.formatCurrency(item.price)} each</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            ${item.sn ? `<span class="badge badge-blue" style="font-size:.75rem;padding:4px 8px;">1 unit</span>` : `
              <button class="qty-btn" style="width:32px;height:32px;font-size:1.1rem;" onclick="Billing.changeQty(${i},-1)"><i class="ri-subtract-line"></i></button>
              <span class="qty-input" style="width:48px;font-size:1rem;font-weight:700;display:flex;align-items:center;justify-content:center">${item.qty}</span>
              <button class="qty-btn" style="width:32px;height:32px;font-size:1.1rem;" onclick="Billing.changeQty(${i},1)"><i class="ri-add-line"></i></button>
            `}
          </div>
          <div style="font-weight:800;color:var(--accent);min-width:85px;text-align:right;font-size:1.05rem;">${Utils.formatCurrency(item.total)}</div>
          <button onclick="Billing.removeFromCart(${i})" style="color:var(--danger);font-size:1.2rem;margin-left:8px;padding:4px;border-radius:6px;background:var(--danger-bg);transition:all .2s;" onmouseover="this.style.background='var(--danger)';this.style.color='#fff'" onmouseout="this.style.background='var(--danger-bg)';this.style.color='var(--danger)'"><i class="ri-delete-bin-line"></i></button>
        </div>
      `).join('');
    }

    const subtotal = this.cart.reduce((s, i) => s + i.total, 0);
    const dAmtEl = document.getElementById('bill-discount-amt');
    const discountAmt = parseFloat(dAmtEl && dAmtEl.value) || 0;
    const dPctEl = document.getElementById('bill-discount-pct');
    const discountPct = parseFloat(dPctEl && dPctEl.value) || 0;
    const tEl = document.getElementById('bill-tax');
    const taxPct = parseFloat(tEl && tEl.value) || 0;
    const discountFromPct = subtotal * discountPct / 100;
    const totalDiscount = discountAmt + discountFromPct;
    const afterDiscount = subtotal - totalDiscount;
    const tax = afterDiscount * taxPct / 100;
    const total = afterDiscount + tax;
    const totalQty = this.cart.reduce((s, i) => s + i.qty, 0);

    document.getElementById('cart-subtotal').textContent = Utils.formatCurrency(subtotal);
    document.getElementById('cart-discount-val').textContent = totalDiscount > 0 ? `-${Utils.formatCurrency(totalDiscount)}` : '₹0.00';
    document.getElementById('cart-tax-val').textContent = Utils.formatCurrency(tax);
    document.getElementById('cart-total').textContent = Utils.formatCurrency(total);
    if (countEl) countEl.textContent = totalQty;

    return { subtotal, totalDiscount, tax, total, taxPct, totalQty };
  },

  changeQty(idx, delta) {
    const item = this.cart[idx];
    if (!item || item.sn) return;
    const newQty = item.qty + delta;
    if (newQty < 1) { this.removeFromCart(idx); return; }
    item.qty = newQty;
    item.total = item.qty * item.price;
    this.updateCart();
  },

  removeFromCart(idx) { this.cart.splice(idx, 1); this.updateCart(); },
  clearCart() { this.cart = []; this.updateCart(); },

  saveBill(status = 'paid') {
    if (!this.cart.length) { Notify.warning('Cart is empty!'); return; }
    this.updateCustomerDisplay();
    const custId = this.autoSaveCustomerInfo(); // Auto-dedupe/save here
    const custName = this.customer.name || 'Walk-in Customer';
    const vals = this.updateCart();
    const subtotal = this.cart.reduce((s, i) => s + i.total, 0);
    const dAmtEl = document.getElementById('bill-discount-amt');
    const discountAmt = parseFloat(dAmtEl && dAmtEl.value) || 0;
    const dPctEl = document.getElementById('bill-discount-pct');
    const discountPct = parseFloat(dPctEl && dPctEl.value) || 0;
    const tEl = document.getElementById('bill-tax');
    const taxPct = parseFloat(tEl && tEl.value) || 0;
    const discountFromPct = subtotal * discountPct / 100;
    const totalDiscount = discountAmt + discountFromPct;
    const afterDiscount = subtotal - totalDiscount;
    const tax = afterDiscount * taxPct / 100;
    const total = afterDiscount + tax;
    const notes = document.getElementById('bill-notes')?.value || '';

    const bill = DB.add('bills', {
      billNumber: Utils.generateBillNumber(),
      customerId: custId || '',
      customerName: custName,
      customerMobile: this.customer.mobile,
      customerAddress: this.customer.address,
      customerGstin: this.customer.gstin,
      items: this.cart.map(i => ({ ...i })),
      subtotal, totalDiscount, discountAmt, discountPct,
      taxPct, tax, total,
      totalQty: this.cart.reduce((s, i) => s + i.qty, 0),
      status, notes
    });

    // Mark SNs as sold
    this.cart.forEach(item => {
      if (item.sn) {
        const p = DB.findOne('products', x => x.id === item.productId);
        if (p) {
          const sns = p.serialNumbers || [];
          const snObj = sns.find(s => s.sn === item.sn);
          if (snObj) { snObj.sold = true; snObj.billNumber = bill.billNumber; snObj.soldAt = new Date().toISOString(); }
          DB.update('products', item.productId, { serialNumbers: sns, quantity: sns.filter(s => !s.sold).length });
        }
      } else {
        const p = DB.findOne('products', x => x.id === item.productId);
        if (p) DB.update('products', item.productId, { quantity: Math.max(0, p.quantity - item.qty) });
      }
    });

    // Update customer udhar
    if (this.customer.id && status === 'unpaid') {
      const c = DB.findOne('customers', x => x.id === this.customer.id);
      if (c) DB.update('customers', c.id, { udhar: (c.udhar||0) + total, totalPurchases: (c.totalPurchases||0) + total });
    } else if (this.customer.id) {
      const c = DB.findOne('customers', x => x.id === this.customer.id);
      if (c) DB.update('customers', c.id, { totalPurchases: (c.totalPurchases||0) + total });
    }

    DB.add('transactions', { type: 'sale', amount: total, description: `Bill ${bill.billNumber}`, date: new Date().toISOString() });

    Notify.success(`Bill ${bill.billNumber} saved!`);
    this.clearCart();
    this.renderProductList();
    this.renderBillHistory();
    Dashboard.renderKPIs();
    Dashboard.renderActivity();
    Dashboard.renderLowStockAlert();
    Inventory.load();

    // Show due date modal for unpaid bills, else success popup
    if (status === 'unpaid' && typeof Dues !== 'undefined') {
      setTimeout(() => Dues.openSetDueDate(bill), 300);
    } else {
      this.showBillSuccessModal(bill);
    }
  },

  showBillSuccessModal(bill) {
    const modalId = 'bill-success-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal" style="max-width:380px;text-align:center;padding:32px 24px;border-radius:24px;">
          <div style="width:72px;height:72px;border-radius:50%;background:rgba(16, 185, 129, 0.12);color:var(--success);display:flex;align-items:center;justify-content:center;font-size:2.8rem;margin:0 auto 18px;box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);">
            <i class="ri-check-line"></i>
          </div>
          <h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.5rem;font-weight:700;margin-bottom:8px;color:var(--text);">Bill Generated!</h2>
          <p style="color:var(--text2);font-size:.95rem;margin-bottom:28px;">Invoice <span id="bs-bill-no" style="font-weight:700;color:var(--accent);"></span> saved successfully.</p>
          
          <div style="display:flex;flex-direction:column;gap:12px;">
            <button id="bs-btn-print" class="btn btn-primary" style="justify-content:center;padding:14px;font-size:1.05rem;border-radius:12px;"><i class="ri-printer-line"></i> Print / Download PDF</button>
            <button id="bs-btn-wa" class="btn" style="justify-content:center;padding:14px;font-size:1.05rem;background:#25D366;color:#fff;border-radius:12px;box-shadow:0 4px 14px rgba(37,211,102,0.4);"><i class="ri-whatsapp-line"></i> Share on WhatsApp</button>
            <button id="bs-btn-view" class="btn btn-secondary" style="justify-content:center;padding:14px;font-size:1.05rem;border-radius:12px;"><i class="ri-eye-line"></i> View Bill Details</button>
          </div>
          
          <button id="bs-btn-close" style="margin-top:24px;color:var(--text3);font-size:.95rem;font-weight:500;text-decoration:underline;background:none;border:none;cursor:pointer;transition:color .2s;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text3)'">Close & New Bill</button>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // Set Data
    document.getElementById('bs-bill-no').textContent = '#' + bill.billNumber;

    // Bind events securely to current bill
    document.getElementById('bs-btn-print').onclick = () => { Billing.downloadGSTPDF(null, bill.id); };
    
    const waBtn = document.getElementById('bs-btn-wa');
    if (bill.customerMobile) {
      waBtn.style.display = 'flex';
      waBtn.onclick = () => { Billing.shareBillById(bill.id); };
    } else {
      waBtn.style.display = 'none'; // Hide if no mobile number
    }

    document.getElementById('bs-btn-view').onclick = () => { modal.classList.remove('open'); Billing.viewBill(bill.id); };
    document.getElementById('bs-btn-close').onclick = () => { modal.classList.remove('open'); };

    // Show modal with animation
    setTimeout(() => modal.classList.add('open'), 50);
  },

  sendWhatsApp(bill) {
    const session = JSON.parse(localStorage.getItem('shopapp_session') || '{}');
    const shopName = session.shop || 'Aditya Enterprises';
    const greeting = `🎉 *WELCOME TO ${shopName.toUpperCase()}!* 🎉\n\n`;
    
    const msg = greeting
      + `Dear *${bill.customerName}*,\n\n`
      + `Thank you for choosing us! We truly appreciate your trust and are thrilled to have you as our valued customer. ✨\n\n`
      + `*Here are your purchase details:*\n`
      + `🧾 *Bill No:* ${bill.billNumber}\n`
      + `📅 *Date:* ${Utils.formatDate(bill.createdAt)}\n\n`
      + `🛍️ *Items Purchased:*\n`
      + bill.items.map((i, idx) => `🔹 *${i.brand||''} ${i.name}*${i.model ? ` (${i.model})` : ''}${i.sn ? `\n    SN: ${i.sn}` : ''}\n    Qty: ${i.qty} × ₹${i.price.toLocaleString('en-IN')} = *₹${i.total.toLocaleString('en-IN')}*`).join('\n')
      + `\n\n`
      + (bill.totalDiscount > 0 ? `🎁 *Congrats! You saved:* ₹${bill.totalDiscount.toLocaleString('en-IN')}\n` : '')
      + `💰 *Total Amount:* ₹${bill.total.toLocaleString('en-IN')}\n\n`
      + `We hope you enjoy your new product! If you need any support or have questions, we are just a message away. Enjoy your day! 🌟\n\n`
      + `_Warm Regards,_\n*${shopName}*`;

    const phone = (bill.customerMobile && bill.customerMobile.replace(/\D/g,'')) || '';
    if (!phone) return;
    const intlPhone = phone.startsWith('91') ? phone : (phone.length === 10 ? '91' + phone : phone);
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  },

  renderBillHistory() {
    const el = document.getElementById('bill-history-body');
    if (!el) return;
    
    let bills = DB.get('bills').reverse();
    
    // Parse filters
    const qEl = document.getElementById('bill-search');
    const q = (qEl && qEl.value && qEl.value.toLowerCase()) || '';
    const dateFrom = document.getElementById('bill-date-from')?.value;
    const dateTo = document.getElementById('bill-date-to')?.value;

    bills = bills.filter(b => {
      // 1. Text Search: Bill No, Name, Phone, or Amount
      if (q) {
        const amtStr = b.total.toString();
        const matchesQuery = b.billNumber.toLowerCase().includes(q) 
                          || b.customerName.toLowerCase().includes(q) 
                          || (b.customerMobile||'').includes(q) 
                          || amtStr.includes(q);
        if (!matchesQuery) return false;
      }
      
      // 2. Date From
      const bDate = new Date(b.createdAt).toISOString().split('T')[0];
      if (dateFrom && bDate < dateFrom) return false;
      
      // 3. Date To
      if (dateTo && bDate > dateTo) return false;
      
      return true;
    });

    if (!bills.length) {
      el.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="ri-receipt-line"></i><h3>No bills yet</h3></div></td></tr>`;
      return;
    }
    
    el.innerHTML = bills.map(b => `
      <tr>
        <td><span class="fw-600" style="color:var(--accent)">${b.billNumber}</span></td>
        <td><div class="fw-600" style="font-size:.875rem">${Utils.escapeHtml(b.customerName)}</div><div style="font-size:.75rem;color:var(--text2)">${b.customerMobile||''}</div></td>
        <td>${b.items.length} item(s)</td>
        <td class="fw-600">${Utils.formatCurrency(b.total)}</td>
        <td><span class="badge ${b.status==='paid'?'badge-green':'badge-orange'}">${b.status}</span></td>
        <td>${Utils.formatDateTime(b.createdAt)}</td>
        <td><div style="display:flex;gap:6px">
          <button class="btn-icon btn" onclick="Billing.downloadGSTPDF(null,'${b.id}')" title="PDF"><i class="ri-file-pdf-line"></i></button>
          <button class="btn-icon btn" onclick="Billing.viewBill('${b.id}')" title="View"><i class="ri-eye-line"></i></button>
          <button class="btn-icon btn" onclick="Billing.sendWhatsAppById('${b.id}')" title="WhatsApp" style="color:#25D366;border-color:rgba(37,211,102,.3)"><i class="ri-whatsapp-line"></i></button>
        </div></td>
      </tr>
    `).join('');
  },

  exportBillExcel() {
    // Collect the exact filtered list currently displayed
    const qEl = document.getElementById('bill-search');
    const q = (qEl && qEl.value && qEl.value.toLowerCase()) || '';
    const dateFrom = document.getElementById('bill-date-from')?.value;
    const dateTo = document.getElementById('bill-date-to')?.value;

    let bills = DB.get('bills').reverse();
    bills = bills.filter(b => {
      if (q) {
        const amtStr = b.total.toString();
        const matchesQuery = b.billNumber.toLowerCase().includes(q) 
                          || b.customerName.toLowerCase().includes(q) 
                          || (b.customerMobile||'').includes(q) 
                          || amtStr.includes(q);
        if (!matchesQuery) return false;
      }
      const bDate = new Date(b.createdAt).toISOString().split('T')[0];
      if (dateFrom && bDate < dateFrom) return false;
      if (dateTo && bDate > dateTo) return false;
      return true;
    });

    if (!bills.length) { Notify.warning('No bills to export'); return; }

    const data = bills.map(b => {
      const itemsList = b.items.map(i => `${i.name} (Qty: ${i.qty})`).join(', ');
      return { 
        'Bill No': b.billNumber, 
        'Date': Utils.formatDateTime(b.createdAt), 
        'Customer': b.customerName, 
        'Phone': b.customerMobile || '',
        'Amount': b.total,
        'Status': b.status,
        'Items': itemsList
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bills History');
    XLSX.writeFile(wb, 'billing_history.xlsx');
    Notify.success('Billing History exported!');
  },

  sendWhatsAppById(id) {
    const bill = DB.findOne('bills', b => b.id === id);
    if (bill) this.sendWhatsApp(bill);
  },

  // ===== GST PDF (Matching website preview exactly) =====
  // ===== GST PDF (100% Matching Visual Capture) =====
  async downloadGSTPDF(bill, id) {
    if (!bill && id) bill = DB.findOne('bills', b => b.id === id);
    if (!bill) return;

    Notify.info('Generating 100% Matching PDF...', 2500);

    const container = document.getElementById('bill-print-container');
    if (!container) { Notify.error('Print container missing!'); return; }

    // 1. Render exactly as seen in Designer
    BillDesigner.render(bill, 'bill-print-container');
    
    // Temporary show/visibility for capture
    container.style.visibility = 'visible';
    container.style.display = 'block';
    
    // Get page size from format settings
    const pageSize = (localStorage.getItem('shopapp_fmt_page_size') || 'a4').toLowerCase();
    
    // Page dimensions mapping (mm)
    const dims = {
      'a4': [210, 297],
      'a5': [148, 210],
      'letter': [215.9, 279.4],
      'thermal': [80, 297] // Standard Width, flexible height
    };
    const [pW, pH] = dims[pageSize] || dims.a4;

    try {
      // 2. Capture high-fidelity image
      const canvas = await html2canvas(container, {
        scale: 2.0, // Reduced from 2.2 for faster generation
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 0, // Disable timeout to speed up
        backgroundColor: '#fff',
        onclone: (clonedDoc) => {
          // Hide "Page boundary" lines in the captured version
          const lines = clonedDoc.querySelectorAll('.no-print-line');
          lines.forEach(l => l.style.display = 'none');
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const { jsPDF } = window.jspdf;
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: pageSize === 'thermal' ? [80, Math.max(200, (canvas.height * 80) / canvas.width)] : [pW, pH],
        compress: true
      });

      const imgWidth = pW;
      const imgHeight = (canvas.height * pW) / canvas.width;
      
      // 3. Handle multi-page if content is longer than the page height
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pH;

      // Add subsequent pages if needed
      while (heightLeft > 0.5) { // 0.5mm buffer
        position = (heightLeft - imgHeight); // Move image up
        doc.addPage([pW, pH]);
        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pH;
      }

      doc.save(`Invoice_${bill.billNumber}.pdf`);
      Notify.success('High-Quality PDF Downloaded!');
    } catch (err) {
      console.error('PDF ERROR:', err);
      // Fallback or detailed error notify
      Notify.error('Failed to generate matching PDF. Check console.');
    } finally {
      container.style.visibility = 'hidden';
      container.style.display = 'none';
      container.innerHTML = '';
    }
  },

  async shareBillById(id) {
    const bill = DB.findOne('bills', b => b.id === id);
    if (!bill) return;

    // First try Web Share API if PDF sharing is possible
    if (navigator.share && navigator.canShare && typeof html2canvas !== 'undefined') {
      try {
        Notify.info('Preparing bill for sharing...');
        const container = document.getElementById('bill-print-container');
        BillDesigner.render(bill, 'bill-print-container');
        container.style.display = 'block';
        container.style.visibility = 'visible';

        const canvas = await html2canvas(container, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.addImage(imgData, 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], `Invoice_${bill.billNumber}.pdf`, { type: 'application/pdf' });

        container.style.display = 'none';
        container.style.visibility = 'hidden';

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Invoice #${bill.billNumber}`,
            text: `Invoice from Aditya Enterprises for ${bill.customerName}`
          });
          Notify.success('Shared successfully!');
          return;
        }
      } catch (err) {
        console.log('Share failed, falling back to text:', err);
      }
    }

    // Fallback to text message if sharing fails or not supported
    this.sendWhatsAppById(id);
  },

  viewBill(id) {
    const bill = DB.findOne('bills', b => b.id === id);
    if (!bill) return;
    
    // Use the designer's render engine to show full detailed view in a modal
    // Renamed ID to avoid collision with existing templates in app.html
    const modalId = 'bill-quick-viewer-modal'; 
    let modal = document.getElementById(modalId);
    if (!modal) {
       modal = document.createElement('div');
       modal.id = modalId;
       modal.className = 'modal-overlay';
       // Adjust overlay for scrollable content
       modal.style.alignItems = 'flex-start'; 
       modal.style.padding = '40px 20px';
       modal.style.overflowY = 'auto';

       modal.innerHTML = `
         <div class="modal" style="max-width:850px;padding:0;background:#b0b4c0;border:1px solid rgba(255,255,255,0.1);border-radius:24px;margin: 0 auto;box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            <div id="bill-view-header" style="background:var(--bg2);padding:14px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100;border-radius:24px 24px 0 0;">
               <!-- Dynamic Header Content -->
            </div>
            <div id="bill-detail-render-target" style="padding:20px;display:flex;flex-direction:column;align-items:center;width:100%;min-height:400px;background:#b0b4c0;border-radius:0 0 24px 24px;"></div>
         </div>
       `;
       document.body.appendChild(modal);
       
       // Handle overlay click to close
       modal.addEventListener('click', (e) => {
         if (e.target === modal) modal.classList.remove('open');
       });
    }
    
    // Update header for THIS specific bill
    const header = document.getElementById('bill-view-header');
    if (header) {
      header.innerHTML = `
        <h3 style="margin:0;font-family:'Space Grotesk',sans-serif;font-weight:700;">Invoice Details — ${bill.billNumber}</h3>
        <div style="display:flex;gap:10px;">
           <button class="btn btn-primary btn-sm" onclick="Billing.downloadGSTPDF(null,'${bill.id}')"><i class="ri-download-line"></i> Download PDF</button>
           <button class="btn btn-secondary btn-sm" onclick="document.getElementById('${modalId}').classList.remove('open')"><i class="ri-close-line"></i> Close</button>
        </div>
      `;
    }
    
    modal.classList.add('open');
    
    // Clear and Render
    setTimeout(() => {
       const target = document.getElementById('bill-detail-render-target');
       if (target) {
         target.innerHTML = ''; 
         BillDesigner.render(bill, 'bill-detail-render-target');
         // Hide boundary line in viewer
         const line = target.querySelector('.no-print-line');
         if (line) line.style.display = 'none';
       }
    }, 150);
  }
};
