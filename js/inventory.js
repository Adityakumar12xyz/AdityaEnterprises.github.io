// ===== INVENTORY MODULE (with Serial Number support) =====
const Inventory = {
  items: [], filtered: [], query: '', categoryFilter: '', editId: null,

  CATEGORIES: ['Refrigerator','Washing Machine','Air Conditioner','Television','Microwave Oven','Water Purifier','Geyser','Mixer/Grinder','Chimney','Dishwasher','Air Cooler','Iron','Vacuum Cleaner','Other'],
  BRANDS: ['Samsung', 'LG', 'Whirlpool', 'Haier', 'Bosch', 'Voltas', 'Blue Star', 'Daikin', 'Hitachi', 'Panasonic', 'Sony', 'Philips', 'Bajaj', 'Usha', 'Orient', 'Havells', 'Crompton', 'Kent', 'Pureit', 'Livpure', 'Luminous', 'Microtek', 'Exide', 'AmazonBasics', 'Pigeon', 'Prestige', 'Butterfly', 'Preethi', 'Elica', 'Faber', 'Glen', 'Sunflame', 'Maharaja Whiteline', 'Morphy Richards', 'Inalsa', 'Kenstar', 'V-Guard', 'Symphony', 'Hindware', 'Somany', 'IFB', 'Lloyd', 'Onida', 'Micromax', 'Sansui', 'BPL', 'Videocon', 'Godrej', 'Kelvinator', 'Singer', 'Eureka Forbes'],

  init() { this.load(); this.bindEvents(); },

  load() {
    this.items = DB.get('products');
    this.filtered = [...this.items];
    this.render();
    this.populateCategoryFilter();
    this.populateBrandSuggestions();
    this.updateInvCount();
  },

  updateInvCount() {
    const el = document.getElementById('inv-count');
    if (el) el.textContent = this.filtered.length + ' products';
    const low = this.items.filter(p => p.quantity <= 5).length;
    const badge = document.getElementById('nav-badge-inventory');
    if (badge) { badge.textContent = low || ''; badge.style.display = low ? '' : 'none'; }
  },

  render() {
    const el = document.getElementById('inv-table-body');
    if (!el) return;
    if (!this.filtered.length) {
      el.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="ri-box-3-line"></i><h3>No products found</h3><p>Add your first home appliance</p></div></td></tr>`;
      this.updateInvCount(); return;
    }
    el.innerHTML = this.filtered.map(p => {
      const sns = p.serialNumbers || [];
      const availSns = sns.filter(s => !s.sold).length;
      const stockBadge = availSns === 0 ? `<span class="badge badge-red">Out of Stock</span>` : availSns <= 3 ? `<span class="badge badge-orange"><i class="ri-alarm-warning-line"></i> ${availSns} left</span>` : `<span class="badge badge-green">${availSns} in stock</span>`;
      const profit = p.price && p.purchasePrice ? (((p.price - p.purchasePrice) / p.purchasePrice) * 100).toFixed(1) : 0;
      
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

      return `<tr>
        <td><div style="display:flex;align-items:center;gap:10px">
          <div style="min-width:40px;height:40px;border-radius:10px;background:var(--gradient-soft);display:flex;align-items:center;justify-content:center;font-size:1.5rem;box-shadow:inset 0 0 5px rgba(123,97,255,0.1)">
            <span style="display:block;transform:translateY(1px)">${icon}</span>
          </div>
          <div><div class="fw-600" style="font-size:.875rem">${Utils.highlight(Utils.escapeHtml(p.name), this.query)}</div>
          <div style="font-size:.7rem;color:var(--text2);margin-top:2px">Brand: <span class="fw-600" style="color:var(--text)">${Utils.escapeHtml(p.brand || 'No Brand')}</span></div>
          </div>
        </div></td>
        <td><span class="badge badge-purple">${Utils.escapeHtml(p.category || 'Other')}</span></td>
        <td class="fw-600">${p.quantity || availSns}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="Inventory.manageSNs('${p.id}')" style="font-size:.75rem">
            <i class="ri-barcode-line"></i> ${availSns}/${sns.length} SNs
          </button>
        </td>
        <td>${Utils.formatCurrency(p.purchasePrice)}</td>
        <td class="fw-600">${Utils.formatCurrency(p.price)}</td>
        <td><span style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'};font-weight:600">${profit >= 0 ? '+' : ''}${profit}%</span></td>
        <td>${stockBadge}</td>
        <td><div style="display:flex;gap:6px">
          <button class="btn-icon btn" onclick="Inventory.openEdit('${p.id}')" title="Edit"><i class="ri-edit-line"></i></button>
          <button class="btn-icon btn" onclick="Inventory.confirmDelete('${p.id}')" title="Delete" style="color:var(--danger);border-color:rgba(239,68,68,.2)"><i class="ri-delete-bin-line"></i></button>
        </div></td>
      </tr>`;
    }).join('');
    this.updateInvCount();
  },

  populateCategoryFilter() {
    const sel = document.getElementById('inv-cat-filter');
    if (!sel) return;
    sel.innerHTML = '<option value="">All Categories</option>' + this.CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    if (this.categoryFilter) sel.value = this.categoryFilter;
  },

  populateBrandSuggestions() {
    const list = document.getElementById('brand-suggestions');
    if (!list) return;
    
    // Get custom brands from DB or localStorage if any
    const customBrands = JSON.parse(localStorage.getItem('shopapp_custom_brands') || '[]');
    const allBrands = [...new Set([...this.BRANDS, ...customBrands])].sort();
    
    list.innerHTML = allBrands.map(b => `<option value="${b}">`).join('');
  },

  applyFilters() {
    const q = this.query.toLowerCase();
    this.filtered = this.items.filter(p => {
      const matchQ = !q || p.name.toLowerCase().includes(q) || (p.model||'').toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q);
      const matchCat = !this.categoryFilter || p.category === this.categoryFilter;
      return matchQ && matchCat;
    });
    this.render();
  },

  bindEvents() {
    const s = document.getElementById('inv-search');
    if (s) s.addEventListener('input', Utils.debounce(e => { this.query = e.target.value; this.applyFilters(); }, 250));
    const c = document.getElementById('inv-cat-filter');
    if (c) c.addEventListener('change', e => { this.categoryFilter = e.target.value; this.applyFilters(); });
  },

  populateCategorySelect(selId) {
    const sel = document.getElementById(selId);
    if (!sel) return;
    sel.innerHTML = this.CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
  },

  openAdd() {
    this.editId = null;
    document.getElementById('inv-modal-title').textContent = 'Add Product';
    document.getElementById('inv-form').reset();
    document.getElementById('inv-entry-id').value = '';
    document.getElementById('inv-bill-base64').value = '';
    document.getElementById('inv-sn').value = '';
    document.getElementById('inv-modal').classList.add('open');
  },

  openEdit(id) {
    this.editId = id;
    const p = DB.findOne('products', x => x.id === id);
    if (!p) return;
    document.getElementById('inv-modal-title').textContent = 'Edit Product';
    document.getElementById('inv-entry-id').value = p.entryId || '';
    document.getElementById('inv-brand').value = p.brand || '';
    document.getElementById('inv-category').value = p.category || '';
    document.getElementById('inv-name').value = p.name || '';
    document.getElementById('inv-hsn').value = p.hsn || '';
    document.getElementById('inv-date').value = p.purchaseDate || '';
    document.getElementById('inv-purchase-price').value = p.purchasePrice || '';
    document.getElementById('inv-mrp').value = p.mrp || '';
    document.getElementById('inv-price').value = p.price || '';
    document.getElementById('inv-sn').value = (p.serialNumbers || []).map(s => s.sn).join(', ');
    document.getElementById('inv-bill-base64').value = p.purchaseBill || '';
    
    document.getElementById('inv-modal').classList.add('open');
  },

  closeModal() { document.getElementById('inv-modal').classList.remove('open'); },

  save() {
    const entryId = document.getElementById('inv-entry-id').value.trim();
    const brand = document.getElementById('inv-brand').value.trim();
    const category = document.getElementById('inv-category').value.trim();
    const model = document.getElementById('inv-name').value.trim(); // Now used as Model Name/No
    const hsn = document.getElementById('inv-hsn').value.trim();
    const date = document.getElementById('inv-date').value;
    const pp = parseFloat(document.getElementById('inv-purchase-price').value) || 0;
    const mrp = parseFloat(document.getElementById('inv-mrp').value) || 0;
    const sp = parseFloat(document.getElementById('inv-price').value) || 0;
    
    if (!entryId) { Notify.warning('Entry ID is required'); return; }
    if (!model) { Notify.warning('Model Name/No is required'); return; }

    // Duplicate Check
    if (!this.editId) {
      const exists = this.items.find(p => p.model === model);
      if (exists) {
        Notify.error(`Model "${model}" already exists in inventory!`);
        return;
      }
    }

    // Auto-add brand to suggestons if new
    if (brand) {
      const customBrands = JSON.parse(localStorage.getItem('shopapp_custom_brands') || '[]');
      if (!this.BRANDS.includes(brand) && !customBrands.includes(brand)) {
        customBrands.push(brand);
        localStorage.setItem('shopapp_custom_brands', JSON.stringify(customBrands));
        this.populateBrandSuggestions();
      }
    }

    const snText = document.getElementById('inv-sn').value.trim();

    const snLines = snText ? snText.split(',').map(s => s.trim()).filter(Boolean) : [];
    const sns = snLines.map(sn => ({ sn, sold: false, addedAt: new Date().toISOString() }));
    const qty = sns.length;

    const data = { 
      name: model, // Main identifier
      entryId, brand, category, model, hsn, purchaseDate: date,
      purchasePrice: pp, mrp, price: sp, quantity: qty, purchaseBill: billBase64
    };

    if (this.editId) {
      const p = DB.findOne('products', x => x.id === this.editId);
      // Try to preserve existing sold serial numbers if editing
      data.serialNumbers = p ? p.serialNumbers : sns; 
      DB.update('products', this.editId, data);
      Notify.success('Product updated!');
    } else {
      DB.add('products', { ...data, serialNumbers: sns });
      Notify.success('Product added! Total Stock auto-calculated.');
    }
    this.closeModal();
    this.load();
    Dashboard.renderKPIs();
  },

  handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('inv-bill-base64').value = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  // Serial Number Management
  manageSNs(id) {
    const p = DB.findOne('products', x => x.id === id);
    if (!p) return;
    this._snProductId = id;
    document.getElementById('sn-product-name').textContent = p.name + (p.model ? ` (${p.model})` : '');
    this.renderSNList(p);
    document.getElementById('sn-modal').classList.add('open');
  },

  renderSNList(p) {
    const sns = p.serialNumbers || [];
    const el = document.getElementById('sn-list');
    if (!sns.length) {
      el.innerHTML = `<div class="empty-state" style="padding:20px"><i class="ri-barcode-line"></i><h3>No serial numbers</h3><p>Add serial numbers below</p></div>`;
      return;
    }
    el.innerHTML = `<table class="data-table">
      <thead><tr><th>#</th><th>Serial Number</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${sns.map((s, i) => `<tr>
        <td>${i+1}</td>
        <td class="fw-600">${Utils.escapeHtml(s.sn)}</td>
        <td><span class="badge ${s.sold ? 'badge-red' : 'badge-green'}">${s.sold ? 'Sold' : 'Available'}</span></td>
        <td>${s.sold ? `<span style="font-size:.75rem;color:var(--text2)">Bill: ${s.billNumber||'-'}</span>` : `<button class="btn btn-sm btn-danger" onclick="Inventory.removeSN('${p.id}',${i})"><i class="ri-delete-bin-line"></i></button>`}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  },

  addSN() {
    const input = document.getElementById('sn-input');
    const sn = input.value.trim();
    if (!sn) { Notify.warning('Enter a serial number'); return; }
    const p = DB.findOne('products', x => x.id === this._snProductId);
    if (!p) return;
    const sns = p.serialNumbers || [];
    if (sns.find(s => s.sn === sn)) { Notify.warning('Serial number already exists'); return; }
    sns.push({ sn, sold: false, addedAt: new Date().toISOString() });
    DB.update('products', this._snProductId, { serialNumbers: sns, quantity: sns.filter(s => !s.sold).length });
    input.value = '';
    this.load();
    this.renderSNList(DB.findOne('products', x => x.id === this._snProductId));
    Notify.success(`SN "${sn}" added`);
  },

  addBulkSNs() {
    const textarea = document.getElementById('sn-bulk-input');
    const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { Notify.warning('Enter serial numbers (one per line)'); return; }
    const p = DB.findOne('products', x => x.id === this._snProductId);
    if (!p) return;
    const sns = p.serialNumbers || [];
    let added = 0;
    lines.forEach(sn => {
      if (!sns.find(s => s.sn === sn)) { sns.push({ sn, sold: false, addedAt: new Date().toISOString() }); added++; }
    });
    DB.update('products', this._snProductId, { serialNumbers: sns, quantity: sns.filter(s => !s.sold).length });
    textarea.value = '';
    this.load();
    this.renderSNList(DB.findOne('products', x => x.id === this._snProductId));
    Notify.success(`${added} serial numbers added`);
  },

  removeSN(productId, idx) {
    const p = DB.findOne('products', x => x.id === productId);
    if (!p) return;
    const sns = p.serialNumbers || [];
    sns.splice(idx, 1);
    DB.update('products', productId, { serialNumbers: sns, quantity: sns.filter(s => !s.sold).length });
    this.load();
    this.renderSNList(DB.findOne('products', x => x.id === productId));
    Notify.success('Serial number removed');
  },

  closeSNModal() { document.getElementById('sn-modal').classList.remove('open'); },

  getAvailableSNs(productId) {
    const p = DB.findOne('products', x => x.id === productId);
    return (p && p.serialNumbers ? p.serialNumbers : []).filter(s => !s.sold);
  },

  confirmDelete(id) {
    const p = DB.findOne('products', x => x.id === id);
    if (!p) return;
    const el = document.getElementById('confirm-modal');
    document.getElementById('confirm-msg').textContent = `Delete "${p.name}" from inventory?`;
    document.getElementById('confirm-ok').onclick = () => {
      DB.delete('products', id);
      el.classList.remove('open');
      this.load();
      Dashboard.renderKPIs();
      Notify.success('Product deleted');
    };
    el.classList.add('open');
  },

  exportExcel() {
    const data = this.items.map(p => {
      const sns = (p.serialNumbers || []).filter(s => !s.sold).map(s => s.sn).join(', ');
      return { 'Name': p.name, 'Category': p.category || '', 'Model': p.model || '', 'Quantity': p.quantity, 'Purchase Price': p.purchasePrice, 'Selling Price': p.price, 'Available SNs': sns };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, 'inventory_export.xlsx');
    Notify.success('Inventory exported!');
  },

  openOCR() { document.getElementById('ocr-modal').classList.add('open'); document.getElementById('ocr-result').innerHTML = ''; },
  closeOCR() { document.getElementById('ocr-modal').classList.remove('open'); },

  async processOCR(file) {
    const resultEl = document.getElementById('ocr-result');
    const progressEl = document.getElementById('ocr-progress');
    if (!file) { Notify.warning('Please select an image'); return; }
    resultEl.innerHTML = '';
    progressEl.style.display = 'block';
    document.getElementById('ocr-progress-fill').style.width = '0%';
    document.getElementById('ocr-status').textContent = 'Initializing OCR engine...';
    try {
      const { createWorker } = Tesseract;
      const worker = await createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100);
            document.getElementById('ocr-progress-fill').style.width = pct + '%';
            document.getElementById('ocr-status').textContent = `Scanning: ${pct}%`;
          }
        }
      });
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();
      progressEl.style.display = 'none';
      this.parseOCRText(text, resultEl);
    } catch (err) {
      progressEl.style.display = 'none';
      resultEl.innerHTML = `<div style="color:var(--danger);padding:16px;text-align:center">OCR failed: ${err.message}</div>`;
    }
  },

  parseOCRText(text, resultEl) {
    const lines = text.split('\n').filter(l => l.trim().length > 2);
    const priceRegex = /(?:rs\.?|₹|inr)?\s*(\d+(?:[.,]\d+)?)/i;
    const qtyRegex = /(\d+)\s*(?:pcs?|nos?|qty|x|units?)/i;
    const parsed = lines.map(line => {
      const priceMatch = line.match(priceRegex);
      const qtyMatch = line.match(qtyRegex);
      return { raw: line.trim(), price: priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null, qty: qtyMatch ? parseInt(qtyMatch[1]) : 1, name: line.replace(priceRegex, '').replace(qtyRegex, '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().slice(0, 60) };
    }).filter(p => p.name.length > 2 && p.price);

    if (!parsed.length) {
      resultEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text2)">Could not extract product data. Try a clearer image.</div>`;
      return;
    }

    resultEl.innerHTML = `<div style="font-size:.8rem;font-weight:600;color:var(--text2);margin-bottom:12px">Found ${parsed.length} item(s):</div>
      ${parsed.map((p, i) => `<div id="ocr-row-${i}" style="background:var(--bg3);border-radius:var(--r-sm);padding:12px;margin-bottom:10px;border:1px solid var(--border)">
        <div style="display:grid;grid-template-columns:1fr 80px 120px auto;gap:8px;align-items:center">
          <input type="text" value="${Utils.escapeHtml(p.name)}" id="ocr-name-${i}" class="form-control" style="padding:8px 10px;font-size:.8rem" placeholder="Product name"/>
          <input type="number" value="${p.qty}" id="ocr-qty-${i}" class="form-control" style="padding:8px 10px;font-size:.8rem" min="1"/>
          <input type="number" value="${p.price || ''}" id="ocr-price-${i}" class="form-control" style="padding:8px 10px;font-size:.8rem"/>
          <button class="btn btn-success btn-sm" onclick="Inventory.addOCRItem(${i})"><i class="ri-add-line"></i> Add</button>
        </div>
      </div>`).join('')}`;
  },

  addOCRItem(i) {
    const name = document.getElementById(`ocr-name-${i}`).value.trim();
    const qty = parseInt(document.getElementById(`ocr-qty-${i}`).value) || 1;
    const price = parseFloat(document.getElementById(`ocr-price-${i}`).value) || 0;
    if (!name) { Notify.warning('Product name required'); return; }
    DB.add('products', { name, quantity: qty, price, purchasePrice: price * 0.8, category: 'Other', serialNumbers: [] });
    document.getElementById(`ocr-row-${i}`).style.opacity = '.4';
    document.getElementById(`ocr-row-${i}`).style.pointerEvents = 'none';
    Notify.success(`"${name}" added!`);
    this.load();
  }
};
