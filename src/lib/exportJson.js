/**
 * src/lib/exportJson.js
 * ----------------------------------------------------------------------------
 * Génère et télécharge une sauvegarde JSON complète (envelopes + movements,
 * tous les champs). Le fichier est réimportable tel quel.
 * ----------------------------------------------------------------------------
 */

export function exporterJson(envelopes, mouvements) {
  // user_id retiré du fichier : l'import le réécrit de toute façon avec
  // l'utilisateur courant, et ça évite de laisser un identifiant de compte
  // dans un fichier qui peut circuler.
  const data = {
    format: 'toms-cabinet-export',
    version: 1,
    exported_at: new Date().toISOString(),
    envelopes: envelopes.map((env) => {
      const e = { ...env }
      delete e.user_id
      return e
    }),
    movements: mouvements,
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const a = document.createElement('a')
  a.href = url
  a.download = `budget-export-${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}