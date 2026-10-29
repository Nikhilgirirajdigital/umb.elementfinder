var J = Object.defineProperty;
var A = (c) => {
  throw TypeError(c);
};
var X = (c, u, e) => u in c ? J(c, u, { enumerable: !0, configurable: !0, writable: !0, value: e }) : c[u] = e;
var p = (c, u, e) => X(c, typeof u != "symbol" ? u + "" : u, e), Q = (c, u, e) => u.has(c) || A("Cannot " + e);
var R = (c, u, e) => u.has(c) ? A("Cannot add the same private member more than once") : u instanceof WeakSet ? u.add(c) : u.set(c, e);
var i = (c, u, e) => (Q(c, u, "access private method"), e);
import { html as n, nothing as h, css as V } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement as Z } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles as ee } from "@umbraco-cms/backoffice/style";
import { UMB_AUTH_CONTEXT as te } from "@umbraco-cms/backoffice/auth";
import { umbConfirmModal as E } from "@umbraco-cms/backoffice/modal";
import { UMB_NOTIFICATION_CONTEXT as ae } from "@umbraco-cms/backoffice/notification";
import { UmbModalRouteRegistrationController as ie } from "@umbraco-cms/backoffice/router";
import { UMB_WORKSPACE_MODAL as se } from "@umbraco-cms/backoffice/workspace";
const f = "/umbraco/backoffice/elementfinder/content-cleaner", oe = "content-cleaner-usage", re = 12e4;
var t, x, D, k, $, y, b, U, K, L, B, M, C, P, z, I, N, j, H, W, q, O, _, S, F, v, T, Y;
class w extends Z {
  constructor() {
    super();
    R(this, t);
    p(this, "_authContext");
    p(this, "_notificationContext");
    p(this, "_initialLoadStarted", !1);
    p(this, "_candidateRequestId", 0);
    p(this, "_selectedUsageCandidate");
    p(this, "_usageWorkspaceRoute");
    p(this, "_usageWorkspacePathBuilder");
    this._items = [], this._summary = void 0, this._loading = !0, this._error = "", this._search = "", this._type = "all", this._risk = "all", this._page = 1, this._pageSize = 20, this._total = 0, this._scannedAt = void 0, this._sortBy = "name", this._sortDirection = "asc", this._selectedKeys = /* @__PURE__ */ new Set(), this.consumeContext(te, (e) => {
      if (!e) {
        this._error = "Umbraco authentication context is unavailable.", this._loading = !1;
        return;
      }
      this._authContext = e, this._initialLoadStarted || (this._initialLoadStarted = !0, i(this, t, k).call(this));
    }), this.consumeContext(ae, (e) => {
      this._notificationContext = e;
    }), this._usageWorkspaceRoute = new ie(this, se).addAdditionalPath(":candidateKey").onSetup((e) => {
      const a = this._items.find((s) => s.key === e.candidateKey) ?? this._selectedUsageCandidate;
      return {
        data: {
          entityType: oe,
          preset: { candidate: a }
        }
      };
    }).onSubmit(() => {
    }).onReject(() => {
    }).observeRouteBuilder((e) => {
      this._usageWorkspacePathBuilder = e, this.requestUpdate();
    });
  }
  disconnectedCallback() {
    this._usageWorkspaceRoute.destroy(), super.disconnectedCallback();
  }
  render() {
    const e = Math.max(1, Math.ceil(this._total / this._pageSize));
    return n`
      <div id="main">
        <uui-box headline="Content model analysis">
          <p>
            Find unused or potentially obsolete Umbraco configuration and review its dependencies before cleanup.
          </p>

            <div class="toolbar">
              <uui-button look="primary" label="Run scan" @click=${i(this, t, D)} ?disabled=${this._loading}>
                Run scan
              </uui-button>

              ${this._scannedAt ? n`<span class="muted">Last scan: ${new Date(this._scannedAt).toLocaleString()}</span>` : h}
            </div>
          </uui-box>

          ${this._summary ? n`
                <div class="summary-grid">
                  ${i(this, t, _).call(this, "Total analyzed", this._summary.totalItems, "icon-search", "all")}
                  ${i(this, t, _).call(this, "Low risk", this._summary.lowRisk, "icon-check", "Low")}
                  ${i(this, t, _).call(this, "Moderate", this._summary.moderate, "icon-shield", "Moderate")}
                  ${i(this, t, _).call(this, "Review", this._summary.review, "icon-alert", "Review")}
                  ${i(this, t, _).call(this, "High risk", this._summary.highRisk, "icon-stop-alt", "High")}
                </div>
              ` : h}

          <uui-box headline="Cleanup candidates">
            <div class="filters">
              <uui-input
                label="Search"
                placeholder="Search by name or alias"
                .value=${this._search}
                @input=${(a) => this._search = a.target.value}
                @keydown=${i(this, t, B)}>
              </uui-input>

              <uui-select
                label="Type"
                .value=${this._type}
                .options=${[
      { name: "All types", value: "all", selected: this._type === "all" },
      { name: "Document Type", value: "Document Type", selected: this._type === "Document Type" },
      { name: "Property", value: "Property", selected: this._type === "Property" },
      { name: "Data Type", value: "Data Type", selected: this._type === "Data Type" }
    ]}
                @change=${i(this, t, U)}>
              </uui-select>

              <uui-select
                label="Risk"
                .value=${this._risk}
                .options=${[
      { name: "All risks", value: "all", selected: this._risk === "all" },
      { name: "Low", value: "Low", selected: this._risk === "Low" },
      { name: "Moderate", value: "Moderate", selected: this._risk === "Moderate" },
      { name: "Review", value: "Review", selected: this._risk === "Review" },
      { name: "High", value: "High", selected: this._risk === "High" }
    ]}
                @change=${i(this, t, K)}>
              </uui-select>

              <div class="filter-actions">
                <uui-button look="primary" label="Search" @click=${i(this, t, b)}>Search</uui-button>
                <uui-button look="secondary" label="Clear" @click=${i(this, t, L)}>Clear</uui-button>
              </div>
            </div>

            ${this._error ? n`<uui-box class="error-box"><uui-icon name="icon-alert"></uui-icon> ${this._error}</uui-box>` : h}

            ${this._loading ? n`<div class="loader"><uui-loader></uui-loader></div>` : n`
                  <div class="table-wrap">
                    ${this._selectedKeys.size > 0 ? n`
                          <div class="selection-bar">
                            <span><strong>${this._selectedKeys.size}</strong> candidate(s) selected</span>
                            <div class="selection-actions">
                              <uui-button
                                compact
                                look="outline"
                                color="danger"
                                label="Delete selected"
                                @click=${i(this, t, H)}>
                                <uui-icon name="icon-trash"></uui-icon> Delete selected (${this._selectedKeys.size})
                              </uui-button>
                              <uui-button
                                compact
                                look="secondary"
                                label="Clear selection"
                                @click=${() => {
      this._selectedKeys = /* @__PURE__ */ new Set();
    }}>
                                Clear
                              </uui-button>
                            </div>
                          </div>
                        ` : h}

                    <uui-table>
                      <uui-table-head>
                        <uui-table-head-cell class="checkbox-head-cell">
                          <uui-checkbox
                            .checked=${i(this, t, z).call(this)}
                            .indeterminate=${i(this, t, I).call(this)}
                            @change=${i(this, t, N)}
                            label="Select all candidates">
                          </uui-checkbox>
                        </uui-table-head-cell>
                        ${i(this, t, v).call(this, "Name", "name")}
                        ${i(this, t, v).call(this, "Type", "type")}
                        ${i(this, t, v).call(this, "Usage Count", "usage")}
                        ${i(this, t, v).call(this, "Risk", "risk")}
                        <uui-table-head-cell><span>Details</span></uui-table-head-cell>
                        <uui-table-head-cell class="usage-head-cell"><span>Usage</span></uui-table-head-cell>
                        <uui-table-head-cell class="action-head-cell"><span>Action</span></uui-table-head-cell>
                      </uui-table-head>

                      ${this._items.map((a) => {
      var s;
      return n`
                          <uui-table-row ?selected=${this._selectedKeys.has(a.key)}>
                            <uui-table-cell class="checkbox-cell">
                              <uui-checkbox
                                .checked=${this._selectedKeys.has(a.key)}
                                @change=${(o) => i(this, t, j).call(this, a.key, o)}
                                label="Select ${a.name}">
                              </uui-checkbox>
                            </uui-table-cell>
                            <uui-table-cell>
                              <strong>${a.name}</strong>
                              <div class="muted">${a.alias}</div>
                            </uui-table-cell>
                            <uui-table-cell>${a.type}</uui-table-cell>
                            <uui-table-cell class="usage-count-cell">${i(this, t, q).call(this, a)}</uui-table-cell>
                            <uui-table-cell>
                              <uui-tag class=${a.risk === "Moderate" ? "risk-moderate" : ""} color=${i(this, t, P).call(this, a.risk)}>${a.risk}</uui-tag>
                            </uui-table-cell>
                            <uui-table-cell>
                              <div>${a.summary}</div>
                            </uui-table-cell>
                            <uui-table-cell class="usage-cell-action">
                              ${(s = a.usages) != null && s.length ? n`
                                    <uui-button
                                      compact
                                      look="secondary"
                                      label="View usage"
                                      .href=${i(this, t, T).call(this, a)}
                                      @click=${(o) => i(this, t, Y).call(this, o, a)}>
                                      View usage
                                    </uui-button>
                                  ` : n`<span class="muted">-</span>`}
                            </uui-table-cell>
                            <uui-table-cell class="action-cell">
                              <uui-button
                                compact
                                look="outline"
                                color="danger"
                                label="Delete ${a.name}"
                                title="Delete ${a.name}"
                                @click=${() => i(this, t, W).call(this, a)}>
                                <uui-icon name="icon-trash"></uui-icon>
                              </uui-button>
                            </uui-table-cell>
                          </uui-table-row>
                        `;
    })}
                    </uui-table>

                    ${this._items.length === 0 ? n`
                          <div class="empty-state">
                            <uui-icon name="icon-search"></uui-icon>
                            <span>No cleanup candidates match the selected filters.</span>
                          </div>
                        ` : h}
                  </div>
                `}
          </uui-box>

          ${this._loading ? h : i(this, t, O).call(this, e)}
        </div>
    `;
  }
}
t = new WeakSet(), x = async function(e) {
  if (!this._authContext)
    throw new Error("Umbraco authentication context is unavailable.");
  const a = await this._authContext.getLatestToken(), s = new AbortController(), o = globalThis.setTimeout(() => s.abort(), re);
  let r;
  try {
    r = await fetch(e, {
      credentials: "include",
      signal: s.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${a}`
      }
    });
  } catch (l) {
    throw l instanceof DOMException && l.name === "AbortError" ? new Error("The Content Cleaner request timed out. Please try Run scan again.") : l;
  } finally {
    globalThis.clearTimeout(o);
  }
  if (!r.ok)
    throw new Error(`Request failed (${r.status})`);
  return r.json();
}, D = async function() {
  this._loading = !0, this._error = "";
  let e = !1;
  try {
    const a = await i(this, t, x).call(this, `${f}/scan`);
    this._page = 1, i(this, t, $).call(this, a), e = !0;
  } catch (a) {
    this._error = a instanceof Error ? a.message : "Unable to run the analysis.";
  } finally {
    this._loading = !1;
  }
  e && i(this, t, y).call(this, !1);
}, k = async function() {
  this._loading = !0, this._error = "";
  let e = !1;
  try {
    const a = await i(this, t, x).call(this, `${f}/snapshot`);
    i(this, t, $).call(this, a), e = !0;
  } catch (a) {
    this._error = a instanceof Error ? a.message : "Unable to load the latest analysis.";
  } finally {
    this._loading = !1;
  }
  e && i(this, t, y).call(this, !1);
}, $ = function(e) {
  const a = e.items ?? [];
  this._summary = e.summary, this._scannedAt = e.scannedAtUtc, this._items = a.slice(0, this._pageSize), this._total = a.length, this._selectedKeys = /* @__PURE__ */ new Set();
}, y = async function(e = !0) {
  const a = ++this._candidateRequestId;
  e && (this._loading = !0), this._error = "";
  try {
    const s = new URLSearchParams({
      skip: String((this._page - 1) * this._pageSize),
      take: String(this._pageSize),
      search: this._search,
      type: this._type,
      risk: this._risk,
      sortBy: this._sortBy,
      sortDirection: this._sortDirection
    }), o = await i(this, t, x).call(this, `${f}/candidates?${s}`);
    if (a !== this._candidateRequestId) return;
    this._items = o.items ?? [], this._total = o.total ?? 0, this._scannedAt = o.scannedAtUtc, this._selectedKeys = /* @__PURE__ */ new Set();
    const r = Math.max(1, Math.ceil(this._total / this._pageSize));
    this._page > r && (this._page = r, await i(this, t, y).call(this, e));
  } catch (s) {
    if (a !== this._candidateRequestId) return;
    this._error = s instanceof Error ? s.message : "Unable to load cleanup candidates.";
  } finally {
    e && a === this._candidateRequestId && (this._loading = !1);
  }
}, b = function() {
  this._page = 1, i(this, t, y).call(this);
}, U = function(e) {
  this._type = e.target.value, i(this, t, b).call(this);
}, K = function(e) {
  this._risk = e.target.value, i(this, t, b).call(this);
}, L = function() {
  this._search = "", this._type = "all", this._risk = "all", this._page = 1, i(this, t, y).call(this);
}, B = function(e) {
  e.key === "Enter" && (e.preventDefault(), i(this, t, b).call(this));
}, M = function(e) {
  var o, r;
  const a = e.target, s = Number(((o = e.detail) == null ? void 0 : o.pageNumber) ?? ((r = e.detail) == null ? void 0 : r.page) ?? a.current);
  !Number.isFinite(s) || s < 1 || s === this._page || (this._page = s, i(this, t, y).call(this));
}, C = function(e) {
  this._sortBy === e ? this._sortDirection = this._sortDirection === "asc" ? "desc" : "asc" : (this._sortBy = e, this._sortDirection = "asc"), this._page = 1, i(this, t, y).call(this);
}, P = function(e) {
  switch (e) {
    case "Low":
      return "positive";
    case "Moderate":
      return "default";
    case "Review":
      return "warning";
    case "High":
      return "danger";
    default:
      return "default";
  }
}, z = function() {
  return this._items.length > 0 && this._items.every((e) => this._selectedKeys.has(e.key));
}, I = function() {
  return this._items.some((e) => this._selectedKeys.has(e.key)) && !i(this, t, z).call(this);
}, N = function(e) {
  const a = e.target.checked, s = new Set(this._selectedKeys);
  for (const o of this._items)
    a ? s.add(o.key) : s.delete(o.key);
  this._selectedKeys = s;
}, j = function(e, a) {
  const s = a.target.checked, o = new Set(this._selectedKeys);
  s ? o.add(e) : o.delete(e), this._selectedKeys = o;
}, H = async function() {
  var o, r;
  const e = this._items.filter((l) => this._selectedKeys.has(l.key));
  if (e.length === 0) return;
  const a = e.length, s = e.some((l) => {
    var d;
    return (((d = l.usages) == null ? void 0 : d.length) ?? l.usageCount) > 0;
  });
  try {
    await E(this, {
      headline: `Delete ${a} item${a === 1 ? "" : "s"}`,
      content: n`
          <p style="margin: 0 0 var(--uui-size-space-3, 12px);">Are you sure you want to delete the ${a} selected cleanup candidate${a === 1 ? "" : "s"}?</p>
          ${s ? n`<p style="margin: 0 0 var(--uui-size-space-3, 12px);">Warning: Some selected items have detected usages. Deleting them may impact existing content or configuration.</p>` : h}
          <p style="margin: 0;">This action cannot be undone.</p>
        `,
      color: "danger",
      confirmLabel: "Delete"
    });
  } catch {
    return;
  }
  this._loading = !0;
  try {
    if (!this._authContext)
      throw new Error("Umbraco authentication context is unavailable.");
    const l = await this._authContext.getLatestToken(), d = {
      items: e.map((m) => ({ key: m.key, type: m.type }))
    }, g = await fetch(`${f}/batch-delete`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${l}`
      },
      body: JSON.stringify(d)
    });
    if (!g.ok) {
      const m = await g.json().catch(() => ({}));
      throw new Error(m.message || `Request failed (${g.status})`);
    }
    (o = this._notificationContext) == null || o.peek("positive", {
      data: { message: `Successfully deleted ${a} item${a === 1 ? "" : "s"}.` }
    }), this._selectedKeys = /* @__PURE__ */ new Set(), await i(this, t, k).call(this);
  } catch (l) {
    const d = l instanceof Error ? l.message : "Unable to delete selected items.";
    (r = this._notificationContext) == null || r.peek("danger", {
      data: { message: d }
    }), this._error = d;
  } finally {
    this._loading = !1;
  }
}, W = async function(e) {
  var o, r, l;
  const a = (((o = e.usages) == null ? void 0 : o.length) ?? e.usageCount) > 0, s = e.usages && e.usages.length > 0 ? e.usages.length : e.usageCount;
  try {
    await E(this, {
      headline: `Delete ${e.type}`,
      content: n`
          <p style="margin: 0 0 var(--uui-size-space-3, 12px);">Are you sure you want to delete ${e.type.toLowerCase()} "${e.name}"?</p>
          ${a ? n`<p style="margin: 0 0 var(--uui-size-space-3, 12px);">Warning: This item has ${s} detected usage(s). Deleting it may impact existing content or configuration.</p>` : h}
          <p style="margin: 0;">This action cannot be undone.</p>
        `,
      color: "danger",
      confirmLabel: "Delete"
    });
  } catch {
    return;
  }
  this._loading = !0;
  try {
    if (!this._authContext)
      throw new Error("Umbraco authentication context is unavailable.");
    const d = await this._authContext.getLatestToken(), g = new URLSearchParams({ type: e.type }), m = await fetch(`${f}/candidate/${e.key}?${g}`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${d}`
      }
    });
    if (!m.ok) {
      const G = await m.json().catch(() => ({}));
      throw new Error(G.message || `Request failed (${m.status})`);
    }
    (r = this._notificationContext) == null || r.peek("positive", {
      data: { message: `${e.type} "${e.name}" was successfully deleted.` }
    }), await i(this, t, k).call(this);
  } catch (d) {
    const g = d instanceof Error ? d.message : "Unable to delete item.";
    (l = this._notificationContext) == null || l.peek("danger", {
      data: { message: g }
    }), this._error = g;
  } finally {
    this._loading = !1;
  }
}, q = function(e) {
  var r, l;
  const a = ((r = e.usages) == null ? void 0 : r.filter((d) => d.referenceType === "Content" || d.referenceType === "BlockList" || d.referenceType === "BlockGrid").length) ?? 0, s = (((l = e.usages) == null ? void 0 : l.length) ?? 0) - a, o = e.usages && e.usages.length > 0 ? a + s : e.usageCount;
  return e.usages && e.usages.length > 0 && (a > 0 || s > 0) ? n`
        <div class="usage-count-tags">
          ${a > 0 ? n`
                <uui-tag look="outline">
                  <span class="usage-count-tag-content">
                    <span class="usage-count-culture">Content</span>
                    <span class="usage-count-value">${a}</span>
                  </span>
                </uui-tag>
              ` : h}
          ${s > 0 ? n`
                <uui-tag look="outline">
                  <span class="usage-count-tag-content">
                    <span class="usage-count-culture">Config</span>
                    <span class="usage-count-value">${s}</span>
                  </span>
                </uui-tag>
              ` : h}
        </div>
      ` : o === 0 ? n`<span class="muted">-</span>` : n`
      <div class="usage-count-tags">
        <uui-tag look="outline">
          <span class="usage-count-tag-content">
            <span class="usage-count-value">${o}</span>
          </span>
        </uui-tag>
      </div>
    `;
}, O = function(e) {
  return e <= 1 ? h : n`
      <div class="pagination-wrapper">
        <uui-pagination
          label="Cleanup candidates pages"
          .total=${e}
          .current=${this._page}
          @change=${i(this, t, M)}>
        </uui-pagination>
      </div>
    `;
}, _ = function(e, a, s, o) {
  const r = this._risk === o;
  return n`
      <uui-box
        class="summary-card ${r ? "summary-card--selected" : ""}"
        role="button"
        tabindex="0"
        aria-pressed=${r}
        aria-label="Filter by ${e}"
        @click=${() => i(this, t, S).call(this, o)}
        @keydown=${(l) => i(this, t, F).call(this, l, o)}>
        <div class="summary-card__content">
          <uui-icon name=${s}></uui-icon>
          <div>
            <div class="summary-card__value">${a}</div>
            <div class="summary-card__label">${e}</div>
          </div>
        </div>
      </uui-box>
    `;
}, S = function(e) {
  this._risk = e, i(this, t, b).call(this);
}, F = function(e, a) {
  (e.key === "Enter" || e.key === " ") && (e.preventDefault(), i(this, t, S).call(this, a));
}, v = function(e, a) {
  const s = this._sortBy === a, o = s ? this._sortDirection === "asc" ? "ascending" : "descending" : "none";
  return n`
      <uui-table-head-cell aria-sort=${o} style="white-space: nowrap;">
        <div
          class="head-cell-content"
          role="button"
          tabindex="0"
          aria-label="Sort by ${e}"
          @click=${() => i(this, t, C).call(this, a)}
          @keydown=${(r) => {
    (r.key === "Enter" || r.key === " ") && (r.preventDefault(), i(this, t, C).call(this, a));
  }}>
          <span>${e}</span>
          <uui-symbol-sort
            ?active=${s}
            ?descending=${this._sortDirection === "desc"}>
          </uui-symbol-sort>
        </div>
      </uui-table-head-cell>
    `;
}, T = function(e) {
  if (!(!e.key || !this._usageWorkspacePathBuilder))
    return this._usageWorkspacePathBuilder({ candidateKey: e.key });
}, Y = function(e, a) {
  if (!i(this, t, T).call(this, a)) {
    e.preventDefault();
    return;
  }
  this._selectedUsageCandidate = a;
}, p(w, "properties", {
  _items: { state: !0 },
  _summary: { state: !0 },
  _loading: { state: !0 },
  _error: { state: !0 },
  _search: { state: !0 },
  _type: { state: !0 },
  _risk: { state: !0 },
  _page: { state: !0 },
  _pageSize: { state: !0 },
  _total: { state: !0 },
  _scannedAt: { state: !0 },
  _sortBy: { state: !0 },
  _sortDirection: { state: !0 },
  _selectedKeys: { state: !0 }
}), p(w, "styles", [
  ee,
  V`
      :host {
        display: block;
        box-sizing: border-box;
        padding: var(--uui-size-layout-1);
        color: var(--uui-color-text);
        font-family: var(--uui-font-family, Lato, "Helvetica Neue", Helvetica, Arial, sans-serif);
        font-size: var(--uui-type-default-size, 14px);
      }

      uui-button {
        font-size: var(--uui-type-default-size, 14px);
        --uui-button-font-size: var(--uui-type-default-size, 14px);
        font-family: inherit;
      }

      uui-table-head {
        font-weight: 600 !important;
        color: var(--uui-color-text) !important;
        background-color: var(--uui-color-surface);
        border-bottom: 1px solid var(--uui-color-border);
      }

      uui-table-head-cell {
        --uui-table-cell-padding: 10px 20px;
        font-weight: 600 !important;
        font-size: var(--uui-type-default-size, 14px) !important;
        color: var(--uui-color-text) !important;
        box-sizing: border-box;
        border-bottom: 1px solid var(--uui-color-border);
      }

      uui-table-head-cell,
      uui-table-head-cell span,
      uui-table-head-cell .head-cell-content {
        font-family: var(--uui-font-family, Lato, "Helvetica Neue", Helvetica, Arial, sans-serif) !important;
        font-size: var(--uui-type-default-size, 14px) !important;
        font-weight: 600 !important;
        color: var(--uui-color-text) !important;
        line-height: inherit;
      }

      .head-cell-content {
        display: inline-flex;
        align-items: center;
        gap: var(--uui-size-space-2);
        cursor: pointer;
        user-select: none;
        outline: none;
      }

      .head-cell-content:hover,
      uui-table-head-cell:hover,
      uui-table-head-cell:focus-within {
        --uui-symbol-sort-hover: 1;
      }

      #main {
      display: grid;
      gap: var(--uui-size-space-5);
    }

    p {
      margin-top: 0;
    }

    .toolbar,
    .filter-actions,
    .usage-actions {
      display: flex;
      align-items: center;
      gap: var(--uui-size-space-3);
    }

    .toolbar {
      justify-content: space-between;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--uui-size-space-4);
    }

    .summary-card {
      cursor: pointer;
      user-select: none;
      transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
      border: 2px solid transparent;
      border-radius: var(--uui-border-radius, 4px);
      outline: none;
    }

    .summary-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      border-color: var(--uui-color-border-emphasis, #c5c5c5);
    }

    .summary-card:focus-visible {
      box-shadow: 0 0 0 2px var(--uui-color-selected, #3544b1);
      border-color: var(--uui-color-selected, #3544b1);
    }

    .summary-card--selected {
      border-color: var(--uui-color-selected, #3544b1);
      box-shadow: 0 2px 8px rgba(53, 68, 177, 0.18);
    }

    .summary-card__content {
      display: flex;
      align-items: center;
      gap: var(--uui-size-space-4);
    }

    .summary-card__value {
      font-size: var(--uui-type-h4-size);
      font-weight: 700;
    }

    .summary-card__label,
    .muted {
      color: var(--uui-color-text-alt);
    }

    .filters {
      display: grid;
      grid-template-columns: minmax(220px, 2fr) minmax(170px, 1fr) minmax(170px, 1fr) auto;
      gap: var(--uui-size-space-3);
      align-items: end;
      margin-bottom: var(--uui-size-space-4);
    }

    .table-wrap {
      overflow-x: auto;
    }

    .loader,
    .empty-state {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .loader,
    .empty-state {
      gap: var(--uui-size-space-3);
      padding: var(--uui-size-layout-2);
    }

    .error-box {
      margin-bottom: var(--uui-size-space-4);
    }

    .usage-actions {
      flex-wrap: wrap;
      margin-top: var(--uui-size-space-2);
    }

    .pagination-wrapper {
      display: block;
      width: 100%;
      padding-top: var(--uui-size-space-4);
    }

    .pagination-wrapper uui-pagination {
      display: inline-flex;
      width: 100%;
    }

    .usage-count-cell {
      text-align: center;
    }

    .usage-count-tags {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--uui-size-space-2);
    }

    .usage-count-tags uui-tag {
      --uui-color-default-standalone: var(--uui-color-border-standalone);
      --uui-tag-border-radius: 999px;
      --uui-tag-padding: var(--uui-size-space-1) var(--uui-size-space-2);
      box-sizing: border-box;
      width: auto;
    }

    .usage-count-tag-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--uui-size-space-2);
      width: 100%;
      white-space: nowrap;
      line-height: 1;
    }

    .usage-count-culture {
      color: var(--uui-color-text-alt);
      font-weight: 700;
    }

    .usage-count-value {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: auto;
      min-width: var(--uui-size-6);
      min-height: var(--uui-size-6);
      padding: var(--uui-size-space-1) var(--uui-size-space-2);
      border-radius: 999px;
      background: #eaeaea;
      color: var(--uui-color-text);
      font-weight: 700;
    }

    .risk-moderate {
      --uui-tag-background-color: var(--uui-color-surface-emphasis);
      --uui-tag-color: var(--uui-color-interactive);
      --uui-tag-border-color: var(--uui-color-border);
      border: 1px solid var(--uui-color-border);
      font-weight: 600;
    }

    .checkbox-head-cell,
    .checkbox-cell,
    .usage-head-cell,
    .usage-cell-action,
    .action-head-cell,
    .action-cell {
      width: 1%;
      text-align: center;
      white-space: nowrap;
    }

    .selection-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--uui-size-space-3);
      padding: var(--uui-size-space-3) var(--uui-size-space-4);
      background-color: var(--uui-color-surface-emphasis);
      border: 1px solid var(--uui-color-border);
      border-radius: var(--uui-border-radius);
      margin-bottom: var(--uui-size-space-4);
    }

    .selection-actions {
      display: flex;
      align-items: center;
      gap: var(--uui-size-space-2);
    }

    @media (max-width: 900px) {
      .filters {
        grid-template-columns: 1fr;
      }

      .toolbar {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `
]);
customElements.define("umb-content-cleaner-dashboard", w);
export {
  w as default
};
