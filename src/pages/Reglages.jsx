/**
 * src/pages/Reglages.jsx — version Bloc H
 * ----------------------------------------------------------------------------
 * Compte (déconnexion) + Apparence (dark mode) + Stats + Export (JSON / PDF)
 * + Réimport (avec confirmation).
 * ----------------------------------------------------------------------------
 */
import { useState, useRef, useMemo } from 'react'
import { LogOut, Download, Upload, FileJson, FileText, RotateCcw, Sun, Moon, TrendingUp, Layers, Calendar, Wallet, ArrowDownCircle, ArrowUpCircle, Activity } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useApp } from '../hooks/useApp'
import { useToast } from '../hooks/useToast'
import { useTheme } from '../hooks/useTheme'
import PopupConfirmation from '../components/PopupConfirmation'
import { exporterJson } from '../lib/exportJson'
import { exporterPdf } from '../lib/exportPdf'
import { lireFichierJson, validerImport, appliquerImport } from '../lib/importJson'
import { remettreAZero } from '../lib/mutations'
import { formatEuros } from '../lib/formatters'

// Bouton réutilisable, style cohérent design system
function BoutonReglage({ onClick, disabled, children, icon: Icon, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center gap-2 px-4 h-10 rounded-md
        border bg-velin-clair font-sans text-sm font-medium
        transition-all duration-300 ease-noble
        ${danger
          ? 'border-rouge/30 text-rouge hover:bg-rouge/10'
          : 'border-[rgba(31,24,16,0.12)] text-encre hover:bg-velin-fonce hover:shadow-md'}
        ${disabled ? 'opacity-60 cursor-wait' : ''}
        focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2
      `}
    >
      {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
      {children}
    </button>
  )
}

export default function Reglages() {
  const { user, logout } = useAuth()
  const { envelopes, mouvements, soldeDe, patrimoine } = useApp()
  const { showToast } = useToast()
  const { theme, toggleTheme } = useTheme()

  // --- Stats du cabinet ---
  const stats = useMemo(() => {
    const nbEnveloppes = envelopes.filter(e => e.type !== 'total').length
    const actifs = mouvements.filter(m => !m.is_undone)
    const nbMouvements = actifs.length

    // Premier mouvement
    const premier = actifs.reduce((min, m) => {
      if (!min) return m
      return new Date(m.created_at) < new Date(min.created_at) ? m : min
    }, null)
    const datePremier = premier
      ? new Date(premier.created_at).toLocaleDateString('fr-BE', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
      : null

    // Mois d'activité uniques
    const nbMoisActifs = new Set(actifs.map(m => m.created_at.slice(0, 7))).size

    // Cumuls financiers
    const totalRevenu  = actifs.filter(m => m.type === 'income').reduce((s, m) => s + (m.amount ?? 0), 0)
    const totalDepense = actifs.filter(m => m.type === 'spend').reduce((s, m) => s + (m.amount ?? 0), 0)

    // Patrimoine net courant
    const patrimoineNet = patrimoine ? soldeDe(patrimoine.id) : null

    return { nbEnveloppes, nbMouvements, datePremier, nbMoisActifs, totalRevenu, totalDepense, patrimoineNet }
  }, [envelopes, mouvements, soldeDe, patrimoine])

  const [logoutLoading, setLogoutLoading] = useState(false)
  const [choixExport, setChoixExport] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [importEnAttente, setImportEnAttente] = useState(null)
  const [importLoading, setImportLoading] = useState(false)
  const [resetPopup, setResetPopup] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const fileInputRef = useRef(null)

  // --- Déconnexion ---
  const handleLogout = async () => {
    setLogoutLoading(true)
    try {
      await logout()
    } catch {
      setLogoutLoading(false)
      showToast({ message: 'Erreur lors de la déconnexion. Réessaye.', type: 'erreur', duration: 3000 })
    }
  }

  // --- Export ---
  const handleExportJson = () => {
    try {
      exporterJson(envelopes, mouvements)
      showToast({ message: 'Sauvegarde JSON téléchargée', type: 'info' })
    } catch (err) {
      showToast({ message: 'Erreur export : ' + err.message, type: 'erreur', duration: 3000 })
    }
    setChoixExport(false)
  }

  const handleExportPdf = () => {
    setExportLoading(true)
    try {
      exporterPdf(envelopes, mouvements)
      showToast({ message: 'Rapport PDF téléchargé', type: 'info' })
    } catch (err) {
      showToast({ message: 'Erreur PDF : ' + err.message, type: 'erreur', duration: 3000 })
    }
    setExportLoading(false)
    setChoixExport(false)
  }

  // --- Import ---
  const handleFichierChoisi = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-choisir le même fichier
    if (!file) return
    try {
      const data = await lireFichierJson(file)
      validerImport(data)
      setImportEnAttente(data) // ouvre la popup de confirmation
    } catch (err) {
      showToast({ message: err.message, type: 'erreur', duration: 4000 })
    }
  }

  const confirmerReset = async () => {
    if (resetLoading) return
    setResetLoading(true)
    try {
      await remettreAZero(user.id)
      window.location.reload()
    } catch (err) {
      setResetLoading(false)
      setResetPopup(false)
      showToast({ message: 'Erreur : ' + err.message, type: 'erreur', duration: 5000 })
    }
  }

  const confirmerImport = async () => {
    if (!importEnAttente || importLoading) return
    setImportLoading(true)
    try {
      await appliquerImport(importEnAttente, user.id)
      // Reload : repart d'un état propre avec les nouvelles données
      window.location.reload()
    } catch (err) {
      setImportLoading(false)
      setImportEnAttente(null)
      showToast({ message: err.message, type: 'erreur', duration: 5000 })
    }
  }

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Layout 2 colonnes sur desktop, 1 colonne sur mobile ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ════════════ COLONNE GAUCHE ════════════ */}
        <div className="space-y-6">

          {/* === Apparence === */}
          <section className="surface-velin p-6 md:p-8">
            <p className="t-label">Apparence</p>
            <h2 className="t-h2 mt-2">Thème</h2>
            <p className="t-body-secondaire mt-4">
              Choisis l'ambiance qui te convient. Le réglage est mémorisé d'une session à l'autre.
            </p>
            <div className="mt-5 flex items-center gap-4">
              {/* Toggle pill */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                className="relative inline-flex h-9 w-[4.5rem] shrink-0 items-center rounded-full
                  border border-[rgba(31,24,16,0.14)] bg-velin-fonce
                  transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2"
                style={theme === 'dark' ? {
                  background: 'rgba(11,22,40,0.85)',
                  borderColor: 'rgba(184,149,74,0.25)',
                } : {}}
              >
                <span
                  className="pointer-events-none absolute left-1 flex h-7 w-7 items-center justify-center
                    rounded-full shadow-sm transition-transform duration-300"
                  style={{
                    transform: theme === 'dark' ? 'translateX(2.25rem)' : 'translateX(0)',
                    background: theme === 'dark'
                      ? 'linear-gradient(135deg, #162842 0%, #0B1628 100%)'
                      : 'linear-gradient(135deg, #FFFDF7 0%, #F5EFE0 100%)',
                    boxShadow: theme === 'dark'
                      ? '0 1px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(184,149,74,0.15)'
                      : '0 1px 4px var(--border-fort), inset 0 1px 0 rgba(255,255,255,0.9)',
                  }}
                >
                  {theme === 'dark'
                    ? <Moon size={14} strokeWidth={1.75} className="text-or" aria-hidden="true" />
                    : <Sun size={14} strokeWidth={1.75} style={{ color: 'var(--bordeaux)' }} aria-hidden="true" />
                  }
                </span>
              </button>
              <span className="font-sans text-sm font-medium" style={{ color: 'var(--encre)' }}>
                {theme === 'dark' ? 'Mode sombre' : 'Mode clair'}
              </span>
            </div>
          </section>

          {/* === Stats du cabinet === */}
          <section className="surface-velin p-6 md:p-8">
            <p className="t-label">Historique</p>
            <h2 className="t-h2 mt-2">Stats du cabinet</h2>
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">

              {/* Patrimoine net */}
              <div
                className="col-span-2 sm:col-span-3 flex flex-col gap-2 p-4 rounded-lg border"
                style={{ background: 'var(--fond-micro)', borderColor: 'var(--border-fin)' }}
              >
                <Wallet size={15} strokeWidth={1.75} className="text-or/70" aria-hidden="true" />
                <span className="font-serif font-semibold text-[2rem] leading-none tabular-nums"
                  style={{ color: 'var(--encre)' }}>
                  {stats.patrimoineNet !== null ? formatEuros(stats.patrimoineNet) : '—'}
                </span>
                <span className="font-sans text-[12px]" style={{ color: 'var(--encre-tertiaire)' }}>
                  Patrimoine net actuel
                </span>
              </div>

              {/* Total rentré */}
              <div
                className="flex flex-col gap-2 p-4 rounded-lg border"
                style={{ background: 'var(--fond-micro)', borderColor: 'var(--border-fin)' }}
              >
                <ArrowDownCircle size={15} strokeWidth={1.75} style={{ color: 'var(--vert, #2d7a45)' }} aria-hidden="true" />
                <span className="font-serif font-semibold text-[1.35rem] leading-tight tabular-nums"
                  style={{ color: 'var(--encre)' }}>
                  {formatEuros(stats.totalRevenu)}
                </span>
                <span className="font-sans text-[12px]" style={{ color: 'var(--encre-tertiaire)' }}>
                  Total rentré
                </span>
              </div>

              {/* Total dépensé */}
              <div
                className="flex flex-col gap-2 p-4 rounded-lg border"
                style={{ background: 'var(--fond-micro)', borderColor: 'var(--border-fin)' }}
              >
                <ArrowUpCircle size={15} strokeWidth={1.75} style={{ color: 'var(--rouge)' }} aria-hidden="true" />
                <span className="font-serif font-semibold text-[1.35rem] leading-tight tabular-nums"
                  style={{ color: 'var(--encre)' }}>
                  {formatEuros(stats.totalDepense)}
                </span>
                <span className="font-sans text-[12px]" style={{ color: 'var(--encre-tertiaire)' }}>
                  Total dépensé
                </span>
              </div>

              {/* Mois d'activité */}
              <div
                className="flex flex-col gap-2 p-4 rounded-lg border"
                style={{ background: 'var(--fond-micro)', borderColor: 'var(--border-fin)' }}
              >
                <Activity size={15} strokeWidth={1.75} className="text-or/70" aria-hidden="true" />
                <span className="font-serif font-semibold text-[2rem] leading-none tabular-nums"
                  style={{ color: 'var(--encre)' }}>
                  {stats.nbMoisActifs}
                </span>
                <span className="font-sans text-[12px]" style={{ color: 'var(--encre-tertiaire)' }}>
                  {stats.nbMoisActifs <= 1 ? 'Mois d\'activité' : 'Mois d\'activité'}
                </span>
              </div>

              {/* Enveloppes */}
              <div
                className="flex flex-col gap-2 p-4 rounded-lg border"
                style={{ background: 'var(--fond-micro)', borderColor: 'var(--border-fin)' }}
              >
                <Layers size={15} strokeWidth={1.75} className="text-or/70" aria-hidden="true" />
                <span className="font-serif font-semibold text-[2rem] leading-none tabular-nums"
                  style={{ color: 'var(--encre)' }}>
                  {stats.nbEnveloppes}
                </span>
                <span className="font-sans text-[12px]" style={{ color: 'var(--encre-tertiaire)' }}>
                  {stats.nbEnveloppes <= 1 ? 'Enveloppe' : 'Enveloppes'}
                </span>
              </div>

              {/* Mouvements */}
              <div
                className="flex flex-col gap-2 p-4 rounded-lg border"
                style={{ background: 'var(--fond-micro)', borderColor: 'var(--border-fin)' }}
              >
                <TrendingUp size={15} strokeWidth={1.75} className="text-or/70" aria-hidden="true" />
                <span className="font-serif font-semibold text-[2rem] leading-none tabular-nums"
                  style={{ color: 'var(--encre)' }}>
                  {stats.nbMouvements.toLocaleString('fr-BE')}
                </span>
                <span className="font-sans text-[12px]" style={{ color: 'var(--encre-tertiaire)' }}>
                  {stats.nbMouvements <= 1 ? 'Mouvement' : 'Mouvements'}
                </span>
              </div>

              {/* Premier mouvement */}
              <div
                className="col-span-2 sm:col-span-1 flex flex-col gap-2 p-4 rounded-lg border"
                style={{ background: 'var(--fond-micro)', borderColor: 'var(--border-fin)' }}
              >
                <Calendar size={15} strokeWidth={1.75} className="text-or/70" aria-hidden="true" />
                <span className="font-serif font-semibold text-[1rem] leading-snug"
                  style={{ color: 'var(--encre)' }}>
                  {stats.datePremier ?? '—'}
                </span>
                <span className="font-sans text-[12px]" style={{ color: 'var(--encre-tertiaire)' }}>
                  Premier mouvement
                </span>
              </div>

            </div>
          </section>

          {/* === À propos === */}
          <section className="surface-velin p-6 md:p-8">
            <p className="t-label">À propos</p>
            <h2 className="t-h2 mt-2">Tom's Cabinet</h2>
            <p className="t-body-secondaire mt-4">
              Budget personnel par enveloppes. Version 1.0.1.
            </p>
          </section>

        </div>{/* fin colonne gauche */}

        {/* ════════════ COLONNE DROITE ════════════ */}
        <div className="space-y-6">

          {/* === Compte === */}
          <section className="surface-velin p-6 md:p-8">
            <p className="t-label">Compte</p>
            <h2 className="t-h2 mt-2">Ton accès</h2>
            <p className="t-body-secondaire mt-4">
              Connecté avec{' '}
              <span className="italic" style={{ color: 'var(--encre)' }}>{user?.email}</span>.
            </p>
            <div className="mt-6">
              <BoutonReglage onClick={handleLogout} disabled={logoutLoading} icon={LogOut}>
                {logoutLoading ? 'Déconnexion...' : 'Se déconnecter'}
              </BoutonReglage>
            </div>
          </section>

          {/* === Données === */}
          <section className="surface-velin p-6 md:p-8">
            <p className="t-label">Données</p>
            <h2 className="t-h2 mt-2">Sauvegarde &amp; restauration</h2>

            {/* Export */}
            <p className="t-body-secondaire mt-4">
              Exporte une copie de tout ton cabinet — en JSON (réimportable) ou en
              PDF (rapport lisible).
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <BoutonReglage onClick={() => setChoixExport(v => !v)} icon={Download}>
                Exporter mes données
              </BoutonReglage>
              {choixExport && (
                <>
                  <BoutonReglage onClick={handleExportJson} icon={FileJson}>
                    Format JSON
                  </BoutonReglage>
                  <BoutonReglage onClick={handleExportPdf} disabled={exportLoading} icon={FileText}>
                    {exportLoading ? 'Génération...' : 'Format PDF'}
                  </BoutonReglage>
                </>
              )}
            </div>

            {/* Import */}
            <div className="mt-8 pt-6 border-t border-[rgba(31,24,16,0.08)]">
              <p className="t-body-secondaire">
                Réimporte une sauvegarde JSON. Cela <strong>remplacera</strong> toutes
                tes données actuelles — garde toujours ton fichier de côté.
              </p>
              <div className="mt-4">
                <BoutonReglage onClick={() => fileInputRef.current?.click()} icon={Upload}>
                  Réimporter mes données
                </BoutonReglage>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFichierChoisi}
                className="hidden"
              />
            </div>
          </section>

          {/* === Zone dangereuse === */}
          <section className="surface-velin p-6 md:p-8" style={{ boxShadow: '0 0 0 1px rgba(180,30,30,0.15), var(--shadow-sm)' }}>
            <p className="t-label" style={{ color: 'var(--rouge)' }}>Zone dangereuse</p>
            <h2 className="t-h2 mt-2">Remettre à zéro</h2>
            <p className="t-body-secondaire mt-4">
              Supprime <strong>toutes tes enveloppes et tous tes mouvements</strong>.
              Ton Patrimoine est conservé mais son solde retombe à 0. Cette action est <strong>irréversible</strong> — exporte tes données d'abord si tu veux garder une trace.
            </p>
            <div className="mt-6">
              <BoutonReglage onClick={() => setResetPopup(true)} icon={RotateCcw} danger>
                Tout remettre à zéro
              </BoutonReglage>
            </div>
          </section>

        </div>{/* fin colonne droite */}

      </div>{/* fin grid */}

      {/* Popup remise à zéro */}
      <PopupConfirmation
        isOpen={resetPopup}
        onClose={() => { if (!resetLoading) setResetPopup(false) }}
        title="Tout remettre à zéro ?"
        tone="destructive"
        message={
          <>
            <strong>ATTENTION.</strong> Cette action va <strong>supprimer définitivement</strong> toutes tes enveloppes et tous tes mouvements. Ton solde patrimoine retombera à <strong>0 €</strong>. Elle est <strong>irréversible</strong>.
          </>
        }
        actions={[
          { label: 'Annuler', variant: 'ghost', onClick: () => setResetPopup(false) },
          {
            label: resetLoading ? 'Remise à zéro...' : 'Tout supprimer',
            variant: 'destructive',
            onClick: confirmerReset,
          },
        ]}
      />

      {/* Popup de confirmation d'import */}
      <PopupConfirmation
        isOpen={!!importEnAttente}
        onClose={() => { if (!importLoading) setImportEnAttente(null) }}
        title="Remplacer toutes tes données ?"
        tone="destructive"
        message={
          <>
            <strong>ATTENTION.</strong> Cette action va <strong>remplacer toutes
            tes données actuelles</strong> par celles du fichier. Elle est
            irréversible.
            {importEnAttente && (
              <span className="block mt-2 t-meta">
                Le fichier contient {importEnAttente.envelopes.length} enveloppe(s)
                et {importEnAttente.movements.length} mouvement(s).
              </span>
            )}
          </>
        }
        actions={[
          { label: 'Annuler', variant: 'ghost', onClick: () => setImportEnAttente(null) },
          {
            label: importLoading ? 'Import en cours...' : 'Importer',
            variant: 'destructive',
            onClick: confirmerImport,
          },
        ]}
      />
    </div>
  )
}