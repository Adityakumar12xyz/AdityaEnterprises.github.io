// ===== FIREBASE REALTIME DATABASE ADAPTER (Hybrid Sync) =====

const firebaseConfig = {
  apiKey: "AIzaSyDaGEHNhL4xuur4YBhYZjPpIDfHFvJbReY",
  authDomain: "adityaenterprises-39b8f.firebaseapp.com",
  projectId: "adityaenterprises-39b8f",
  storageBucket: "adityaenterprises-39b8f.firebasestorage.app",
  messagingSenderId: "59961846035",
  appId: "1:59961846035:web:9df67e443f63672d6212e6",
  measurementId: "G-ZCHCJP21XH"
};

// Initialize Firebase only once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Ensure database library is loaded
const realtimeDB = firebase.database();

// We will cache collections in memory so our synchronous app (DB.get) doesn't break
const _cache = {
  products: [],
  customers: [],
  transactions: [],
  bills: [],
  suppliers: [],
  supplier_transactions: [],
  system_settings: []
};

// Start realtime listeners to keep cache instantly updated
const _collections = Object.keys(_cache);
let dbReadyCount = 0;

_collections.forEach(col => {
  realtimeDB.ref(col).on('value', snapshot => {
    const dataObj = snapshot.val();
    
    if (dataObj) {
      _cache[col] = Object.keys(dataObj).map(key => ({ id: key, ...dataObj[key] }));
      
      // Auto-populate localStorage from Firebase Settings to maintain persistence across devices
      if (col === 'system_settings' && _cache[col].length > 0) {
        const s = _cache[col][0];
        Object.keys(s).forEach(k => {
          if (k.startsWith('shopapp_')) localStorage.setItem(k, s[k]);
        });
      }
    } else {
      _cache[col] = [];
    }
    
    // If we're fully loaded, re-render things since data changed remotely!
    if (dbReadyCount >= _collections.length) {
      if (window._syncTimer) clearTimeout(window._syncTimer);
      window._syncTimer = setTimeout(() => {
        if (window.Inventory && col === 'products') Inventory.load();
        if (window.Customers && col === 'customers') Customers.load();
        if (window.Billing && col === 'bills') Billing.renderBillHistory();
        if (window.Suppliers && (col === 'suppliers' || col === 'supplier_transactions')) Suppliers.load();
        if (window.Dashboard) { Dashboard.renderKPIs(); Dashboard.renderActivity(); }
        if (window.WhatsApp && col === 'customers' && Router.current === 'whatsapp') WhatsApp.loadFromCustomers(true);
      }, 500);
    } else {
       dbReadyCount++;
       // Trigger full UI refresh exactly once when all collections load initially
       if (dbReadyCount === _collections.length) {
         if (window.Router) {
           if (Router.current === 'dashboard' && window.Dashboard) Dashboard.init();
           if (Router.current === 'inventory' && window.Inventory) Inventory.load();
           if (Router.current === 'billing' && window.Billing) Billing.init();
           if (Router.current === 'customers' && window.Customers) Customers.load();
           if (Router.current === 'suppliers' && window.Suppliers) Suppliers.load();
           if (Router.current === 'analytics' && window.Analytics) Analytics.render();
           if (Router.current === 'whatsapp' && window.WhatsApp) WhatsApp.loadFromCustomers(true);
         }
       }
    }
  }, err => {
    console.error("Firebase Sync Error (" + col + "):", err);
    if (window.Notify) Notify.error("DB Sync Error: " + err.message);
  });
});

const DB = {
  get(collection) {
    // Return from RAM instantly
    return _cache[collection] || [];
  },

  set(collection, data) {
    // Unsupported in true DB, ignore. Arrays are populated via onSnapshot.
  },

  add(collection, item) {
    // 1. Give it a new cloud ID immediately
    const ref = realtimeDB.ref(collection).push();
    const id = ref.key;
    const newItem = { id, createdAt: new Date().toISOString(), ...item };
    
    // 2. Optimistic UI update
    if (!_cache[collection]) _cache[collection] = [];
    _cache[collection].push(newItem);
    
    // 3. Network Sync
    ref.set(newItem).catch(err => console.error("Firebase Sync Error:", err));
    return newItem;
  },

  update(collection, id, updates) {
    // 1. Optimistic Update
    const data = _cache[collection] || [];
    const idx = data.findIndex(i => i.id === id);
    let updatedItem = null;
    
    if (idx !== -1) {
      data[idx] = { ...data[idx], ...updates, updatedAt: new Date().toISOString() };
      updatedItem = data[idx];
    }
    
    // 2. Network Sync
    realtimeDB.ref(`${collection}/${id}`).update({
      ...updates,
      updatedAt: new Date().toISOString()
    }).catch(err => console.error("Firebase Sync Error:", err));
    
    return updatedItem;
  },

  delete(collection, id) {
    // 1. Optimistic Update
    if (_cache[collection]) {
      _cache[collection] = _cache[collection].filter(i => i.id !== id);
    }
    
    // 2. Network Sync
    realtimeDB.ref(`${collection}/${id}`).remove().catch(err => console.error("Firebase Delete Error:", err));
  },

  find(collection, predicate) { return this.get(collection).filter(predicate); },
  findOne(collection, predicate) { return this.get(collection).find(predicate); },
  
  clear(collection) { 
    // Not safely implemented for cloud db to avoid destroying all data
  },

  _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  seed() {
    // No-op for cloud setup to prevent accidental spamming across clients
  }
};
