#!/usr/bin/env node
'use strict';

// Parses resources.md and pushes the rendered accordion HTML into the
// APPNA Peds "Resources" WordPress page (https://appnapeds.org/resources/)
// via the WP REST API, so the page keeps its existing look (Easy Accordion
// plugin markup) while the link list is sourced from this repo.

const fs = require('fs');
const path = require('path');

const WP_URL = process.env.WP_URL;
const WP_USER = process.env.WP_USER;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;
const WP_PAGE_ID = process.env.WP_PAGE_ID;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'resources.md');

for (const [name, value] of Object.entries({ WP_URL, WP_USER, WP_APP_PASSWORD, WP_PAGE_ID })) {
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Expected format per category:
//   ## Category Title
//
//   - [Link Title](https://example.com): One or two line description.
function parseResources(markdown) {
  const categories = [];
  let current = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      current = { title: heading[1].trim(), items: [] };
      categories.push(current);
      continue;
    }

    const item = line.match(/^-\s*\[([^\]]+)\]\(([^)]+)\)\s*:\s*(.*)$/);
    if (item) {
      if (!current) {
        throw new Error(`Found a link line before any "## Category" heading: "${line}"`);
      }
      current.items.push({ title: item[1].trim(), url: item[2].trim(), description: item[3].trim() });
      continue;
    }

    throw new Error(`Line didn't match a "## Category" heading or a "- [Title](url): description" link: "${line}"`);
  }

  return categories;
}

function buildAccordionHtml(categories) {
  const wrapperId = 'sp-ea-982';
  const outerId = 'sp_easy_accordion-1780310928';

  const style = `<style>#${wrapperId} .spcollapsing { height: 0; overflow: hidden; transition-property: height;transition-duration: 300ms;}#${wrapperId}.sp-easy-accordion>.sp-ea-single {margin-bottom: 10px; border: 1px none transparent; }#${wrapperId}.sp-easy-accordion>.sp-ea-single>.ea-header a {color: #444;}#${wrapperId}.sp-easy-accordion>.sp-ea-single>.sp-collapse>.ea-body {background: #fff; color: #444;}#${wrapperId}.sp-easy-accordion>.sp-ea-single {background: transparent;}#${wrapperId}.sp-easy-accordion>.sp-ea-single>.ea-header a .ea-expand-icon { float: left; color: #444;font-size: 16px;}</style>`;

  const cards = categories
    .map((cat, i) => {
      const headerId = `ea-header-${i}`;
      const collapseId = `collapse-${i}`;
      const title = escapeHtml(cat.title);

      const body = cat.items
        .map((item) => {
          const t = escapeHtml(item.title);
          const url = escapeHtml(item.url);
          const desc = escapeHtml(item.description);
          return `<p dir="auto"><strong><a href="${url}">${t}:</a></strong> ${desc}</p>`;
        })
        .join('\n');

      return `<div class="ea-card  sp-ea-single">
\t<h3 class="ea-header">
\t\t<a class="collapsed" id="${headerId}" role="button" data-sptoggle="spcollapse" data-sptarget="#${collapseId}" aria-controls="${collapseId}" href="#" aria-expanded="false" tabindex="0">
\t\t<i aria-hidden="true" role="presentation" class="ea-expand-icon eap-icon-ea-expand-plus"></i> ${title}\t\t</a>
\t</h3>
\t<div class="sp-collapse spcollapse spcollapse" id="${collapseId}" data-parent="#${wrapperId}" role="region" aria-labelledby="${headerId}">
\t\t<div class="ea-body">
\t\t<div class="el-p">
${body}
</div>
\t\t</div>
\t</div>
</div>`;
    })
    .join('\n');

  return `${style}<div id="${outerId}">
<div id="${wrapperId}" class="sp-ea-one sp-easy-accordion" data-ea-active="ea-click" data-ea-mode="vertical" data-preloader="" data-scroll-active-item="" data-offset-to-scroll="0">

${cards}

</div>
</div>`;
}

const INTRO_HTML = `<p>Below is a curated, deduplicated, and link-verified directory of resources for APPNA Pediatrics members, pediatricians, trainees, IMGs, medical students, researchers, and families.<br><br>Last updated: {{LAST_UPDATED}}</p>

<hr class="wp-block-separator has-alpha-channel-opacity"/>

<p><strong>How to use this directory</strong></p>

<ul class="wp-block-list">
<li>Each link includes a 1&#8211;2 line description of what it offers and who it&#8217;s most useful for.</li>
<li>Links open the official source of each organization or service.</li>
<li>Categories are non-overlapping &#8212; each resource appears once, in the most relevant section.</li>
<li>For mobile users, tap any link to open in a new tab.</li>
</ul>

<p style="color:#0037ff"><strong>Disclaimer:</strong> Clinical, legal, immigration, scholarship, exam, and grant information changes frequently. Always verify critical decisions through the official source and a qualified professional. AI tools are valuable for drafting and summarizing but should never replace primary literature, current guidelines, or local institutional policy.</p>

<p style="color:#0037ff"><strong>Crisis support:</strong>&nbsp;In the US, call or text&nbsp;<strong>988</strong>&nbsp;(Suicide &amp; Crisis Lifeline). In Pakistan, contact the&nbsp;<strong>Umang Pakistan Helpline at 0311-7786264</strong>. For any immediate danger, call your local emergency number or go to the nearest emergency department.</p>

<hr class="wp-block-separator has-alpha-channel-opacity"/>`;

function formatDate(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function main() {
  const markdown = fs.readFileSync(DATA_FILE, 'utf8');
  const categories = parseResources(markdown);

  if (categories.length === 0) {
    throw new Error(`No categories parsed from ${DATA_FILE} — aborting so we don't wipe the live page.`);
  }

  const totalLinks = categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`Parsed ${categories.length} categories, ${totalLinks} links from ${DATA_FILE}`);

  const intro = INTRO_HTML.replace('{{LAST_UPDATED}}', formatDate(new Date()));
  const content = `${intro}\n${buildAccordionHtml(categories)}`;

  const endpoint = `${WP_URL.replace(/\/$/, '')}/wp-json/wp/v2/pages/${WP_PAGE_ID}`;
  const auth = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WordPress REST API returned ${res.status} ${res.statusText}: ${body}`);
  }

  console.log(`Synced successfully to ${endpoint}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
