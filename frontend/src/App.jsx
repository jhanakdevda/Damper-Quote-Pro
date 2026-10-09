import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import NewQuote from './pages/NewQuote';
import QuotesList from './pages/QuotesList';
import RatesPage from './pages/RatesPage';
import CompanySettings from './pages/CompanySettings';
import PartAAdmin from './pages/PartAAdmin';
import { authApi } from './services/api';

export default function App() {
  // Default user active immediately without login/signup screen
  const [user, setUser] = useState({
    id: 1,
    full_name: 'Estimation Engineer',
    email: 'engineer@damperquote.com',
    role: 'Admin',
    must_change_password: false
  });
  const [currentView, setView] = useState('new-quote'); // Direct landing on the Costing Sheet
  const [selectedQuoteId, setSelectedQuoteId] = useState(null);
  const [theme, setTheme] = useState('light');

  // Set clean professional light mode by default
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('dqp_theme', 'light');

    // Attempt silent background session initialization if possible
    authApi.login('admin@damperquote.com', 'DamperQuote2026!')
      .then((data) => {
        localStorage.setItem('dqp_token', data.access_token);
        localStorage.setItem('dqp_user', JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(() => {
        // Fallback demo user
        setUser({
          id: 1,
          full_name: 'Estimation Engineer',
          email: 'engineer@damperquote.com',
          role: 'Admin',
          must_change_password: false
        });
      });
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('dqp_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans transition-colors duration-150">
      <Navbar
        user={user}
        currentView={currentView}
        setView={setView}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1">
        {currentView === 'new-quote' && (
          <NewQuote setView={setView} setSelectedQuoteId={setSelectedQuoteId} user={user} />
        )}

        {currentView === 'quotes' && (
          <QuotesList
            setView={setView}
            selectedQuoteId={selectedQuoteId}
            setSelectedQuoteId={setSelectedQuoteId}
            user={user}
          />
        )}

        {currentView === 'rates' && <RatesPage user={user} />}

        {currentView === 'company-settings' && <CompanySettings user={user} />}
        {currentView === 'damper-admin' && <PartAAdmin user={user} />}
      </main>

      <footer className="bg-white border-t border-slate-200 py-3.5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-medium text-slate-700">Damper Quote Pro • Industrial Valve & Damper Costing</span>
          <span>Pune Valve & Damper Mfg. Co. Pvt. Ltd. • Bhosari, Pune</span>
        </div>
      </footer>
    </div>
  );
}
