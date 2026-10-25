/* Product detail page */
injectLayout();

const id = parseInt(new URLSearchParams(location.search).get("id"), 10);
const relatedMap = new Map();

function specsTable(text) {
  const rows = String(text || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.indexOf(":");
    return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : ["", l];
  });
  if (!rows.length) return `<p class="muted">No specifications added yet.</p>`;
  return `<table class="spec-table">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>`;
}

async function load() {
  const box = $("#pd");
  if (!id) { box.innerHTML = `<div class="empty"><h3>Product not found</h3><a class="btn btn-gold" href="index.html#products">Back to products</a></div>`; return; }
  let p;
  try { p = await api(`/api/products/${id}`); }
  catch { box.innerHTML = `<div class="empty"><div class="empty-ico">😕</div><h3>Product not found</h3><a class="btn btn-gold" href="index.html#products">Back to products</a></div>`; return; }

  document.title = `${p.name} | Trust Line Import HUB`;
  document.querySelector('meta[name="description"]').setAttribute("content", p.short_description || p.name);
  $("#crumbs").innerHTML = `<a href="index.html">Home</a> / <a href="index.html#products">Products</a>${p.category_name ? ` / <span>${esc(p.category_name)}</span>` : ""} / <b>${esc(p.name)}</b>`;

  const a = AVAIL[p.availability] || AVAIL.in_stock;
  const pre = p.availability === "upcoming";
  const out = p.availability === "out_of_stock";
  const imgs = p.images.length ? p.images : [{ url: "assets/placeholder.svg" }];
  const startIdx = Math.max(0, imgs.findIndex(i => i.is_cover));
  const discount = p.price && p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0;

  box.className = "pd";
  box.innerHTML = `
    <div class="gallery">
      <div class="g-main" id="gMain"><img id="gImg" src="${esc(imgs[startIdx].url)}" alt="${esc(p.name)}"></div>
      ${imgs.length > 1 ? `<div class="g-thumbs" id="gThumbs">${imgs.map((im, i) => `<button class="${i === startIdx ? "active" : ""}" data-src="${esc(im.url)}" aria-label="Image ${i + 1}"><img src="${esc(im.url)}" alt=""></button>`).join("")}</div>` : ""}
    </div>
    <div class="pd-info">
      <div class="pd-tags">
        <span class="badge badge-${a.cls}"><i></i>${a.label}</span>
        ${p.is_featured ? '<span class="badge badge-gold">★ Featured</span>' : ""}
        ${discount ? `<span class="badge badge-bad">-${discount}% OFF</span>` : ""}
        ${p.category_name ? `<span class="badge badge-ok">${esc(p.category_name)}</span>` : ""}
      </div>
      <h1>${esc(p.name)}</h1>
      <div class="pd-brand">${p.brand ? `Brand: <b>${esc(p.brand)}</b>` : ""}${p.brand && p.origin ? " &nbsp;·&nbsp; " : ""}${p.origin ? `Origin: <b>${esc(p.origin)}</b>` : ""}</div>

      <div class="pd-price-box">
        ${p.price != null
          ? `<div class="price"><b>${fmtTk(p.price)}</b>${discount ? `<s>${fmtTk(p.old_price)}</s>` : ""}<small>/ ${esc(p.unit)}</small></div>`
          : `<div class="price on-req" style="font-size:1.4rem">Price on request</div>`}
        <div class="meta"><span>Minimum order</span><b>${p.moq} ${esc(p.unit)}</b></div>
        ${pre ? `<div class="meta"><span>Expected arrival</span><b>🚢 ${esc(p.expected_arrival || "Coming soon")}</b></div>` : ""}
      </div>
      ${p.short_description ? `<p class="pd-short">${esc(p.short_description)}</p>` : ""}

      <div class="pd-order">
        <div class="pd-qty">
          <label for="qty">Quantity</label>
          <div class="stepper"><button id="qDec" aria-label="Decrease">−</button><input id="qty" type="number" min="${p.moq}" value="${p.moq}"><button id="qInc" aria-label="Increase">+</button></div>
          ${p.price != null ? `<div class="pd-sub">Estimated total<b id="qSub">${fmtTk(p.price * p.moq)}</b></div>` : ""}
        </div>
        <div class="pd-btns">
          <button class="btn btn-outline" id="addQuote" ${out ? "disabled" : ""}>+ Add to Order List</button>
          <a class="btn ${pre ? "btn-gold" : "btn-wa"}" id="waOrder" target="_blank" rel="noopener">${WA_ICON} ${pre ? "Pre-Order on WhatsApp" : out ? "Ask for Restock" : "Order on WhatsApp"}</a>
        </div>
        <span class="updated">Price updated ${esc(timeAgo(p.price_updated_at))} · Wholesale only</span>
      </div>

      <div class="pd-perks">
        <div><b>✅</b>100% Genuine</div>
        <div><b>🚚</b>Nationwide delivery</div>
        <div><b>💬</b>Talk to owner directly</div>
      </div>

      <div class="tabs">
        <div class="tab-btns" role="tablist">
          <button class="active" data-tab="desc">Description</button>
          <button data-tab="spec">Specifications</button>
        </div>
        <div class="tab-pane" id="tab-desc">${esc(p.description || p.short_description || "No description yet.")}</div>
        <div class="tab-pane" id="tab-spec" hidden>${specsTable(p.specs)}</div>
      </div>

      <div class="share-row">Share:
        <button class="btn btn-outline sm" id="copyLink">🔗 Copy link</button>
        <a class="btn btn-wa sm" target="_blank" rel="noopener" href="${esc(waLink(`Check this product: ${p.name}\n${productUrl(p)}`))}">${WA_ICON} Share</a>
      </div>
    </div>`;

  // Gallery
  const gImg = $("#gImg"), gMain = $("#gMain");
  $("#gThumbs")?.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#gThumbs button").forEach(x => x.classList.toggle("active", x === b));
    gImg.style.opacity = 0; setTimeout(() => { gImg.src = b.dataset.src; gImg.style.opacity = 1; }, 150);
  });
  gMain.addEventListener("mousemove", e => {
    const r = gMain.getBoundingClientRect();
    gImg.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  });
  gMain.addEventListener("click", () => gMain.classList.toggle("zoom"));
  gMain.addEventListener("mouseleave", () => gMain.classList.remove("zoom"));

  // Quantity
  const qty = $("#qty"), wa = $("#waOrder");
  const sync = () => {
    let q = Math.max(p.moq, parseInt(qty.value, 10) || p.moq);
    qty.value = q;
    if ($("#qSub")) $("#qSub").textContent = fmtTk(p.price * q);
    wa.href = waLink(singleOrderMessage(p, q));
  };
  $("#qDec").onclick = () => { qty.value = +qty.value - 1; sync(); };
  $("#qInc").onclick = () => { qty.value = +qty.value + 1; sync(); };
  qty.addEventListener("change", sync);
  sync();
  $("#addQuote").onclick = () => Quote.add(p, +qty.value);

  // Tabs
  $$(".tab-btns button").forEach(b => b.addEventListener("click", () => {
    $$(".tab-btns button").forEach(x => x.classList.toggle("active", x === b));
    $("#tab-desc").hidden = b.dataset.tab !== "desc";
    $("#tab-spec").hidden = b.dataset.tab !== "spec";
  }));

  $("#copyLink").onclick = async () => {
    try { await navigator.clipboard.writeText(productUrl(p)); toast("Link copied ✓"); } catch { toast("Copy failed", "err"); }
  };

  loadRelated(p);
}

async function loadRelated(p) {
  let list = [];
  try { list = await api(`/api/products?${p.category_id ? "category=" + p.category_id + "&" : ""}limit=9`); } catch {}
  list = list.filter(x => x.id !== p.id).slice(0, 4);
  if (!list.length) return;
  list.forEach(x => relatedMap.set(x.id, x));
  $("#related").innerHTML = list.map(productCard).join("");
  $("#relatedWrap").hidden = false;
  observeReveal($("#related"));
}
bindCards($("#related"), relatedMap);

load();
