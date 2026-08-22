import { LitElement, css, html } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin } from "@umbraco-cms/backoffice/element-api";
import { UmbModalRouteRegistrationController } from "@umbraco-cms/backoffice/router";
import { UMB_WORKSPACE_MODAL } from "@umbraco-cms/backoffice/workspace";
import { UMB_DOCUMENT_ENTITY_TYPE, UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN } from "@umbraco-cms/backoffice/document";

const API_BASE = "/umbraco/backoffice/elementfinder";
const PAGE_SIZE = 20;


interface ElementTypeItem {
  name: string;
  alias: string;
  key?: string;
  icon?: string;
  totalUsageCount: number;
}

interface PageItem {
  name: string;
  key: string;
  published: boolean;
  icon?: string;
  totalUsagesCount: number;
  usageCountsByCulture: Record<string, number>;
}

interface PagedResult<T> {
  items?: T[];
  page?: number;
  totalPages?: number;
}

// Must match Umbraco's UmbModalRouteBuilder signature, or observeRouteBuilder rejects it.
type WorkspaceModalPathBuilder = (params: { [key: string]: string | number } | null) => string;


/**
 * Element Types -> Used Pages -> native Umbraco content workspace.
 * Search and pagination are handled server-side so only the requested page of
 * data is sent to the browser.
 */
class ElementFinderDashboardElement extends UmbElementMixin(LitElement) {
  declare _view: "list" | "detail";
  declare _elementTypes: ElementTypeItem[];
  declare _elementTypeSearchText: string;
  declare _elementTypeFilter: string;
  declare _elementTypePage: number;
  declare _elementTypeTotalPages: number;
  declare _selectedElementType: ElementTypeItem | null;
  declare _pages: PageItem[];
  declare _pageSearchText: string;
  declare _pageFilter: string;
  declare _pagePage: number;
  declare _pageTotalPages: number;
  declare _loading: boolean;
  declare _error: string | null;
  declare _elementTypeRequestId: number;
  declare _pageRequestId: number;
  declare _workspaceModalRoute: UmbModalRouteRegistrationController;
  declare _workspaceModalPathBuilder?: WorkspaceModalPathBuilder;

  static properties = {
    _view: { state: true },
    _elementTypes: { state: true },
    _elementTypeSearchText: { state: true },
    _elementTypeFilter: { state: true },
    _elementTypePage: { state: true },
    _elementTypeTotalPages: { state: true },
    _selectedElementType: { state: true },
    _pages: { state: true },
    _pageSearchText: { state: true },
    _pageFilter: { state: true },
    _pagePage: { state: true },
    _pageTotalPages: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  constructor() {
    super();
    this._view = "list";
    this._elementTypes = [];
    this._elementTypeSearchText = "";
    this._elementTypeFilter = "";
    this._elementTypePage = 1;
    this._elementTypeTotalPages = 1;
    this._selectedElementType = null;
    this._pages = [];
    this._pageSearchText = "";
    this._pageFilter = "";
    this._pagePage = 1;
    this._pageTotalPages = 1;
    this._loading = false;
    this._error = null;
    this._elementTypeRequestId = 0;
    this._pageRequestId = 0;

    this._workspaceModalRoute = new UmbModalRouteRegistrationController(this, UMB_WORKSPACE_MODAL)
      .onSetup(async () => ({
        data: {
          entityType: UMB_DOCUMENT_ENTITY_TYPE,
          preset: {},
        },
      }))
      .onSubmit(() => {})
      .onReject(() => {})
      .observeRouteBuilder((routeBuilder: WorkspaceModalPathBuilder) => {
        this._workspaceModalPathBuilder = routeBuilder;
      });
  }

  disconnectedCallback() {
    this._workspaceModalRoute?.destroy();
    super.disconnectedCallback();
  }

  static styles = css`
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
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadElementTypes(1, "");
  }

  async _loadElementTypes(page: number = 1, search: string = this._elementTypeFilter): Promise<void> {
    const requestId = ++this._elementTypeRequestId;
    this._loading = true;
    this._error = null;

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) params.set("search", search);

      const res = await fetch(`${API_BASE}/elementtypes?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const result = (await res.json()) as PagedResult<ElementTypeItem>;

      if (requestId !== this._elementTypeRequestId) return;

      this._elementTypes = result.items ?? [];
      this._elementTypePage = result.page ?? page;
      this._elementTypeTotalPages = result.totalPages ?? 1;
    } catch (err) {
      if (requestId === this._elementTypeRequestId) {
        this._error = `Could not load Element Types: ${err}`;
      }
    } finally {
      if (requestId === this._elementTypeRequestId) {
        this._loading = false;
      }
    }
  }

  async _openElementType(elementType: ElementTypeItem): Promise<void> {
    this._selectedElementType = elementType;
    this._view = "detail";
    this._pageFilter = "";
    this._pageSearchText = "";
    this._pages = [];
    this._pagePage = 1;
    this._pageTotalPages = 1;
    await this._loadPages(1, "");
  }

  async _loadPages(page: number = 1, search: string = this._pageFilter): Promise<void> {
    if (!this._selectedElementType?.alias) return;

    const requestId = ++this._pageRequestId;
    this._loading = true;
    this._error = null;

    try {
      const params = new URLSearchParams({
        elementTypeAlias: this._selectedElementType.alias,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) params.set("search", search);

      const res = await fetch(`${API_BASE}/pagesforelementtype?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const result = (await res.json()) as PagedResult<PageItem>;

      if (requestId !== this._pageRequestId) return;

      this._pages = result.items ?? [];
      this._pagePage = result.page ?? page;
      this._pageTotalPages = result.totalPages ?? 1;
    } catch (err) {
      if (requestId === this._pageRequestId) {
        this._error = `Could not load pages for ${this._selectedElementType.name}: ${err}`;
      }
    } finally {
      if (requestId === this._pageRequestId) {
        this._loading = false;
      }
    }
  }

  _back(): void {
    this._view = "list";
    this._selectedElementType = null;
    this._pages = [];
    this._pagePage = 1;
    this._pageTotalPages = 1;
    this._pageFilter = "";
    this._pageSearchText = "";
    this._error = null;
    void this._loadElementTypes(this._elementTypePage, this._elementTypeFilter);
  }

  _getPageWorkspaceHref(page: PageItem): string | undefined {
    if (!page?.key || !this._workspaceModalPathBuilder) return undefined;

    const modalBase = this._workspaceModalPathBuilder({});
    const editPath = UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN.generateLocal({
      unique: page.key,
    });

    if (!modalBase || !editPath) return undefined;

    return `${modalBase}${editPath}`;
  }

  _submitElementTypeSearch(): void {
    this._elementTypeFilter = this._elementTypeSearchText.trim();
    this._elementTypePage = 1;
    void this._loadElementTypes(1, this._elementTypeFilter);
  }

  _submitPageSearch(): void {
    this._pageFilter = this._pageSearchText.trim();
    this._pagePage = 1;
    void this._loadPages(1, this._pageFilter);
  }

  _onElementTypeSearchInput(event: Event): void {
    this._elementTypeSearchText = (event.target as HTMLInputElement | null)?.value ?? "";
  }

  _onPageSearchInput(event: Event): void {
    this._pageSearchText = (event.target as HTMLInputElement | null)?.value ?? "";
  }

  _onSearchKeydown(event: KeyboardEvent, submitSearch: () => void): void {
    if (event.key === "Enter") {
      event.preventDefault();
      submitSearch.call(this);
    }
  }

  /**
   * Umbraco's IContentType.Icon returns a combined string like
   * "icon-blueprint color-blue" (icon class + color class together).
   * uui-icon's name attribute only accepts the icon identifier itself,
   * so we take just the first token and fall back to a default icon
   * when none is set.
   */
  _getIconName(icon?: string): string {
    if (!icon) return "icon-document";
    const first = icon.trim().split(/\s+/)[0];
    return first || "icon-document";
  }

  _renderPagination(
    currentPage: number,
    totalPages: number,
    label: string,
    onPageChange: (page: number) => void
  ) {
    if (totalPages <= 1) return "";

    return html`
      <div class="pagination-wrapper">
        <uui-pagination
          label=${label}
          .total=${totalPages}
          .current=${currentPage}
          @change=${(event: Event) => {
            const customEvent = event as CustomEvent<{ current?: number }>;
            const page = Number(customEvent.detail?.current ?? (event.target as HTMLElement & { current?: number })?.current);
            if (Number.isFinite(page) && page !== currentPage) {
              void onPageChange(page);
            }
          }}
        ></uui-pagination>
      </div>
    `;
  }

  render(): unknown {
    return html`
      ${this._error
        ? html`<uui-box headline="Error">
            <p>${this._error}</p>
          </uui-box>`
        : ""}
      ${this._view === "list" ? this._renderElementTypeList() : this._renderPageList()}
    `;
  }

  _renderElementTypeList(): unknown {
    return html`
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
            @keydown=${(event: KeyboardEvent) => this._onSearchKeydown(event, this._submitElementTypeSearch)}
          ></uui-input>
          <uui-button
            type="button"
            label="Search"
            look="primary"
            @click=${this._submitElementTypeSearch}
          ></uui-button>
        </div>

        ${this._loading
          ? html`<div class="loader-container"><uui-loader></uui-loader></div>`
          : html`
              ${this._elementTypes.length > 0
                ? html`
                    <uui-table>
                      <uui-table-head>
                        <uui-table-head-cell>Name</uui-table-head-cell>
                        <uui-table-head-cell>Alias</uui-table-head-cell>
                        <uui-table-head-cell>Total Usage Count</uui-table-head-cell>
                        <uui-table-head-cell>Action</uui-table-head-cell>
                      </uui-table-head>

                      ${this._elementTypes.map(
                        (elementType) => html`
                          <uui-table-row>
                            <uui-table-cell>
                              <div class="element-type-name">
                                <uui-icon name=${this._getIconName(elementType.icon)}></uui-icon>
                                <span>${elementType.name}</span>
                              </div>
                            </uui-table-cell>
                            <uui-table-cell><code>${elementType.alias}</code></uui-table-cell>
                            <uui-table-cell>
                              <span class="usage-count-value">${elementType.totalUsageCount}</span>
                            </uui-table-cell>
                            <uui-table-cell>
                              <uui-button
                                label="View Usage"
                                look="primary"
                                @click=${() => this._openElementType(elementType)}
                              ></uui-button>
                            </uui-table-cell>
                          </uui-table-row>
                        `
                      )}
                    </uui-table>
                  `
                : html`
                    <p>
                      ${this._elementTypeFilter
                        ? `No Element Types match "${this._elementTypeFilter}".`
                        : "No Element Types found."}
                    </p>
                  `}
            `}
      </uui-box>

      ${!this._loading
        ? this._renderPagination(
            this._elementTypePage,
            this._elementTypeTotalPages,
            "Element type pages",
            (page) => this._loadElementTypes(page, this._elementTypeFilter)
          )
        : ""}
    `;
  }

  _renderPageList(): unknown {
    const elementTypeName = this._selectedElementType?.name ?? "Element Type";

    return html`
      <uui-box>
        <div slot="headline">
          <div class="detail-breadcrumbs">
            <uui-breadcrumbs>
            <uui-breadcrumb-item @click=${this._back}>
              <uui-icon name="icon-arrow-left" class="breadcrumb-back-icon"></uui-icon>
              Element Types
            </uui-breadcrumb-item>
              <uui-breadcrumb-item>${elementTypeName}</uui-breadcrumb-item>
            </uui-breadcrumbs>
          </div>
        </div>

        <div class="page-details">
          <p>
            This list shows the content pages where <strong>${elementTypeName}</strong> is used. Each page is listed once even if the Element Type is used multiple times.
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
              @keydown=${(event: KeyboardEvent) => this._onSearchKeydown(event, this._submitPageSearch)}
            ></uui-input>
            <uui-button
              type="button"
              label="Search"
              look="primary"
              @click=${this._submitPageSearch}
            ></uui-button>
          </div>
        </div>

        ${this._loading
          ? html`<div class="loader-container"><uui-loader></uui-loader></div>`
          : html`
              ${this._pages.length > 0
                ? html`
                    <uui-table>
                      <uui-table-head>
                        <uui-table-head-cell>Name</uui-table-head-cell>
                        <uui-table-head-cell>Status</uui-table-head-cell>
                        <uui-table-head-cell>Usage Count</uui-table-head-cell>
                        <uui-table-head-cell>Action</uui-table-head-cell>
                      </uui-table-head>

                      ${this._pages.map(
                        (p) => html`
                          <uui-table-row>
                            <uui-table-cell>
                              <div class="element-type-name">
                                <uui-icon name=${this._getIconName(p.icon)}></uui-icon>
                                <span>${p.name}</span>
                              </div>
                            </uui-table-cell>
                            <uui-table-cell>
                              <uui-tag color=${p.published ? "positive" : "default"}>
                                ${p.published ? "Published" : "Unpublished"}
                              </uui-tag>
                            </uui-table-cell>
                            <uui-table-cell>
                              <div class="usage-count-tags">
                                ${Object.entries(p.usageCountsByCulture ?? {}).map(
                                  ([culture, count]) => html`
                                    <uui-tag look="outline">
                                      <span class="usage-count-tag-content">
                                        <span class="usage-count-culture">${culture}</span>
                                        <span class="usage-count-value">${count}</span>
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
                                .href=${this._getPageWorkspaceHref(p)}
                                @click=${(event: Event) => {
                                  if (!this._getPageWorkspaceHref(p)) {
                                    event.preventDefault();
                                  }
                                }}
                              ></uui-button>
                            </uui-table-cell>
                          </uui-table-row>
                        `
                      )}
                    </uui-table>
                  `
                : html`
                    <p>
                      ${this._pageFilter
                        ? `No pages match "${this._pageFilter}".`
                        : `No pages where "${elementTypeName}" is used were found.`}
                    </p>
                  `}
            `}
      </uui-box>

      ${!this._loading
        ? this._renderPagination(
            this._pagePage,
            this._pageTotalPages,
            "Used pages",
            (page) => this._loadPages(page, this._pageFilter)
          )
        : ""}
    `;
  }
}

customElements.define("element-finder-dashboard", ElementFinderDashboardElement);
