import { LitElement, css, html } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin } from "@umbraco-cms/backoffice/element-api";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UmbModalRouteRegistrationController } from "@umbraco-cms/backoffice/router";
import { UMB_WORKSPACE_MODAL } from "@umbraco-cms/backoffice/workspace";
import { UMB_DOCUMENT_ENTITY_TYPE, UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN } from "@umbraco-cms/backoffice/document";
import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";
import type { UmbAuthContext } from "@umbraco-cms/backoffice/auth";

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
  private _authContext?: UmbAuthContext;
  private _scrollCleanup?: () => void;
  private _highlightCleanup?: () => void;
  private _activeGoToPageItem?: PageItem;

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

    this.consumeContext(UMB_AUTH_CONTEXT, (context) => {
      this._authContext = context ?? undefined;
    });

    this._workspaceModalRoute = new UmbModalRouteRegistrationController(this, UMB_WORKSPACE_MODAL)
      .onSetup(async () => {
        if (this._activeGoToPageItem) {
          this._startScrollWatcher(this._activeGoToPageItem);
        }
        return {
          data: {
            entityType: UMB_DOCUMENT_ENTITY_TYPE,
            preset: {},
          },
        };
      })
      .onSubmit(() => {})
      .onReject(() => {})
      .observeRouteBuilder((routeBuilder: WorkspaceModalPathBuilder) => {
        this._workspaceModalPathBuilder = routeBuilder;
      });
  }

  disconnectedCallback() {
    this._scrollCleanup?.();
    this._scrollCleanup = undefined;
    this._highlightCleanup?.();
    this._highlightCleanup = undefined;
    this._workspaceModalRoute?.destroy();
    super.disconnectedCallback();
  }

  static styles = [
    UmbTextStyles,
    css`
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
  `,
  ];

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

  _onGoToPage(page: PageItem): void {
    this._startScrollWatcher(page);
  }

  _startScrollWatcher(page: PageItem): void {
    this._activeGoToPageItem = page;
    const selected = this._selectedElementType;
    const elementTypeName = selected?.name ?? "";
    const elementTypeAlias = selected?.alias ?? "";
    const contentKey = page.key;

    console.log(`[ElementFinder] Starting scroll watcher for page: "${page.name}" (${contentKey}), element: "${elementTypeName}" (${elementTypeAlias})`);

    // Clean up any ongoing scroll watcher
    this._scrollCleanup?.();
    let cancelled = false;
    this._scrollCleanup = () => {
      cancelled = true;
    };

    let propertyAliases: string[] = [];

    // Fetch property aliases from backend in parallel
    void (async () => {
      try {
        const token = await this._authContext?.getLatestToken();
        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(
          `${API_BASE}/propertyaliasesforelement?contentKey=${contentKey}&elementTypeAlias=${encodeURIComponent(elementTypeAlias)}`,
          { headers, credentials: "include" }
        );
        if (res.ok) {
          propertyAliases = ((await res.json()) as string[]) ?? [];
          console.log(`[ElementFinder] Matching property aliases for element:`, propertyAliases);
        }
      } catch (err) {
        console.warn(`[ElementFinder] Could not fetch property aliases:`, err);
      }
    })();

    const startTime = Date.now();
    const maxWaitMs = 20000;
    const intervalMs = 100;
    let scrolledOnce = false;

    const poll = () => {
      if (cancelled) return;

      if (Date.now() - startTime > maxWaitMs) {
        console.warn(`[ElementFinder] Scroll watcher timed out after ${maxWaitMs}ms.`);
        return;
      }

      // 1. Look for the open workspace modal
      const workspaceModal = this._findOpenWorkspaceModal();
      if (!workspaceModal) {
        // Modal not yet mounted, keep waiting
        setTimeout(poll, intervalMs);
        return;
      }

      // 2. Only allow fallback to raw <umb-property> container after waiting 2.5s for block items to render
      const allowPropertyFallback = Date.now() - startTime > 2500;

      // 3. Look for the target element inside the open workspace modal
      const result = this._findTargetInWorkspace(
        workspaceModal,
        elementTypeName,
        elementTypeAlias,
        propertyAliases,
        allowPropertyFallback
      );

      if (result) {
        const { target, isExact } = result;

        if (target && target.getBoundingClientRect().height > 0) {
          if (isExact) {
            console.log(`[ElementFinder] Found exact target element in workspace:`, target);
            this._scrollAndHighlight(target, workspaceModal);
            return;
          } else if (!scrolledOnce) {
            console.log(`[ElementFinder] Scrolled towards property container, awaiting block items:`, target);
            scrolledOnce = true;
            this._scrollToTarget(target, workspaceModal);
          }
        }
      }

      setTimeout(poll, intervalMs);
    };

    // Start polling immediately
    setTimeout(poll, 50);
  }

  _findOpenWorkspaceModal(): HTMLElement | null {
    const allModals = this._queryDeepAll((el) => {
      if (this._isInsideDashboard(el)) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === "uui-modal-sidebar" ||
        tag === "umb-workspace-modal" ||
        tag === "umb-document-workspace-editor" ||
        tag === "umb-workspace-editor" ||
        tag === "uui-modal-dialog" ||
        tag === "umb-modal"
      );
    }, document);

    if (allModals.length > 0) {
      const topModal =
        allModals.find((el) => {
          const tag = el.tagName.toLowerCase();
          return tag === "uui-modal-sidebar" || tag === "umb-workspace-modal";
        }) ?? allModals[0];
      return topModal;
    }

    return null;
  }

  _getDeepText(node: Node | null | undefined): string {
    if (!node) return "";
    const target = node instanceof Element && node.shadowRoot ? node.shadowRoot : node;
    const parts: string[] = [];
    for (let i = 0; i < target.childNodes.length; i++) {
      const child = target.childNodes[i];
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent?.trim();
        if (t) parts.push(t);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        parts.push(this._getDeepText(child));
      }
    }
    return parts.filter(Boolean).join(" ");
  }

  _findTargetInWorkspace(
    workspaceModal: HTMLElement,
    elementTypeName: string,
    elementTypeAlias: string,
    propertyAliases: string[],
    allowPropertyFallback: boolean = false
  ): { target: HTMLElement; isExact: boolean } | null {
    const normName = elementTypeName.trim().toLowerCase();
    const normAlias = elementTypeAlias.trim().toLowerCase();

    // Query all elements inside the workspace modal (piercing all shadow roots)
    const elements = this._queryDeepAll((el) => {
      return !this._isInsideDashboard(el);
    }, workspaceModal);

    // Strategy 1: Check block elements directly for content type alias or name
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const tag = el.tagName.toLowerCase();

      // Skip editor containers - we want individual block items
      if (
        tag === "umb-block-list-property-editor-ui" ||
        tag === "umb-block-grid-property-editor-ui" ||
        tag === "umb-block-editor-custom-view"
      ) {
        continue;
      }

      const isBlock =
        tag === "umb-block-list-entry" ||
        tag === "umb-block-grid-entry" ||
        tag === "umb-ref-list-block" ||
        tag === "uui-ref-node" ||
        tag.includes("entry") ||
        tag.includes("card") ||
        el.classList.contains("umb-block");

      if (isBlock) {
        const cAlias = (
          (el as unknown as { _contentTypeAlias?: string })._contentTypeAlias ||
          (el as unknown as { contentTypeAlias?: string }).contentTypeAlias ||
          el.getAttribute("data-content-type-alias") ||
          el.getAttribute("data-element-type") ||
          ""
        ).toString().trim().toLowerCase();

        const cName = (
          (el as unknown as { _contentTypeName?: string })._contentTypeName ||
          (el as unknown as { contentTypeName?: string }).contentTypeName ||
          ""
        ).toString().trim().toLowerCase();

        if ((normAlias && cAlias === normAlias) || (normName && cName === normName)) {
          return { target: this._getEnclosingCard(el), isExact: true };
        }

        const deepText = this._getDeepText(el).toLowerCase();
        if (
          (Boolean(normName) && (deepText === normName || deepText.startsWith(normName) || deepText.includes(normName))) ||
          (Boolean(normAlias) && (deepText === normAlias || deepText.startsWith(normAlias) || deepText.includes(normAlias)))
        ) {
          if (deepText.length < 300) {
            return { target: this._getEnclosingCard(el), isExact: true };
          }
        }
      }
    }

    // Strategy 2: Exact text match on any text / label elements piercing shadow roots
    if (normName || normAlias) {
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const tag = el.tagName.toLowerCase();
        if (
          tag === "uui-scroll-container" ||
          tag === "umb-body-layout" ||
          tag === "umb-workspace-editor" ||
          tag === "uui-modal-sidebar" ||
          tag === "umb-workspace-modal" ||
          tag.includes("property-editor")
        ) {
          continue;
        }

        const directText = (el.textContent ?? "").trim().toLowerCase();
        if (directText === normName || directText === normAlias) {
          return { target: this._getEnclosingCard(el), isExact: true };
        }

        if (tag.includes("-") || ["span", "div", "strong", "b", "p", "h1", "h2", "h3", "h4", "h5", "uui-tag"].includes(tag)) {
          const deepText = this._getDeepText(el).toLowerCase();
          if (deepText === normName || deepText === normAlias) {
            return { target: this._getEnclosingCard(el), isExact: true };
          }
        }
      }
    }

    // Strategy 3: Check property aliases from backend
    if (propertyAliases && propertyAliases.length > 0) {
      for (let a = 0; a < propertyAliases.length; a++) {
        const normProp = propertyAliases[a].trim().toLowerCase();
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          const tag = el.tagName.toLowerCase();
          if (tag.includes("property")) {
            const alias = (
              el.getAttribute("alias") ??
              (el as unknown as { alias?: string }).alias ??
              el.getAttribute("data-alias") ??
              ""
            ).trim().toLowerCase();

            if (alias === normProp) {
              const childBlocks = this._queryDeepAll((c) => {
                const cTag = c.tagName.toLowerCase();
                return (
                  cTag === "umb-block-list-entry" ||
                  cTag === "umb-block-grid-entry" ||
                  cTag === "umb-ref-list-block" ||
                  cTag === "uui-ref-node" ||
                  cTag.includes("entry") ||
                  cTag.includes("card")
                );
              }, el);

              for (let c = 0; c < childBlocks.length; c++) {
                const b = childBlocks[c];
                const cAlias = (
                  (b as unknown as { _contentTypeAlias?: string })._contentTypeAlias ||
                  (b as unknown as { contentTypeAlias?: string }).contentTypeAlias ||
                  ""
                ).toString().trim().toLowerCase();
                const cName = (
                  (b as unknown as { _contentTypeName?: string })._contentTypeName ||
                  (b as unknown as { contentTypeName?: string }).contentTypeName ||
                  ""
                ).toString().trim().toLowerCase();
                const blockText = this._getDeepText(b).toLowerCase();

                if (
                  (normAlias && cAlias === normAlias) ||
                  (normName && cName === normName) ||
                  (normName && blockText.includes(normName)) ||
                  (normAlias && blockText.includes(normAlias))
                ) {
                  return { target: this._getEnclosingCard(b), isExact: true };
                }
              }

              // Only fall back to returning the property element if allowed (after 2.5s wait)
              if (allowPropertyFallback) {
                return { target: el, isExact: false };
              }
            }
          }
        }
      }
    }

    // Strategy 4: Substring match inside block items
    if (normName || normAlias) {
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const tag = el.tagName.toLowerCase();
        if (
          tag === "umb-block-list-entry" ||
          tag === "umb-block-grid-entry" ||
          tag === "umb-ref-list-block" ||
          tag === "uui-ref-node" ||
          tag.includes("entry") ||
          tag.includes("card")
        ) {
          const deepText = this._getDeepText(el).toLowerCase();
          if ((normName && deepText.includes(normName)) || (normAlias && deepText.includes(normAlias))) {
            if (deepText.length < 500) {
              return { target: this._getEnclosingCard(el), isExact: true };
            }
          }
        }
      }
    }

    return null;
  }

  _getEnclosingCard(el: HTMLElement): HTMLElement {
    let curr: HTMLElement = el;
    let bestCandidate: HTMLElement = el;
    let depth = 0;

    while (curr && depth < 20) {
      const tag = curr.tagName.toLowerCase();
      if (
        tag === "umb-block-list-entry" ||
        tag === "umb-block-grid-entry" ||
        tag === "umb-ref-list-block" ||
        tag === "uui-ref-node" ||
        tag.includes("card") ||
        curr.classList.contains("umb-block")
      ) {
        bestCandidate = curr;
        if (tag === "umb-block-list-entry" || tag === "umb-block-grid-entry") {
          return curr;
        }
      }

      if (
        tag === "uui-scroll-container" ||
        tag === "umb-body-layout" ||
        tag === "umb-workspace-editor" ||
        tag === "umb-workspace-modal" ||
        tag === "uui-modal-sidebar"
      ) {
        break;
      }

      let parent: Node | null = curr.parentElement;
      if (!parent && curr.parentNode instanceof ShadowRoot) {
        parent = curr.parentNode.host;
      }

      if (!parent || !(parent instanceof HTMLElement)) break;
      curr = parent;
      depth++;
    }

    return bestCandidate;
  }

  _isInsideDashboard(node: Node): boolean {
    let curr: Node | null = node;
    while (curr && curr !== document && curr !== document.body) {
      if (curr === this) return true;
      if (curr instanceof HTMLElement && curr.tagName.toLowerCase() === "element-finder-dashboard") return true;
      if (curr instanceof ShadowRoot) {
        curr = curr.host;
      } else {
        curr = curr.parentNode;
      }
    }
    return false;
  }

  _scrollAndHighlight(target: HTMLElement, workspaceModal?: HTMLElement): void {
    // 1. Scroll the container smoothly to the target
    this._scrollToTarget(target, workspaceModal);

    // 2. Identify elements to highlight: target and any inner card / ref-node
    const elementsToHighlight: HTMLElement[] = [target];
    const innerCards = this._queryDeepAll((c) => {
      const cTag = c.tagName.toLowerCase();
      return (
        cTag === "uui-ref-node" ||
        cTag === "umb-ref-list-block" ||
        cTag.includes("card") ||
        c.classList.contains("umb-block-list__block")
      );
    }, target);

    for (let k = 0; k < innerCards.length; k++) {
      if (!elementsToHighlight.includes(innerCards[k])) {
        elementsToHighlight.push(innerCards[k]);
      }
    }

    // Cancel any ongoing highlight cleanup
    this._highlightCleanup?.();

    const applyHighlight = (el: HTMLElement) => {
      if (el.dataset.efHighlighted === undefined) {
        el.dataset.efHighlighted = "true";
        el.dataset.efOrigOutline = el.style.outline || "";
        el.dataset.efOrigOffset = el.style.outlineOffset || "";
        el.dataset.efOrigShadow = el.style.boxShadow || "";
        el.dataset.efOrigTransition = el.style.transition || "";
        el.dataset.efOrigRadius = el.style.borderRadius || "";
        el.dataset.efOrigZIndex = el.style.zIndex || "";
      }

      el.style.setProperty("transition", "outline 0.3s ease, box-shadow 0.3s ease", "important");
      el.style.setProperty("outline", "1px solid var(--uui-color-interactive, #1b264f)", "important");
      el.style.setProperty("outline-offset", "2px", "important");
      el.style.setProperty("box-shadow", "0 0 0 2px var(--uui-color-interactive, #1b264f), 0 0 24px rgba(27, 38, 79, 0.6)", "important");
      el.style.setProperty("z-index", "10", "important");
      if (!el.style.borderRadius && el.dataset.efOrigRadius === "") {
        el.style.setProperty("border-radius", "6px", "important");
      }
    };

    const removeHighlight = (el: HTMLElement) => {
      if (el.dataset.efHighlighted !== undefined) {
        el.style.setProperty("outline", "3px solid transparent", "important");
        el.style.setProperty("box-shadow", "none", "important");
        setTimeout(() => {
          el.style.removeProperty("outline");
          el.style.removeProperty("outline-offset");
          el.style.removeProperty("box-shadow");
          el.style.removeProperty("transition");
          el.style.removeProperty("border-radius");
          el.style.removeProperty("z-index");

          if (el.dataset.efOrigOutline) el.style.outline = el.dataset.efOrigOutline;
          if (el.dataset.efOrigOffset) el.style.outlineOffset = el.dataset.efOrigOffset;
          if (el.dataset.efOrigShadow) el.style.boxShadow = el.dataset.efOrigShadow;
          if (el.dataset.efOrigTransition) el.style.transition = el.dataset.efOrigTransition;
          if (el.dataset.efOrigRadius) el.style.borderRadius = el.dataset.efOrigRadius;
          if (el.dataset.efOrigZIndex) el.style.zIndex = el.dataset.efOrigZIndex;

          delete el.dataset.efHighlighted;
          delete el.dataset.efOrigOutline;
          delete el.dataset.efOrigOffset;
          delete el.dataset.efOrigShadow;
          delete el.dataset.efOrigTransition;
          delete el.dataset.efOrigRadius;
          delete el.dataset.efOrigZIndex;
        }, 400);
      }
    };

    const applyAll = () => {
      for (let i = 0; i < elementsToHighlight.length; i++) {
        applyHighlight(elementsToHighlight[i]);
      }
    };

    // Apply highlight immediately and at staggered intervals to survive async re-renders
    applyAll();
    const t1 = setTimeout(applyAll, 100);
    const t2 = setTimeout(applyAll, 250);
    const t3 = setTimeout(applyAll, 500);
    const t4 = setTimeout(applyAll, 800);
    const t5 = setTimeout(applyAll, 1200);

    // Schedule cleanup after 4.5 seconds
    const tCleanup = setTimeout(() => {
      for (let i = 0; i < elementsToHighlight.length; i++) {
        removeHighlight(elementsToHighlight[i]);
      }
    }, 4500);

    this._highlightCleanup = () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(tCleanup);
      for (let i = 0; i < elementsToHighlight.length; i++) {
        removeHighlight(elementsToHighlight[i]);
      }
    };
  }

  _scrollToTarget(target: HTMLElement, workspaceModal?: HTMLElement): void {
    const doScroll = () => {
      // 1. Native smooth scrollIntoView
      try {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      } catch {
        target.scrollIntoView();
      }

      // 2. Find all scrollable containers in the modal and along the ancestor chain
      const scrollContainers: HTMLElement[] = [];

      let curr: Node | null = target;
      while (curr && curr !== document && curr !== document.body && curr !== document.documentElement) {
        if (curr instanceof HTMLElement) {
          const tag = curr.tagName.toLowerCase();
          const style = window.getComputedStyle(curr);
          const overflowY = style.overflowY;
          const isScrollable =
            (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
            curr.scrollHeight > curr.clientHeight;

          if (isScrollable || tag === "uui-scroll-container") {
            if (!scrollContainers.includes(curr)) {
              scrollContainers.push(curr);
            }
          }
        }

        if (curr instanceof ShadowRoot) {
          curr = curr.host;
        } else {
          curr = curr.parentNode;
        }
      }

      if (workspaceModal) {
        const modalScrollables = this._queryDeepAll((el) => {
          const tag = el.tagName.toLowerCase();
          if (tag === "uui-scroll-container") return true;
          const style = window.getComputedStyle(el);
          return (
            (style.overflowY === "auto" || style.overflowY === "scroll" || style.overflowY === "overlay") &&
            el.scrollHeight > el.clientHeight
          );
        }, workspaceModal);

        for (let i = 0; i < modalScrollables.length; i++) {
          if (!scrollContainers.includes(modalScrollables[i])) {
            scrollContainers.push(modalScrollables[i]);
          }
        }
      }

      for (let i = 0; i < scrollContainers.length; i++) {
        const container = scrollContainers[i];
        const targetRect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const offsetDiff = targetRect.top - containerRect.top;
        const targetScrollTop =
          container.scrollTop + offsetDiff - container.clientHeight / 2 + targetRect.height / 2;

        const clampedScrollTop = Math.max(0, targetScrollTop);

        try {
          container.scrollTo({
            top: clampedScrollTop,
            behavior: "smooth",
          });
        } catch {
          container.scrollTop = clampedScrollTop;
        }
      }
    };

    // Scroll immediately and at staggered intervals to account for animation & layout stabilization
    doScroll();
    setTimeout(doScroll, 100);
    setTimeout(doScroll, 250);
    setTimeout(doScroll, 500);
    setTimeout(doScroll, 800);
    setTimeout(doScroll, 1200);
    setTimeout(doScroll, 1800);
  }


  _queryDeepAll(
    predicate: (el: HTMLElement) => boolean,
    root: Node = document
  ): HTMLElement[] {
    const results: HTMLElement[] = [];
    const queue: (Element | Document | ShadowRoot)[] = [
      root as (Element | Document | ShadowRoot),
    ];
    const visited = new Set<Node>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      try {
        if (current instanceof HTMLElement && predicate(current)) {
          results.push(current);
        }
      } catch {}

      let elements: Element[] = [];
      try {
        if ("querySelectorAll" in current) {
          elements = Array.from(current.querySelectorAll("*"));
        }
      } catch {}

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el instanceof HTMLElement && predicate(el)) {
          results.push(el);
        }
        if (el.shadowRoot && !visited.has(el.shadowRoot)) {
          queue.push(el.shadowRoot);
        }
      }
    }

    return results;
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
          >Search</uui-button>
        </div>

        ${this._loading
          ? html`<div class="loader-container"><uui-loader></uui-loader></div>`
          : html`
              ${this._elementTypes.length > 0
                ? html`
                    <uui-table>
                      <uui-table-head>
                        <uui-table-head-cell><span>Name</span></uui-table-head-cell>
                        <uui-table-head-cell><span>Alias</span></uui-table-head-cell>
                        <uui-table-head-cell><span>Total Usage Count</span></uui-table-head-cell>
                        <uui-table-head-cell><span>Action</span></uui-table-head-cell>
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
                              >View Usage</uui-button>
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
            >Search</uui-button>
          </div>
        </div>

        ${this._loading
          ? html`<div class="loader-container"><uui-loader></uui-loader></div>`
          : html`
              ${this._pages.length > 0
                ? html`
                    <uui-table>
                      <uui-table-head>
                        <uui-table-head-cell><span>Name</span></uui-table-head-cell>
                        <uui-table-head-cell><span>Status</span></uui-table-head-cell>
                        <uui-table-head-cell><span>Usage Count</span></uui-table-head-cell>
                        <uui-table-head-cell><span>Action</span></uui-table-head-cell>
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
                                @pointerdown=${() => {
                                  this._activeGoToPageItem = p;
                                }}
                                @click=${(event: Event) => {
                                  if (!this._getPageWorkspaceHref(p)) {
                                    event.preventDefault();
                                    return;
                                  }
                                  this._activeGoToPageItem = p;
                                  this._onGoToPage(p);
                                }}
                              >Go to Page</uui-button>
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
