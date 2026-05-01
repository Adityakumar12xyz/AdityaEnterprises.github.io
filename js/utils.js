// ===== UTILS WITH NUMBER TO WORDS =====
const Utils = {
  formatCurrency(amount) {
    const sym = localStorage.getItem('shopapp_currency') || '₹';
    return sym + parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  formatDateShort(d) {
    if (!d) return '-';
    const dt = new Date(d);
    return (dt.getMonth()+1) + '/' + dt.getDate() + '/' + dt.getFullYear();
  },
  formatDateTime(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },
  timeAgo(d) {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  },
  debounce(fn, delay = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  },
  animateCounter(el, target, duration = 1200, prefix = '', suffix = '') {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { start = target; clearInterval(timer); }
      el.textContent = prefix + Math.floor(start).toLocaleString('en-IN') + suffix;
    }, 16);
  },
  highlight(text, q) {
    if (!q) return text;
    return String(text).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
  },
  getMonthName(m) { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]; },
  getLastMonths(n) {
    const now = new Date(), res = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      res.push({ year: d.getFullYear(), month: d.getMonth(), label: this.getMonthName(d.getMonth()) });
    }
    return res;
  },
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },
  generateBillNumber() {
    const bills = DB.get('bills');
    const n = (bills.length + 1).toString().padStart(5, '0');
    return 'INV-' + n;
  },
  addRipple(el) {
    el.addEventListener('click', function(e) {
      const r = document.createElement('span');
      r.className = 'ripple';
      const rect = this.getBoundingClientRect();
      r.style.cssText = `left:${e.clientX-rect.left}px;top:${e.clientY-rect.top}px`;
      this.appendChild(r);
      setTimeout(() => r.remove(), 700);
    });
  },
  escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
  numToWords(num) {
    num = Math.round(num);
    if (num === 0) return 'Zero';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    function cvt(n) {
      if (n === 0) return '';
      if (n < 20) return ones[n] + ' ';
      if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '') + ' ';
      return ones[Math.floor(n/100)] + ' Hundred ' + cvt(n%100);
    }
    const cr = Math.floor(num/10000000);
    const lk = Math.floor((num%10000000)/100000);
    const th = Math.floor((num%100000)/1000);
    const rs = num%1000;
    let w = '';
    if (cr) w += cvt(cr) + 'Crore ';
    if (lk) w += cvt(lk) + 'Lakh ';
    if (th) w += cvt(th) + 'Thousand ';
    if (rs) w += cvt(rs);
    return 'INR ' + w.trim() + ' Only';
  }
};
