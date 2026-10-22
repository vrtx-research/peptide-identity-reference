#!/usr/bin/env node
// Development build tool (not a user-facing calculator).
// Computes the molecular formula, average molecular weight and monoisotopic mass of a linear peptide
// from its one-letter sequence plus terminal/complex modifications, or the masses of a given formula.
// No dependencies. Used by scripts/build.js to cross-check every row against PubChem.
//
//   node scripts/mass.js GEPPPGKPADDAGLV
//   node scripts/mass.js LKKTETQ --n=acetyl
//   node scripts/mass.js GHK --complex=cu1
//   node scripts/mass.js --formula=C21H27N7O14P2
//   node scripts/mass.js --selftest
//
// Sources
// - Residue elemental compositions (amino acid minus H2O) and three-letter codes: Unimod amino acid table,
//   https://www.unimod.org/xml/unimod.xml (<umod:amino_acids>). All 20 compositions below, and the residue
//   masses they give, were checked against that file (UNIMOD_RESIDUE_MASSES below; run --selftest).
//   One-/three-letter codes follow IUPAC-IUB, https://iupac.qmul.ac.uk/AminoAcid/ (1983).
// - Average (standard) atomic weights: IUPAC "Atomic weights of the elements 2005", Wieser ME,
//   Pure Appl. Chem. 2006;78(11):2051-2066, https://doi.org/10.1351/pac200678112051. These are the values
//   PubChem's MolecularWeight matches (e.g. C 12.0107, H 1.00794); see the cross-check in build.js.
// - Monoisotopic masses of the most abundant isotopes: NIST Atomic Weights and Isotopic Compositions
//   (Coursey et al.), https://www.nist.gov/pml/atomic-weights-and-isotopic-compositions-relative-atomic-masses
// Convention: masses are sums of neutral-atom masses. For a charged record (e.g. a cation) no electron-mass
// correction is applied, which is also what PubChem's MonoisotopicMass does.
'use strict';

const AVERAGE = { C: 12.0107, H: 1.00794, N: 14.0067, O: 15.9994, S: 32.065, P: 30.973762, Cu: 63.546, I: 126.90447, F: 18.9984032 };
const MONO = { C: 12, H: 1.00782503223, N: 14.00307400443, O: 15.99491461957, S: 31.9720711744, P: 30.97376199842, Cu: 62.92959772, I: 126.9044719, F: 18.99840316273 };

// Unimod's published residue masses [monoisotopic, average], copied from unimod.xml, used only by --selftest.
const UNIMOD_RESIDUE_MASSES = {
  G: [57.021464, 57.0513], A: [71.037114, 71.0779], S: [87.032028, 87.0773], P: [97.052764, 97.1152],
  V: [99.068414, 99.1311], T: [101.047679, 101.1039], C: [103.009185, 103.1429], L: [113.084064, 113.1576],
  I: [113.084064, 113.1576], N: [114.042927, 114.1026], D: [115.026943, 115.0874], Q: [128.058578, 128.1292],
  K: [128.094963, 128.1723], E: [129.042593, 129.114], M: [131.040485, 131.1961], H: [137.058912, 137.1393],
  F: [147.068414, 147.1739], R: [156.101111, 156.1857], Y: [163.063329, 163.1733], W: [186.079313, 186.2099],
};

// Residue = amino acid minus H2O (in-chain composition).
const RESIDUES = {
  G: ['Gly', { C: 2, H: 3, N: 1, O: 1 }],
  A: ['Ala', { C: 3, H: 5, N: 1, O: 1 }],
  S: ['Ser', { C: 3, H: 5, N: 1, O: 2 }],
  P: ['Pro', { C: 5, H: 7, N: 1, O: 1 }],
  V: ['Val', { C: 5, H: 9, N: 1, O: 1 }],
  T: ['Thr', { C: 4, H: 7, N: 1, O: 2 }],
  C: ['Cys', { C: 3, H: 5, N: 1, O: 1, S: 1 }],
  L: ['Leu', { C: 6, H: 11, N: 1, O: 1 }],
  I: ['Ile', { C: 6, H: 11, N: 1, O: 1 }],
  N: ['Asn', { C: 4, H: 6, N: 2, O: 2 }],
  D: ['Asp', { C: 4, H: 5, N: 1, O: 3 }],
  Q: ['Gln', { C: 5, H: 8, N: 2, O: 2 }],
  K: ['Lys', { C: 6, H: 12, N: 2, O: 1 }],
  E: ['Glu', { C: 5, H: 7, N: 1, O: 3 }],
  M: ['Met', { C: 5, H: 9, N: 1, O: 1, S: 1 }],
  H: ['His', { C: 6, H: 7, N: 3, O: 1 }],
  F: ['Phe', { C: 9, H: 9, N: 1, O: 1 }],
  R: ['Arg', { C: 6, H: 12, N: 4, O: 1 }],
  Y: ['Tyr', { C: 9, H: 9, N: 1, O: 2 }],
  W: ['Trp', { C: 11, H: 10, N: 2, O: 1 }],
};

// Modifications as composition deltas.
const N_TERM = {
  free: { label: 'free amine (H-)', delta: { H: 1 } },
  acetyl: { label: 'N-acetyl (Ac-)', delta: { C: 2, H: 3, O: 1 } }, // CH3CO- replaces H: net +C2H2O vs free
};
const C_TERM = {
  acid: { label: 'free acid (-OH)', delta: { O: 1, H: 1 } },
  amide: { label: 'C-amide (-NH2)', delta: { N: 1, H: 2 } },
};
const COMPLEX = {
  none: null,
  // 1:1 Cu(II) complex with one proton removed, overall charge +1 (the PubChem "prezatide copper" record form).
  cu1: { label: 'Cu(II) 1:1 complex, one H removed, charge +1', delta: { Cu: 1, H: -1 }, charge: 1 },
};


function add(a, b, k = 1) {
  const out = { ...a };
  for (const [el, n] of Object.entries(b)) out[el] = (out[el] || 0) + k * n;
  for (const el of Object.keys(out)) if (out[el] === 0) delete out[el];
  return out;
}

// Hill-order formula string (C, H, then alphabetical), the order PubChem uses.
function formulaString(comp, charge = 0) {
  const els = Object.keys(comp).filter((e) => comp[e]);
  const hasC = els.includes('C');
  els.sort((a, b) => {
    if (hasC) {
      if (a === 'C') return -1; if (b === 'C') return 1;
      if (a === 'H') return -1; if (b === 'H') return 1;
    }
    return a.localeCompare(b);
  });
  const s = els.map((e) => e + (comp[e] === 1 ? '' : comp[e])).join('');
  return s + (charge > 0 ? (charge === 1 ? '+' : '+' + charge) : charge < 0 ? (charge === -1 ? '-' : '-' + -charge) : '');
}

function parseFormula(f) {
  // PubChem style: element counts, then an optional charge suffix "+", "-", "+2" or "-2".
  const m = /^((?:[A-Z][a-z]?\d*)+)(?:([+-])(\d*))?$/.exec(f.trim());
  if (!m) throw new Error('Bad formula: ' + f);
  const comp = {};
  for (const [, el, n] of m[1].matchAll(/([A-Z][a-z]?)(\d*)/g)) comp[el] = (comp[el] || 0) + (n ? Number(n) : 1);
  const charge = m[2] ? (m[3] ? Number(m[3]) : 1) * (m[2] === '+' ? 1 : -1) : 0;
  return { comp, charge };
}

function masses(comp) {
  let avg = 0; let mono = 0;
  for (const [el, n] of Object.entries(comp)) {
    if (!(el in AVERAGE) || !(el in MONO)) throw new Error('No mass for element ' + el);
    avg += AVERAGE[el] * n; mono += MONO[el] * n;
  }
  return { average_mw: avg, monoisotopic_mass: mono };
}

function peptide(seq, { n = 'free', c = 'acid', complex = 'none' } = {}) {
  seq = seq.toUpperCase();
  let comp = {};
  for (const aa of seq) {
    if (!RESIDUES[aa]) throw new Error('Unknown residue ' + aa);
    comp = add(comp, RESIDUES[aa][1]);
  }
  comp = add(comp, N_TERM[n].delta);
  comp = add(comp, C_TERM[c].delta);
  let charge = 0;
  if (COMPLEX[complex]) { comp = add(comp, COMPLEX[complex].delta); charge = COMPLEX[complex].charge; }
  const three = [...seq].map((aa) => RESIDUES[aa][0]).join('-');
  const nPre = n === 'acetyl' ? 'Ac-' : 'H-';
  const cSuf = c === 'amide' ? '-NH2' : '-OH';
  return {
    sequence_one_letter: seq,
    sequence_three_letter: nPre + three + cSuf,
    residue_count: seq.length,
    composition: comp,
    charge,
    molecular_formula: formulaString(comp, charge),
    ...masses(comp),
  };
}

function fromFormula(f) {
  const { comp, charge } = parseFormula(f);
  return { composition: comp, charge, molecular_formula: formulaString(comp, charge), ...masses(comp) };
}

// Known values used to test this file: PubChem's own records for two simple peptides.
function selftest() {
  const cases = [
    ['GHK', {}, 'C14H24N6O4', 340.18590327], // PubChem CID 73587
    ['MEHFPGP', {}, 'C37H51N9O10S', 813.34796003], // PubChem CID 9811102
  ];
  let ok = true;
  for (const [aa, [mono, avg]] of Object.entries(UNIMOD_RESIDUE_MASSES)) {
    const r = masses(RESIDUES[aa][1]);
    const pass = Math.abs(r.monoisotopic_mass - mono) < 2e-6 && Math.abs(r.average_mw - avg) < 2e-4;
    ok = ok && pass;
    if (!pass) console.log(`FAIL residue ${aa}: ${r.monoisotopic_mass} ${r.average_mw} vs Unimod ${mono} ${avg}`);
  }
  console.log(`residues: 20 checked against Unimod`);
  for (const [s, o, f, mono] of cases) {
    const r = peptide(s, o);
    const pass = r.molecular_formula === f && Math.abs(r.monoisotopic_mass - mono) < 1e-4;
    ok = ok && pass;
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${s} ${r.molecular_formula} ${r.monoisotopic_mass.toFixed(5)}`);
  }
  process.exitCode = ok ? 0 : 1;
}

module.exports = { peptide, fromFormula, parseFormula, formulaString, masses, RESIDUES, N_TERM, C_TERM, COMPLEX, AVERAGE, MONO };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
  const seq = args.find((a) => !a.startsWith('--'));
  if (opt.selftest) selftest();
  else if (opt.formula) console.log(JSON.stringify(fromFormula(opt.formula), null, 2));
  else if (seq) console.log(JSON.stringify(peptide(seq, { n: opt.n || 'free', c: opt.c || 'acid', complex: opt.complex || 'none' }), null, 2));
  else console.log('usage: node scripts/mass.js <SEQUENCE> [--n=free|acetyl] [--c=acid|amide] [--complex=cu1] | --formula=<F> | --selftest');
}
