var g = Object.defineProperty;
var _ = (n, e, t) => e in n ? g(n, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : n[e] = t;
var o = (n, e, t) => _(n, typeof e != "symbol" ? e + "" : e, t);
import { LitElement as b, css as y, html as a } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin as T } from "@umbraco-cms/backoffice/element-api";
import { UmbModalRouteRegistrationController as f } from "@umbraco-cms/backoffice/router";
import { UMB_WORKSPACE_MODAL as v } from "@umbraco-cms/backoffice/workspace";
import { UMB_DOCUMENT_ENTITY_TYPE as w, UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN as P } from "@umbraco-cms/backoffice/document";
const d = "/umbraco/backoffice/elementfinder", m = 20;
class c extends T(b) {
  constructor() {
    super(), this._view = "list", this._elementTypes = [], this._elementTypeSearchText = "", this._elementTypeFilter = "", this._elementTypePage = 1, this._elementTypeTotalPages = 1, this._selectedElementType = null, this._pages = [], this._pageSearchText = "", this._pageFilter = "", this._pagePage = 1, this._pageTotalPages = 1, this._loading = !1, this._error = null, this._elementTypeRequestId = 0, this._pageRequestId = 0, this._workspaceModalRoute = new f(this, v).onSetup(async () => ({
      data: {
        entityType: w,
        preset: {}
      }
    })).onSubmit(() => {
    }).onReject(() => {
    }).observeRouteBuilder((e) => {
      this._workspaceModalPathBuilder = e;
    });
  }
  disconnectedCallback() {
    var e;
    (e = this._workspaceModalRoute) == null || e.destroy(), super.disconnectedCallback();
  }
  connectedCallback() {
    super.connectedCallback(), this._loadElementTypes(1, "");
  }
  async _loadElementTypes(e = 1, t = this._elementTypeFilter) {
    const i = ++this._elementTypeRequestId;
    this._loading = !0, this._error = null;
    try {
      const s = new URLSearchParams({
        page: String(e),
        pageSize: String(m)
      });
      t && s.set("search", t);
      const l = await fetch(`${d}/elementtypes?${s.toString()}`);
      if (!l.ok) throw new Error(`Request failed (${l.status})`);
      const u = await l.json();
      if (i !== this._elementTypeRequestId) return;
      this._elementTypes = u.items ?? [], this._elementTypePage = u.page ?? e, this._elementTypeTotalPages = u.totalPages ?? 1;
    } catch (s) {
      i === this._elementTypeRequestId && (this._error = `Could not load Element Types: ${s}`);
    } finally {
      i === this._elementTypeRequestId && (this._loading = !1);
    }
  }
  async _openElementType(e) {
    this._selectedElementType = e, this._view = "detail", this._pageFilter = "", this._pageSearchText = "", this._pages = [], this._pagePage = 1, this._pageTotalPages = 1, await this._loadPages(1, "");
  }
  async _loadPages(e = 1, t = this._pageFilter) {
    var s;
    if (!((s = this._selectedElementType) != null && s.alias)) return;
    const i = ++this._pageRequestId;
    this._loading = !0, this._error = null;
    try {
      const l = new URLSearchParams({
        elementTypeAlias: this._selectedElementType.alias,
        page: String(e),
        pageSize: String(m)
      });
      t && l.set("search", t);
      const u = await fetch(`${d}/pagesforelementtype?${l.toString()}`);
      if (!u.ok) throw new Error(`Request failed (${u.status})`);
      const r = await u.json();
      if (i !== this._pageRequestId) return;
      this._pages = r.items ?? [], this._pagePage = r.page ?? e, this._pageTotalPages = r.totalPages ?? 1;
    } catch (l) {
      i === this._pageRequestId && (this._error = `Could not load pages for ${this._selectedElementType.name}: ${l}`);
    } finally {
      i === this._pageRequestId && (this._loading = !1);
    }
  }
  _back() {
    this._view = "list", this._selectedElementType = null, this._pages = [], this._pagePage = 1, this._pageTotalPages = 1, this._pageFilter = "", this._pageSearchText = "", this._error = null, this._loadElementTypes(this._elementTypePage, this._elementTypeFilter);
  }
  _getPageWorkspaceHref(e) {
    if (!(e != null && e.key) || !this._workspaceModalPathBuilder) return;
    const t = this._workspaceModalPathBuilder({}), i = P.generateLocal({
      unique: e.key
    });
    if (!(!t || !i))
      return `${t}${i}`;
  }
  _submitElementTypeSearch() {
    this._elementTypeFilter = this._elementTypeSearchText.trim(), this._elementTypePage = 1, this._loadElementTypes(1, this._elementTypeFilter);
  }
  _submitPageSearch() {
    this._pageFilter = this._pageSearchText.trim(), this._pagePage = 1, this._loadPages(1, this._pageFilter);
  }
  _onElementTypeSearchInput(e) {
    var t;
    this._elementTypeSearchText = ((t = e.target) == null ? void 0 : t.value) ?? "";
  }
  _onPageSearchInput(e) {
    var t;
    this._pageSearchText = ((t = e.target) == null ? void 0 : t.value) ?? "";
  }
  _onSearchKeydown(e, t) {
    e.key === "Enter" && (e.preventDefault(), t.call(this));
  }
  /**
   * Umbraco's IContentType.Icon returns a combined string like
   * "icon-blueprint color-blue" (icon class + color class together).
   * uui-icon's name attribute only accepts the icon identifier itself,
   * so we take just the first token and fall back to a default icon
   * when none is set.
   */
  _getIconName(e) {
    return e && e.trim().split(/\s+/)[0] || "icon-document";
  }
  _renderPagination(e, t, i, s) {
    return t <= 1 ? "" : a`
      <div class="pagination-wrapper">
        <uui-pagination
          label=${i}
          .total=${t}
          .current=${e}
          @change=${(l) => {
      var p, h;
      const r = Number(((p = l.detail) == null ? void 0 : p.current) ?? ((h = l.target) == null ? void 0 : h.current));
      Number.isFinite(r) && r !== e && s(r);
    }}
        ></uui-pagination>
      </div>
    `;
  }
  render() {
    return a`
      ${this._error ? a`<uui-box headline="Error">
            <p>${this._error}</p>
          </uui-box>` : ""}
      ${this._view === "list" ? this._renderElementTypeList() : this._renderPageList()}
    `;
  }
  _renderElementTypeList() {
    return a`
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
            @keydown=${(e) => this._onSearchKeydown(e, this._submitElementTypeSearch)}
          ></uui-input>
          <uui-button
            type="button"
            label="Search"
            look="primary"
            @click=${this._submitElementTypeSearch}
          ></uui-button>
        </div>

        ${this._loading ? a`<div class="loader-container"><uui-loader></uui-loader></div>` : a`
              ${this._elementTypes.length > 0 ? a`
                    <uui-table>
                      <uui-table-head>
                        <uui-table-head-cell>Name</uui-table-head-cell>
                        <uui-table-head-cell>Alias</uui-table-head-cell>
                        <uui-table-head-cell>Total Usage Count</uui-table-head-cell>
                        <uui-table-head-cell>Action</uui-table-head-cell>
                      </uui-table-head>

                      ${this._elementTypes.map(
      (e) => a`
                          <uui-table-row>
                            <uui-table-cell>
                              <div class="element-type-name">
                                <uui-icon name=${this._getIconName(e.icon)}></uui-icon>
                                <span>${e.name}</span>
                              </div>
                            </uui-table-cell>
                            <uui-table-cell><code>${e.alias}</code></uui-table-cell>
                            <uui-table-cell>
                              <span class="usage-count-value">${e.totalUsageCount}</span>
                            </uui-table-cell>
                            <uui-table-cell>
                              <uui-button
                                label="View Usage"
                                look="primary"
                                @click=${() => this._openElementType(e)}
                              ></uui-button>
                            </uui-table-cell>
                          </uui-table-row>
                        `
    )}
                    </uui-table>
                  ` : a`
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
      (e) => this._loadElementTypes(e, this._elementTypeFilter)
    )}
    `;
  }
  _renderPageList() {
    var t;
    const e = ((t = this._selectedElementType) == null ? void 0 : t.name) ?? "Element Type";
    return a`
      <uui-box>
        <div slot="headline">
          <div class="detail-breadcrumbs">
            <uui-breadcrumbs>
            <uui-breadcrumb-item @click=${this._back}>
              <uui-icon name="icon-arrow-left" class="breadcrumb-back-icon"></uui-icon>
              Element Types
            </uui-breadcrumb-item>
              <uui-breadcrumb-item>${e}</uui-breadcrumb-item>
            </uui-breadcrumbs>
          </div>
        </div>

        <div class="page-details">
          <p>
            This list shows the content pages where <strong>${e}</strong> is used. Each page is listed once even if the Element Type is used multiple times.
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
            ></uui-button>
          </div>
        </div>

        ${this._loading ? a`<div class="loader-container"><uui-loader></uui-loader></div>` : a`
              ${this._pages.length > 0 ? a`
                    <uui-table>
                      <uui-table-head>
                        <uui-table-head-cell>Name</uui-table-head-cell>
                        <uui-table-head-cell>Status</uui-table-head-cell>
                        <uui-table-head-cell>Usage Count</uui-table-head-cell>
                        <uui-table-head-cell>Action</uui-table-head-cell>
                      </uui-table-head>

                      ${this._pages.map(
      (i) => a`
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
        ([s, l]) => a`
                                  <uui-tag look="outline">
                                    <span class="usage-count-tag-content">
                                      <span class="usage-count-culture">${s}</span>
                                      <span class="usage-count-value">${l}</span>
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
                                @click=${(s) => {
        this._getPageWorkspaceHref(i) || s.preventDefault();
      }}
                              ></uui-button>
                            </uui-table-cell>
                          </uui-table-row>
                        `
    )}
                    </uui-table>
                  ` : a`
                    <p>
                      ${this._pageFilter ? `No pages match "${this._pageFilter}".` : `No pages where "${e}" is used were found.`}
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
o(c, "properties", {
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
}), o(c, "styles", y`
    :host {
      display: block;
      box-sizing: border-box;
      padding: var(--uui-size-layout-1);
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
      display: block;
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
  `);
customElements.define("element-finder-dashboard", c);
