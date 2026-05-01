// ===== DASHBOARD MODULE =====
const Dashboard = {
  charts: {},

  init() {
    this.renderKPIs();
    this.renderCharts();
    this.renderActivity();
    this.renderLowStockAlert();
  },

  renderKPIs() {
    const bills = DB.get('bills');
    const products = DB.get('products');
    const customers = DB.get('customers');
    const txns = DB.get('transactions');

    const totalSales = bills.filter(b => b.status === 'paid').reduce((s, b) => s + b.total, 0);
    const totalPurchase = products.reduce((s, p) => s + (p.purchasePrice * p.quantity), 0);
    const totalStock = products.reduce((s, p) => s + p.quantity, 0);
    const totalUdhar = customers.reduce((s, c) => s + (c.udhar || 0), 0);

    const animate = (id, val, prefix = '') => {
      const el = document.getElementById(id);
      if (el) Utils.animateCounter(el, val, 1200, prefix);
    };

    animate('kpi-sales', totalSales, '₹');
    animate('kpi-purchase', totalPurchase, '₹');
    animate('kpi-stock', totalStock);
    animate('kpi-udhar', totalUdhar, '₹');

    // Low stock count badge
    const lowStock = products.filter(p => p.quantity <= 5).length;
    const badge = document.getElementById('nav-badge-inventory');
    if (badge) badge.textContent = lowStock || '';
    if (badge) badge.style.display = lowStock ? '' : 'none';
  },

  renderCharts() {
    const months = Utils.getLastMonths(6);
    const txns = DB.get('transactions');
    const bills = DB.get('bills');

    const salesData = months.map(m => {
      const monthBills = bills.filter(b => {
        const d = new Date(b.createdAt);
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      });
      const fromTxns = txns.filter(t => t.type === 'sale' && new Date(t.date).getMonth() === m.month && new Date(t.date).getFullYear() === m.year)
        .reduce((s, t) => s + t.amount, 0);
      return monthBills.reduce((s, b) => s + b.total, 0) + fromTxns;
    });

    const purchaseData = months.map(m => {
      return txns.filter(t => t.type === 'purchase' && new Date(t.date).getMonth() === m.month && new Date(t.date).getFullYear() === m.year)
        .reduce((s, t) => s + t.amount, 0);
    });

    const profitData = salesData.map((s, i) => s - purchaseData[i]);
    const labels = months.map(m => m.label);

    // Sales vs Purchase Line Chart
    const lineCtx = document.getElementById('chart-line');
    if (lineCtx) {
      if (this.charts.line) this.charts.line.destroy();
      const gradSales = lineCtx.getContext('2d').createLinearGradient(0, 0, 0, 260);
      gradSales.addColorStop(0, 'rgba(123,97,255,.35)');
      gradSales.addColorStop(1, 'rgba(123,97,255,.0)');
      const gradPurch = lineCtx.getContext('2d').createLinearGradient(0, 0, 0, 260);
      gradPurch.addColorStop(0, 'rgba(0,212,255,.35)');
      gradPurch.addColorStop(1, 'rgba(0,212,255,.0)');

      this.charts.line = new Chart(lineCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Sales', data: salesData, borderColor: '#7B61FF', backgroundColor: gradSales, tension: .4, fill: true, pointBackgroundColor: '#7B61FF', pointRadius: 5, pointHoverRadius: 8, borderWidth: 2.5 },
            { label: 'Purchase', data: purchaseData, borderColor: '#00D4FF', backgroundColor: gradPurch, tension: .4, fill: true, pointBackgroundColor: '#00D4FF', pointRadius: 5, pointHoverRadius: 8, borderWidth: 2.5 }
          ]
        },
        options: this._chartOptions('₹')
      });
    }

    // Monthly Profit Bar Chart
    const barCtx = document.getElementById('chart-bar');
    if (barCtx) {
      if (this.charts.bar) this.charts.bar.destroy();
      this.charts.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Profit',
            data: profitData,
            backgroundColor: profitData.map(v => v >= 0 ? 'rgba(16,185,129,.75)' : 'rgba(239,68,68,.75)'),
            borderRadius: 8, borderSkipped: false
          }]
        },
        options: this._chartOptions('₹')
      });
    }
  },

  _chartOptions(prefix = '') {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
    const textColor = isDark ? '#8D96C0' : '#525775';
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { family: 'Inter', size: 12 }, usePointStyle: true } },
        tooltip: {
          backgroundColor: isDark ? '#0F1120' : '#fff',
          titleColor: isDark ? '#E8EBF8' : '#0D0F1C',
          bodyColor: isDark ? '#8D96C0' : '#525775',
          borderColor: isDark ? 'rgba(123,97,255,.2)' : 'rgba(123,97,255,.15)',
          borderWidth: 1,
          padding: 12,
          callbacks: { label: ctx => ' ' + prefix + ctx.raw.toLocaleString('en-IN') }
        }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter' } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter' }, callback: v => prefix + v.toLocaleString('en-IN') } }
      }
    };
  },

  renderActivity() {
    const el = document.getElementById('activity-list');
    if (!el) return;
    const bills = DB.get('bills').slice(-5).reverse();
    const customers = DB.get('customers');
    const products = DB.get('products');

    const activities = [
      ...bills.map(b => ({ type: 'bill', icon: 'ri-receipt-line', color: 'purple', title: `Bill ${b.billNumber} — ${b.customerName}`, sub: Utils.formatCurrency(b.total), time: b.createdAt })),
      ...products.filter(p => p.quantity <= 5).slice(0, 3).map(p => ({ type: 'low', icon: 'ri-error-warning-line', color: 'orange', title: `Low Stock: ${p.name}`, sub: `Only ${p.quantity} units left`, time: p.updatedAt || p.createdAt })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);

    if (!activities.length) {
      el.innerHTML = '<div class="empty-state"><i class="ri-history-line"></i><h3>No recent activity</h3><p>Activity will appear here as you use the app</p></div>';
      return;
    }

    el.innerHTML = activities.map(a => `
      <div class="activity-item">
        <div class="activity-dot kpi-icon ${a.color === 'purple' ? 'purple' : a.color === 'orange' ? 'orange' : 'green'}" style="width:36px;height:36px;font-size:.95rem">
          <i class="${a.icon}"></i>
        </div>
        <div class="activity-content">
          <div class="act-title">${Utils.escapeHtml(a.title)}</div>
          <div class="act-sub">${a.sub}</div>
        </div>
        <div class="activity-time">${Utils.timeAgo(a.time)}</div>
      </div>
    `).join('');
  },

  renderLowStockAlert() {
    const el = document.getElementById('low-stock-banner');
    if (!el) return;
    const low = DB.get('products').filter(p => p.quantity <= 5);
    if (low.length) {
      el.style.display = 'flex';
      el.innerHTML = `<i class="ri-alert-fill"></i><span><strong>${low.length} product${low.length > 1 ? 's' : ''}</strong> running low on stock — ${low.map(p => p.name).join(', ')}</span>`;
    } else {
      el.style.display = 'none';
    }
  }
};
