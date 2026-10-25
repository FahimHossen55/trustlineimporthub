/* ==========================================================
   Trust Line Import HUB – Owner Admin Panel JavaScript
   Secure admin console with inline editing & full management
   ========================================================== */

// Helper to make authenticated admin API calls with CSRF protection header
async function apiAdmin(path, opts = {}) {
  const headers = {
    "X-Requested-With": "TrustLineAdmin",
    ...(opts.headers || {})
  };
  
  // If sending JSON body, ensure Content-Type header
  if (opts.body && !(opts.body instanceof FormData) && typeof opts.body === "object") {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(path, {
    credentials: "same-origin",
    ...opts,
    headers
  });

  if (!res.ok) {
    let msg = "Action failed";
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : (j.detail?.[0]?.msg || msg);
    } catch {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

let currentUser = null;
let currentProducts = [];
let currentCategories = [];
let currentFlyers = [];
let editingProductId = null;
let editingFlyerId = null;
let pendingFiles = [];
let confirmCallback = null;

/* ---------------- View Routing ---------------- */
function setView(name) {
  $$(".side-nav button").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  $$(".ab-item").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  $$(".view").forEach(v => v.hidden = v.id !== `v-${name}`);
  const titleMap = {
    dashboard: "Dashboard",
    products: "Products Management",
    flyers: "Promotional Flyers",
    categories: "Categories Management",
    security: "Owner Security"
  };
  $("#viewTitle").textContent = titleMap[name] || "Dashboard";
  document.body.classList.remove("side-open");

  if (name === "dashboard") loadDashboard();
  if (name === "products") loadProducts();
  if (name === "flyers") loadFlyers();
  if (name === "categories") loadCategories();
}

// Side nav buttons & mobile bottom nav buttons
$$(".side-nav button, .ab-item").forEach(b => {
  b.addEventListener("click", () => setView(b.dataset.view));
});

$('[data-goto="products"]')?.addEventListener("click", () => {
  setView("products");
  openProductModal();
});

// Sidebar open/close handlers
$("#sideToggle")?.addEventListener("click", () => {
  document.body.classList.toggle("side-open");
});
$("#sideMask")?.addEventListener("click", () => {
  document.body.classList.remove("side-open");
});
$("#sideClose")?.addEventListener("click", () => {
  document.body.classList.remove("side-open");
});

/* ---------------- Modals ---------------- */
function openModal(el) { el.hidden = false; }
function closeModal(el) { el.hidden = true; }

$$("[data-close]").forEach(b => {
  b.addEventListener("click", () => {
    const m = b.closest(".modal");
    if (m) closeModal(m);
  });
});

window.addEventListener("keydown", e => {
  if (e.key === "Escape") $$(".modal").forEach(closeModal);
});

function confirmAction(title, text, onConfirm) {
  $("#cTitle").textContent = title;
  $("#cText").textContent = text;
  confirmCallback = onConfirm;
  openModal($("#cModal"));
}

$("#cOk")?.addEventListener("click", async () => {
  if (confirmCallback) {
    try {
      await confirmCallback();
    } catch (err) {
      toast(err.message, "err");
    }
  }
  closeModal($("#cModal"));
});

/* ---------------- Auth Check & Login ---------------- */
async function checkAuth() {
  try {
    const user = await api("/api/auth/me");
    currentUser = user;
    $("#meName").textContent = user.full_name || user.username;
    $("#welcomeName").textContent = (user.full_name || user.username).split(" ")[0];
    const initials = (user.full_name || user.username).split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    $("#meAv").textContent = initials;
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    setView("dashboard");
  } catch (e) {
    $("#loginView").hidden = false;
    $("#appView").hidden = true;
  }
}

// Password toggle
$("#pwEye")?.addEventListener("click", () => {
  const p = $("#lPass");
  const isPw = p.type === "password";
  p.type = isPw ? "text" : "password";
  $("#pwEye").textContent = isPw ? "🙈" : "👁";
});

// Login form
$("#loginForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#loginBtn");
  const errBox = $("#loginErr");
  errBox.textContent = "";
  btn.disabled = true;
  btn.textContent = "Signing in...";

  const data = {
    username: $("#lUser").value.trim(),
    password: $("#lPass").value
  };

  try {
    await apiAdmin("/api/auth/login", {
      method: "POST",
      body: data
    });
    toast("Welcome back! Login successful ✓");
    await checkAuth();
  } catch (err) {
    errBox.textContent = err.message || "Invalid credentials";
    const card = $(".login-card");
    card.classList.remove("shake");
    void card.offsetWidth;
    card.classList.add("shake");
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign in securely 🔒";
  }
});

// Logout
$("#logoutBtn")?.addEventListener("click", async () => {
  try {
    await apiAdmin("/api/auth/logout", { method: "POST" });
  } catch {}
  toast("Signed out");
  location.reload();
});

/* ---------------- Dashboard ---------------- */
async function loadDashboard() {
  try {
    const stats = await api("/api/admin/stats");
    $("#stats").innerHTML = `
      <div class="stat" style="--c:var(--navy-700)">
        <span class="s-ico">📦</span>
        <b>${stats.total}</b>
        <span>Total Products</span>
      </div>
      <div class="stat" style="--c:var(--teal)">
        <span class="s-ico">✅</span>
        <b>${stats.in_stock}</b>
        <span>In Stock</span>
      </div>
      <div class="stat" style="--c:var(--amber)">
        <span class="s-ico">⚠️</span>
        <b>${stats.low_stock}</b>
        <span>Low Stock</span>
      </div>
      <div class="stat" style="--c:var(--red)">
        <span class="s-ico">⛔</span>
        <b>${stats.out_of_stock}</b>
        <span>Out of Stock</span>
      </div>
      <div class="stat" style="--c:var(--gold)">
        <span class="s-ico">🚢</span>
        <b>${stats.upcoming}</b>
        <span>Upcoming / Pre-order</span>
      </div>
    `;

    $("#topViewed").innerHTML = (stats.top_viewed || []).length ? stats.top_viewed.map(p => `
      <div class="mini-row">
        <a href="product.html?id=${p.id}" target="_blank">${esc(p.name)}</a>
        <b>${p.views} views</b>
      </div>
    `).join("") : `<p class="muted">No views recorded yet.</p>`;

    const attentionItems = [];
    if (stats.out_of_stock > 0) {
      attentionItems.push(`<b>${stats.out_of_stock}</b> product(s) currently marked Out of Stock`);
    }
    if (stats.low_stock > 0) {
      attentionItems.push(`<b>${stats.low_stock}</b> product(s) on Low Stock`);
    }
    if (stats.upcoming > 0) {
      attentionItems.push(`<b>${stats.upcoming}</b> upcoming product(s) taking Pre-Orders`);
    }
    if (!attentionItems.length) {
      attentionItems.push("All products are well stocked and running smoothly! 👍");
    }

    $("#attention").innerHTML = attentionItems.map(item => `
      <div class="mini-row"><span>${item}</span></div>
    `).join("");

  } catch (err) {
    toast(err.message, "err");
  }
}

/* ---------------- Products ---------------- */
async function loadProducts() {
  const tbody = $("#pRows");
  tbody.innerHTML = `<tr><td colspan="6" class="tbl-empty">Loading products...</td></tr>`;
  try {
    currentProducts = await api("/api/admin/products");
    renderProductRows();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="tbl-empty" style="color:var(--red)">Failed to load products: ${esc(err.message)}</td></tr>`;
  }
}

function renderProductRows() {
  const tbody = $("#pRows");
  const q = ($("#pSearch").value || "").toLowerCase().trim();
  const f = $("#pFilter").value;

  const filtered = currentProducts.filter(p => {
    if (f && p.availability !== f) return false;
    if (q) {
      const match = (p.name || "").toLowerCase().includes(q) ||
                    (p.brand || "").toLowerCase().includes(q) ||
                    (p.category_name || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="tbl-empty">No matching products found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const a = AVAIL[p.availability] || AVAIL.in_stock;
    const coverUrl = p.cover || "assets/placeholder.svg";
    return `
      <tr data-id="${p.id}">
        <td style="width:70px">
          <img src="${esc(coverUrl)}" alt="" class="thumb">
        </td>
        <td>
          <div class="p-name">
            <a href="product.html?id=${p.id}" target="_blank">${esc(p.name)}</a>
            ${p.is_featured ? '<span class="mini-badge">★ Featured</span>' : ''}
            ${!p.is_active ? '<span class="mini-badge off">Hidden</span>' : ''}
          </div>
          <div class="p-sub">
            ${esc(p.category_name || "Uncategorized")} · ${p.brand ? esc(p.brand) + ' · ' : ''}MOQ ${p.moq} ${esc(p.unit)}
            ${p.availability === 'upcoming' && p.expected_arrival ? `<span style="color:#a16207"> · 🚢 Arrival: ${esc(p.expected_arrival)}</span>` : ''}
          </div>
        </td>
        <td style="width:140px">
          <input type="number" step="0.01" class="price-in" value="${p.price != null ? p.price : ''}" placeholder="On request" data-orig="${p.price != null ? p.price : ''}" aria-label="Product price">
        </td>
        <td style="width:180px">
          <select class="avail-sel ${a.cls}" data-orig="${p.availability}" aria-label="Stock availability">
            <option value="in_stock" ${p.availability === "in_stock" ? "selected" : ""}>✅ In stock</option>
            <option value="low_stock" ${p.availability === "low_stock" ? "selected" : ""}>🟠 Low stock</option>
            <option value="out_of_stock" ${p.availability === "out_of_stock" ? "selected" : ""}>⛔ Out of stock</option>
            <option value="upcoming" ${p.availability === "upcoming" ? "selected" : ""}>🚢 Pre-order</option>
          </select>
        </td>
        <td style="width:90px; text-align:center">
          <b>${p.views}</b>
        </td>
        <td style="width:110px">
          <div class="row-act">
            <button class="act" data-action="edit" title="Edit Full Details">✏️</button>
            <button class="act del" data-action="delete" title="Delete Product">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

$("#pSearch")?.addEventListener("input", renderProductRows);
$("#pFilter")?.addEventListener("change", renderProductRows);

// Quick inline update on change
$("#pRows")?.addEventListener("change", async e => {
  const row = e.target.closest("tr");
  if (!row) return;
  const id = +row.dataset.id;
  const p = currentProducts.find(x => x.id === id);
  if (!p) return;

  if (e.target.matches(".price-in")) {
    const val = e.target.value.trim();
    const newPrice = val === "" ? null : parseFloat(val);
    if (newPrice !== null && (isNaN(newPrice) || newPrice < 0)) {
      toast("Invalid price amount", "err");
      e.target.value = e.target.dataset.orig;
      return;
    }
    try {
      const updated = await apiAdmin(`/api/admin/products/${id}/quick`, {
        method: "PATCH",
        body: { price: newPrice, clear_price: newPrice === null }
      });
      p.price = updated.price;
      e.target.dataset.orig = updated.price != null ? updated.price : "";
      e.target.classList.add("saved");
      setTimeout(() => e.target.classList.remove("saved"), 1200);
      toast(`Price updated for "${p.name}" ✓`);
    } catch (err) {
      toast(err.message, "err");
      e.target.value = e.target.dataset.orig;
    }
  }

  if (e.target.matches(".avail-sel")) {
    const newAvail = e.target.value;
    try {
      const updated = await apiAdmin(`/api/admin/products/${id}/quick`, {
        method: "PATCH",
        body: { availability: newAvail }
      });
      p.availability = updated.availability;
      e.target.dataset.orig = updated.availability;
      const a = AVAIL[updated.availability] || AVAIL.in_stock;
      e.target.className = `avail-sel ${a.cls} saved`;
      setTimeout(() => e.target.classList.remove("saved"), 1200);
      toast(`Stock status updated for "${p.name}" ✓`);
    } catch (err) {
      toast(err.message, "err");
      e.target.value = e.target.dataset.orig;
    }
  }
});

// Row actions (edit / delete)
$("#pRows")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const row = btn.closest("tr");
  const id = +row.dataset.id;
  const p = currentProducts.find(x => x.id === id);
  if (!p) return;

  if (btn.dataset.action === "edit") {
    openProductModal(p);
  } else if (btn.dataset.action === "delete") {
    confirmAction("Delete Product", `Are you sure you want to permanently delete "${p.name}"? This will delete all its images too.`, async () => {
      await apiAdmin(`/api/admin/products/${id}`, { method: "DELETE" });
      currentProducts = currentProducts.filter(x => x.id !== id);
      renderProductRows();
      toast("Product deleted ✓");
    });
  }
});

/* ---------------- Product Modal & Images ---------------- */
$("#newProduct")?.addEventListener("click", () => openProductModal());

async function populateCategoriesSelect(selectedId = null) {
  try {
    currentCategories = await api("/api/categories");
    const sel = $("#pCat");
    sel.innerHTML = `<option value="">-- No Category --</option>` +
      currentCategories.map(c => `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${esc(c.icon)} ${esc(c.name)}</option>`).join("");
  } catch {}
}

function openProductModal(p = null) {
  editingProductId = p ? p.id : null;
  pendingFiles = [];
  $("#pModalTitle").textContent = p ? "Edit Product" : "Add New Product";
  $("#pSave").textContent = p ? "Save Changes" : "Create Product";

  populateCategoriesSelect(p ? p.category_id : null);

  const form = $("#pForm");
  form.reset();

  // Populate fields if editing
  if (p) {
    form.name.value = p.name || "";
    form.brand.value = p.brand || "";
    form.origin.value = p.origin || "";
    form.unit.value = p.unit || "piece";
    form.price.value = p.price != null ? p.price : "";
    form.old_price.value = p.old_price != null ? p.old_price : "";
    form.moq.value = p.moq || 1;
    form.availability.value = p.availability || "in_stock";
    form.expected_arrival.value = p.expected_arrival || "";
    form.short_description.value = p.short_description || "";
    form.description.value = p.description || "";
    form.specs.value = p.specs || "";
    form.show_price.checked = p.show_price !== false;
    form.is_featured.checked = !!p.is_featured;
    form.is_active.checked = p.is_active !== false;
  } else {
    form.unit.value = "piece";
    form.moq.value = 1;
    form.show_price.checked = true;
    form.is_active.checked = true;
  }

  toggleArrivalField();
  renderProductImageGrid(p ? p.images : []);
  openModal($("#pModal"));
}

$("#pAvail")?.addEventListener("change", toggleArrivalField);
function toggleArrivalField() {
  const isUpcoming = $("#pAvail").value === "upcoming";
  $("#arrivalFld").style.display = isUpcoming ? "flex" : "none";
}

function renderProductImageGrid(serverImages = []) {
  const grid = $("#imgGrid");
  const serverHtml = serverImages.map(img => `
    <div class="img-tile ${img.is_cover ? 'cover' : ''}" data-iid="${img.id}">
      <img src="${esc(img.url)}" alt="">
      ${img.is_cover ? '<span class="cv">★ COVER</span>' : ''}
      <div class="img-tools">
        ${!img.is_cover ? '<button type="button" data-img-act="cover" title="Make cover photo">★</button>' : ''}
        <button type="button" data-img-act="del" title="Delete image">✕</button>
      </div>
    </div>
  `).join("");

  const pendingHtml = pendingFiles.map((pf, i) => `
    <div class="img-tile">
      <img src="${URL.createObjectURL(pf)}" alt="">
      <span class="pending">NEW</span>
      <div class="img-tools">
        <button type="button" data-pending-del="${i}" title="Remove">✕</button>
      </div>
    </div>
  `).join("");

  grid.innerHTML = serverHtml + pendingHtml;
}

// Drag and drop images
const drop = $("#drop");
const imgInput = $("#imgInput");
drop?.addEventListener("click", () => imgInput.click());
drop?.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
drop?.addEventListener("dragleave", () => drop.classList.remove("over"));
drop?.addEventListener("drop", e => {
  e.preventDefault();
  drop.classList.remove("over");
  if (e.dataTransfer.files) handleSelectedImages(e.dataTransfer.files);
});
imgInput?.addEventListener("change", () => {
  if (imgInput.files) handleSelectedImages(imgInput.files);
});

function handleSelectedImages(files) {
  for (const f of files) {
    if (f.type.startsWith("image/")) {
      if (f.size > 6 * 1024 * 1024) {
        toast(`"${f.name}" exceeds 6 MB limit`, "err");
        continue;
      }
      pendingFiles.push(f);
    }
  }
  const currentP = editingProductId ? currentProducts.find(x => x.id === editingProductId) : null;
  renderProductImageGrid(currentP ? currentP.images : []);
}

// Existing image cover / delete in modal
$("#imgGrid")?.addEventListener("click", async e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const currentP = editingProductId ? currentProducts.find(x => x.id === editingProductId) : null;

  if (btn.dataset.pendingDel !== undefined) {
    pendingFiles.splice(+btn.dataset.pendingDel, 1);
    renderProductImageGrid(currentP ? currentP.images : []);
    return;
  }

  const tile = btn.closest("[data-iid]");
  if (!tile) return;
  const iid = +tile.dataset.iid;

  if (btn.dataset.imgAct === "cover") {
    try {
      const updated = await apiAdmin(`/api/admin/images/${iid}/cover`, { method: "PATCH" });
      Object.assign(currentP, updated);
      renderProductImageGrid(currentP.images);
      renderProductRows();
      toast("Cover image set ✓");
    } catch (err) {
      toast(err.message, "err");
    }
  } else if (btn.dataset.imgAct === "del") {
    try {
      const updated = await apiAdmin(`/api/admin/images/${iid}`, { method: "DELETE" });
      Object.assign(currentP, updated);
      renderProductImageGrid(currentP.images);
      renderProductRows();
      toast("Image deleted ✓");
    } catch (err) {
      toast(err.message, "err");
    }
  }
});

// Save Product Form
$("#pForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const btn = $("#pSave");
  btn.disabled = true;
  btn.textContent = "Saving...";

  const rawPrice = form.price.value.trim();
  const rawOldPrice = form.old_price.value.trim();

  const payload = {
    name: form.name.value.trim(),
    brand: form.brand.value.trim(),
    origin: form.origin.value.trim(),
    unit: form.unit.value.trim() || "piece",
    price: rawPrice === "" ? null : parseFloat(rawPrice),
    old_price: rawOldPrice === "" ? null : parseFloat(rawOldPrice),
    moq: parseInt(form.moq.value, 10) || 1,
    availability: form.availability.value,
    expected_arrival: form.availability.value === "upcoming" ? form.expected_arrival.value.trim() : "",
    short_description: form.short_description.value.trim(),
    description: form.description.value.trim(),
    specs: form.specs.value.trim(),
    show_price: form.show_price.checked,
    is_featured: form.is_featured.checked,
    is_active: form.is_active.checked,
    category_id: form.category_id.value ? parseInt(form.category_id.value, 10) : null
  };

  try {
    let savedProduct;
    if (editingProductId) {
      savedProduct = await apiAdmin(`/api/admin/products/${editingProductId}`, {
        method: "PUT",
        body: payload
      });
      const idx = currentProducts.findIndex(x => x.id === editingProductId);
      if (idx !== -1) currentProducts[idx] = savedProduct;
      toast("Product details updated ✓");
    } else {
      savedProduct = await apiAdmin("/api/admin/products", {
        method: "POST",
        body: payload
      });
      currentProducts.unshift(savedProduct);
      toast("Product created successfully ✓");
    }

    // Upload any pending images
    if (pendingFiles.length > 0) {
      const fd = new FormData();
      for (const file of pendingFiles) {
        fd.append("files", file);
      }
      const updatedWithImgs = await apiAdmin(`/api/admin/products/${savedProduct.id}/images`, {
        method: "POST",
        body: fd
      });
      const idx = currentProducts.findIndex(x => x.id === savedProduct.id);
      if (idx !== -1) currentProducts[idx] = updatedWithImgs;
      toast("Images uploaded successfully ✓");
    }

    closeModal($("#pModal"));
    renderProductRows();
  } catch (err) {
    toast(err.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = editingProductId ? "Save Changes" : "Create Product";
  }
});

/* ---------------- Flyers ---------------- */
async function loadFlyers() {
  const grid = $("#flGrid");
  grid.innerHTML = `<p class="muted">Loading flyers...</p>`;
  try {
    currentFlyers = await apiAdmin("/api/admin/flyers");
    renderFlyers();
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--red)">Failed to load flyers: ${esc(err.message)}</p>`;
  }
}

function renderFlyers() {
  const grid = $("#flGrid");
  const cardsHtml = currentFlyers.map(f => `
    <div class="fl-card ${!f.is_active ? 'off' : ''}" data-fid="${f.id}">
      <div class="fl-img">
        <img src="${esc(f.image_url)}" alt="">
        <span class="fl-order">Order: ${f.sort_order}</span>
      </div>
      <div class="fl-info">
        <b>${esc(f.title || "No Title")}</b>
        <small>${esc(f.subtitle || "No subtitle")}</small>
        ${f.link ? `<small style="color:var(--gold)">Link: ${esc(f.link)}</small>` : ''}
      </div>
      <div class="fl-actions">
        <label class="tgl">
          <input type="checkbox" data-act="toggle-flyer" ${f.is_active ? 'checked' : ''}>
          <i></i> Visible
        </label>
        <button class="act" data-act="edit-flyer" title="Edit flyer">✏️</button>
        <button class="act del" data-act="del-flyer" title="Delete flyer">🗑️</button>
      </div>
    </div>
  `).join("");

  grid.innerHTML = cardsHtml + `
    <button class="add-tile" id="addFlyerTile">
      <span>🖼️</span>
      <b>+ Add New Flyer</b>
      <small>PNG, JPG or WEBP</small>
    </button>
  `;

  $("#addFlyerTile")?.addEventListener("click", () => openFlyerModal());
}

$("#newFlyer")?.addEventListener("click", () => openFlyerModal());

function openFlyerModal(f = null) {
  editingFlyerId = f ? f.id : null;
  $("#fModalTitle").textContent = f ? "Edit Flyer" : "Add Flyer";
  $("#fSave").textContent = f ? "Save Changes" : "Upload Flyer";

  const form = $("#fForm");
  form.reset();
  const preview = $("#fPreview");
  preview.hidden = true;
  $("#fImg").required = !f; // required only when adding new

  if (f) {
    form.title.value = f.title || "";
    form.subtitle.value = f.subtitle || "";
    form.link.value = f.link || "";
    form.sort_order.value = f.sort_order || 0;
    form.is_active.checked = f.is_active !== false;
    if (f.image_url) {
      preview.src = f.image_url;
      preview.hidden = false;
    }
  }

  openModal($("#fModal"));
}

$("#fDrop")?.addEventListener("click", () => $("#fImg").click());
$("#fImg")?.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (file) {
    $("#fPreview").src = URL.createObjectURL(file);
    $("#fPreview").hidden = false;
  }
});

$("#flGrid")?.addEventListener("click", e => {
  const card = e.target.closest("[data-fid]");
  if (!card) return;
  const fid = +card.dataset.fid;
  const f = currentFlyers.find(x => x.id === fid);
  if (!f) return;

  const btn = e.target.closest("[data-act]");
  if (!btn) return;

  if (btn.dataset.act === "edit-flyer") {
    openFlyerModal(f);
  } else if (btn.dataset.act === "del-flyer") {
    confirmAction("Delete Flyer", "Are you sure you want to remove this promotional flyer?", async () => {
      await apiAdmin(`/api/admin/flyers/${fid}`, { method: "DELETE" });
      currentFlyers = currentFlyers.filter(x => x.id !== fid);
      renderFlyers();
      toast("Flyer deleted ✓");
    });
  }
});

$("#flGrid")?.addEventListener("change", async e => {
  if (e.target.dataset.act === "toggle-flyer") {
    const card = e.target.closest("[data-fid]");
    const fid = +card.dataset.fid;
    const f = currentFlyers.find(x => x.id === fid);
    if (!f) return;

    const fd = new FormData();
    fd.append("title", f.title || "");
    fd.append("subtitle", f.subtitle || "");
    fd.append("link", f.link || "");
    fd.append("sort_order", f.sort_order || 0);
    fd.append("is_active", e.target.checked);

    try {
      const updated = await apiAdmin(`/api/admin/flyers/${fid}`, {
        method: "PUT",
        body: fd
      });
      Object.assign(f, updated);
      card.classList.toggle("off", !f.is_active);
      toast(`Flyer visibility updated ✓`);
    } catch (err) {
      e.target.checked = f.is_active;
      toast(err.message, "err");
    }
  }
});

// Save flyer
$("#fForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const btn = $("#fSave");
  btn.disabled = true;
  btn.textContent = "Uploading...";

  const fd = new FormData();
  fd.append("title", form.title.value.trim());
  fd.append("subtitle", form.subtitle.value.trim());
  fd.append("link", form.link.value.trim());
  fd.append("sort_order", parseInt(form.sort_order.value, 10) || 0);
  fd.append("is_active", form.is_active.checked);

  const file = $("#fImg").files?.[0];
  if (file) {
    fd.append("image", file);
  }

  try {
    if (editingFlyerId) {
      const updated = await apiAdmin(`/api/admin/flyers/${editingFlyerId}`, {
        method: "PUT",
        body: fd
      });
      const idx = currentFlyers.findIndex(x => x.id === editingFlyerId);
      if (idx !== -1) currentFlyers[idx] = updated;
      toast("Flyer updated ✓");
    } else {
      const created = await apiAdmin("/api/admin/flyers", {
        method: "POST",
        body: fd
      });
      currentFlyers.push(created);
      toast("Flyer added successfully ✓");
    }
    closeModal($("#fModal"));
    renderFlyers();
  } catch (err) {
    toast(err.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = editingFlyerId ? "Save Changes" : "Upload Flyer";
  }
});

/* ---------------- Categories ---------------- */
async function loadCategories() {
  const box = $("#catList");
  box.innerHTML = `<p class="muted">Loading categories...</p>`;
  try {
    currentCategories = await api("/api/categories");
    renderCategoryList();
  } catch (err) {
    box.innerHTML = `<p style="color:var(--red)">Failed to load categories: ${esc(err.message)}</p>`;
  }
}

function renderCategoryList() {
  const box = $("#catList");
  if (!currentCategories.length) {
    box.innerHTML = `<p class="muted">No categories created yet.</p>`;
    return;
  }
  box.innerHTML = currentCategories.map(c => `
    <div class="cat-row" data-cid="${c.id}">
      <input class="ci" value="${esc(c.icon || '🩺')}" maxlength="8" aria-label="Category icon">
      <input class="cn" value="${esc(c.name)}" maxlength="80" aria-label="Category name">
      <small>${c.product_count || 0} items</small>
      <button class="act" data-act="save-cat" title="Save category">💾</button>
      <button class="act del" data-act="del-cat" title="Delete category">🗑️</button>
    </div>
  `).join("");
}

// Add category
$("#catForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const icon = form.icon.value.trim() || "🩺";
  if (!name) return;

  try {
    const created = await apiAdmin("/api/admin/categories", {
      method: "POST",
      body: { name, icon }
    });
    currentCategories.push(created);
    form.reset();
    renderCategoryList();
    toast(`Category "${name}" added ✓`);
  } catch (err) {
    toast(err.message, "err");
  }
});

// Update or delete category
$("#catList")?.addEventListener("click", async e => {
  const row = e.target.closest(".cat-row");
  if (!row) return;
  const cid = +row.dataset.cid;
  const c = currentCategories.find(x => x.id === cid);
  if (!c) return;

  const btn = e.target.closest("[data-act]");
  if (!btn) return;

  if (btn.dataset.act === "save-cat") {
    const name = row.querySelector(".cn").value.trim();
    const icon = row.querySelector(".ci").value.trim() || "🩺";
    if (!name) { toast("Category name cannot be empty", "err"); return; }
    try {
      const updated = await apiAdmin(`/api/admin/categories/${cid}`, {
        method: "PUT",
        body: { name, icon }
      });
      Object.assign(c, updated);
      toast("Category saved ✓");
    } catch (err) {
      toast(err.message, "err");
    }
  } else if (btn.dataset.act === "del-cat") {
    confirmAction("Delete Category", `Are you sure you want to delete "${c.name}"? Products in this category will become Uncategorized.`, async () => {
      await apiAdmin(`/api/admin/categories/${cid}`, { method: "DELETE" });
      currentCategories = currentCategories.filter(x => x.id !== cid);
      renderCategoryList();
      toast("Category deleted ✓");
    });
  }
});

/* ---------------- Security: Password Change ---------------- */
const newPw = $("#newPw");
const pwMeter = $("#pwMeter");

newPw?.addEventListener("input", () => {
  const v = newPw.value;
  let score = 0;
  if (v.length >= 10) score += 25;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score += 25;
  if (/\d/.test(v)) score += 25;
  if (/[^A-Za-z0-9]/.test(v)) score += 25;

  pwMeter.style.width = score + "%";
  if (score < 50) pwMeter.style.background = "var(--red)";
  else if (score < 100) pwMeter.style.background = "var(--amber)";
  else pwMeter.style.background = "var(--teal)";
});

$("#pwForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const cur = form.current_password.value;
  const n1 = form.new_password.value;
  const n2 = form.confirm.value;

  if (n1 !== n2) {
    toast("New passwords do not match", "err");
    return;
  }
  if (n1.length < 10) {
    toast("New password must be at least 10 characters", "err");
    return;
  }

  try {
    await apiAdmin("/api/auth/change-password", {
      method: "POST",
      body: {
        current_password: cur,
        new_password: n1
      }
    });
    toast("Password updated! All other sessions were signed out ✓");
    form.reset();
    pwMeter.style.width = "0%";
  } catch (err) {
    toast(err.message, "err");
  }
});

/* ---------------- Init ---------------- */
checkAuth();
