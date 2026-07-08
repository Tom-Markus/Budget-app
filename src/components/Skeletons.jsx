/**
 * Skeletons.jsx
 * ----------------------------------------------------------------------------
 * États de chargement « squelette » : la page apparaît immédiatement avec la
 * silhouette de son contenu (au lieu d'un loader plein écran), le vrai
 * contenu prend la place sans saut de mise en page.
 *
 * Teintes via les utilitaires encre/* → adaptatives clair/sombre.
 * ----------------------------------------------------------------------------
 */

function Bloc({ className = '' }) {
  return <div className={`rounded-md bg-encre/[0.07] ${className}`} />
}

function CarteEnveloppeSkeleton() {
  return (
    <div className="surface-velin p-4 md:p-5 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-4">
        <Bloc className="h-5 w-2/5" />
        <Bloc className="h-5 w-9 rounded-full" />
      </div>
      <div className="flex items-end justify-between gap-3 mb-4">
        <Bloc className="h-9 w-32" />
        <Bloc className="h-6 w-14" />
      </div>
      <div className="flex items-center gap-2 pt-3 border-t border-encre/[0.06]">
        <Bloc className="h-10 w-10" />
        <Bloc className="h-10 w-10" />
        <Bloc className="h-10 w-10" />
        <Bloc className="h-10 w-10" />
      </div>
    </div>
  )
}

/** Silhouette de la page Accueil : Patrimoine + pill + 4 enveloppes. */
export function SkeletonAccueil() {
  return (
    <div className="space-y-8" role="status" aria-label="Chargement du cabinet">
      <div>
        <div className="surface-velin p-6 md:p-8 animate-pulse">
          <Bloc className="h-4 w-28 mb-5" />
          <div className="flex items-end justify-between gap-4 mb-6">
            <Bloc className="h-12 w-56" />
            <Bloc className="h-8 w-20" />
          </div>
          <div className="flex items-center gap-3">
            <Bloc className="h-11 w-11" />
            <Bloc className="h-11 w-11" />
          </div>
        </div>
        <div className="mt-3 px-4 md:px-6 animate-pulse">
          <Bloc className="h-9 w-52 rounded-full" />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="flex-1 w-full flex flex-col gap-4">
          <CarteEnveloppeSkeleton />
          <CarteEnveloppeSkeleton />
        </div>
        <div className="flex-1 w-full flex flex-col gap-4">
          <CarteEnveloppeSkeleton />
          <CarteEnveloppeSkeleton />
        </div>
      </div>
    </div>
  )
}

/** Silhouette de la page Investments : cartes stats + grille de positions. */
export function SkeletonInvestments() {
  return (
    <div role="status" aria-label="Chargement des investissements">
      <div className="grid gap-3 mb-6 grid-cols-3 animate-pulse">
        {[0, 1, 2].map(i => (
          <div key={i} className="surface-velin p-3 sm:p-4 flex flex-col gap-2">
            <Bloc className="h-3 w-20" />
            <Bloc className="h-7 w-28" />
            <Bloc className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
        {[0, 1, 2].map(i => (
          <div key={i} className="surface-velin p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Bloc className="h-5 w-16 rounded-full" />
              <Bloc className="h-8 w-8" />
            </div>
            <Bloc className="h-6 w-3/5" />
            <Bloc className="h-4 w-2/5" />
            <div className="pt-2 border-t border-encre/[0.06]">
              <Bloc className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
