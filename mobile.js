// ===== MOBILE APP LOGIC =====
const session = JSON.parse(localStorage.getItem('shopapp_session') || 'null');
if (!session) { window.location.href = 'index.html'; }

const Mobile = {
  init() {
    // Theme
    const theme = localStorage.getItem('shopapp_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-icon').className = theme === 'dark' ? 'ri-moon-line' : 'ri-sun-line';

    // Greeting
    document.getElementById('home-greeting').textContent = `Hello, ${session.name.split(' ')[0]}!`;

    // Seed DB if empty
    DB.seed();

    this.go('home');
  },

  go(tab) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Show target
    document.getElementById('page-' + tab).classList.add('active');
    document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');

    // Init Logic
    if (tab === 'home') this.renderHome();
    if (tab === 'bill') MobileBilling.init();
    if (tab === 'stock') MobileStock.render();
    if (tab === 'dues') MobileDues.render();
    
    window.scrollTo(0,0);
  },

  renderHome() {
    const bills = DB.get('bills');
    const customers = DB.get('customers');
    
    // Today's Sales
    const today = new Date().toISOString().split('T')[0];
    const todaySales = bills.filter(b => b.createdAt.startsWith(today)).reduce((s,b) => s + b.total, 0);
    document.getElementById('m-kpi-sales').textContent = Utils.formatCurrency(todaySales);

    // Pending Dues
    const totalDues = customers.reduce((s,c) => s + (parseFloat(c.udhar) || 0), 0);
    document.getElementById('m-kpi-dues').textContent = Utils.formatCurrency(totalDues);

    // Recent Bills
    const recent = [...bills].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    const html = recent.map(b => `
      <div class="m-list-item">
        <div>
          <div class="title">${Utils.escapeHtml(b.customerName || 'Walk-in Customer')}</div>
          <div class="sub">${new Date(b.createdAt).toLocaleDateString()} • ${b.items?.length || 0} items</div>
        </div>
        <div class="price">${Utils.formatCurrency(b.total)}</div>
      </div>
    `).join('') || '<div style="color:var(--text2);text-align:center;padding:15px;">No recent bills</div>';
    
    document.getElementById('m-recent-bills').innerHTML = html;
  },

  toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('shopapp_theme', next);
    document.getElementById('theme-icon').className = next === 'dark' ? 'ri-moon-line' : 'ri-sun-line';
  },

  logout() {
    if(confirm('Logout from Mobile App?')) {
      localStorage.removeItem('shopapp_session');
      window.location.href = 'index.html';
    }
  }
};

// ===== MOBILE BILLING =====
const MobileBilling = {
  cart: [],
  
  init() {
    this.cart = [];
    document.getElementById('m-bill-cust').value = '';
    this.renderCart();
  },

  showItemModal() {
    document.getElementById('m-item-modal').classList.add('open');
    this.renderProducts();
  },

  renderProducts() {
    const q = document.getElementById('m-prod-search').value.toLowerCase();
    const products = DB.get('products').filter(p => p.name.toLowerCase().includes(q));
    
    const html = products.map(p => `
      <div class="m-list-item" onclick="MobileBilling.addToCart('${p.id}')">
        <div>
          <div class="title">${Utils.escapeHtml(p.name)}</div>
          <div class="sub">Stock: ${p.quantity}</div>
        </div>
        <div class="price" style="font-size:0.9rem;">+ ${Utils.formatCurrency(p.sellingPrice)}</div>
      </div>
    `).join('') || '<div style="padding:15px;text-align:center;">No products found</div>';
    
    document.getElementById('m-prod-list').innerHTML = html;
  },

  addToCart(id) {
    const p = DB.get('products').find(x => x.id === id);
    if (!p) return;
    
    const exist = this.cart.find(x => x.productId === id);
    if (exist) {
      if (exist.qty < p.quantity) exist.qty++;
      else alert('Max stock reached');
    } else {
      if (p.quantity > 0) this.cart.push({ productId: id, name: p.name, price: p.sellingPrice, qty: 1 });
      else alert('Out of stock');
    }
    document.getElementById('m-item-modal').classList.remove('open');
    this.renderCart();
  },

  renderCart() {
    let total = 0;
    const html = this.cart.map((item, index) => {
      total += item.price * item.qty;
      return `
      <div class="m-list-item">
        <div style="flex:1;">
          <div class="title">${Utils.escapeHtml(item.name)}</div>
          <div class="price">${Utils.formatCurrency(item.price)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="m-btn m-btn-sm" onclick="MobileBilling.changeQty(${index}, -1)">-</button>
          <span style="font-weight:700; width:20px; text-align:center;">${item.qty}</span>
          <button class="m-btn m-btn-sm" onclick="MobileBilling.changeQty(${index}, 1)">+</button>
        </div>
      </div>
      `;
    }).join('');

    document.getElementById('m-bill-items').innerHTML = html || '<div style="text-align:center; padding:20px; color:var(--text2); font-size:0.85rem;">No items added yet.</div>';
    document.getElementById('m-bill-total').textContent = Utils.formatCurrency(total);
  },

  changeQty(index, delta) {
    const item = this.cart[index];
    const p = DB.get('products').find(x => x.id === item.productId);
    
    item.qty += delta;
    if (item.qty > p.quantity) item.qty = p.quantity;
    if (item.qty <= 0) this.cart.splice(index, 1);
    
    this.renderCart();
  },

  saveBill(status) {
    if (this.cart.length === 0) return alert('Cart is empty!');
    const cust = document.getElementById('m-bill-cust').value.trim() || 'Walk-in';
    
    const total = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    
    const bill = {
      id: Utils.uuid(),
      customerName: cust,
      customerMobile: '',
      items: [...this.cart],
      subtotal: total,
      discountVal: 0,
      taxVal: 0,
      total: total,
      status: status, // 'paid' or 'unpaid'
      createdAt: new Date().toISOString()
    };
    
    DB.add('bills', bill);
    
    // Deduct Stock
    this.cart.forEach(item => {
      const p = DB.get('products').find(x => x.id === item.productId);
      if (p) { p.quantity -= item.qty; DB.update('products', p.id, p); }
    });
    
    // Manage Udhar
    if (status === 'unpaid') {
      let c = DB.find('customers', x => x.name === cust)[0];
      if (!c) {
        c = { id: Utils.uuid(), name: cust, udhar: total };
        DB.add('customers', c);
      } else {
        c.udhar = (c.udhar || 0) + total;
        DB.update('customers', c.id, c);
      }
    }
    
    alert(`Bill Saved Successfully! Total: ${Utils.formatCurrency(total)}`);
    this.init();
    Mobile.go('home');
  }
};

// ===== MOBILE STOCK =====
const MobileStock = {
  render() {
    const q = document.getElementById('m-stock-search').value.toLowerCase();
    const products = DB.get('products').filter(p => p.name.toLowerCase().includes(q));
    
    const html = products.map(p => `
      <div class="m-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div>
          <div class="title" style="font-weight:700;font-size:1rem;margin-bottom:4px;">${Utils.escapeHtml(p.name)}</div>
          <div class="sub" style="font-size:0.8rem;color:var(--text2);">Sell: ${Utils.formatCurrency(p.sellingPrice)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.75rem; color:var(--text2);">Stock</div>
          <div style="font-weight:800; font-size:1.2rem; color:${p.quantity < 5 ? 'var(--danger)' : 'var(--success)'}">${p.quantity}</div>
        </div>
      </div>
    `).join('') || '<div style="text-align:center;padding:20px;">No stock items</div>';
    
    document.getElementById('m-stock-list').innerHTML = html;
  }
};

// ===== MOBILE DUES =====
const MobileDues = {
  render() {
    const q = document.getElementById('m-dues-search').value.toLowerCase();
    const customers = DB.get('customers').filter(c => c.udhar > 0 && c.name.toLowerCase().includes(q));
    
    const html = customers.map(c => `
      <div class="m-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-left: 4px solid var(--danger);">
        <div>
          <div class="title" style="font-weight:700;font-size:1rem;margin-bottom:4px;">${Utils.escapeHtml(c.name)}</div>
          <div class="sub" style="font-size:0.8rem;color:var(--text2);">${c.mobile || 'No Number'}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.75rem; color:var(--text2);">Due Amount</div>
          <div style="font-weight:800; font-size:1.2rem; color:var(--danger);">${Utils.formatCurrency(c.udhar)}</div>
        </div>
      </div>
    `).join('') || '<div style="text-align:center;padding:20px;">No pending dues</div>';
    
    document.getElementById('m-dues-list').innerHTML = html;
  }
};

window.onload = () => Mobile.init();
