// ========== STATE ==========
const API = '';
let token = localStorage.getItem('uzum_token');
let user = null;
let currentProductPage = 1;
let currentOrderPage = 1;

// ========== TOAST ==========
function showToast(msg, duration = 2000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show';
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.className = 'toast', duration);
}

// ========== PAGE MANAGEMENT ==========
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

// ========== MODAL ==========
function showModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function showRecharge() { 
  document.getElementById('recharge-amount').value = '';
  document.getElementById('recharge-result').textContent = '';
  document.getElementById('recharge-result').className = 'modal-result';
  showModal('recharge-modal');
}
function showWithdraw() {
  document.getElementById('withdraw-balance').textContent = `$${(user?.balance || 0).toFixed(2)}`;
  document.getElementById('withdraw-amount').value = '';
  document.getElementById('withdraw-result').textContent = '';
  document.getElementById('withdraw-result').className = 'modal-result';
  showModal('withdraw-modal');
}

// Quick amounts
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('quick-amount')) {
    document.getElementById('recharge-amount').value = e.target.dataset.amount;
  }
});

// ========== TAB NAVIGATION ==========
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const tab = item.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    // Refresh data
    if (tab === 'home') loadHome();
    if (tab === 'products') loadProducts(1);
    if (tab === 'orders') loadOrders(1);
    if (tab === 'wallet') loadWallet();
    if (tab === 'profile') loadProfile();
  });
});

// ========== LOGIN TABS ==========
document.querySelectorAll('.login-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
    document.getElementById(tab.dataset.tab + '-form').classList.add('active');
  });
});

// ========== API HELPERS ==========
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ========== AUTH ==========
// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  
  try {
    const data = await api('/api/user/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    token = data.token;
    user = data.user;
    localStorage.setItem('uzum_token', token);
    enterApp();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

// Register
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('reg-username').value;
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  const errEl = document.getElementById('reg-error');
  
  if (password !== confirm) {
    errEl.textContent = 'Passwords do not match';
    return;
  }
  
  try {
    await api('/api/user/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    // Switch to login tab
    document.querySelectorAll('.login-tab')[0].click();
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').value = '';
    errEl.textContent = '';
    showToast('Account created! Sign in now.');
  } catch (err) {
    errEl.textContent = err.message;
  }
});

// ========== ENTER APP ==========
function enterApp() {
  document.getElementById('header-welcome').textContent = `Hi, ${user.username}`;
  document.getElementById('header-vip').textContent = `VIP ${user.vip_level}`;
  showPage('page-app');
  loadHome();
}

// ========== LOGOUT ==========
function logout() {
  localStorage.removeItem('uzum_token');
  token = null;
  user = null;
  showPage('page-login');
}

// ========== CHECK AUTH ==========
if (token) {
  api('/api/user/info').then(data => {
    user = data;
    enterApp();
  }).catch(() => {
    localStorage.removeItem('uzum_token');
    token = null;
  });
}

// ========== HOME ==========
async function loadHome() {
  try {
    const data = await api('/api/home');
    renderVipCards(data.vip_levels);
    renderCommissionScroll(data.commissions.slice(0, 15));
    renderHomeProducts(data.new_products);
  } catch (err) {
    console.error('Home load failed', err);
  }
}

function renderVipCards(levels) {
  const container = document.getElementById('vip-cards');
  container.innerHTML = levels.map(l => `
    <div class="vip-card ${user && l.level === user.vip_level ? 'vip-active' : ''}">
      <div class="vip-card-level">VIP ${l.level}</div>
      <div class="vip-card-orders">${l.order_limit} orders/day</div>
      ${l.upgrade_price > 0 ? `<div class="vip-card-price">$${l.upgrade_price}</div>` : '<div class="vip-card-price">Free</div>'}
    </div>
  `).join('');
}

function renderCommissionScroll(commissions) {
  const container = document.getElementById('comm-scroll');
  container.innerHTML = commissions.map(c => `
    <div class="comm-item">
      <span class="comm-user">${c.username_display}</span>
      <span class="comm-amount">+$${c.amount.toFixed(2)}</span>
    </div>
  `).join('');
}

function renderHomeProducts(products) {
  const container = document.getElementById('home-products');
  container.innerHTML = products.map(p => `
    <div class="product-card">
      <div class="product-image">${p.image}</div>
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-price">$${p.price.toLocaleString()}</div>
      </div>
    </div>
  `).join('');
}

// ========== PRODUCTS ==========
async function loadProducts(page = 1) {
  try {
    const data = await api(`/api/products?page=${page}&limit=20`);
    currentProductPage = page;
    
    const container = document.getElementById('all-products');
    
    if (page === 1) {
      container.innerHTML = '';
    }
    
    container.innerHTML += data.products.map(p => `
      <div class="product-card">
        <div class="product-image">${p.image}</div>
        <div class="product-info">
          <div class="product-name">${p.name}</div>
          <div class="product-price">$${p.price.toLocaleString()}</div>
          <button class="product-grab-btn" onclick="grabOrder(${p.id}, this)">⚡ Grab</button>
        </div>
      </div>
    `).join('');

    // Show/hide load more button
    const loadMore = document.getElementById('load-more-products');
    if (page < data.totalPages) {
      loadMore.style.display = 'block';
      loadMore.querySelector('button').onclick = () => loadProducts(page + 1);
    } else {
      loadMore.style.display = 'none';
    }

    // Update daily count
    if (user) {
      updateDailyCount();
    }
  } catch (err) {
    console.error('Products load failed', err);
  }
}

async function updateDailyCount() {
  try {
    const data = await api('/api/user/info');
    const limit = data.vip_info?.order_limit || 5;
    document.getElementById('daily-count').textContent = `Today: ${data.today_orders}/${limit}`;
  } catch (err) {}
}

// ========== GRAB ORDER ==========
async function grabOrder(productId, btn) {
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '⏳';
  
  try {
    const data = await api('/api/order/grab', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId })
    });
    showToast(`✅ ${data.message} ($${data.commission.toFixed(2)})`);
    // Update balance
    const info = await api('/api/user/info');
    user = { ...user, balance: info.balance, total_commission: info.total_commission, vip_level: info.vip_level };
    updateDailyCount();
    btn.textContent = '✅ Done';
    btn.style.background = '#10B981';
  } catch (err) {
    showToast('❌ ' + err.message);
    btn.disabled = false;
    btn.textContent = '⚡ Grab';
  }
}

// ========== ORDERS ==========
async function loadOrders(page = 1) {
  try {
    const data = await api(`/api/orders?page=${page}&limit=20`);
    currentOrderPage = page;
    
    const container = document.getElementById('order-list');
    const emptyEl = document.getElementById('empty-orders');
    const loadMore = document.getElementById('load-more-orders');
    
    if (page === 1) {
      container.innerHTML = '';
    }
    
    if (data.orders.length === 0) {
      emptyEl.style.display = 'block';
      loadMore.style.display = 'none';
      return;
    }
    
    emptyEl.style.display = 'none';
    
    container.innerHTML += data.orders.map(o => `
      <div class="order-item">
        <div class="order-image">${o.product_image}</div>
        <div class="order-details">
          <div class="order-product">${o.product_name}</div>
          <div class="order-date">${new Date(o.created_at).toLocaleString()}</div>
        </div>
        <div class="order-commission">+$${o.commission.toFixed(2)}</div>
      </div>
    `).join('');

    if (page < data.totalPages) {
      loadMore.style.display = 'block';
      loadMore.querySelector('button').onclick = () => loadOrders(page + 1);
    } else {
      loadMore.style.display = 'none';
    }
  } catch (err) {
    console.error('Orders load failed', err);
  }
}

// ========== WALLET ==========
function loadWallet() {
  if (!user) return;
  document.getElementById('wallet-balance').textContent = `$${(user.balance || 0).toFixed(2)}`;
  document.getElementById('wallet-total-commission').textContent = `$${(user.total_commission || 0).toFixed(2)}`;
  document.getElementById('ref-code').textContent = user.ext_code || 'N/A';
  document.getElementById('ref-code').onclick = () => {
    navigator.clipboard.writeText(user.ext_code || '');
    showToast('📋 Copied!');
  };
}

// ========== RECHARGE ==========
async function doRecharge() {
  const amount = parseFloat(document.getElementById('recharge-amount').value);
  const resultEl = document.getElementById('recharge-result');
  
  if (!amount || amount <= 0) {
    resultEl.textContent = 'Please enter a valid amount';
    resultEl.className = 'modal-result error';
    return;
  }
  
  try {
    const data = await api('/api/recharge', {
      method: 'POST',
      body: JSON.stringify({ amount })
    });
    resultEl.textContent = `✅ ${data.message}`;
    resultEl.className = 'modal-result success';
    
    // Update balance
    const info = await api('/api/user/info');
    user = { ...user, balance: info.balance };
    loadWallet();
    
    setTimeout(() => closeModal('recharge-modal'), 1500);
  } catch (err) {
    resultEl.textContent = '❌ ' + err.message;
    resultEl.className = 'modal-result error';
  }
}

// ========== WITHDRAW ==========
async function doWithdraw() {
  const amount = parseFloat(document.getElementById('withdraw-amount').value);
  const resultEl = document.getElementById('withdraw-result');
  
  if (!amount || amount <= 0) {
    resultEl.textContent = 'Please enter a valid amount';
    resultEl.className = 'modal-result error';
    return;
  }
  
  if (amount > (user.balance || 0)) {
    resultEl.textContent = 'Insufficient balance';
    resultEl.className = 'modal-result error';
    return;
  }
  
  try {
    const data = await api('/api/withdrawal', {
      method: 'POST',
      body: JSON.stringify({ amount })
    });
    resultEl.textContent = `✅ ${data.message}`;
    resultEl.className = 'modal-result success';
    
    // Update balance
    const info = await api('/api/user/info');
    user = { ...user, balance: info.balance };
    loadWallet();
    
    setTimeout(() => closeModal('withdraw-modal'), 1500);
  } catch (err) {
    resultEl.textContent = '❌ ' + err.message;
    resultEl.className = 'modal-result error';
  }
}

// ========== PROFILE ==========
function loadProfile() {
  if (!user) return;
  document.getElementById('profile-username').textContent = user.username;
  document.getElementById('profile-vip').textContent = `VIP ${user.vip_level}`;
  document.getElementById('profile-orders').textContent = user.today_orders || '0';
  document.getElementById('profile-balance').textContent = `$${(user.balance || 0).toFixed(0)}`;
  document.getElementById('profile-earnings').textContent = `$${(user.total_commission || 0).toFixed(0)}`;
}
