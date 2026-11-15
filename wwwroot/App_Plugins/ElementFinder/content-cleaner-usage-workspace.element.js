var z = Object.defineProperty;
var _ = (r) => {
  throw TypeError(r);
};
var U = (r, o, e) => o in r ? z(r, o, { enumerable: !0, configurable: !0, writable: !0, value: e }) : r[o] = e;
var d = (r, o, e) => U(r, typeof o != "symbol" ? o + "" : o, e), A = (r, o, e) => o.has(r) || _("Cannot " + e);
var T = (r, o, e) => o.has(r) ? _("Cannot add the same private member more than once") : o instanceof WeakSet ? o.add(r) : o.set(r, e);
var s = (r, o, e) => (A(r, o, "access private method"), e);
import { html as c, nothing as h, css as E } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement as B } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles as R } from "@umbraco-cms/backoffice/style";
import { UMB_AUTH_CONTEXT as v } from "@umbraco-cms/backoffice/auth";
import { UMB_MODAL_CONTEXT as P } from "@umbraco-cms/backoffice/modal";
import { UmbModalRouteRegistrationController as M } from "@umbraco-cms/backoffice/router";
import { UMB_WORKSPACE_MODAL as N } from "@umbraco-cms/backoffice/workspace";
import { UMB_DOCUMENT_ENTITY_TYPE as D, UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN as L } from "@umbraco-cms/backoffice/document";
import { UMB_DOCUMENT_TYPE_ENTITY_TYPE as O, UMB_EDIT_DOCUMENT_TYPE_WORKSPACE_PATH_PATTERN as Y } from "@umbraco-cms/backoffice/document-type";
import { UMB_DATA_TYPE_ENTITY_TYPE as H, UMB_EDIT_DATA_TYPE_WORKSPACE_PATH_PATTERN as S } from "@umbraco-cms/backoffice/data-type";
var a, x, w, k, C, p, m, y, $;
class f extends B {
  constructor() {
    super();
    T(this, a);
    d(this, "_workspaceContext");
    d(this, "_authContext");
    d(this, "_workspaceModalRoute");
    d(this, "_workspaceRouteBuilder");
    this._candidate = void 0, this._loadingFallback = !1, this.consumeContext(v, (e) => {
      this._authContext = e ?? void 0;
    }), this.consumeContext(P, (e) => {
      var n, l;
      const t = e;
      this._workspaceContext = t;
      const i = (l = (n = t == null ? void 0 : t.data) == null ? void 0 : n.preset) == null ? void 0 : l.candidate;
      i ? this._candidate = i : s(this, a, x).call(this);
    }), this._workspaceModalRoute = new M(this, N).addAdditionalPath(":entityType").onSetup((e) => ({
      data: {
        entityType: e.entityType,
        preset: {}
      }
    })).onSubmit(() => {
    }).onReject(() => {
    }).observeRouteBuilder((e) => {
      this._workspaceRouteBuilder = e, this.requestUpdate();
    });
  }
  disconnectedCallback() {
    this._workspaceModalRoute.destroy(), super.disconnectedCallback();
  }
  render() {
    if (this._loadingFallback)
      return c`<div class="loader"><uui-loader></uui-loader></div>`;
    const e = this._candidate;
    if (!e) return h;
    const t = e.usages ?? [], i = t.filter((l) => s(this, a, p).call(this, l)), n = t.filter((l) => !s(this, a, p).call(this, l));
    return c`
      <umb-body-layout headline="Usage — ${e.name}">
        <div id="main">
          <uui-box class="candidate-summary">
            <div slot="headline" class="candidate-headline">
              <span class="candidate-name">${e.name}</span>
              <uui-tag look="outline" class="type-tag">${e.type}</uui-tag>
            </div>
            <p>${e.summary}</p>
            <span class="muted">Review each reference before changing or deleting this item.</span>
          </uui-box>

          <div class="summary-grid" aria-label="Usage summary">
            ${s(this, a, m).call(this, "Total Usages", t.length, "icon-list")}
            ${s(this, a, m).call(this, "Content Usages", i.length, "icon-document")}
            ${s(this, a, m).call(this, "Configurational Usages", n.length, "icon-settings")}
          </div>

          ${t.length === 0 ? c`
                <uui-box class="empty-state">
                  <uui-icon name="icon-search"></uui-icon>
                  <strong>No usage references were detected.</strong>
                  <span class="muted">There are no items available to open.</span>
                </uui-box>
              ` : c`
                <div class="usage-content">
                  ${s(this, a, y).call(this, "Content Usages", "icon-document", i)}
                  ${s(this, a, y).call(this, "Configurational Usages", "icon-settings", n)}
                </div>
              `}
        </div>

        <umb-footer-layout slot="footer">
          <uui-button slot="actions" look="secondary" label="Close" @click=${s(this, a, $)}>Close</uui-button>
        </umb-footer-layout>
      </umb-body-layout>
    `;
  }
}
a = new WeakSet(), x = async function() {
  const e = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, t = window.location.href.match(e), i = t == null ? void 0 : t[0];
  if (!i) return;
  let n = this._authContext;
  n || (n = await new Promise((l) => {
    const u = this.consumeContext(v, (b) => {
      var g;
      b && ((g = u == null ? void 0 : u.destroy) == null || g.call(u), l(b));
    });
  })), this._loadingFallback = !0;
  try {
    const l = await n.getLatestToken(), u = await fetch(
      `/umbraco/backoffice/elementfinder/content-cleaner/candidate/${i}`,
      {
        credentials: "include",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${l}`
        }
      }
    );
    u.ok && (this._candidate = await u.json());
  } catch {
  } finally {
    this._loadingFallback = !1;
  }
}, w = function(e) {
  if (!e.key || !this._workspaceRouteBuilder) return;
  let t, i;
  if (e.referenceType === "Content" || e.referenceType === "BlockList" || e.referenceType === "BlockGrid" ? (t = this._workspaceRouteBuilder({ entityType: D }), i = L.generateLocal({ unique: e.key })) : e.referenceType === "DataType" ? (t = this._workspaceRouteBuilder({ entityType: H }), i = S.generateLocal({ unique: e.key })) : (t = this._workspaceRouteBuilder({ entityType: O }), i = Y.generateLocal({ unique: e.key })), !(!t || !i))
    return `${t}${i}`;
}, k = function(e) {
  switch (e.referenceType) {
    case "BlockList":
      return "Content - Block List";
    case "BlockGrid":
      return "Content - Block Grid";
    case "DocumentType":
    case "ElementType":
      return "Document Type";
    case "DataType":
      return "Data Type";
    case "Composition":
      return "Composition";
    default:
      return "Content";
  }
}, C = function(e) {
  return e.propertyAlias && e.dataTypeName ? `${e.propertyAlias} - ${e.dataTypeName}` : e.propertyAlias ?? e.dataTypeName ?? e.contentTypeAlias ?? "-";
}, p = function(e) {
  return e.referenceType === "Content" || e.referenceType === "BlockList" || e.referenceType === "BlockGrid";
}, m = function(e, t, i) {
  return c`
      <uui-box class="summary-card">
        <div class="summary-card__content">
          <uui-icon name=${i}></uui-icon>
          <div>
            <strong>${t}</strong>
            <span>${e}</span>
          </div>
        </div>
      </uui-box>
    `;
}, y = function(e, t, i) {
  return i.length === 0 ? h : c`
      <uui-box class="usage-group">
        <div slot="headline" class="usage-group__headline">
          <uui-icon name=${t}></uui-icon>
          <span>${e}</span>
        </div>
        <span slot="header-actions">
          <uui-tag color="default">${i.length}</uui-tag>
        </span>

        <div class="table-wrap" role="region" aria-label="${e} table" tabindex="0">
          <uui-table>
            <uui-table-head>
              <uui-table-head-cell><span>Name</span></uui-table-head-cell>
              <uui-table-head-cell><span>Type</span></uui-table-head-cell>
              <uui-table-head-cell><span>Reference</span></uui-table-head-cell>
              <uui-table-head-cell class="action-cell"><span>Action</span></uui-table-head-cell>
            </uui-table-head>

            ${i.map((n) => {
    const l = s(this, a, w).call(this, n), u = s(this, a, p).call(this, n) ? "Open" : "View";
    return c`
                <uui-table-row>
                  <uui-table-cell>
                    <strong>${n.name}</strong>
                    ${n.contentTypeAlias ? c`<div class="muted">${n.contentTypeAlias}</div>` : h}
                  </uui-table-cell>
                  <uui-table-cell>${s(this, a, k).call(this, n)}</uui-table-cell>
                  <uui-table-cell>${s(this, a, C).call(this, n)}</uui-table-cell>
                  <uui-table-cell class="action-cell">
                    ${l ? c`
                          <uui-button
                            look="primary"
                            label=${u}
                            .href=${l}>
                            ${u}
                          </uui-button>
                        ` : c`<span class="muted">Unavailable</span>`}
                  </uui-table-cell>
                </uui-table-row>
              `;
  })}
          </uui-table>
        </div>
      </uui-box>
    `;
}, $ = function() {
  var e;
  (e = this._workspaceContext) == null || e.reject();
}, d(f, "properties", {
  _candidate: { state: !0 },
  _loadingFallback: { state: !0 }
}), d(f, "styles", [
  R,
  E`
      :host {
        display: block;
        width: 100%;
        height: 100%;
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

      #main {
      display: grid;
      gap: var(--uui-size-space-5);
      padding: var(--uui-size-layout-1);
    }

    .candidate-headline {
      display: flex;
      align-items: center;
      gap: var(--uui-size-space-2);
      flex-wrap: wrap;
    }

    .candidate-name {
      font-size: var(--uui-type-h5-size);
      font-weight: 700;
    }

    .type-tag {
      --uui-tag-color: var(--uui-color-text);
      font-weight: 600;
    }

    .candidate-summary p {
      margin: 0 0 var(--uui-size-space-1);
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--uui-size-space-3);
    }

    .summary-card__content {
      display: flex;
      align-items: center;
      gap: var(--uui-size-space-3);
    }

    .summary-card__content div {
      display: grid;
      gap: var(--uui-size-space-1);
    }

    .summary-card__content strong {
      font-size: var(--uui-type-h4-size);
    }

    .summary-card__content span,
    .muted {
      color: var(--uui-color-text-alt);
    }

    .usage-content {
      display: grid;
      gap: var(--uui-size-space-5);
    }

    .usage-group__headline {
      display: flex;
      align-items: center;
      gap: var(--uui-size-space-2);
      font-size: var(--uui-type-h5-size);
      font-weight: 700;
    }

    .table-wrap {
      overflow-x: auto;
    }

    .action-cell {
      width: 1%;
      text-align: right;
      white-space: nowrap;
    }

    .empty-state {
      display: grid;
      justify-items: center;
      gap: var(--uui-size-space-2);
      padding: var(--uui-size-layout-2);
      text-align: center;
    }

    @media (max-width: 800px) {
      .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .loader {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: var(--uui-size-layout-2);
    }
  `
]);
customElements.define("umb-content-cleaner-usage-workspace", f);
export {
  f as default
};
