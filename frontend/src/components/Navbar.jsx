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
      {/* Main Clean Warm Porcelain Navbar */}
      <header className="bg-[#FFFDFB]/95 backdrop-blur-md border-b border-[#EAE5DB] shadow-[0_1px_3px_0_rgba(40,30,20,0.03)] transition-colors">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand with Earthy Sage Accent */}
            <div 
              className="flex items-center gap-3 cursor-pointer group" 
              onClick={() => setView('new-quote')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3D6353] to-[#2C483D] flex items-center justify-center text-white shadow-md shadow-[#3D6353]/20 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xl tracking-tight text-[#242826]">
                    DAMPER QUOTE <span className="text-[#3D6353]">PRO</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EEF5F1] text-[#2C5040] border border-[#D0E2D7]">
                    CPQ SUITE
                  </span>
                </div>
                <p className="text-[11px] text-[#5C6460] font-medium -mt-0.5">
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
                    ? 'bg-[#3D6353] text-white shadow-sm ring-2 ring-[#3D6353]/20'
                    : 'text-[#4A5450] hover:text-[#2C5040] hover:bg-[#EEF5F1]'
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span>Costing Sheet</span>
              </button>

              <button
                onClick={() => setView('quotes')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  currentView === 'quotes'
                    ? 'bg-[#3D6353] text-white shadow-sm ring-2 ring-[#3D6353]/20'
                    : 'text-[#4A5450] hover:text-[#2C5040] hover:bg-[#EEF5F1]'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Saved Quotes</span>
              </button>

              <button
                onClick={() => setView('rates')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  currentView === 'rates'
                    ? 'bg-[#3D6353] text-white shadow-sm ring-2 ring-[#3D6353]/20'
                    : 'text-[#4A5450] hover:text-[#2C5040] hover:bg-[#EEF5F1]'
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
                    ? 'bg-[#3D6353] text-white shadow-sm ring-2 ring-[#3D6353]/20'
                    : 'text-[#4A5450] hover:text-[#2C5040] hover:bg-[#EEF5F1]'
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
                    ? 'bg-[#3D6353] text-white shadow-sm ring-2 ring-[#3D6353]/20'
                    : 'text-[#4A5450] hover:text-[#2C5040] hover:bg-[#EEF5F1]'
                }`}
              >
                <Ruler className="w-4 h-4" />
                <span>Damper Admin</span>
              </button>
            </nav>

            {/* Quick Engine Status Indicator */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-[#5C6460] font-medium bg-[#F5F2EB] px-3 py-1.5 rounded-full border border-[#E8E2D7]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Pune CTO Pricing v2.4 Active</span>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
