import { BookOpen, Building2, ChartColumn, Gauge, Home, Settings, TableProperties } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { strategyList } from '../lib/strategies.js';

const navItems = [
  { to: '/', label: 'Overview', icon: Gauge },
  { to: '/metrics-guide', label: 'Metrics Guide', icon: BookOpen },
  ...strategyList.map((strategy) => ({ to: strategy.path, label: strategy.label, icon: TableProperties })),
  { to: '/neighborhoods', label: 'Neighborhoods', icon: ChartColumn },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Real Estate</p>
            <p className="text-xs text-slate-500">Investment Analyzer</p>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                ].join(' ')
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <NavLink to="/" className="flex items-center gap-2 text-sm font-semibold">
            <Home className="h-4 w-4" />
            Real Estate Analyzer
          </NavLink>
          <NavLink to="/settings" className="rounded-md border border-slate-200 p-2">
            <Settings className="h-4 w-4" />
          </NavLink>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
          {navItems.slice(0, -1).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium',
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
