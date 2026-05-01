// ===== LIVE BILL FORMAT DESIGNER =====
const BillDesigner = {
  defaults: {
    accent_color: '#000000', shop_name_size: 14, shop_name_bold: 'bold',
    shop_name_color: '#000000', address_size: 8, logo_size: 22,
    table_header_bg: '#1a1a2e', table_header_color: '#ffffff',
    row_size: 8.5, row_height: 14, total_color: '#000000',
    discount_color: '#cc0000', show_words: 'true', show_bank: 'true',
    gst_title: 'GST TAX INVOICE', title_size: 14,
    font: 'Arial, sans-serif', margin: 8,
    terms_text: 'All disputes subject to local jurisdiction only. Goods once sold will not be taken back or exchanged. Warranty as per manufacturer terms.',
    terms_size: 7,
    terms_numbering: 'false',
    show_logo: 'true', show_qr: 'true', qr_size: 25,
    page_size: 'a4',
    bottom_layout: 'stack',
    bottom_text: '', bottom_text_size: 10, bottom_text_align: 'center', bottom_text_bold: 'false',
    bottom_images: '[]' // Array of { src, width, align }
  },

  fmt: {},

  open() {
    this.load();
    const modal = document.getElementById('bill-designer-modal');
    if (modal) { modal.style.display = 'flex'; }
    this.syncControlsFromFmt();
    this.render();
    this.bindControls();
  },

  close() {
    const modal = document.getElementById('bill-designer-modal');
    if (modal) modal.style.display = 'none';
  },

  load() {
    this.fmt = {};
    Object.keys(this.defaults).forEach(k => {
      const saved = localStorage.getItem('shopapp_fmt_' + k);
      this.fmt[k] = (saved !== null) ? saved : String(this.defaults[k]);
    });
    
    // Migration: bottom_img -> bottom_images
    const oldImg = localStorage.getItem('shopapp_fmt_bottom_img');
    if (oldImg && (!this.fmt.bottom_images || this.fmt.bottom_images === '[]')) {
      const oldW = localStorage.getItem('shopapp_fmt_bottom_img_width') || '150';
      const oldA = localStorage.getItem('shopapp_fmt_bottom_img_align') || 'center';
      const migrated = [{ src: oldImg, width: parseFloat(oldW), align: oldA }];
      this.fmt.bottom_images = JSON.stringify(migrated);
      localStorage.setItem('shopapp_fmt_bottom_images', this.fmt.bottom_images);
      localStorage.removeItem('shopapp_fmt_bottom_img');
      localStorage.removeItem('shopapp_fmt_bottom_img_width');
      localStorage.removeItem('shopapp_fmt_bottom_img_align');
    }
  },

  getImages() {
    try { return JSON.parse(this.getStr('bottom_images')); } catch(e) { return []; }
  },

  getNum(k) { return parseFloat(this.fmt[k] !== undefined ? this.fmt[k] : this.defaults[k]); },
  getBool(k) { return this.fmt[k] === 'true' || this.fmt[k] === true; },
  getStr(k) { return (this.fmt[k] !== undefined && this.fmt[k] !== '') ? this.fmt[k] : String(this.defaults[k]); },

  save() {
    Object.keys(this.fmt).forEach(k => localStorage.setItem('shopapp_fmt_' + k, String(this.fmt[k])));
    if (typeof Settings !== 'undefined' && Settings.syncSettingsToFirebase) Settings.syncSettingsToFirebase();
    Notify.success('Bill format saved! Your next PDF will use this design.');
  },

  reset() {
    if (!confirm('Reset bill format to default settings?')) return;
    Object.keys(this.defaults).forEach(k => { this.fmt[k] = String(this.defaults[k]); localStorage.removeItem('shopapp_fmt_' + k); });
    this.syncControlsFromFmt();
    this.render();
    Notify.info('Format reset to default.');
  },

  downloadTest() {
    const sampleBill = {
      billNumber: 'INV-SAMPLE', createdAt: new Date().toISOString(),
      customerName: 'Demo Customer', customerMobile: '9876543210',
      items: [
        { name: 'Samsung Refrigerator', model: 'RT28T3032', sn: 'SN001', qty: 1, price: 28000, total: 28000 },
        { name: 'LG 1.5T AC', model: 'PS-Q19YN', sn: 'SN002', qty: 1, price: 45000, total: 45000 }
      ],
      subtotal: 73000, totalDiscount: 2000, total: 71000, totalQty: 2, status: 'paid'
    };
    Billing.downloadGSTPDF(sampleBill);
  },

  // ---- Upload / Remove helpers ----
  uploadLogo(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      localStorage.setItem('shopapp_logo_base64', e.target.result);
      this.render(); Notify.success('Logo updated!');
    };
    reader.readAsDataURL(file);
  },
  removeLogo() { localStorage.removeItem('shopapp_logo_base64'); this.render(); Notify.info('Logo removed'); },

  uploadDesignerQR(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      localStorage.setItem('shopapp_qr_base64', e.target.result);
      this.render(); Notify.success('QR updated!');
    };
    reader.readAsDataURL(file);
  },
  removeDesignerQR() { localStorage.removeItem('shopapp_qr_base64'); this.render(); Notify.info('QR removed'); },

  addBottomImage(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const images = this.getImages();
      images.push({ src: e.target.result, width: 150, align: 'center' });
      this.fmt.bottom_images = JSON.stringify(images);
      this.render();
      this.syncControlsFromFmt();
      Notify.success('Image added to bottom area!');
    };
    reader.readAsDataURL(file);
    input.value = ''; // clear for next time
  },

  removeBottomImage(index) {
    const images = this.getImages();
    images.splice(index, 1);
    this.fmt.bottom_images = JSON.stringify(images);
    this.render();
    this.syncControlsFromFmt();
    Notify.info('Image removed');
  },

  updateBottomImage(index, key, val) {
    const images = this.getImages();
    if (images[index]) {
      images[index][key] = val;
      this.fmt.bottom_images = JSON.stringify(images);
      this.render();
      // Update label value if it's width
      if (key === 'width') {
        const lbl = document.getElementById(`bdf-btimg-w-lbl-${index}`);
        if (lbl) lbl.textContent = val + 'px';
      }
    }
  },

  // ---- Main Render ----
  render(billData = null, targetId = 'bill-preview-a4') {
    if (!this.fmt || Object.keys(this.fmt).length === 0) this.load();
    const el = document.getElementById(targetId);
    if (!el) return;
    const session   = JSON.parse(localStorage.getItem('shopapp_session') || '{}');
    const logoData  = localStorage.getItem('shopapp_logo_base64');
    const qrData    = localStorage.getItem('shopapp_qr_base64');
    const shopAddr  = localStorage.getItem('shopapp_address') || 'Main Market, City - 000000';
    const shopState = localStorage.getItem('shopapp_state')   || 'Uttar Pradesh, Code: 09';
    const bankName  = localStorage.getItem('shopapp_bank')    || 'State Bank of India';
    const bankAcc   = localStorage.getItem('shopapp_bank_acc')  || 'XXXXXXXXXXXXXXXX';
    const bankIfsc  = localStorage.getItem('shopapp_bank_ifsc') || 'SBIN0000001';
    const gst       = localStorage.getItem('shopapp_gst')    || '09ATPPG8399G1ZV';
    const shopName  = session.shop  || 'YOUR SHOP NAME';
    const shopPhone = session.phone || '9999999999';

    let bottomHtml  = '';
    const acc       = this.getStr('accent_color');
    const mgPx      = Math.round(this.getNum('margin') * 3.779);
    const logoSizePx= Math.round(this.getNum('logo_size') * 3.779);
    const qrSizePx  = Math.round(this.getNum('qr_size') * 3.779);
    const ff        = this.getStr('font');
    const showLogo  = this.getBool('show_logo');
    const showQR    = this.getBool('show_qr');

    // Custom bottom area
    const btText    = this.getStr('bottom_text');
    const btTxtSize = this.getNum('bottom_text_size');
    const btAlign   = this.getStr('bottom_text_align');
    const btBold    = this.getBool('bottom_text_bold') ? 'bold' : 'normal';
    const btImages  = this.getImages();
    const btLayout  = this.getStr('bottom_layout');

    if (btText || btImages.length > 0) {
      let inner = '';
      const txtDiv = btText ? `<div style="font-size:${btTxtSize}pt;font-weight:${btBold};text-align:${btAlign};white-space:pre-wrap;line-height:1.6;color:#111;">${btText}</div>` : '';
      const imgDiv = btImages.length > 0 ? `
        <div style="display:flex;flex-flow:row wrap;justify-content:center;gap:20px;width:100%;margin-top:15px;padding-bottom:10px;">
          ${btImages.map(img => `<img src="${img.src}" style="width:${img.width}px;max-width:100%;object-fit:contain;height:auto;"/>`).join('')}
        </div>` : '';

      if (btLayout === 'stack') inner = `<div style="display:flex;flex-direction:column;gap:12px;">${txtDiv}${imgDiv}</div>`;
      else if (btLayout === 'text-only') inner = txtDiv;
      else if (btLayout === 'img-only') inner = imgDiv;
      else if (btLayout === 'side-left') inner = `<div style="display:flex;gap:16px;align-items:center;">${imgDiv?`<div style="flex-shrink:0;">${imgDiv}</div>`:''}<div style="flex:1;">${txtDiv}</div></div>`;
      else if (btLayout === 'side-right') inner = `<div style="display:flex;gap:16px;align-items:center;justify-content:space-between;"><div style="flex:1;">${txtDiv}</div>${imgDiv?`<div style="flex-shrink:0;">${imgDiv}</div>`:''}</div>`;
      
      bottomHtml = `<div style="padding:14px 12px;border-bottom:1px solid ${acc};">${inner}</div>`;
    }

    // Data handling
    let items = [], discount = 0, tax = 0, total = 0, billNo = 'PREV-01', date = new Date().toLocaleDateString(), cust = { name: 'Demo Customer', mobile: '9000000000', address: 'Customer Address, City', gstin: '' };
    
    if (billData) {
      items = (billData.items || []).map(item => {
        if (!item.brand || !item.category) {
          const prod = window.DB ? DB.findOne('products', p => p.id === item.productId) : null;
          if (prod) {
            item.brand = item.brand || prod.brand || '';
            item.category = item.category || prod.category || '';
          }
        }
        return item;
      });
      discount = billData.totalDiscount || 0;
      tax = billData.tax || 0;
      total = billData.total || 0;
      billNo = billData.billNumber || '0001';
      date = new Date(billData.createdAt).toLocaleDateString('en-GB');
      cust = { 
        name: billData.customerName || 'Walk-in Customer', 
        mobile: billData.customerMobile || '', 
        address: billData.customerAddress || '',
        gstin: billData.customerGstin || ''
      };
    } else {
      items = [
        { name: 'Samsung Double Door Refrigerator', model: 'RT28T3032R3', sn: 'SMSNG2024001', qty: 1, price: 28000, total: 28000 },
        { name: 'LG 1.5 Ton 5 Star AC',            model: 'PS-Q19YNZE',  sn: 'LG20240156',   qty: 1, price: 45000, total: 45000 }
      ];
      discount = 2000;
      netTotal = items.reduce((s,i)=>s+i.total,0) - discount;
      total = netTotal;
    }
    const subtotal = items.reduce((s,i) => s + i.total, 0);
    const totalQty = items.reduce((s,i) => s + i.qty, 0);

    const pageSize = this.getStr('page_size');
    const dims = {
      'a4': { w: 794, h: 1123 },
      'a5': { w: 559, h: 794 },
      'letter': { w: 816, h: 1056 },
      'thermal': { w: 302, h: 1200 } // Long receipt style
    };
    const curDim = dims[pageSize] || dims.a4;

    el.style.width = curDim.w + 'px';
    // Removed fixed height to allow user to see overflow
    el.style.height = 'auto'; 
    el.style.minHeight = curDim.h + 'px'; 
    el.style.overflow = 'visible';
    el.style.position = 'relative';

    el.style.fontFamily =ff;
    el.innerHTML = `
<div id="bill-inner-container" style="margin:${mgPx}px;border:2.4px solid ${acc};min-height:${curDim.h - (mgPx*2)}px;font-family:${ff};color:#111;position:relative;background:#fff;display:flex;flex-direction:column;box-sizing:border-box;">
  <!-- 🛑 PAGE BOUNDARY LINE (Hidden during print capture) -->
  <div class="no-print-line" style="position:absolute;top:${curDim.h - (mgPx*2)}px;left:-2px;width:calc(100% + 4px);border-top:3px dashed #ff4444;z-index:9999;pointer-events:none;">
    <span style="position:absolute;right:0;top:-22px;background:#ff4444;color:#fff;font-size:10px;padding:2px 8px;font-weight:bold;border-radius:4px 4px 0 0;">PAGE END / CUT-OFF LINE</span>
  </div>

  <!-- HEADER ROW -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-bottom:1.8px solid ${acc};">
    <div style="font-size:${this.getNum('address_size')*.8}pt;color:#777;">e-Invoice</div>
    <div style="font-size:${this.getNum('title_size')}pt;font-weight:900;letter-spacing:.5px;text-transform:uppercase;">${this.getStr('gst_title')}</div>
    <div style="font-size:${this.getNum('address_size')*.8}pt;color:#777;">(ORIGINAL FOR RECIPIENT)</div>
  </div>

  <!-- SHOP INFO + INVOICE DETAILS -->
  <div style="display:grid;grid-template-columns:56% 44%;border-bottom:1.8px solid ${acc};">
    <div style="padding:10px 12px;border-right:1.8px solid ${acc};display:flex;gap:12px;align-items:flex-start;">
      ${showLogo && logoData ? `<img src="${logoData}" style="width:${logoSizePx}px;height:${logoSizePx}px;object-fit:contain;flex-shrink:0;border-radius:4px;"/>` : ''}
      <div>
        <div style="font-size:${this.getNum('shop_name_size')}pt;font-weight:${this.getStr('shop_name_bold')};color:${this.getStr('shop_name_color')};margin-bottom:4px;line-height:1.2;">${shopName}</div>
        <div style="font-size:${this.getNum('address_size')}pt;color:#333;line-height:1.6;white-space:pre-wrap;">${shopAddr}</div>
        <div style="font-size:${this.getNum('address_size')}pt;color:#333;margin-top:4px;"><b>MOB:</b> ${shopPhone}</div>
        ${gst ? `<div style="font-size:${this.getNum('address_size')}pt;color:#333;"><b>GSTIN/UIN:</b> ${gst}</div>` : ''}
        ${shopState ? `<div style="font-size:${this.getNum('address_size')}pt;color:#333;"><b>State:</b> ${shopState}</div>` : ''}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;font-size:${this.getNum('address_size')}pt;">
      ${[
        ['Invoice No.', `<b style="color:${acc};font-size:1.1em;">${billNo}</b>`],
        ['Dated', `<b>${date}</b>`],
        ['Delivery Note','—'],
        ['Mode/Terms of Payment','Immediate'],
        ["Buyer's Order No.",'—'],
        ['Other Reference(s)','—']
      ].map((r,i)=>`
        <div style="padding:6px 10px;border-bottom:1px solid ${acc};${i%2===0?'border-right:1px solid '+acc+';':''}">
          <div style="color:#888;font-size:${this.getNum('address_size')*.8}pt;margin-bottom:2px;">${r[0]}</div><div style="line-height:1.2;">${r[1]}</div>
        </div>`).join('')}
      <div style="padding:6px 10px;grid-column:1/3;">
        <div style="color:#888;font-size:${this.getNum('address_size')*.8}pt;margin-bottom:2px;">Dispatch Through / Destination</div><div>—</div>
      </div>
    </div>
  </div>

  <!-- BUYER INFO -->
  <div style="padding:10px 12px;border-bottom:1.8px solid ${acc};background:rgba(0,0,0,0.01);">
    <div style="font-size:${this.getNum('address_size')*.8}pt;color:#888;margin-bottom:4px;">Buyer (Bill to)</div>
    <div style="font-size:${this.getNum('shop_name_size')*.85}pt;font-weight:900;margin-bottom:4px;color:#000;">${cust.name.toUpperCase()}</div>
    <div style="font-size:${this.getNum('address_size')}pt;color:#333;line-height:1.5;white-space:pre-wrap;max-width:80%;">${cust.address || 'No Address Provided'}</div>
    ${cust.mobile ? `<div style="font-size:${this.getNum('address_size')}pt;color:#333;margin-top:2px;"><b>Mob:</b> ${cust.mobile}</div>` : ''}
    ${cust.gstin ? `<div style="font-size:${this.getNum('address_size')}pt;color:#333;"><b>GSTIN:</b> ${cust.gstin}</div>` : ''}
  </div>

  <!-- ITEMS TABLE -->
  <table style="width:100%;border-collapse:collapse;font-size:${this.getNum('row_size')}pt;table-layout:fixed;">
    <thead>
      <tr style="background:${this.getStr('table_header_bg')};color:${this.getStr('table_header_color')};">
        <th style="border:1px solid ${acc};padding:8px 4px;text-align:center;width:40px;">Sl No.</th>
        <th style="border:1px solid ${acc};padding:8px 10px;text-align:left;">Description of Goods</th>
        <th style="border:1px solid ${acc};padding:8px 4px;text-align:center;width:70px;">Unit/Qty</th>
        <th style="border:1px solid ${acc};padding:8px 4px;text-align:right;width:110px;">MRP (₹)</th>
        <th style="border:1px solid ${acc};padding:8px 8px;text-align:right;width:130px;">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item,i)=>`
        <tr style="min-height:${this.getNum('row_height')*3.779}px;">
          <td style="border:1px solid ${acc};padding:8px 4px;text-align:center;vertical-align:top;font-weight:bold;">${i+1}</td>
          <td style="border:1px solid ${acc};padding:8px 10px;vertical-align:top;">
            <div style="font-weight:bold;font-size:1.05em;margin-bottom:3px;color:#000;">${item.brand ? (item.brand.toUpperCase() + ' ') : ''}${item.name}</div>
            <div style="font-size:0.85em;color:#444;margin-bottom:2px;font-style:italic;">Type: ${item.category || 'Other'}</div>
            <div style="font-size:0.9em;color:#555;line-height:1.4;">
              ${item.sn ? `SN: <span style="color:${acc};font-weight:bold;">${item.sn}</span>` : ''}
            </div>
          </td>
          <td style="border:1px solid ${acc};padding:8px 4px;text-align:center;vertical-align:top;font-weight:700;">${item.qty}</td>
          <td style="border:1px solid ${acc};padding:8px 4px;text-align:right;vertical-align:top;color:#000;font-weight:bold;">${(item.mrp || item.price).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
          <td style="border:1px solid ${acc};padding:8px 8px;text-align:right;vertical-align:top;font-weight:bold;color:#000;">${item.total.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
        </tr>`).join('')}
      ${[1, 2, 3].map(() => `<tr style="height:25px;"><td style="border:1px solid ${acc};"></td><td style="border:1px solid ${acc};"></td><td style="border:1px solid ${acc};"></td><td style="border:1px solid ${acc};"></td><td style="border:1px solid ${acc};"></td></tr>`).join('')}
    </tbody>
  </table>

  <!-- TOTALS SECTION -->
  <div style="margin-top:auto;">
    <div style="display:grid;grid-template-columns:1fr 200px;border-top:1.8px solid ${acc};">
      <div style="padding:10px 12px;border-right:1.8px solid ${acc};">
        <div style="font-size:0.85em;color:#777;margin-bottom:4px;">Amount Chargeable (in words)</div>
        <div style="font-weight:bold;font-style:italic;font-size:1em;color:#000;text-transform:capitalize;">
          INR ${Utils.numToWords ? Utils.numToWords(Math.round(total)) : '—'} Only
        </div>
      </div>
      <div style="display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid ${acc};font-size:0.95em;">
          <span>Sub Total:</span>
          <b>${subtotal.toLocaleString('en-IN', {minimumFractionDigits:2})}</b>
        </div>
        ${discount > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid ${acc};font-size:0.95em;color:${this.getStr('discount_color')};">
          <span>Discount:</span>
          <b>-${discount.toLocaleString('en-IN', {minimumFractionDigits:2})}</b>
        </div>` : ''}
        ${tax > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid ${acc};font-size:0.95em;">
          <span>Tax:</span>
          <b>${tax.toLocaleString('en-IN', {minimumFractionDigits:2})}</b>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:8px 10px;background:rgba(0,0,0,0.04);color:${this.getStr('total_color')};">
          <span style="font-weight:bold;">Total Payable:</span>
          <b style="font-size:1.3em;">${total.toLocaleString('en-IN', {minimumFractionDigits:2})}</b>
        </div>
      </div>
    </div>

    <!-- BANK + SIGNATURE -->
    <div style="display:grid;grid-template-columns:55% 45%;border-top:1.8px solid ${acc};min-height:90px;">
      ${this.getBool('show_bank') ? `
      <div style="padding:8px 12px;border-right:1.8px solid ${acc};font-size:${this.getNum('address_size')}pt;">
        <div style="font-weight:bold;margin-bottom:4px;text-decoration:underline;">Bank Details:</div>
        <div><b>Bank:</b> ${bankName}</div>
        ${bankAcc ? `<div><b>A/c No:</b> ${bankAcc}</div>` : ''}
        ${bankIfsc ? `<div><b>IFSC:</b> ${bankIfsc}</div>` : ''}
      </div>` : `<div style="border-right:1.8px solid ${acc};"></div>`}
      <div style="padding:8px 12px;display:flex;flex-direction:column;justify-content:space-between;text-align:right;">
        <div style="font-size:0.85em;color:#777;text-align:left;">Receiver's Signature:</div>
        <div>
          <div style="font-size:0.85em;color:#000;margin-bottom:30px;">for <b>${shopName}</b></div>
          <div style="font-size:0.8em;font-weight:bold;text-transform:uppercase;">Authorized Signatory</div>
        </div>
      </div>
    </div>

    <!-- QR + TERMS -->
    <div style="display:grid;grid-template-columns:30% 70%;border-top:1.8px solid ${acc};min-height:${Math.max(100, qrSizePx + 40)}px;">
      <div style="padding:10px;border-right:1.8px solid ${acc};display:flex;flex-direction:column;align-items:center;justify-content:center;">
        ${showQR && qrData ? `
          <img src="${qrData}" style="width:${qrSizePx}px;height:${qrSizePx}px;object-fit:contain;"/>
          <div style="font-size:7pt;color:#777;margin-top:4px;font-weight:bold;text-transform:uppercase;">Scan & Pay</div>
        ` : `<div style="color:#ccc;font-style:italic;font-size:8pt;">QR Code</div>`}
      </div>
      <div style="padding:10px 12px;">
        <div style="font-weight:bold;font-size:${this.getNum('address_size')}pt;margin-bottom:4px;text-decoration:underline;">Terms & Conditions:</div>
        <div style="font-size:${this.getNum('terms_size')}pt;color:#444;line-height:1.5;">
          ${this.getBool('terms_numbering') ? 
            `<ol style="margin:0;padding-left:16px;">${this.getStr('terms_text').split('\n').filter(t=>t.trim()).map(t=>`<li>${t}</li>`).join('')}</ol>` : 
            `<div style="white-space:pre-wrap;">${this.getStr('terms_text')}</div>`
          }
        </div>
      </div>
    </div>

    <!-- CUSTOM BOTTOM AREA -->
    ${bottomHtml ? `<div style="border-top:1.8px solid ${acc};">${bottomHtml}</div>` : ''}
  </div>

  <div style="background:${acc};color:#fff;text-align:center;padding:4px;font-size:8pt;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
    Thank You For Shopping With Us!
  </div>

</div>`;
    requestAnimationFrame(() => {
      if (targetId === 'bill-preview-a4') {
        this.scalePreview();
        this.checkOverflow();
      }
    });
  },

  checkOverflow() {
    const el = document.getElementById('bill-preview-a4');
    const warn = document.getElementById('bill-overflow-warning');
    const inner = document.getElementById('bill-inner-container');
    if (!el || !warn || !inner) return;

    const pageSize = this.getStr('page_size');
    const dims = { 'a4': 1123, 'a5': 794, 'letter': 1056, 'thermal': 1200 };
    const maxH = dims[pageSize] || 1123;

    // Check if inner container height exceeds the nominal page height
    if (inner.offsetHeight > (maxH - (this.getNum('margin') * 3.779 * 2)) + 2) {
      warn.style.display = 'flex';
      el.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.3)';
    } else {
      warn.style.display = 'none';
      el.style.boxShadow = '0 8px 40px rgba(0,0,0,.35)';
    }
  },

  scalePreview() {
    const wrap = document.getElementById('bill-preview-wrap');
    const el   = document.getElementById('bill-preview-a4');
    if (!wrap || !el) return;
    
    // Increased scale for better visibility on larger screens
    const scale = Math.min(1.2, (wrap.clientWidth - 40) / el.offsetWidth); 
    el.style.transform = `scale(${scale})`;
    el.style.transformOrigin = 'top center';
    el.style.marginBottom = `-${el.offsetHeight * (1 - scale)}px`;
  },

  bindControls() {
    const keys = ['accent-color','shop-name-size','shop-name-bold','shop-name-color',
      'address-size','logo-size','table-header-bg','table-header-color','row-size',
      'row-height','total-color','discount-color','gst-title','font','margin',
      'title-size','terms-text','terms-size','qr-size','bottom-text','bottom-text-size',
      'bottom-text-align','bottom-layout','page-size'];
    keys.forEach(id => {
      const el = document.getElementById('bdf-' + id);
      if (!el) return;
      el.addEventListener('input', () => {
        this.fmt[id.replace(/-/g, '_')] = el.value;
        const disp = document.getElementById('bdf-' + id + '-val');
        if (disp && el.type === 'range') disp.textContent = el.value + (id.includes('size')||id==='margin'||id==='row-height'||id==='qr-size' ? 'pt' : '');
        this.render();
      });
    });
    ['show-words','show-bank','show-logo','show-qr','bottom-text-bold','terms-numbering'].forEach(id => {
      const el = document.getElementById('bdf-' + id);
      if (el) el.addEventListener('change', () => { this.fmt[id.replace(/-/g,'_')] = String(el.checked); this.render(); });
    });
    this.syncControlsFromFmt();
  },

  syncControlsFromFmt() {
    const set = (id, val) => {
      const el = document.getElementById('bdf-' + id);
      if (el) el.value = val;
      const disp = document.getElementById('bdf-' + id + '-val');
      if (disp && el && el.type === 'range') disp.textContent = val + (id.includes('size')||id==='margin'||id==='row-height'||id==='qr-size' ? 'pt' : '');
    };
    const setChk = (id, val) => { const el = document.getElementById('bdf-'+id); if (el) el.checked = (val==='true'||val===true); };
    const f = this.fmt;
    set('accent-color', f.accent_color); set('shop-name-size', f.shop_name_size);
    set('shop-name-bold', f.shop_name_bold); set('shop-name-color', f.shop_name_color);
    set('address-size', f.address_size); set('logo-size', f.logo_size);
    set('table-header-bg', f.table_header_bg); set('table-header-color', f.table_header_color);
    set('row-size', f.row_size); set('row-height', f.row_height);
    set('total-color', f.total_color); set('discount-color', f.discount_color);
    set('gst-title', f.gst_title); set('font', f.font);
    set('qr-size', f.qr_size); set('bottom-text', f.bottom_text); set('terms-size', f.terms_size);
    set('bottom-text-size', f.bottom_text_size); set('bottom-text-align', f.bottom_text_align);
    set('bottom-layout', f.bottom_layout);
    set('page-size', f.page_size);
    setChk('show-words', f.show_words); setChk('show-bank', f.show_bank);
    setChk('show-logo', f.show_logo); setChk('show-qr', f.show_qr);
    setChk('bottom-text-bold', f.bottom_text_bold); setChk('terms-numbering', f.terms_numbering);

    // Sync Images List
    const list = document.getElementById('bdf-images-list');
    if (list) {
      const images = this.getImages();
      list.innerHTML = images.length === 0 ? '<div style="color:var(--text3);font-size:.8rem;text-align:center;padding:10px;border:1.5px dashed var(--border);border-radius:10px;">No images added yet</div>' : '';
      images.forEach((img, i) => {
        const card = document.createElement('div');
        card.className = 'bdf-img-card';
        card.style = 'background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:10px;border:1px solid var(--border);';
        card.innerHTML = `
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
            <img src="${img.src}" style="width:40px;height:40px;object-fit:contain;border-radius:4px;background:#fff;border:1px solid var(--border);"/>
            <div style="flex:1;font-size:.75rem;font-weight:600;color:var(--text3);">Image #${i+1}</div>
            <button onclick="BillDesigner.removeBottomImage(${i})" class="btn btn-danger btn-sm" style="padding:2px 6px;"><i class="ri-delete-bin-line"></i></button>
          </div>
          <div class="bdf-row">
            <div class="bdf-label" style="font-size:.7rem;">Width <span class="bdf-val" id="bdf-btimg-w-lbl-${i}">${img.width}px</span></div>
            <input type="range" class="bdf-range" min="40" max="550" step="10" value="${img.width}" oninput="BillDesigner.updateBottomImage(${i}, 'width', parseInt(this.value))"/>
          </div>
          <div class="bdf-row">
            <select class="bdf-select" style="font-size:.75rem;height:28px;" onchange="BillDesigner.updateBottomImage(${i}, 'align', this.value)">
              <option value="left" ${img.align==='left'?'selected':''}>⬅ Left</option>
              <option value="center" ${img.align==='center'?'selected':''}>⬛ Center</option>
              <option value="right" ${img.align==='right'?'selected':''}>➡ Right</option>
            </select>
          </div>
        `;
        list.appendChild(card);
      });
    }
  }
};

window.addEventListener('resize', () => {
  const m = document.getElementById('bill-designer-modal');
  if (m && m.style.display !== 'none') BillDesigner.scalePreview();
});
