# Umb.ElementFinder

A backoffice package for Umbraco containing **Element Finder** and **Content Cleaner** to inspect, track, and clean up your schema and content with complete confidence.

## Features

### Element Finder

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

### Content Cleaner

-   Scan and detect cleanup candidates across **Document Types**, **Properties**, and **Data Types**.
-   Deep dependency inspection across content instances, serialized Block List and Block Grid values, compositions, and data type references.
-   Categorize candidates with clear **Risk Levels** (Low, Moderate, Review, High) to safely evaluate deletion impact.
-   Dedicated **Usage Workspace** showing all dependencies and direct links to edit workspaces.
-   Safe single and **batch deletion** with confirmation modals.
-   **Automatic Block Reference Cleanup**: deleting a Document Type safely removes it from Block List and Block Grid configurations, preventing `undefined` block errors.
-   Server-side search, filtering by Type and Risk, sorting, and pagination.
-   In-memory caching with on-demand rescanning.

### General

-   Native Umbraco UUI components, icons, loaders, and theme-aware styling.
-   Secure API protected by Umbraco backoffice authentication and permissions.

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

### Element Finder

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

#### Search and Pagination

Both screens search and page **on the server**, so only the current page of
results is ever sent to the browser. Sites with hundreds of Element Types or
thousands of content pages stay responsive:

![Element Type list paged, showing the pagination controls](https://raw.githubusercontent.com/Nikhilgirirajdigital/umb.elementfinder/main/screenshots/element-finder-pagination.png)

#### Usage Results

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

#### Usage Counts and Cultures

The **Usage Count** column reports how many times an Element Type occurs, not
how many pages use it:

-   **Total** -- every occurrence of the element on that page.
-   **Per culture** -- occurrences grouped by language ISO code on
    culture-variant properties.
-   **Invariant** -- occurrences on properties that do not vary by culture.

---

### Content Cleaner

Content Cleaner helps keep your Umbraco project clean and maintainable by identifying unused or obsolete schema items and safely removing them.

Navigate to:

**Settings → Advanced Settings → Content Cleaner**

#### Dashboard and Overview

The dashboard displays summary cards by risk level, search and filtering tools, and a paged list of cleanup candidates:

1.  Search by name or alias.
2.  Filter candidates by **Type** (Document Type, Property, Data Type) or **Risk** level (Low, Moderate, Review, High).
3.  Refresh results on demand using **Scan again**.

![Content Cleaner Dashboard]([#Dashboard])

#### Inspecting Usages

Selecting **View usage** on any candidate opens the slide-out workspace to inspect every place where an item is referenced (content pages, block editor configurations, compositions, and data types) with direct links to edit them:

![Content Cleaner Usages]([#Usages])

#### Safe Deletion & Automatic Block Pruning

Delete individual candidates or select multiple items for batch deletion. A confirmation popup appears detailing what is being deleted:

![Delete Warning Popup]([#Delete Warning Popup])

When deleting a Document Type (including Element Types), Content Cleaner automatically removes block references and area configurations from Block List and Block Grid Data Types, preventing `undefined` block errors in the backoffice.

#### Cleanup Risk Levels

Candidates are categorized into four clear risk levels:

-   **Low**: No content instances, block editor configuration references, or composition consumers detected. Safe for cleanup.
-   **Moderate**: Item has indirect or embedded dependencies without independent content counts (e.g., properties embedded in block data).
-   **Review**: No direct content instances were found, but structural dependencies (such as composition inheritance or editor configurations) exist. Review before deletion.
-   **High**: Active saved content instances exist on published or draft content items. Review carefully before removal.

---

## Support

For issues or feature requests, create an issue in the project's repository.

## Author

**Giriraj Digital**

## License

This project is licensed under the **MIT License**.
