import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  History, 
  Sparkles, 
  Download, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  Clock,
  User,
  ShieldAlert
} from 'lucide-react';
import { ratesApi } from '../services/api';
import { formatINR, formatNumber, formatPercent } from '../utils/formatters';

export default function RatesPage({ user }) {
  const [activeTab, setActiveTab] = useState('current'); // 'current', 'history', 'whatif', 'import'
  const [ratesData, setRatesData] = useState(null);
  const [editRates, setEditRates] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changeDescription, setChangeDescription] = useState('Quarterly rate revision');

  // What-If Simulator state
  const [steelDelta, setSteelDelta] = useState(5); // %
  const [labourDelta, setLabourDelta] = useState(0); // %
  const [fabDelta, setFabDelta] = useState(0); // %
  const [whatIfResult, setWhatIfResult] = useState(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  const canEdit = user?.role === 'Admin' || user?.role === 'Manager';

  useEffect(() => {
    loadCurrentRates();
    loadHistory();
  }, []);

  const loadCurrentRates = async () => {
    try {
      setLoading(true);
      const res = await ratesApi.getCurrentRates();
      setRatesData(res);
      setEditRates(JSON.parse(JSON.stringify(res)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await ratesApi.getHistory();
      setHistoryList(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRateFieldChange = (category, key, val) => {
    const num = parseFloat(val);
    setEditRates((prev) => {
      const next = { ...prev };
      if (category === 'root') {
        next[key] = isNaN(num) ? 0 : num;
      } else {
        if (!next[category]) next[category] = {};
        next[category][key] = isNaN(num) ? 0 : num;
      }
      return next;
    });
  };

  const handleSaveNewVersion = async () => {
    if (!window.confirm('Create a new global rate version? All new quotes will use these rates. Existing saved quotes will NOT be changed.')) return;
    try {
      setSaving(true);
      const payload = {
        material_rates: editRates.material_rates,
        labour_rates: editRates.labour_rates,
        bought_out_prices: editRates.bought_out_prices,
        automation_prices: editRates.automation_prices,
        fabrication_rate_per_kg: editRates.fabrication_rate_per_kg,
        finishing_rate_per_kg: editRates.finishing_rate_per_kg,
        default_markup_pct: editRates.default_markup_pct,
        change_description: changeDescription,
      };
      const res = await ratesApi.updateRates(payload);
      alert(`New Rate Version #${res.version_number} saved successfully!`);
      loadCurrentRates();
      loadHistory();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save rate version.');
    } finally {
      setSaving(false);
    }
  };

  const runWhatIf = async () => {
    try {
      setWhatIfLoading(true);
      const deltas = {};
      if (steelDelta !== 0) deltas.steel_delta_pct = Number(steelDelta);
      if (labourDelta !== 0) deltas.labour_delta_pct = Number(labourDelta);
      if (fabDelta !== 0) deltas.fabrication_delta_pct = Number(fabDelta);
      const res = await ratesApi.simulateWhatIf(deltas);
      setWhatIfResult(res);
    } catch (err) {
      alert('What-if calculation failed.');
    } finally {
      setWhatIfLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setImportError('');
    setImportPreview(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await ratesApi.previewImport(formData);
      setImportPreview(res);
    } catch (err) {
      setImportError(err.response?.data?.detail || 'Failed to preview file.');
    }
  };

  const handleConfirmImport = async () => {
    if (!importFile) return;
    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await ratesApi.confirmImport(formData);
      alert(`Import applied successfully! New Rate Version #${res.version_number} is now active.`);
      setImportPreview(null);
      setImportFile(null);
      loadCurrentRates();
      loadHistory();
      setActiveTab('current');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to confirm import.');
    } finally {
      setImporting(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Access Restricted</h2>
        <p className="text-sm text-slate-500 mt-1">
          Only Admin and Manager roles can view and modify global company rates.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#EAE5DB] dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#242826] dark:text-white">
              Company Master Rates & What-If Engine
            </h1>
            {ratesData && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EEF5F1] text-[#2F4D40] border border-[#D5E5DC] dark:bg-blue-900/40 dark:text-blue-300 font-mono">
                Active: v{ratesData.version_number}
              </span>
            )}
          </div>
          <p className="text-xs text-[#5C6460] dark:text-slate-400 mt-1">
            Maintain raw material rates, fabrication benchmarks, and simulate commodity inflation
          </p>
        </div>

        {/* Action tabs */}
        <div className="flex items-center gap-1.5 bg-[#F4EFE6] dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold border border-[#E8E3D8]">
          <button
            onClick={() => setActiveTab('current')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'current' ? 'bg-white dark:bg-slate-900 text-[#3D6353] shadow-sm' : 'text-[#5C6460] hover:text-[#242826]'
            }`}
          >
            Master Rates
          </button>
          <button
            onClick={() => {
              setActiveTab('whatif');
              runWhatIf();
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'whatif' ? 'bg-white dark:bg-slate-900 text-[#3D6353] shadow-sm' : 'text-[#5C6460] hover:text-[#242826]'
            }`}
          >
            What-If Simulator
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'history' ? 'bg-white dark:bg-slate-900 text-[#3D6353] shadow-sm' : 'text-[#5C6460] hover:text-[#242826]'
            }`}
          >
            Audit Log ({historyList.length})
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'import' ? 'bg-white dark:bg-slate-900 text-[#3D6353] shadow-sm' : 'text-[#5C6460] hover:text-[#242826]'
            }`}
          >
            Import / Export
          </button>
        </div>
      </div>

      {/* Tab 1: Current Master Rates Editor */}
      {activeTab === 'current' && editRates && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Active Global Rates Table</h3>
                <p className="text-xs text-slate-400">
                  Editing these rates creates a new version. Existing quotes remain unchanged.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Change reason / note..."
                  value={changeDescription}
                  onChange={(e) => setChangeDescription(e.target.value)}
                  className="px-3 py-1.5 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 w-full sm:w-60"
                />
                <button
                  onClick={handleSaveNewVersion}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-md transition-all shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Publish v{editRates.version_number + 1}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
              {/* Material Rates */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
                  Steel & Metal Rates (₹/kg)
                </h4>
                {Object.entries(editRates.material_rates || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{k}</span>
                    <input
                      type="number"
                      step="1"
                      value={v}
                      onChange={(e) => handleRateFieldChange('material_rates', k, e.target.value)}
                      className="w-24 px-2 py-1 text-right font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                    />
                  </div>
                ))}
              </div>

              {/* Fabrication, Finishing & Labour */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
                  Fabrication & Finishing (₹/kg)
                </h4>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">Fabrication Rate</span>
                  <input
                    type="number"
                    step="1"
                    value={editRates.fabrication_rate_per_kg}
                    onChange={(e) => handleRateFieldChange('root', 'fabrication_rate_per_kg', e.target.value)}
                    className="w-24 px-2 py-1 text-right font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">Finishing Rate</span>
                  <input
                    type="number"
                    step="1"
                    value={editRates.finishing_rate_per_kg}
                    onChange={(e) => handleRateFieldChange('root', 'finishing_rate_per_kg', e.target.value)}
                    className="w-24 px-2 py-1 text-right font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">Default Markup %</span>
                  <input
                    type="number"
                    step="0.5"
                    value={editRates.default_markup_pct}
                    onChange={(e) => handleRateFieldChange('root', 'default_markup_pct', e.target.value)}
                    className="w-24 px-2 py-1 text-right font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>

                <h4 className="font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pt-3 pb-2">
                  Labour Rates (₹/m-mm)
                </h4>
                {Object.entries(editRates.labour_rates || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{k}</span>
                    <input
                      type="number"
                      step="0.1"
                      value={v}
                      onChange={(e) => handleRateFieldChange('labour_rates', k, e.target.value)}
                      className="w-24 px-2 py-1 text-right font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                    />
                  </div>
                ))}
              </div>

              {/* Bought-Out & Automation */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
                  Bought-Out & Hardware (₹)
                </h4>
                {Object.entries(editRates.bought_out_prices || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-300 font-medium capitalize">{k.replace('_', ' ')}</span>
                    <input
                      type="number"
                      step="1"
                      value={v}
                      onChange={(e) => handleRateFieldChange('bought_out_prices', k, e.target.value)}
                      className="w-24 px-2 py-1 text-right font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                    />
                  </div>
                ))}

                <h4 className="font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pt-3 pb-2">
                  Automation (₹)
                </h4>
                {Object.entries(editRates.automation_prices || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-300 font-medium capitalize">{k.replace('_', ' ')}</span>
                    <input
                      type="number"
                      step="100"
                      value={v}
                      onChange={(e) => handleRateFieldChange('automation_prices', k, e.target.value)}
                      className="w-28 px-2 py-1 text-right font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: What-If Simulator */}
      {activeTab === 'whatif' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <span>Commodity Price Sensitivity & Margin Simulator</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Simulate the bottom-line price impact on the 3000 × 3000 × 450 mm reference damper before committing rate updates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Steel Price Shift (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={steelDelta}
                  onChange={(e) => setSteelDelta(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-14 text-right font-mono font-bold text-xs">
                  {steelDelta > 0 ? `+${steelDelta}%` : `${steelDelta}%`}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Labour Shift (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={labourDelta}
                  onChange={(e) => setLabourDelta(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-14 text-right font-mono font-bold text-xs">
                  {labourDelta > 0 ? `+${labourDelta}%` : `${labourDelta}%`}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Fabrication Rate Shift (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={fabDelta}
                  onChange={(e) => setFabDelta(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-14 text-right font-mono font-bold text-xs">
                  {fabDelta > 0 ? `+${fabDelta}%` : `${fabDelta}%`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={runWhatIf}
              disabled={whatIfLoading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-xs font-semibold shadow-md"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Simulate Impact</span>
            </button>
          </div>

          {/* Results Comparison Grid */}
          {whatIfResult && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-500 block">Baseline Quoted Price</span>
                <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                  {formatINR(whatIfResult.baseline.quoted_price_unit)}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  Cost: {formatINR(whatIfResult.baseline.total_cost_unit)}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900">
                <span className="text-xs text-indigo-700 dark:text-indigo-300 block font-semibold">
                  Simulated Quoted Price
                </span>
                <span className="text-xl font-extrabold font-mono text-indigo-900 dark:text-indigo-100">
                  {formatINR(whatIfResult.simulated.quoted_price_unit)}
                </span>
                <span className="text-[11px] text-indigo-700 dark:text-indigo-300 block mt-1">
                  Cost: {formatINR(whatIfResult.simulated.total_cost_unit)}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                <span className="text-xs text-amber-700 dark:text-amber-300 block font-semibold">
                  Net Commercial Difference
                </span>
                <span className="text-xl font-black font-mono text-amber-900 dark:text-amber-100">
                  {whatIfResult.price_delta_amount >= 0 ? '+' : ''}{formatINR(whatIfResult.price_delta_amount)}
                </span>
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 block mt-1">
                  {whatIfResult.price_delta_pct > 0 ? `+${whatIfResult.price_delta_pct}%` : `${whatIfResult.price_delta_pct}%`} price adjustment required
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: History & Audit Log */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Rate Revision Audit Trail</h3>
            <p className="text-xs text-slate-400">All historical changes with timestamp, author, and old vs new values.</p>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5">Date / Time</th>
                  <th className="px-4 py-2.5">Item Changed</th>
                  <th className="px-4 py-2.5 text-right">Old Value</th>
                  <th className="px-4 py-2.5 text-right">New Value</th>
                  <th className="px-4 py-2.5">Reason</th>
                  <th className="px-4 py-2.5">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {historyList.length > 0 ? (
                  historyList.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2 text-slate-500">
                        {new Date(h.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{h.rate_key}</td>
                      <td className="px-4 py-2 text-right text-slate-400">{h.old_value}</td>
                      <td className="px-4 py-2 text-right font-bold text-blue-600 dark:text-blue-400">{h.new_value}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400 font-sans">{h.change_reason || '-'}</td>
                      <td className="px-4 py-2 font-sans text-slate-500">{h.changed_by_user?.full_name || 'Admin'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-400 font-sans">
                      No manual rate changes recorded yet. Initial base loaded from seed.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Import / Export */}
      {activeTab === 'import' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Panel */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-500" />
                  <span>Export Master Rates</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Download active rates in CSV or Excel format for offline planning.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => ratesApi.exportRates('csv')}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={() => ratesApi.exportRates('xlsx')}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Download Excel (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Import Panel */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-500" />
                  <span>Import Rates (with Diff Preview)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Upload modified CSV or XLSX. Unknown keys are rejected. You must confirm before applying.
                </p>
              </div>

              <input
                type="file"
                accept=".csv, .xlsx"
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
              />

              {importError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {importError}
                </div>
              )}
            </div>
          </div>

          {/* Import Preview Table */}
          {importPreview && (
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-blue-200 dark:border-blue-900 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Before / After Import Preview</h4>
                  <p className="text-slate-400">Total modified keys: {importPreview.diffs.length}</p>
                </div>
                <button
                  onClick={handleConfirmImport}
                  disabled={importing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md"
                >
                  Confirm & Apply New Rate Version
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-left font-mono">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                    <tr>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Current Value</th>
                      <th className="px-3 py-2 text-right">New Imported Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {importPreview.diffs.map((d, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">{d.category}</td>
                        <td className="px-3 py-1.5 font-bold">{d.key}</td>
                        <td className="px-3 py-1.5 text-right text-slate-400">{d.old_value}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-emerald-600">{d.new_value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
