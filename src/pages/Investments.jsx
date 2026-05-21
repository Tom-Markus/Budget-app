import { TrendingUp } from 'lucide-react'

export default function Investments() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <TrendingUp size={48} className="text-or opacity-60" />
      <h1 className="font-serif italic text-2xl text-velin-clair">Investments</h1>
      <p className="t-label-noble text-encre-tertiaire opacity-70">
        Cette section est en cours de construction.
      </p>
    </div>
  )
}
