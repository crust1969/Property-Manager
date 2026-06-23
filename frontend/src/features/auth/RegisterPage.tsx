import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input, Button } from '../../shared/components';
import { useAuth } from './useAuth';
import { t } from '../../i18n/de';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError(t.common.pflichtfeld);
      return;
    }

    if (password.length < 8) {
      setError(t.validierung.minZeichen(8));
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, name);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen');
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
            Registrieren
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
              label="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />

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
              autoComplete="new-password"
              helpText={t.validierung.minZeichen(8)}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? t.common.laden : 'Registrieren'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Bereits ein Konto?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              {t.auth.anmelden}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
