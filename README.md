# Vortex Research peptide identity reference

Identity data for the compounds that [Vortex Research](https://vortexresearch.net/) publishes lot reports for: one- and three-letter sequence, terminal modifications, molecular formula, average molecular weight, monoisotopic mass, residue count, PubChem CID and CAS number.

Two rules shape every row. First, each PubChem value is stored with the exact PUG REST query URL that returned it. Second, each peptide formula and mass is recomputed from the sequence by [`scripts/mass.js`](scripts/mass.js) and compared with PubChem. A formula that differs, or a mass that differs by more than 0.05 Da, is either explained in the row's `notes` or flagged there. Nothing is silently chosen.

Browse it as a web page at [vrtx-research.github.io/peptide-identity-reference](https://vrtx-research.github.io/peptide-identity-reference/). The lot reports are on the [Vortex Research lab report page](https://vortexresearch.net/coa/) and in the companion [lot report dataset](https://vrtx-research.github.io/coa-dataset/).

> **Research use only.** Vortex Research materials are sold for in-vitro laboratory research by qualified researchers. Not for human or veterinary use. Not a drug, dietary supplement or cosmetic. Statements have not been evaluated by the FDA. This repository holds identity data only: what each molecule is, not what it does.

## Records (built 2026-10-22)

| Compound | Sequence | Residues | Termini | Formula (PubChem) | Avg MW (PubChem) | Avg MW (computed) | Monoisotopic | PubChem CID | CAS | Match |
|---|---|---|---|---|---|---|---|---|---|---|
| BPC-157 | `GEPPPGKPADDAGLV` | 15 | free amine, free acid | `C62H98N16O22` | 1419.5 | 1419.54 | 1418.7042 | 9941957 | 137525-51-0 | yes |
| TB-500 | `LKKTETQ` | 7 | N-acetyl, free acid | `C38H68N10O14` | 889.0 | 889.01 | 888.4916 | 62707662 | 885340-08-9 | yes |
| Thymosin beta-4 (Tβ4) | `SDKPDMAEIEKFDKSKLKKTETQEKNPLPSKETIEQEKQAGES` | 43 | N-acetyl, free acid | `C212H350N56O78S` | 4963 | 4963.44 | 4960.4863 | 16132341 | 77591-33-4 | yes |
| GHK (free tripeptide) | `GHK` | 3 | free amine, free acid | `C14H24N6O4` | 340.38 | 340.38 | 340.1859 | 73587 | 49557-75-7 | yes |
| GHK-Cu (copper complex) | `GHK` | 3 | free amine, free acid; Cu(II) 1:1, charge +1 | `C14H23CuN6O4+` | 402.92 | 402.92 | 402.1077 | 71587328 | 89030-95-5 | yes |
| KPV | `KPV` | 3 | free amine, free acid | `C16H30N4O4` | 342.43 | 342.43 | 342.2267 | 125672 | 67727-97-3 | yes |
| MOTS-c | `MRWQEMGYIFYPRKLR` | 16 | free amine, free acid | `C101H152N28O22S2` | 2174.6 | 2174.59 | 2173.1077 | 146675088 | 1627580-64-6 | yes |
| Selank | `TKPRPGP` | 7 | free amine, free acid | `C33H57N11O9` | 751.9 | 751.87 | 751.4341 | 11765600 | 129954-34-3 | yes |
| Semax | `MEHFPGP` | 7 | free amine, free acid | `C37H51N9O10S` | 813.9 | 813.92 | 813.3480 | 9811102 | 80714-61-0 | yes |
| NAD+ (non-peptide) | – | – | – | `C21H27N7O14P2` | 663.4 | 663.43 | 663.1091 | 5892 | 53-84-9 | yes |
| 5-Amino-1MQ (non-peptide) | – | – | – | `C10H11N2+` | 159.21 | 159.21 | 159.0922 | 950107 | 685079-15-6 | yes |

"Match" means the recomputed formula is identical to PubChem's and both masses agree within 0.05 Da, or the only difference is PubChem's display rounding (thymosin beta-4: PubChem rounds its MW to 4963; the formulas are identical and the monoisotopic masses agree to 1e-7 Da). Three-letter sequences, variants, related PubChem records and all notes are in the data files.

NAD+ and 5-Amino-1MQ are small molecules, not peptides. They have no sequence; their formulas are checked instead by an independent fragment sum (ADP-ribose + nicotinamide − H2O, and 5-aminoquinoline + a ring N-methyl group).

## TB-500 and thymosin beta-4 are different molecules

Thymosin beta-4 (Tβ4, INN timbetasin) is a 43-residue chain with an acetylated N-terminus: `C212H350N56O78S`, about 4963 g/mol, CAS 77591-33-4. The sequence here is UniProt P62328 with the initiator methionine removed, so residue 1 is the acetylated serine.

"TB-500" is a market name, not a systematic one. In PubChem it resolves to CID 62707662, Ac-LKKTETQ-OH: the seven-residue N-acetylated stretch that matches residues 17-23 of the Tβ4 chain, `C38H68N10O14`, about 889 g/mol, CAS 885340-08-9. The same seven residues without the acetyl group are a separate record (CID 10169788, `C36H66N10O13`, 42.01 Da lighter).

Some supplier listings pair the name TB-500 with the full Tβ4 identity (CAS 77591-33-4, about 4963 g/mol). The two candidates differ by more than 4000 Da, so a mass measurement settles which one a material contains. This dataset keeps them as two rows and never merges the names.

## Files

| File | What it holds |
|---|---|
| [`data/peptide_identity.json`](data/peptide_identity.json) | All fields, query URLs, related PubChem records, variants and a `meta` block. |
| [`data/peptide_identity.csv`](data/peptide_identity.csv) | One row per record, spreadsheet-friendly. Lists are `; `-separated, notes ` \| `-separated. |
| [`scripts/build.js`](scripts/build.js) | Rebuilds both data files from PubChem (and UniProt for two sequences), using `mass.js` for the cross-check. Node 18+, no dependencies. |
| [`scripts/mass.js`](scripts/mass.js) | Development build tool: formula, average MW and monoisotopic mass from a sequence plus modifications. |
| [`scripts/site.js`](scripts/site.js) | Rebuilds the GitHub Pages view in `docs/` from the JSON. |

## Fields

| Field | Meaning |
|---|---|
| `id`, `name` | Row key and display name. |
| `compound_type`, `is_peptide` | `peptide`, `peptide (metal complex)` or `small molecule (non-peptide)`. |
| `form` | What the PubChem record describes, e.g. free peptide without counter-ions, or a cation. |
| `synonyms` | Selected names. Each one is checked to appear in PubChem's synonym list for the CID. |
| `sequence_one_letter`, `sequence_three_letter` | Sequence N to C. The three-letter form includes the termini (`H-`/`Ac-`, `-OH`/`-NH2`). |
| `residue_count` | Number of amino acid residues. |
| `modifications` | `n_terminus`, `c_terminus` and `other` (e.g. the copper complex). |
| `molecular_formula`, `average_mw`, `monoisotopic_mass`, `charge` | PubChem MolecularFormula, MolecularWeight (as PubChem rounds it), MonoisotopicMass and Charge. |
| `pubchem_cid`, `pubchem_title` | The PubChem compound record used. Chosen by CAS resolution, not by short name. |
| `cas` | CAS Registry Number from PubChem's CAS section (the entry with the most sources), check digit validated. |
| `computed` | `mass.js` results: formula, average MW, monoisotopic mass, and the difference from PubChem. |
| `pubchem_match` | `true` when the computed formula equals PubChem's and both masses agree (see above). |
| `related_pubchem_records` | Other PubChem records for the same compound (salts, other copper ratios), with formula checks. |
| `variants` | Differently modified forms sold under related names, each with its own CID and a formula check. |
| `vortex_links` | Vortex Research pages for the compound. Only pages that returned HTTP 200 at build time. |
| `notes` | Every disagreement, rounding explanation, naming issue and flag. |
| `sources` | The exact query URLs behind every non-computed value: name lookups, CAS lookup, properties, synonyms, CAS section, sequence sources, formula derivation. |

## How the masses are computed

`scripts/mass.js` sums residue compositions (amino acid minus water, checked against the [Unimod](https://www.unimod.org/) amino acid table for all 20 residues), adds water for the free termini, then applies modifications: N-acetyl adds C2H2O, C-amide swaps OH for NH2, and the copper complex adds Cu and removes one H.

- **Monoisotopic mass** uses the masses of the most abundant isotopes (NIST). It agrees with PubChem to better than 0.0001 Da on every row. For charged records it is a neutral-atom sum with no electron-mass correction, the same convention PubChem uses.
- **Average MW** uses the IUPAC 2005 standard element values (C 12.0107, H 1.00794, N 14.0067, O 15.9994, S 32.065; Wieser 2006, doi:10.1351/pac200678112051), which reproduce PubChem's values. Current IUPAC abridged values (C 12.011, H 1.008, N 14.007, O 15.999, S 32.06) give slightly higher averages, for example BPC-157 1419.56, MOTS-c 2174.62 and Tβ4 4963.51 g/mol. A listing that differs from PubChem by a few hundredths of a dalton is usually using that newer table; the monoisotopic mass does not change.

```
node scripts/mass.js --selftest          # 20 residues vs Unimod, two peptides vs PubChem
node scripts/mass.js LKKTETQ --n=acetyl  # Ac-LKKTETQ-OH -> C38H68N10O14
node scripts/mass.js GHK --complex=cu1   # -> C14H23CuN6O4+
```

## Flags and source disagreements

These are recorded in the rows' `notes`. Lines starting "FLAG (PubChem data, not this row)" describe problems inside PubChem records that this dataset does not use.

- **KPV:** PubChem's name lookup for "KPV" returns CID 13294447, an unrelated compound (2-oxo-5-phenylpentanoic acid). The tripeptide is CID 125672, which its CAS number resolves to.
- **GHK and GHK-Cu:** "GHK-Cu" returns six PubChem records, including the copper-free tripeptide, whose synonym list carries the name GHK-Cu. PubChem draws the copper complex several ways (1:1 cation, neutral and anion; 2:1), so GHK-Cu has no single formula or MW. CAS 89030-95-5 resolves to the 1:1 cation record used here; that record's systematic synonyms name the neutral form, one hydrogen lighter.
- **Thymosin beta-4:** two PubChem records share the formula; the name lookup returns the one without a CAS or defined stereocentres, and the CAS resolves to CID 16132341 (timbetasin), which is used.
- **MOTS-c:** UniProt and PubChem both give 16 residues; no length disagreement was found. One salt record (CID 172641109) is titled "acetate" but its formula is the trifluoroacetate.
- **Semax and Selank variants:** "N-Acetyl Semax Amidate" (Ac-MEHFPGP-NH2) and "N-Acetyl Selank" (Ac-TKPRPGP-OH) are separate PubChem records with their own formulas. "N-Acetyl Semax" resolves to the same amidated record. "N-Acetyl Selank Amidate" has no PubChem record.
- **5-Amino-1MQ:** the name has no PubChem record. The cation (CID 950107) and the iodide salt (CID 66522933, CAS 42464-96-0, 286.11 g/mol) have different CAS numbers and molecular weights. The iodide record's synonym list includes a "chloride" name that does not match its formula.
- **NAD+:** "NAD+" returns four records (neutral, cation, anion and a duplicate). CID 5892 is used because CAS 53-84-9 resolves to it.

## Verify a row with PubChem

Each row's `sources` block holds the URLs used. To check a row by hand:

1. Resolve the CAS number to a CID. Prefer the CAS over a short name; see the KPV and GHK-Cu flags above.
   ```
   https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/137525-51-0/cids/JSON
   ```
2. Fetch the formula and masses for that CID and compare with the row.
   ```
   https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/9941957/property/MolecularFormula,MolecularWeight,MonoisotopicMass,Charge/JSON
   ```
3. Check the CAS and the sequence string in the synonym list.
   ```
   https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/9941957/synonyms/JSON
   ```
4. Recompute from the sequence: `node scripts/mass.js GEPPPGKPADDAGLV`.

If anything differs, PubChem is the record. Please open an issue so the row can be corrected. To rebuild everything: `node scripts/build.js && node scripts/site.js`.

## Scope

One row per compound that Vortex Research publishes lot reports for, plus thymosin beta-4 and the copper-free GHK tripeptide, which are needed to keep names apart. The lot reports themselves, and which lots have one, are on the [lab report page](https://vortexresearch.net/coa/). Background reading: [What is BPC-157](https://vortexresearch.net/blog/what-is-bpc-157/), [TB-500 vs thymosin beta-4](https://vortexresearch.net/blog/tb-500-vs-thymosin-beta-4/) and [GHK-Cu peptide](https://vortexresearch.net/blog/ghk-cu-peptide/).

## Cite

```
Vortex Research (2026). Peptide identity reference [Data set].
https://vrtx-research.github.io/peptide-identity-reference/
```

## License

Data (`data/`): [CC BY 4.0](LICENSE). Credit "Vortex Research peptide identity reference" with a link to https://vrtx-research.github.io/peptide-identity-reference/. Scripts (`scripts/`): MIT. PubChem and UniProt data are used under their own open terms; see the LICENSE file.
