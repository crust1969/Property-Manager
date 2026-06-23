import { Outlet, NavLink } from 'react-router-dom';
import { t } from '../i18n/de';

const navItems = [
  { to: '/dashboard', label: t.nav.dashboard },
  { to: '/objekte', label: t.nav.objekte },
  { to: '/mieter', label: t.nav.mieter },
  { to: '/mietvertraege', label: 'Mietverträge' },
  { to: '/einnahmen', label: t.nav.einnahmen },
  { to: '/kautionen', label: 'Kautionen' },
  { to: '/ausgaben', label: t.nav.ausgaben },
  { to: '/kategorien', label: t.nav.kategorien },
  { to: '/darlehen', label: t.nav.darlehen },
  { to: '/afa', label: t.nav.afa },
  { to: '/nebenkosten', label: t.nav.nebenkosten },
  { to: '/dokumente', label: t.nav.dokumente },
  { to: '/berichte', label: t.nav.berichte },
  { to: '/erinnerungen', label: t.nav.erinnerungen },
  { to: '/einstellungen', label: t.nav.einstellungen },
];

export function AppLayout() {
  return (
    <div className="flex h-screen">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-primary-700">
            {t.app.title}
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto p-2" aria-label="Hauptnavigation">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
