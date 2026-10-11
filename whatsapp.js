// ===== WHATSAPP BROADCAST CENTER (ULTRA V5 - MULTI-MODE ENGINE) =====
const WhatsApp = {
  contacts: [],
  queue: [],
  currentIndex: -1,
  isProcessing: false,
  isPaused: false,
  selectedImageFile: null,

  init() {
    const tmpl = document.getElementById('wa-template');
    if (tmpl && !tmpl.value.trim()) {
      tmpl.value = 'Hi {{name}}! 👋\n\nGreetings from *{{shop}}*! 🎆\n\nCheck out our new arrivals today! ⚡\n\nBest regards,\n{{shop}}';
    }
    this.loadFromCustomers(true);
    this.loadApiSettings();
    this.updatePreview();
    this.onModeChange();
  },

  loadApiSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('shopapp_wa_api') || '{}');
      const instInput = document.getElementById('wa-api-instance');
      const tokInput = document.getElementById('wa-api-token');
      if (instInput && saved.instance) instInput.value = saved.instance;
      if (tokInput && saved.token) tokInput.value = saved.token;
      if (saved.instance && saved.token) {
        this.checkApiStatus(true);
      }
    } catch (e) {
      console.warn('Failed to load WA API settings', e);
    }
  },

  saveApiSettings() {
    const instance = (document.getElementById('wa-api-instance')?.value || '').trim();
    const token = (document.getElementById('wa-api-token')?.value || '').trim();

    if (!instance || !token) {
      Notify.warning('Please enter both Instance ID and API Token');
      return;
    }

    localStorage.setItem('shopapp_wa_api', JSON.stringify({ instance, token }));
    Notify.success('WhatsApp API credentials saved!');
    document.getElementById('wa-api-modal')?.classList.remove('open');
    this.checkApiStatus();
  },

  async checkApiStatus(silent = false) {
    const saved = JSON.parse(localStorage.getItem('shopapp_wa_api') || '{}');
    const icon = document.getElementById('wa-api-status-icon');
    const text = document.getElementById('wa-api-status-text');

    if (!saved.instance || !saved.token) {
      if (icon) icon.style.background = 'var(--text3)';
      if (text) text.textContent = 'Credentials not configured';
      return;
    }

    if (text) text.textContent = 'Verifying connection...';

    try {
      const res = await fetch(`https://api.green-api.com/waInstance${saved.instance}/getStateInstance/${saved.token}`);
      const data = await res.json();
      if (data.stateInstance === 'authorized') {
        if (icon) icon.style.background = '#25D366';
        if (text) text.textContent = '✅ Connected (Authorized)';
        if (!silent) Notify.success('Green-API connection verified successfully!');
      } else {
        if (icon) icon.style.background = '#ef4444';
        if (text) text.textContent = `⚠️ Status: ${data.stateInstance || 'Not Authorized'}`;
        if (!silent) Notify.warning(`Status: ${data.stateInstance || 'Please scan QR code on Green-API'}`);
      }
    } catch (err) {
      if (icon) icon.style.background = '#ef4444';
      if (text) text.textContent = '❌ Connection failed';
      if (!silent) Notify.error('Failed to connect to Green-API endpoint');
    }
  },

  onModeChange() {
    const mode = document.getElementById('wa-send-mode')?.value || 'export';
    const hint = document.getElementById('wa-mode-hint');
    const startBtn = document.getElementById('btn-wa-start');

    if (mode === 'api') {
      if (hint) hint.innerHTML = '⚡ <b>Ultra Pro (API):</b> Direct background sending via Green-API without opening WhatsApp Web.';
      if (startBtn) startBtn.innerHTML = '<i class="ri-play-fill"></i> Launch API Broadcast';
    } else if (mode === 'export') {
      if (hint) hint.innerHTML = '📥 <b>1-Click Excel:</b> Download all contacts & customized messages for Chrome Bulk Sender extensions (Safest for 2000+ numbers).';
      if (startBtn) startBtn.innerHTML = '<i class="ri-download-2-line"></i> Download Bulk Excel';
    } else if (mode === 'magic') {
      if (hint) hint.innerHTML = '🚀 <b>Free Console Script:</b> Copy script and paste into web.whatsapp.com Developer Console (F12).';
      if (startBtn) startBtn.innerHTML = '<i class="ri-magic-line"></i> Generate Console Script';
    } else {
      if (hint) hint.innerHTML = '🕒 <b>Manual Click-to-Chat:</b> Opens wa.me links directly for each customer.';
      if (startBtn) startBtn.innerHTML = '<i class="ri-send-plane-line"></i> Start Manual Send';
    }
  },

  loadFromCustomers(silent = false) {
    const customers = DB.get('customers').filter(c => c.phone);
    this.contacts = customers.map(c => {
      let raw = String(c.phone || '').replace(/\D/g, '');
      if (raw.length === 11 && raw.startsWith('0')) raw = raw.substring(1);
      if (raw.length === 10) raw = '91' + raw;
      return {
        name: c.name || 'Dear Customer',
        phone: raw,
        udhar: parseFloat(c.udhar) || 0
      };
    }).filter(c => c.phone.length >= 10);

    this.filterList('all');
    if (!silent) Notify.info(`Loaded ${this.contacts.length} customers with valid phone numbers`);
  },

  processExcel(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
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
          if (phone.length === 11 && phone.startsWith('0')) phone = phone.substring(1);
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
      } catch (err) {
        Notify.error('Error reading Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  },

  openPasteModal() {
    const modal = document.getElementById('paste-numbers-modal');
    const area = document.getElementById('paste-numbers-area');
    const btn = document.getElementById('paste-confirm-btn');
    if (!modal) return;
    if (area) area.value = '';
    modal.classList.add('open');
    if (btn) {
      btn.onclick = () => {
        this.pasteNumbers(area.value);
        modal.classList.remove('open');
      };
    }
  },

  pasteNumbers(text) {
    if (!text.trim()) return;
    const lines = text.split(/[\n,;]+/);
    const newContacts = [];
    const seen = new Set(this.contacts.map(c => c.phone));

    lines.forEach(line => {
      let phone = line.replace(/\D/g, '');
      if (phone.length === 11 && phone.startsWith('0')) phone = phone.substring(1);
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
    this.selectedImageFile = file;
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
    this.selectedImageFile = null;
    const inp = document.getElementById('wa-img-input');
    if (inp) inp.value = '';
    document.getElementById('wa-img-preview-box').style.display = 'none';
    document.getElementById('wa-img-placeholder').style.display = 'block';
  },

  renderContacts(list = this.contacts) {
    const el = document.getElementById('wa-contacts-list');
    if (!el) return;
    el.innerHTML = list.map((c) => `
      <div class="wa-contact-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border)">
        <input type="checkbox" class="wa-contact-check" data-phone="${c.phone}" style="accent-color:#25D366;width:18px;height:18px" checked onchange="WhatsApp.updateSelectedCount()"/>
        <div style="flex:1">
          <div class="fw-600" style="font-size:.85rem">${Utils.escapeHtml(c.name)}</div>
          <div style="font-size:.7rem;color:var(--text3)">+${c.phone} ${c.udhar > 0 ? `• ₹${c.udhar} Due` : ''}</div>
        </div>
      </div>
    `).join('') || '<div class="empty-state" style="padding:24px">No contacts found</div>';
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
    const el = document.getElementById('wa-selected-count');
    if (el) el.textContent = `${c} selected`;
  },

  insertVar(v) {
    const a = document.getElementById('wa-template');
    if (!a) return;
    const s = a.selectionStart;
    a.value = a.value.substring(0, s) + v + a.value.substring(a.selectionEnd);
    a.focus();
    a.selectionStart = a.selectionEnd = s + v.length;
    this.updatePreview();
  },

  compileMessage(template, contact) {
    const session = JSON.parse(localStorage.getItem('shopapp_session') || '{}');
    const bdesigner = JSON.parse(localStorage.getItem('shopapp_bill_design') || '{}');
    const shop = session.shop || bdesigner.shop_name || 'Aditya Enterprises';
    return template
      .replace(/{{name}}/gi, contact.name || 'Customer')
      .replace(/{{shop}}/gi, shop)
      .replace(/{{udhar}}/gi, `₹${contact.udhar || 0}`)
      .replace(/{{date}}/gi, new Date().toLocaleDateString('en-IN'));
  },

  updatePreview() {
    const tmpl = document.getElementById('wa-template')?.value || '';
    const sample = this.contacts[0] || { name: 'Customer', udhar: 0 };
    const text = this.compileMessage(tmpl, sample);
    const prevEl = document.getElementById('wa-preview');
    if (prevEl) prevEl.innerHTML = Utils.escapeHtml(text).replace(/\n/g, '<br>');
  },

  // ---- 1-CLICK EXPORT FOR BULK WHATSAPP SENDER EXTENSIONS ----
  exportBroadcastList() {
    const checked = document.querySelectorAll('.wa-contact-check:checked');
    const tmpl = document.getElementById('wa-template')?.value || '';

    const targets = [];
    if (checked.length > 0) {
      checked.forEach(n => {
        const phone = n.getAttribute('data-phone');
        const c = this.contacts.find(con => con.phone === phone);
        if (c) targets.push(c);
      });
    } else {
      targets.push(...this.contacts);
    }

    if (!targets.length) {
      Notify.warning('No contacts available to export');
      return;
    }

    const rows = targets.map((c, idx) => ({
      'S.No': idx + 1,
      'Phone': c.phone,
      'Name': c.name,
      'Message': this.compileMessage(tmpl, c),
      'Pending_Udhar': c.udhar || 0
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bulk_WhatsApp');
    const filename = `Bulk_WhatsApp_${targets.length}_Contacts.xlsx`;
    XLSX.writeFile(wb, filename);

    Notify.success(`Downloaded ${targets.length} contacts formatted for WA Sender!`);
  },

  // ---- BROADCAST DISPATCHER ENTRY POINT ----
  startBroadcast() {
    const mode = document.getElementById('wa-send-mode')?.value || 'export';

    const checked = document.querySelectorAll('.wa-contact-check:checked');
    if (!checked.length) return Notify.warning('Please select at least 1 contact');

    this.queue = [];
    checked.forEach(n => {
      const c = this.contacts.find(con => con.phone === n.getAttribute('data-phone'));
      if (c) this.queue.push(c);
    });

    if (mode === 'export') {
      this.exportBroadcastList();
      return;
    }

    if (mode === 'magic') {
      const modal = document.getElementById('wa-magic-modal');
      const disp = document.getElementById('wa-magic-code-display');
      if (disp) disp.textContent = this.generateMagicScript();
      if (modal) modal.classList.add('open');
      Notify.info('Console Automation Script Generated!');
      return;
    }

    if (mode === 'api') {
      this.startApiBroadcast();
      return;
    }

    if (mode === 'manual') {
      this.startManualBroadcast();
      return;
    }
  },

  // ---- API BROADCAST ENGINE (GREEN-API) ----
  async startApiBroadcast() {
    const saved = JSON.parse(localStorage.getItem('shopapp_wa_api') || '{}');
    if (!saved.instance || !saved.token) {
      document.getElementById('wa-api-modal')?.classList.add('open');
      Notify.warning('Please enter Green-API Instance ID & Token first!');
      return;
    }

    if (this.isProcessing && this.isPaused) {
      this.isPaused = false;
      this.updateBroadcastUI(true);
      this.processApiQueue();
      return;
    }

    if (this.isProcessing) return;

    this.isProcessing = true;
    this.isPaused = false;
    this.currentIndex = 0;
    this.updateBroadcastUI(true);

    Notify.info(`Starting broadcast to ${this.queue.length} contacts...`);
    this.processApiQueue();
  },

  async processApiQueue() {
    const saved = JSON.parse(localStorage.getItem('shopapp_wa_api') || '{}');
    const tmpl = document.getElementById('wa-template')?.value || '';
    const total = this.queue.length;

    while (this.currentIndex < total) {
      if (this.isPaused || !this.isProcessing) {
        break;
      }

      const c = this.queue[this.currentIndex];
      const msg = this.compileMessage(tmpl, c);
      const chatId = `${c.phone}@c.us`;

      this.updateProgress(this.currentIndex + 1, total, `Sending to ${c.name} (+${c.phone})...`);

      try {
        if (this.selectedImageFile) {
          const fd = new FormData();
          fd.append('chatId', chatId);
          fd.append('file', this.selectedImageFile);
          fd.append('caption', msg);

          await fetch(`https://api.green-api.com/waInstance${saved.instance}/sendFileByUpload/${saved.token}`, {
            method: 'POST',
            body: fd
          });
        } else {
          await fetch(`https://api.green-api.com/waInstance${saved.instance}/sendMessage/${saved.token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, message: msg })
          });
        }
      } catch (err) {
        console.warn(`Failed to send to ${c.phone}:`, err);
      }

      this.currentIndex++;

      // Safe delay between messages (2 seconds)
      await new Promise(r => setTimeout(r, 2000));
    }

    if (this.currentIndex >= total) {
      this.isProcessing = false;
      this.isPaused = false;
      this.updateBroadcastUI(false);
      this.updateProgress(total, total, 'Completed all messages!');
      Notify.success(`🎉 Campaign finished! Sent to ${total} contacts.`);
    }
  },

  pauseBroadcast() {
    if (!this.isProcessing) return;
    this.isPaused = true;
    const btnPause = document.getElementById('btn-wa-pause');
    const btnStart = document.getElementById('btn-wa-start');
    if (btnPause) btnPause.style.display = 'none';
    if (btnStart) {
      btnStart.style.display = 'block';
      btnStart.innerHTML = '<i class="ri-play-fill"></i> Resume Broadcast';
    }
    const statusText = document.getElementById('wa-status-text');
    if (statusText) statusText.textContent = `Paused at ${this.currentIndex} / ${this.queue.length}`;
    Notify.info('Broadcast paused');
  },

  resetBroadcast() {
    this.isProcessing = false;
    this.isPaused = false;
    this.currentIndex = -1;
    this.queue = [];
    this.updateBroadcastUI(false);
    const statBox = document.getElementById('wa-broadcast-status');
    if (statBox) statBox.style.display = 'none';
    Notify.info('Broadcast reset');
  },

  updateBroadcastUI(active) {
    const statBox = document.getElementById('wa-broadcast-status');
    const btnStart = document.getElementById('btn-wa-start');
    const btnPause = document.getElementById('btn-wa-pause');

    if (statBox) statBox.style.display = active ? 'block' : 'none';
    if (btnPause) btnPause.style.display = active ? 'block' : 'none';
    if (btnStart) {
      if (active) {
        btnStart.style.display = 'none';
      } else {
        btnStart.style.display = 'block';
        this.onModeChange();
      }
    }
  },

  updateProgress(current, total, text) {
    const pct = Math.round((current / total) * 100);
    const fill = document.getElementById('wa-progress-fill');
    const countEl = document.getElementById('wa-count-text');
    const statusEl = document.getElementById('wa-status-text');

    if (fill) fill.style.width = `${pct}%`;
    if (countEl) countEl.textContent = `${current} / ${total} (${pct}%)`;
    if (statusEl && text) statusEl.textContent = text;
  },

  // ---- MANUAL CLICK-TO-CHAT BROADCAST ----
  startManualBroadcast() {
    if (!this.queue.length) return;
    const tmpl = document.getElementById('wa-template')?.value || '';
    let idx = 0;

    const openNext = () => {
      if (idx >= this.queue.length) {
        Notify.success('Manual queue finished!');
        return;
      }
      const c = this.queue[idx];
      const msg = this.compileMessage(tmpl, c);
      window.open(`https://wa.me/${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');
      idx++;
      if (idx < this.queue.length) {
        setTimeout(() => {
          if (confirm(`Message ${idx} opened. Click OK to open next contact (${this.queue[idx].name})`)) {
            openNext();
          }
        }, 1000);
      }
    };

    openNext();
  },

  // ---- THE MAGIC BROADCAST SCRIPT GENERATOR ----
  generateMagicScript() {
    const session = JSON.parse(localStorage.getItem('shopapp_session') || '{}');
    const bdesigner = JSON.parse(localStorage.getItem('shopapp_bill_design') || '{}');
    const shop = session.shop || bdesigner.shop_name || 'Aditya Enterprises';
    const tmpl = document.getElementById('wa-template')?.value || '';

    const contactsData = this.queue.map(c => ({
      name: c.name,
      phone: c.phone,
      udhar: c.udhar
    }));

    return `
/** 🛡️ ADITYA ENTERPRISES ULTRA-RELIABLE BRIDGE **/
(async function() {
  const contacts = ${JSON.stringify(contactsData)};
  const rawTemplate = ${JSON.stringify(tmpl)};
  const shopName = "${shop}";

  console.clear();
  console.log("%c 🚦 AUTOMATION STARTED: " + contacts.length + " Contacts ", "background:#25D366;color:#fff;padding:12px;font-size:1.2rem;font-weight:bold");

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let searchEl = null;
  let messageEl = null;

  const setContentEditableText = (el, text) => {
    if (!el) return;
    el.focus();
    try {
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
    } catch (e) {
      try { document.execCommand('selectAll', false, null); document.execCommand('delete', false, null); document.execCommand('insertText', false, text); } catch (e) {}
    }
  };

  const findFirstResult = () => {
    const side = document.querySelector('#pane-side') || document.querySelector('[role="region"]');
    if (!side) return null;
    const candidates = side.querySelectorAll('div[role="row"], div[role="listitem"], div[role="option"]');
    return candidates.length ? candidates[0] : null;
  };

  alert("STEP 1: Click the WhatsApp SEARCH BOX once.");
  await new Promise(resolve => {
    const finder = (e) => {
      searchEl = e.target.closest('[contenteditable="true"]') || e.target;
      document.removeEventListener('click', finder, true);
      try { searchEl.style.border = "4px solid #25D366"; } catch (e) {}
      console.log("✅ Search Box Identified!");
      resolve();
    };
    document.addEventListener('click', finder, true);
  });

  alert("STEP 2: Click the MESSAGE BOX (where you type messages).");
  await new Promise(resolve => {
    const finder = (e) => {
      messageEl = e.target.closest('[contenteditable="true"]') || e.target;
      document.removeEventListener('click', finder, true);
      try { messageEl.style.border = "4px solid #F59E0B"; } catch (e) {}
      console.log("✅ Message Box Identified!");
      resolve();
    };
    document.addEventListener('click', finder, true);
  });

  alert("READY! Starting " + contacts.length + " messages. Do not close tab.");

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    const msg = rawTemplate.replace(/{{name}}/gi, c.name).replace(/{{shop}}/gi, shopName).replace(/{{udhar}}/gi, c.udhar).replace(/{{date}}/gi, new Date().toLocaleDateString('en-IN'));
    console.log("%c [" + (i+1) + "/" + contacts.length + "] Sending to: " + c.name + " (" + c.phone + ")", "color:#25D366;font-weight:bold");

    try {
      setContentEditableText(searchEl, c.phone);

      let firstResult = null;
      for (let t = 0; t < 16; t++) {
        await sleep(500);
        firstResult = findFirstResult();
        if (firstResult) break;
      }

      if (!firstResult) { console.log("⚠️ Number not found, skipping."); continue; }
      firstResult.click();
      await sleep(1500);

      setContentEditableText(messageEl, msg);
      await sleep(700);

      const sendBtn = document.querySelector('button[data-testid="compose-btn-send"]') || document.querySelector('span[data-icon="send"]') || document.querySelector('button[aria-label="Send"]');
      if (sendBtn) sendBtn.click();
      else {
        messageEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      }
    } catch(err) {
      console.log("❌ Error:", err);
    }

    // Safe delay with jitter (8 to 12s)
    const delay = Math.floor(Math.random() * 4000) + 8000;
    await sleep(delay);
  }
  alert("🎉 Campaign Finished!");
})();`.trim();
  },

  copyMagicCode() {
    const text = document.getElementById('wa-magic-code-display')?.textContent || '';
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => Notify.success('Magic Code Copied!'));
  }
};
