import { css, html, nothing } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { UMB_AUTH_CONTEXT } from '@umbraco-cms/backoffice/auth';
import type { UmbAuthContext } from '@umbraco-cms/backoffice/auth';
import { UMB_MODAL_CONTEXT } from '@umbraco-cms/backoffice/modal';
import type { UmbModalContext } from '@umbraco-cms/backoffice/modal';
import { UmbModalRouteRegistrationController } from '@umbraco-cms/backoffice/router';
import { UMB_WORKSPACE_MODAL } from '@umbraco-cms/backoffice/workspace';
import {
  UMB_DOCUMENT_ENTITY_TYPE,
  UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN,
} from '@umbraco-cms/backoffice/document';
import {
  UMB_DOCUMENT_TYPE_ENTITY_TYPE,
  UMB_EDIT_DOCUMENT_TYPE_WORKSPACE_PATH_PATTERN,
} from '@umbraco-cms/backoffice/document-type';
import {
  UMB_DATA_TYPE_ENTITY_TYPE,
  UMB_EDIT_DATA_TYPE_WORKSPACE_PATH_PATTERN,
} from '@umbraco-cms/backoffice/data-type';
import type { CleanupCandidate, UsageReference } from './content-cleaner.models.js';

type WorkspaceRouteBuilder = (params: { entityType: string }) => string;
type ContentCleanerUsageWorkspaceData = {
  entityType: string;
  preset?: {
    candidate?: CleanupCandidate;
  };
};

export default class ContentCleanerUsageWorkspaceElement extends UmbLitElement {
  static properties = {
    _candidate: { state: true },
    _loadingFallback: { state: true },
  };

  private _workspaceContext?: UmbModalContext<ContentCleanerUsageWorkspaceData, void>;
  // Must be `declare`d rather than a normal initialized class field - see the identical
  // comment in content-cleaner-dashboard.ts. Because this is the only reactive property here,
  // leaving it as a plain class field meant `this._candidate = ...` in consumeContext below
  // never told Lit to re-render, so the workspace stayed on its first, candidate-less render
  // (`render()` returns `nothing` until `_candidate` is set) even after the modal context
  // resolved with real data.
  declare private _candidate?: CleanupCandidate;
  declare private _loadingFallback: boolean;
  private _authContext?: UmbAuthContext;
  private readonly _workspaceModalRoute: UmbModalRouteRegistrationController;
  private _workspaceRouteBuilder?: WorkspaceRouteBuilder;

  constructor() {
    super();
    this._candidate = undefined;
    this._loadingFallback = false;

    this.consumeContext(UMB_AUTH_CONTEXT, (context) => {
      this._authContext = context ?? undefined;
    });

    this.consumeContext(UMB_MODAL_CONTEXT, (context) => {
      const workspaceContext = context as unknown as UmbModalContext<ContentCleanerUsageWorkspaceData, void>;
      this._workspaceContext = workspaceContext;
      const candidate = workspaceContext?.data?.preset?.candidate;

      if (candidate) {
        this._candidate = candidate;
      } else {
        // Page was refreshed while the slide view was open.
        // The dashboard's _items list is empty at this point so onSetup couldn't
        // supply a candidate via preset. Extract the candidateKey from the URL
        // (the route segment added by UmbModalRouteRegistrationController) and
        // fetch the candidate directly from the API.
        void this.#fetchCandidateFromUrl();
      }
    });

    this._workspaceModalRoute = new UmbModalRouteRegistrationController(this, UMB_WORKSPACE_MODAL)
      .addAdditionalPath(':entityType')
      .onSetup((routingInfo) => ({
        data: {
          entityType: routingInfo.entityType,
          preset: {},
        },
      }))
      .onSubmit(() => {})
      .onReject(() => {})
      .observeRouteBuilder((routeBuilder: WorkspaceRouteBuilder) => {
        this._workspaceRouteBuilder = routeBuilder;
        this.requestUpdate();
      });
  }

  /**
   * Extracts the candidateKey GUID from the current browser URL and fetches
   * the full CleanupCandidate from the API. This is used when the page is
   * refreshed while the Usage Slide View is open — at that point the dashboard
   * hasn't loaded its items list yet and cannot supply the candidate via preset.
   *
   * The modal URL looks like:
   *   …/modal/umb-modal-workspace/<candidateKey>/…
   * We rely on extracting a UUID from that path segment.
   */
  async #fetchCandidateFromUrl(): Promise<void> {
    // Extract a UUID from the URL path (the candidateKey route segment).
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = window.location.href.match(uuidPattern);
    const candidateKey = match?.[0];
    if (!candidateKey) return;

    // Wait for the auth context to be available (it may not be resolved yet).
    let authContext = this._authContext;
    if (!authContext) {
      authContext = await new Promise<UmbAuthContext>((resolve) => {
        const unsub = this.consumeContext(UMB_AUTH_CONTEXT, (ctx) => {
          if (ctx) {
            unsub?.destroy?.();
            resolve(ctx);
          }
        });
      });
    }

    this._loadingFallback = true;
    try {
      const token = await authContext.getLatestToken();
      const response = await fetch(
        `/umbraco/backoffice/elementfinder/content-cleaner/candidate/${candidateKey}`,
        {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (response.ok) {
        this._candidate = (await response.json()) as CleanupCandidate;
      }
    } catch {
      // Silently swallow — the slide view will remain blank in the rare case
      // where the API is unavailable, which is acceptable behaviour.
    } finally {
      this._loadingFallback = false;
    }
  }

  disconnectedCallback(): void {
    this._workspaceModalRoute.destroy();
    super.disconnectedCallback();
  }

  #workspaceHref(usage: UsageReference): string | undefined {
    if (!usage.key || !this._workspaceRouteBuilder) return undefined;

    let workspaceBase: string;
    let editPath: string;

    if (usage.referenceType === 'Content' || usage.referenceType === 'BlockList' || usage.referenceType === 'BlockGrid') {
      workspaceBase = this._workspaceRouteBuilder({ entityType: UMB_DOCUMENT_ENTITY_TYPE });
      editPath = UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN.generateLocal({ unique: usage.key });
    } else if (usage.referenceType === 'DataType') {
      workspaceBase = this._workspaceRouteBuilder({ entityType: UMB_DATA_TYPE_ENTITY_TYPE });
      editPath = UMB_EDIT_DATA_TYPE_WORKSPACE_PATH_PATTERN.generateLocal({ unique: usage.key });
    } else {
      workspaceBase = this._workspaceRouteBuilder({ entityType: UMB_DOCUMENT_TYPE_ENTITY_TYPE });
      editPath = UMB_EDIT_DOCUMENT_TYPE_WORKSPACE_PATH_PATTERN.generateLocal({ unique: usage.key });
    }

    if (!workspaceBase || !editPath) return undefined;
    return `${workspaceBase}${editPath}`;
  }

  #usageType(usage: UsageReference): string {
    switch (usage.referenceType) {
      case 'BlockList': return 'Content - Block List';
      case 'BlockGrid': return 'Content - Block Grid';
      case 'DocumentType':
      case 'ElementType': return 'Document Type';
      case 'DataType': return 'Data Type';
      case 'Composition': return 'Composition';
      default: return 'Content';
    }
  }

  #reference(usage: UsageReference): string {
    if (usage.propertyAlias && usage.dataTypeName) {
      return `${usage.propertyAlias} - ${usage.dataTypeName}`;
    }

    return usage.propertyAlias ?? usage.dataTypeName ?? usage.contentTypeAlias ?? '-';
  }

  #isContentUsage(usage: UsageReference): boolean {
    return usage.referenceType === 'Content' ||
      usage.referenceType === 'BlockList' ||
      usage.referenceType === 'BlockGrid';
  }

  #summaryCard(label: string, value: number, icon: string) {
    return html`
      <uui-box class="summary-card">
        <div class="summary-card__content">
          <uui-icon name=${icon}></uui-icon>
          <div>
            <strong>${value}</strong>
            <span>${label}</span>
          </div>
        </div>
      </uui-box>
    `;
  }

  #renderUsageGroup(title: string, icon: string, usages: UsageReference[]) {
    if (usages.length === 0) return nothing;

    return html`
      <uui-box class="usage-group">
        <div slot="headline" class="usage-group__headline">
          <uui-icon name=${icon}></uui-icon>
          <span>${title}</span>
        </div>
        <span slot="header-actions">
          <uui-tag color="default">${usages.length}</uui-tag>
        </span>

        <div class="table-wrap" role="region" aria-label="${title} table" tabindex="0">
          <uui-table>
            <uui-table-head>
              <uui-table-head-cell><span>Name</span></uui-table-head-cell>
              <uui-table-head-cell><span>Type</span></uui-table-head-cell>
              <uui-table-head-cell><span>Reference</span></uui-table-head-cell>
              <uui-table-head-cell class="action-cell"><span>Action</span></uui-table-head-cell>
            </uui-table-head>

            ${usages.map((usage) => {
              const href = this.#workspaceHref(usage);
              const actionLabel = this.#isContentUsage(usage) ? 'Open' : 'View';

              return html`
                <uui-table-row>
                  <uui-table-cell>
                    <strong>${usage.name}</strong>
                    ${usage.contentTypeAlias
                      ? html`<div class="muted">${usage.contentTypeAlias}</div>`
                      : nothing}
                  </uui-table-cell>
                  <uui-table-cell>${this.#usageType(usage)}</uui-table-cell>
                  <uui-table-cell>${this.#reference(usage)}</uui-table-cell>
                  <uui-table-cell class="action-cell">
                    ${href
                      ? html`
                          <uui-button
                            look="primary"
                            label=${actionLabel}
                            .href=${href}>
                            ${actionLabel}
                          </uui-button>
                        `
                      : html`<span class="muted">Unavailable</span>`}
                  </uui-table-cell>
                </uui-table-row>
              `;
            })}
          </uui-table>
        </div>
      </uui-box>
    `;
  }

  #close(): void {
    this._workspaceContext?.reject();
  }

  render() {
    if (this._loadingFallback) {
      return html`<div class="loader"><uui-loader></uui-loader></div>`;
    }

    const candidate = this._candidate;
    if (!candidate) return nothing;

    const usages = candidate.usages ?? [];
    const contentUsages = usages.filter((usage) => this.#isContentUsage(usage));
    const configUsages = usages.filter((usage) => !this.#isContentUsage(usage));

    return html`
      <umb-body-layout headline="Usage — ${candidate.name}">
        <div id="main">
          <uui-box class="candidate-summary">
            <div slot="headline" class="candidate-headline">
              <span class="candidate-name">${candidate.name}</span>
              <uui-tag look="outline" class="type-tag">${candidate.type}</uui-tag>
            </div>
            <p>${candidate.summary}</p>
            <span class="muted">Review each reference before changing or deleting this item.</span>
          </uui-box>

          <div class="summary-grid" aria-label="Usage summary">
            ${this.#summaryCard('Total Usages', usages.length, 'icon-list')}
            ${this.#summaryCard('Content Usages', contentUsages.length, 'icon-document')}
            ${this.#summaryCard('Configurational Usages', configUsages.length, 'icon-settings')}
          </div>

          ${usages.length === 0
            ? html`
                <uui-box class="empty-state">
                  <uui-icon name="icon-search"></uui-icon>
                  <strong>No usage references were detected.</strong>
                  <span class="muted">There are no items available to open.</span>
                </uui-box>
              `
            : html`
                <div class="usage-content">
                  ${this.#renderUsageGroup('Content Usages', 'icon-document', contentUsages)}
                  ${this.#renderUsageGroup('Configurational Usages', 'icon-settings', configUsages)}
                </div>
              `}
        </div>

        <umb-footer-layout slot="footer">
          <uui-button slot="actions" look="secondary" label="Close" @click=${this.#close}>Close</uui-button>
        </umb-footer-layout>
      </umb-body-layout>
    `;
  }

  static styles = [
    UmbTextStyles,
    css`
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
  `,
  ];
}

customElements.define('umb-content-cleaner-usage-workspace', ContentCleanerUsageWorkspaceElement);

declare global {
  interface HTMLElementTagNameMap {
    'umb-content-cleaner-usage-workspace': ContentCleanerUsageWorkspaceElement;
  }
}
