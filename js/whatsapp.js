// ===== WHATSAPP MAGIC BRIDGE (IDENTIFIER VERSION) =====
const WhatsApp = {
  contacts: [],
  queue: [],
  currentIndex: -1,
  isProcessing: false,

  init() {
    const tmpl = document.getElementById('wa-template');
    if (tmpl) tmpl.value = 'Hi {{name}}! 👋\n\nGreetings from *{{shop}}*! 🎆\n\nCheck out our new arrivals today! ⚡\n\nBest regards,\n{{shop}}';
    this.loadFromCustomers(true);
    this.updatePreview();
  },

  processExcel(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const newContacts = [];
      const seen = new Set(this.contacts.map(c => c.phone));

      rows.forEach(row => {
        const phoneKey = Object.keys(row).find(k => /phone|mobile|number|contact|tel|whatsapp/i.test(k));
        const nameKey = Object.keys(row).find(k => /name|customer|client|party/i.test(k));
        
        let phone = String(row[phoneKey] || '').replace(/\D/g, '');
        if (phone.length < 10) return;
        if (phone.length === 10) phone = '91' + phone;

        if (seen.has(phone)) return; 
        seen.add(phone);

        newContacts.push({
          name: row[nameKey] || 'Dear Customer',
          phone: phone,
          udhar: 0
        });
      });

      this.contacts = [...this.contacts, ...newContacts];
      this.renderContacts();
      Notify.success(`Imported ${newContacts.length} unique contacts from Excel!`);
    };
    reader.readAsArrayBuffer(file);
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
    const newContacts = [];
    const seen = new Set(this.contacts.map(c => c.phone));
    
    lines.forEach(line => {
      let phone = line.replace(/\D/g, '');
      if (phone.length < 10) return;
      if (phone.length === 10) phone = '91' + phone;
      
      if (!seen.has(phone)) {
        newContacts.push({
          name: 'Dear Customer',
          phone: phone,
          udhar: 0
        });
        seen.add(phone);
      }
    });

    this.contacts = [...this.contacts, ...newContacts];
    this.renderContacts();
    Notify.success(`${newContacts.length} numbers added to broadcast list!`);
  },

  handleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('wa-img-preview').src = e.target.result;
      document.getElementById('wa-img-preview-box').style.display = 'block';
      document.getElementById('wa-img-placeholder').style.display = 'none';
      this.updatePreview();
    };
    reader.readAsDataURL(file);
  },

  clearImage() {
    document.getElementById('wa-img-input').value = '';
    document.getElementById('wa-img-preview-box').style.display = 'none';
    document.getElementById('wa-img-placeholder').style.display = 'block';
  },

  loadFromCustomers(silent = false) {
    const customers = DB.get('customers').filter(c => c.phone);
    this.contacts = customers.map(c => ({ 
      name: c.name, 
      phone: c.phone.replace(/\D/g, ''),
      udhar: parseFloat(c.udhar) || 0
    })).filter(c => c.phone.length >= 10);
    this.filterList('all');
  },

  renderContacts(list = this.contacts) {
    const el = document.getElementById('wa-contacts-list');
    if (!el) return;
    el.innerHTML = list.map((c, i) => `
      <div class="wa-contact-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border)">
        <input type="checkbox" class="wa-contact-check" data-phone="${c.phone}" style="accent-color:#25D366;width:18px;height:18px" checked onchange="WhatsApp.updateSelectedCount()"/>
        <div style="flex:1">
          <div class="fw-600" style="font-size:.85rem">${Utils.escapeHtml(c.name)}</div>
          <div style="font-size:.7rem;color:var(--text3)">+${c.phone} ${c.udhar>0?`• ₹${c.udhar} Due`:''}</div>
        </div>
      </div>
    `).join('') || '<div class="empty-state" style="padding:24px">No contacts</div>';
    this.updateSelectedCount();
  },

  filterList(t) {
    let f = this.contacts;
    if (t === 'due') f = f.filter(c => c.udhar > 0);
    this.renderContacts(f);
    this.toggleAll(true);
  },

  toggleAll(c) {
    document.querySelectorAll('.wa-contact-check').forEach(i => i.checked = c);
    this.updateSelectedCount();
  },

  updateSelectedCount() {
    const c = document.querySelectorAll('.wa-contact-check:checked').length;
    document.getElementById('wa-selected-count').textContent = `${c} selected`;
  },

  insertVar(v) {
    const a = document.getElementById('wa-template');
    const s = a.selectionStart;
    a.value = a.value.substring(0, s) + v + a.value.substring(a.selectionEnd);
    a.focus();
    a.selectionStart = a.selectionEnd = s + v.length;
    this.updatePreview();
  },

  updatePreview() {
    const tmpl = document.getElementById('wa-template').value;
    const session = JSON.parse(localStorage.getItem('shopapp_session') || '{}');
    const bdesigner = JSON.parse(localStorage.getItem('shopapp_bill_design') || '{}');
    const shop = session.shop || bdesigner.shop_name || 'ElectroShop';
    
    const sample = this.contacts[0] || { name: 'Customer', udhar: 0 };
    let t = tmpl.replace(/{{name}}/gi, `*${sample.name}*`).replace(/{{udhar}}/gi, `*₹${sample.udhar}*`).replace(/{{shop}}/gi, `*${shop}*`).replace(/{{date}}/gi, `*${new Date().toLocaleDateString()}*`);
    document.getElementById('wa-preview').innerHTML = t.replace(/\n/g, '<br>');
  },

  // ---- THE MAGIC BROADCAST ENGINE (CLICK-IDENTIFIER VERSION) ----

  startBroadcast() {
    if (this.isProcessing) return;
    const checked = document.querySelectorAll('.wa-contact-check:checked');
    if (!checked.length) return Notify.warning('Select contacts first');

    this.queue = [];
    checked.forEach(n => {
      const c = this.contacts.find(con => con.phone === n.getAttribute('data-phone'));
      if (c) this.queue.push(c);
    });

    document.getElementById('wa-magic-code-display').textContent = this.generateMagicScript();
    document.getElementById('wa-magic-modal').classList.add('open');
    Notify.info('New Smart Identifying Code Generated!');
  },

  generateMagicScript() {
    const session = JSON.parse(localStorage.getItem('shopapp_session') || '{}');
    const bdesigner = JSON.parse(localStorage.getItem('shopapp_bill_design') || '{}');
    const shop = session.shop || bdesigner.shop_name || 'ElectroShop';
    const tmpl = document.getElementById('wa-template').value;
    
    const contactsData = this.queue.map(c => ({
      name: c.name,
      phone: c.phone,
      udhar: c.udhar
    }));

    return `
/** 🛡️ ELECTRO-SHOP ULTRA-RELIABLE BRIDGE (V4) **/
(async function() {
  const contacts = ${JSON.stringify(contactsData)};
  const rawTemplate = ${JSON.stringify(tmpl)};
  const shopName = "${shop}";

  console.clear();
  console.log("%c 🚦 AUTOMATION STARTED: " + contacts.length + " Contacts ", "background:#25D366;color:#fff;padding:12px;font-size:1.2rem;font-weight:bold");

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let searchEl = null;
  let messageEl = null;

  // --- STEP 1: IDENTIFY SEARCH BAR ---
  alert("RASTA DIKHAYEIN (1/2):\\nAbhi aap ok daba kar WhatsApp ke [SEARCH BOX] par ek baar click karke use pehchan karaiye.");
  
  await new Promise(resolve => {
    const finder = (e) => {
        searchEl = e.target.closest('div[contenteditable="true"]') || e.target;
        document.removeEventListener('click', finder, true);
        searchEl.style.border = "6px solid #25D366";
        console.log("✅ Search Box Identified!");
        resolve();
    };
    document.addEventListener('click', finder, true);
  });

  // --- STEP 2: IDENTIFY MESSAGE BOX ---
  alert("SHABASH! Ab (2/2):\\nJahan MASSAGE LIKHTE HAIN (Message Box), wahan ek baar click karein.");

  await new Promise(resolve => {
    const finder = (e) => {
        messageEl = e.target.closest('div[contenteditable="true"]') || e.target;
        document.removeEventListener('click', finder, true);
        messageEl.style.border = "6px solid #F59E0B";
        console.log("✅ Message Box Identified!");
        resolve();
    };
    document.addEventListener('click', finder, true);
  });

  alert("DONE! Ab script apne aap " + contacts.length + " messages bhej degi. Tab band mat karna.");

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    const msg = rawTemplate.replace(/{{name}}/gi, c.name).replace(/{{shop}}/gi, shopName).replace(/{{udhar}}/gi, c.udhar).replace(/{{date}}/gi, new Date().toLocaleDateString());
    
    console.log("%c [" + (i+1) + "/" + contacts.length + "] Target: " + c.name, "color:#25D366;font-weight:bold");

    try {
      // 1. Search contact
      searchEl.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, c.phone);
      await sleep(4000);

      // 2. Click contact (Fuzzy listitem)
      const firstResult = document.querySelector('div[role="listitem"]') || document.querySelector('div._ak72') || document.querySelector('div._ak73');
      if (!firstResult) { console.log("⚠️ Number skipped."); continue; }
      firstResult.click();
      await sleep(3000);

      // 3. Send message
      messageEl.focus();
      document.execCommand('insertText', false, msg);
      await sleep(2000);
      
      const sendBtn = document.querySelector('button[data-testid="compose-btn-send"]') || document.querySelector('span[data-icon="send"]') || document.querySelector('button[aria-label="Send"]');
      if (sendBtn) sendBtn.click();
      else {
        const ke = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
        messageEl.dispatchEvent(ke);
      }
    } catch(err) { console.log("❌ Error: " + err.message); }

    await sleep(12000);
  }
  alert("🎉 Campaign Finished!");
})();`.trim();
  },

  copyMagicCode() {
    document.getElementById('wa-magic-code-display').textContent = this.generateMagicScript();
    const text = document.getElementById('wa-magic-code-display').textContent;
    navigator.clipboard.writeText(text).then(() => Notify.success('Magic Code Copied!'));
  }
};
