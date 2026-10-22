#!/usr/bin/env node
// Rebuilds the GitHub Pages view (docs/index.html) from data/peptide_identity.json.
// Usage: node scripts/site.js   (no dependencies)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { meta, compounds } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'peptide_identity.json'), 'utf8'));
const SITE = 'https://vrtx-research.github.io/peptide-identity-reference/';
const REPO = 'https://github.com/vrtx-research/peptide-identity-reference';
const RAW = 'https://raw.githubusercontent.com/vrtx-research/peptide-identity-reference/main/data/';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const BLOG_TITLES = {
  'what-is-bpc-157': 'What is BPC-157',
  'bpc-157-and-tb-500': 'BPC-157 and TB-500',
  'tb-500-vs-thymosin-beta-4': 'TB-500 vs thymosin beta-4',
  'ghk-cu-peptide': 'GHK-Cu peptide',
};
const blogLinks = (r) => r.vortex_links
  .map((u) => [u, (u.match(/\/blog\/([^/]+)\//) || [])[1]])
  .filter(([, slug]) => slug && BLOG_TITLES[slug])
  .map(([u, slug]) => `<a href="${esc(u)}">${esc(BLOG_TITLES[slug])}</a>`);

const peptides = compounds.filter((r) => r.is_peptide).length;
const matched = compounds.filter((r) => r.pubchem_match).length;

const jsonld = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: meta.name,
  description: 'Identity reference data for the compounds Vortex Research publishes lot reports for: one- and three-letter sequence, terminal modifications, molecular formula, average molecular weight, monoisotopic mass, residue count, PubChem CID and CAS number, with the PubChem query URL behind every value and an independent recomputation of each peptide formula and mass from its sequence.',
  url: SITE,
  sameAs: [REPO, 'https://doi.org/10.5281/zenodo.23578942'],
  identifier: 'https://doi.org/10.5281/zenodo.23578942',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  isAccessibleForFree: true,
  creator: { '@type': 'Organization', name: 'Vortex Research', url: 'https://vortexresearch.net/' },
  dateModified: meta.generated,
  keywords: ['peptide sequence', 'molecular formula', 'monoisotopic mass', 'molecular weight', 'PubChem CID', 'CAS number', 'peptide identity', 'TB-500', 'thymosin beta-4'],
  variableMeasured: ['sequence_one_letter', 'sequence_three_letter', 'modifications', 'molecular_formula', 'average_mw', 'monoisotopic_mass', 'residue_count', 'pubchem_cid', 'cas'],
  isBasedOn: ['https://pubchem.ncbi.nlm.nih.gov/', 'https://www.uniprot.org/'],
  distribution: [
    { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: RAW + 'peptide_identity.csv' },
    { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: RAW + 'peptide_identity.json' },
  ],
};

const rowsHtml = compounds.map((r) => `<tr>
<td>${esc(r.name)}</td>
<td>${r.is_peptide ? 'Peptide' : 'Non-peptide'}</td>
<td>${r.sequence_one_letter ? `<code>${esc(r.sequence_one_letter)}</code>` : '–'}</td>
<td class="n">${r.residue_count ?? '–'}</td>
<td>${r.modifications ? esc([r.modifications.n_terminus.split(' (')[0], r.modifications.c_terminus.split(' (')[0], r.modifications.other ? 'Cu(II) 1:1' : null].filter(Boolean).join(', ')) : '–'}</td>
<td><code>${esc(r.molecular_formula)}</code></td>
<td class="n">${esc(r.average_mw)}</td>
<td class="n">${esc(r.computed.average_mw.toFixed(2))}</td>
<td class="n">${esc(r.computed.monoisotopic_mass.toFixed(4))}</td>
<td class="n">${esc(r.pubchem_cid)}</td>
<td class="n">${esc(r.cas)}</td>
<td>${r.pubchem_match ? 'yes' : '<b>no</b>'}</td>
</tr>`).join('\n');

const notesHtml = compounds.map((r) => {
  const links = blogLinks(r);
  return `<h3>${esc(r.name)}</h3>
${r.sequence_three_letter ? `<p><code>${esc(r.sequence_three_letter)}</code></p>` : ''}
<ul>
${r.notes.map((n) => `<li>${esc(n)}</li>`).join('\n')}
${r.variants.map((v) => `<li>Variant: ${esc(v.label)}. PubChem CID ${esc(v.pubchem_cid)}, <code>${esc(v.molecular_formula)}</code>, monoisotopic ${esc(Number(v.monoisotopic_mass).toFixed(4))}. Recomputed formula matches: ${v.pubchem_match ? 'yes' : 'no'}.</li>`).join('\n')}
${links.length ? `<li>Background: ${links.join(', ')}.</li>` : ''}
</ul>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Peptide identity reference | Vortex Research</title>
<meta name="description" content="Open CC BY 4.0 identity data for ${compounds.length} records: sequence, formula, average MW, monoisotopic mass, PubChem CID and CAS, each recomputed and checked.">
<link rel="canonical" href="${SITE}">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>
:root{--purple:#7C5CFA;--ink:#14121C;--body:#5A5670;--muted:#8D89A3;--line:#E4DEF9;--wash:#F3F0FE}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font:16px/1.6 Manrope,system-ui,-apple-system,Segoe UI,Arial,sans-serif}
main{max-width:1080px;margin:0 auto;padding:40px 16px 64px}
h1{font-size:32px;line-height:1.15;letter-spacing:-.02em;margin:0 0 12px}h2{font-size:21px;margin:40px 0 10px}
p,li{color:var(--body)}a{color:var(--purple)}code{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px}
.eyebrow{text-transform:uppercase;letter-spacing:.3em;font-size:12px;color:var(--muted);margin:0 0 10px}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}.stat{background:var(--wash);border:1px solid var(--line);border-radius:12px;padding:12px 16px}
.stat b{display:block;font-size:22px;color:var(--ink)}.stat span{font-size:13px;color:var(--muted)}
.wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:14px;min-width:820px}th,td{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}
th{background:var(--wash);font:600 14px/1.6 Manrope,system-ui,-apple-system,Segoe UI,Arial,sans-serif}td.n{font-variant-numeric:tabular-nums}tr:last-child td{border-bottom:0}
.note{font-size:13px;color:var(--muted);border-top:1px solid var(--line);margin-top:40px;padding-top:16px}
h3{font-size:17px;margin:28px 0 6px}pre{background:var(--wash);border:1px solid var(--line);border-radius:12px;padding:12px 16px;overflow-x:auto}
</style>
</head>
<body>
<main>
<p class="eyebrow">Open data · CC BY 4.0</p>
<h1>Peptide identity reference</h1>
<p>Identity data for the compounds that <a href="https://vortexresearch.net/">Vortex Research</a> publishes lot reports for: sequence, terminal modifications, molecular formula, average molecular weight, monoisotopic mass, residue count, PubChem CID and CAS number. Every PubChem value is stored with the query URL that returned it, and every peptide formula and mass is recomputed from the sequence and checked against PubChem. The lot reports themselves are on the <a href="https://vortexresearch.net/coa/">Vortex Research lab report page</a> and in the companion <a href="https://vrtx-research.github.io/coa-dataset/">lot report dataset</a>.</p>

<div class="stats">
<div class="stat"><b>${compounds.length}</b><span>records</span></div>
<div class="stat"><b>${peptides}</b><span>peptide records</span></div>
<div class="stat"><b>${matched} / ${compounds.length}</b><span>match PubChem</span></div>
<div class="stat"><b>${esc(meta.generated)}</b><span>last built</span></div>
</div>

<h2>Records</h2>
<div class="wrap"><table>
<thead><tr><th>Compound</th><th>Type</th><th>Sequence</th><th>Residues</th><th>Termini</th><th>Formula (PubChem)</th><th>Avg MW (PubChem)</th><th>Avg MW (computed)</th><th>Monoisotopic</th><th>PubChem CID</th><th>CAS</th><th>Match</th></tr></thead>
<tbody>
${rowsHtml}
</tbody></table></div>
<p>Avg MW (PubChem) is PubChem's value as PubChem rounds it; Avg MW (computed) uses the same IUPAC 2005 element values PubChem uses. Monoisotopic mass is recomputed by <code>scripts/mass.js</code> and agrees with PubChem's MonoisotopicMass to better than 0.0001 Da on every row. "Match" means the recomputed formula is identical to PubChem's and both masses agree within 0.05 Da, or the only difference is PubChem's display rounding (explained in the row's notes).</p>

<h2>TB-500 and thymosin beta-4</h2>
<p>These names are often used for different molecules. Thymosin beta-4 (Tβ4, INN timbetasin) is a 43-residue chain with an acetylated N-terminus, <code>C212H350N56O78S</code>, about 4963 g/mol, CAS 77591-33-4. In PubChem, the name TB-500 resolves to Ac-LKKTETQ-OH, the seven-residue N-acetylated stretch matching residues 17-23 of that chain, <code>C38H68N10O14</code>, about 889 g/mol, CAS 885340-08-9. Some supplier listings pair the name TB-500 with the full Tβ4 identity. Only a mass measurement shows which molecule a material contains, so this dataset keeps them as two rows.</p>

<h2>Download</h2>
<ul>
<li><a href="${RAW}peptide_identity.csv">peptide_identity.csv</a>: one row per record, lists separated by <code>; </code>, notes by <code> | </code></li>
<li><a href="${RAW}peptide_identity.json">peptide_identity.json</a>: the same data with every query URL, related PubChem records, variants and a <code>meta</code> block</li>
<li>Source, field definitions and build scripts: <a href="${REPO}">github.com/vrtx-research/peptide-identity-reference</a></li>
</ul>

<h2>Verify a row</h2>
<p>Each row's <code>sources</code> block holds the exact PubChem PUG REST URLs used. To check one by hand, request the properties for its CID and compare formula and masses:</p>
<pre><code>https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/9941957/property/MolecularFormula,MolecularWeight,MonoisotopicMass/JSON</code></pre>
<p>Resolve a CAS number to its CID the same way (<code>/compound/name/137525-51-0/cids/JSON</code>). Resolve by CAS rather than by short name: the bare name "KPV" returns an unrelated compound in PubChem, and "GHK-Cu" returns six records, one of them copper-free. If anything differs, PubChem is the record. Please <a href="${REPO}/issues">open an issue</a> so the row can be corrected.</p>

<h2>Notes, variants and flags</h2>
<p>Lines starting "FLAG (PubChem data, not this row)" describe inconsistencies inside PubChem records that this dataset does not use.</p>
${notesHtml}

<h2>Cite</h2>
<p><code>Vortex Research (2026). Vortex Research peptide identity reference [Data set]. Zenodo. https://doi.org/10.5281/zenodo.23578942</code></p>
<p>Archived on <a href="https://doi.org/10.5281/zenodo.23578942">Zenodo (DOI 10.5281/zenodo.23578942)</a>; each release has its own version DOI.</p>

<p class="note">Research use only. Vortex Research materials are sold for in-vitro laboratory research by qualified researchers. Not for human or veterinary use. Not a drug, dietary supplement or cosmetic. Statements have not been evaluated by the FDA. This page holds identity data only: what each molecule is, not what it does.</p>
</main>
</body>
</html>
`;

fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'index.html'), html);
console.log('wrote docs/index.html');
