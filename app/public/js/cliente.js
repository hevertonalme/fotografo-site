const slug = location.pathname.split('/').pop();
let token = sessionStorage.getItem(`client_token_${slug}`);
let photos = [];
let lightboxIndex = 0;

// ── LOGIN ──────────────────────────────────────────────────
document.getElementById('client-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('client-error');
  err.textContent = '';
  const password = document.getElementById('client-pass').value;

  const res = await fetch('/api/client/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 403) showExpired();
    else err.textContent = data.error || 'Senha incorreta';
    return;
  }

  token = data.token;
  sessionStorage.setItem(`client_token_${slug}`, token);
  showArea(data.name, data.expires_at);
  loadPhotos();
});

// ── ÁREA DO CLIENTE ────────────────────────────────────────
function showArea(name, expiresAt) {
  document.getElementById('client-login').style.display = 'none';
  document.getElementById('client-area').style.display = 'block';
  document.getElementById('client-name').textContent = name;
  document.title = `Fotos de ${name}`;

  const expires = new Date(expiresAt);
  const now = new Date();
  const diff = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
  const dateStr = expires.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  document.getElementById('client-expires').textContent =
    diff > 0 ? `Disponível até ${dateStr} (${diff} dia${diff !== 1 ? 's' : ''})` : `Expira em ${dateStr}`;
}

function showExpired() {
  document.getElementById('client-login').style.display = 'none';
  document.getElementById('expired-screen').style.display = 'flex';
}

async function loadPhotos() {
  const res = await fetch('/api/client/photos', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    sessionStorage.removeItem(`client_token_${slug}`);
    if (res.status === 403) showExpired();
    return;
  }

  const data = await res.json();
  photos = data.photos;
  const grid = document.getElementById('client-grid');
  grid.innerHTML = '';

  if (!photos.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);padding:3rem;text-align:center;grid-column:1/-1">Suas fotos serão disponibilizadas em breve.</p>';
    return;
  }

  // Atualiza nome e expiração
  document.getElementById('client-name').textContent = data.name;

  photos.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'client-photo';
    item.innerHTML = `<img src="/uploads/clients/${getClientId()}/thumb_${p.filename}" alt="${p.original_name}" loading="lazy">`;
    item.addEventListener('click', () => openLightbox(i));
    grid.appendChild(item);
  });
}

function getClientId() {
  // O client_id está no token JWT (decodificado sem verificar — apenas para uso na URL de imagem)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id;
  } catch { return 0; }
}

// ── DOWNLOAD ───────────────────────────────────────────────
document.getElementById('download-btn').addEventListener('click', async () => {
  const btn = document.getElementById('download-btn');
  btn.textContent = 'Preparando...';
  btn.disabled = true;

  const res = await fetch('/api/client/download', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.error || 'Erro ao gerar download');
    btn.innerHTML = '<span>↓</span> Baixar todas as fotos';
    btn.disabled = false;
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fotos.zip';
  a.click();
  URL.revokeObjectURL(url);

  btn.innerHTML = '<span>↓</span> Baixar todas as fotos';
  btn.disabled = false;
});

// ── LIGHTBOX ───────────────────────────────────────────────
function openLightbox(index) {
  lightboxIndex = index;
  const clientId = getClientId();
  document.getElementById('lightbox-img').src = `/uploads/clients/${clientId}/${photos[index].filename}`;
  document.getElementById('lightbox').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  document.body.style.overflow = '';
}

function navigateLightbox(dir) {
  lightboxIndex = (lightboxIndex + dir + photos.length) % photos.length;
  const clientId = getClientId();
  document.getElementById('lightbox-img').src = `/uploads/clients/${clientId}/${photos[lightboxIndex].filename}`;
}

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lb-prev').addEventListener('click', () => navigateLightbox(-1));
document.getElementById('lb-next').addEventListener('click', () => navigateLightbox(1));
document.getElementById('lightbox').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeLightbox(); });

document.addEventListener('keydown', (e) => {
  if (!document.getElementById('lightbox').classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') navigateLightbox(-1);
  if (e.key === 'ArrowRight') navigateLightbox(1);
});

// ── INIT ──────────────────────────────────────────────────
if (token) {
  // Tenta carregar com token existente
  (async () => {
    const res = await fetch('/api/client/photos', { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      sessionStorage.removeItem(`client_token_${slug}`);
      return; // mostra login
    }
    if (res.status === 403) { showExpired(); return; }
    const data = await res.json();
    showArea(data.name, data.expires_at);
    photos = data.photos;
    document.getElementById('client-grid').innerHTML = '';
    photos.forEach((p, i) => {
      const clientId = getClientId();
      const item = document.createElement('div');
      item.className = 'client-photo';
      item.innerHTML = `<img src="/uploads/clients/${clientId}/thumb_${p.filename}" alt="${p.original_name}" loading="lazy">`;
      item.addEventListener('click', () => openLightbox(i));
      document.getElementById('client-grid').appendChild(item);
    });
    if (!photos.length) {
      document.getElementById('client-grid').innerHTML = '<p style="color:var(--text-muted);padding:3rem;text-align:center;grid-column:1/-1">Suas fotos serão disponibilizadas em breve.</p>';
    }
  })();
}
