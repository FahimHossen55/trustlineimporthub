/* ==========================================================
   Trust Line Import HUB – shared front-end logic
   ========================================================== */
const SITE = {
  name: "Trust Line Import HUB",
  owner: "Shahin Perveg",
  whatsapp: "8801684822605",        // international format, no +
  whatsappDisplay: "01684-822605",
  phone: "+880 1684-822605",
  email: "shahinperveg56@gmail.com",
  website: "www.trustlinehub.com",
  hours: "Sat – Thu · 9:00 AM – 9:00 PM",
};

/* ---------- Helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function esc(v) {
  return String(v ?? "").replace(/[&<>"'`]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;",
  })[c]);
}

const fmtTk = n => "৳" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtTkText = n => "Tk " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

function timeAgo(iso) {
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 3600) return "just now";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 86400 * 30) return Math.floor(s / 86400) + "d ago";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const AVAIL = {
  in_stock: { label: "In Stock", cls: "ok" },
  low_stock: { label: "Low Stock", cls: "warn" },
  out_of_stock: { label: "Out of Stock", cls: "bad" },
  upcoming: { label: "Pre-Order", cls: "soon" },
};

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: "same-origin", ...opts });
  if (!res.ok) {
    let msg = "Something went wrong";
    try { const j = await res.json(); msg = typeof j.detail === "string" ? j.detail : (j.detail?.[0]?.msg || msg); } catch {}
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return res.status === 204 ? null : res.json();
}

function toast(msg, type = "ok") {
  let box = $("#toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; document.body.appendChild(box); }
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3100);
}

function waLink(text) {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
}

function productUrl(p) {
  return `${location.origin}/product.html?id=${p.id}`;
}

/* ---------- Single-product WhatsApp message ---------- */
function singleOrderMessage(p, qty) {
  const pre = p.availability === "upcoming";
  const lines = [
    `Assalamu Alaikum ${SITE.owner},`,
    pre ? `I want to *PRE-ORDER* this product:` : `I want to order this product:`,
    "",
    `*${p.name}*`,
    p.brand ? `Brand: ${p.brand}` : null,
    `Quantity: ${qty} ${p.unit}`,
    p.price != null ? `Unit price: ${fmtTkText(p.price)}` : `Price: Please share the price`,
    p.price != null ? `Estimated total: ${fmtTkText(p.price * qty)}` : null,
    pre && p.expected_arrival ? `Expected arrival: ${p.expected_arrival}` : null,
    `Link: ${productUrl(p)}`,
    "",
    "My Name: ",
    "Business / Pharmacy: ",
    "Delivery Area: ",
  ];
  return lines.filter(l => l !== null).join("\n");
}

/* ==========================================================
   Quote List (multi-item order) – stored in localStorage
   ========================================================== */
const Quote = {
  key: "tl_quote_v1",
  items() { try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch { return []; } },
  save(items) { localStorage.setItem(this.key, JSON.stringify(items)); Quote.render(); },
  add(p, qty) {
    const items = this.items();
    const q = Math.max(p.moq || 1, qty || p.moq || 1);
    const found = items.find(i => i.id === p.id);
    if (found) found.qty += q;
    else items.push({ id: p.id, name: p.name, unit: p.unit, price: p.price, moq: p.moq || 1,
                      cover: p.cover, pre: p.availability === "upcoming", arrival: p.expected_arrival || "" });
    if (!found) items[items.length - 1].qty = q;
    this.save(items);
    toast(`Added to your order list ✓`);
    bumpCart();
  },
  setQty(id, qty) {
    const items = this.items();
    const it = items.find(i => i.id === id);
    if (it) it.qty = Math.max(it.moq || 1, qty);
    this.save(items);
  },
  remove(id) { this.save(this.items().filter(i => i.id !== id)); },
  clear() { this.save([]); },

  message(form) {
    const items = this.items();
    let total = 0, unknown = false;
    const lines = [`Assalamu Alaikum ${SITE.owner},`, `I want to place an order from *${SITE.name}*:`, ""];
    items.forEach((it, n) => {
      lines.push(`${n + 1}. *${it.name}*${it.pre ? " (PRE-ORDER)" : ""}`);
      if (it.price != null) {
        const sub = it.price * it.qty; total += sub;
        lines.push(`    Qty: ${it.qty} ${it.unit} × ${fmtTkText(it.price)} = ${fmtTkText(sub)}`);
      } else { unknown = true; lines.push(`    Qty: ${it.qty} ${it.unit} (price on request)`); }
    });
    lines.push("", `*Estimated total: ${fmtTkText(total)}*${unknown ? " + items on request" : ""}`, "");
    lines.push(`Name: ${form.name || ""}`);
    lines.push(`Business / Pharmacy: ${form.business || ""}`);
    lines.push(`Phone: ${form.phone || ""}`);
    lines.push(`Delivery Area: ${form.area || ""}`);
    if (form.note) lines.push(`Note: ${form.note}`);
    return lines.join("\n");
  },

  render() {
    const items = this.items();
    $$(".cart-count").forEach(b => { b.textContent = items.length; b.hidden = items.length === 0; });
    const list = $("#quoteItems");
    if (!list) return;
    if (!items.length) {
      list.innerHTML = `<div class="q-empty"><div class="q-empty-ico">🛒</div>
        <p>Your order list is empty</p><small>Add products, then send the full list to ${esc(SITE.owner)} on WhatsApp in one tap.</small></div>`;
      $("#quoteFooter").hidden = true;
      return;
    }
    $("#quoteFooter").hidden = false;
    let total = 0;
    list.innerHTML = items.map(it => {
      if (it.price != null) total += it.price * it.qty;
      return `<div class="q-item" data-id="${it.id}">
        <img src="${esc(it.cover || "assets/placeholder.svg")}" alt="">
        <div class="q-info">
          <a href="product.html?id=${it.id}" class="q-name">${esc(it.name)}</a>
          <div class="q-meta">${it.pre ? '<span class="chip chip-soon">Pre-order</span>' : ""}
            ${it.price != null ? fmtTk(it.price) + " / " + esc(it.unit) : "Price on request"}</div>
          <div class="stepper sm">
            <button data-act="dec" aria-label="Decrease">−</button>
            <input type="number" min="${it.moq}" value="${it.qty}" aria-label="Quantity">
            <button data-act="inc" aria-label="Increase">+</button>
          </div>
        </div>
        <button class="q-del" data-act="del" aria-label="Remove">✕</button>
      </div>`;
    }).join("");
    $("#quoteTotal").textContent = fmtTk(total);
  },
};

function bumpCart() {
  $$(".cart-btn").forEach(b => { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); });
}

/* ---------- Shared layout: header, drawer, floating WA, footer ---------- */
function injectLayout() {
  const header = $("#siteHeader");
  if (header) header.innerHTML = `
    <div class="topbar">
      <div class="container topbar-in">
        <span>📞 ${esc(SITE.phone)}</span>
        <span class="hide-sm">✉️ ${esc(SITE.email)}</span>
        <span class="hide-sm">🕘 ${esc(SITE.hours)}</span>
        <a class="topbar-wa" href="${waLink("Assalamu Alaikum, I need information about your products.")}" target="_blank" rel="noopener">WhatsApp: ${esc(SITE.whatsappDisplay)}</a>
      </div>
    </div>
    <nav class="nav" id="nav">
      <div class="container nav-in">
        <a href="index.html" class="brand" aria-label="Trust Line Import HUB home">
          <img src="assets/logo-mark.png" alt="Trust Line logo" width="46" height="46">
          <span class="brand-text"><b><i>Trust</i>Line</b><small>IMPORT HUB</small></span>
        </a>
        <ul class="nav-links" id="navLinks">
          <li><a href="index.html#home">Home</a></li>
          <li><a href="index.html#categories">Categories</a></li>
          <li><a href="index.html#products">Products</a></li>
          <li><a href="index.html#preorder" class="nav-hot">Pre-Order <span class="dot-live"></span></a></li>
          <li><a href="index.html#how">How to Order</a></li>
          <li><a href="index.html#contact">Contact</a></li>
        </ul>
        <div class="nav-actions">
          <button class="cart-btn" id="openQuote" aria-label="Open order list">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <span>Order List</span><b class="cart-count" hidden>0</b>
          </button>
          <button class="burger" id="burger" aria-label="Menu"><i></i><i></i><i></i></button>
        </div>
      </div>
    </nav>`;

  document.body.insertAdjacentHTML("beforeend", `
    <div class="drawer-mask" id="quoteMask"></div>
    <aside class="drawer" id="quoteDrawer" aria-label="Order list">
      <header class="drawer-head">
        <div><h3>Your Order List</h3><small>Send everything to ${esc(SITE.owner)} on WhatsApp</small></div>
        <button class="icon-btn" id="closeQuote" aria-label="Close">✕</button>
      </header>
      <div class="drawer-body" id="quoteItems"></div>
      <footer class="drawer-foot" id="quoteFooter" hidden>
        <div class="q-total"><span>Estimated total</span><b id="quoteTotal">৳0</b></div>
        <form id="quoteForm" class="q-form" autocomplete="on">
          <input name="name" placeholder="Your name *" required maxlength="60">
          <input name="business" placeholder="Business / Pharmacy name" maxlength="80">
          <input name="phone" placeholder="Phone number *" required maxlength="20" inputmode="tel">
          <input name="area" placeholder="Delivery area (e.g. Dhaka, Mirpur)" maxlength="80">
          <textarea name="note" rows="2" placeholder="Note (optional)" maxlength="300"></textarea>
          <button class="btn btn-wa btn-block" type="submit">
            ${WA_ICON} Send Order on WhatsApp
          </button>
          <button class="btn-link" type="button" id="clearQuote">Clear list</button>
        </form>
      </footer>
    </aside>
    <a class="fab-wa" href="${waLink(`Assalamu Alaikum ${SITE.owner}, I'm interested in your medical products.`)}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">
      ${WA_ICON}<span>Chat with ${esc(SITE.owner.split(" ")[0])}</span>
    </a>
    
    <!-- Mobile App-Style Bottom Navigation Bar -->
    <nav class="mobile-bottom-nav" id="mobileBottomNav" aria-label="Mobile Navigation">
      <a href="index.html#home" class="mb-item" data-nav="home">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Home</span>
      </a>
      <a href="index.html#products" class="mb-item" data-nav="products">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        <span>Catalog</span>
      </a>
      <a href="index.html#preorder" class="mb-item mb-hot" data-nav="preorder">
        <div class="mb-ico-wrap">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span class="dot-live"></span>
        </div>
        <span>Pre-Order</span>
      </a>
      <button type="button" class="mb-item" id="mbOpenQuote" aria-label="Open Order List">
        <div class="mb-ico-wrap">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <b class="cart-count" hidden>0</b>
        </div>
        <span>Order List</span>
      </button>
      <a class="mb-item mb-wa" href="${waLink(`Assalamu Alaikum ${SITE.owner}, I want to enquire about wholesale products.`)}" target="_blank" rel="noopener">
        <div class="mb-ico-wrap wa-circle">
          ${WA_ICON}
        </div>
        <span>WhatsApp</span>
      </a>
    </nav>`);

  const footer = $("#siteFooter");
  if (footer) footer.innerHTML = `
    <div class="container foot-grid">
      <div>
        <a href="index.html" class="brand light"><img src="assets/logo-mark.png" alt="" width="46" height="46">
          <span class="brand-text"><b><i>Trust</i>Line</b><small>IMPORT HUB</small></span></a>
        <p class="foot-tag">Trusted Imports, Trusted Business. Wholesale supplier of genuine medical devices & equipment across Bangladesh.</p>
      </div>
      <div><h4>Explore</h4><ul>
        <li><a href="index.html#products">All Products</a></li>
        <li><a href="index.html#preorder">Upcoming / Pre-Order</a></li>
        <li><a href="index.html#how">How to Order</a></li>
        <li><a href="index.html#about">About Us</a></li></ul></div>
      <div><h4>Contact</h4><ul>
        <li>👤 ${esc(SITE.owner)} (Owner)</li>
        <li>💬 WhatsApp: ${esc(SITE.whatsappDisplay)}</li>
        <li>📞 ${esc(SITE.phone)}</li>
        <li>✉️ ${esc(SITE.email)}</li></ul></div>
      <div><h4>Business Hours</h4><p>${esc(SITE.hours)}</p>
        <a class="btn btn-wa sm" href="${waLink("Assalamu Alaikum, I want wholesale price list.")}" target="_blank" rel="noopener">${WA_ICON} Get Price List</a></div>
    </div>
    <div class="foot-bottom container">
      <span>© ${new Date().getFullYear()} ${esc(SITE.name)}. All rights reserved.</span>
      <span>Wholesale only · Prices may change without notice</span>
    </div>`;

  // Events
  const open = () => { document.body.classList.add("drawer-open"); Quote.render(); };
  const close = () => document.body.classList.remove("drawer-open");
  $("#openQuote")?.addEventListener("click", open);
  $("#mbOpenQuote")?.addEventListener("click", open);
  $("#closeQuote").addEventListener("click", close);
  $("#quoteMask").addEventListener("click", close);
  document.addEventListener("keydown", e => e.key === "Escape" && close());

  // Mobile bottom nav active link updater
  const updateActiveNav = () => {
    const hash = location.hash || "#home";
    $$(".mb-item[data-nav]").forEach(a => {
      a.classList.toggle("active", a.getAttribute("href").includes(hash));
    });
  };
  window.addEventListener("hashchange", updateActiveNav);
  updateActiveNav();

  $("#quoteItems").addEventListener("click", e => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const row = btn.closest(".q-item"); const id = +row.dataset.id;
    const input = $("input", row);
    if (btn.dataset.act === "del") Quote.remove(id);
    if (btn.dataset.act === "inc") Quote.setQty(id, +input.value + 1);
    if (btn.dataset.act === "dec") Quote.setQty(id, +input.value - 1);
  });
  $("#quoteItems").addEventListener("change", e => {
    if (e.target.matches("input")) Quote.setQty(+e.target.closest(".q-item").dataset.id, +e.target.value || 1);
  });
  $("#quoteForm").addEventListener("submit", e => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target).entries());
    localStorage.setItem("tl_buyer", JSON.stringify({ ...form, note: "" }));
    window.open(waLink(Quote.message(form)), "_blank", "noopener");
  });
  $("#clearQuote").addEventListener("click", () => { if (confirm("Clear the whole list?")) Quote.clear(); });

  // remember buyer details
  try {
    const b = JSON.parse(localStorage.getItem("tl_buyer") || "{}");
    Object.entries(b).forEach(([k, v]) => { const f = $(`#quoteForm [name="${k}"]`); if (f && v) f.value = v; });
  } catch {}

  // Mobile menu
  $("#burger")?.addEventListener("click", () => document.body.classList.toggle("menu-open"));
  $$("#navLinks a").forEach(a => a.addEventListener("click", () => document.body.classList.remove("menu-open")));

  // Sticky nav shadow
  const onScroll = () => $("#nav")?.classList.toggle("scrolled", scrollY > 30);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  Quote.render();
}

const WA_ICON = `<svg viewBox="0 0 32 32" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M16 .4A15.6 15.6 0 0 0 2.6 23.9L.4 31.6l7.9-2.1A15.6 15.6 0 1 0 16 .4Zm0 28.5c-2.4 0-4.8-.7-6.8-1.9l-.5-.3-4.7 1.2 1.3-4.6-.3-.5A12.9 12.9 0 1 1 16 28.9Zm7.1-9.7c-.4-.2-2.3-1.1-2.7-1.3-.4-.1-.6-.2-.9.2l-1.2 1.5c-.2.3-.4.3-.8.1a10.6 10.6 0 0 1-5.3-4.6c-.4-.7.4-.6 1.1-2.1.1-.3.1-.5 0-.7l-1.2-2.9c-.3-.8-.6-.6-.9-.7h-.7c-.3 0-.7.1-1 .5-.4.4-1.4 1.3-1.4 3.2s1.4 3.7 1.6 4c.2.3 2.8 4.2 6.7 5.9 2.5 1.1 3.5 1.2 4.7 1 .8-.1 2.3-.9 2.7-1.9.3-.9.3-1.7.2-1.9-.1-.1-.4-.2-.8-.4Z"/></svg>`;

/* ---------- Reveal-on-scroll animation ---------- */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); revealObserver.unobserve(en.target); } });
}, { threshold: 0.12 });
function observeReveal(root = document) { $$(".reveal:not(.in)", root).forEach(el => revealObserver.observe(el)); }

/* ---------- Product card (used on home + related) ---------- */
function productCard(p, i = 0) {
  const a = AVAIL[p.availability] || AVAIL.in_stock;
  const discount = p.price && p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
  const priceHtml = p.price != null
    ? `<div class="price"><b>${fmtTk(p.price)}</b>${discount ? `<s>${fmtTk(p.old_price)}</s>` : ""}<small>/ ${esc(p.unit)}</small></div>`
    : `<div class="price on-req">Price on request</div>`;
  const disabled = p.availability === "out_of_stock";
  return `<article class="card reveal" style="--d:${(i % 8) * 60}ms" data-id="${p.id}">
    <a href="product.html?id=${p.id}" class="card-media" aria-label="${esc(p.name)}">
      <img src="${esc(p.cover || "assets/placeholder.svg")}" alt="${esc(p.name)}" loading="lazy">
      <div class="badges">
        <span class="badge badge-${a.cls}"><i></i>${a.label}</span>
        ${p.is_featured ? '<span class="badge badge-gold">★ Featured</span>' : ""}
      </div>
      ${discount ? `<span class="ribbon">-${discount}%</span>` : ""}
      <span class="card-view">View details →</span>
    </a>
    <div class="card-body">
      <div class="card-cat">${esc(p.category_name || "Medical")}${p.brand ? " · " + esc(p.brand) : ""}</div>
      <h3 class="card-title"><a href="product.html?id=${p.id}">${esc(p.name)}</a></h3>
      ${p.availability === "upcoming" && p.expected_arrival ? `<div class="arrival">🚢 Arriving: ${esc(p.expected_arrival)}</div>` : `<p class="card-desc">${esc(p.short_description)}</p>`}
      <div class="card-row">${priceHtml}<span class="moq">MOQ ${p.moq}</span></div>
      <div class="card-actions">
        <button class="btn btn-outline sm" data-add="${p.id}" ${disabled ? "disabled" : ""}>+ Order List</button>
        <a class="btn btn-wa sm" href="${esc(waLink(singleOrderMessage(p, p.moq)))}" target="_blank" rel="noopener">${WA_ICON}${p.availability === "upcoming" ? "Pre-Order" : "Order"}</a>
      </div>
    </div>
  </article>`;
}

/* Wire up card buttons inside a container, given a product lookup map */
function bindCards(container, map) {
  container.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) { e.preventDefault(); const p = map.get(+add.dataset.add); if (p) Quote.add(p, p.moq); }
  });
}
