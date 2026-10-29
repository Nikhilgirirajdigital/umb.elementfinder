import { css, html, nothing } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { UMB_AUTH_CONTEXT } from '@umbraco-cms/backoffice/auth';
import type { UmbAuthContext } from '@umbraco-cms/backoffice/auth';
import { umbConfirmModal } from '@umbraco-cms/backoffice/modal';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import type { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { UmbModalRouteRegistrationController } from '@umbraco-cms/backoffice/router';
import { UMB_WORKSPACE_MODAL } from '@umbraco-cms/backoffice/workspace';
import type {
  CleanerPagedResponse,
  CleanerScanResponse,
  CleanerSummary,
  CleanupCandidate,
  CleanupRisk,
} from './content-cleaner.models.js';

const API_BASE = '/umbraco/backoffice/elementfinder/content-cleaner';
const CONTENT_CLEANER_USAGE_ENTITY_TYPE = 'content-cleaner-usage';
const API_REQUEST_TIMEOUT_MS = 120_000;

type SortColumn = 'name' | 'type' | 'usage' | 'risk';
type SortDirection = 'asc' | 'desc';
type WorkspacePathBuilder = (params: { [key: string]: string | number } | null) => string;

export default class UmbContentCleanerDashboardElement extends UmbLitElement {
  static properties = {
    _items: { state: true },
    _summary: { state: true },
    _loading: { state: true },
    _error: { state: true },
    _search: { state: true },
    _type: { state: true },
    _risk: { state: true },
    _page: { state: true },
    _pageSize: { state: true },
    _total: { state: true },
    _scannedAt: { state: true },
    _sortBy: { state: true },
    _sortDirection: { state: true },
    _selectedKeys: { state: true },
  };

  // These must be `declare`d, not initialized here as regular class fields. With
  // "useDefineForClassFields": true (the default/required setting for an ES2022 target),
  // a class field initializer (e.g. `private _loading = true;`) creates its own instance
  // property via Object.defineProperty *after* Lit's `static properties` has already put a
  // reactive accessor on the prototype. That own property shadows the accessor, so every
  // later `this._loading = ...` becomes a plain, non-reactive write: the value changes but
  // Lit is never told to re-render, and the UI gets stuck on whatever first rendered (here,
  // the loading spinner) even though the network requests behind it complete successfully.
  // Values are assigned in the constructor body instead, which goes through Lit's setter.
  declare private _items: CleanupCandidate[];
  declare private _summary?: CleanerSummary;
  declare private _loading: boolean;
  declare private _error: string;
  declare private _search: string;
  declare private _type: string;
  declare private _risk: string;
  declare private _page: number;
  declare private _pageSize: number;
  declare private _total: number;
  declare private _scannedAt?: string;
  declare private _sortBy: SortColumn;
  declare private _sortDirection: SortDirection;
  declare private _selectedKeys: Set<string>;
  private _authContext?: UmbAuthContext;
  private _notificationContext?: UmbNotificationContext;
  private _initialLoadStarted = false;
  private _candidateRequestId = 0;
  private _selectedUsageCandidate?: CleanupCandidate;
  private readonly _usageWorkspaceRoute: UmbModalRouteRegistrationController;
  private _usageWorkspacePathBuilder?: WorkspacePathBuilder;

  constructor() {
    super();
    this._items = [];
    this._summary = undefined;
    this._loading = true;
    this._error = '';
    this._search = '';
    this._type = 'all';
    this._risk = 'all';
    this._page = 1;
    this._pageSize = 20;
    this._total = 0;
    this._scannedAt = undefined;
    this._sortBy = 'name';
    this._sortDirection = 'asc';
    this._selectedKeys = new Set();

    this.consumeContext(UMB_AUTH_CONTEXT, (context) => {
      if (!context) {
        this._error = 'Umbraco authentication context is unavailable.';
        this._loading = false;
        return;
      }

      this._authContext = context;
      if (!this._initialLoadStarted) {
        this._initialLoadStarted = true;
        void this.#loadSnapshot();
      }
    });

    this.consumeContext(UMB_NOTIFICATION_CONTEXT, (context) => {
      this._notificationContext = context;
    });

    this._usageWorkspaceRoute = new UmbModalRouteRegistrationController(this, UMB_WORKSPACE_MODAL)
      .addAdditionalPath(':candidateKey')
      .onSetup((routingInfo) => {
        const candidate = this._items.find((item) => item.key === routingInfo.candidateKey) ??
          this._selectedUsageCandidate;

        return {
          data: {
            entityType: CONTENT_CLEANER_USAGE_ENTITY_TYPE,
            preset: { candidate },
          },
        };
      })
      .onSubmit(() => {})
      .onReject(() => {})
      .observeRouteBuilder((routeBuilder: WorkspacePathBuilder) => {
        this._usageWorkspacePathBuilder = routeBuilder;
        this.requestUpdate();
      });
  }

  disconnectedCallback(): void {
    this._usageWorkspaceRoute.destroy();
    super.disconnectedCallback();
  }

  async #fetchJson<T>(url: string): Promise<T> {
    if (!this._authContext) {
      throw new Error('Umbraco authentication context is unavailable.');
    }

    const token = await this._authContext.getLatestToken();
    const abortController = new AbortController();
    const timeout = globalThis.setTimeout(() => abortController.abort(), API_REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        credentials: 'include',
        signal: abortController.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('The Content Cleaner request timed out. Please try Run scan again.');
      }

      throw error;
    } finally {
      globalThis.clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    return response.json() as Promise<T>;
  }

  async #runScan(): Promise<void> {
    this._loading = true;
    this._error = '';
    let refreshCandidates = false;

    try {
      const scan = await this.#fetchJson<CleanerScanResponse>(`${API_BASE}/scan`);
      this._page = 1;
      this.#applyScanResult(scan);
      refreshCandidates = true;
    } catch (error) {
      this._error = error instanceof Error ? error.message : 'Unable to run the analysis.';
    } finally {
      this._loading = false;
    }

    if (refreshCandidates) {
      void this.#loadCandidates(false);
    }
  }

  async #loadSnapshot(): Promise<void> {
    this._loading = true;
    this._error = '';
    let refreshCandidates = false;

    try {
      const scan = await this.#fetchJson<CleanerScanResponse>(`${API_BASE}/snapshot`);
      this.#applyScanResult(scan);
      refreshCandidates = true;
    } catch (error) {
      this._error = error instanceof Error ? error.message : 'Unable to load the latest analysis.';
    } finally {
      this._loading = false;
    }

    if (refreshCandidates) {
      void this.#loadCandidates(false);
    }
  }

  #applyScanResult(scan: CleanerScanResponse): void {
    const items = scan.items ?? [];
    this._summary = scan.summary;
    this._scannedAt = scan.scannedAtUtc;
    this._items = items.slice(0, this._pageSize);
    this._total = items.length;
    this._selectedKeys = new Set();
  }

  async #loadCandidates(showLoader = true): Promise<void> {
    const requestId = ++this._candidateRequestId;
    if (showLoader) {
      this._loading = true;
    }
    this._error = '';

    try {
      const params = new URLSearchParams({
        skip: String((this._page - 1) * this._pageSize),
        take: String(this._pageSize),
        search: this._search,
        type: this._type,
        risk: this._risk,
        sortBy: this._sortBy,
        sortDirection: this._sortDirection,
      });

      const result = await this.#fetchJson<CleanerPagedResponse>(`${API_BASE}/candidates?${params}`);
      if (requestId !== this._candidateRequestId) return;

      this._items = result.items ?? [];
      this._total = result.total ?? 0;
      this._scannedAt = result.scannedAtUtc;
      this._selectedKeys = new Set();

      const pageCount = Math.max(1, Math.ceil(this._total / this._pageSize));
      if (this._page > pageCount) {
        this._page = pageCount;
        await this.#loadCandidates(showLoader);
      }
    } catch (error) {
      if (requestId !== this._candidateRequestId) return;
      this._error = error instanceof Error ? error.message : 'Unable to load cleanup candidates.';
    } finally {
      if (showLoader && requestId === this._candidateRequestId) {
        this._loading = false;
      }
    }
  }

  #applyFilters(): void {
    this._page = 1;
    void this.#loadCandidates();
  }

  #onTypeChange(event: Event): void {
    this._type = (event.target as HTMLSelectElement).value;
    this.#applyFilters();
  }

  #onRiskChange(event: Event): void {
    this._risk = (event.target as HTMLSelectElement).value;
    this.#applyFilters();
  }

  #clearFilters(): void {
    this._search = '';
    this._type = 'all';
    this._risk = 'all';
    this._page = 1;
    void this.#loadCandidates();
  }

  #onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.#applyFilters();
    }
  }

  #onPageChange(event: CustomEvent): void {
    const target = event.target as HTMLElement & { current?: number };
    const nextPage = Number(event.detail?.pageNumber ?? event.detail?.page ?? target.current);
    if (!Number.isFinite(nextPage) || nextPage < 1 || nextPage === this._page) return;

    this._page = nextPage;
    void this.#loadCandidates();
  }

  #changeSort(sortBy: SortColumn): void {
    if (this._sortBy === sortBy) {
      this._sortDirection = this._sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this._sortBy = sortBy;
      this._sortDirection = 'asc';
    }

    this._page = 1;
    void this.#loadCandidates();
  }

  #riskColor(risk: CleanupRisk): 'positive' | 'warning' | 'danger' | 'default' {
    switch (risk) {
      case 'Low': return 'positive';
      case 'Moderate': return 'default';
      case 'Review': return 'warning';
      case 'High': return 'danger';
      default: return 'default';
    }
  }

  #isAllSelected(): boolean {
    return this._items.length > 0 && this._items.every((item) => this._selectedKeys.has(item.key));
  }

  #isSomeSelected(): boolean {
    return this._items.some((item) => this._selectedKeys.has(item.key)) && !this.#isAllSelected();
  }

  #onSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this._selectedKeys);
    for (const item of this._items) {
      if (checked) {
        next.add(item.key);
      } else {
        next.delete(item.key);
      }
    }
    this._selectedKeys = next;
  }

  #onItemSelect(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this._selectedKeys);
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this._selectedKeys = next;
  }

  async #deleteSelectedCandidates(): Promise<void> {
    const selectedItems = this._items.filter((item) => this._selectedKeys.has(item.key));
    if (selectedItems.length === 0) return;

    const count = selectedItems.length;
    const hasUsage = selectedItems.some((item) => (item.usages?.length ?? item.usageCount) > 0);
    const warning = hasUsage
      ? ' Warning: Some selected items have detected usages. Deleting them may impact existing content or configuration.'
      : '';

    try {
      await umbConfirmModal(this, {
        headline: `Delete ${count} item${count === 1 ? '' : 's'}`,
        content: html`
          <p style="margin: 0 0 var(--uui-size-space-3, 12px);">Are you sure you want to delete the ${count} selected cleanup candidate${count === 1 ? '' : 's'}?</p>
          ${hasUsage
            ? html`<p style="margin: 0 0 var(--uui-size-space-3, 12px);">Warning: Some selected items have detected usages. Deleting them may impact existing content or configuration.</p>`
            : nothing}
          <p style="margin: 0;">This action cannot be undone.</p>
        `,
        color: 'danger',
        confirmLabel: 'Delete',
      });
    } catch {
      // User cancelled modal
      return;
    }

    this._loading = true;
    try {
      if (!this._authContext) {
        throw new Error('Umbraco authentication context is unavailable.');
      }
      const token = await this._authContext.getLatestToken();
      const payload = {
        items: selectedItems.map((item) => ({ key: item.key, type: item.type })),
      };

      const response = await fetch(`${API_BASE}/batch-delete`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message || `Request failed (${response.status})`);
      }

      this._notificationContext?.peek('positive', {
        data: { message: `Successfully deleted ${count} item${count === 1 ? '' : 's'}.` },
      });

      this._selectedKeys = new Set();
      await this.#loadSnapshot();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to delete selected items.';
      this._notificationContext?.peek('danger', {
        data: { message: msg },
      });
      this._error = msg;
    } finally {
      this._loading = false;
    }
  }

  async #deleteCandidate(item: CleanupCandidate): Promise<void> {
    const hasUsage = (item.usages?.length ?? item.usageCount) > 0;
    const count = (item.usages && item.usages.length > 0) ? item.usages.length : item.usageCount;
    const warning = hasUsage
      ? ` Warning: This item has ${count} detected usage(s). Deleting it may impact existing content or configuration.`
      : '';

    try {
      await umbConfirmModal(this, {
        headline: `Delete ${item.type}`,
        content: html`
          <p style="margin: 0 0 var(--uui-size-space-3, 12px);">Are you sure you want to delete ${item.type.toLowerCase()} "${item.name}"?</p>
          ${hasUsage
            ? html`<p style="margin: 0 0 var(--uui-size-space-3, 12px);">Warning: This item has ${count} detected usage(s). Deleting it may impact existing content or configuration.</p>`
            : nothing}
          <p style="margin: 0;">This action cannot be undone.</p>
        `,
        color: 'danger',
        confirmLabel: 'Delete',
      });
    } catch {
      // User cancelled modal
      return;
    }

    this._loading = true;
    try {
      if (!this._authContext) {
        throw new Error('Umbraco authentication context is unavailable.');
      }
      const token = await this._authContext.getLatestToken();
      const params = new URLSearchParams({ type: item.type });
      const response = await fetch(`${API_BASE}/candidate/${item.key}?${params}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message || `Request failed (${response.status})`);
      }

      this._notificationContext?.peek('positive', {
        data: { message: `${item.type} "${item.name}" was successfully deleted.` }
      });

      await this.#loadSnapshot();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to delete item.';
      this._notificationContext?.peek('danger', {
        data: { message: msg }
      });
      this._error = msg;
    } finally {
      this._loading = false;
    }
  }

  #renderUsageCell(item: CleanupCandidate) {
    const contentCount = item.usages?.filter((usage) =>
      usage.referenceType === 'Content' || usage.referenceType === 'BlockList' || usage.referenceType === 'BlockGrid').length ?? 0;
    const configurationCount = (item.usages?.length ?? 0) - contentCount;
    const totalCount = (item.usages && item.usages.length > 0)
      ? (contentCount + configurationCount)
      : item.usageCount;

    // When we have a breakdown, show individual Content / Config tags
    if (item.usages && item.usages.length > 0 && (contentCount > 0 || configurationCount > 0)) {
      return html`
        <div class="usage-count-tags">
          ${contentCount > 0
            ? html`
                <uui-tag look="outline">
                  <span class="usage-count-tag-content">
                    <span class="usage-count-culture">Content</span>
                    <span class="usage-count-value">${contentCount}</span>
                  </span>
                </uui-tag>
              `
            : nothing}
          ${configurationCount > 0
            ? html`
                <uui-tag look="outline">
                  <span class="usage-count-tag-content">
                    <span class="usage-count-culture">Config</span>
                    <span class="usage-count-value">${configurationCount}</span>
                  </span>
                </uui-tag>
              `
            : nothing}
        </div>
      `;
    }

    // Zero usages – plain dash
    if (totalCount === 0) {
      return html`<span class="muted">-</span>`;
    }

    // Fallback: just the total count as a single tag
    return html`
      <div class="usage-count-tags">
        <uui-tag look="outline">
          <span class="usage-count-tag-content">
            <span class="usage-count-value">${totalCount}</span>
          </span>
        </uui-tag>
      </div>
    `;
  }

  #renderPagination(pageCount: number) {
    if (pageCount <= 1) return nothing;

    return html`
      <div class="pagination-wrapper">
        <uui-pagination
          label="Cleanup candidates pages"
          .total=${pageCount}
          .current=${this._page}
          @change=${this.#onPageChange}>
        </uui-pagination>
      </div>
    `;
  }

  #renderSummaryCard(label: string, value: number, icon: string, riskValue: string) {
    const isSelected = this._risk === riskValue;

    return html`
      <uui-box
        class="summary-card ${isSelected ? 'summary-card--selected' : ''}"
        role="button"
        tabindex="0"
        aria-pressed=${isSelected}
        aria-label="Filter by ${label}"
        @click=${() => this.#onCardClick(riskValue)}
        @keydown=${(e: KeyboardEvent) => this.#onCardKeydown(e, riskValue)}>
        <div class="summary-card__content">
          <uui-icon name=${icon}></uui-icon>
          <div>
            <div class="summary-card__value">${value}</div>
            <div class="summary-card__label">${label}</div>
          </div>
        </div>
      </uui-box>
    `;
  }

  #onCardClick(riskValue: string): void {
    this._risk = riskValue;
    this.#applyFilters();
  }

  #onCardKeydown(event: KeyboardEvent, riskValue: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.#onCardClick(riskValue);
    }
  }

  #renderSortHeading(label: string, column: SortColumn) {
    const active = this._sortBy === column;
    const ariaSort = active ? (this._sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';

    return html`
      <uui-table-head-cell aria-sort=${ariaSort} style="white-space: nowrap;">
        <div
          class="head-cell-content"
          role="button"
          tabindex="0"
          aria-label="Sort by ${label}"
          @click=${() => this.#changeSort(column)}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              this.#changeSort(column);
            }
          }}>
          <span>${label}</span>
          <uui-symbol-sort
            ?active=${active}
            ?descending=${this._sortDirection === 'desc'}>
          </uui-symbol-sort>
        </div>
      </uui-table-head-cell>
    `;
  }

  #usageWorkspaceHref(item: CleanupCandidate): string | undefined {
    if (!item.key || !this._usageWorkspacePathBuilder) return undefined;
    return this._usageWorkspacePathBuilder({ candidateKey: item.key });
  }

  #openUsageWorkspace(event: Event, item: CleanupCandidate): void {
    if (!this.#usageWorkspaceHref(item)) {
      event.preventDefault();
      return;
    }

    this._selectedUsageCandidate = item;
  }

  render() {
    const pageCount = Math.max(1, Math.ceil(this._total / this._pageSize));

    return html`
      <div id="main">
        <uui-box headline="Content model analysis">
          <p>
            Find unused or potentially obsolete Umbraco configuration and review its dependencies before cleanup.
          </p>

            <div class="toolbar">
              <uui-button look="primary" label="Run scan" @click=${this.#runScan} ?disabled=${this._loading}>
                Run scan
              </uui-button>

              ${this._scannedAt
                ? html`<span class="muted">Last scan: ${new Date(this._scannedAt).toLocaleString()}</span>`
                : nothing}
            </div>
          </uui-box>

          ${this._summary
            ? html`
                <div class="summary-grid">
                  ${this.#renderSummaryCard('Total analyzed', this._summary.totalItems, 'icon-search', 'all')}
                  ${this.#renderSummaryCard('Low risk', this._summary.lowRisk, 'icon-check', 'Low')}
                  ${this.#renderSummaryCard('Moderate', this._summary.moderate, 'icon-shield', 'Moderate')}
                  ${this.#renderSummaryCard('Review', this._summary.review, 'icon-alert', 'Review')}
                  ${this.#renderSummaryCard('High risk', this._summary.highRisk, 'icon-stop-alt', 'High')}
                </div>
              `
            : nothing}

          <uui-box headline="Cleanup candidates">
            <div class="filters">
              <uui-input
                label="Search"
                placeholder="Search by name or alias"
                .value=${this._search}
                @input=${(event: InputEvent) => this._search = (event.target as HTMLInputElement).value}
                @keydown=${this.#onSearchKeydown}>
              </uui-input>

              <uui-select
                label="Type"
                .value=${this._type}
                .options=${[
                  { name: 'All types', value: 'all', selected: this._type === 'all' },
                  { name: 'Document Type', value: 'Document Type', selected: this._type === 'Document Type' },
                  { name: 'Property', value: 'Property', selected: this._type === 'Property' },
                  { name: 'Data Type', value: 'Data Type', selected: this._type === 'Data Type' },
                ]}
                @change=${this.#onTypeChange}>
              </uui-select>

              <uui-select
                label="Risk"
                .value=${this._risk}
                .options=${[
                  { name: 'All risks', value: 'all', selected: this._risk === 'all' },
                  { name: 'Low', value: 'Low', selected: this._risk === 'Low' },
                  { name: 'Moderate', value: 'Moderate', selected: this._risk === 'Moderate' },
                  { name: 'Review', value: 'Review', selected: this._risk === 'Review' },
                  { name: 'High', value: 'High', selected: this._risk === 'High' },
                ]}
                @change=${this.#onRiskChange}>
              </uui-select>

              <div class="filter-actions">
                <uui-button look="primary" label="Search" @click=${this.#applyFilters}>Search</uui-button>
                <uui-button look="secondary" label="Clear" @click=${this.#clearFilters}>Clear</uui-button>
              </div>
            </div>

            ${this._error
              ? html`<uui-box class="error-box"><uui-icon name="icon-alert"></uui-icon> ${this._error}</uui-box>`
              : nothing}

            ${this._loading
              ? html`<div class="loader"><uui-loader></uui-loader></div>`
              : html`
                  <div class="table-wrap">
                    ${this._selectedKeys.size > 0
                      ? html`
                          <div class="selection-bar">
                            <span><strong>${this._selectedKeys.size}</strong> candidate(s) selected</span>
                            <div class="selection-actions">
                              <uui-button
                                compact
                                look="outline"
                                color="danger"
                                label="Delete selected"
                                @click=${this.#deleteSelectedCandidates}>
                                <uui-icon name="icon-trash"></uui-icon> Delete selected (${this._selectedKeys.size})
                              </uui-button>
                              <uui-button
                                compact
                                look="secondary"
                                label="Clear selection"
                                @click=${() => { this._selectedKeys = new Set(); }}>
                                Clear
                              </uui-button>
                            </div>
                          </div>
                        `
                      : nothing}

                    <uui-table>
                      <uui-table-head>
                        <uui-table-head-cell class="checkbox-head-cell">
                          <uui-checkbox
                            .checked=${this.#isAllSelected()}
                            .indeterminate=${this.#isSomeSelected()}
                            @change=${this.#onSelectAll}
                            label="Select all candidates">
                          </uui-checkbox>
                        </uui-table-head-cell>
                        ${this.#renderSortHeading('Name', 'name')}
                        ${this.#renderSortHeading('Type', 'type')}
                        ${this.#renderSortHeading('Usage Count', 'usage')}
                        ${this.#renderSortHeading('Risk', 'risk')}
                        <uui-table-head-cell><span>Details</span></uui-table-head-cell>
                        <uui-table-head-cell class="usage-head-cell"><span>Usage</span></uui-table-head-cell>
                        <uui-table-head-cell class="action-head-cell"><span>Action</span></uui-table-head-cell>
                      </uui-table-head>

                      ${this._items.map((item) => html`
                          <uui-table-row ?selected=${this._selectedKeys.has(item.key)}>
                            <uui-table-cell class="checkbox-cell">
                              <uui-checkbox
                                .checked=${this._selectedKeys.has(item.key)}
                                @change=${(e: Event) => this.#onItemSelect(item.key, e)}
                                label="Select ${item.name}">
                              </uui-checkbox>
                            </uui-table-cell>
                            <uui-table-cell>
                              <strong>${item.name}</strong>
                              <div class="muted">${item.alias}</div>
                            </uui-table-cell>
                            <uui-table-cell>${item.type}</uui-table-cell>
                            <uui-table-cell class="usage-count-cell">${this.#renderUsageCell(item)}</uui-table-cell>
                            <uui-table-cell>
                              <uui-tag class=${item.risk === 'Moderate' ? 'risk-moderate' : ''} color=${this.#riskColor(item.risk)}>${item.risk}</uui-tag>
                            </uui-table-cell>
                            <uui-table-cell>
                              <div>${item.summary}</div>
                            </uui-table-cell>
                            <uui-table-cell class="usage-cell-action">
                              ${item.usages?.length
                                ? html`
                                    <uui-button
                                      compact
                                      look="secondary"
                                      label="View usage"
                                      .href=${this.#usageWorkspaceHref(item)}
                                      @click=${(event: Event) => this.#openUsageWorkspace(event, item)}>
                                      View usage
                                    </uui-button>
                                  `
                                : html`<span class="muted">-</span>`}
                            </uui-table-cell>
                            <uui-table-cell class="action-cell">
                              <uui-button
                                compact
                                look="outline"
                                color="danger"
                                label="Delete ${item.name}"
                                title="Delete ${item.name}"
                                @click=${() => this.#deleteCandidate(item)}>
                                <uui-icon name="icon-trash"></uui-icon>
                              </uui-button>
                            </uui-table-cell>
                          </uui-table-row>
                        `)}
                    </uui-table>

                    ${this._items.length === 0
                      ? html`
                          <div class="empty-state">
                            <uui-icon name="icon-search"></uui-icon>
                            <span>No cleanup candidates match the selected filters.</span>
                          </div>
                        `
                      : nothing}
                  </div>
                `}
          </uui-box>

          ${!this._loading ? this.#renderPagination(pageCount) : nothing}
        </div>
    `;
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
  `,
  ];
}

customElements.define('umb-content-cleaner-dashboard', UmbContentCleanerDashboardElement);

declare global {
  interface HTMLElementTagNameMap {
    'umb-content-cleaner-dashboard': UmbContentCleanerDashboardElement;
  }
}
