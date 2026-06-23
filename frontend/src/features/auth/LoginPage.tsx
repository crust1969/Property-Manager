import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input, Button } from '../../shared/components';
import { useAuth } from './useAuth';
import { t } from '../../i18n/de';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError(t.common.pflichtfeld);
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch {
      setError(t.auth.ungueltigeAnmeldedaten);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center mb-6">
            {t.app.title}
          </h1>
          <h2 className="text-lg text-center text-gray-600 mb-8">
            {t.auth.anmelden}
          </h2>

          {error && (
            <div
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t.auth.email}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="name@example.com"
            />

            <Input
              label={t.auth.passwort}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? t.common.laden : t.auth.anmelden}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Noch kein Konto?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Registrieren
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
