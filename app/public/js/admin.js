const API = '/api';
let token = localStorage.getItem('admin_token');
let currentClientId = null;

// ── AUTH ───────────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  opts.headers = { ...(opts.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': opts.body instanceof FormData ? undefined : 'application/json' };
  if (opts.body instanceof FormData) delete opts.headers['Content-Type'];
  const res = await fetch(url, opts);
  if (res.status === 401) { logout(); return; }
  return res;
}

function logout() {
  localStorage.removeItem('admin_token');
  token = null;
  document.getElementById('panel').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

// ── LOGIN ──────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('login-error');
  err.textContent = '';
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: document.getElementById('login-user').value, password: document.getElementById('login-pass').value }),
  });
  const data = await res.json();
  if (!res.ok) { err.textContent = data.error || 'Erro ao entrar'; return; }
  token = data.token;
  localStorage.setItem('admin_token', token);
  showPanel();
});

document.getElementById('logout-btn').addEventListener('click', logout);

function showPanel() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('panel').style.display = 'grid';
  loadClients();
}

// ── TABS ───────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const tab = document.getElementById(`tab-${btn.dataset.tab}`);
    tab.classList.add('active');
    if (btn.dataset.tab === 'portfolio') loadPortfolio();
    if (btn.dataset.tab === 'textos') loadTexts();
  });
});

// ── CLIENTES ───────────────────────────────────────────────
async function loadClients() {
  const res = await apiFetch(`${API}/admin/clients`);
  if (!res) return;
  const clients = await res.json();
  const tbody = document.getElementById('clients-tbody');
  tbody.innerHTML = '';

  if (!clients.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">Nenhum cliente cadastrado</td></tr>';
    return;
  }

  clients.forEach(c => {
    const expired = new Date(c.expires_at) < new Date();
    const expires = new Date(c.expires_at).toLocaleDateString('pt-BR');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.name}</td>
      <td><code style="font-size:0.8rem;opacity:0.7">${c.slug}</code></td>
      <td>${c.photo_count}</td>
      <td>
        <span class="badge ${expired ? 'expired' : 'active'}">${expires}</span>
      </td>
      <td>
        <a href="/cliente/${c.slug}" target="_blank" style="font-size:0.75rem;opacity:0.6;">/cliente/${c.slug}</a>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-sm" onclick="openPhotosModal(${c.id}, '${c.name}')">Fotos</button>
          <button class="btn btn-ghost btn-sm" onclick="editClient(${c.id})">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteClient(${c.id}, '${c.name}')">Remover</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Modal novo/editar cliente
document.getElementById('new-client-btn').addEventListener('click', () => openClientModal());
document.getElementById('modal-close').addEventListener('click', closeClientModal);
document.getElementById('modal-cancel').addEventListener('click', closeClientModal);
document.getElementById('client-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeClientModal(); });

function openClientModal(data = null) {
  document.getElementById('modal-title').textContent = data ? 'Editar cliente' : 'Novo cliente';
  document.getElementById('edit-client-id').value = data?.id || '';
  document.getElementById('cf-name').value = data?.name || '';
  document.getElementById('cf-slug').value = data?.slug || '';
  document.getElementById('cf-pass').value = '';
  document.getElementById('cf-expires').value = data?.expires_at?.split('T')[0] || '';
  document.getElementById('pass-hint').textContent = data ? '(deixe em branco para manter)' : '(obrigatória)';
  document.getElementById('cf-error').textContent = '';
  document.getElementById('client-modal').classList.add('active');
  document.getElementById('cf-name').focus();
}

function closeClientModal() {
  document.getElementById('client-modal').classList.remove('active');
}

async function editClient(id) {
  const res = await apiFetch(`${API}/admin/clients`);
  if (!res) return;
  const clients = await res.json();
  const client = clients.find(c => c.id === id);
  if (client) openClientModal(client);
}

document.getElementById('client-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('cf-error');
  err.textContent = '';
  const id = document.getElementById('edit-client-id').value;
  const body = {
    name: document.getElementById('cf-name').value,
    slug: document.getElementById('cf-slug').value,
    password: document.getElementById('cf-pass').value,
    expires_at: document.getElementById('cf-expires').value,
  };
  if (!id && !body.password) { err.textContent = 'Senha obrigatória para novo cliente'; return; }

  const res = await apiFetch(`${API}/admin/clients${id ? '/' + id : ''}`, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) { err.textContent = data.error || 'Erro ao salvar'; return; }
  closeClientModal();
  loadClients();
});

async function deleteClient(id, name) {
  if (!confirm(`Remover cliente "${name}" e todas as fotos? Esta ação não pode ser desfeita.`)) return;
  await apiFetch(`${API}/admin/clients/${id}`, { method: 'DELETE' });
  loadClients();
}

// ── FOTOS DO CLIENTE ──────────────────────────────────────
document.getElementById('photos-modal-close').addEventListener('click', () => {
  document.getElementById('photos-modal').classList.remove('active');
});

document.getElementById('photos-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('photos-modal').classList.remove('active');
});

async function openPhotosModal(clientId, name) {
  currentClientId = clientId;
  document.getElementById('photos-modal-title').textContent = `Fotos — ${name}`;
  document.getElementById('photos-modal').classList.add('active');
  loadClientPhotos();
}

async function loadClientPhotos() {
  const res = await apiFetch(`${API}/admin/clients/${currentClientId}/photos`);
  if (!res) return;
  const photos = await res.json();
  const grid = document.getElementById('client-photos-grid');
  grid.innerHTML = '';

  if (!photos.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);padding:2rem;grid-column:1/-1">Nenhuma foto ainda</p>';
    return;
  }

  photos.forEach(p => {
    const item = document.createElement('div');
    item.className = 'photo-item';
    item.innerHTML = `
      <img src="/uploads/clients/${currentClientId}/thumb_${p.filename}" alt="${p.original_name}" loading="lazy">
      <div class="photo-item-actions">
        <button class="btn btn-danger btn-sm" onclick="deleteClientPhoto(${p.id}, this)">Remover</button>
      </div>
    `;
    grid.appendChild(item);
  });
}

async function deleteClientPhoto(photoId, btn) {
  if (!confirm('Remover esta foto?')) return;
  await apiFetch(`${API}/admin/clients/${currentClientId}/photos/${photoId}`, { method: 'DELETE' });
  loadClientPhotos();
}

document.getElementById('client-upload').addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files.length) return;
  const progress = document.getElementById('client-progress');
  const fill = document.getElementById('client-progress-fill');
  const text = document.getElementById('client-progress-text');
  progress.style.display = 'flex';

  const fd = new FormData();
  for (const f of files) fd.append('photos', f);

  const xhr = new XMLHttpRequest();
  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const pct = Math.round(e.loaded / e.total * 100);
      fill.style.width = pct + '%';
      text.textContent = `Enviando... ${pct}%`;
    }
  });
  xhr.addEventListener('load', () => {
    progress.style.display = 'none';
    fill.style.width = '0%';
    e.target.value = '';
    loadClientPhotos();
  });
  xhr.open('POST', `${API}/admin/clients/${currentClientId}/photos`);
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.send(fd);
});

// ── PORTFÓLIO ─────────────────────────────────────────────
async function loadPortfolio() {
  const res = await apiFetch(`${API}/admin/portfolio`);
  if (!res) return;
  const photos = await res.json();
  const grid = document.getElementById('portfolio-grid');
  grid.innerHTML = '';

  if (!photos.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);padding:2rem;grid-column:1/-1">Nenhuma foto no portfólio</p>';
    return;
  }

  photos.forEach(p => {
    const item = document.createElement('div');
    item.className = 'photo-item';
    item.setAttribute('data-id', p.id);
    item.innerHTML = `
      <img src="/uploads/portfolio/thumb_${p.filename}" alt="${p.original_name}" loading="lazy">
      <div class="photo-item-actions">
        <button class="btn btn-danger btn-sm" onclick="deletePortfolioPhoto(${p.id})">Remover</button>
      </div>
    `;
    grid.appendChild(item);
  });
}

async function deletePortfolioPhoto(id) {
  if (!confirm('Remover esta foto do portfólio?')) return;
  await apiFetch(`${API}/admin/portfolio/${id}`, { method: 'DELETE' });
  loadPortfolio();
}

document.getElementById('portfolio-upload').addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files.length) return;
  const progress = document.getElementById('portfolio-progress');
  const fill = document.getElementById('portfolio-progress-fill');
  const text = document.getElementById('portfolio-progress-text');
  progress.style.display = 'flex';

  const fd = new FormData();
  for (const f of files) fd.append('photos', f);

  const xhr = new XMLHttpRequest();
  xhr.upload.addEventListener('progress', (ev) => {
    if (ev.lengthComputable) {
      const pct = Math.round(ev.loaded / ev.total * 100);
      fill.style.width = pct + '%';
      text.textContent = `Enviando... ${pct}%`;
    }
  });
  xhr.addEventListener('load', () => {
    progress.style.display = 'none';
    fill.style.width = '0%';
    e.target.value = '';
    loadPortfolio();
  });
  xhr.open('POST', `${API}/admin/portfolio`);
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.send(fd);
});

// ── TEXTOS ────────────────────────────────────────────────
async function loadTexts() {
  const res = await apiFetch(`${API}/admin/texts`);
  if (!res) return;
  const texts = await res.json();
  const form = document.getElementById('texts-form');
  for (const [key, value] of Object.entries(texts)) {
    const el = form.elements[key];
    if (el) el.value = value;
  }
}

document.getElementById('save-texts-btn').addEventListener('click', async () => {
  const form = document.getElementById('texts-form');
  const data = {};
  for (const el of form.elements) {
    if (el.name) data[el.name] = el.value;
  }
  const res = await apiFetch(`${API}/admin/texts`, { method: 'PUT', body: JSON.stringify(data) });
  if (res?.ok) {
    const btn = document.getElementById('save-texts-btn');
    const orig = btn.textContent;
    btn.textContent = 'Salvo!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  }
});

// ── TROCAR SENHA ──────────────────────────────────────────
document.getElementById('change-pass-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('cp-error');
  const newPass = document.getElementById('cp-new').value;
  const confirm = document.getElementById('cp-confirm').value;
  err.textContent = '';
  if (newPass !== confirm) { err.textContent = 'Senhas não coincidem'; return; }

  const res = await apiFetch(`${API}/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword: document.getElementById('cp-current').value, newPassword: newPass }),
  });
  const data = await res.json();
  if (!res.ok) { err.textContent = data.error || 'Erro'; return; }
  err.style.color = 'var(--success)';
  err.textContent = 'Senha alterada com sucesso';
  e.target.reset();
  setTimeout(() => { err.textContent = ''; err.style.color = ''; }, 3000);
});

// ── INIT ──────────────────────────────────────────────────
if (token) showPanel();
