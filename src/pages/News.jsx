import { Newspaper } from 'lucide-react';

export default function News() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center text-encre-tertiaire">
      <Newspaper size={40} strokeWidth={1.25} className="text-or opacity-60" />
      <p className="font-serif italic text-lg text-velin-clair opacity-60">
        Bientôt disponible
      </p>
    </div>
  );
}
