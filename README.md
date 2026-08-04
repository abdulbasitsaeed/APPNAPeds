# APPNA Peds Resources Sync

This repo is the source of truth for the collapsible resource directory on
[appnapeds.org/resources](https://appnapeds.org/resources/). Editing
[`resources.md`](resources.md) and pushing to `main` automatically updates the
live page.

The page originally used the "Easy Accordion" WordPress plugin, but that
plugin only loads its CSS/JS when it detects its own shortcode in the page
content — since we push fully-rendered HTML instead of a shortcode, the
sync script generates its own small self-contained CSS/JS for the
collapse/expand behavior (see `buildAccordionHtml` in
[`scripts/sync-to-wordpress.js`](scripts/sync-to-wordpress.js)) instead of
depending on the plugin. Visually it's styled to match, but it's not the
plugin's own markup.

## Editing the directory

Open [`resources.md`](resources.md). It's a list of categories, each with
bullet-point links:

```md
## Category Title

- [Link Title](https://example.com): One or two line description.
- [Another Link](https://example.org): Description of this one.
```

- A category is any line starting with `## `.
- A link is any line shaped exactly like `- [Title](url): description`.
- Order in the file is the order the categories/links appear on the page.
- Don't add anything else (no other Markdown syntax) — the sync script only
  understands these two line shapes and will fail the GitHub Action if it
  finds a line it doesn't recognize, rather than silently dropping content.

Commit and push to `main` (or merge a PR into `main`) and the
**Sync resources to WordPress** Action will push the update within a minute
or two. Check the *Actions* tab if a page update doesn't show up — the job
fails loudly (with the bad line quoted) instead of partially updating the
page.

## One-time setup (needs to be done by a repo admin)

The Action authenticates to WordPress with an
[Application Password](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/),
scoped to one account — it never uses your real WordPress login password.

1. In WordPress admin, go to **Users → Profile** (use an account with
   permission to edit the Resources page) → **Application Passwords** →
   enter a name like `github-sync` → **Add New Application Password**.
   Copy the generated password (spaces included) — WordPress only shows it once.
2. In this GitHub repo, go to **Settings → Secrets and variables → Actions**
   and add these repository secrets:
   | Secret | Value |
   |---|---|
   | `WP_URL` | `https://appnapeds.org` |
   | `WP_USER` | the WordPress username from step 1 |
   | `WP_APP_PASSWORD` | the application password from step 1 |
   | `WP_PAGE_ID` | `768` (the Resources page's ID) |
3. Push a small test edit to `resources.md`, or trigger the workflow manually
   from the *Actions* tab (**Sync resources to WordPress → Run workflow**),
   and confirm the live page updates.

If the Resources page is ever recreated with a different WordPress page ID,
update the `WP_PAGE_ID` secret to match.
