var P = Object.defineProperty;
var C = (T, y, t) => y in T ? P(T, y, { enumerable: !0, configurable: !0, writable: !0, value: t }) : T[y] = t;
var _ = (T, y, t) => C(T, typeof y != "symbol" ? y + "" : y, t);
import { LitElement as $, css as N, html as g } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin as O } from "@umbraco-cms/backoffice/element-api";
import { UmbTextStyles as z } from "@umbraco-cms/backoffice/style";
import { UmbModalRouteRegistrationController as L } from "@umbraco-cms/backoffice/router";
import { UMB_WORKSPACE_MODAL as R } from "@umbraco-cms/backoffice/workspace";
import { UMB_DOCUMENT_ENTITY_TYPE as I, UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN as A } from "@umbraco-cms/backoffice/document";
import { UMB_AUTH_CONTEXT as M } from "@umbraco-cms/backoffice/auth";
const v = "/umbraco/backoffice/elementfinder", k = 20;
class x extends O($) {
  constructor() {
    super();
    _(this, "_authContext");
    _(this, "_scrollCleanup");
    _(this, "_highlightCleanup");
    _(this, "_activeGoToPageItem");
    this._view = "list", this._elementTypes = [], this._elementTypeSearchText = "", this._elementTypeFilter = "", this._elementTypePage = 1, this._elementTypeTotalPages = 1, this._selectedElementType = null, this._pages = [], this._pageSearchText = "", this._pageFilter = "", this._pagePage = 1, this._pageTotalPages = 1, this._loading = !1, this._error = null, this._elementTypeRequestId = 0, this._pageRequestId = 0, this.consumeContext(M, (t) => {
      this._authContext = t ?? void 0;
    }), this._workspaceModalRoute = new L(this, R).onSetup(async () => (this._activeGoToPageItem && this._startScrollWatcher(this._activeGoToPageItem), {
      data: {
        entityType: I,
        preset: {}
      }
    })).onSubmit(() => {
    }).onReject(() => {
    }).observeRouteBuilder((t) => {
      this._workspaceModalPathBuilder = t;
    });
  }
  disconnectedCallback() {
    var t, a, i;
    (t = this._scrollCleanup) == null || t.call(this), this._scrollCleanup = void 0, (a = this._highlightCleanup) == null || a.call(this), this._highlightCleanup = void 0, (i = this._workspaceModalRoute) == null || i.destroy(), super.disconnectedCallback();
  }
  connectedCallback() {
    super.connectedCallback(), this._loadElementTypes(1, "");
  }
  async _loadElementTypes(t = 1, a = this._elementTypeFilter) {
    const i = ++this._elementTypeRequestId;
    this._loading = !0, this._error = null;
    try {
      const r = new URLSearchParams({
        page: String(t),
        pageSize: String(k)
      });
      a && r.set("search", a);
      const n = await fetch(`${v}/elementtypes?${r.toString()}`);
      if (!n.ok) throw new Error(`Request failed (${n.status})`);
      const s = await n.json();
      if (i !== this._elementTypeRequestId) return;
      this._elementTypes = s.items ?? [], this._elementTypePage = s.page ?? t, this._elementTypeTotalPages = s.totalPages ?? 1;
    } catch (r) {
      i === this._elementTypeRequestId && (this._error = `Could not load Element Types: ${r}`);
    } finally {
      i === this._elementTypeRequestId && (this._loading = !1);
    }
  }
  async _openElementType(t) {
    this._selectedElementType = t, this._view = "detail", this._pageFilter = "", this._pageSearchText = "", this._pages = [], this._pagePage = 1, this._pageTotalPages = 1, await this._loadPages(1, "");
  }
  async _loadPages(t = 1, a = this._pageFilter) {
    var r;
    if (!((r = this._selectedElementType) != null && r.alias)) return;
    const i = ++this._pageRequestId;
    this._loading = !0, this._error = null;
    try {
      const n = new URLSearchParams({
        elementTypeAlias: this._selectedElementType.alias,
        page: String(t),
        pageSize: String(k)
      });
      a && n.set("search", a);
      const s = await fetch(`${v}/pagesforelementtype?${n.toString()}`);
      if (!s.ok) throw new Error(`Request failed (${s.status})`);
      const o = await s.json();
      if (i !== this._pageRequestId) return;
      this._pages = o.items ?? [], this._pagePage = o.page ?? t, this._pageTotalPages = o.totalPages ?? 1;
    } catch (n) {
      i === this._pageRequestId && (this._error = `Could not load pages for ${this._selectedElementType.name}: ${n}`);
    } finally {
      i === this._pageRequestId && (this._loading = !1);
    }
  }
  _back() {
    this._view = "list", this._selectedElementType = null, this._pages = [], this._pagePage = 1, this._pageTotalPages = 1, this._pageFilter = "", this._pageSearchText = "", this._error = null, this._loadElementTypes(this._elementTypePage, this._elementTypeFilter);
  }
  _getPageWorkspaceHref(t) {
    if (!(t != null && t.key) || !this._workspaceModalPathBuilder) return;
    const a = this._workspaceModalPathBuilder({}), i = A.generateLocal({
      unique: t.key
    });
    if (!(!a || !i))
      return `${a}${i}`;
  }
  _onGoToPage(t) {
    this._startScrollWatcher(t);
  }
  _startScrollWatcher(t) {
    var b;
    this._activeGoToPageItem = t;
    const a = this._selectedElementType, i = (a == null ? void 0 : a.name) ?? "", r = (a == null ? void 0 : a.alias) ?? "", n = t.key;
    console.log(`[ElementFinder] Starting scroll watcher for page: "${t.name}" (${n}), element: "${i}" (${r})`), (b = this._scrollCleanup) == null || b.call(this);
    let s = !1;
    this._scrollCleanup = () => {
      s = !0;
    };
    let o = [];
    (async () => {
      var f;
      try {
        const e = await ((f = this._authContext) == null ? void 0 : f.getLatestToken()), m = { Accept: "application/json" };
        e && (m.Authorization = `Bearer ${e}`);
        const h = await fetch(
          `${v}/propertyaliasesforelement?contentKey=${n}&elementTypeAlias=${encodeURIComponent(r)}`,
          { headers: m, credentials: "include" }
        );
        h.ok && (o = await h.json() ?? [], console.log("[ElementFinder] Matching property aliases for element:", o));
      } catch (e) {
        console.warn("[ElementFinder] Could not fetch property aliases:", e);
      }
    })();
    const d = Date.now(), l = 2e4, c = 100;
    let u = !1;
    const p = () => {
      if (s) return;
      if (Date.now() - d > l) {
        console.warn(`[ElementFinder] Scroll watcher timed out after ${l}ms.`);
        return;
      }
      const f = this._findOpenWorkspaceModal();
      if (!f) {
        setTimeout(p, c);
        return;
      }
      const e = Date.now() - d > 2500, m = this._findTargetInWorkspace(
        f,
        i,
        r,
        o,
        e
      );
      if (m) {
        const { target: h, isExact: w } = m;
        if (h && h.getBoundingClientRect().height > 0)
          if (w) {
            console.log("[ElementFinder] Found exact target element in workspace:", h), this._scrollAndHighlight(h, f);
            return;
          } else u || (console.log("[ElementFinder] Scrolled towards property container, awaiting block items:", h), u = !0, this._scrollToTarget(h, f));
      }
      setTimeout(p, c);
    };
    setTimeout(p, 50);
  }
  _findOpenWorkspaceModal() {
    const t = this._queryDeepAll((a) => {
      if (this._isInsideDashboard(a)) return !1;
      const i = a.tagName.toLowerCase();
      return i === "uui-modal-sidebar" || i === "umb-workspace-modal" || i === "umb-document-workspace-editor" || i === "umb-workspace-editor" || i === "uui-modal-dialog" || i === "umb-modal";
    }, document);
    return t.length > 0 ? t.find((i) => {
      const r = i.tagName.toLowerCase();
      return r === "uui-modal-sidebar" || r === "umb-workspace-modal";
    }) ?? t[0] : null;
  }
  _getDeepText(t) {
    var r;
    if (!t) return "";
    const a = t instanceof Element && t.shadowRoot ? t.shadowRoot : t, i = [];
    for (let n = 0; n < a.childNodes.length; n++) {
      const s = a.childNodes[n];
      if (s.nodeType === Node.TEXT_NODE) {
        const o = (r = s.textContent) == null ? void 0 : r.trim();
        o && i.push(o);
      } else s.nodeType === Node.ELEMENT_NODE && i.push(this._getDeepText(s));
    }
    return i.filter(Boolean).join(" ");
  }
  _findTargetInWorkspace(t, a, i, r, n = !1) {
    const s = a.trim().toLowerCase(), o = i.trim().toLowerCase(), d = this._queryDeepAll((l) => !this._isInsideDashboard(l), t);
    for (let l = 0; l < d.length; l++) {
      const c = d[l], u = c.tagName.toLowerCase();
      if (u === "umb-block-list-property-editor-ui" || u === "umb-block-grid-property-editor-ui" || u === "umb-block-editor-custom-view")
        continue;
      if (u === "umb-block-list-entry" || u === "umb-block-grid-entry" || u === "umb-ref-list-block" || u === "uui-ref-node" || u.includes("entry") || u.includes("card") || c.classList.contains("umb-block")) {
        const b = (c._contentTypeAlias || c.contentTypeAlias || c.getAttribute("data-content-type-alias") || c.getAttribute("data-element-type") || "").toString().trim().toLowerCase(), f = (c._contentTypeName || c.contentTypeName || "").toString().trim().toLowerCase();
        if (o && b === o || s && f === s)
          return { target: this._getEnclosingCard(c), isExact: !0 };
        const e = this._getDeepText(c).toLowerCase();
        if ((s && (e === s || e.startsWith(s) || e.includes(s)) || o && (e === o || e.startsWith(o) || e.includes(o))) && e.length < 300)
          return { target: this._getEnclosingCard(c), isExact: !0 };
      }
    }
    if (s || o)
      for (let l = 0; l < d.length; l++) {
        const c = d[l], u = c.tagName.toLowerCase();
        if (u === "uui-scroll-container" || u === "umb-body-layout" || u === "umb-workspace-editor" || u === "uui-modal-sidebar" || u === "umb-workspace-modal" || u.includes("property-editor"))
          continue;
        const p = (c.textContent ?? "").trim().toLowerCase();
        if (p === s || p === o)
          return { target: this._getEnclosingCard(c), isExact: !0 };
        if (u.includes("-") || ["span", "div", "strong", "b", "p", "h1", "h2", "h3", "h4", "h5", "uui-tag"].includes(u)) {
          const b = this._getDeepText(c).toLowerCase();
          if (b === s || b === o)
            return { target: this._getEnclosingCard(c), isExact: !0 };
        }
      }
    if (r && r.length > 0)
      for (let l = 0; l < r.length; l++) {
        const c = r[l].trim().toLowerCase();
        for (let u = 0; u < d.length; u++) {
          const p = d[u];
          if (p.tagName.toLowerCase().includes("property") && (p.getAttribute("alias") ?? p.alias ?? p.getAttribute("data-alias") ?? "").trim().toLowerCase() === c) {
            const e = this._queryDeepAll((m) => {
              const h = m.tagName.toLowerCase();
              return h === "umb-block-list-entry" || h === "umb-block-grid-entry" || h === "umb-ref-list-block" || h === "uui-ref-node" || h.includes("entry") || h.includes("card");
            }, p);
            for (let m = 0; m < e.length; m++) {
              const h = e[m], w = (h._contentTypeAlias || h.contentTypeAlias || "").toString().trim().toLowerCase(), S = (h._contentTypeName || h.contentTypeName || "").toString().trim().toLowerCase(), E = this._getDeepText(h).toLowerCase();
              if (o && w === o || s && S === s || s && E.includes(s) || o && E.includes(o))
                return { target: this._getEnclosingCard(h), isExact: !0 };
            }
            if (n)
              return { target: p, isExact: !1 };
          }
        }
      }
    if (s || o)
      for (let l = 0; l < d.length; l++) {
        const c = d[l], u = c.tagName.toLowerCase();
        if (u === "umb-block-list-entry" || u === "umb-block-grid-entry" || u === "umb-ref-list-block" || u === "uui-ref-node" || u.includes("entry") || u.includes("card")) {
          const p = this._getDeepText(c).toLowerCase();
          if ((s && p.includes(s) || o && p.includes(o)) && p.length < 500)
            return { target: this._getEnclosingCard(c), isExact: !0 };
        }
      }
    return null;
  }
  _getEnclosingCard(t) {
    let a = t, i = t, r = 0;
    for (; a && r < 20; ) {
      const n = a.tagName.toLowerCase();
      if ((n === "umb-block-list-entry" || n === "umb-block-grid-entry" || n === "umb-ref-list-block" || n === "uui-ref-node" || n.includes("card") || a.classList.contains("umb-block")) && (i = a, n === "umb-block-list-entry" || n === "umb-block-grid-entry"))
        return a;
      if (n === "uui-scroll-container" || n === "umb-body-layout" || n === "umb-workspace-editor" || n === "umb-workspace-modal" || n === "uui-modal-sidebar")
        break;
      let s = a.parentElement;
      if (!s && a.parentNode instanceof ShadowRoot && (s = a.parentNode.host), !s || !(s instanceof HTMLElement)) break;
      a = s, r++;
    }
    return i;
  }
  _isInsideDashboard(t) {
    let a = t;
    for (; a && a !== document && a !== document.body; ) {
      if (a === this || a instanceof HTMLElement && a.tagName.toLowerCase() === "element-finder-dashboard") return !0;
      a instanceof ShadowRoot ? a = a.host : a = a.parentNode;
    }
    return !1;
  }
  _scrollAndHighlight(t, a) {
    var f;
    this._scrollToTarget(t, a);
    const i = [t], r = this._queryDeepAll((e) => {
      const m = e.tagName.toLowerCase();
      return m === "uui-ref-node" || m === "umb-ref-list-block" || m.includes("card") || e.classList.contains("umb-block-list__block");
    }, t);
    for (let e = 0; e < r.length; e++)
      i.includes(r[e]) || i.push(r[e]);
    (f = this._highlightCleanup) == null || f.call(this);
    const n = (e) => {
      e.dataset.efHighlighted === void 0 && (e.dataset.efHighlighted = "true", e.dataset.efOrigOutline = e.style.outline || "", e.dataset.efOrigOffset = e.style.outlineOffset || "", e.dataset.efOrigShadow = e.style.boxShadow || "", e.dataset.efOrigTransition = e.style.transition || "", e.dataset.efOrigRadius = e.style.borderRadius || "", e.dataset.efOrigZIndex = e.style.zIndex || ""), e.style.setProperty("transition", "outline 0.3s ease, box-shadow 0.3s ease", "important"), e.style.setProperty("outline", "1px solid var(--uui-color-interactive, #1b264f)", "important"), e.style.setProperty("outline-offset", "2px", "important"), e.style.setProperty("box-shadow", "0 0 0 2px var(--uui-color-interactive, #1b264f), 0 0 24px rgba(27, 38, 79, 0.6)", "important"), e.style.setProperty("z-index", "10", "important"), !e.style.borderRadius && e.dataset.efOrigRadius === "" && e.style.setProperty("border-radius", "6px", "important");
    }, s = (e) => {
      e.dataset.efHighlighted !== void 0 && (e.style.setProperty("outline", "3px solid transparent", "important"), e.style.setProperty("box-shadow", "none", "important"), setTimeout(() => {
        e.style.removeProperty("outline"), e.style.removeProperty("outline-offset"), e.style.removeProperty("box-shadow"), e.style.removeProperty("transition"), e.style.removeProperty("border-radius"), e.style.removeProperty("z-index"), e.dataset.efOrigOutline && (e.style.outline = e.dataset.efOrigOutline), e.dataset.efOrigOffset && (e.style.outlineOffset = e.dataset.efOrigOffset), e.dataset.efOrigShadow && (e.style.boxShadow = e.dataset.efOrigShadow), e.dataset.efOrigTransition && (e.style.transition = e.dataset.efOrigTransition), e.dataset.efOrigRadius && (e.style.borderRadius = e.dataset.efOrigRadius), e.dataset.efOrigZIndex && (e.style.zIndex = e.dataset.efOrigZIndex), delete e.dataset.efHighlighted, delete e.dataset.efOrigOutline, delete e.dataset.efOrigOffset, delete e.dataset.efOrigShadow, delete e.dataset.efOrigTransition, delete e.dataset.efOrigRadius, delete e.dataset.efOrigZIndex;
      }, 400));
    }, o = () => {
      for (let e = 0; e < i.length; e++)
        n(i[e]);
    };
    o();
    const d = setTimeout(o, 100), l = setTimeout(o, 250), c = setTimeout(o, 500), u = setTimeout(o, 800), p = setTimeout(o, 1200), b = setTimeout(() => {
      for (let e = 0; e < i.length; e++)
        s(i[e]);
    }, 4500);
    this._highlightCleanup = () => {
      clearTimeout(d), clearTimeout(l), clearTimeout(c), clearTimeout(u), clearTimeout(p), clearTimeout(b);
      for (let e = 0; e < i.length; e++)
        s(i[e]);
    };
  }
  _scrollToTarget(t, a) {
    const i = () => {
      try {
        t.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest"
        });
      } catch {
        t.scrollIntoView();
      }
      const r = [];
      let n = t;
      for (; n && n !== document && n !== document.body && n !== document.documentElement; ) {
        if (n instanceof HTMLElement) {
          const s = n.tagName.toLowerCase(), d = window.getComputedStyle(n).overflowY;
          ((d === "auto" || d === "scroll" || d === "overlay") && n.scrollHeight > n.clientHeight || s === "uui-scroll-container") && (r.includes(n) || r.push(n));
        }
        n instanceof ShadowRoot ? n = n.host : n = n.parentNode;
      }
      if (a) {
        const s = this._queryDeepAll((o) => {
          if (o.tagName.toLowerCase() === "uui-scroll-container") return !0;
          const l = window.getComputedStyle(o);
          return (l.overflowY === "auto" || l.overflowY === "scroll" || l.overflowY === "overlay") && o.scrollHeight > o.clientHeight;
        }, a);
        for (let o = 0; o < s.length; o++)
          r.includes(s[o]) || r.push(s[o]);
      }
      for (let s = 0; s < r.length; s++) {
        const o = r[s], d = t.getBoundingClientRect(), l = o.getBoundingClientRect(), c = d.top - l.top, u = o.scrollTop + c - o.clientHeight / 2 + d.height / 2, p = Math.max(0, u);
        try {
          o.scrollTo({
            top: p,
            behavior: "smooth"
          });
        } catch {
          o.scrollTop = p;
        }
      }
    };
    i(), setTimeout(i, 100), setTimeout(i, 250), setTimeout(i, 500), setTimeout(i, 800), setTimeout(i, 1200), setTimeout(i, 1800);
  }
  _queryDeepAll(t, a = document) {
    const i = [], r = [
      a
    ], n = /* @__PURE__ */ new Set();
    for (; r.length > 0; ) {
      const s = r.shift();
      if (n.has(s)) continue;
      n.add(s);
      try {
        s instanceof HTMLElement && t(s) && i.push(s);
      } catch {
      }
      let o = [];
      try {
        "querySelectorAll" in s && (o = Array.from(s.querySelectorAll("*")));
      } catch {
      }
      for (let d = 0; d < o.length; d++) {
        const l = o[d];
        l instanceof HTMLElement && t(l) && i.push(l), l.shadowRoot && !n.has(l.shadowRoot) && r.push(l.shadowRoot);
      }
    }
    return i;
  }
  _submitElementTypeSearch() {
    this._elementTypeFilter = this._elementTypeSearchText.trim(), this._elementTypePage = 1, this._loadElementTypes(1, this._elementTypeFilter);
  }
  _submitPageSearch() {
    this._pageFilter = this._pageSearchText.trim(), this._pagePage = 1, this._loadPages(1, this._pageFilter);
  }
  _onElementTypeSearchInput(t) {
    var a;
    this._elementTypeSearchText = ((a = t.target) == null ? void 0 : a.value) ?? "";
  }
  _onPageSearchInput(t) {
    var a;
    this._pageSearchText = ((a = t.target) == null ? void 0 : a.value) ?? "";
  }
  _onSearchKeydown(t, a) {
    t.key === "Enter" && (t.preventDefault(), a.call(this));
  }
  /**
   * Umbraco's IContentType.Icon returns a combined string like
   * "icon-blueprint color-blue" (icon class + color class together).
   * uui-icon's name attribute only accepts the icon identifier itself,
   * so we take just the first token and fall back to a default icon
   * when none is set.
   */
  _getIconName(t) {
    return t && t.trim().split(/\s+/)[0] || "icon-document";
  }
  _renderPagination(t, a, i, r) {
    return a <= 1 ? "" : g`
      <div class="pagination-wrapper">
        <uui-pagination
          label=${i}
          .total=${a}
          .current=${t}
          @change=${(n) => {
      var d, l;
      const o = Number(((d = n.detail) == null ? void 0 : d.current) ?? ((l = n.target) == null ? void 0 : l.current));
      Number.isFinite(o) && o !== t && r(o);
    }}
        ></uui-pagination>
      </div>
    `;
  }
  render() {
    return g`
      ${this._error ? g`<uui-box headline="Error">
            <p>${this._error}</p>
          </uui-box>` : ""}
      ${this._view === "list" ? this._renderElementTypeList() : this._renderPageList()}
    `;
  }
  _renderElementTypeList() {
    return g`
      <uui-box>
        <div slot="headline" class="element-finder-title">Element Finder — Element Types</div>

        <div class="element-type-details">
          <p>This list shows the reusable Element Types available in this Umbraco project. Each Element Type can be used as a building block in content pages.</p>
          <p>Select <strong>View Usage</strong> to see which content pages currently use the selected Element Type.</p>
        </div>

        <div class="search-row">
          <uui-input
            label="Search"
            placeholder="Search element types…"
            .value=${this._elementTypeSearchText}
            @input=${this._onElementTypeSearchInput}
            @keydown=${(t) => this._onSearchKeydown(t, this._submitElementTypeSearch)}
          ></uui-input>
          <uui-button
            type="button"
            label="Search"
            look="primary"
            @click=${this._submitElementTypeSearch}
          >Search</uui-button>
        </div>

        ${this._loading ? g`<div class="loader-container"><uui-loader></uui-loader></div>` : g`
              ${this._elementTypes.length > 0 ? g`
                    <uui-table>
                      <uui-table-head>
                        <uui-table-head-cell><span>Name</span></uui-table-head-cell>
                        <uui-table-head-cell><span>Alias</span></uui-table-head-cell>
                        <uui-table-head-cell><span>Total Usage Count</span></uui-table-head-cell>
                        <uui-table-head-cell><span>Action</span></uui-table-head-cell>
                      </uui-table-head>

                      ${this._elementTypes.map(
      (t) => g`
                          <uui-table-row>
                            <uui-table-cell>
                              <div class="element-type-name">
                                <uui-icon name=${this._getIconName(t.icon)}></uui-icon>
                                <span>${t.name}</span>
                              </div>
                            </uui-table-cell>
                            <uui-table-cell><code>${t.alias}</code></uui-table-cell>
                            <uui-table-cell>
                              <span class="usage-count-value">${t.totalUsageCount}</span>
                            </uui-table-cell>
                            <uui-table-cell>
                              <uui-button
                                label="View Usage"
                                look="primary"
                                @click=${() => this._openElementType(t)}
                              >View Usage</uui-button>
                            </uui-table-cell>
                          </uui-table-row>
                        `
    )}
                    </uui-table>
                  ` : g`
                    <p>
                      ${this._elementTypeFilter ? `No Element Types match "${this._elementTypeFilter}".` : "No Element Types found."}
                    </p>
                  `}
            `}
      </uui-box>

      ${this._loading ? "" : this._renderPagination(
      this._elementTypePage,
      this._elementTypeTotalPages,
      "Element type pages",
      (t) => this._loadElementTypes(t, this._elementTypeFilter)
    )}
    `;
  }
  _renderPageList() {
    var a;
    const t = ((a = this._selectedElementType) == null ? void 0 : a.name) ?? "Element Type";
    return g`
      <uui-box>
        <div slot="headline">
          <div class="detail-breadcrumbs">
            <uui-breadcrumbs>
            <uui-breadcrumb-item @click=${this._back}>
              <uui-icon name="icon-arrow-left" class="breadcrumb-back-icon"></uui-icon>
              Element Types
            </uui-breadcrumb-item>
              <uui-breadcrumb-item>${t}</uui-breadcrumb-item>
            </uui-breadcrumbs>
          </div>
        </div>

        <div class="page-details">
          <p>
            This list shows the content pages where <strong>${t}</strong> is used. Each page is listed once even if the Element Type is used multiple times.
          </p>
          <p>
            The status indicates whether the page currently has a published version.
          </p>
          <p>
            Use <strong>Go to Page</strong> to open the selected page in the Umbraco backoffice.
          </p>
        </div>

        <div class="detail-header">
          <div class="page-search">
            <uui-input
              label="Search"
              placeholder="Search pages…"
              .value=${this._pageSearchText}
              @input=${this._onPageSearchInput}
              @keydown=${(i) => this._onSearchKeydown(i, this._submitPageSearch)}
            ></uui-input>
            <uui-button
              type="button"
              label="Search"
              look="primary"
              @click=${this._submitPageSearch}
            >Search</uui-button>
          </div>
        </div>

        ${this._loading ? g`<div class="loader-container"><uui-loader></uui-loader></div>` : g`
              ${this._pages.length > 0 ? g`
                    <uui-table>
                      <uui-table-head>
                        <uui-table-head-cell><span>Name</span></uui-table-head-cell>
                        <uui-table-head-cell><span>Status</span></uui-table-head-cell>
                        <uui-table-head-cell><span>Usage Count</span></uui-table-head-cell>
                        <uui-table-head-cell><span>Action</span></uui-table-head-cell>
                      </uui-table-head>

                      ${this._pages.map(
      (i) => g`
                          <uui-table-row>
                            <uui-table-cell>
                              <div class="element-type-name">
                                <uui-icon name=${this._getIconName(i.icon)}></uui-icon>
                                <span>${i.name}</span>
                              </div>
                            </uui-table-cell>
                            <uui-table-cell>
                              <uui-tag color=${i.published ? "positive" : "default"}>
                                ${i.published ? "Published" : "Unpublished"}
                              </uui-tag>
                            </uui-table-cell>
                            <uui-table-cell>
                              <div class="usage-count-tags">
                                ${Object.entries(i.usageCountsByCulture ?? {}).map(
        ([r, n]) => g`
                                    <uui-tag look="outline">
                                      <span class="usage-count-tag-content">
                                        <span class="usage-count-culture">${r}</span>
                                        <span class="usage-count-value">${n}</span>
                                      </span>
                                    </uui-tag>
                                  `
      )}
                              </div>
                            </uui-table-cell>
                            <uui-table-cell>
                              <uui-button
                                label="Go to Page"
                                look="primary"
                                .href=${this._getPageWorkspaceHref(i)}
                                @pointerdown=${() => {
        this._activeGoToPageItem = i;
      }}
                                @click=${(r) => {
        if (!this._getPageWorkspaceHref(i)) {
          r.preventDefault();
          return;
        }
        this._activeGoToPageItem = i, this._onGoToPage(i);
      }}
                              >Go to Page</uui-button>
                            </uui-table-cell>
                          </uui-table-row>
                        `
    )}
                    </uui-table>
                  ` : g`
                    <p>
                      ${this._pageFilter ? `No pages match "${this._pageFilter}".` : `No pages where "${t}" is used were found.`}
                    </p>
                  `}
            `}
      </uui-box>

      ${this._loading ? "" : this._renderPagination(
      this._pagePage,
      this._pageTotalPages,
      "Used pages",
      (i) => this._loadPages(i, this._pageFilter)
    )}
    `;
  }
}
_(x, "properties", {
  _view: { state: !0 },
  _elementTypes: { state: !0 },
  _elementTypeSearchText: { state: !0 },
  _elementTypeFilter: { state: !0 },
  _elementTypePage: { state: !0 },
  _elementTypeTotalPages: { state: !0 },
  _selectedElementType: { state: !0 },
  _pages: { state: !0 },
  _pageSearchText: { state: !0 },
  _pageFilter: { state: !0 },
  _pagePage: { state: !0 },
  _pageTotalPages: { state: !0 },
  _loading: { state: !0 },
  _error: { state: !0 }
}), _(x, "styles", [
  z,
  N`
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
      uui-table-head-cell span {
        font-family: var(--uui-font-family, Lato, "Helvetica Neue", Helvetica, Arial, sans-serif) !important;
        font-size: var(--uui-type-default-size, 14px) !important;
        font-weight: 600 !important;
        color: var(--uui-color-text) !important;
        line-height: inherit;
      }

      .element-finder-title,
      .detail-breadcrumbs,
      .detail-breadcrumbs uui-breadcrumb-item {
        font-size: 14px !important;
      }

    .breadcrumb-back-icon {
      vertical-align: middle;
      margin-right: 4px;
      font-size: 1rem;
    }

    .element-type-details {
      padding: 0 0 var(--uui-size-space-4);
    }

    .element-type-details p {
      margin: 0 0 var(--uui-size-space-3);
      line-height: 1.5;
    }

    .element-type-details p:last-child {
      margin-bottom: 0;
    }

    .search-row {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--uui-size-space-3);
      padding: var(--uui-size-space-1) 0 var(--uui-size-space-4);
    }

    .search-row uui-input {
      flex: 0 1 25rem;
      min-width: 14rem;
    }

    .detail-header {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--uui-size-space-3);
      padding: 0 0 var(--uui-size-space-4);
    }

    .page-search {
      display: flex;
      align-items: center;
      gap: var(--uui-size-space-3);
      margin-left: auto;
    }

    .page-search uui-input {
      width: 25rem;
      max-width: 100%;
    }

    .page-details {
      padding: 0 0 var(--uui-size-space-4);
    }

    .page-details p {
      margin: 0 0 var(--uui-size-space-3);
      line-height: 1.5;
    }

    .page-details p:last-child {
      margin-bottom: 0;
    }

    .element-type-name {
      display: flex;
      align-items: center;
      gap: var(--uui-size-space-3);
    }

    .element-type-name uui-icon {
      flex-shrink: 0;
      font-size: 1.1rem;
      color: var(--uui-color-interactive);
    }

    .usage-count-tags {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: var(--uui-size-space-2);
    }

    .usage-count-tags uui-tag {
      --uui-color-default-standalone: var(--uui-color-border-standalone);
      --uui-tag-border-radius: 999px;
      --uui-tag-padding: var(--uui-size-space-1) var(--uui-size-space-2);
      box-sizing: border-box;
      width: 5rem;
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

    .pagination-wrapper {
      display: block;
      width: 100%;
      padding-top: var(--uui-size-space-4);
    }

    .pagination-wrapper uui-pagination {
      display: inline-flex;
      width: 100%;
    }

    .loader-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 10rem;
      padding: var(--uui-size-layout-2);
    }

    @media (max-width: 45rem) {
      .search-row,
      .detail-header,
      .page-search {
        align-items: stretch;
        flex-direction: column;
      }

      .search-row uui-input,
      .page-search uui-input {
        width: 100%;
        max-width: none;
      }
    }
  `
]);
customElements.define("element-finder-dashboard", x);
