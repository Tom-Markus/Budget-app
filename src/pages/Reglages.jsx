/**
 * src/pages/Reglages.jsx — version Bloc H
 * ----------------------------------------------------------------------------
 * Compte (déconnexion) + Export (JSON / PDF) + Réimport (avec confirmation).
 * ----------------------------------------------------------------------------
 */
import { useState, useRef } from 'react'
import { LogOut, Download, Upload, FileJson, FileText, RotateCcw } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useApp } from '../hooks/useApp'
import { useToast } from '../hooks/useToast'
import PopupConfirmation from '../components/PopupConfirmation'
import { exporterJson } from '../lib/exportJson'
import { exporterPdf } from '../lib/exportPdf'
import { lireFichierJson, validerImport, appliquerImport } from '../lib/importJson'
import { remettreAZero } from '../lib/mutations'

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
          : 'border-[rgba(31,24,16,0.12)] text-encre hover:bg-white hover:shadow-md'}
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
  const { envelopes, mouvements } = useApp()
  const { showToast } = useToast()

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
    <div className="space-y-6 max-w-2xl mx-auto">
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
      <section className="surface-velin p-6 md:p-8" style={{ boxShadow: '0 0 0 1px rgba(180,30,30,0.15), 0 2px 6px rgba(31,24,16,0.06)' }}>
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

      {/* === À propos === */}
      <section className="surface-velin p-6 md:p-8">
        <p className="t-label">À propos</p>
        <h2 className="t-h2 mt-2">Tom's Cabinet</h2>
        <p className="t-body-secondaire mt-4">
          Budget personnel par enveloppes. Version 1.0.1.
        </p>
      </section>

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