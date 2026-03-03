
(() => {
  "use strict";
  const K = "bahnasawi_coffee_erp_v1";
  const AUTH_USER = "maher1";
  const AUTH_PASS = "2012004";
  const AUTH_SESSION_KEY = "bahnasawi_auth_ok";
  const S = 8;

  const st = {
    d: {
      products: [],
      agents: [],
      customers: [],
      orders: [],
      customerOrders: [],
      gifts: [],
      returns: [],
      customerReturns: [],
      payments: [],
      inventoryMoves: [],
      permitCounter: 1
    },
    u: {
      p: "dashboard",
      pp: 1,
      ap: 1,
      cp: 1,
      items: [],
      cItems: [],
      editOrderId: "",
      editCustomerOrderId: "",
      editGiftId: "",
      f: { from: "", to: "", agentId: "all" },
      issueF: { ordersFrom: "", ordersTo: "", customerFrom: "", customerTo: "", giftsFrom: "", giftsTo: "" }
    },
    c: { top: null, ag: null, flow: null }
  };
  const el = {};

  const U = {
    id: () => `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    m: n => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    q: n => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
    d: d => String(d || "").slice(0, 10),
    t: () => new Date().toISOString().slice(0, 10),
    e: s => String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])),
    inRange(date, from, to) {
      const d = String(date || "").slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    }
  };

  const Units = {
    options(selected) {
      return [
        `<option value="bag" ${selected === "bag" ? "selected" : ""}>كيس</option>`,
        `<option value="box" ${selected === "box" ? "selected" : ""}>علبة</option>`,
        `<option value="carton" ${selected === "carton" ? "selected" : ""}>كرتونة</option>`
      ].join("");
    },
    toBags(qty, unit, p) {
      const q = +qty || 0;
      if (q <= 0) return 0;
      const perBox = +p.bagPerBox || 0;
      const boxesPerCarton = +p.bagPerCarton || 0;
      if (unit === "bag") return q;
      if (unit === "box") return perBox > 0 ? q * perBox : NaN;
      if (unit === "carton") return perBox > 0 && boxesPerCarton > 0 ? q * boxesPerCarton * perBox : NaN;
      return q;
    },
    breakdown(bags, p) {
      const total = Math.max(0, Math.floor(+bags || 0));
      const perBox = +p.bagPerBox || 0;
      const boxesPerCarton = +p.bagPerCarton || 0;
      const perCartonBags = perBox > 0 && boxesPerCarton > 0 ? perBox * boxesPerCarton : 0;
      let cartons = 0;
      let boxes = 0;
      let rem = total;
      if (perCartonBags > 0) {
        cartons = Math.floor(rem / perCartonBags);
        rem -= cartons * perCartonBags;
      }
      if (perBox > 0) {
        boxes = Math.floor(rem / perBox);
        rem -= boxes * perBox;
      }
      return { cartons, boxes, bags: rem };
    },
    format(bags, p) {
      const b = this.breakdown(bags, p);
      return `${b.cartons} كرتونة - ${b.boxes} علبة - ${b.bags} كيس`;
    }
  };

  const normalizeProduct = p => {
    const price = +p.price || 0;
    const openingStock = +p.openingStock || 0;
    const currentStock = +((p.currentStock ?? openingStock) || 0);
    const perBoxRaw = +p.bagPerBox || 1;
    const perCartonRaw = +p.bagPerCarton || 1;
    const bagPerBox = Number.isInteger(perBoxRaw) && perBoxRaw > 0 ? perBoxRaw : 1;
    const bagPerCarton = Number.isInteger(perCartonRaw) && perCartonRaw > 0 ? perCartonRaw : Math.max(1, bagPerBox);
    return { ...p, price, openingStock, currentStock, bagPerBox, bagPerCarton };
  };

  const pricePerBag = p => (+p.price || 0) / Math.max(1, +p.bagPerBox || 1);
  const DB = {
    ensurePermits() {
      const rows = []
        .concat((st.d.orders || []).map(x => ({ ...x, __kind: "order" })))
        .concat((st.d.customerOrders || []).map(x => ({ ...x, __kind: "customer-order" })))
        .concat((st.d.gifts || []).map(x => ({ ...x, __kind: "gift" })));
      if (!rows.length) {
        st.d.permitCounter = Math.max(1, +st.d.permitCounter || 1);
        return;
      }

      const maxExisting = rows.reduce((m, r) => {
        const n = +r.permitNo || 0;
        return n > m ? n : m;
      }, 0);

      if (maxExisting <= 0) {
        rows
          .slice()
          .sort((a, b) => `${String(a.date || "")}_${String(a.id || "")}`.localeCompare(`${String(b.date || "")}_${String(b.id || "")}`))
          .forEach((r, idx) => {
            const no = idx + 1;
            if (r.__kind === "order") {
              const t = st.d.orders.find(x => x.id === r.id);
              if (t) t.permitNo = no;
            } else if (r.__kind === "customer-order") {
              const t = st.d.customerOrders.find(x => x.id === r.id);
              if (t) t.permitNo = no;
            } else {
              const t = st.d.gifts.find(x => x.id === r.id);
              if (t) t.permitNo = no;
            }
          });
        st.d.permitCounter = rows.length + 1;
        return;
      }

      let next = maxExisting;
      rows.forEach(r => {
        if (+r.permitNo > 0) return;
        next += 1;
        if (r.__kind === "order") {
          const t = st.d.orders.find(x => x.id === r.id);
          if (t) t.permitNo = next;
        } else if (r.__kind === "customer-order") {
          const t = st.d.customerOrders.find(x => x.id === r.id);
          if (t) t.permitNo = next;
        } else {
          const t = st.d.gifts.find(x => x.id === r.id);
          if (t) t.permitNo = next;
        }
      });
      st.d.permitCounter = Math.max(next + 1, +st.d.permitCounter || 1);
    },
    load() {
      const r = localStorage.getItem(K);
      if (!r) return;
      try {
        const p = JSON.parse(r);
        const pro = (p.products || []).map(normalizeProduct);
        st.d = {
          products: pro,
          agents: p.agents || [],
          customers: p.customers || [],
          orders: p.orders || [],
          customerOrders: p.customerOrders || [],
          gifts: p.gifts || [],
          returns: p.returns || [],
          customerReturns: p.customerReturns || [],
          payments: p.payments || [],
          inventoryMoves: p.inventoryMoves || [],
          permitCounter: Math.max(1, +p.permitCounter || 1)
        };
        this.ensurePermits();
      } catch {
        /* ignore */
      }
    },
    save() {
      localStorage.setItem(K, JSON.stringify(st.d));
    },
    clear() {
      localStorage.removeItem(K);
      st.d = {
        products: [],
        agents: [],
        customers: [],
        orders: [],
        customerOrders: [],
        gifts: [],
        returns: [],
        customerReturns: [],
        payments: [],
        inventoryMoves: [],
        permitCounter: 1
      };
    }
  };

  const C = {
    agt(id) {
      const o = st.d.orders.filter(x => x.agentId === id).reduce((a, b) => a + +b.total, 0);
      const r = st.d.returns.filter(x => x.agentId === id).reduce((a, b) => a + +b.total, 0);
      const p = st.d.payments.filter(x => x.agentId === id).reduce((a, b) => a + +b.amount, 0);
      return { out: o, ret: r, paid: p, bal: o - r - p };
    },
    cst(id) {
      const o = st.d.customerOrders.filter(x => x.customerId === id).reduce((a, b) => a + +b.total, 0);
      const q = st.d.customerOrders
        .filter(x => x.customerId === id)
        .reduce((a, b) => a + b.items.reduce((s, it) => s + (+it.bagsQty || 0), 0), 0);
      return { out: o, qty: q };
    },
    stats() {
      const tp = st.d.products.length;
      const ta = st.d.agents.length;
      const ts = st.d.products.reduce((a, p) => a + +p.currentStock, 0);
      const td = st.d.agents.reduce((a, g) => a + Math.max(0, this.agt(g.id).bal), 0);
      const tv = st.d.orders.concat(st.d.customerOrders || []).reduce((a, o) => a + +o.total, 0);
      return { tp, ta, ts, td, tv };
    },
    fd(rows, key = "date") {
      const { from, to } = st.u.f;
      return rows.filter(r => {
        const d = String(r[key] || "").slice(0, 10);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }
  };

  const UI = {
    cache() {
      el.nav = document.querySelectorAll(".nav-btn");
      el.pages = document.querySelectorAll(".page");
      [
        "loginGate",
        "loginForm",
        "loginUser",
        "loginPass",
        "loginBtn",
        "loginError",
        "logoutBtn",
        "statsGrid",
        "loader",
        "modalRoot",
        "toastContainer",
        "addProductBtn",
        "productSearch",
        "productsTableBody",
        "productsPagination",
        "inventoryTableBody",
        "addAgentBtn",
        "agentSearch",
        "agentsTableBody",
        "agentsPagination",
        "orderAgentSelect",
        "orderDate",
        "orderItemsContainer",
        "addOrderItemBtn",
        "orderTotal",
        "saveOrderBtn",
        "ordersFromDate",
        "ordersToDate",
        "ordersHistoryTableBody",
        "addCustomerBtn",
        "customerSearch",
        "customersTableBody",
        "customersPagination",
        "customerOrderCustomerSelect",
        "customerOrderDate",
        "customerOrderItemsContainer",
        "addCustomerOrderItemBtn",
        "customerOrderTotal",
        "saveCustomerOrderBtn",
        "customerOrdersFromDate",
        "customerOrdersToDate",
        "customerOrdersHistoryTableBody",
        "giftType",
        "giftProductSelect",
        "giftQty",
        "giftUnit",
        "giftTarget",
        "giftDate",
        "giftNote",
        "saveGiftBtn",
        "giftsFromDate",
        "giftsToDate",
        "giftsHistoryTableBody",
        "customerReturnCustomerSelect",
        "customerReturnProductSelect",
        "customerReturnQty",
        "customerReturnUnit",
        "customerReturnValue",
        "customerReturnDate",
        "saveCustomerReturnBtn",
        "returnAgentSelect",
        "returnProductSelect",
        "returnQty",
        "returnUnit",
        "returnValue",
        "returnDate",
        "saveReturnBtn",
        "reportFromDate",
        "reportToDate",
        "reportAgentSelect",
        "applyReportFilters",
        "agentsReportBody",
        "warehouseReportBody",
        "stockReportBody",
        "topProductsReportBody",
        "profitReportBody",
        "customersReportBody",
        "giftsReportBody",
        "exportDataBtn",
        "importDataInput",
        "clearDataBtn",
        "printCurrentPage"
      ].forEach(i => (el[i] = document.getElementById(i)));
      el.rActions = document.querySelectorAll(".report-actions");
    },
    toast(m, t = "success") {
      const x = document.createElement("div");
      x.className = `toast ${t}`;
      x.textContent = m;
      el.toastContainer.appendChild(x);
      setTimeout(() => x.remove(), 3000);
    },
    sw(p) {
      st.u.p = p;
      el.nav.forEach(b => b.classList.toggle("active", b.dataset.page === p));
      el.pages.forEach(g => g.classList.toggle("active", g.id === `page-${p}`));
    },
    modal({ title, fields, onSubmit, submitText = "حفظ", afterRender }) {
      el.modalRoot.innerHTML = `
        <div class="modal-overlay">
          <div class="modal">
            <div class="modal-head">
              <h3>${U.e(title)}</h3>
              <button class="btn ghost" data-c>إغلاق</button>
            </div>
            <form id="mf">
              <div class="grid-2">
                ${fields
                  .map(
                    f => `
                    <div>
                      <label>${U.e(f.label)}</label>
                      ${
                        f.type === "note"
                          ? `<div id="m_${f.name}" class="input-note">${U.e(f.value || "")}</div>`
                          : `<input
                              id="m_${f.name}"
                              type="${f.type || "text"}"
                              value="${U.e(f.value || "")}" 
                              ${f.readonly ? "readonly" : ""}
                              ${f.min !== undefined ? `min="${f.min}"` : ""}
                              ${f.step !== undefined ? `step="${f.step}"` : ""}
                              ${f.placeholder ? `placeholder="${U.e(f.placeholder)}"` : ""}
                            >`
                      }
                    </div>`
                  )
                  .join("")}
              </div>
              <div style="margin-top:12px;display:flex;gap:8px">
                <button class="btn primary" type="submit">${U.e(submitText)}</button>
                <button class="btn ghost" type="button" data-c>إلغاء</button>
              </div>
            </form>
          </div>
        </div>`;
      const cls = () => (el.modalRoot.innerHTML = "");
      el.modalRoot.querySelectorAll("[data-c]").forEach(b => (b.onclick = cls));
      document.getElementById("mf").onsubmit = e => {
        e.preventDefault();
        const v = {};
        fields.forEach(f => {
          if (f.type === "note") return;
          v[f.name] = document.getElementById(`m_${f.name}`).value.trim();
        });
        onSubmit(v, cls);
      };
      if (typeof afterRender === "function") afterRender();
    },
    cf: m => confirm(m),
    updateInvPreview(id, mode) {
      const p = st.d.products.find(x => x.id === id);
      if (!p) return;
      const c = document.querySelector(`[data-${mode}-carton='${id}']`);
      const b = document.querySelector(`[data-${mode}-box='${id}']`);
      const g = document.querySelector(`[data-${mode}-bag='${id}']`);
      const out = document.querySelector(`[data-${mode}-preview='${id}']`);
      if (!c || !b || !g || !out) return;
      const bags = Inv.calcBagsFromInputs(+c.value || 0, +b.value || 0, +g.value || 0, p);
      out.textContent = `يعادل: ${U.q(bags)} كيس`;
    }
  };

  const Pg = {
    slice(r, p) {
      const t = Math.max(1, Math.ceil(r.length / S));
      const sp = Math.min(Math.max(1, p), t);
      const s = (sp - 1) * S;
      return { t, sp, d: r.slice(s, s + S) };
    },
    draw(c, t, p, h) {
      c.innerHTML = "";
      for (let i = 1; i <= t; i++) {
        const b = document.createElement("button");
        b.className = `page-btn ${i === p ? "active" : ""}`;
        b.textContent = i;
        b.onclick = () => h(i);
        c.appendChild(b);
      }
    }
  };

  const validateUnits = (perBox, perCarton) => {
    if (!Number.isInteger(perBox) || perBox <= 0) return "عدد الأكياس في العلبة غير صحيح";
    if (!Number.isInteger(perCarton) || perCarton <= 0) return "عدد العلب في الكرتونة غير صحيح";
    return "";
  };

  const buildPricePreview = (boxPrice, perBox, perCarton) => {
    const p = Math.max(0, +boxPrice || 0);
    const b = Math.max(1, +perBox || 1);
    const c = Math.max(1, +perCarton || 1);
    const bagPrice = p / b;
    const cartonPrice = p * c;
    return `سعر الكيس: ${U.m(bagPrice)} | سعر الكرتونة: ${U.m(cartonPrice)}`;
  };

  const P = {
    add() {
      UI.modal({
        title: "إضافة منتج",
        fields: [
          { name: "name", label: "اسم المنتج" },
          { name: "price", label: "سعر العلبة", type: "number", step: 0.01, min: 0 },
          { name: "bagPerBox", label: "عدد الأكياس في العلبة", type: "number", step: 1, min: 1 },
          { name: "bagPerCarton", label: "عدد العلب في الكرتونة", type: "number", step: 1, min: 1 },
          { name: "pricePreview", label: "تسعيرة محسوبة", type: "note", value: "سعر الكيس: -- | سعر الكرتونة: --" }
        ],
        afterRender: () => {
          const price = document.getElementById("m_price");
          const perBox = document.getElementById("m_bagPerBox");
          const perCarton = document.getElementById("m_bagPerCarton");
          const preview = document.getElementById("m_pricePreview");
          const update = () => {
            preview.textContent = buildPricePreview(price.value, perBox.value, perCarton.value);
          };
          [price, perBox, perCarton].forEach(i => (i.oninput = update));
          update();
        },
        onSubmit: (v, cl) => {
          const perBox = Math.floor(+v.bagPerBox || 0);
          const perCarton = Math.floor(+v.bagPerCarton || 0);
          const err = validateUnits(perBox, perCarton);
          if (!v.name || +v.price <= 0 || err) return UI.toast(err || "تحقق من البيانات", "error");
          const p = normalizeProduct({
            id: U.id(),
            name: v.name,
            price: +v.price,
            bagPerBox: perBox,
            bagPerCarton: perCarton,
            openingStock: 0,
            currentStock: 0,
            createdAt: new Date().toISOString()
          });
          st.d.products.push(p);
          DB.save();
          R.all();
          cl();
          UI.toast("تمت الإضافة");
        }
      });
    },
    edit(id) {
      const p = st.d.products.find(x => x.id === id);
      if (!p) return;
      UI.modal({
        title: "تعديل المنتج",
        fields: [
          { name: "name", label: "الاسم", value: p.name },
          { name: "price", label: "سعر العلبة", type: "number", step: 0.01, min: 0, value: p.price },
          { name: "bagPerBox", label: "عدد الأكياس في العلبة", type: "number", step: 1, min: 1, value: p.bagPerBox },
          { name: "bagPerCarton", label: "عدد العلب في الكرتونة", type: "number", step: 1, min: 1, value: p.bagPerCarton },
          { name: "pricePreview", label: "تسعيرة محسوبة", type: "note", value: buildPricePreview(p.price, p.bagPerBox, p.bagPerCarton) }
        ],
        afterRender: () => {
          const price = document.getElementById("m_price");
          const perBox = document.getElementById("m_bagPerBox");
          const perCarton = document.getElementById("m_bagPerCarton");
          const preview = document.getElementById("m_pricePreview");
          const update = () => {
            preview.textContent = buildPricePreview(price.value, perBox.value, perCarton.value);
          };
          [price, perBox, perCarton].forEach(i => (i.oninput = update));
          update();
        },
        onSubmit: (v, cl) => {
          const perBox = Math.floor(+v.bagPerBox || 0);
          const perCarton = Math.floor(+v.bagPerCarton || 0);
          const err = validateUnits(perBox, perCarton);
          if (!v.name || +v.price <= 0 || err) return UI.toast(err || "تحقق من البيانات", "error");
          p.name = v.name;
          p.price = +v.price;
          p.bagPerBox = perBox;
          p.bagPerCarton = perCarton;
          DB.save();
          R.all();
          cl();
          UI.toast("تم التعديل");
        }
      });
    },
    del(id) {
      if (!UI.cf("حذف المنتج؟")) return;
      st.d.products = st.d.products.filter(x => x.id !== id);
      DB.save();
      R.all();
      UI.toast("تم الحذف", "info");
    }
  };
  const Inv = {
    calcBagsFromInputs(cartons, boxes, bagsInput, p) {
      return (cartons * (p.bagPerCarton || 0) + boxes) * (p.bagPerBox || 0) + bagsInput;
    },
    productOpeningMoves(productId) {
      return st.d.inventoryMoves.filter(m => m.productId === productId && m.ref === "opening");
    },
    productFactoryMoves(productId) {
      return st.d.inventoryMoves.filter(m => m.productId === productId && m.ref === "factory");
    },
    latestMoveByRef(productId, ref) {
      for (let i = st.d.inventoryMoves.length - 1; i >= 0; i--) {
        const m = st.d.inventoryMoves[i];
        if (m.productId === productId && m.ref === ref) return m;
      }
      return null;
    },
    latestOpeningMove(productId) {
      return this.latestMoveByRef(productId, "opening");
    },
    latestFactoryMove(productId) {
      return this.latestMoveByRef(productId, "factory");
    },
    editOpeningByProduct(productId) {
      const m = this.latestOpeningMove(productId);
      if (!m) return UI.toast("لا توجد عملية أول مدة للتعديل", "error");
      this.editOpeningMove(m.id);
    },
    delOpeningByProduct(productId) {
      const m = this.latestOpeningMove(productId);
      if (!m) return UI.toast("لا توجد عملية أول مدة للحذف", "error");
      this.delOpeningMove(m.id);
    },
    editFactoryByProduct(productId) {
      const m = this.latestFactoryMove(productId);
      if (!m) return UI.toast("لا توجد عملية وارد للتعديل", "error");
      this.editFactoryMove(m.id);
    },
    delFactoryByProduct(productId) {
      const m = this.latestFactoryMove(productId);
      if (!m) return UI.toast("لا توجد عملية وارد للحذف", "error");
      this.delFactoryMove(m.id);
    },
    openingDelta(m) {
      const q = Math.abs(+m.qty || 0);
      if (+m.effect === -1) return -q;
      return q;
    },
    editOpeningMove(moveId) {
      const m = st.d.inventoryMoves.find(x => x.id === moveId && x.ref === "opening");
      if (!m) return UI.toast("العملية غير متاحة للتعديل", "error");
      const p = st.d.products.find(x => x.id === m.productId);
      if (!p) return UI.toast("المنتج غير موجود", "error");
      const oldDelta = this.openingDelta(m);
      const b = Units.breakdown(Math.abs(oldDelta), p);
      UI.modal({
        title: `تعديل أول المدة - ${p.name}`,
        fields: [
          { name: "cartons", label: "كرتونة", type: "number", min: 0, step: 1, value: b.cartons },
          { name: "boxes", label: "علبة", type: "number", min: 0, step: 1, value: b.boxes },
          { name: "bags", label: "كيس", type: "number", min: 0, step: 1, value: b.bags },
          { name: "date", label: "التاريخ", type: "date", value: U.d(m.date) || U.t() }
        ],
        submitText: "حفظ التعديل",
        onSubmit: (v, cl) => {
          const cartons = Math.max(0, Math.floor(+v.cartons || 0));
          const boxes = Math.max(0, Math.floor(+v.boxes || 0));
          const bagsInput = Math.max(0, Math.floor(+v.bags || 0));
          const qty = this.calcBagsFromInputs(cartons, boxes, bagsInput, p);
          if (!Number.isFinite(qty) || qty < 0) return UI.toast("أدخل كمية صحيحة", "error");
          const sign = oldDelta < 0 ? -1 : 1;
          const newDelta = qty * sign;
          const diff = newDelta - oldDelta;
          if (+p.currentStock + diff < 0 || +p.openingStock + diff < 0) return UI.toast("لا يمكن تعديل العملية لأن الرصيد سيصبح سالبًا", "error");
          p.currentStock = (+p.currentStock || 0) + diff;
          p.openingStock = (+p.openingStock || 0) + diff;
          m.qty = Math.abs(newDelta);
          m.effect = newDelta < 0 ? -1 : 1;
          m.value = Math.abs(newDelta) * pricePerBag(p);
          m.date = v.date || U.t();
          DB.save();
          R.all();
          cl();
          UI.toast("تم تعديل عملية أول المدة");
        }
      });
    },
    delOpeningMove(moveId) {
      const i = st.d.inventoryMoves.findIndex(x => x.id === moveId && x.ref === "opening");
      if (i < 0) return UI.toast("العملية غير متاحة للحذف", "error");
      const m = st.d.inventoryMoves[i];
      const p = st.d.products.find(x => x.id === m.productId);
      if (!p) return UI.toast("المنتج غير موجود", "error");
      if (!UI.cf("حذف عملية أول المدة؟")) return;
      const delta = this.openingDelta(m);
      if (+p.currentStock - delta < 0 || +p.openingStock - delta < 0) return UI.toast("لا يمكن حذف العملية لأن الرصيد سيصبح سالبًا", "error");
      p.currentStock = (+p.currentStock || 0) - delta;
      p.openingStock = (+p.openingStock || 0) - delta;
      st.d.inventoryMoves.splice(i, 1);
      DB.save();
      R.all();
      UI.toast("تم حذف عملية أول المدة", "info");
    },
    editFactoryMove(moveId) {
      const m = st.d.inventoryMoves.find(x => x.id === moveId && x.ref === "factory");
      if (!m) return UI.toast("العملية غير متاحة للتعديل", "error");
      const p = st.d.products.find(x => x.id === m.productId);
      if (!p) return UI.toast("المنتج غير موجود", "error");
      const b = Units.breakdown(m.qty, p);
      UI.modal({
        title: `تعديل وارد - ${p.name}`,
        fields: [
          { name: "cartons", label: "كرتونة", type: "number", min: 0, step: 1, value: b.cartons },
          { name: "boxes", label: "علبة", type: "number", min: 0, step: 1, value: b.boxes },
          { name: "bags", label: "كيس", type: "number", min: 0, step: 1, value: b.bags },
          { name: "date", label: "التاريخ", type: "date", value: U.d(m.date) || U.t() }
        ],
        submitText: "حفظ التعديل",
        onSubmit: (v, cl) => {
          const cartons = Math.max(0, Math.floor(+v.cartons || 0));
          const boxes = Math.max(0, Math.floor(+v.boxes || 0));
          const bagsInput = Math.max(0, Math.floor(+v.bags || 0));
          const qty = this.calcBagsFromInputs(cartons, boxes, bagsInput, p);
          if (!Number.isFinite(qty) || qty <= 0) return UI.toast("أدخل كمية صحيحة", "error");
          const diff = qty - (+m.qty || 0);
          if (+p.currentStock + diff < 0) return UI.toast("لا يمكن تقليل العملية بهذا الشكل لأن الرصيد الحالي لا يكفي", "error");
          p.currentStock = (+p.currentStock || 0) + diff;
          m.qty = qty;
          m.value = qty * pricePerBag(p);
          m.date = v.date || U.t();
          DB.save();
          R.all();
          cl();
          UI.toast("تم تعديل العملية");
        }
      });
    },
    delFactoryMove(moveId) {
      const i = st.d.inventoryMoves.findIndex(x => x.id === moveId && x.ref === "factory");
      if (i < 0) return UI.toast("العملية غير متاحة للحذف", "error");
      const m = st.d.inventoryMoves[i];
      const p = st.d.products.find(x => x.id === m.productId);
      if (!p) return UI.toast("المنتج غير موجود", "error");
      if (!UI.cf("حذف عملية الوارد؟")) return;
      if (+p.currentStock - (+m.qty || 0) < 0) return UI.toast("لا يمكن حذف العملية لأن الرصيد الحالي لا يكفي", "error");
      p.currentStock = (+p.currentStock || 0) - (+m.qty || 0);
      st.d.inventoryMoves.splice(i, 1);
      DB.save();
      R.all();
      UI.toast("تم حذف العملية", "info");
    },
    setOpen(id) {
      const p = st.d.products.find(x => x.id === id);
      const cInp = document.querySelector(`[data-open-carton='${id}']`);
      const bInp = document.querySelector(`[data-open-box='${id}']`);
      const gInp = document.querySelector(`[data-open-bag='${id}']`);
      if (!p || !cInp || !bInp || !gInp) return;
      const cartons = +cInp.value || 0;
      const boxes = +bInp.value || 0;
      const bagsInput = +gInp.value || 0;
      const bags = this.calcBagsFromInputs(cartons, boxes, bagsInput, p);
      if (!Number.isFinite(bags) || bags < 0) return UI.toast("رصيد أول المدة غير صحيح", "error");
      const diff = bags - (+p.openingStock || 0);
      p.openingStock = bags;
      p.currentStock = (+p.currentStock || 0) + diff;
      if (diff !== 0) {
        st.d.inventoryMoves.push({
          id: U.id(),
          type: "in",
          productId: id,
          qty: Math.abs(diff),
          effect: diff < 0 ? -1 : 1,
          value: Math.abs(diff) * pricePerBag(p),
          date: U.t(),
          ref: "opening"
        });
      }
      DB.save();
      R.all();
      UI.toast("تم حفظ رصيد أول المدة");
    },
    addFactory(id) {
      const p = st.d.products.find(x => x.id === id);
      const cInp = document.querySelector(`[data-factory-carton='${id}']`);
      const bInp = document.querySelector(`[data-factory-box='${id}']`);
      const gInp = document.querySelector(`[data-factory-bag='${id}']`);
      if (!p || !cInp || !bInp || !gInp) return;
      const cartons = +cInp.value || 0;
      const boxes = +bInp.value || 0;
      const bagsInput = +gInp.value || 0;
      const bags = this.calcBagsFromInputs(cartons, boxes, bagsInput, p);
      if (!Number.isFinite(bags) || bags <= 0) return UI.toast("أدخل كمية وارد صحيحة", "error");
      p.currentStock = (+p.currentStock || 0) + bags;
      st.d.inventoryMoves.push({
        id: U.id(),
        type: "in",
        productId: id,
        qty: bags,
        value: bags * pricePerBag(p),
        date: U.t(),
        ref: "factory"
      });
      cInp.value = "";
      bInp.value = "";
      gInp.value = "";
      DB.save();
      R.all();
      UI.toast("تمت إضافة الوارد من المصنع");
    }
  };

  const A = {
    add() {
      UI.modal({
        title: "إضافة مندوب",
        fields: [
          { name: "name", label: "اسم المندوب" },
          { name: "phone", label: "رقم الهاتف" },
          { name: "vehicle", label: "العربية" }
        ],
        onSubmit: (v, cl) => {
          if (!v.name) return UI.toast("الاسم مطلوب", "error");
          st.d.agents.push({ id: U.id(), name: v.name, phone: v.phone, vehicle: v.vehicle, createdAt: new Date().toISOString() });
          DB.save();
          R.all();
          cl();
          UI.toast("تمت الإضافة");
        }
      });
    },
    edit(id) {
      const a = st.d.agents.find(x => x.id === id);
      if (!a) return;
      UI.modal({
        title: "تعديل المندوب",
        fields: [
          { name: "name", label: "الاسم", value: a.name },
          { name: "phone", label: "الهاتف", value: a.phone },
          { name: "vehicle", label: "العربية", value: a.vehicle }
        ],
        onSubmit: (v, cl) => {
          if (!v.name) return UI.toast("الاسم مطلوب", "error");
          a.name = v.name;
          a.phone = v.phone;
          a.vehicle = v.vehicle;
          DB.save();
          R.all();
          cl();
          UI.toast("تم التعديل");
        }
      });
    },
    pay(id) {
      const a = st.d.agents.find(x => x.id === id);
      if (!a) return;
      UI.modal({
        title: `تسجيل سداد - ${a.name}`,
        fields: [
          { name: "amount", label: "المبلغ", type: "number", step: 0.01, min: 0 },
          { name: "date", label: "التاريخ", type: "date", value: U.t() },
          { name: "note", label: "ملاحظة" }
        ],
        onSubmit: (v, cl) => {
          if (+v.amount <= 0 || !v.date) return UI.toast("تحقق من السداد", "error");
          st.d.payments.push({ id: U.id(), agentId: id, amount: +v.amount, date: v.date, note: v.note || "" });
          DB.save();
          R.all();
          cl();
          UI.toast("تم تسجيل السداد");
        }
      });
    },
    del(id) {
      if (!UI.cf("حذف المندوب؟")) return;
      st.d.agents = st.d.agents.filter(x => x.id !== id);
      DB.save();
      R.all();
      UI.toast("تم الحذف", "info");
    }
  };

  const Cm = {
    add() {
      UI.modal({
        title: "إضافة عميل",
        fields: [
          { name: "name", label: "اسم العميل" },
          { name: "phone", label: "رقم الهاتف" },
          { name: "address", label: "العنوان" }
        ],
        onSubmit: (v, cl) => {
          if (!v.name) return UI.toast("الاسم مطلوب", "error");
          st.d.customers.push({ id: U.id(), name: v.name, phone: v.phone, address: v.address, createdAt: new Date().toISOString() });
          DB.save();
          R.all();
          cl();
          UI.toast("تمت إضافة العميل");
        }
      });
    },
    edit(id) {
      const c = st.d.customers.find(x => x.id === id);
      if (!c) return;
      UI.modal({
        title: "تعديل العميل",
        fields: [
          { name: "name", label: "الاسم", value: c.name },
          { name: "phone", label: "الهاتف", value: c.phone },
          { name: "address", label: "العنوان", value: c.address }
        ],
        onSubmit: (v, cl) => {
          if (!v.name) return UI.toast("الاسم مطلوب", "error");
          c.name = v.name;
          c.phone = v.phone;
          c.address = v.address;
          DB.save();
          R.all();
          cl();
          UI.toast("تم تعديل العميل");
        }
      });
    },
    del(id) {
      if (!UI.cf("حذف العميل؟")) return;
      st.d.customers = st.d.customers.filter(x => x.id !== id);
      DB.save();
      R.all();
      UI.toast("تم حذف العميل", "info");
    }
  };

  const CO = {
    reset() {
      st.u.cItems = [];
      st.u.editCustomerOrderId = "";
      el.customerOrderDate.value = U.t();
      el.saveCustomerOrderBtn.textContent = "حفظ طلبية العميل";
      this.add();
      this.ri();
      this.ut();
    },
    add() {
      st.u.cItems.push({ productId: "", qty: 0, unit: "bag", bagsQty: 0, price: 0, total: 0 });
    },
    rem(i) {
      st.u.cItems.splice(i, 1);
      if (!st.u.cItems.length) this.add();
      this.ri();
      this.ut();
    },
    ri() {
      el.customerOrderItemsContainer.innerHTML = st.u.cItems
        .map(
          (it, i) => `
          <div class="order-item" data-ci="${i}">
            <div class="grid-4">
              <div>
                <label>المنتج</label>
                <select class="cop">
                  <option value="">اختر المنتج</option>
                  ${st.d.products
                    .map(p => `<option value="${p.id}" ${it.productId === p.id ? "selected" : ""}>${U.e(p.name)}</option>`)
                    .join("")}
                </select>
              </div>
              <div>
                <label>الوحدة</label>
                <select class="cou">${Units.options(it.unit || "bag")}</select>
              </div>
              <div>
                <label>الكمية</label>
                <input class="coq" type="number" step="1" min="0" value="${it.qty || ""}">
              </div>
              <div>
                <label>سعر الكيس (محسوب)</label>
                <input class="cos" type="number" value="${it.price}" readonly>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;flex-wrap:wrap;gap:6px">
              <span>إجمالي الصنف: <strong class="cot">${U.m(it.total)}</strong> جنيه</span>
              <span class="coqb">يعادل: ${U.q(it.bagsQty || 0)} كيس</span>
              <button class="btn danger cod" type="button">حذف</button>
            </div>
          </div>`
        )
        .join("");

      el.customerOrderItemsContainer.querySelectorAll(".order-item").forEach(c => {
        const i = +c.dataset.ci;
        c.querySelector(".cop").onchange = e => {
          const p = st.d.products.find(x => x.id === e.target.value);
          st.u.cItems[i].productId = e.target.value;
          st.u.cItems[i].price = p ? pricePerBag(p) : 0;
          this.rc(i);
          this.ri();
        };
        c.querySelector(".cou").onchange = e => {
          st.u.cItems[i].unit = e.target.value || "bag";
          this.rc(i);
          c.querySelector(".coqb").textContent = `يعادل: ${U.q(st.u.cItems[i].bagsQty || 0)} كيس`;
        };
        c.querySelector(".coq").oninput = e => {
          st.u.cItems[i].qty = +e.target.value || 0;
          this.rc(i);
          c.querySelector(".cot").textContent = U.m(st.u.cItems[i].total);
          c.querySelector(".coqb").textContent = `يعادل: ${U.q(st.u.cItems[i].bagsQty || 0)} كيس`;
        };
        c.querySelector(".cod").onclick = () => this.rem(i);
      });
    },
    rc(i) {
      const x = st.u.cItems[i];
      const p = st.d.products.find(a => a.id === x.productId);
      const bags = p ? Units.toBags(x.qty, x.unit, p) : 0;
      x.bagsQty = Number.isFinite(bags) ? bags : 0;
      x.total = (+x.bagsQty || 0) * (+x.price || 0);
      this.ut();
    },
    ut() {
      el.customerOrderTotal.textContent = U.m(st.u.cItems.reduce((a, b) => a + +b.total, 0));
    },
    removeMoves(order) {
      const used = new Set();
      order.items.forEach(i => {
        const exact = st.d.inventoryMoves.findIndex(
          (m, idx) =>
            !used.has(idx) &&
            m.type === "out" &&
            m.ref === "customer-order" &&
            (m.sourceId === order.id ||
              (m.productId === i.productId &&
                String(m.date) === String(order.date) &&
                +m.qty === +i.bagsQty))
        );
        if (exact >= 0) used.add(exact);
      });
      st.d.inventoryMoves = st.d.inventoryMoves.filter((_, idx) => !used.has(idx));
    },
    beginEdit(id) {
      const o = st.d.customerOrders.find(x => x.id === id);
      if (!o) return UI.toast("الطلبية غير موجودة", "error");
      st.u.editCustomerOrderId = id;
      el.customerOrderCustomerSelect.value = o.customerId;
      el.customerOrderDate.value = o.date;
      st.u.cItems = (o.items || []).map(i => ({
        productId: i.productId,
        qty: +i.qty || 0,
        unit: i.unit || "bag",
        bagsQty: +i.bagsQty || 0,
        price: +i.price || 0,
        total: +i.total || 0
      }));
      if (!st.u.cItems.length) this.add();
      this.ri();
      this.ut();
      el.saveCustomerOrderBtn.textContent = "تحديث طلبية العميل";
      UI.sw("customer-orders");
      UI.toast("تم تحميل الطلبية للتعديل", "info");
    },
    del(id) {
      const idx = st.d.customerOrders.findIndex(x => x.id === id);
      if (idx < 0) return UI.toast("الطلبية غير موجودة", "error");
      if (!UI.cf("حذف طلبية العميل؟")) return;
      const o = st.d.customerOrders[idx];
      o.items.forEach(i => {
        const p = st.d.products.find(x => x.id === i.productId);
        if (p) p.currentStock = +p.currentStock + (+i.bagsQty || 0);
      });
      this.removeMoves(o);
      st.d.customerOrders.splice(idx, 1);
      if (st.u.editCustomerOrderId === id) this.reset();
      DB.save();
      R.all();
      UI.toast("تم حذف طلبية العميل", "info");
    },
    save() {
      const cid = el.customerOrderCustomerSelect.value;
      const date = el.customerOrderDate.value;
      if (!cid || !date) return UI.toast("اختر العميل والتاريخ", "error");
      const items = st.u.cItems
        .map(i => {
          const p = st.d.products.find(x => x.id === i.productId);
          if (!p) return null;
          const bags = Units.toBags(i.qty, i.unit, p);
          return { ...i, bagsQty: Number.isFinite(bags) ? bags : 0 };
        })
        .filter(i => i && i.productId && i.bagsQty > 0);
      if (!items.length) return UI.toast("أضف صنفًا صحيحًا", "error");

      let target = null;
      if (st.u.editCustomerOrderId) {
        target = st.d.customerOrders.find(x => x.id === st.u.editCustomerOrderId);
        if (!target) {
          st.u.editCustomerOrderId = "";
        } else {
          target.items.forEach(i => {
            const p = st.d.products.find(x => x.id === i.productId);
            if (p) p.currentStock = +p.currentStock + (+i.bagsQty || 0);
          });
          this.removeMoves(target);
        }
      }

      for (const i of items) {
        const p = st.d.products.find(x => x.id === i.productId);
        if (!p || +p.currentStock < +i.bagsQty) return UI.toast(`رصيد غير كاف: ${p ? p.name : "منتج"}`, "error");
      }

      const orderId = target ? target.id : U.id();
      items.forEach(i => {
        const p = st.d.products.find(x => x.id === i.productId);
        p.currentStock = +p.currentStock - +i.bagsQty;
        st.d.inventoryMoves.push({
          id: U.id(),
          type: "out",
          productId: p.id,
          qty: +i.bagsQty,
          value: +i.total,
          date,
          ref: "customer-order",
          sourceId: orderId
        });
      });

      const total = items.reduce((a, b) => a + +b.total, 0);
      if (target) {
        target.customerId = cid;
        target.date = date;
        target.items = items;
        target.total = total;
        if (!(+target.permitNo > 0)) target.permitNo = Permit.nextNo();
      } else {
        st.d.customerOrders.push({ id: orderId, customerId: cid, date, items, total, permitNo: Permit.nextNo() });
      }
      DB.save();
      this.reset();
      R.all();
      UI.toast(target ? "تم تعديل طلبية العميل" : "تم حفظ طلبية العميل");
    }
  };

  const Gf = {
    reset() {
      st.u.editGiftId = "";
      el.giftType.value = "gift";
      el.giftProductSelect.value = "";
      el.giftQty.value = "";
      el.giftUnit.value = "bag";
      el.giftTarget.value = "";
      el.giftDate.value = U.t();
      el.giftNote.value = "";
      el.saveGiftBtn.textContent = "تسجيل الحركة";
    },
    removeMove(g) {
      const ref = g.type === "gift" ? "gift" : "sample";
      const idx = st.d.inventoryMoves.findIndex(
        m =>
          m.type === "out" &&
          m.ref === ref &&
          (m.sourceId === g.id || (m.productId === g.productId && String(m.date) === String(g.date) && +m.qty === +g.bagsQty))
      );
      if (idx >= 0) st.d.inventoryMoves.splice(idx, 1);
    },
    beginEdit(id) {
      const g = st.d.gifts.find(x => x.id === id);
      if (!g) return UI.toast("الحركة غير موجودة", "error");
      st.u.editGiftId = id;
      el.giftType.value = g.type || "gift";
      el.giftProductSelect.value = g.productId || "";
      el.giftQty.value = +g.qty || 0;
      el.giftUnit.value = g.unit || "bag";
      el.giftTarget.value = g.target || "";
      el.giftDate.value = g.date || U.t();
      el.giftNote.value = g.note || "";
      el.saveGiftBtn.textContent = "تحديث الحركة";
      UI.sw("gifts");
      UI.toast("تم تحميل الحركة للتعديل", "info");
    },
    del(id) {
      const idx = st.d.gifts.findIndex(x => x.id === id);
      if (idx < 0) return UI.toast("الحركة غير موجودة", "error");
      if (!UI.cf("حذف حركة الهدية/العينة؟")) return;
      const g = st.d.gifts[idx];
      const p = st.d.products.find(x => x.id === g.productId);
      if (p) p.currentStock = +p.currentStock + (+g.bagsQty || 0);
      this.removeMove(g);
      st.d.gifts.splice(idx, 1);
      if (st.u.editGiftId === id) this.reset();
      DB.save();
      R.all();
      UI.toast("تم حذف الحركة", "info");
    },
    save() {
      const type = el.giftType.value || "gift";
      const pid = el.giftProductSelect.value;
      const qty = +el.giftQty.value || 0;
      const unit = el.giftUnit.value || "bag";
      const targetName = (el.giftTarget.value || "").trim();
      const note = (el.giftNote.value || "").trim();
      const date = el.giftDate.value;
      const p = st.d.products.find(x => x.id === pid);
      if (!pid || qty <= 0 || !date || !p) return UI.toast("تحقق من بيانات الحركة", "error");
      const bags = Units.toBags(qty, unit, p);
      if (!Number.isFinite(bags) || bags <= 0) return UI.toast("كمية غير صحيحة", "error");
      let editTarget = null;
      if (st.u.editGiftId) {
        editTarget = st.d.gifts.find(x => x.id === st.u.editGiftId);
        if (!editTarget) {
          st.u.editGiftId = "";
        } else {
          const oldP = st.d.products.find(x => x.id === editTarget.productId);
          if (oldP) oldP.currentStock = +oldP.currentStock + (+editTarget.bagsQty || 0);
          this.removeMove(editTarget);
        }
      }
      if (+p.currentStock < bags) {
        if (editTarget) {
          const oldP = st.d.products.find(x => x.id === editTarget.productId);
          if (oldP) oldP.currentStock = +oldP.currentStock - (+editTarget.bagsQty || 0);
          const oldRef = editTarget.type === "gift" ? "gift" : "sample";
          st.d.inventoryMoves.push({
            id: U.id(),
            type: "out",
            productId: editTarget.productId,
            qty: +editTarget.bagsQty || 0,
            value: +editTarget.value || 0,
            date: editTarget.date,
            ref: oldRef,
            sourceId: editTarget.id
          });
        }
        return UI.toast(`رصيد غير كاف: ${p.name}`, "error");
      }

      const value = bags * pricePerBag(p);
      p.currentStock = +p.currentStock - bags;
      const giftId = editTarget ? editTarget.id : U.id();
      const row = {
        id: giftId,
        type,
        productId: pid,
        qty,
        unit,
        bagsQty: bags,
        value,
        target: targetName,
        note,
        date,
        permitNo: editTarget ? +editTarget.permitNo || Permit.nextNo() : Permit.nextNo()
      };
      if (editTarget) {
        Object.assign(editTarget, row);
      } else {
        st.d.gifts.push(row);
      }
      st.d.inventoryMoves.push({ id: U.id(), type: "out", productId: pid, qty: bags, value, date, ref: type === "gift" ? "gift" : "sample", sourceId: giftId });
      DB.save();
      this.reset();
      R.all();
      UI.toast(editTarget ? "تم تعديل الحركة" : "تم تسجيل الحركة");
    }
  };

  const Permit = {
    nextNo() {
      const no = Math.max(1, +st.d.permitCounter || 1);
      st.d.permitCounter = no + 1;
      return no;
    },
    unitLabel(unit) {
      if (unit === "carton") return "كرتونة";
      if (unit === "box") return "علبة";
      return "كيس";
    },
    build(ref) {
      const [kind, id] = String(ref || "").split(":");
      if (!kind || !id) return null;

      if (kind === "agent") {
        const o = st.d.orders.find(x => x.id === id);
        if (!o) return null;
        const a = st.d.agents.find(x => x.id === o.agentId);
        const items = (o.items || []).map(i => {
          const p = st.d.products.find(x => x.id === i.productId);
          const rawQty = +i.qty || 0;
          const rawUnit = i.unit || "bag";
          const bagsCalc = p ? Units.toBags(rawQty, rawUnit, p) : NaN;
          const bagsQty = Number.isFinite(bagsCalc) && bagsCalc > 0 ? bagsCalc : (+i.bagsQty || 0);
          const boxesEq = p && +p.bagPerBox > 0 ? bagsQty / (+p.bagPerBox || 1) : 0;
          const cartonsEq = p && +p.bagPerBox > 0 && +p.bagPerCarton > 0 ? boxesEq / (+p.bagPerCarton || 1) : 0;
          return {
            product: p ? p.name : "-",
            qty: rawQty,
            unit: this.unitLabel(rawUnit),
            rawUnit,
            bagsQty,
            boxesEq,
            cartonsEq,
            fullQty: p ? Units.format(bagsQty, p) : `${U.q(bagsQty)} كيس`
          };
        });
        const totalBags = items.reduce((sum, it) => sum + (+it.bagsQty || 0), 0);
        const totalCartons = items.reduce((sum, it) => sum + (+it.cartonsEq || 0), 0);
        const itemTypes = new Set(items.map(it => it.product)).size;
        return {
          no: +o.permitNo || o.id,
          typeLabel: "إذن صرف للمناديب",
          date: U.d(o.date),
          recipientLabel: "اسم المندوب",
          recipientName: a ? a.name : "-",
          items,
          itemTypes,
          totalBags,
          totalCartons
        };
      }

      if (kind === "customer") {
        const o = st.d.customerOrders.find(x => x.id === id);
        if (!o) return null;
        const c = st.d.customers.find(x => x.id === o.customerId);
        const items = (o.items || []).map(i => {
          const p = st.d.products.find(x => x.id === i.productId);
          const rawQty = +i.qty || 0;
          const rawUnit = i.unit || "bag";
          const bagsCalc = p ? Units.toBags(rawQty, rawUnit, p) : NaN;
          const bagsQty = Number.isFinite(bagsCalc) && bagsCalc > 0 ? bagsCalc : (+i.bagsQty || 0);
          const boxesEq = p && +p.bagPerBox > 0 ? bagsQty / (+p.bagPerBox || 1) : 0;
          const cartonsEq = p && +p.bagPerBox > 0 && +p.bagPerCarton > 0 ? boxesEq / (+p.bagPerCarton || 1) : 0;
          return {
            product: p ? p.name : "-",
            qty: rawQty,
            unit: this.unitLabel(rawUnit),
            rawUnit,
            bagsQty,
            boxesEq,
            cartonsEq,
            fullQty: p ? Units.format(bagsQty, p) : `${U.q(bagsQty)} كيس`
          };
        });
        const totalBags = items.reduce((sum, it) => sum + (+it.bagsQty || 0), 0);
        const totalCartons = items.reduce((sum, it) => sum + (+it.cartonsEq || 0), 0);
        const itemTypes = new Set(items.map(it => it.product)).size;
        return {
          no: +o.permitNo || o.id,
          typeLabel: "إذن صرف للعملاء",
          date: U.d(o.date),
          recipientLabel: "اسم العميل",
          recipientName: c ? c.name : "-",
          items,
          itemTypes,
          totalBags,
          totalCartons
        };
      }

      if (kind === "gift") {
        const g = st.d.gifts.find(x => x.id === id);
        if (!g) return null;
        const p = st.d.products.find(x => x.id === g.productId);
        const rawQty = +g.qty || 0;
        const rawUnit = g.unit || "bag";
        const bagsCalc = p ? Units.toBags(rawQty, rawUnit, p) : NaN;
        const bagsQty = Number.isFinite(bagsCalc) && bagsCalc > 0 ? bagsCalc : (+g.bagsQty || 0);
        const boxesEq = p && +p.bagPerBox > 0 ? bagsQty / (+p.bagPerBox || 1) : 0;
        const cartonsEq = p && +p.bagPerBox > 0 && +p.bagPerCarton > 0 ? boxesEq / (+p.bagPerCarton || 1) : 0;
        const row = {
          product: p ? p.name : "-",
          qty: rawQty,
          unit: this.unitLabel(rawUnit),
          rawUnit,
          bagsQty,
          boxesEq,
          cartonsEq,
          fullQty: p ? Units.format(bagsQty, p) : `${U.q(bagsQty)} كيس`
        };
        return {
          no: +g.permitNo || g.id,
          typeLabel: g.type === "sample" ? "إذن صرف عينات" : "إذن صرف هدايا",
          date: U.d(g.date),
          recipientLabel: "اسم مستلم الهدية",
          recipientName: g.target || "-",
          items: [row],
          itemTypes: 1,
          totalBags: +row.bagsQty || 0,
          totalCartons: +row.cartonsEq || 0
        };
      }

      return null;
    },
    rowsHtml(data) {
      return data.items
        .map(
          (it, idx) => `<tr>
            <td>${idx + 1}</td>
            <td>${U.e(it.product)}</td>
            <td>${U.e(it.unit)}</td>
            <td>${U.q(it.qty)} ${U.e(it.unit)}</td>
            <td>${U.e(it.fullQty)}</td>
            <td>${U.q(it.bagsQty)} كيس</td>
            <td>${it.rawUnit === "carton" ? `${U.q(it.boxesEq)} علبة` : "-"}</td>
          </tr>`
        )
        .join("");
    },
    issueHtml(data, withActions = true) {
      return `
        <div class="issue-voucher">
          <div class="issue-head">
            <div class="issue-brand">
              <img src="789.jpg" alt="شعار الشركة" class="issue-logo" />
              <div class="issue-brand-copy">
                <p class="issue-company">مصنع بن البهنساوي</p>
                <h3>إذن صرف مخزني</h3>
                <p class="issue-subtitle">وثيقة صرف رسمية من المخزن</p>
              </div>
            </div>
            <div class="issue-type-pill">${U.e(data.typeLabel)}</div>
          </div>
          <div class="issue-meta-grid">
            <div class="issue-meta-item">
              <span class="issue-meta-label">رقم الإذن</span>
              <strong class="issue-meta-value">${U.e(data.no)}</strong>
            </div>
            <div class="issue-meta-item">
              <span class="issue-meta-label">التاريخ</span>
              <strong class="issue-meta-value">${U.e(data.date)}</strong>
            </div>
            <div class="issue-meta-item issue-meta-item-wide">
              <span class="issue-meta-label">${U.e(data.recipientLabel)}</span>
              <strong class="issue-meta-value">${U.e(data.recipientName)}</strong>
            </div>
          </div>
          <div class="issue-table-wrap">
            <table class="issue-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الصنف</th>
                  <th>نوع الوحدة</th>
                  <th>الكمية</th>
                  <th>البضاعة كاملة</th>
                  <th>ما يعادل (كيس)</th>
                  <th>ما يعادل (علبة)</th>
                </tr>
              </thead>
              <tbody>${this.rowsHtml(data)}</tbody>
            </table>
          </div>
          <div class="issue-footer">
            <div class="issue-total-card">
              <span>إجمالي البضاعة</span>
              <strong>${U.q(data.totalCartons)} كرتونة</strong>
            </div>
            <div class="issue-total-card">
              <span>أنواع البضاعة</span>
              <strong>${U.q(data.itemTypes)} صنف</strong>
            </div>
          </div>
          <div class="issue-signatures">
            <div class="issue-sign">
              <div class="issue-sign-title">مدير المخزن</div>
              <span>التوقيع: ............................</span>
            </div>
            <div class="issue-sign">
              <div class="issue-sign-title">الحسابات</div>
              <span>التوقيع: ............................</span>
            </div>
          </div>
          ${
            withActions
              ? `<div class="issue-actions">
                  <button class="btn secondary" data-issue-print>طباعة الإذن</button>
                  <button class="btn ghost" data-issue-pdf>تنزيل PDF</button>
                  <button class="btn ghost" data-issue-excel>تنزيل Excel</button>
                  <button class="btn danger" data-issue-close>إغلاق</button>
                </div>`
              : ""
          }
        </div>
      `;
    },
    modal(data) {
      el.modalRoot.innerHTML = `
        <div class="modal-overlay">
          <div class="modal issue-modal">
            <div class="modal-head">
              <h3>إذن صرف</h3>
              <button class="btn ghost" data-issue-close>إغلاق</button>
            </div>
            ${this.issueHtml(data)}
          </div>
        </div>
      `;
      el.modalRoot.querySelectorAll("[data-issue-close]").forEach(btn => (btn.onclick = () => this.close()));
      const printBtn = el.modalRoot.querySelector("[data-issue-print]");
      const pdfBtn = el.modalRoot.querySelector("[data-issue-pdf]");
      const excelBtn = el.modalRoot.querySelector("[data-issue-excel]");
      if (printBtn) printBtn.onclick = () => this.print(data);
      if (pdfBtn) pdfBtn.onclick = () => this.pdf(data);
      if (excelBtn) excelBtn.onclick = () => this.excel(data);
    },
    close() {
      el.modalRoot.innerHTML = "";
    },
    open(ref) {
      const data = this.build(ref);
      if (!data) return UI.toast("الإذن غير موجود", "error");
      this.modal(data);
    },
    print(data) {
      const w = window.open("", "_blank");
      if (!w) return UI.toast("تعذر فتح نافذة الطباعة", "error");
      const html = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>إذن صرف - ${U.e(data.no)}</title>
          <style>
            body{font-family:Cairo,sans-serif;padding:18px;color:#2e1c10;background:#fff}
            .issue-voucher{max-width:920px;margin:0 auto;border:1px solid #d9c3a0;border-radius:14px;padding:14px}
            .issue-head{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px dashed #cfb48a}
            .issue-brand{display:flex;gap:10px;align-items:center}
            .issue-logo{width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #e4c78e}
            .issue-company{margin:0;font-size:13px;color:#6f563f}
            .issue-brand h3{margin:0;font-size:21px}
            .issue-subtitle{margin:0;color:#80634a;font-size:12px}
            .issue-type-pill{padding:6px 12px;border-radius:999px;background:#f2e3cb;border:1px solid #d7b88b;font-size:12px;font-weight:700}
            .issue-meta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}
            .issue-meta-item{border:1px solid #e3cfb1;background:#fffaf1;border-radius:10px;padding:8px}
            .issue-meta-item-wide{grid-column:span 1}
            .issue-meta-label{display:block;font-size:12px;color:#73593f}
            .issue-meta-value{font-size:15px}
            .issue-table{width:100%;border-collapse:collapse;margin-top:12px}
            .issue-table th,.issue-table td{border:1px solid #d8c2a2;padding:8px;text-align:right}
            .issue-table th{background:#f7efe0}
            .issue-footer{margin-top:10px;display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}
            .issue-total-card{border:1px solid #d7ba8d;background:#f6ebd8;border-radius:12px;padding:8px 14px;display:grid;gap:4px}
            .issue-total-card span{font-size:12px;color:#6f563f}
            .issue-total-card strong{font-size:18px}
            .issue-signatures{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
            .issue-sign{border:1px dashed #b79262;border-radius:10px;padding:12px;text-align:center}
            .issue-sign-title{font-weight:700;margin-bottom:12px}
            .issue-sign span{color:#6a5037}
          </style>
        </head>
        <body>${this.issueHtml(data, false)}</body>
        </html>
      `;
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(() => {
        w.focus();
        w.print();
      }, 250);
    },
    excel(data) {
      if (!window.XLSX) return UI.toast("مكتبة Excel غير متاحة", "error");
      const rows = data.items.map((it, idx) => ({
        مسلسل: idx + 1,
        الصنف: it.product,
        "نوع الوحدة": it.unit,
        الكمية: `${U.q(it.qty)} ${it.unit}`,
        "البضاعة كاملة": it.fullQty,
        "يعادل (كيس)": +it.bagsQty || 0,
        "يعادل (علبة)": it.rawUnit === "carton" ? +it.boxesEq || 0 : ""
      }));
      rows.push({
        مسلسل: "",
        الصنف: "إجمالي البضاعة",
        "نوع الوحدة": "",
        الكمية: "",
        "البضاعة كاملة": "",
        "يعادل (كيس)": "",
        "يعادل (علبة)": "",
        "إجمالي (كرتونة)": +data.totalCartons || 0
      });
      rows.push({
        مسلسل: "",
        الصنف: "إجمالي (كيس)",
        "نوع الوحدة": "",
        الكمية: "",
        "البضاعة كاملة": "",
        "يعادل (كيس)": +data.totalBags || 0,
        "يعادل (علبة)": ""
      });
      rows.push({
        مسلسل: "",
        الصنف: "أنواع البضاعة",
        "نوع الوحدة": "",
        الكمية: "",
        "البضاعة كاملة": `${U.q(data.itemTypes)} صنف`,
        "يعادل (كيس)": "",
        "يعادل (علبة)": ""
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "IssueVoucher");
      XLSX.writeFile(wb, `issue_${data.no}.xlsx`);
    },
    async pdf(data) {
      if (!window.jspdf || !window.jspdf.jsPDF) return UI.toast("مكتبة PDF غير متاحة", "error");
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      doc.setR2L(true);
      const font = await PdfAR.loadFont();
      if (font) {
        doc.addFileToVFS("Amiri-Regular.ttf", font);
        doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
        doc.setFont("Amiri", "normal");
      }
      doc.setFontSize(16);
      doc.text("مصنع بن البهنساوي - إذن صرف", 200, 18, { align: "right" });
      doc.setFontSize(12);
      doc.text(`رقم الإذن: ${data.no}`, 200, 28, { align: "right" });
      doc.text(`نوع الإذن: ${data.typeLabel}`, 200, 35, { align: "right" });
      doc.text(`التاريخ: ${data.date}`, 200, 42, { align: "right" });
      doc.text(`${data.recipientLabel}: ${data.recipientName}`, 200, 49, { align: "right" });
      let y = 60;
      data.items.forEach((it, idx) => {
        const boxEq = it.rawUnit === "carton" ? ` | ${U.q(it.boxesEq)} علبة` : "";
        const line = `${idx + 1}) ${it.product} | ${U.q(it.qty)} ${it.unit} | ${it.fullQty} | ${U.q(it.bagsQty)} كيس${boxEq}`;
        doc.text(line, 200, y, { align: "right" });
        y += 7;
        if (y > 268) {
          doc.addPage();
          y = 20;
        }
      });
      y += 4;
      doc.text(`إجمالي البضاعة: ${U.q(data.totalCartons)} كرتونة`, 200, y, { align: "right" });
      y += 8;
      doc.text(`أنواع البضاعة: ${U.q(data.itemTypes)} صنف`, 200, y, { align: "right" });
      y += 20;
      doc.text("توقيع مدير المخزن: ....................", 200, y, { align: "right" });
      y += 10;
      doc.text("توقيع الحسابات: ....................", 200, y, { align: "right" });
      doc.save(`issue_${data.no}.pdf`);
    }
  };

  const O = {
    reset() {
      st.u.items = [];
      st.u.editOrderId = "";
      el.orderDate.value = U.t();
      el.saveOrderBtn.textContent = "حفظ الطلبية";
      this.add();
      this.ri();
      this.ut();
    },
    add() {
      st.u.items.push({ productId: "", qty: 0, unit: "bag", bagsQty: 0, price: 0, total: 0 });
    },
    rem(i) {
      st.u.items.splice(i, 1);
      if (!st.u.items.length) this.add();
      this.ri();
      this.ut();
    },
    ri() {
      el.orderItemsContainer.innerHTML = st.u.items
        .map(
          (it, i) => `
          <div class="order-item" data-i="${i}">
            <div class="grid-4">
              <div>
                <label>المنتج</label>
                <select class="op">
                  <option value="">اختر المنتج</option>
                  ${st.d.products
                    .map(p => `<option value="${p.id}" ${it.productId === p.id ? "selected" : ""}>${U.e(p.name)}</option>`)
                    .join("")}
                </select>
              </div>
              <div>
                <label>الوحدة</label>
                <select class="ou">${Units.options(it.unit || "bag")}</select>
              </div>
              <div>
                <label>الكمية</label>
                <input class="oq" type="number" step="1" min="0" value="${it.qty || ""}">
              </div>
              <div>
                <label>سعر الكيس (محسوب)</label>
                <input class="os" type="number" value="${it.price}" readonly>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;flex-wrap:wrap;gap:6px">
              <span>إجمالي الصنف: <strong class="ot">${U.m(it.total)}</strong> جنيه</span>
              <span class="oqb">يعادل: ${U.q(it.bagsQty || 0)} كيس</span>
              <button class="btn danger od" type="button">حذف</button>
            </div>
          </div>`
        )
        .join("");

      el.orderItemsContainer.querySelectorAll(".order-item").forEach(c => {
        const i = +c.dataset.i;
        c.querySelector(".op").onchange = e => {
          const p = st.d.products.find(x => x.id === e.target.value);
          st.u.items[i].productId = e.target.value;
          st.u.items[i].price = p ? pricePerBag(p) : 0;
          this.rc(i);
          this.ri();
        };
        c.querySelector(".ou").onchange = e => {
          st.u.items[i].unit = e.target.value || "bag";
          this.rc(i);
          c.querySelector(".oqb").textContent = `يعادل: ${U.q(st.u.items[i].bagsQty || 0)} كيس`;
        };
        c.querySelector(".oq").oninput = e => {
          st.u.items[i].qty = +e.target.value || 0;
          this.rc(i);
          c.querySelector(".ot").textContent = U.m(st.u.items[i].total);
          c.querySelector(".oqb").textContent = `يعادل: ${U.q(st.u.items[i].bagsQty || 0)} كيس`;
        };
        c.querySelector(".od").onclick = () => this.rem(i);
      });
    },
    rc(i) {
      const x = st.u.items[i];
      const p = st.d.products.find(a => a.id === x.productId);
      const bags = p ? Units.toBags(x.qty, x.unit, p) : 0;
      x.bagsQty = Number.isFinite(bags) ? bags : 0;
      x.total = (+x.bagsQty || 0) * (+x.price || 0);
      this.ut();
    },
    ut() {
      el.orderTotal.textContent = U.m(st.u.items.reduce((a, b) => a + +b.total, 0));
    },
    removeMoves(order) {
      const used = new Set();
      order.items.forEach(i => {
        const exact = st.d.inventoryMoves.findIndex(
          (m, idx) =>
            !used.has(idx) &&
            m.type === "out" &&
            m.ref === "order" &&
            (m.sourceId === order.id ||
              (m.productId === i.productId &&
                String(m.date) === String(order.date) &&
                +m.qty === +i.bagsQty))
        );
        if (exact >= 0) used.add(exact);
      });
      st.d.inventoryMoves = st.d.inventoryMoves.filter((_, idx) => !used.has(idx));
    },
    beginEdit(id) {
      const o = st.d.orders.find(x => x.id === id);
      if (!o) return UI.toast("الطلبية غير موجودة", "error");
      st.u.editOrderId = id;
      el.orderAgentSelect.value = o.agentId;
      el.orderDate.value = o.date;
      st.u.items = (o.items || []).map(i => ({
        productId: i.productId,
        qty: +i.qty || 0,
        unit: i.unit || "bag",
        bagsQty: +i.bagsQty || 0,
        price: +i.price || 0,
        total: +i.total || 0
      }));
      if (!st.u.items.length) this.add();
      this.ri();
      this.ut();
      el.saveOrderBtn.textContent = "تحديث الطلبية";
      UI.sw("orders");
      UI.toast("تم تحميل الطلبية للتعديل", "info");
    },
    del(id) {
      const idx = st.d.orders.findIndex(x => x.id === id);
      if (idx < 0) return UI.toast("الطلبية غير موجودة", "error");
      if (!UI.cf("حذف الطلبية؟")) return;
      const o = st.d.orders[idx];
      o.items.forEach(i => {
        const p = st.d.products.find(x => x.id === i.productId);
        if (p) p.currentStock = +p.currentStock + (+i.bagsQty || 0);
      });
      this.removeMoves(o);
      st.d.orders.splice(idx, 1);
      if (st.u.editOrderId === id) this.reset();
      DB.save();
      R.all();
      UI.toast("تم حذف الطلبية", "info");
    },
    save() {
      const aid = el.orderAgentSelect.value;
      const date = el.orderDate.value;
      if (!aid || !date) return UI.toast("اختر المندوب والتاريخ", "error");
      const items = st.u.items
        .map(i => {
          const p = st.d.products.find(x => x.id === i.productId);
          if (!p) return null;
          const bags = Units.toBags(i.qty, i.unit, p);
          return { ...i, bagsQty: Number.isFinite(bags) ? bags : 0 };
        })
        .filter(i => i && i.productId && i.bagsQty > 0);
      if (!items.length) return UI.toast("أضف صنفًا صحيحًا", "error");

      let target = null;
      if (st.u.editOrderId) {
        target = st.d.orders.find(x => x.id === st.u.editOrderId);
        if (!target) {
          st.u.editOrderId = "";
        } else {
          target.items.forEach(i => {
            const p = st.d.products.find(x => x.id === i.productId);
            if (p) p.currentStock = +p.currentStock + (+i.bagsQty || 0);
          });
          this.removeMoves(target);
        }
      }

      for (const i of items) {
        const p = st.d.products.find(x => x.id === i.productId);
        if (!p || +p.currentStock < +i.bagsQty) return UI.toast(`رصيد غير كاف: ${p ? p.name : "منتج"}`, "error");
      }

      const orderId = target ? target.id : U.id();
      items.forEach(i => {
        const p = st.d.products.find(x => x.id === i.productId);
        p.currentStock = +p.currentStock - +i.bagsQty;
        st.d.inventoryMoves.push({
          id: U.id(),
          type: "out",
          productId: p.id,
          qty: +i.bagsQty,
          value: +i.total,
          date,
          ref: "order",
          sourceId: orderId
        });
      });

      const total = items.reduce((a, b) => a + +b.total, 0);
      if (target) {
        target.agentId = aid;
        target.date = date;
        target.items = items;
        target.total = total;
        if (!(+target.permitNo > 0)) target.permitNo = Permit.nextNo();
      } else {
        st.d.orders.push({ id: orderId, agentId: aid, date, items, total, permitNo: Permit.nextNo() });
      }
      DB.save();
      this.reset();
      R.all();
      UI.toast(target ? "تم تعديل الطلبية" : "تم حفظ الطلبية");
    }
  };
  const Rt = {
    bind() {
      const f = () => {
        const p = st.d.products.find(x => x.id === el.returnProductSelect.value);
        const q = +el.returnQty.value || 0;
        const unit = el.returnUnit.value || "bag";
        const bags = p ? Units.toBags(q, unit, p) : 0;
        el.returnValue.value = p ? (bags * pricePerBag(p)).toFixed(2) : "0.00";
      };
      el.returnProductSelect.onchange = f;
      el.returnQty.oninput = f;
      el.returnUnit.onchange = f;
    },
    save() {
      const aid = el.returnAgentSelect.value;
      const pid = el.returnProductSelect.value;
      const q = +el.returnQty.value || 0;
      const unit = el.returnUnit.value || "bag";
      const d = el.returnDate.value;
      const p = st.d.products.find(x => x.id === pid);
      if (!aid || !pid || q <= 0 || !d || !p) return UI.toast("تحقق من البيانات", "error");
      const bags = Units.toBags(q, unit, p);
      if (!Number.isFinite(bags) || bags <= 0) return UI.toast("كمية المرتجع غير صحيحة", "error");
      const tot = bags * pricePerBag(p);
      p.currentStock = +p.currentStock + bags;
      st.d.returns.push({ id: U.id(), agentId: aid, productId: pid, qty: q, unit, bagsQty: bags, price: pricePerBag(p), total: tot, date: d });
      st.d.inventoryMoves.push({ id: U.id(), type: "return", productId: pid, qty: bags, value: tot, date: d, ref: "return" });
      DB.save();
      el.returnQty.value = "";
      el.returnValue.value = "0.00";
      R.all();
      UI.toast("تم تسجيل المرتجع");
    }
  };

  const CRt = {
    bind() {
      const f = () => {
        const p = st.d.products.find(x => x.id === el.customerReturnProductSelect.value);
        const q = +el.customerReturnQty.value || 0;
        const unit = el.customerReturnUnit.value || "bag";
        const bags = p ? Units.toBags(q, unit, p) : 0;
        el.customerReturnValue.value = p ? (bags * pricePerBag(p)).toFixed(2) : "0.00";
      };
      el.customerReturnProductSelect.onchange = f;
      el.customerReturnQty.oninput = f;
      el.customerReturnUnit.onchange = f;
    },
    save() {
      const cid = el.customerReturnCustomerSelect.value;
      const pid = el.customerReturnProductSelect.value;
      const q = +el.customerReturnQty.value || 0;
      const unit = el.customerReturnUnit.value || "bag";
      const d = el.customerReturnDate.value;
      const p = st.d.products.find(x => x.id === pid);
      if (!cid || !pid || q <= 0 || !d || !p) return UI.toast("تحقق من البيانات", "error");
      const bags = Units.toBags(q, unit, p);
      if (!Number.isFinite(bags) || bags <= 0) return UI.toast("كمية المرتجع غير صحيحة", "error");
      const tot = bags * pricePerBag(p);
      p.currentStock = +p.currentStock + bags;
      st.d.customerReturns.push({ id: U.id(), customerId: cid, productId: pid, qty: q, unit, bagsQty: bags, price: pricePerBag(p), total: tot, date: d });
      st.d.inventoryMoves.push({ id: U.id(), type: "return", productId: pid, qty: bags, value: tot, date: d, ref: "customer-return" });
      DB.save();
      el.customerReturnQty.value = "";
      el.customerReturnValue.value = "0.00";
      R.all();
      UI.toast("تم تسجيل مرتجع العميل");
    }
  };

  const PdfAR = {
    font: null,
    async loadFont() {
      if (this.font) return this.font;
      try {
        const res = await fetch("https://cdn.jsdelivr.net/gh/alif-type/amiri@master/Amiri-Regular.ttf");
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = "";
        for (let i = 0; i < bytes.length; i += 32768) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
        }
        const b64 = btoa(bin);
        this.font = b64;
        return b64;
      } catch {
        return null;
      }
    },
    lines(k) {
      if (k === "agents")
        return Rp.aRows().map(r => `مندوب: ${r.agent} | المسحوبات: ${U.m(r.out)} | المرتجعات: ${U.m(r.ret)} | المدفوع: ${U.m(r.paid)} | الرصيد: ${U.m(r.bal)}`);
      if (k === "customers")
        return Rp.cRows().map(r => `عميل: ${r.customer} | عدد الطلبيات: ${r.orders} | الكمية: ${U.q(r.qty)} | القيمة: ${U.m(r.value)}`);
      if (k === "gifts")
        return Rp.gRows().map(r => `التاريخ: ${r.date} | النوع: ${r.type} | المنتج: ${r.product} | الكمية: ${r.qtyText} | الجهة: ${r.target} | القيمة: ${U.m(r.value)}`);
      if (k === "warehouse")
        return Rp.wRows().map(r => `التاريخ: ${r.date} | المنتج: ${r.product} | النوع: ${r.type} | الكمية: ${r.qtyText} | القيمة: ${U.m(r.value)}`);
      if (k === "stock")
        return Rp.sRows().map(r => `المنتج: ${r.product} | الرصيد: ${r.stockText} | السعر: ${U.m(r.price)} | القيمة: ${U.m(r.value)}`);
      if (k === "topProducts")
        return Rp.tRows().map(r => `المنتج: ${r.product} | الكمية (أكياس): ${U.q(r.qty)} | القيمة: ${U.m(r.value)}`);
      return Rp.pRows().map(r => `${r.title}: ${U.m(r.amount)}`);
    }
  };

  const Rp = {
    setF() {
      st.u.f.from = el.reportFromDate.value;
      st.u.f.to = el.reportToDate.value;
      st.u.f.agentId = el.reportAgentSelect.value;
      this.render();
    },
    title(k) {
      const m = {
        agents: "تقرير المناديب",
        customers: "تقرير العملاء",
        gifts: "تقرير الهدايا والعينات",
        warehouse: "تقرير حركة المخزن",
        stock: "تقرير المخزون",
        topProducts: "تقرير أكثر المنتجات مبيعًا",
        profit: "تقرير إجمالي الأرباح"
      };
      return m[k] || "تقرير";
    },
    aRows() {
      let g = st.d.agents;
      if (st.u.f.agentId !== "all") g = g.filter(a => a.id === st.u.f.agentId);
      return g.map(a => {
        const t = C.agt(a.id);
        return { agent: a.name, out: t.out, ret: t.ret, paid: t.paid, bal: t.bal, status: t.bal > 0 ? "عليه عجز" : t.bal < 0 ? "له رصيد دائن" : "حسابه صفر" };
      });
    },
    wRows() {
      return C.fd(st.d.inventoryMoves).map(m => {
        const p = st.d.products.find(x => x.id === m.productId);
        const tp =
          m.type === "in"
            ? m.ref === "opening"
              ? "أول المدة"
              : m.ref === "factory"
                ? "وارد مصنع"
                : "وارد"
            : m.type === "out"
              ? m.ref === "order"
                ? "منصرف للمناديب"
                : m.ref === "customer-order"
                  ? "منصرف للعملاء"
                  : m.ref === "gift"
                    ? "هدية"
                    : m.ref === "sample"
                      ? "عينة"
                      : "منصرف"
              : m.ref === "customer-return"
                ? "مرتجع عميل"
                : "مرتجع";
        const qtyText = p ? Units.format(m.qty, p) : U.q(m.qty);
        return { date: m.date, product: p ? p.name : "-", type: tp, qty: m.qty, qtyText, value: m.value };
      });
    },
    cRows() {
      return st.d.customers.map(c => {
        const rows = C.fd(st.d.customerOrders.filter(o => o.customerId === c.id));
        const value = rows.reduce((a, b) => a + +b.total, 0);
        const qty = rows.reduce((a, b) => a + b.items.reduce((s, it) => s + (+it.bagsQty || 0), 0), 0);
        return { customer: c.name, orders: rows.length, qty, value };
      });
    },
    gRows() {
      return C.fd(st.d.gifts).map(g => {
        const p = st.d.products.find(x => x.id === g.productId);
        return {
          date: g.date,
          type: g.type === "gift" ? "هدية" : "عينة",
          product: p ? p.name : "-",
          qtyText: p ? Units.format(g.bagsQty, p) : U.q(g.bagsQty),
          target: g.target || "-",
          value: g.value || 0
        };
      });
    },
    sRows() {
      return st.d.products.map(p => ({
        product: p.name,
        price: pricePerBag(p),
        stock: p.currentStock,
        stockText: Units.format(p.currentStock, p),
        value: +p.currentStock * pricePerBag(p)
      }));
    },
    tRows() {
      const mp = {};
      const allOrders = st.d.orders.concat(st.d.customerOrders || []);
      allOrders.forEach(o => {
        if (!C.fd([o])[0]) return;
        (o.items || []).forEach(i => {
          const qty = +i.bagsQty || +i.qty || 0;
          mp[i.productId] = mp[i.productId] || { qty: 0, value: 0 };
          mp[i.productId].qty += qty;
          mp[i.productId].value += +i.total || 0;
        });
      });
      return Object.entries(mp)
        .map(([id, v]) => {
          const p = st.d.products.find(x => x.id === id);
          return { product: p ? p.name : "-", qty: v.qty, value: v.value };
        })
        .sort((a, b) => b.qty - a.qty);
    },
    pRows() {
      const o = C.fd(st.d.orders.concat(st.d.customerOrders || [])).reduce((a, b) => a + +b.total, 0);
      const r = C.fd(st.d.returns.concat(st.d.customerReturns || [])).reduce((a, b) => a + +b.total, 0);
      const g = C.fd(st.d.gifts || []).reduce((a, b) => a + +b.value, 0);
      return [
        { title: "إجمالي المبيعات", amount: o },
        { title: "إجمالي المرتجعات", amount: r },
        { title: "إجمالي الهدايا والعينات", amount: g },
        { title: "صافي الإيراد", amount: o - r - g }
      ];
    },
    render() {
      const a = this.aRows();
      const c = this.cRows();
      const g = this.gRows();
      const w = this.wRows();
      const s = this.sRows();
      const t = this.tRows();
      const p = this.pRows();

      el.agentsReportBody.innerHTML = `<table><thead><tr><th>المندوب</th><th>المسحوبات</th><th>المرتجعات</th><th>المدفوع</th><th>الرصيد</th><th>الحالة</th></tr></thead><tbody>${
        a.map(r => `<tr><td>${U.e(r.agent)}</td><td>${U.m(r.out)}</td><td>${U.m(r.ret)}</td><td>${U.m(r.paid)}</td><td>${U.m(r.bal)}</td><td>${r.status}</td></tr>`).join("") || "<tr><td colspan='6'>لا توجد بيانات</td></tr>"
      }</tbody></table>`;

      el.warehouseReportBody.innerHTML = `<table><thead><tr><th>التاريخ</th><th>المنتج</th><th>النوع</th><th>الكمية</th><th>القيمة</th></tr></thead><tbody>${
        w.map(r => `<tr><td>${U.d(r.date)}</td><td>${U.e(r.product)}</td><td>${r.type}</td><td>${U.e(r.qtyText)}</td><td>${U.m(r.value)}</td></tr>`).join("") || "<tr><td colspan='5'>لا توجد بيانات</td></tr>"
      }</tbody></table>`;

      el.customersReportBody.innerHTML = `<table><thead><tr><th>العميل</th><th>عدد الطلبيات</th><th>الكمية (أكياس)</th><th>القيمة</th></tr></thead><tbody>${
        c.map(r => `<tr><td>${U.e(r.customer)}</td><td>${r.orders}</td><td>${U.q(r.qty)}</td><td>${U.m(r.value)}</td></tr>`).join("") || "<tr><td colspan='4'>لا توجد بيانات</td></tr>"
      }</tbody></table>`;

      el.giftsReportBody.innerHTML = `<table><thead><tr><th>التاريخ</th><th>النوع</th><th>المنتج</th><th>الكمية</th><th>الجهة</th><th>القيمة</th></tr></thead><tbody>${
        g.map(r => `<tr><td>${U.d(r.date)}</td><td>${r.type}</td><td>${U.e(r.product)}</td><td>${U.e(r.qtyText)}</td><td>${U.e(r.target)}</td><td>${U.m(r.value)}</td></tr>`).join("") || "<tr><td colspan='6'>لا توجد بيانات</td></tr>"
      }</tbody></table>`;

      el.stockReportBody.innerHTML = `<table><thead><tr><th>المنتج</th><th>السعر</th><th>الرصيد</th><th>القيمة</th></tr></thead><tbody>${
        s.map(r => `<tr><td>${U.e(r.product)}</td><td>${U.m(r.price)}</td><td>${U.e(r.stockText)}</td><td>${U.m(r.value)}</td></tr>`).join("") || "<tr><td colspan='4'>لا توجد بيانات</td></tr>"
      }</tbody></table>`;

      el.topProductsReportBody.innerHTML = `<table><thead><tr><th>المنتج</th><th>الكمية (أكياس)</th><th>القيمة</th></tr></thead><tbody>${
        t.map(r => `<tr><td>${U.e(r.product)}</td><td>${U.q(r.qty)}</td><td>${U.m(r.value)}</td></tr>`).join("") || "<tr><td colspan='3'>لا توجد بيانات</td></tr>"
      }</tbody></table>`;

      el.profitReportBody.innerHTML = `<table><thead><tr><th>البند</th><th>القيمة</th></tr></thead><tbody>${p.map(r => `<tr><td>${r.title}</td><td>${U.m(r.amount)}</td></tr>`).join("")}</tbody></table>`;
    },
    print(k) {
      const m = {
        agents: el.agentsReportBody,
        customers: el.customersReportBody,
        gifts: el.giftsReportBody,
        warehouse: el.warehouseReportBody,
        stock: el.stockReportBody,
        topProducts: el.topProductsReportBody,
        profit: el.profitReportBody
      };
      const t = m[k];
      if (!t) return;
      const w = window.open("", "_blank", "width=900,height=700");
      const rt = this.title(k);
      w.document.write(`<html dir='rtl' lang='ar'><head><meta charset='UTF-8'><style>body{font-family:Cairo,sans-serif;padding:20px}h2{text-align:center}img{width:80px;height:80px;display:block;margin:auto;border-radius:50%}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccc;padding:8px;text-align:right}</style></head><body><img src='789.jpg'><h2>مصنع بن البهنساوي - ${rt}</h2>${t.innerHTML}</body></html>`);
      w.document.close();
      w.focus();
      w.print();
    },
    excel(k) {
      if (typeof XLSX === "undefined") return UI.toast("مكتبة Excel غير متاحة", "error");
      const m = {
        agents: this.aRows().map(r => ({ المندوب: r.agent, المسحوبات: r.out, المرتجعات: r.ret, المدفوع: r.paid, الرصيد: r.bal, الحالة: r.status })),
        customers: this.cRows().map(r => ({ العميل: r.customer, "عدد الطلبيات": r.orders, "الكمية (أكياس)": r.qty, القيمة: r.value })),
        gifts: this.gRows().map(r => ({ التاريخ: r.date, النوع: r.type, المنتج: r.product, الكمية: r.qtyText, الجهة: r.target, القيمة: r.value })),
        warehouse: this.wRows().map(r => ({ التاريخ: r.date, المنتج: r.product, النوع: r.type, الكمية: r.qtyText, القيمة: r.value })),
        stock: this.sRows().map(r => ({ المنتج: r.product, السعر: r.price, الرصيد: r.stockText, القيمة: r.value })),
        topProducts: this.tRows().map(r => ({ المنتج: r.product, "الكمية (أكياس)": r.qty, القيمة: r.value })),
        profit: this.pRows().map(r => ({ البند: r.title, القيمة: r.amount }))
      };
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(m[k] || []);
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `report_${k}_${Date.now()}.xlsx`);
      UI.toast("تم تحميل Excel");
    },
    async pdf(k) {
      if (!window.jspdf || !window.jspdf.jsPDF) return UI.toast("مكتبة PDF غير متاحة", "error");
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const font = await PdfAR.loadFont();
      if (font) {
        doc.addFileToVFS("Amiri-Regular.ttf", font);
        doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
        doc.setFont("Amiri", "normal");
      } else {
        doc.setFont("helvetica", "normal");
      }
      doc.setFontSize(16);
      doc.text(`مصنع بن البهنساوي - ${this.title(k)}`, 105, 16, { align: "center" });
      doc.setFontSize(12);
      const lines = PdfAR.lines(k);
      let y = 28;
      for (const l of lines) {
        if (y > 282) {
          doc.addPage();
          if (font) doc.setFont("Amiri", "normal");
          else doc.setFont("helvetica", "normal");
          y = 20;
        }
        doc.text(l, 195, y, { align: "right" });
        y += 8;
      }
      doc.save(`report_${k}_${Date.now()}.pdf`);
      UI.toast("تم تحميل PDF");
    }
  };

  const Ch = {
    draw() {
      if (typeof Chart === "undefined") return UI.toast("Chart.js غير متاح", "info");
      Object.values(st.c).forEach(c => c && c.destroy());
      const t = Rp.tRows().slice(0, 7);
      st.c.top = new Chart(document.getElementById("topProductsChart"), {
        type: "bar",
        data: { labels: t.map(x => x.product), datasets: [{ label: "كمية الصرف (أكياس)", data: t.map(x => x.qty), backgroundColor: "#8b5a2b" }] },
        options: { responsive: true }
      });
      const an = st.d.agents.map(a => a.name);
      const df = st.d.agents.map(a => Math.max(0, C.agt(a.id).bal));
      st.c.ag = new Chart(document.getElementById("agentsPerformanceChart"), {
        type: "line",
        data: { labels: an, datasets: [{ label: "العجز", data: df, borderColor: "#c89b3c", backgroundColor: "rgba(200,155,60,.2)", fill: true }] },
        options: { responsive: true }
      });
      const i = st.d.inventoryMoves.filter(m => m.type === "in").reduce((a, b) => a + +b.qty, 0);
      const o = st.d.inventoryMoves.filter(m => m.type === "out").reduce((a, b) => a + +b.qty, 0);
      const r = st.d.inventoryMoves.filter(m => m.type === "return").reduce((a, b) => a + +b.qty, 0);
      st.c.flow = new Chart(document.getElementById("warehouseFlowChart"), {
        type: "doughnut",
        data: { labels: ["وارد", "منصرف", "مرتجع"], datasets: [{ data: [i, o, r], backgroundColor: ["#4a2b1a", "#d39d2a", "#7f5539"] }] },
        options: { responsive: true }
      });
    }
  };

  const X = {
    exp() {
      const b = new Blob([JSON.stringify(st.d, null, 2)], { type: "application/json;charset=utf-8" });
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = `bahnasawi_backup_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(u);
      UI.toast("تم تصدير البيانات");
    },
    imp(f) {
      const r = new FileReader();
      r.onload = () => {
        try {
          const p = JSON.parse(r.result);
          const pro = (p.products || []).map(normalizeProduct);
          st.d = {
            products: pro,
            agents: p.agents || [],
            customers: p.customers || [],
            orders: p.orders || [],
            customerOrders: p.customerOrders || [],
            gifts: p.gifts || [],
            returns: p.returns || [],
            customerReturns: p.customerReturns || [],
            payments: p.payments || [],
            inventoryMoves: p.inventoryMoves || [],
            permitCounter: Math.max(1, +p.permitCounter || 1)
          };
          DB.ensurePermits();
          DB.save();
          R.all();
          UI.toast("تم استيراد البيانات");
        } catch {
          UI.toast("ملف غير صالح", "error");
        }
      };
      r.readAsText(f, "UTF-8");
    }
  };
  const R = {
    stats() {
      const s = C.stats();
      const c = [
        { t: "إجمالي عدد المنتجات", v: s.tp, m: "منتج مسجل", ic: "📦" },
        { t: "إجمالي عدد المناديب", v: s.ta, m: "مندوب نشط", ic: "🚚" },
        { t: "إجمالي عدد العملاء", v: st.d.customers.length, m: "عميل مسجل", ic: "🧾" },
        { t: "إجمالي رصيد المخزن الحالي (بالأكياس)", v: U.q(s.ts), m: "وحدات متاحة", ic: "🏬" },
        { t: "إجمالي العجز الكلي للمناديب", v: U.m(s.td), m: "رصيد مستحق", ic: "⚠️" },
        { t: "إجمالي قيمة البضاعة المنصرفة", v: U.m(s.tv), m: "صرف المناديب", ic: "💰" }
      ];
      el.statsGrid.innerHTML = c
        .map((x, i) => `<article class='stat-card stat-${i + 1}'><div class='stat-top'><h4>${x.t}</h4><span class='stat-icon'>${x.ic}</span></div><p class='stat-value'>${x.v}</p><div class='stat-meta'>${x.m}</div></article>`)
        .join("");
    },
    products() {
      const q = (el.productSearch.value || "").trim().toLowerCase();
      const rows = st.d.products.filter(p => p.name.toLowerCase().includes(q));
      const p = Pg.slice(rows, st.u.pp);
      st.u.pp = p.sp;
      el.productsTableBody.innerHTML =
        p.d
          .map(
            x => `
          <tr>
            <td>${U.e(x.name)}</td>
            <td>
              ${U.m(x.price)}
              <div style="color:#7c644f;font-size:.8rem">سعر الكيس ${U.m(pricePerBag(x))}</div>
              <div style="color:#7c644f;font-size:.8rem">سعر الكرتونة ${U.m(x.price * (x.bagPerCarton || 0))}</div>
            </td>
            <td>${Units.format(x.currentStock, x)} <div style="color:#7c644f;font-size:.8rem">إجمالي ${U.q(x.currentStock)} كيس</div></td>
            <td><button class='btn ghost' data-pe='${x.id}'>تعديل</button><button class='btn danger' data-pd='${x.id}'>حذف</button></td>
          </tr>`
          )
          .join("") || "<tr><td colspan='4'>لا توجد منتجات</td></tr>";
      Pg.draw(el.productsPagination, p.t, p.sp, n => {
        st.u.pp = n;
        this.products();
        B.dyn();
      });
    },
    agents() {
      const q = (el.agentSearch.value || "").trim().toLowerCase();
      const rows = st.d.agents.filter(a => a.name.toLowerCase().includes(q));
      const p = Pg.slice(rows, st.u.ap);
      st.u.ap = p.sp;
      el.agentsTableBody.innerHTML =
        p.d
          .map(x => {
            const t = C.agt(x.id);
            const s = t.bal > 0 ? "مدين" : t.bal < 0 ? "دائن" : "صفر";
            return `<tr><td>${U.e(x.name)}</td><td>${U.e(x.phone || "-")}</td><td>${U.e(x.vehicle || "-")}</td><td>${s} (${U.m(t.bal)})</td><td><button class='btn ghost' data-ae='${x.id}'>تعديل</button><button class='btn secondary' data-ap='${x.id}'>سداد</button><button class='btn danger' data-ad='${x.id}'>حذف</button></td></tr>`;
          })
          .join("") || "<tr><td colspan='5'>لا توجد مناديب</td></tr>";
      Pg.draw(el.agentsPagination, p.t, p.sp, n => {
        st.u.ap = n;
        this.agents();
        B.dyn();
      });
    },
    customers() {
      const q = (el.customerSearch.value || "").trim().toLowerCase();
      const rows = st.d.customers.filter(c => c.name.toLowerCase().includes(q));
      const p = Pg.slice(rows, st.u.cp);
      st.u.cp = p.sp;
      el.customersTableBody.innerHTML =
        p.d
          .map(x => {
            const t = C.cst(x.id);
            return `<tr><td>${U.e(x.name)}</td><td>${U.e(x.phone || "-")}</td><td>${U.e(x.address || "-")}</td><td><button class='btn ghost' data-ce='${x.id}'>تعديل</button><button class='btn danger' data-cd='${x.id}'>حذف</button><div style="color:#7c644f;font-size:.8rem;margin-top:6px">طلبيات: ${U.q(t.qty)} كيس - قيمة ${U.m(t.out)}</div></td></tr>`;
          })
          .join("") || "<tr><td colspan='4'>لا توجد عملاء</td></tr>";
      Pg.draw(el.customersPagination, p.t, p.sp, n => {
        st.u.cp = n;
        this.customers();
        B.dyn();
      });
    },
    ordersHistory() {
      if (!el.ordersHistoryTableBody) return;
      const { ordersFrom, ordersTo } = st.u.issueF;
      const rows = st.d.orders
        .filter(o => U.inRange(o.date, ordersFrom, ordersTo))
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      el.ordersHistoryTableBody.innerHTML =
        rows
          .map(o => {
            const a = st.d.agents.find(x => x.id === o.agentId);
            const itemsText = (o.items || [])
              .map(i => {
                const p = st.d.products.find(x => x.id === i.productId);
                return `${p ? p.name : "-"} (${U.q(i.bagsQty || 0)} كيس)`;
              })
              .join(" | ");
            return `<tr>
              <td>${U.d(o.date)}</td>
              <td>${U.e(a ? a.name : "-")}</td>
              <td>${U.e(itemsText || "-")}</td>
              <td>${U.m(o.total)}</td>
              <td>
                <button class='btn secondary' data-permit='agent:${o.id}'>إذن صرف</button>
                <button class='btn ghost' data-ore='${o.id}'>تعديل</button>
                <button class='btn danger' data-ord='${o.id}'>حذف</button>
              </td>
            </tr>`;
          })
          .join("") || "<tr><td colspan='5'>لا توجد عمليات صرف</td></tr>";
    },
    customerOrdersHistory() {
      if (!el.customerOrdersHistoryTableBody) return;
      const { customerFrom, customerTo } = st.u.issueF;
      const rows = st.d.customerOrders
        .filter(o => U.inRange(o.date, customerFrom, customerTo))
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      el.customerOrdersHistoryTableBody.innerHTML =
        rows
          .map(o => {
            const c = st.d.customers.find(x => x.id === o.customerId);
            const itemsText = (o.items || [])
              .map(i => {
                const p = st.d.products.find(x => x.id === i.productId);
                return `${p ? p.name : "-"} (${U.q(i.bagsQty || 0)} كيس)`;
              })
              .join(" | ");
            return `<tr>
              <td>${U.d(o.date)}</td>
              <td>${U.e(c ? c.name : "-")}</td>
              <td>${U.e(itemsText || "-")}</td>
              <td>${U.m(o.total)}</td>
              <td>
                <button class='btn secondary' data-permit='customer:${o.id}'>إذن صرف</button>
                <button class='btn ghost' data-core='${o.id}'>تعديل</button>
                <button class='btn danger' data-cord='${o.id}'>حذف</button>
              </td>
            </tr>`;
          })
          .join("") || "<tr><td colspan='5'>لا توجد عمليات صرف</td></tr>";
    },
    giftsHistory() {
      if (!el.giftsHistoryTableBody) return;
      const { giftsFrom, giftsTo } = st.u.issueF;
      const rows = st.d.gifts
        .filter(g => U.inRange(g.date, giftsFrom, giftsTo))
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      el.giftsHistoryTableBody.innerHTML =
        rows
          .map(g => {
            const p = st.d.products.find(x => x.id === g.productId);
            const t = g.type === "sample" ? "عينة" : "هدية";
            const details = `${p ? p.name : "-"} (${U.q(g.qty)} ${g.unit === "carton" ? "كرتونة" : g.unit === "box" ? "علبة" : "كيس"})`;
            return `<tr>
              <td>${U.d(g.date)}</td>
              <td>${U.e(t)}</td>
              <td>${U.e(g.target || "-")}</td>
              <td>${U.e(details)}</td>
              <td>${U.m(g.value)}</td>
              <td>
                <button class='btn secondary' data-permit='gift:${g.id}'>إذن صرف</button>
                <button class='btn ghost' data-ge='${g.id}'>تعديل</button>
                <button class='btn danger' data-gd='${g.id}'>حذف</button>
              </td>
            </tr>`;
          })
          .join("") || "<tr><td colspan='6'>لا توجد عمليات هدايا أو عينات</td></tr>";
    },
    inventory() {
      if (!el.inventoryTableBody) return;
      el.inventoryTableBody.innerHTML =
        st.d.products
          .map(p => {
            const o = Units.breakdown(p.openingStock, p);
            return `
          <tr>
            <td>${U.e(p.name)}</td>
            <td>
              <div class="unit-row-3">
                <input type='number' min='0' step='1' value='${o.cartons}' placeholder='كرتونة' data-open-carton='${p.id}'>
                <input type='number' min='0' step='1' value='${o.boxes}' placeholder='علبة' data-open-box='${p.id}'>
                <input type='number' min='0' step='1' value='${o.bags}' placeholder='كيس' data-open-bag='${p.id}'>
              </div>
              <div class="unit-preview" data-open-preview='${p.id}'>يعادل: ${U.q(p.openingStock)} كيس</div>
            </td>
            <td>
              ${Units.format(p.currentStock, p)}
              <div style="color:#7c644f;font-size:.8rem">إجمالي ${U.q(p.currentStock)} كيس</div>
            </td>
            <td>
              <div class="unit-row-3">
                <input type='number' min='0' step='1' value='' placeholder='كرتونة' data-factory-carton='${p.id}'>
                <input type='number' min='0' step='1' value='' placeholder='علبة' data-factory-box='${p.id}'>
                <input type='number' min='0' step='1' value='' placeholder='كيس' data-factory-bag='${p.id}'>
              </div>
              <div class="unit-preview" data-factory-preview='${p.id}'>يعادل: 0 كيس</div>
            </td>
            <td>
              <div class="inv-actions-grid">
                <button class='btn secondary' data-inv-open='${p.id}'>إضافة أول المدة</button>
                <button class='btn primary' data-inv-in='${p.id}'>إضافة الوارد</button>
                <button class='btn ghost' data-inv-oe-product='${p.id}'>تعديل أول المدة</button>
                <button class='btn danger' data-inv-od-product='${p.id}'>حذف أول المدة</button>
                <button class='btn ghost' data-inv-me-product='${p.id}'>تعديل الوارد</button>
                <button class='btn danger' data-inv-md-product='${p.id}'>حذف الوارد</button>
              </div>
            </td>
          </tr>`;
          })
          .join("") || "<tr><td colspan='5'>لا توجد منتجات</td></tr>";
    },
    sel() {
      const a = ["<option value=''>اختر المندوب</option>"]
        .concat(st.d.agents.map(g => `<option value='${g.id}'>${U.e(g.name)}</option>`))
        .join("");
      el.orderAgentSelect.innerHTML = a;
      el.returnAgentSelect.innerHTML = a;
      el.customerOrderCustomerSelect.innerHTML = ["<option value=''>اختر العميل</option>"]
        .concat(st.d.customers.map(c => `<option value='${c.id}'>${U.e(c.name)}</option>`))
        .join("");
      el.customerReturnCustomerSelect.innerHTML = ["<option value=''>اختر العميل</option>"]
        .concat(st.d.customers.map(c => `<option value='${c.id}'>${U.e(c.name)}</option>`))
        .join("");
      el.reportAgentSelect.innerHTML = ["<option value='all'>كل المناديب</option>"]
        .concat(st.d.agents.map(g => `<option value='${g.id}'>${U.e(g.name)}</option>`))
        .join("");
      el.returnProductSelect.innerHTML = ["<option value=''>اختر المنتج</option>"]
        .concat(st.d.products.map(p => `<option value='${p.id}'>${U.e(p.name)}</option>`))
        .join("");
      el.giftProductSelect.innerHTML = ["<option value=''>اختر المنتج</option>"]
        .concat(st.d.products.map(p => `<option value='${p.id}'>${U.e(p.name)}</option>`))
        .join("");
      el.customerReturnProductSelect.innerHTML = ["<option value=''>اختر المنتج</option>"]
        .concat(st.d.products.map(p => `<option value='${p.id}'>${U.e(p.name)}</option>`))
        .join("");
      if (!st.u.items.length) O.add();
      O.ri();
      if (!st.u.cItems.length) CO.add();
      CO.ri();
    },
    all() {
      this.stats();
      this.products();
      this.inventory();
      this.agents();
      this.customers();
      this.ordersHistory();
      this.customerOrdersHistory();
      this.giftsHistory();
      this.sel();
      Rp.render();
      Ch.draw();
      B.dyn();
    }
  };

  const B = {
    stat() {
      el.nav.forEach(b => (b.onclick = () => UI.sw(b.dataset.page)));
      el.addProductBtn.onclick = () => P.add();
      el.productSearch.oninput = () => {
        st.u.pp = 1;
        R.products();
        B.dyn();
      };
      el.addAgentBtn.onclick = () => A.add();
      el.agentSearch.oninput = () => {
        st.u.ap = 1;
        R.agents();
        B.dyn();
      };
      el.addCustomerBtn.onclick = () => Cm.add();
      el.customerSearch.oninput = () => {
        st.u.cp = 1;
        R.customers();
        B.dyn();
      };
      el.addOrderItemBtn.onclick = () => {
        O.add();
        O.ri();
      };
      el.saveOrderBtn.onclick = () => O.save();
      el.addCustomerOrderItemBtn.onclick = () => {
        CO.add();
        CO.ri();
      };
      el.saveCustomerOrderBtn.onclick = () => CO.save();
      el.saveGiftBtn.onclick = () => Gf.save();
      el.saveReturnBtn.onclick = () => Rt.save();
      el.saveCustomerReturnBtn.onclick = () => CRt.save();
      el.ordersFromDate.onchange = e => {
        st.u.issueF.ordersFrom = e.target.value || "";
        R.ordersHistory();
        B.dyn();
      };
      el.ordersToDate.onchange = e => {
        st.u.issueF.ordersTo = e.target.value || "";
        R.ordersHistory();
        B.dyn();
      };
      el.customerOrdersFromDate.onchange = e => {
        st.u.issueF.customerFrom = e.target.value || "";
        R.customerOrdersHistory();
        B.dyn();
      };
      el.customerOrdersToDate.onchange = e => {
        st.u.issueF.customerTo = e.target.value || "";
        R.customerOrdersHistory();
        B.dyn();
      };
      el.giftsFromDate.onchange = e => {
        st.u.issueF.giftsFrom = e.target.value || "";
        R.giftsHistory();
        B.dyn();
      };
      el.giftsToDate.onchange = e => {
        st.u.issueF.giftsTo = e.target.value || "";
        R.giftsHistory();
        B.dyn();
      };
      Rt.bind();
      CRt.bind();
      el.orderDate.value = U.t();
      el.customerOrderDate.value = U.t();
      el.giftDate.value = U.t();
      el.returnDate.value = U.t();
      el.customerReturnDate.value = U.t();
      el.applyReportFilters.onclick = () => Rp.setF();
      el.rActions.forEach(w => {
        const k = w.dataset.report;
        w.querySelector(".report-print").onclick = () => Rp.print(k);
        w.querySelector(".report-excel").onclick = () => Rp.excel(k);
        w.querySelector(".report-pdf").onclick = () => Rp.pdf(k);
      });
      el.exportDataBtn.onclick = () => X.exp();
      el.importDataInput.onchange = e => {
        const f = e.target.files && e.target.files[0];
        if (f) X.imp(f);
        e.target.value = "";
      };
      el.clearDataBtn.onclick = () => {
        if (!UI.cf("سيتم حذف جميع البيانات نهائيًا. متابعة؟")) return;
        DB.clear();
        O.reset();
        CO.reset();
        R.all();
        UI.toast("تم حذف جميع البيانات", "info");
      };
      el.printCurrentPage.onclick = () => print();
    },
    dyn() {
      document.querySelectorAll("[data-pe]").forEach(b => (b.onclick = () => P.edit(b.dataset.pe)));
      document.querySelectorAll("[data-pd]").forEach(b => (b.onclick = () => P.del(b.dataset.pd)));
      document.querySelectorAll("[data-ae]").forEach(b => (b.onclick = () => A.edit(b.dataset.ae)));
      document.querySelectorAll("[data-ap]").forEach(b => (b.onclick = () => A.pay(b.dataset.ap)));
      document.querySelectorAll("[data-ad]").forEach(b => (b.onclick = () => A.del(b.dataset.ad)));
      document.querySelectorAll("[data-ce]").forEach(b => (b.onclick = () => Cm.edit(b.dataset.ce)));
      document.querySelectorAll("[data-cd]").forEach(b => (b.onclick = () => Cm.del(b.dataset.cd)));
      document.querySelectorAll("[data-ore]").forEach(b => (b.onclick = () => O.beginEdit(b.dataset.ore)));
      document.querySelectorAll("[data-ord]").forEach(b => (b.onclick = () => O.del(b.dataset.ord)));
      document.querySelectorAll("[data-core]").forEach(b => (b.onclick = () => CO.beginEdit(b.dataset.core)));
      document.querySelectorAll("[data-cord]").forEach(b => (b.onclick = () => CO.del(b.dataset.cord)));
      document.querySelectorAll("[data-ge]").forEach(b => (b.onclick = () => Gf.beginEdit(b.dataset.ge)));
      document.querySelectorAll("[data-gd]").forEach(b => (b.onclick = () => Gf.del(b.dataset.gd)));
      document.querySelectorAll("[data-permit]").forEach(b => (b.onclick = () => Permit.open(b.dataset.permit)));
      document.querySelectorAll("[data-inv-open]").forEach(b => (b.onclick = () => Inv.setOpen(b.dataset.invOpen)));
      document.querySelectorAll("[data-inv-in]").forEach(b => (b.onclick = () => Inv.addFactory(b.dataset.invIn)));
      document.querySelectorAll("[data-inv-oe-product]").forEach(b => (b.onclick = () => Inv.editOpeningByProduct(b.dataset.invOeProduct)));
      document.querySelectorAll("[data-inv-od-product]").forEach(b => (b.onclick = () => Inv.delOpeningByProduct(b.dataset.invOdProduct)));
      document.querySelectorAll("[data-inv-me-product]").forEach(b => (b.onclick = () => Inv.editFactoryByProduct(b.dataset.invMeProduct)));
      document.querySelectorAll("[data-inv-md-product]").forEach(b => (b.onclick = () => Inv.delFactoryByProduct(b.dataset.invMdProduct)));
      document.querySelectorAll("[data-open-carton]").forEach(inp => {
        inp.oninput = () => UI.updateInvPreview(inp.dataset.openCarton, "open");
      });
      document.querySelectorAll("[data-open-box]").forEach(inp => {
        inp.oninput = () => UI.updateInvPreview(inp.dataset.openBox, "open");
      });
      document.querySelectorAll("[data-open-bag]").forEach(inp => {
        inp.oninput = () => UI.updateInvPreview(inp.dataset.openBag, "open");
      });
      document.querySelectorAll("[data-factory-carton]").forEach(inp => {
        inp.oninput = () => UI.updateInvPreview(inp.dataset.factoryCarton, "factory");
      });
      document.querySelectorAll("[data-factory-box]").forEach(inp => {
        inp.oninput = () => UI.updateInvPreview(inp.dataset.factoryBox, "factory");
      });
      document.querySelectorAll("[data-factory-bag]").forEach(inp => {
        inp.oninput = () => UI.updateInvPreview(inp.dataset.factoryBag, "factory");
      });
    }
  };

  let appStarted = false;

  function startApp() {
    if (appStarted) return;
    appStarted = true;
    document.body.classList.remove("auth-locked");
    document.body.classList.add("auth-unlocked");
    DB.load();
    B.stat();
    O.reset();
    CO.reset();
    Gf.reset();
    R.all();
    setTimeout(() => (el.loader.style.display = "none"), 500);
  }

  const Auth = {
    isOk() {
      return sessionStorage.getItem(AUTH_SESSION_KEY) === "1";
    },
    show() {
      document.body.classList.add("auth-locked");
      document.body.classList.remove("auth-unlocked");
      if (el.loader) el.loader.style.display = "none";
      if (el.loginError) el.loginError.textContent = "";
      if (el.loginUser) el.loginUser.focus();
    },
    login() {
      const u = (el.loginUser && el.loginUser.value ? el.loginUser.value : "").trim();
      const p = (el.loginPass && el.loginPass.value ? el.loginPass.value : "").trim();
      if (u === AUTH_USER && p === AUTH_PASS) {
        sessionStorage.setItem(AUTH_SESSION_KEY, "1");
        if (el.loginError) el.loginError.textContent = "";
        startApp();
        return;
      }
      if (el.loginError) el.loginError.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة";
    },
    bind() {
      if (!el.loginForm) return;
      el.loginForm.onsubmit = e => {
        e.preventDefault();
        this.login();
      };
      if (el.logoutBtn) {
        el.logoutBtn.onclick = () => this.logout();
      }
    },
    logout() {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      window.location.reload();
    }
  };

  function init() {
    UI.cache();
    Auth.bind();
    if (Auth.isOk()) {
      startApp();
    } else {
      Auth.show();
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();
