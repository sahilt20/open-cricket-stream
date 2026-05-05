import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-8xl font-bold text-white/10">404</span>
      <p className="text-lg font-semibold text-white">Page not found</p>
      <p className="text-sm text-white/50">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-2 text-sm text-willow-gold hover:underline">
        ← Back home
      </Link>
    </div>
  );
}
