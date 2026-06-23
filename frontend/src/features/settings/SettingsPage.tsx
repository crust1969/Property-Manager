import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Input } from '../../shared/components';
import { useAuth } from '../../shared/hooks';
import { fetchProfile, updateProfile, changePassword } from './api';
import type { ProfileFormData, PasswordChangeFormData, ValidationErrors } from './types';

type SettingsTab = 'profil' | 'passwort' | 'kategorien';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profil');

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'profil', label: t.einstellungen.profil },
    { key: 'passwort', label: t.einstellungen.passwortAendern },
    { key: 'kategorien', label: t.einstellungen.kategorien },
  ];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t.einstellungen.titel}</h1>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Einstellungen">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium transition-colors
                ${activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `.trim()}
              aria-current={activeTab === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'profil' && <ProfileSection />}
      {activeTab === 'passwort' && <PasswordSection />}
      {activeTab === 'kategorien' && <CategoriesSection />}
    </div>
  );
}

function ProfileSection() {
  const { user } = useAuth();
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    email: '',
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const profile = await fetchProfile();
      setFormData({ name: profile.name, email: profile.email });
    } catch {
      // Fallback to auth context data
      if (user) {
        setFormData({ name: user.name, email: user.email });
      }
    }
  }

  function validate(): boolean {
    const newErrors: ValidationErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = t.common.pflichtfeld;
    } else if (formData.name.trim().length > 100) {
      newErrors.name = t.validierung.maxZeichen(100);
    }
    if (!formData.email.trim()) {
      newErrors.email = t.common.pflichtfeld;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = t.validierung.emailUngueltig;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    if (!validate()) return;

    setLoading(true);
    try {
      await updateProfile(formData);
      setSuccess('Profil erfolgreich aktualisiert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.fehlerBeiSpeichern);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <h2 className="text-lg font-semibold text-gray-900">{t.einstellungen.profil}</h2>

        {success && (
          <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm" role="status">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
            {error}
          </div>
        )}

        <Input
          label={t.auth.name}
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          error={errors.name}
          required
          maxLength={100}
        />

        <Input
          label={t.auth.email}
          type="email"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          error={errors.email}
          required
        />

        <Button type="submit" disabled={loading}>
          {loading ? t.common.laden : t.common.speichern}
        </Button>
      </form>
    </Card>
  );
}

function PasswordSection() {
  const [formData, setFormData] = useState<PasswordChangeFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function validate(): boolean {
    const newErrors: ValidationErrors = {};
    if (!formData.currentPassword) {
      newErrors.currentPassword = t.common.pflichtfeld;
    }
    if (!formData.newPassword) {
      newErrors.newPassword = t.common.pflichtfeld;
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = t.validierung.minZeichen(8);
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t.common.pflichtfeld;
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwörter stimmen nicht überein';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    if (!validate()) return;

    setLoading(true);
    try {
      await changePassword(formData.currentPassword, formData.newPassword);
      setSuccess('Passwort erfolgreich geändert.');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      if (err instanceof Error && err.message.includes('aktuelles Passwort')) {
        setError('Das aktuelle Passwort ist nicht korrekt.');
      } else {
        setError(err instanceof Error ? err.message : t.common.fehlerBeiSpeichern);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <h2 className="text-lg font-semibold text-gray-900">{t.einstellungen.passwortAendern}</h2>

        {success && (
          <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm" role="status">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
            {error}
          </div>
        )}

        <Input
          label={t.einstellungen.aktuellesPasswort}
          type="password"
          value={formData.currentPassword}
          onChange={(e) => setFormData((prev) => ({ ...prev, currentPassword: e.target.value }))}
          error={errors.currentPassword}
          required
        />

        <Input
          label={t.einstellungen.neuesPasswort}
          type="password"
          value={formData.newPassword}
          onChange={(e) => setFormData((prev) => ({ ...prev, newPassword: e.target.value }))}
          error={errors.newPassword}
          helpText={t.validierung.minZeichen(8)}
          required
        />

        <Input
          label="Neues Passwort bestätigen"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
          error={errors.confirmPassword}
          required
        />

        <Button type="submit" disabled={loading}>
          {loading ? t.common.laden : 'Passwort ändern'}
        </Button>
      </form>
    </Card>
  );
}

function CategoriesSection() {
  const navigate = useNavigate();

  return (
    <Card>
      <div className="space-y-4 max-w-lg">
        <h2 className="text-lg font-semibold text-gray-900">{t.einstellungen.kategorien}</h2>
        <p className="text-sm text-gray-600">
          Verwalten Sie Ihre Standardkategorien und das Regelwerk für die automatische Klassifikation von Buchungen.
        </p>
        <Button onClick={() => navigate('/kategorien')}>
          Kategorien verwalten
        </Button>
      </div>
    </Card>
  );
}
