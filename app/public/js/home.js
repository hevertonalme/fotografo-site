const API = '/api/public';
let lightboxPhotos = [];
let lightboxIndex = 0;

async function loadTexts() {
  try {
    const texts = await fetch(`${API}/texts`).then(r => r.json());
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
    set('hero-tag', texts.hero_tag);
    set('hero-title', texts.hero_title);
    set('hero-sub', texts.hero_sub);
    set('about-title', texts.about_title);
    set('about-text', texts.about_text);
    set('contact-title', texts.contact_title);
    set('contact-email', texts.contact_email);
    set('contact-phone', texts.contact_phone);
    set('contact-instagram', texts.contact_instagram);

    // Nav logo
    const logo = document.querySelector('.nav-logo');
    if (logo && texts.hero_title) logo.textContent = texts.hero_title;

    // Links de contato
    const email = document.getElementById('contato-email');
    const phone = document.getElementById('contato-phone');
    const insta = document.getElementById('contato-insta');
    if (email && texts.contact_email) email.href = `mailto:${texts.contact_email}`;
    if (phone && texts.contact_phone) phone.href = `tel:${texts.contact_phone.replace(/\D/g, '')}`;
    if (insta && texts.contact_instagram) {
      const handle = texts.contact_instagram.replace('@', '');
      insta.href = `https://instagram.com/${handle}`;
    }

    document.title = texts.hero_title || 'Fotógrafo';
  } catch (e) { console.error('Erro ao carregar textos', e); }
}

async function loadPortfolio() {
  try {
    const photos = await fetch(`${API}/portfolio`).then(r => r.json());
    const grid = document.getElementById('vitrine-grid');
    const track = document.getElementById('galeria-track');
    grid.innerHTML = '';
    track.innerHTML = '';

    if (!photos.length) {
      grid.innerHTML = '<p style="color:var(--text-muted);padding:3rem;grid-column:span 3;text-align:center">Portfólio em breve</p>';
      return;
    }

    lightboxPhotos = photos;

    photos.forEach((photo, i) => {
      // Vitrine grid
      const item = document.createElement('div');
      item.className = 'vitrine-item';
      item.innerHTML = `
        <img src="/uploads/portfolio/thumb_${photo.filename}" alt="${photo.original_name}" loading="lazy">
        <div class="vitrine-item-overlay"><span>Ver foto</span></div>
      `;
      item.addEventListener('click', () => openLightbox(i));
      grid.appendChild(item);

      // Galeria horizontal (duplicada para efeito)
      const gItem = document.createElement('div');
      gItem.className = 'galeria-photo';
      gItem.innerHTML = `<img src="/uploads/portfolio/thumb_${photo.filename}" alt="${photo.original_name}" loading="lazy">`;
      gItem.addEventListener('click', () => openLightbox(i));
      track.appendChild(gItem);
    });
  } catch (e) {
    console.error('Erro ao carregar portfólio', e);
  }
}

function openLightbox(index) {
  lightboxIndex = index;
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  img.src = `/uploads/portfolio/${lightboxPhotos[index].filename}`;
  lb.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  document.body.style.overflow = '';
}

function navigateLightbox(dir) {
  lightboxIndex = (lightboxIndex + dir + lightboxPhotos.length) % lightboxPhotos.length;
  document.getElementById('lightbox-img').src = `/uploads/portfolio/${lightboxPhotos[lightboxIndex].filename}`;
}

// Events
document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lb-prev').addEventListener('click', () => navigateLightbox(-1));
document.getElementById('lb-next').addEventListener('click', () => navigateLightbox(1));
document.getElementById('lightbox').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeLightbox();
});

document.addEventListener('keydown', (e) => {
  const lb = document.getElementById('lightbox');
  if (!lb.classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') navigateLightbox(-1);
  if (e.key === 'ArrowRight') navigateLightbox(1);
});

// Ano no footer
document.getElementById('year').textContent = new Date().getFullYear();

// Init
loadTexts();
loadPortfolio();
