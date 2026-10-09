import React from 'react';
import { 
  Building2, 
  FileText, 
  Calculator, 
  Settings, 
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Sparkles
  ,Ruler
} from 'lucide-react';

export default function Navbar({ user, currentView, setView }) {
  return (
    <div className="sticky top-0 z-40">
      {/* Main Clean White Navbar */}
      <header className="bg-white border-b border-slate-200/90 shadow-sm transition-colors">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand matching Cincom CPQ */}
            <div 
              className="flex items-center gap-3 cursor-pointer group" 
              onClick={() => setView('new-quote')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#005daa] to-[#003d73] flex items-center justify-center text-white shadow-md shadow-blue-900/15 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xl tracking-tight text-[#212529]">
                    DAMPER QUOTE <span className="text-[#005daa]">PRO</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#eff8fe] text-[#005daa] border border-blue-200">
                    CPQ SUITE
                  </span>
                </div>
                <p className="text-[11px] text-[#3b475d] font-medium -mt-0.5">
                  Industrial Valve & Damper Cost Engineering • Pune
                </p>
              </div>
            </div>

            {/* Navigation Pills */}
            <nav className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-1">
              <button
                onClick={() => setView('new-quote')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  currentView === 'new-quote'
                    ? 'bg-[#005daa] text-white shadow-sm ring-2 ring-[#005daa]/20'
                    : 'text-[#3b475d] hover:text-[#005daa] hover:bg-[#eff8fe]'
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span>Costing Sheet</span>
              </button>

              <button
                onClick={() => setView('quotes')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  currentView === 'quotes'
                    ? 'bg-[#005daa] text-white shadow-sm ring-2 ring-[#005daa]/20'
                    : 'text-[#3b475d] hover:text-[#005daa] hover:bg-[#eff8fe]'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Saved Quotes</span>
              </button>

              <button
                onClick={() => setView('rates')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  currentView === 'rates'
                    ? 'bg-[#005daa] text-white shadow-sm ring-2 ring-[#005daa]/20'
                    : 'text-[#3b475d] hover:text-[#005daa] hover:bg-[#eff8fe]'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Rates & What-If</span>
                <span className="sm:hidden">Rates</span>
              </button>

              <button
                onClick={() => setView('company-settings')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  currentView === 'company-settings'
                    ? 'bg-[#005daa] text-white shadow-sm ring-2 ring-[#005daa]/20'
                    : 'text-[#3b475d] hover:text-[#005daa] hover:bg-[#eff8fe]'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Company Settings</span>
                <span className="sm:hidden">Settings</span>
              </button>

              <button
                onClick={() => setView('damper-admin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  currentView === 'damper-admin'
                    ? 'bg-[#005daa] text-white shadow-sm ring-2 ring-[#005daa]/20'
                    : 'text-[#3b475d] hover:text-[#005daa] hover:bg-[#eff8fe]'
                }`}
              >
                <Ruler className="w-4 h-4" />
                <span>Damper Admin</span>
              </button>
            </nav>

            {/* Quick Engine Status Indicator */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-[#3b475d] font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-mono text-slate-500">FastAPI Costing v1.4 Ready</span>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
