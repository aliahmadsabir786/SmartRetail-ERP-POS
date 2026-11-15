// ═══════════════════════════════════════════════════════════════
// SmartRetail ERP — DEMO BACKEND (browser only)
// Django backend ke bagair poori app chalane ke liye: ye file
// /api/v1/... ki har request ko browser ke andar hi handle karti hai.
// Data localStorage mein save hota hai, isliye demo mein add/edit/delete
// refresh ke baad bhi rehta hai. Data reset karne ke liye URL ke aakhir mein
// ?reset=1 lagayen ya console mein DemoBackend.reset() chalayen.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const STORE_KEY = 'sr_demo_db_v1';

  // ── small helpers ────────────────────────────────────────────
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dayOf = s => String(s || '').slice(0, 10);
  const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const num = v => Number(v) || 0;
  const clone = o => JSON.parse(JSON.stringify(o));
  const fmt = n => num(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function daysAgo(n, h, m) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    let hh = h;
    if (n === 0) hh = Math.min(h, d.getHours());          // aaj ki sales future mein na jayen
    d.setHours(hh, m || 0, 0, 0);
    return d;
  }

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class ApiError extends Error {
    constructor(status, message, data) {
      super(message);
      this.status = status;
      this.data = data || { error: { message } };
    }
  }
  const notFound = what => new ApiError(404, (what || 'Item') + ' not found');
  const badReq = msg => new ApiError(400, msg);

  // ── database ─────────────────────────────────────────────────
  let db = null;

  function nextId(name) {
    db.seq[name] = (db.seq[name] || 0) + 1;
    return db.seq[name];
  }

  function seed() {
    const rnd = mulberry(20261115);
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));

    db = {
      seq: {}, categories: [], brands: [], warehouses: [], suppliers: [], customers: [],
      products: [], sales: [], purchase_orders: [], expenses: [], expense_categories: [],
      routes: [], users: [], stock_txns: [], settings: {},
    };

    db.settings = {
      company_name: 'SmartRetail Demo Store',
      address: 'Main Bazar, Burewala, Punjab',
      phone: '0314-0620796',
      email: 'demo@smartretail.com',
      website: 'www.smartretail-demo.com',
      tax_id: 'NTN-1234567-8',
      default_currency: 'PKR',
      default_tax_percent: 0,
      low_stock_threshold: 10,
      invoice_prefix: 'INV-',
      account_prefix: 'ACC-',
      invoice_header_note: 'Thank you for shopping with us!',
      invoice_footer_note: 'All sales are final. Visit us again!',
      show_tax_on_receipt: true,
      show_invoice_qr: true,
      general_auth_enabled: false,
      distributor_name: 'Demo Distribution Co.',
      distributor_phone: '0300-1234567',
      distributor_address: 'Industrial Area, Faisalabad',
      distributor_email: 'dist@smartretail.com',
      logo: null,
    };

    db.warehouses.push({ id: nextId('warehouses'), name: 'Main Store', code: 'MAIN', is_default: true, is_active: true, address: 'Burewala' });

    // users
    [['Ali Ahmad', 'demo@smartretail.com', 'admin'], ['Usman Raza', 'manager@smartretail.com', 'manager'],
     ['Bilal Khan', 'cashier@smartretail.com', 'cashier'], ['Hamza Sheikh', 'sales@smartretail.com', 'salesperson'],
     ['Imran Ali', 'stock@smartretail.com', 'inventory_manager']].forEach((u, i) => {
      db.users.push({
        id: nextId('users'), full_name: u[0], email: u[1], username: u[1].split('@')[0], role: u[2], is_active: true,
        phone: '0300-11122' + pad(i + 10), last_login: iso(daysAgo(i, 9, 15)), date_joined: iso(daysAgo(60 + i, 9, 0)),
      });
    });

    // categories + brands
    ['Beverages', 'Snacks', 'Dairy', 'Bakery', 'Personal Care', 'Household', 'Grocery', 'Stationery'].forEach(n =>
      db.categories.push({ id: nextId('categories'), name: n, parent: null, is_active: true, description: '' }));
    const brandId = name => {
      let b = db.brands.find(x => x.name === name);
      if (!b) { b = { id: nextId('brands'), name, is_active: true }; db.brands.push(b); }
      return b.id;
    };
    const catId = name => db.categories.find(c => c.name === name).id;

    // suppliers
    [['Coca-Cola Beverages Pakistan', '042-35761111', 'Lahore'], ['Nestle Pakistan Distributors', '042-35762222', 'Lahore'],
     ['Unilever Pakistan Distributor', '021-34523333', 'Karachi'], ['National Foods Agency', '021-34524444', 'Karachi'],
     ['Dawn Bakery Supplies', '041-87625555', 'Faisalabad'], ['Metro Wholesale Traders', '041-87626666', 'Faisalabad']].forEach(s =>
      db.suppliers.push({
        id: nextId('suppliers'), name: s[0], phone: s[1], email: s[0].split(' ')[0].toLowerCase() + '@supplier.pk',
        address: s[2] + ', Pakistan', is_active: true, outstanding_payable: 0, created_at: iso(daysAgo(90, 10, 0)),
      }));

    // products: [name, sku, category, brand, cost, price, tax%, stock, reorder, supplierIdx]
    const P = [
      ['Coca-Cola 1.5L', 'BEV-001', 'Beverages', 'Coca-Cola', 165, 190, 0, 120, 24, 1],
      ['Pepsi 1.5L', 'BEV-002', 'Beverages', 'Pepsi', 160, 185, 0, 96, 24, 1],
      ['Sprite 345ml', 'BEV-003', 'Beverages', 'Coca-Cola', 55, 70, 0, 150, 36, 1],
      ['Nestle Pure Water 1.5L', 'BEV-004', 'Beverages', 'Nestle', 70, 90, 0, 80, 24, 2],
      ['Lays Masala 50g', 'SNK-001', 'Snacks', 'Lays', 55, 70, 5, 140, 30, 6],
      ['Kurkure Chutney 60g', 'SNK-002', 'Snacks', 'Kurkure', 45, 60, 5, 12, 25, 6],
      ['Peek Freans Gluco', 'SNK-003', 'Snacks', 'Peek Freans', 25, 35, 0, 200, 40, 6],
      ['Olpers Milk 1L', 'DAI-001', 'Dairy', 'Olpers', 230, 260, 0, 18, 30, 2],
      ['Nestle Milkpak 1L', 'DAI-002', 'Dairy', 'Nestle', 225, 255, 0, 60, 30, 2],
      ['Adams Yogurt 400g', 'DAI-003', 'Dairy', 'Adams', 150, 180, 0, 35, 12, 2],
      ['Dawn Bread Large', 'BAK-001', 'Bakery', 'Dawn', 120, 150, 0, 15, 20, 5],
      ['Rusk Pack', 'BAK-002', 'Bakery', 'Dawn', 90, 120, 0, 44, 15, 5],
      ['Lux Soap 130g', 'PC-001', 'Personal Care', 'Lux', 110, 140, 17, 90, 24, 3],
      ['Head & Shoulders 185ml', 'PC-002', 'Personal Care', 'Head & Shoulders', 410, 495, 17, 28, 10, 3],
      ['Colgate MaxFresh 100g', 'PC-003', 'Personal Care', 'Colgate', 180, 220, 17, 52, 15, 3],
      ['Surf Excel 1kg', 'HH-001', 'Household', 'Surf Excel', 540, 640, 17, 40, 12, 3],
      ['Vim Dishwash Bar', 'HH-002', 'Household', 'Vim', 60, 80, 17, 110, 30, 3],
      ['Harpic 500ml', 'HH-003', 'Household', 'Harpic', 270, 330, 17, 0, 10, 3],
      ['National Basmati Rice 5kg', 'GRO-001', 'Grocery', 'National', 1550, 1790, 0, 45, 10, 4],
      ['Dalda Cooking Oil 1L', 'GRO-002', 'Grocery', 'Dalda', 520, 590, 0, 70, 20, 4],
      ['Shan Biryani Masala', 'GRO-003', 'Grocery', 'Shan', 90, 120, 0, 85, 25, 4],
      ['Tapal Danedar 190g', 'GRO-004', 'Grocery', 'Tapal', 235, 275, 0, 64, 20, 4],
      ['Sugar 1kg', 'GRO-005', 'Grocery', 'Local', 150, 175, 0, 160, 40, 6],
      ['Dollar Ball Pen Pack', 'STA-001', 'Stationery', 'Dollar', 80, 110, 17, 75, 20, 6],
      ['A4 Notebook 200pg', 'STA-002', 'Stationery', 'Local', 140, 190, 17, 8, 15, 6],
    ];
    P.forEach(p => {
      const id = nextId('products');
      db.products.push({
        id, name: p[0], sku: p[1], barcode: '8964000' + String(id).padStart(6, '0'),
        category: catId(p[2]), brand: brandId(p[3]), supplier: p[9],
        cost_price: Math.round(p[5] * 0.72), selling_price: p[5], tax_rate: p[6], discount_percent: 0,
        current_stock: p[7], reorder_level: p[8], status: 'active', unit: 'pcs',
        description: '', created_at: iso(daysAgo(80, 11, 0)), updated_at: iso(daysAgo(5, 11, 0)),
      });
    });

    // customers
    const areas = ['Burewala', 'Vehari', 'Mailsi', 'Lodhran', 'Arifwala', 'Pakpattan', 'Chichawatni', 'Khanewal'];
    ['Al-Madina General Store', 'Rehman Kiryana Store', 'Bismillah Mart', 'Ali Traders', 'Hassan Super Store',
     'Madni Cash & Carry', 'Faisal Karyana', 'Zam Zam Mart', 'New Punjab Store', 'Gulshan Bakers',
     'Noor General Store', 'Usman Departmental Store'].forEach((n, i) => {
      const id = nextId('customers');
      db.customers.push({
        id, name: n, account_no: 'ACC-' + String(id).padStart(4, '0'),
        phone: '03' + between(0, 4) + between(0, 9) + '-' + String(between(1000000, 9999999)),
        cnic: '36' + between(100, 999) + '-' + between(1000000, 9999999) + '-' + between(1, 9),
        email: i % 3 === 0 ? n.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') + '@mail.com' : '',
        address: pick(['Main Bazar', 'Railway Road', 'Chowk Rehmat', 'Mandi Road', 'Model Town']) + ', ' + areas[i % areas.length],
        loyalty_points: between(0, 400), opening_balance: 0, outstanding_balance: 0, group: null, is_active: true,
        created_at: iso(daysAgo(between(40, 120), 10, 0)), updated_at: iso(daysAgo(between(0, 20), 10, 0)),
      });
    });

    // expense categories + expenses
    ['Rent', 'Electricity', 'Salaries', 'Transport', 'Maintenance', 'Miscellaneous'].forEach(n =>
      db.expense_categories.push({ id: nextId('expense_categories'), name: n, is_active: true }));
    [['Rent', 'Shop rent', 25000, 28], ['Electricity', 'WAPDA bill', 9800, 20], ['Salaries', 'Staff salaries', 32000, 15],
     ['Transport', 'Delivery van fuel', 6500, 10], ['Maintenance', 'Shelf repair', 3200, 8], ['Transport', 'Loading charges', 2400, 5],
     ['Miscellaneous', 'Cleaning supplies', 1500, 3], ['Electricity', 'Generator fuel', 4200, 1]].forEach(e => {
      const cat = db.expense_categories.find(c => c.name === e[0]);
      db.expenses.push({
        id: nextId('expenses'), category: cat.id, category_name: cat.name, description: e[1], amount: e[2],
        expense_date: ymd(daysAgo(e[3], 12, 0)), payment_method: 'cash', created_at: iso(daysAgo(e[3], 12, 0)),
      });
    });

    // routes
    [['Burewala City Route', 'Hamza Sheikh', 'Burewala', ['Mon', 'Thu'], 'Active'],
     ['Vehari Road Route', 'Hamza Sheikh', 'Vehari', ['Tue', 'Fri'], 'Active'],
     ['Mailsi Route', 'Usman Raza', 'Mailsi', ['Wed'], 'Active'],
     ['Lodhran Route', 'Usman Raza', 'Lodhran', ['Sat'], 'Active'],
     ['Khanewal Route', 'Bilal Khan', 'Khanewal', ['Mon', 'Fri'], 'Inactive']].forEach(r =>
      db.routes.push({
        id: nextId('routes'), name: r[0], person: r[1], area: r[2], days: r[3], status: r[4],
        notes: '', supplier_names: [], created_at: iso(daysAgo(60, 10, 0)),
      }));

    // sales (last 30 days)
    const staff = ['Bilal Khan', 'Hamza Sheikh', 'Ali Ahmad'];
    const rows = [];
    for (let off = 29; off >= 0; off--) {
      const cnt = off === 0 ? 5 : between(1, 3);
      for (let k = 0; k < cnt; k++) {
        rows.push({ off, h: between(9, 20), m: between(0, 59), booking: rnd() < 0.6 });
      }
    }
    rows.sort((a, b) => (b.off - a.off) || (a.h - b.h) || (a.m - b.m));
    rows.forEach(r => {
      const nItems = r.booking ? between(2, 5) : between(1, 3);
      const used = new Set();
      const items = [];
      while (items.length < nItems) {
        const p = pick(db.products);
        if (used.has(p.id)) continue;
        used.add(p.id);
        items.push({ product: p.id, quantity: r.booking ? between(3, 24) : between(1, 4) });
      }
      const when = daysAgo(r.off, r.h, r.m);
      const cust = r.booking ? pick(db.customers) : (rnd() < 0.3 ? pick(db.customers) : null);
      const sale = buildSale({
        customer: cust ? cust.id : null, items, discount_amount: rnd() < 0.15 ? between(1, 5) * 50 : 0,
        notes: r.booking ? 'Order Booking (date: ' + ymd(when) + ')' : 'POS Terminal',
        created_at: iso(when), served_by_name: pick(staff), seedPrices: true,
      });
      // payments
      const roll = rnd();
      if (!r.booking || roll < 0.30) addPayment(sale, sale.total_amount, 'cash', iso(when));
      else if (roll < 0.55) addPayment(sale, round2(sale.total_amount * (between(3, 7) / 10)), 'cash', iso(when));
      db.sales.push(sale);
    });

    // purchase orders
    [[1, 'received', 1, 30], [2, 'received', 1, 22], [3, 'received', 0, 18], [4, 'received', 1, 12],
     [5, 'pending', 0, 6], [6, 'received', 1, 4], [2, 'pending', 0, 2]].forEach(po => {
      const lines = [];
      const sup = po[0];
      const prods = db.products.filter(p => p.supplier === sup);
      prods.slice(0, 3).forEach(p => lines.push({ product: p.id, quantity: between(20, 60), unit_cost: p.cost_price }));
      if (!lines.length) return;
      const total = lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
      const s = db.suppliers.find(x => x.id === sup);
      db.purchase_orders.push({
        id: nextId('purchase_orders'), po_number: 'PO-' + String(db.seq.purchase_orders).padStart(5, '0'),
        supplier: sup, supplier_name: s.name, status: po[1], total_amount: round2(total),
        paid_amount: po[2] ? round2(total) : 0, warehouse: 1, notes: '',
        items: lines.map((l, i) => ({
          id: i + 1, product: l.product, product_name: db.products.find(p => p.id === l.product).name,
          quantity: l.quantity, unit_cost: l.unit_cost, line_total: round2(l.quantity * l.unit_cost),
        })),
        created_at: iso(daysAgo(po[3], 11, 0)),
      });
    });

    // a few stock transactions for the inventory history
    db.products.slice(0, 12).forEach((p, i) => addTxn(p, 'purchase', between(20, 60), 'PO-0000' + (i % 6 + 1), daysAgo(between(5, 25), 11, 0)));

    recalc();
    save();
  }

  // ── sale building ────────────────────────────────────────────
  function computeItems(items) {
    return (items || []).map((it, i) => {
      const p = db.products.find(x => x.id === Number(it.product));
      if (!p) throw badReq('Product not found');
      const qty = num(it.quantity);
      const price = it.unit_price !== undefined && it.unit_price !== null && it.unit_price !== '' ? num(it.unit_price) : num(p.selling_price);
      const taxPct = it.tax_percent !== undefined ? num(it.tax_percent) : num(p.tax_rate);
      const discPct = num(it.discount_percent);
      const sub = round2(qty * price);
      const disc = round2(sub * discPct / 100);
      const tax = round2((sub - disc) * taxPct / 100);
      return {
        id: i + 1, product: p.id, product_name: p.name, sku: p.sku, quantity: qty, unit_price: price,
        cost_price: p.cost_price, tax_percent: taxPct, discount_percent: discPct,
        line_subtotal: sub, line_discount: disc, line_tax: tax, line_total: round2(sub - disc + tax),
      };
    });
  }

  function buildSale(o) {
    const items = computeItems(o.items);
    const cust = o.customer ? db.customers.find(c => c.id === Number(o.customer)) : null;
    const subtotal = round2(items.reduce((s, i) => s + i.line_subtotal - i.line_discount, 0));
    const tax = round2(items.reduce((s, i) => s + i.line_tax, 0));
    const discount = round2(o.discount_amount);
    const id = nextId('sales');
    const sale = {
      id, invoice_number: (db.settings.invoice_prefix || 'INV-') + String(id).padStart(5, '0'),
      status: o.status || 'completed',
      customer: cust ? cust.id : null, customer_name: cust ? cust.name : '', customer_account_no: cust ? cust.account_no : '',
      customer_address: cust ? cust.address : '', customer_phone: cust ? cust.phone : '', customer_cnic: cust ? cust.cnic : '',
      warehouse: o.warehouse || 1, served_by_name: o.served_by_name || 'Demo User',
      items, payments: [], subtotal, tax_amount: tax, discount_amount: discount,
      total_amount: round2(subtotal + tax - discount), paid_amount: 0, due_amount: 0,
      payment_status: 'unpaid', is_credit_sale: !!o.is_credit_sale, notes: o.notes || '',
      created_at: o.created_at || iso(new Date()), updated_at: o.created_at || iso(new Date()),
    };
    sale.due_amount = sale.status === 'draft' ? 0 : sale.total_amount;
    return sale;
  }

  function addPayment(sale, amount, method, when) {
    amount = round2(amount);
    if (amount <= 0) return;
    sale.payments.push({ id: nextId('payments'), amount, method: method || 'cash', created_at: when || iso(new Date()), reference: '' });
    refreshSale(sale);
  }

  function refreshSale(sale) {
    sale.paid_amount = round2(sale.payments.reduce((s, p) => s + num(p.amount), 0));
    const live = !['draft', 'returned', 'cancelled'].includes(sale.status);
    sale.due_amount = live ? Math.max(0, round2(sale.total_amount - sale.paid_amount)) : 0;
    sale.payment_status = sale.paid_amount >= sale.total_amount - 0.005 && sale.total_amount > 0 ? 'paid'
      : sale.paid_amount > 0 ? 'partial' : 'unpaid';
  }

  function addTxn(product, type, qty, reference, when) {
    db.stock_txns.push({
      id: nextId('stock_txns'), product: product.id, product_name: product.name, sku: product.sku, warehouse: 1,
      transaction_type: type, quantity: Math.abs(qty), balance_after: product.current_stock,
      reference: reference || '', notes: '', created_at: iso(when || new Date()),
    });
  }

  function moveStock(productId, delta, type, reference) {
    const p = db.products.find(x => x.id === Number(productId));
    if (!p) return;
    p.current_stock = Math.max(0, num(p.current_stock) + delta);
    addTxn(p, type, delta, reference);
  }

  function recalc() {
    db.customers.forEach(c => {
      const due = db.sales.filter(s => s.customer === c.id).reduce((t, s) => t + num(s.due_amount), 0);
      c.outstanding_balance = round2(Math.max(0, due + num(c.opening_balance) - num(c.advance_balance)));
    });
    db.suppliers.forEach(s => {
      s.outstanding_payable = round2(db.purchase_orders.filter(p => p.supplier === s.id && p.status !== 'cancelled')
        .reduce((t, p) => t + Math.max(0, num(p.total_amount) - num(p.paid_amount)), 0));
    });
  }

  // ── persistence ──────────────────────────────────────────────
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (_) { /* storage full / blocked — demo still works in memory */ }
  }
  function load() {
    try {
      if (/[?&]reset=1/.test(location.search)) localStorage.removeItem(STORE_KEY);
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) { db = JSON.parse(raw); if (db && db.products && db.sales) return; }
    } catch (_) { /* fall through to fresh seed */ }
    seed();
  }

  // ── query helpers ────────────────────────────────────────────
  function parseQuery(qs) {
    const out = {};
    (qs || '').split('&').filter(Boolean).forEach(kv => {
      const i = kv.indexOf('=');
      const k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i));
      const v = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
      out[k] = v;
    });
    return out;
  }

  function paginate(items, q) {
    const size = Math.max(1, parseInt(q.page_size, 10) || 20);
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / size));
    const page = Math.min(Math.max(1, parseInt(q.page, 10) || 1), pages);
    return {
      count: total, total_pages: pages, current_page: page,
      next: page < pages ? '?page=' + (page + 1) : null,
      previous: page > 1 ? '?page=' + (page - 1) : null,
      results: items.slice((page - 1) * size, page * size),
    };
  }

  function sortBy(items, ordering) {
    if (!ordering) return items;
    const f = ordering.split(',')[0];
    const desc = f[0] === '-';
    const key = desc ? f.slice(1) : f;
    return items.slice().sort((a, b) => {
      let x = a[key], y = b[key];
      if (x === undefined || x === null) x = '';
      if (y === undefined || y === null) y = '';
      const r = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).toLowerCase().localeCompare(String(y).toLowerCase());
      return desc ? -r : r;
    });
  }

  function searchItems(items, term, fields) {
    if (!term) return items;
    const t = term.toLowerCase();
    return items.filter(it => fields.some(f => String(it[f] === undefined || it[f] === null ? '' : it[f]).toLowerCase().includes(t)));
  }

  function listResponse(items, q, opts) {
    opts = opts || {};
    let out = items;
    (opts.filters || []).forEach(k => {
      if (q[k] !== undefined && q[k] !== '') out = out.filter(it => String(it[k]) === String(q[k]));
    });
    out = searchItems(out, q.search, opts.search || ['name']);
    if (opts.extra) out = opts.extra(out, q);
    out = sortBy(out, q.ordering || opts.ordering);
    return paginate(out.map(opts.decorate || (x => x)), q);
  }

  // ── decorators ───────────────────────────────────────────────
  const decProduct = p => {
    const c = db.categories.find(x => x.id === p.category);
    const b = db.brands.find(x => x.id === p.brand);
    const s = db.suppliers.find(x => x.id === p.supplier);
    return Object.assign({}, p, {
      category_name: c ? c.name : '', brand_name: b ? b.name : '', supplier_name: s ? s.name : '',
      final_price: round2(num(p.selling_price) * (1 + num(p.tax_rate) / 100)),
      is_low_stock: num(p.current_stock) <= num(p.reorder_level),
    });
  };
  const decCategory = c => Object.assign({}, c, { product_count: db.products.filter(p => p.category === c.id).length });
  const decBrand = b => Object.assign({}, b, { product_count: db.products.filter(p => p.brand === b.id).length });
  const stockItem = p => ({
    id: p.id, product: p.id, product_name: p.name, sku: p.sku, warehouse: 1, warehouse_name: 'Main Store',
    quantity: num(p.current_stock), reorder_level: num(p.reorder_level), is_low_stock: num(p.current_stock) <= num(p.reorder_level),
  });

  // ── CRUD factory ─────────────────────────────────────────────
  const routes = [];
  function route(method, pattern, handler) {
    routes.push({ method, re: new RegExp('^' + pattern + '$'), handler });
  }

  function crud(base, coll, opts) {
    opts = opts || {};
    const get = id => {
      const it = db[coll].find(x => x.id === Number(id));
      if (!it) throw notFound(opts.label || base);
      return it;
    };
    route('GET', base, (ctx) => listResponse(db[coll], ctx.q, opts));
    route('GET', base + '/(\\d+)', (ctx) => (opts.decorate || (x => x))(get(ctx.m[1])));
    route('POST', base, (ctx) => {
      const body = Object.assign({}, ctx.body || {});
      if (opts.validate) opts.validate(body);
      const rec = Object.assign({}, opts.defaults ? opts.defaults() : {}, body, { id: nextId(coll) });
      rec.created_at = rec.created_at || iso(new Date());
      rec.updated_at = iso(new Date());
      if (opts.beforeSave) opts.beforeSave(rec);
      db[coll].push(rec);
      recalc(); save();
      return (opts.decorate || (x => x))(rec);
    });
    const upd = (ctx) => {
      const rec = get(ctx.m[1]);
      Object.assign(rec, ctx.body || {});
      rec.updated_at = iso(new Date());
      if (opts.beforeSave) opts.beforeSave(rec);
      recalc(); save();
      return (opts.decorate || (x => x))(rec);
    };
    route('PATCH', base + '/(\\d+)', upd);
    route('PUT', base + '/(\\d+)', upd);
    route('DELETE', base + '/(\\d+)', (ctx) => {
      const rec = get(ctx.m[1]);
      if (opts.beforeDelete) opts.beforeDelete(rec);
      db[coll] = db[coll].filter(x => x !== rec);
      recalc(); save();
      return null;
    });
  }

  // ═════════ AUTH ═════════
  const demoUser = () => db.users[0];
  route('POST', 'auth/login', (ctx) => ({ access: 'demo-access-token', refresh: 'demo-refresh-token', user: demoUser() }));
  route('POST', 'auth/refresh', () => ({ access: 'demo-access-token', refresh: 'demo-refresh-token' }));
  route('POST', 'auth/logout', () => ({}));
  route('GET', 'auth/profile', () => demoUser());
  route('PATCH', 'auth/profile', (ctx) => Object.assign(demoUser(), ctx.body || {}));
  route('POST', 'auth/password-reset/?.*', () => ({ detail: 'Demo mode: password reset is disabled.' }));
  route('POST', 'auth/(change-password|forgot-password|reset-password.*)', () => ({ detail: 'ok' }));

  crud('auth/users', 'users', {
    search: ['full_name', 'email', 'username'], label: 'User',
    defaults: () => ({ is_active: true, role: 'cashier', last_login: null }),
    beforeSave: u => { u.password = undefined; delete u.password; delete u.password_confirm; if (!u.username) u.username = String(u.email || '').split('@')[0]; },
  });

  // ═════════ SETTINGS ═════════
  route('GET', 'settings/company/public', () => ({ name: db.settings.company_name, company_name: db.settings.company_name, logo: db.settings.logo }));
  route('GET', 'settings/company', () => clone(db.settings));
  route('PATCH', 'settings/company', async (ctx) => {
    let body = ctx.body || {};
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      const file = body.get('logo');
      body = {};
      if (file && typeof FileReader !== 'undefined') {
        body.logo = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(file); });
      }
    }
    if (body.general_auth_password !== undefined) {
      db.settings.general_auth_password = body.general_auth_password;
      db.settings.general_auth_enabled = !!body.general_auth_password;
      delete body.general_auth_password;
    }
    Object.assign(db.settings, body);
    save();
    return clone(db.settings);
  });
  route('POST', 'settings/general-auth/verify', (ctx) => {
    const pw = db.settings.general_auth_password;
    return { valid: !pw || (ctx.body && ctx.body.password === pw) };
  });
  route('POST', 'settings/clear-products', () => { db.products = []; db.stock_txns = []; recalc(); save(); return { detail: 'Products cleared' }; });
  route('POST', 'settings/clear-sale-slips', () => { db.sales = []; recalc(); save(); return { detail: 'Sale slips cleared' }; });
  route('POST', 'settings/clear-customers', () => { db.customers = []; recalc(); save(); return { detail: 'Customers cleared' }; });

  // ═════════ CATALOG ═════════
  crud('categories', 'categories', { decorate: decCategory, label: 'Category', defaults: () => ({ is_active: true, parent: null }) });
  route('GET', 'categories/tree', () => db.categories.map(decCategory));
  crud('brands', 'brands', { decorate: decBrand, label: 'Brand', defaults: () => ({ is_active: true }) });
  crud('warehouses', 'warehouses', { label: 'Warehouse', defaults: () => ({ is_active: true, is_default: false }) });

  crud('products', 'products', {
    decorate: decProduct, label: 'Product', search: ['name', 'sku', 'barcode'], ordering: 'name',
    filters: ['category', 'brand', 'status', 'supplier'],
    defaults: () => ({ status: 'active', current_stock: 0, reorder_level: 10, tax_rate: 0, cost_price: 0, selling_price: 0, discount_percent: 0 }),
    validate: b => {
      if (!b.name) throw badReq('Name: This field is required.');
      if (b.sku && db.products.some(p => String(p.sku).toLowerCase() === String(b.sku).toLowerCase())) throw badReq('Sku: A product with this SKU already exists.');
    },
    beforeSave: p => {
      ['cost_price', 'selling_price', 'tax_rate', 'reorder_level', 'current_stock', 'discount_percent'].forEach(k => { p[k] = num(p[k]); });
      if (p.initial_stock !== undefined) { p.current_stock = num(p.initial_stock); delete p.initial_stock; }
      if (!p.sku) p.sku = 'SKU-' + String(Date.now()).slice(-6);
      if (!p.barcode) p.barcode = '8964' + String(Date.now()).slice(-8);
    },
  });
  route('GET', 'products/low_stock', () => db.products.filter(p => num(p.current_stock) <= num(p.reorder_level)).map(decProduct));
  route('POST', 'products/bulk-create', (ctx) => {
    const made = [];
    ((ctx.body && ctx.body.items) || []).forEach(it => {
      const rec = Object.assign({ status: 'active', current_stock: 0, reorder_level: 10, tax_rate: 0 }, it, { id: nextId('products') });
      rec.sku = rec.sku || 'SKU-' + rec.id;
      db.products.push(rec); made.push(decProduct(rec));
    });
    save();
    return { created: made.length, results: made, errors: [] };
  });

  // ═════════ INVENTORY ═════════
  route('GET', 'inventory/stock-items', (ctx) => listResponse(db.products, ctx.q, {
    search: ['name', 'sku'], decorate: stockItem, filters: ['category'],
    extra: (items, q) => q.product ? items.filter(p => String(p.id) === String(q.product)) : items,
  }));
  route('GET', 'inventory/stock-items/low-stock', () => ({ results: db.products.filter(p => num(p.current_stock) > 0 && num(p.current_stock) <= num(p.reorder_level)).map(stockItem) }));
  route('GET', 'inventory/stock-items/out-of-stock', () => ({ results: db.products.filter(p => num(p.current_stock) <= 0).map(stockItem) }));
  route('GET', 'inventory/transactions', (ctx) => {
    let items = db.stock_txns.slice().sort((a, b) => b.id - a.id);
    if (ctx.q.product) items = items.filter(t => String(t.product) === String(ctx.q.product));
    return paginate(items, ctx.q);
  });
  const stockOp = (sign, type) => (ctx) => {
    const b = ctx.body || {};
    const qty = num(b.quantity);
    if (qty <= 0) throw badReq('Quantity: Must be greater than zero.');
    moveStock(b.product, sign * qty, type, b.reference || '');
    save();
    return { detail: 'Stock updated' };
  };
  route('POST', 'inventory/stock-in', stockOp(1, 'stock_in'));
  route('POST', 'inventory/stock-out', stockOp(-1, 'stock_out'));
  route('POST', 'inventory/adjust', (ctx) => {
    const b = ctx.body || {};
    const p = db.products.find(x => x.id === Number(b.product));
    if (!p) throw notFound('Product');
    const qty = num(b.quantity);
    const inc = b.increase === true || b.direction === 'increase' || b.adjustment_type === 'increase' || (b.increase === undefined && b.decrease === undefined && qty >= 0);
    moveStock(p.id, inc ? Math.abs(qty) : -Math.abs(qty), inc ? 'adjustment_increase' : 'adjustment_decrease', b.reference || b.notes || '');
    save();
    return { detail: 'Stock adjusted' };
  });
  route('GET', 'inventory/transfers', (ctx) => paginate([], ctx.q));
  route('POST', 'inventory/transfers', (ctx) => Object.assign({ id: nextId('transfers') }, ctx.body || {}));

  // ═════════ PEOPLE ═════════
  crud('customers', 'customers', {
    label: 'Customer', search: ['name', 'phone', 'cnic', 'email', 'account_no'], ordering: 'name',
    defaults: () => ({ loyalty_points: 0, opening_balance: 0, outstanding_balance: 0, is_active: true }),
    beforeSave: c => {
      if (c.previous_balance !== undefined) { c.opening_balance = num(c.previous_balance); }
      if (!c.account_no) c.account_no = (db.settings.account_prefix || 'ACC-') + String(c.id).padStart(4, '0');
      c.loyalty_points = num(c.loyalty_points);
    },
  });
  route('GET', 'customers/groups', () => []);
  route('GET', 'customers/next-account-no', () => ({ account_no: (db.settings.account_prefix || 'ACC-') + String((db.seq.customers || 0) + 1).padStart(4, '0') }));
  route('GET', 'customers/balances', () => {
    const balances = {};
    db.customers.forEach(c => {
      const sales = db.sales.filter(s => s.customer === c.id && !['draft', 'returned', 'cancelled'].includes(s.status));
      const total = sales.reduce((t, s) => t + num(s.total_amount), 0);
      const paid = sales.reduce((t, s) => t + num(s.paid_amount), 0);
      balances[c.id] = { total: round2(total), paid: round2(paid), remaining: round2(Math.max(0, c.outstanding_balance)) };
    });
    return { balances };
  });
  function customerLedger(c) {
    const entries = [];
    db.sales.filter(s => s.customer === c.id && !['draft', 'returned', 'cancelled'].includes(s.status)).forEach(s => {
      entries.push({ id: 'i' + s.id, date: dayOf(s.created_at), sort: s.created_at, type: 'invoice', description: 'Sale invoice', reference: s.invoice_number, amount: s.total_amount });
      s.payments.forEach(p => entries.push({ id: 'p' + p.id, payment_id: p.id, date: dayOf(p.created_at), sort: p.created_at, type: 'payment', description: 'Payment (' + p.method + ')', reference: s.invoice_number, amount: p.amount }));
    });
    entries.sort((a, b) => String(a.sort).localeCompare(String(b.sort)));
    let run = num(c.opening_balance);
    entries.forEach(e => { run += e.type === 'invoice' ? num(e.amount) : -num(e.amount); e.remaining = round2(run); delete e.sort; });
    const owed = entries.filter(e => e.type === 'invoice').reduce((t, e) => t + num(e.amount), 0) + num(c.opening_balance);
    const paid = entries.filter(e => e.type === 'payment').reduce((t, e) => t + num(e.amount), 0);
    return { amount_owed: round2(owed), total_paid: round2(paid), remaining: round2(Math.max(0, owed - paid)), entries };
  }
  route('GET', 'customers/(\\d+)/ledger', (ctx) => {
    const c = db.customers.find(x => x.id === Number(ctx.m[1]));
    if (!c) throw notFound('Customer');
    return customerLedger(c);
  });
  route('POST', 'customers/(\\d+)/collect-payment', (ctx) => {
    const c = db.customers.find(x => x.id === Number(ctx.m[1]));
    if (!c) throw notFound('Customer');
    let left = num(ctx.body && ctx.body.amount);
    if (left <= 0) throw badReq('Amount: Must be greater than zero.');
    const method = (ctx.body && ctx.body.method) || 'cash';
    db.sales.filter(s => s.customer === c.id && s.due_amount > 0).sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach(s => {
      if (left <= 0) return;
      const pay = Math.min(left, s.due_amount);
      addPayment(s, pay, method);
      left = round2(left - pay);
    });
    if (left > 0) c.advance_balance = round2(num(c.advance_balance) + left);
    recalc(); save();
    return { detail: 'Payment recorded', remaining: c.outstanding_balance };
  });
  route('POST', 'customers/(\\d+)/clear-advance', (ctx) => {
    const c = db.customers.find(x => x.id === Number(ctx.m[1]));
    if (!c) throw notFound('Customer');
    c.advance_balance = 0; recalc(); save();
    return { detail: 'Advance cleared' };
  });
  route('DELETE', 'customers/(\\d+)/advance-clearances/(\\d+)', () => null);
  route('POST', 'customers/bulk-create', (ctx) => {
    const made = [];
    ((ctx.body && ctx.body.items) || []).forEach(it => {
      const id = nextId('customers');
      const rec = Object.assign({ loyalty_points: 0, opening_balance: 0, outstanding_balance: 0, is_active: true }, it, { id });
      rec.account_no = rec.account_no || (db.settings.account_prefix || 'ACC-') + String(id).padStart(4, '0');
      rec.created_at = rec.updated_at = iso(new Date());
      db.customers.push(rec); made.push(rec);
    });
    recalc(); save();
    return { created: made.length, results: made, errors: [] };
  });

  crud('suppliers', 'suppliers', {
    label: 'Supplier', search: ['name', 'phone', 'email'], ordering: 'name',
    defaults: () => ({ is_active: true, outstanding_payable: 0 }),
  });
  route('GET', 'suppliers/(\\d+)/ledger', (ctx) => {
    const s = db.suppliers.find(x => x.id === Number(ctx.m[1]));
    if (!s) throw notFound('Supplier');
    const entries = [];
    let run = 0, owed = 0, paid = 0;
    db.purchase_orders.filter(p => p.supplier === s.id && p.status !== 'cancelled').sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach(p => {
      run += num(p.total_amount); owed += num(p.total_amount);
      entries.push({ id: 'i' + p.id, date: dayOf(p.created_at), type: 'invoice', description: 'Purchase order', reference: p.po_number, amount: p.total_amount, remaining: round2(run) });
      if (num(p.paid_amount) > 0) {
        run -= num(p.paid_amount); paid += num(p.paid_amount);
        entries.push({ id: 'p' + p.id, date: dayOf(p.created_at), type: 'payment', description: 'Payment to supplier', reference: p.po_number, amount: p.paid_amount, remaining: round2(run) });
      }
    });
    return { amount_owed: round2(owed), total_paid: round2(paid), remaining: round2(Math.max(0, owed - paid)), entries };
  });

  crud('routes', 'routes', { label: 'Route', search: ['name', 'person', 'area'], defaults: () => ({ status: 'Active', days: [], supplier_names: [], notes: '' }) });

  // ═════════ SALES / POS ═════════
  const saleSearch = ['invoice_number', 'customer_name', 'customer_account_no', 'served_by_name', 'notes'];
  route('GET', 'sales', (ctx) => listResponse(db.sales, ctx.q, {
    search: saleSearch, filters: ['status', 'customer', 'warehouse'], ordering: '-created_at',
    extra: (items, q) => {
      let out = items;
      if (q.date_from) out = out.filter(s => dayOf(s.created_at) >= q.date_from);
      if (q.date_to) out = out.filter(s => dayOf(s.created_at) <= q.date_to);
      if (q.created_after) out = out.filter(s => new Date(s.created_at) >= new Date(q.created_after));
      if (q.created_before) out = out.filter(s => new Date(s.created_at) <= new Date(q.created_before));
      if (q.payment_status) out = out.filter(s => s.payment_status === q.payment_status);
      return out;
    },
  }));
  route('GET', 'sales/returns', (ctx) => paginate(db.sales.filter(s => s.status === 'returned' || s.status === 'partially_returned'), ctx.q));
  route('GET', 'sales/coupons', () => []);
  route('GET', 'sales/(\\d+)', (ctx) => {
    const s = db.sales.find(x => x.id === Number(ctx.m[1]));
    if (!s) throw notFound('Sale');
    return s;
  });

  function stockCheck(items) {
    items.forEach(it => {
      const p = db.products.find(x => x.id === it.product);
      if (p && num(p.current_stock) < it.quantity) throw badReq('Insufficient stock for ' + p.name + ' (available: ' + p.current_stock + ').');
    });
  }
  function applyStock(sale, sign) {
    sale.items.forEach(it => moveStock(it.product, sign * it.quantity, sign < 0 ? 'sale' : 'sale_return', sale.invoice_number));
  }
  function validateSalePayload(b) {
    if (!b || !Array.isArray(b.items) || !b.items.length) throw badReq('Items: Add at least one product.');
  }

  route('POST', 'sales', (ctx) => {
    validateSalePayload(ctx.body);
    const sale = buildSale(Object.assign({}, ctx.body, { served_by_name: demoUser().full_name }));
    stockCheck(sale.items);
    applyStock(sale, -1);
    refreshSale(sale);
    db.sales.push(sale); recalc(); save();
    return sale;
  });
  route('POST', 'sales/hold', (ctx) => {
    validateSalePayload(ctx.body);
    const sale = buildSale(Object.assign({}, ctx.body, { status: 'draft', served_by_name: demoUser().full_name }));
    db.sales.push(sale); save();
    return sale;
  });
  route('PATCH', 'sales/(\\d+)/hold', (ctx) => {
    const s = db.sales.find(x => x.id === Number(ctx.m[1]));
    if (!s) throw notFound('Sale');
    const fresh = buildSale(Object.assign({}, ctx.body, { status: 'draft' }));
    db.seq.sales -= 1;
    Object.assign(s, { items: fresh.items, subtotal: fresh.subtotal, tax_amount: fresh.tax_amount, discount_amount: fresh.discount_amount,
      total_amount: fresh.total_amount, customer: fresh.customer, customer_name: fresh.customer_name, customer_account_no: fresh.customer_account_no,
      customer_address: fresh.customer_address, notes: fresh.notes });
    refreshSale(s); save();
    return s;
  });
  route('POST', 'sales/(\\d+)/finalize', (ctx) => {
    const s = db.sales.find(x => x.id === Number(ctx.m[1]));
    if (!s) throw notFound('Sale');
    if (s.status !== 'draft') throw badReq('Only held invoices can be finalized.');
    stockCheck(s.items);
    s.status = 'completed'; s.is_credit_sale = !!(ctx.body && ctx.body.is_credit_sale);
    s.created_at = iso(new Date());
    applyStock(s, -1); refreshSale(s); recalc(); save();
    return s;
  });
  route('PATCH', 'sales/(\\d+)/edit', (ctx) => {
    const s = db.sales.find(x => x.id === Number(ctx.m[1]));
    if (!s) throw notFound('Sale');
    validateSalePayload(ctx.body);
    applyStock(s, +1);
    const fresh = buildSale(Object.assign({}, ctx.body));
    db.seq.sales -= 1;
    try { stockCheck(fresh.items); } catch (e) { applyStock(s, -1); throw e; }
    Object.assign(s, { items: fresh.items, subtotal: fresh.subtotal, tax_amount: fresh.tax_amount, discount_amount: fresh.discount_amount,
      total_amount: fresh.total_amount, customer: fresh.customer, customer_name: fresh.customer_name, customer_account_no: fresh.customer_account_no,
      customer_address: fresh.customer_address, notes: fresh.notes, status: 'edited', updated_at: iso(new Date()) });
    if (ctx.body.is_credit_sale !== undefined) s.is_credit_sale = !!ctx.body.is_credit_sale;
    applyStock(s, -1); refreshSale(s); recalc(); save();
    return Object.assign({}, s, { edit_unchanged: false });
  });
  route('POST', 'sales/(\\d+)/pay', (ctx) => {
    const s = db.sales.find(x => x.id === Number(ctx.m[1]));
    if (!s) throw notFound('Sale');
    const amt = num(ctx.body && ctx.body.amount);
    if (amt <= 0) throw badReq('Amount: Must be greater than zero.');
    addPayment(s, Math.min(amt, Math.max(amt, 0)), (ctx.body && ctx.body.method) || 'cash');
    recalc(); save();
    return s;
  });
  route('POST', 'sales/(\\d+)/return', (ctx) => {
    const s = db.sales.find(x => x.id === Number(ctx.m[1]));
    if (!s) throw notFound('Sale');
    if (s.status === 'returned') throw badReq('This sale is already returned.');
    applyStock(s, +1);
    s.status = 'returned'; refreshSale(s); recalc(); save();
    return s;
  });
  route('POST', 'sales/(\\d+)/void', (ctx) => {
    const s = db.sales.find(x => x.id === Number(ctx.m[1]));
    if (!s) throw notFound('Sale');
    if (!['draft', 'returned'].includes(s.status)) applyStock(s, +1);
    db.sales = db.sales.filter(x => x !== s); recalc(); save();
    return { detail: 'Invoice voided' };
  });
  route('DELETE', 'sales/(\\d+)', (ctx) => {
    const s = db.sales.find(x => x.id === Number(ctx.m[1]));
    if (!s) throw notFound('Sale');
    if (!['draft', 'returned'].includes(s.status)) applyStock(s, +1);
    db.sales = db.sales.filter(x => x !== s); recalc(); save();
    return null;
  });
  route('PATCH', 'sales/payments/(\\d+)', (ctx) => {
    for (const s of db.sales) {
      const p = s.payments.find(x => x.id === Number(ctx.m[1]));
      if (p) { Object.assign(p, ctx.body || {}); refreshSale(s); recalc(); save(); return p; }
    }
    throw notFound('Payment');
  });
  route('DELETE', 'sales/payments/(\\d+)', (ctx) => {
    for (const s of db.sales) {
      const i = s.payments.findIndex(x => x.id === Number(ctx.m[1]));
      if (i >= 0) { s.payments.splice(i, 1); refreshSale(s); recalc(); save(); return null; }
    }
    throw notFound('Payment');
  });

  // ═════════ PURCHASING ═════════
  route('GET', 'purchase-orders', (ctx) => listResponse(db.purchase_orders, ctx.q, {
    search: ['po_number', 'supplier_name'], filters: ['supplier', 'status'], ordering: '-created_at',
  }));
  route('GET', 'purchase-orders/returns', (ctx) => paginate([], ctx.q));
  route('GET', 'purchase-orders/(\\d+)', (ctx) => {
    const p = db.purchase_orders.find(x => x.id === Number(ctx.m[1]));
    if (!p) throw notFound('Purchase order');
    return p;
  });
  route('POST', 'purchase-orders', (ctx) => {
    const b = ctx.body || {};
    const sup = db.suppliers.find(s => s.id === Number(b.supplier));
    if (!sup) throw badReq('Supplier: Select a supplier.');
    if (!Array.isArray(b.items) || !b.items.length) throw badReq('Items: Add at least one product.');
    const items = b.items.map((it, i) => {
      const p = db.products.find(x => x.id === Number(it.product));
      if (!p) throw badReq('Product not found');
      const cost = it.unit_cost !== undefined ? num(it.unit_cost) : num(it.unit_price !== undefined ? it.unit_price : p.cost_price);
      return { id: i + 1, product: p.id, product_name: p.name, quantity: num(it.quantity), unit_cost: cost, line_total: round2(num(it.quantity) * cost) };
    });
    const total = round2(items.reduce((s, i) => s + i.line_total, 0));
    const id = nextId('purchase_orders');
    const po = {
      id, po_number: 'PO-' + String(id).padStart(5, '0'), supplier: sup.id, supplier_name: sup.name, status: 'pending',
      total_amount: total, paid_amount: 0, warehouse: b.warehouse || 1, notes: b.notes || '', items, created_at: iso(new Date()),
    };
    db.purchase_orders.push(po); recalc(); save();
    return po;
  });
  route('POST', 'purchase-orders/(\\d+)/receive', (ctx) => {
    const p = db.purchase_orders.find(x => x.id === Number(ctx.m[1]));
    if (!p) throw notFound('Purchase order');
    if (p.status === 'received') throw badReq('This purchase order is already received.');
    p.items.forEach(it => moveStock(it.product, +it.quantity, 'purchase', p.po_number));
    p.status = 'received'; recalc(); save();
    return p;
  });
  route('POST', 'purchase-orders/(\\d+)/pay', (ctx) => {
    const p = db.purchase_orders.find(x => x.id === Number(ctx.m[1]));
    if (!p) throw notFound('Purchase order');
    p.paid_amount = round2(Math.min(num(p.total_amount), num(p.paid_amount) + num(ctx.body && ctx.body.amount)));
    recalc(); save();
    return p;
  });
  route('POST', 'purchase-orders/(\\d+)/return', (ctx) => {
    const p = db.purchase_orders.find(x => x.id === Number(ctx.m[1]));
    if (!p) throw notFound('Purchase order');
    if (p.status === 'received') p.items.forEach(it => moveStock(it.product, -it.quantity, 'stock_out', p.po_number));
    p.status = 'cancelled'; recalc(); save();
    return p;
  });

  // ═════════ MONEY ═════════
  crud('expenses', 'expenses', {
    label: 'Expense', search: ['description', 'category_name'], ordering: '-expense_date', filters: ['category'],
    defaults: () => ({ payment_method: 'cash', expense_date: ymd(new Date()) }),
    beforeSave: e => {
      e.amount = num(e.amount);
      const c = db.expense_categories.find(x => x.id === Number(e.category));
      e.category_name = c ? c.name : (e.category_name || '');
    },
  });
  route('GET', 'expenses/categories', () => db.expense_categories);
  route('POST', 'expenses/categories', (ctx) => {
    const rec = { id: nextId('expense_categories'), name: (ctx.body && ctx.body.name) || 'Other', is_active: true };
    db.expense_categories.push(rec); save();
    return rec;
  });
  const inRange = (day, q) => (!q.date_from || day >= q.date_from) && (!q.date_to || day <= q.date_to);
  route('GET', 'expenses/summary', (ctx) => {
    const list = db.expenses.filter(e => inRange(e.expense_date, ctx.q));
    const by = {};
    list.forEach(e => { by[e.category_name || 'Other'] = (by[e.category_name || 'Other'] || 0) + num(e.amount); });
    return {
      total: round2(list.reduce((t, e) => t + num(e.amount), 0)), count: list.length,
      by_category: Object.keys(by).map(k => ({ category__name: k, total: round2(by[k]) })),
    };
  });

  const liveSales = q => db.sales.filter(s => !['draft', 'returned', 'cancelled'].includes(s.status) && inRange(dayOf(s.created_at), q || {}));
  function plNumbers(q) {
    const sales = liveSales(q);
    const income = sales.reduce((t, s) => t + num(s.total_amount), 0);
    const cogs = sales.reduce((t, s) => t + s.items.reduce((x, i) => x + num(i.quantity) * num(i.cost_price), 0), 0);
    const expenses = db.expenses.filter(e => inRange(e.expense_date, q || {})).reduce((t, e) => t + num(e.amount), 0);
    return { income: round2(income), cost_of_goods_sold: round2(cogs), gross_profit: round2(income - cogs), expenses: round2(expenses), net_profit: round2(income - cogs - expenses) };
  }
  route('GET', 'finance/profit-loss', (ctx) => plNumbers(ctx.q));
  route('GET', 'finance/cash-flow', (ctx) => {
    const sales = liveSales(ctx.q);
    const cashIn = sales.reduce((t, s) => t + num(s.paid_amount), 0);
    const cashOut = db.expenses.filter(e => inRange(e.expense_date, ctx.q || {})).reduce((t, e) => t + num(e.amount), 0) +
      db.purchase_orders.reduce((t, p) => t + num(p.paid_amount), 0);
    return { cash_in: round2(cashIn), cash_out: round2(cashOut), net_cash_flow: round2(cashIn - cashOut) };
  });

  // ═════════ INSIGHTS ═════════
  route('GET', 'dashboard/summary', () => {
    const today = ymd(new Date());
    const todays = liveSales({ date_from: today, date_to: today });
    const from = ymd(daysAgo(30, 0, 0));
    const agg = {};
    liveSales({ date_from: from }).forEach(s => s.items.forEach(i => { agg[i.product_name] = (agg[i.product_name] || 0) + num(i.quantity); }));
    return {
      today_sales: round2(todays.reduce((t, s) => t + num(s.total_amount), 0)),
      today_orders_count: todays.length,
      total_customers: db.customers.length,
      total_products: db.products.length,
      low_stock_items: db.products.filter(p => num(p.current_stock) <= num(p.reorder_level)).map(p => ({
        product_id: p.id, product_name: p.name, sku: p.sku, warehouse: 'Main Store', quantity: num(p.current_stock), reorder_level: num(p.reorder_level),
      })),
      top_selling_products: Object.keys(agg).map(k => ({ product__name: k, total_quantity: agg[k] })).sort((a, b) => b.total_quantity - a.total_quantity).slice(0, 5),
    };
  });
  route('GET', 'dashboard/charts/sales', (ctx) => {
    const days = Math.max(1, parseInt(ctx.q.days, 10) || 30);
    const by = {};
    liveSales({ date_from: ymd(daysAgo(days, 0, 0)) }).forEach(s => {
      const d = dayOf(s.created_at);
      by[d] = by[d] || { day: d, total: 0, orders: 0 };
      by[d].total = round2(by[d].total + num(s.total_amount)); by[d].orders += 1;
    });
    return { series: Object.keys(by).sort().map(k => by[k]) };
  });

  // reports ─ rows are flat objects of display strings (the table derives its columns from the first row)
  route('GET', 'reports/([a-z_-]+)', (ctx) => {
    const slug = ctx.m[1], q = ctx.q;
    if (q.format && q.format !== 'json') return { results: [] };
    let rows = [];
    switch (slug) {
      case 'sales':
        rows = liveSales(q).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map(s => ({
          invoice: s.invoice_number, date: dayOf(s.created_at), customer: s.customer_name || 'Walk-in', items: String(s.items.length),
          subtotal: fmt(s.subtotal), tax: fmt(s.tax_amount), discount: fmt(s.discount_amount), total: fmt(s.total_amount),
          paid: fmt(s.paid_amount), balance: fmt(s.due_amount), status: s.payment_status,
        }));
        break;
      case 'inventory':
        rows = db.products.map(p => ({
          product: p.name, sku: p.sku, category: (db.categories.find(c => c.id === p.category) || {}).name || '', stock: String(p.current_stock),
          cost_price: fmt(p.cost_price), selling_price: fmt(p.selling_price), stock_value: fmt(p.current_stock * p.cost_price),
        }));
        break;
      case 'purchase':
        rows = db.purchase_orders.filter(p => inRange(dayOf(p.created_at), q)).map(p => ({
          po_number: p.po_number, date: dayOf(p.created_at), supplier: p.supplier_name, status: p.status, total: fmt(p.total_amount), paid: fmt(p.paid_amount),
        }));
        break;
      case 'expenses':
        rows = db.expenses.filter(e => inRange(e.expense_date, q)).map(e => ({ date: e.expense_date, category: e.category_name, description: e.description, amount: fmt(e.amount) }));
        break;
      case 'customers':
        rows = db.customers.map(c => ({ account: c.account_no, name: c.name, phone: c.phone, address: c.address, balance: fmt(c.outstanding_balance) }));
        break;
      case 'suppliers':
        rows = db.suppliers.map(s => ({ name: s.name, phone: s.phone, address: s.address, payable: fmt(s.outstanding_payable) }));
        break;
      case 'tax':
        rows = liveSales(q).filter(s => num(s.tax_amount) > 0).map(s => ({
          invoice: s.invoice_number, date: dayOf(s.created_at), customer: s.customer_name || 'Walk-in', taxable_amount: fmt(s.subtotal), tax: fmt(s.tax_amount),
        }));
        break;
      case 'profit': {
        const n = plNumbers(q);
        const pct = v => (n.income > 0 ? (v / n.income * 100).toFixed(1) : '0.0') + '%';
        const exp = {};
        db.expenses.filter(e => inRange(e.expense_date, q)).forEach(e => { exp[e.category_name || 'Other'] = (exp[e.category_name || 'Other'] || 0) + num(e.amount); });
        rows = [
          { kind: 'heading_u', description: 'Revenue' },
          { kind: 'line', code: '4000', description: 'Sales revenue', amount: fmt(n.income), percent: '100.0%' },
          { kind: 'spacer' },
          { kind: 'heading_u', description: 'Cost of goods sold' },
          { kind: 'line', code: '5000', description: 'Cost of goods sold', amount: fmt(n.cost_of_goods_sold), percent: pct(n.cost_of_goods_sold) },
          { kind: 'total', description: 'Gross profit', amount: fmt(n.gross_profit), percent: pct(n.gross_profit) },
          { kind: 'spacer' },
          { kind: 'heading_u', description: 'Operating expenses' },
        ].concat(Object.keys(exp).map((k, i) => ({ kind: 'line', code: String(6000 + i * 10), description: k, amount: fmt(exp[k]), percent: pct(exp[k]) })))
         .concat([
          { kind: 'subtotal', description: 'Total expenses', amount: fmt(n.expenses), percent: pct(n.expenses) },
          { kind: 'spacer' },
          { kind: 'total', description: 'Net profit', amount: fmt(n.net_profit), percent: pct(n.net_profit) },
        ]);
        break;
      }
      default: rows = [];
    }
    return { count: rows.length, results: rows };
  });

  // ═════════ NOTIFICATIONS / AUDIT / BACKUPS ═════════
  route('GET', 'notifications', () => []);
  route('GET', 'notifications/unread-count', () => ({ count: 0, unread_count: 0 }));
  route('POST', 'notifications/.*', () => ({}));
  route('GET', 'audit-logs', (ctx) => paginate([], ctx.q));
  route('GET', 'backups', () => []);
  route('POST', 'backups/run', () => ({ detail: 'Backups are disabled in demo mode.' }));

  // ── dispatcher ───────────────────────────────────────────────
  async function handle(method, rawPath, body) {
    if (!db) load();
    method = String(method || 'GET').toUpperCase();
    const qi = String(rawPath).indexOf('?');
    const pathOnly = qi < 0 ? rawPath : rawPath.slice(0, qi);
    const q = parseQuery(qi < 0 ? '' : rawPath.slice(qi + 1));
    const path = pathOnly.replace(/^\/+|\/+$/g, '');
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(path);
      if (!m) continue;
      const out = await r.handler({ m, q, body });
      return out === undefined ? null : clone(out);
    }
    // Unknown endpoint: safe empty answer instead of an error toast.
    if (method === 'GET') return { count: 0, total_pages: 1, current_page: 1, next: null, previous: null, results: [] };
    return Object.assign({ id: Date.now() }, (body && typeof body === 'object' && !(typeof FormData !== 'undefined' && body instanceof FormData)) ? body : {});
  }

  // Simple placeholder barcode / QR images (SVG data URLs) so the product label screens work offline.
  function svgUrl(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  function barcodeImage(id) {
    if (!db) load();
    const p = db.products.find(x => x.id === Number(id));
    const code = String((p && p.barcode) || id);
    let x = 10, bars = '';
    for (let i = 0; i < code.length; i++) {
      const d = Number(code[i]) || 0;
      [1 + (d % 3), 1 + ((d * 7) % 2), 1 + ((d + 1) % 3)].forEach((w, k) => {
        if (k % 2 === 0) bars += '<rect x="' + x + '" y="8" width="' + w + '" height="60" fill="#000"/>';
        x += w + 1;
      });
    }
    return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="' + (x + 10) + '" height="92"><rect width="100%" height="100%" fill="#fff"/>' + bars +
      '<text x="' + (x + 10) / 2 + '" y="86" font-family="monospace" font-size="12" text-anchor="middle">' + code + '</text></svg>');
  }
  function qrImage(id) {
    if (!db) load();
    const p = db.products.find(x => x.id === Number(id));
    const rnd = mulberry(Number(id) * 7919 + String((p && p.sku) || '').length);
    const n = 21, s = 6;
    let cells = '';
    const finder = (ox, oy) => '<rect x="' + ox * s + '" y="' + oy * s + '" width="' + 7 * s + '" height="' + 7 * s + '" fill="#000"/><rect x="' + (ox + 1) * s + '" y="' + (oy + 1) * s + '" width="' + 5 * s + '" height="' + 5 * s + '" fill="#fff"/><rect x="' + (ox + 2) * s + '" y="' + (oy + 2) * s + '" width="' + 3 * s + '" height="' + 3 * s + '" fill="#000"/>';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const inFinder = (r < 8 && c < 8) || (r < 8 && c > n - 9) || (r > n - 9 && c < 8);
      if (!inFinder && rnd() > 0.5) cells += '<rect x="' + c * s + '" y="' + r * s + '" width="' + s + '" height="' + s + '" fill="#000"/>';
    }
    return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="' + n * s + '" height="' + n * s + '"><rect width="100%" height="100%" fill="#fff"/>' + cells + finder(0, 0) + finder(n - 7, 0) + finder(0, n - 7) + '</svg>');
  }

  window.DemoBackend = {
    handle, barcodeImage, qrImage,
    ApiError,
    reset() { try { localStorage.removeItem(STORE_KEY); } catch (_) {} db = null; location.reload(); },
    get db() { if (!db) load(); return db; },
  };
})();
