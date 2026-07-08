/**
 * src/lib/exportPdf.js
 * ----------------------------------------------------------------------------
 * Génère et télécharge un rapport PDF lisible (jsPDF).
 * Contenu : date, Patrimoine, à répartir, enveloppes (solde + objectif +
 * 5 derniers mouvements), créances. Couleurs du design system.
 * ----------------------------------------------------------------------------
 */
import { jsPDF } from 'jspdf'
import { calculerSoldes, calculerARepartir } from './calculs'
import { formatEuros } from './formatters'

// Couleurs du design system (tokens.css)
const C = {
  nuit: '#0E1F3A', encre: '#1F1810', encreSec: '#5C5147', encreTer: '#8A8073',
  or: '#B8954A', orFonce: '#8E6F2F', bordeaux: '#5C1A24',
  vert: '#0EA371', rouge: '#E53935', velinFonce: '#E8E1D2',
}

// jsPDF (polices standard) ne gère pas l'espace fine \u202F : on la remplace.
const eur = (x) => formatEuros(x).replace(/\u202F/g, ' ')

function dateLongue(d) {
  return new Intl.DateTimeFormat('fr-BE', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(d)
}
function dateCourte(d) {
  const dd = new Date(d)
  const memeAnnee = dd.getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat('fr-BE', {
    day: 'numeric', month: 'short', ...(memeAnnee ? {} : { year: 'numeric' }),
  }).format(dd)
}

export function exporterPdf(envelopes, mouvements) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PAGE_W = 210, PAGE_H = 297, MARGE = 18
  const LARGEUR = PAGE_W - 2 * MARGE
  let y = MARGE

  const soldes = calculerSoldes(envelopes, mouvements)
  const aRepartir = calculerARepartir(envelopes, mouvements)
  const patrimoine = envelopes.find(e => e.type === 'total')
  const soldeDe = (id) => soldes.get(id) ?? 0

  const enfantsDe = (id) =>
    envelopes.filter(e => e.parent_id === id).sort((a, b) => a.position - b.position)
  const mvsPropres = (id) =>
    mouvements
      .filter(m => !m.is_undone && m.envelope_id === id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // saut de page si plus assez de place
  function saut(h) {
    if (y + h > PAGE_H - MARGE) { doc.addPage(); y = MARGE }
  }

  // --- En-tête ---
  doc.setFont('times', 'italic'); doc.setFontSize(26); doc.setTextColor(C.nuit)
  doc.text("Tom's Cabinet", MARGE, y + 7)
  y += 12
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(C.encreTer)
  doc.text('RELEVE PATRIMONIAL', MARGE, y)
  doc.text(`Etabli le ${dateLongue(new Date())}`, PAGE_W - MARGE, y, { align: 'right' })
  y += 3
  doc.setDrawColor(C.or); doc.setLineWidth(0.4)
  doc.line(MARGE, y, PAGE_W - MARGE, y)
  y += 12

  // --- Synthèse : 2 blocs ---
  const blocW = (LARGEUR - 6) / 2
  doc.setFillColor(C.velinFonce)
  doc.roundedRect(MARGE, y, blocW, 24, 2, 2, 'F')
  doc.roundedRect(MARGE + blocW + 6, y, blocW, 24, 2, 2, 'F')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(C.encreTer)
  doc.text('PATRIMOINE', MARGE + 6, y + 8)
  doc.text('A REPARTIR', MARGE + blocW + 12, y + 8)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  // Un solde nul est neutre (encre), pas « en négatif » (rouge) — cohérent
  // avec le traitement du zéro dans l'app.
  const sp = patrimoine ? soldeDe(patrimoine.id) : 0
  doc.setTextColor(sp > 0 ? C.vert : sp === 0 ? C.encre : C.rouge)
  doc.text(eur(sp), MARGE + 6, y + 18)
  doc.setTextColor(aRepartir > 0 ? C.vert : aRepartir === 0 ? C.encre : C.rouge)
  doc.text(eur(aRepartir), MARGE + blocW + 12, y + 18)
  y += 34

  // --- helper : titre de section ---
  function titreSection(txt) {
    saut(16)
    doc.setFont('times', 'italic'); doc.setFontSize(15); doc.setTextColor(C.nuit)
    doc.text(txt, MARGE, y)
    y += 3
    doc.setDrawColor(C.velinFonce); doc.setLineWidth(0.6)
    doc.line(MARGE, y, PAGE_W - MARGE, y)
    y += 7
  }

  // --- helper : 5 derniers mouvements d'une enveloppe ---
  function dessinerMouvements(id, indent) {
    const mvs = mvsPropres(id).slice(0, 5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
    if (mvs.length === 0) {
      saut(5)
      doc.setTextColor(C.encreTer)
      doc.text('Aucun mouvement', MARGE + indent, y)
      y += 5
      return
    }
    for (const m of mvs) {
      saut(5)
      const positif = ['income', 'allocate', 'creance_add'].includes(m.type)
      doc.setTextColor(C.encreTer)
      doc.text(dateCourte(m.created_at), MARGE + indent, y)
      doc.setTextColor(positif ? C.vert : C.rouge)
      doc.text(`${positif ? '+' : '-'} ${eur(Number(m.amount))}`, MARGE + indent + 26, y)
      if (m.note) {
        doc.setTextColor(C.encreSec)
        const note = doc.splitTextToSize(m.note, LARGEUR - indent - 70)[0]
        doc.text(note, MARGE + indent + 62, y)
      }
      y += 4.5
    }
  }

  // --- helper : une enveloppe + ses sous-cats (récursif) ---
  function dessinerEnveloppe(env, niveau) {
    const indent = (niveau - 2) * 8
    saut(16)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(niveau === 2 ? 11 : 9.5)
    doc.setTextColor(C.encre)
    doc.text(env.title, MARGE + indent, y)
    const solde = soldeDe(env.id)
    doc.setTextColor(solde > 0 ? C.vert : solde === 0 ? C.encre : C.rouge)
    doc.text(eur(solde), PAGE_W - MARGE, y, { align: 'right' })
    y += 5

    if (env.goal_amount) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(C.orFonce)
      doc.text(`Objectif : ${eur(Number(env.goal_amount))}`, MARGE + indent, y)
      y += 4.5
    }

    const enfants = enfantsDe(env.id)
    if (enfants.length === 0) {
      dessinerMouvements(env.id, indent + 4)
    }
    y += 3
    for (const e of enfants) dessinerEnveloppe(e, niveau + 1)
  }

  // --- Section Enveloppes ---
  titreSection('Enveloppes')
  const racines = envelopes
    .filter(e => e.type === 'normal' && !e.parent_id)
    .sort((a, b) => a.position - b.position)
  if (racines.length === 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(C.encreTer)
    doc.text('Aucune enveloppe.', MARGE, y); y += 8
  } else {
    for (const r of racines) dessinerEnveloppe(r, 2)
  }
  y += 4

  // --- Section Créances ---
  const creances = envelopes
    .filter(e => e.type === 'creance')
    .sort((a, b) => a.position - b.position)
  if (creances.length > 0) {
    titreSection('Creances')
    for (const c of creances) {
      saut(16)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(C.encre)
      doc.text(c.title, MARGE, y)
      doc.setTextColor(C.bordeaux)
      doc.text(eur(soldeDe(c.id)), PAGE_W - MARGE, y, { align: 'right' })
      y += 5
      dessinerMouvements(c.id, 4)
      y += 3
    }
  }

  // --- Pied de page sur chaque page ---
  const nb = doc.getNumberOfPages()
  for (let i = 1; i <= nb; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(C.encreTer)
    doc.text("Tom's Cabinet", MARGE, PAGE_H - 10)
    doc.text(`Page ${i} / ${nb}`, PAGE_W - MARGE, PAGE_H - 10, { align: 'right' })
  }

  doc.save(`budget-rapport-${new Date().toISOString().slice(0, 10)}.pdf`)
}