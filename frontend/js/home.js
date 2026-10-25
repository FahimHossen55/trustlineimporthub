/* Home page logic */
injectLayout();

const state = { search: "", category: null, availability: "", sort: "newest" };
const productMap = new Map();
let categories = [];

/* ---------------- Flyer slider ---------------- */
async function loadFlyers() {
  const track = $("#flyerTrack");
  let flyers = [];
  try { flyers = await api("/api/flyers"); } catch {}
  if (!flyers.length) {
    track.innerHTML = `<div class="flyer"><div class="flyer-empty"><img src="assets/logo-mark.png" alt=""><b>Trust Line Import HUB</b><span>Trusted Imports, Trusted Business</span></div></div>`;
    $$(".fl-nav").forEach(b => b.hidden = true);
    return;
  }
  track.innerHTML = flyers.map((f, i) => `
    <div class="flyer ${i === 0 ? "active" : ""}" data-i="${i}">
      <div class="flyer-blur" style="background-image:url('${esc(f.image_url)}')"></div>
      <img src="${esc(f.image_url)}" alt="${esc(f.title || "Promotional flyer")}" ${i ? 'loading="lazy"' : ""}>
      ${f.title || f.subtitle ? `<div class="flyer-cap">
          ${f.title ? `<b>${esc(f.title)}</b>` : ""}${f.subtitle ? `<span>${esc(f.subtitle)}</span>` : ""}
          ${f.link ? `<a href="${esc(f.link)}" class="flyer-link">Explore →</a>` : ""}
        </div>` : ""}
    </div>`).join("");
  $("#flDots").innerHTML = flyers.map((_, i) => `<button class="${i === 0 ? "active" : ""}" data-i="${i}" aria-label="Flyer ${i + 1}"></button>`).join("");

  let cur = 0, timer;
  const slides = $$(".flyer", track), dots = $$("#flDots button");
  const DURATION = 5000;
  const go = n => {
    cur = (n + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle("active", i === cur));
    dots.forEach((d, i) => d.classList.toggle("active", i === cur));
    const bar = $("#flProgress");
    bar.style.transition = "none"; bar.style.width = "0";
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${DURATION}ms linear`; bar.style.width = "100%"; }));
    clearTimeout(timer); timer = setTimeout(() => go(cur + 1), DURATION);
  };
  $("#flPrev").onclick = () => go(cur - 1);
  $("#flNext").onclick = () => go(cur + 1);
  $("#flDots").onclick = e => { const b = e.target.closest("button"); if (b) go(+b.dataset.i); };
  // swipe
  let sx = null;
  track.addEventListener("touchstart", e => sx = e.touches[0].clientX, { passive: true });
  track.addEventListener("touchend", e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1)); sx = null; });
  // 3D tilt
  const stage = $("#flyerStage");
  stage.addEventListener("mousemove", e => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    stage.style.transform = `perspective(1200px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
  });
  stage.addEventListener("mouseleave", () => stage.style.transform = "");
  go(0);
}

/* ---------------- Categories ---------------- */
async function loadCategories() {
  try { categories = await api("/api/categories"); } catch { categories = []; }
  $("#catGrid").innerHTML = categories.map((c, i) => `
    <button class="cat reveal" style="--d:${i * 70}ms" data-cat="${c.id}">
      <span class="cat-ico">${esc(c.icon)}</span>
      <b>${esc(c.name)}</b>
      <small>${c.product_count} product${c.product_count === 1 ? "" : "s"}</small>
      <span class="cat-arrow">→</span>
    </button>`).join("") || `<p class="muted">Categories coming soon.</p>`;
  renderChips();
  observeReveal();
}

function renderChips() {
  $("#catChips").innerHTML = [`<button class="chip-btn ${state.category == null ? "active" : ""}" data-cat="">All</button>`]
    .concat(categories.map(c => `<button class="chip-btn ${state.category === c.id ? "active" : ""}" data-cat="${c.id}">${esc(c.icon)} ${esc(c.name)}</button>`))
    .join("");
}

$("#catGrid").addEventListener("click", e => {
  const b = e.target.closest("[data-cat]"); if (!b) return;
  state.category = +b.dataset.cat; renderChips(); loadProducts();
  $("#products").scrollIntoView({ behavior: "smooth" });
});
$("#catChips").addEventListener("click", e => {
  const b = e.target.closest("[data-cat]"); if (!b) return;
  state.category = b.dataset.cat ? +b.dataset.cat : null; renderChips(); loadProducts();
});

/* ---------------- Products ---------------- */
function skeletons(n) {
  return Array.from({ length: n }, () => `<div class="card skel"><div class="shimmer sk-media"></div><div class="card-body"><div class="shimmer sk-line"></div><div class="shimmer sk-line w60"></div><div class="shimmer sk-line w40"></div></div></div>`).join("");
}

let reqId = 0;
async function loadProducts() {
  const grid = $("#productGrid");
  grid.innerHTML = skeletons(4);
  const params = new URLSearchParams({ sort: state.sort });
  if (state.search) params.set("search", state.search);
  if (state.category) params.set("category", state.category);
  if (state.availability) params.set("availability", state.availability);
  const my = ++reqId;
  let list = [];
  try { list = await api("/api/products?" + params); } catch (e) { grid.innerHTML = `<p class="empty">⚠️ ${esc(e.message)}</p>`; return; }
  if (my !== reqId) return;
  list = list.filter(p => p.availability !== "upcoming");
  list.forEach(p => productMap.set(p.id, p));
  const catName = categories.find(c => c.id === state.category)?.name;
  $("#resultInfo").innerHTML = `Showing <b>${list.length}</b> product${list.length === 1 ? "" : "s"}${catName ? ` in <b>${esc(catName)}</b>` : ""}${state.search ? ` for “<b>${esc(state.search)}</b>”` : ""}`;
  grid.innerHTML = list.length ? list.map(productCard).join("") : `
    <div class="empty"><div class="empty-ico">🔎</div><h3>No products found</h3>
    <p>Can't find it? We can import it for you.</p>
    <a class="btn btn-wa" target="_blank" rel="noopener" href="${esc(waLink(`Assalamu Alaikum ${SITE.owner}, I am looking for: ${state.search || "a product"}. Can you import it?`))}">${WA_ICON} Ask on WhatsApp</a></div>`;
  observeReveal(grid);
}

async function loadPreorders() {
  const grid = $("#preorderGrid");
  let list = [];
  try { list = await api("/api/products?availability=upcoming&sort=newest"); } catch {}
  list.forEach(p => productMap.set(p.id, p));
  grid.innerHTML = list.length ? list.map((p, i) => `
    <article class="po-card reveal" style="--d:${i * 90}ms">
      <a href="product.html?id=${p.id}" class="po-media">
        <img src="${esc(p.cover || "assets/placeholder.svg")}" alt="${esc(p.name)}" loading="lazy">
        <span class="po-tag">PRE-ORDER</span>
      </a>
      <div class="po-body">
        <div class="po-eta"><span class="eta-dot"></span>Expected: <b>${esc(p.expected_arrival || "Coming soon")}</b></div>
        <h3><a href="product.html?id=${p.id}">${esc(p.name)}</a></h3>
        <p>${esc(p.short_description)}</p>
        <div class="po-row">
          ${p.price != null ? `<div class="price light"><b>${fmtTk(p.price)}</b><small>/ ${esc(p.unit)}</small></div>` : `<div class="price light on-req">Price on request</div>`}
          <span class="moq light">MOQ ${p.moq}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-glass sm" data-add="${p.id}">+ Order List</button>
          <a class="btn btn-gold sm" target="_blank" rel="noopener" href="${esc(waLink(singleOrderMessage(p, p.moq)))}">${WA_ICON} Pre-Order Now</a>
        </div>
      </div>
    </article>`).join("") : `
    <div class="po-empty reveal">
      <div class="empty-ico">📦</div>
      <h3>New shipments are being planned</h3>
      <p>Ask Shahin Perveg about upcoming arrivals and reserve early.</p>
      <a class="btn btn-gold" target="_blank" rel="noopener" href="${esc(waLink(`Assalamu Alaikum ${SITE.owner}, which products are arriving in your next shipment?`))}">${WA_ICON} Ask about next shipment</a>
    </div>`;
  observeReveal(grid);
}

bindCards($("#productGrid"), productMap);
bindCards($("#preorderGrid"), productMap);

/* ---------------- Toolbar ---------------- */
let deb;
$("#search").addEventListener("input", e => {
  clearTimeout(deb); deb = setTimeout(() => { state.search = e.target.value.trim(); loadProducts(); }, 300);
});
$("#fAvail").addEventListener("change", e => { state.availability = e.target.value; loadProducts(); });
$("#fSort").addEventListener("change", e => { state.sort = e.target.value; loadProducts(); });
$$(".view-toggle button").forEach(b => b.addEventListener("click", () => {
  $$(".view-toggle button").forEach(x => x.classList.toggle("active", x === b));
  $("#productGrid").classList.toggle("list", b.dataset.view === "list");
}));

const heroGo = () => {
  const v = $("#heroSearch").value.trim();
  $("#search").value = v; state.search = v; loadProducts();
  $("#products").scrollIntoView({ behavior: "smooth" });
};
$("#heroSearchBtn").addEventListener("click", heroGo);
$("#heroSearch").addEventListener("keydown", e => e.key === "Enter" && heroGo());

/* ---------------- Static WA links ---------------- */
$("#requestImport").href = waLink(`Assalamu Alaikum ${SITE.owner},\nI want to request a product import:\n\nProduct name: \nBrand (if any): \nQuantity: \n\nMy Name: \nBusiness: `);
$("#ownerWa").href = waLink(`Assalamu Alaikum ${SITE.owner}, I'd like to know more about Trust Line Import HUB.`);
$("#cWa").href = waLink(`Assalamu Alaikum ${SITE.owner}, I want to know wholesale prices.`);

/* ---------------- Stats counter ---------------- */
async function countUp() {
  const el = $('[data-count="stat-products"]');
  const total = categories.reduce((s, c) => s + c.product_count, 0);
  const target = Math.max(total, 1);
  let n = 0; const step = Math.max(1, Math.ceil(target / 30));
  const t = setInterval(() => { n = Math.min(target, n + step); el.textContent = n + "+"; if (n >= target) clearInterval(t); }, 40);
}

(async () => {
  loadFlyers();
  await loadCategories();
  countUp();
  loadProducts();
  loadPreorders();
  observeReveal();
})();
