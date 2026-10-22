#!/usr/bin/env node
// Rebuilds data/peptide_identity.json and data/peptide_identity.csv.
// Usage: node scripts/build.js        (Node 18+, no dependencies, needs network access)
//
// What it does, per compound:
//  1. Records what PubChem's name lookup returns, and confirms the CAS number resolves to the chosen CID.
//  2. Pulls formula, average MW, monoisotopic mass, charge and title from PubChem PUG REST.
//  3. Reads CAS numbers from the record's synonyms and from PubChem's CAS section (PUG View).
//  4. Confirms the sequence: against a sequence string in PubChem's synonyms and/or UniProt.
//  5. Recomputes formula and masses from the sequence + modifications with scripts/mass.js and compares.
//     Formula must match exactly; masses within 0.05 Da, otherwise a note explains or flags the difference.
//  6. Checks each Vortex link returns HTTP 200; anything else is dropped.
// Every query URL is stored in the row's `sources` block so each value can be re-checked by hand.
'use strict';
const fs = require('fs');
const path = require('path');
const mass = require('./mass.js');

const ROOT = path.join(__dirname, '..');
const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const PUG_VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view';
const UNIPROT = 'https://rest.uniprot.org/uniprotkb';
const TOL = 0.05; // Da
const COA = 'https://vortexresearch.net/coa/';
const BLOG = (s) => `https://vortexresearch.net/blog/${s}/`;

// ---------------------------------------------------------------------------------------------------------
// Compound definitions. Sequences and modifications are inputs; build.js verifies them against the sources.
// `notes` here are hand-written and sourced; build.js appends machine-generated notes.
// ---------------------------------------------------------------------------------------------------------
const COMPOUNDS = [
  {
    id: 'bpc-157', name: 'BPC-157', type: 'peptide', cid: 9941957, lookup: ['BPC-157'],
    sequence: 'GEPPPGKPADDAGLV', n: 'free', c: 'acid', form: 'free peptide, no counter-ion',
    synonyms: ['BPC 157', 'Bpc157', 'Bepecin', 'PL-14736'],
    vortex: [BLOG('what-is-bpc-157'), BLOG('bpc-157-and-tb-500'), COA],
    notes: [
      'PubChem synonyms for this record include trifluoroacetate-salt names. The formula and masses are for the free peptide without counter-ions.',
    ],
  },
  {
    id: 'tb-500', name: 'TB-500', type: 'peptide', cid: 62707662, lookup: ['TB-500', 'TB500'],
    sequence: 'LKKTETQ', n: 'acetyl', c: 'acid', form: 'free peptide, no counter-ion',
    synonyms: ['TB500', 'TB 500', 'N-Acetyl-L-leucyl-L-lysyl-L-lysyl-L-threonyl-L-alpha-glutamyl-L-threonyl-L-glutamine'],
    vortex: [BLOG('tb-500-vs-thymosin-beta-4'), BLOG('bpc-157-and-tb-500'), COA],
    variants: [
      { label: 'LKKTETQ without the N-acetyl group (PubChem title: Fequesetide)', cid: 10169788, sequence: 'LKKTETQ', n: 'free', c: 'acid' },
    ],
    notes: [
      'Naming: "TB-500" is a market name, not a systematic one. PubChem CID 62707662 (synonyms TB-500 and TB500; CAS 885340-08-9) is Ac-LKKTETQ-OH, the N-acetylated heptapeptide matching residues 17-23 of the mature 43-residue thymosin beta-4 chain (numbering as in UniProt P62328 after removal of the initiator methionine).',
      'Some supplier listings attach the full thymosin beta-4 identity (CAS 77591-33-4, C212H350N56O78S, about 4963 g/mol) to the name TB-500. That is a different molecule; it has its own row (thymosin-beta-4).',
      'The same heptapeptide without the N-acetyl group is a separate PubChem record, CID 10169788 (C36H66N10O13), 42.01 Da lighter. See variants.',
    ],
  },
  {
    id: 'thymosin-beta-4', name: 'Thymosin beta-4 (Tβ4)', type: 'peptide', cid: 16132341, lookup: ['Thymosin beta-4', 'Thymosin beta4'],
    sequence: 'SDKPDMAEIEKFDKSKLKKTETQEKNPLPSKETIEQEKQAGES', n: 'acetyl', c: 'acid', form: 'free peptide, no counter-ion',
    uniprot: { acc: 'P62328', strip_initiator_met: true },
    synonyms: ['Timbetasin', 'Thymosin beta4', 'Tbeta4', 'Fx Peptide'],
    vortex: [BLOG('tb-500-vs-thymosin-beta-4'), COA],
    notes: [
      'Sequence source: UniProt P62328 (TYB4_HUMAN). The translated precursor starts with an initiator methionine that is removed; the mature chain is 43 residues (precursor positions 2-44) with an N-acetylated Ser1. Residue numbers in this dataset follow the mature chain.',
      'UniProt also lists natural acetyl-lysine and phosphorylation sites. The formula and masses here are for the unmodified chain apart from the N-terminal acetyl group, which is what PubChem CID 16132341 records.',
      'PubChem has two records with this formula: CID 16132341 (title Timbetasin, the INN; stereocentres defined; CAS 77591-33-4) and CID 45382195 (title Thymosin Beta 4, stereocentres not defined, no CAS listed). PubChem name lookup "Thymosin beta-4" returns CID 45382195. CID 16132341 is used because the CAS number resolves to it.',
      'Not the same molecule as TB-500 (row tb-500). Ac-LKKTETQ is residues 17-23 of this chain.',
    ],
  },
  {
    id: 'ghk', name: 'GHK (free tripeptide)', type: 'peptide', cid: 73587, lookup: ['GHK'],
    sequence: 'GHK', n: 'free', c: 'acid', form: 'free peptide, no copper, no counter-ion',
    synonyms: ['Glycyl-L-histidyl-L-lysine', 'Gly-His-Lys', 'Prezatide', 'Tripeptide-1'],
    vortex: [BLOG('ghk-cu-peptide'), COA],
    notes: [
      'This is the copper-free tripeptide. PubChem\'s synonym list for this record also carries the names "GHK-Cu" and "Copper Peptide", so a name lookup for "GHK-Cu" returns this copper-free record among its results. Match the CID to the material: copper complex = row ghk-cu.',
    ],
  },
  {
    id: 'ghk-cu', name: 'GHK-Cu (copper complex)', type: 'peptide (metal complex)', cid: 71587328, lookup: ['GHK-Cu', 'Prezatide copper'],
    sequence: 'GHK', n: 'free', c: 'acid', complex: 'cu1', seq_synonym: 'Copper, (N2-(N-glycyl-L-histidyl)-L-lysinato(2-))-', form: '1:1 Cu(II) complex, drawn by PubChem as a cation (charge +1)',
    synonyms: ['Prezatide copper', 'Copper tripeptide-1', 'GHK-Cu', 'GHK copper'],
    vortex: [BLOG('ghk-cu-peptide'), COA],
    related: [
      { cid: 165429100, relation: '1:1 Cu complex drawn as a neutral species' },
      { cid: 139035031, relation: '1:1 Cu complex drawn as an anion' },
      { cid: 9831891, relation: '2:1 GHK:Cu complex (title Bisprezatide copper)' },
      { cid: 133697840, relation: 'two GHK molecules plus copper as a mixture record (title GHK-Cu)' },
    ],
    notes: [
      'CAS 89030-95-5 resolves to PubChem CID 71587328 (title Prezatide copper), which draws the 1:1 complex as a cation: GHK minus one proton plus Cu, overall charge +1, C14H23CuN6O4+.',
      'PubChem holds several other GHK-copper records that differ in copper ratio and protonation (see related_pubchem_records), so "GHK-Cu" has no single formula or molecular weight. The value that applies to a solid material depends on the copper ratio, protonation state and counter-ions, which the lot report or supplier should state.',
      'The copper-free tripeptide is row ghk (CID 73587, CAS 49557-75-7).',
      'FLAG (PubChem data, not this row): CID 71587328 is drawn as the singly deprotonated cation (C14H23CuN6O4+), while several of its synonyms, e.g. "Copper, (N2-(N-glycyl-L-histidyl)-L-lysinato(2-))-", name the doubly deprotonated neutral complex (C14H22CuN6O4, the formula of CID 165429100). The two differ by one hydrogen (1.008 Da).',
    ],
  },
  {
    id: 'kpv', name: 'KPV', type: 'peptide', cid: 125672, lookup: ['KPV', 'Lys-Pro-Val'],
    sequence: 'KPV', n: 'free', c: 'acid', form: 'free peptide, no counter-ion',
    synonyms: ['Lys-Pro-Val', 'L-Lysyl-L-prolyl-L-valine', 'alpha-MSH (11-13) (free acid)'],
    vortex: [COA],
    notes: [
      'PubChem name lookup "KPV" returns CID 13294447, which is an unrelated compound (2-oxo-5-phenylpentanoic acid, C11H12O3). The tripeptide Lys-Pro-Val is CID 125672, which CAS 67727-97-3 resolves to. Do not resolve this compound by the bare name "KPV".',
      'KPV matches residues 11-13 of alpha-MSH. In alpha-MSH itself the C-terminal valine is amidated (UniProt P01189, "Valine amide"); the PubChem KPV record and its synonyms (H-Lys-Pro-Val-OH, "alpha-MSH (11-13) (free acid)") describe the free acid, which is what this row gives.',
    ],
  },
  {
    id: 'mots-c', name: 'MOTS-c', type: 'peptide', cid: 146675088, lookup: ['MOTS-c'],
    sequence: 'MRWQEMGYIFYPRKLR', n: 'free', c: 'acid', form: 'free peptide, no counter-ion',
    uniprot: { acc: 'A0A0C5B5G6', strip_initiator_met: false },
    synonyms: ['Mots-c', 'H-MRWQEMGYIFYPRKLR-OH'],
    vortex: [COA],
    related: [
      { cid: 164946842, relation: 'salt record titled as the tris-acetic-acid form (peptide + 3 C2H4O2)', expect_add: { C: 6, H: 12, O: 6 } },
      { cid: 172641109, relation: 'salt record titled "Mots-C acetate"; its formula is the peptide + 3 CF3COOH (trifluoroacetate), not acetate', expect_add: { C: 6, H: 3, F: 9, O: 6 } },
    ],
    notes: [
      'Length: UniProt A0A0C5B5G6 (gene MT-RNR1) and PubChem CID 146675088 both give 16 residues, MRWQEMGYIFYPRKLR. No source reviewed for this dataset gives a different length.',
      'CAS 1627580-64-6 resolves to three PubChem records: the free peptide (CID 146675088, used here) and two salt records. FLAG (PubChem data, not this row): CID 172641109 is titled "Mots-C acetate", but its formula (C107H155F9N28O28S2) equals the free peptide plus three trifluoroacetic acid units, so the title and formula of that record disagree. Not used.',
    ],
  },
  {
    id: 'selank', name: 'Selank', type: 'peptide', cid: 11765600, lookup: ['Selank'],
    sequence: 'TKPRPGP', n: 'free', c: 'acid', form: 'free peptide, no counter-ion',
    synonyms: ['TP-7', 'Thr-Lys-Pro-Arg-Pro-Gly-Pro', 'Selanc'],
    vortex: [COA],
    variants: [
      { label: 'N-acetyl Selank (Ac-TKPRPGP-OH)', cid: 133082488, sequence: 'TKPRPGP', n: 'acetyl', c: 'acid' },
    ],
    notes: [
      'Selank is the tuftsin sequence TKPR (PubChem CID 156080, H-Thr-Lys-Pro-Arg-OH) extended by Pro-Gly-Pro.',
      'Variant names exist. "N-Acetyl Selank" is PubChem CID 133082488 (Ac-TKPRPGP-OH, C35H59N11O10, +42.01 Da; C-terminal free acid per its IUPAC name). The name "N-Acetyl Selank Amidate" has no PubChem record (lookup returns not found), so no formula is given for it here. A material sold under a variant name is a different molecule from the Selank in this row.',
    ],
  },
  {
    id: 'semax', name: 'Semax', type: 'peptide', cid: 9811102, lookup: ['Semax'],
    sequence: 'MEHFPGP', n: 'free', c: 'acid', form: 'free peptide, no counter-ion',
    synonyms: ['ACTH (4-7), Pro-Gly-Pro-', 'Met-Glu-His-Phe-Pro-Gly-Pro', 'MEHFPGP'],
    vortex: [COA],
    variants: [
      { label: 'N-acetyl Semax amidate (Ac-MEHFPGP-NH2)', cid: 172638603, sequence: 'MEHFPGP', n: 'acetyl', c: 'amide' },
    ],
    notes: [
      'Semax is ACTH residues 4-7 (MEHF) extended by Pro-Gly-Pro, as PubChem\'s synonym "ACTH (4-7), Pro-Gly-Pro-" states.',
      'Variant names exist. "N-Acetyl Semax Amidate" is PubChem CID 172638603 (Ac-MEHFPGP-NH2, C39H54N10O10S, 854.37 Da monoisotopic). The shorter name "N-Acetyl Semax" resolves to that same amidated record in PubChem, so the two names are not distinguished there. A material sold under a variant name is a different molecule from the Semax in this row.',
    ],
  },
  {
    id: 'nad', name: 'NAD+', type: 'small molecule (non-peptide)', cid: 5892, lookup: ['NAD+', 'Nicotinamide adenine dinucleotide'],
    form: 'neutral inner-salt form (PubChem title Nadide)',
    synonyms: ['Nadide', 'beta-NAD', 'nicotinamide adenine dinucleotide', 'diphosphopyridine nucleotide'],
    vortex: [COA],
    derive: { label: 'ADP-ribose + nicotinamide - H2O', parts: [[33576, 1], [936, 1]], subtract: { H: 2, O: 1 } },
    notes: [
      'Not a peptide: no sequence or residue count. mass.js computes masses from the formula; the formula itself is checked by an independent fragment sum (ADP-ribose, CID 33576, plus nicotinamide, CID 936, minus water).',
      'PubChem name lookup "NAD+" returns four CIDs: 5892 (Nadide, C21H27N7O14P2, CAS 53-84-9), 5893 (protonated cation, C21H28N7O14P2+), 15938971 (anion, C21H26N7O14P2-) and 10897651 (a second record with the same formula as 5892). CID 5892 is used because CAS 53-84-9 resolves to it.',
    ],
  },
  {
    id: '5-amino-1mq', name: '5-Amino-1MQ', type: 'small molecule (non-peptide)', cid: 950107, lookup: ['5-Amino-1MQ', '5-amino-1-methylquinolinium'],
    form: 'quinolinium cation (charge +1), no counter-ion',
    synonyms: ['5-amino-1-methylquinolinium', '5-Amino-1-methylquinolin-1-ium'],
    vortex: [COA],
    derive: { label: '5-aminoquinoline + CH3 on the ring nitrogen (charge +1)', parts: [[11911, 1]], add: { C: 1, H: 3 }, charge: 1 },
    related: [
      { cid: 66522933, relation: 'iodide salt (cation + I-), CAS 42464-96-0', expect_add: { I: 1 }, expect_charge: 0 },
    ],
    notes: [
      'Not a peptide: no sequence or residue count. Formula checked by an independent fragment sum (5-aminoquinoline, CID 11911, plus a methyl group on the ring nitrogen).',
      'PubChem name lookup "5-Amino-1MQ" returns no record. The cation is CID 950107 (CAS 685079-15-6, C10H11N2+, 159.21). The iodide salt is CID 66522933 (CAS 42464-96-0, C10H11IN2, 286.11). Which CAS number and molecular weight apply to a material depends on its counter-ion.',
      'FLAG (PubChem data, not this row): the iodide record\'s synonym list also contains "5-Amino-1-methylquinolinium chloride", which does not match that record\'s formula (iodide). Not used.',
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36';

async function get(url, { json = true, tries = 4 } = {}) {
  for (let i = 0; i < tries; i++) {
    await sleep(260); // PubChem asks for at most 5 requests per second
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 503 || res.status === 429) { await sleep(1500 * (i + 1)); continue; }
    const body = await res.text();
    if (!json) return { status: res.status, body };
    try { return { status: res.status, body: JSON.parse(body) }; } catch { return { status: res.status, body: null }; }
  }
  throw new Error('Gave up on ' + url);
}

const enc = encodeURIComponent;
const urls = {
  name: (n) => `${PUG}/compound/name/${enc(n)}/cids/JSON`,
  props: (cid) => `${PUG}/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,MonoisotopicMass,Charge,Title,IUPACName/JSON`,
  syn: (cid) => `${PUG}/compound/cid/${cid}/synonyms/JSON`,
  casView: (cid) => `${PUG_VIEW}/data/compound/${cid}/JSON?heading=CAS`,
  uniprot: (acc) => `${UNIPROT}/${acc}.fasta`,
};

async function cidsFor(name) {
  const r = await get(urls.name(name));
  return r.body && r.body.IdentifierList ? r.body.IdentifierList.CID : [];
}
async function props(cid) {
  const r = await get(urls.props(cid));
  const p = r.body.PropertyTable.Properties[0];
  return { formula: p.MolecularFormula, mw: p.MolecularWeight, mono: Number(p.MonoisotopicMass), charge: p.Charge, title: p.Title, iupac: p.IUPACName };
}
async function synonyms(cid) {
  const r = await get(urls.syn(cid));
  return r.body.InformationList.Information[0].Synonym || [];
}
async function casFromView(cid) {
  const r = await get(urls.casView(cid));
  const out = {};
  JSON.stringify(r.body || {}).replace(/"String":"(\d{2,7}-\d{2}-\d)"/g, (_, c) => { out[c] = (out[c] || 0) + 1; });
  return out; // CAS -> number of PubChem source entries
}
const casValid = (cas) => {
  const d = cas.replace(/-/g, '');
  const check = Number(d.slice(-1));
  const sum = [...d.slice(0, -1)].reverse().reduce((s, ch, i) => s + Number(ch) * (i + 1), 0);
  return sum % 10 === check;
};
const decimals = (s) => (String(s).split('.')[1] || '').length;
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const r2 = (x) => Math.round(x * 100) / 100;

function sequenceStrings(seq, n, c) {
  const three = [...seq].map((a) => mass.RESIDUES[a][0]).join('-');
  const pre = n === 'acetyl' ? 'Ac-' : 'H-';
  const suf = c === 'amide' ? '-NH2' : '-OH';
  return [three, pre + three + suf, seq, pre + seq + suf];
}

function compareMasses(label, pc, comp) {
  const notes = [];
  let ok = true;
  const formulaOk = pc.formula === comp.molecular_formula;
  if (!formulaOk) { ok = false; notes.push(`FLAG: ${label} formula mismatch. PubChem ${pc.formula}, computed ${comp.molecular_formula}.`); }
  const dMono = comp.monoisotopic_mass - pc.mono;
  if (Math.abs(dMono) > TOL) { ok = false; notes.push(`FLAG: ${label} monoisotopic mass differs by ${dMono.toFixed(4)} Da (PubChem ${pc.mono}, computed ${comp.monoisotopic_mass.toFixed(4)}).`); }
  const dAvg = comp.average_mw - Number(pc.mw);
  const half = 0.5 * 10 ** -decimals(pc.mw);
  if (Math.abs(dAvg) > TOL) {
    if (formulaOk && Math.abs(dAvg) <= half + 1e-9) {
      notes.push(`Resolved: ${label} average MW. PubChem reports ${pc.mw} (rounded to ${decimals(pc.mw)} decimal places); computed ${comp.average_mw.toFixed(2)}. The ${Math.abs(dAvg).toFixed(2)} Da difference is PubChem's display rounding: the formulas are identical and the monoisotopic masses agree to ${Math.abs(dMono).toExponential(1)} Da.`);
    } else { ok = false; notes.push(`FLAG: ${label} average MW differs by ${dAvg.toFixed(3)} Da (PubChem ${pc.mw}, computed ${comp.average_mw.toFixed(3)}).`); }
  }
  return { ok, notes, dMono, dAvg };
}

async function build() {
  const rows = [];
  for (const def of COMPOUNDS) {
    process.stderr.write(`${def.id}\n`);
    const notes = [...(def.notes || [])];
    const sources = {};

    // 1. name lookups and CAS
    const lookups = [];
    for (const n of def.lookup) lookups.push({ name: n, url: urls.name(n), cids: await cidsFor(n) });
    sources.pubchem_name_lookups = lookups;

    const pc = await props(def.cid);
    sources.pubchem_properties = urls.props(def.cid);
    const syn = await synonyms(def.cid);
    sources.pubchem_synonyms = urls.syn(def.cid);
    const view = await casFromView(def.cid);
    sources.pubchem_cas_section = urls.casView(def.cid);

    const synCas = syn.filter((s) => /^\d{2,7}-\d{2}-\d$/.test(s));
    const viewCas = Object.keys(view).sort((a, b) => view[b] - view[a]);
    const cas = viewCas[0] || synCas[0] || null;
    if (cas && !casValid(cas)) notes.push(`FLAG: CAS ${cas} fails the CAS check-digit test.`);
    const extraCas = [...new Set([...synCas, ...viewCas])].filter((x) => x !== cas);
    for (const x of extraCas) {
      notes.push(view[x]
        ? `PubChem's CAS section also lists ${x} for this record (${view[x]} source entr${view[x] === 1 ? 'y' : 'ies'}, against ${view[cas]} for ${cas}); ${cas} is used.`
        : `The CAS-format string ${x} appears in this record's synonym list but not in PubChem's CAS section; ${cas} is used.`);
    }
    let casLookup = null;
    if (cas) {
      casLookup = { name: cas, url: urls.name(cas), cids: await cidsFor(cas) };
      sources.pubchem_cas_lookup = casLookup;
      if (!casLookup.cids.includes(def.cid)) notes.push(`FLAG: CAS ${cas} does not resolve to CID ${def.cid} (resolves to ${casLookup.cids.join(', ') || 'nothing'}).`);
    }
    for (const l of lookups) {
      if ((def.notes || []).some((x) => x.includes(`name lookup "${l.name}"`))) continue; // already explained by hand
      if (!l.cids.length) notes.push(`PubChem name lookup "${l.name}" returns no record.`);
      else if (!l.cids.includes(def.cid)) notes.push(`PubChem name lookup "${l.name}" returns CID ${l.cids.join(', ')}, not the CID used here (${def.cid}).`);
      else if (l.cids.length > 1) notes.push(`PubChem name lookup "${l.name}" returns ${l.cids.length} CIDs (${l.cids.join(', ')}); ${def.cid} is the one used.`);
    }

    // synonyms: keep only ones PubChem actually lists for this record
    const synLower = new Set(syn.map((s) => s.toLowerCase()));
    const synOk = def.synonyms.filter((s) => synLower.has(s.toLowerCase()));
    const synMissing = def.synonyms.filter((s) => !synLower.has(s.toLowerCase()));
    if (synMissing.length) notes.push(`FLAG: synonym(s) not found in PubChem's list and dropped: ${synMissing.join('; ')}.`);

    const row = {
      id: def.id,
      name: def.name,
      compound_type: def.type,
      is_peptide: !!def.sequence,
      form: def.form,
      synonyms: synOk,
      sequence_one_letter: null,
      sequence_three_letter: null,
      residue_count: null,
      modifications: null,
      molecular_formula: pc.formula,
      average_mw: Number(pc.mw),
      monoisotopic_mass: pc.mono,
      charge: pc.charge,
      pubchem_cid: def.cid,
      pubchem_title: pc.title,
      cas,
      computed: null,
      pubchem_match: null,
      related_pubchem_records: [],
      variants: [],
      vortex_links: [],
      notes: null,
      sources,
    };

    // 2. sequence check and computed values
    let comp;
    if (def.sequence) {
      comp = mass.peptide(def.sequence, { n: def.n, c: def.c, complex: def.complex || 'none' });
      row.sequence_one_letter = comp.sequence_one_letter;
      row.sequence_three_letter = comp.sequence_three_letter;
      row.residue_count = comp.residue_count;
      row.modifications = {
        n_terminus: mass.N_TERM[def.n].label,
        c_terminus: mass.C_TERM[def.c].label,
        other: def.complex ? mass.COMPLEX[def.complex].label : null,
      };
      const seqSources = [];
      const candidates = sequenceStrings(def.sequence, def.n, def.c).map((s) => s.toLowerCase());
      const hit = syn.find((s) => candidates.includes(s.toLowerCase()));
      if (hit) seqSources.push({ source: 'PubChem synonym', value: hit, url: urls.syn(def.cid) });
      if (def.seq_synonym && synLower.has(def.seq_synonym.toLowerCase())) seqSources.push({ source: 'PubChem synonym (systematic name)', value: def.seq_synonym, url: urls.syn(def.cid) });
      if (def.uniprot) {
        const r = await get(urls.uniprot(def.uniprot.acc), { json: false });
        let u = r.body.split('\n').filter((l) => !l.startsWith('>')).join('').trim();
        if (def.uniprot.strip_initiator_met && u.startsWith('M')) u = u.slice(1);
        if (u === def.sequence) seqSources.push({ source: `UniProt ${def.uniprot.acc}`, value: u, url: urls.uniprot(def.uniprot.acc) });
        else notes.push(`FLAG: UniProt ${def.uniprot.acc} sequence (${u}) differs from ${def.sequence}.`);
      }
      if (!seqSources.length) notes.push('FLAG: sequence not confirmed by a PubChem synonym or UniProt.');
      sources.sequence = seqSources;
      sources.sequence_note = 'Modifications follow the same sources; the formula check below confirms them against PubChem.';
    } else {
      comp = mass.fromFormula(pc.formula);
      // independent formula derivation from fragment records
      const d = def.derive;
      let sum = {};
      const parts = [];
      for (const [cid, k] of d.parts) {
        const p = await props(cid);
        parts.push({ cid, title: p.title, formula: p.formula, url: urls.props(cid) });
        const f = mass.parseFormula(p.formula);
        for (let i = 0; i < k; i++) sum = Object.entries(f.comp).reduce((acc, [e, x]) => ({ ...acc, [e]: (acc[e] || 0) + x }), sum);
      }
      for (const [e, x] of Object.entries(d.add || {})) sum[e] = (sum[e] || 0) + x;
      for (const [e, x] of Object.entries(d.subtract || {})) sum[e] = (sum[e] || 0) - x;
      const derived = mass.formulaString(sum, d.charge || 0);
      sources.formula_derivation = { method: d.label, parts, result: derived };
      if (derived !== pc.formula) notes.push(`FLAG: independent formula derivation (${d.label}) gives ${derived}, PubChem gives ${pc.formula}.`);
    }

    const cmp = compareMasses('Main record', { formula: pc.formula, mw: pc.mw, mono: pc.mono }, comp);
    notes.push(...cmp.notes);
    if (comp.charge !== pc.charge) { cmp.ok = false; notes.push(`FLAG: charge mismatch (PubChem ${pc.charge}, computed ${comp.charge}).`); }
    row.computed = {
      molecular_formula: comp.molecular_formula,
      average_mw: r2(comp.average_mw),
      monoisotopic_mass: r4(comp.monoisotopic_mass),
      delta_average_mw: r4(cmp.dAvg),
      delta_monoisotopic_mass: Number(cmp.dMono.toExponential(2)),
      basis: def.sequence ? 'sequence + modifications (scripts/mass.js)' : 'PubChem formula (scripts/mass.js); formula checked by fragment sum',
    };
    row.pubchem_match = cmp.ok;

    // 3. related records and variants
    for (const rel of def.related || []) {
      const p = await props(rel.cid);
      const syn2 = await synonyms(rel.cid);
      const relCas = syn2.filter((s) => /^\d{2,7}-\d{2}-\d$/.test(s));
      const entry = { cid: rel.cid, relation: rel.relation, molecular_formula: p.formula, average_mw: Number(p.mw), monoisotopic_mass: p.mono, charge: p.charge, cas: relCas, source: urls.props(rel.cid) };
      if (rel.expect_add) {
        const base = mass.parseFormula(pc.formula);
        let c2 = { ...base.comp };
        for (const [e, x] of Object.entries(rel.expect_add)) c2[e] = (c2[e] || 0) + x;
        const exp = mass.formulaString(c2, rel.expect_charge ?? base.charge);
        entry.formula_check = exp === p.formula ? `matches main record + ${mass.formulaString(rel.expect_add)}` : `FLAG: expected ${exp}`;
        if (exp !== p.formula) notes.push(`FLAG: related CID ${rel.cid} formula ${p.formula} is not main record + ${mass.formulaString(rel.expect_add)}.`);
      }
      row.related_pubchem_records.push(entry);
    }
    for (const v of def.variants || []) {
      const p = await props(v.cid);
      const vc = mass.peptide(v.sequence, { n: v.n, c: v.c });
      const vcmp = compareMasses(`Variant CID ${v.cid}`, { formula: p.formula, mw: p.mw, mono: p.mono }, vc);
      notes.push(...vcmp.notes.filter((x) => x.startsWith('FLAG')));
      row.variants.push({
        label: v.label, pubchem_cid: v.cid, sequence_three_letter: vc.sequence_three_letter, molecular_formula: p.formula,
        average_mw: Number(p.mw), monoisotopic_mass: p.mono,
        computed_formula: vc.molecular_formula, computed_monoisotopic_mass: r4(vc.monoisotopic_mass),
        pubchem_match: vcmp.ok, source: urls.props(v.cid),
      });
    }

    // 4. Vortex links: keep only HTTP 200
    for (const u of def.vortex) {
      const r = await fetch(u, { headers: { 'User-Agent': UA }, redirect: 'manual' });
      if (r.status === 200) row.vortex_links.push(u);
      else notes.push(`Vortex link ${u} returned HTTP ${r.status} at build time and was left out.`);
    }

    row.notes = notes;
    rows.push(row);
  }
  return rows;
}

function toCsv(rows) {
  const cols = [
    ['id', (r) => r.id], ['name', (r) => r.name], ['compound_type', (r) => r.compound_type], ['form', (r) => r.form],
    ['synonyms', (r) => r.synonyms.join('; ')],
    ['sequence_one_letter', (r) => r.sequence_one_letter], ['sequence_three_letter', (r) => r.sequence_three_letter],
    ['residue_count', (r) => r.residue_count],
    ['n_terminus', (r) => r.modifications && r.modifications.n_terminus], ['c_terminus', (r) => r.modifications && r.modifications.c_terminus],
    ['other_modification', (r) => r.modifications && r.modifications.other],
    ['molecular_formula', (r) => r.molecular_formula], ['average_mw', (r) => r.average_mw], ['monoisotopic_mass', (r) => r.monoisotopic_mass],
    ['charge', (r) => r.charge], ['pubchem_cid', (r) => r.pubchem_cid], ['cas', (r) => r.cas],
    ['computed_formula', (r) => r.computed.molecular_formula], ['computed_average_mw', (r) => r.computed.average_mw],
    ['computed_monoisotopic_mass', (r) => r.computed.monoisotopic_mass], ['pubchem_match', (r) => r.pubchem_match],
    ['variants', (r) => r.variants.map((v) => `${v.label}: CID ${v.pubchem_cid}, ${v.molecular_formula}`).join('; ')],
    ['related_pubchem_cids', (r) => r.related_pubchem_records.map((x) => x.cid).join('; ')],
    ['source_pubchem_properties', (r) => r.sources.pubchem_properties], ['source_pubchem_synonyms', (r) => r.sources.pubchem_synonyms],
    ['source_pubchem_cas_section', (r) => r.sources.pubchem_cas_section],
    ['source_pubchem_cas_lookup', (r) => r.sources.pubchem_cas_lookup && r.sources.pubchem_cas_lookup.url],
    ['source_sequence', (r) => (r.sources.sequence || []).map((s) => s.url).join('; ')],
    ['vortex_links', (r) => r.vortex_links.join('; ')],
    ['notes', (r) => r.notes.join(' | ')],
  ];
  const esc = (v) => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.map((c) => c[0]).join(','), ...rows.map((r) => cols.map((c) => esc(c[1](r))).join(','))].join('\n') + '\n';
}

(async () => {
  const rows = await build();
  const meta = {
    name: 'Vortex Research peptide identity reference',
    description: 'Sequence, formula, mass, PubChem CID and CAS identity data for compounds Vortex Research publishes lot reports for.',
    url: 'https://vrtx-research.github.io/peptide-identity-reference/',
    generated: new Date().toISOString().slice(0, 10),
    license: 'CC BY 4.0 (data), MIT (scripts)',
    mass_conventions: {
      average_mw: 'PubChem MolecularWeight as reported (PubChem rounds it). computed.average_mw uses IUPAC 2005 standard atomic weights.',
      monoisotopic_mass: 'PubChem MonoisotopicMass. computed.monoisotopic_mass uses NIST most-abundant-isotope masses. Charged records: neutral-atom sum, no electron-mass correction (same as PubChem).',
      tolerance_da: TOL,
    },
    research_use: 'Identity reference data for laboratory research materials. Not for human or veterinary use.',
  };
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'data', 'peptide_identity.json'), JSON.stringify({ meta, compounds: rows }, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'data', 'peptide_identity.csv'), toCsv(rows));
  for (const r of rows) {
    const flags = r.notes.filter((n) => n.startsWith('FLAG')).length;
    console.log(`${r.id.padEnd(16)} ${String(r.molecular_formula).padEnd(20)} mono ${String(r.monoisotopic_mass).padEnd(14)} CID ${String(r.pubchem_cid).padEnd(10)} CAS ${String(r.cas).padEnd(13)} match ${r.pubchem_match} flags ${flags}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
