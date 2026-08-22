# Umb.ElementFinder

A backoffice dashboard for **Umbraco 17 and later** that shows you where every reusable
**Element Type** is actually used across your content, without writing a single query.

## Features

-   Browse every reusable **Element Type** in the site.
-   See a **total usage count** for each Element Type at a glance.
-   Drill into the list of content pages where an Element Type is used.
-   Per-page **usage count**, including how many times the element appears.
-   Per-culture usage breakdown for multilingual sites.
-   **Published / Unpublished** status for every page in the results.
-   Server-side search and pagination on both Element Types and used pages.
-   Breadcrumb navigation between the Element Type list and usage results.
-   **Go to Page** opens the page in the native Umbraco document workspace.
-   Usage index stays current automatically when content is saved.
-   Native Umbraco UUI components, icons, loaders, and theme-aware styling.
-   Secure API protected by Umbraco backoffice authentication.

## Dashboard Columns

| Column | Screen | Description |
| --- | --- | --- |
| Element Type | Element Types | Element Type name, alias, and its own icon |
| Total Usage Count | Element Types | Total occurrences across all content |
| Page | Used Pages | Content page name and document type icon |
| Status | Used Pages | Whether the page currently has a published version |
| Usage Count | Used Pages | Occurrences on that page, broken down by culture |

## Requirements

-   **Umbraco CMS 17 or 18**
-   **.NET 10**

## Installation

Install the package using NuGet:

``` powershell
dotnet add package Umb.ElementFinder
```

No additional wiring is required. The package automatically registers its
services, runs its package migration, and installs the backoffice dashboard.

## Usage

After installation, open the Umbraco backoffice and navigate to:

**Content → Element Finder**

1.  Search for an Element Type, or page through the full list.
2.  Select **View Usage** on the Element Type you are interested in.
3.  Review the content pages that use it, with status and usage counts.
4.  Search or page through the results to narrow them down.
5.  Select **Go to Page** to open that page in the Umbraco workspace.

Every reusable Element Type in the project is listed with its name, alias, icon,
and a running total of how many times it is used:

![Element Types listed with aliases and total usage counts](https://raw.githubusercontent.com/Nikhilgirirajdigital/umb.elementfinder/main/screenshots/element-finder-dashboard.png)

## Search and Pagination

Both screens search and page **on the server**, so only the current page of
results is ever sent to the browser. Sites with hundreds of Element Types or
thousands of content pages stay responsive:

![Element Type list paged, showing the pagination controls](https://raw.githubusercontent.com/Nikhilgirirajdigital/umb.elementfinder/main/screenshots/element-finder-pagination.png)

## Usage Results

Selecting **View Usage** shows every content page that uses the Element Type,
with a breadcrumb back to the full list, the page's published status, and how
many times the element appears on it.

> **Note:** Each page is listed **once**, even when the Element Type is used
> several times on it. The number of occurrences is shown in the
> **Usage Count** column instead.

![Content pages using the Image element type, with published status and per-culture usage counts](https://raw.githubusercontent.com/Nikhilgirirajdigital/umb.elementfinder/main/screenshots/element-finder-usage-pages.png)

**Go to Page** opens the content item directly in the native Umbraco document
workspace, so you can edit it without losing your place in the results:

![The About Us page opened in the Umbraco workspace from the usage results](https://raw.githubusercontent.com/Nikhilgirirajdigital/umb.elementfinder/main/screenshots/element-finder-go-to-page.png)

## Usage Counts and Cultures

The **Usage Count** column reports how many times an Element Type occurs, not
how many pages use it:

-   **Total** -- every occurrence of the element on that page.
-   **Per culture** -- occurrences grouped by language ISO code on
    culture-variant properties.
-   **Invariant** -- occurrences on properties that do not vary by culture.

## API

The package provides read-only APIs under:

``` text
/umbraco/backoffice/elementfinder
```

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/ElementTypes` | Paged, searchable list of Element Types with usage totals |
| `GET` | `/PagesForElementType` | Paged, searchable list of pages using a given Element Type |

Both endpoints accept `page`, `pageSize`, and `search` query parameters.
`pageSize` defaults to `20` and is capped at `100`.
`PagesForElementType` also requires an `elementTypeAlias`.

## Security

Access to Element Finder is protected by:

-   Umbraco backoffice authentication.
-   The `BackOfficeAccess` authorization policy.
-   The backoffice authentication scheme, so front-end or member cookies
    cannot reach the API.

Only authenticated backoffice users can open the dashboard or call its APIs.

## Technical Notes

Umbraco stores Block List, Block Grid, and Nested Content values as JSON inside
`umbracoPropertyData`. Scanning those values on every request does not scale, so
Element Finder maintains its own **usage index**.

A package migration creates two tables, `umbElementFinderUsage` and
`umbElementFinderState`. The index is built once on first startup after
installation, and is then kept up to date incrementally by a `ContentSaved`
notification handler, so no background scanning or scheduled job is required.

Element Type browsing reads from Umbraco's live `IContentTypeService`, so newly
created Element Types appear immediately. Used-page lookups are resolved with a
single server-side paged SQL query against the index, which keeps the dashboard
responsive on large content trees. Pages in the recycle bin are excluded from
all results.

## Support

For issues or feature requests, create an issue in the project's repository.

## Author

**Giriraj Digital**

## License

This project is licensed under the **MIT License**.
