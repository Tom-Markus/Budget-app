/**
 * ErreurConfiguration.jsx
 * ----------------------------------------------------------------------------
 * Écran affiché à la place de l'app quand la configuration Supabase est
 * absente (voir src/lib/supabase.js) — plutôt qu'un écran blanc muet.
 * ----------------------------------------------------------------------------
 */
export default function ErreurConfiguration({ message }) {
  return (
    <main
      style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '1rem',
        padding: '2rem', textAlign: 'center',
        background: 'var(--velin, #F4EFE6)', color: 'var(--encre, #1F1810)',
        fontFamily: 'Georgia, serif',
      }}
    >
      <h1 style={{ fontStyle: 'italic', fontSize: '1.5rem' }}>
        Tom&rsquo;s Cabinet — configuration manquante
      </h1>
      <p style={{ maxWidth: '32rem', opacity: 0.75, lineHeight: 1.6 }}>{message}</p>
    </main>
  )
}
