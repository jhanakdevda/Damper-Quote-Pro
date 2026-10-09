import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, FileUp, Save } from 'lucide-react';
import apiClient from '../services/api';

const DEFAULT_LIMITS = {
  width_min_mm: 1000, width_max_mm: 6000,
  height_min_mm: 1000, height_max_mm: 6000,
  depth_min_mm: 300, depth_max_mm: 800,
};
const SCALE_CODES = ['blank', 'w', 'h', 'd', 'p', 'r', 'custom'];
const CALIBRATION_BLOCKS = ['raw_material', 'mfg', 'bought_out', 'automation', 'fabrication'];
const fieldClass = 'w-full rounded border border-slate-300 px-2 py-1.5 text-sm';
const buttonClass = 'inline-flex items-center gap-1.5 rounded bg-[#005daa] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004785] disabled:opacity-50';

export default function PartAAdmin() {
  const [tab, setTab] = useState('limits');
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [parts, setParts] = useState([]);
  const [previewSize, setPreviewSize] = useState({ width_mm: 3000, height_mm: 3000, depth_mm: 450 });
  const [preview, setPreview] = useState([]);
  const [verified, setVerified] = useState([]);
  const [calibration, setCalibration] = useState({});
  const [file, setFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadLimits = async () => setLimits((await apiClient.get('/admin/size-limits')).data);
  const loadParts = async () => setParts((await apiClient.get('/admin/scaling-rules')).data);
  const loadVerified = async () => setVerified((await apiClient.get('/admin/verified-sizes')).data);
  const loadCalibration = async () => setCalibration((await apiClient.get('/admin/calibration')).data.factors);
  useEffect(() => {
    Promise.all([loadLimits(), loadParts(), loadVerified(), loadCalibration()]).catch((err) => setError(err.response?.data?.detail || err.message));
  }, []);

  const run = async (action, successMessage) => {
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Request failed');
    }
  };

  const saveLimits = () => run(async () => {
    await apiClient.put('/admin/size-limits', Object.fromEntries(Object.entries(limits).filter(([key]) => key.endsWith('_mm'))));
    await loadLimits();
  }, 'Size limits saved.');

  const savePart = (part) => run(async () => {
    await apiClient.put(`/admin/scaling-rules/${part.id}`, {
      dim1_scale_code: part.dim1_scale_code,
      dim2_scale_code: part.dim2_scale_code,
      qty_scale_code: part.qty_scale_code,
      dim1_custom_formula: part.dim1_custom_formula,
      dim2_custom_formula: part.dim2_custom_formula,
      qty_custom_formula: part.qty_custom_formula,
    });
    await loadParts();
  }, `Scaling rules saved for ${part.name}.`);

  const runPreview = () => run(async () => {
    setPreview((await apiClient.post('/admin/scaling-rules/preview', previewSize)).data);
  }, 'Preview updated.');

  const previewImport = () => run(async () => {
    if (!file) throw new Error('Choose a CSV or XLSX file first.');
    const body = new FormData();
    body.append('file', file);
    setImportPreview((await apiClient.post('/admin/verified-sizes/import/preview', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data);
  }, 'Import preview ready.');

  const confirmImport = () => run(async () => {
    await apiClient.post(`/admin/verified-sizes/import/${importPreview.import_id}/confirm`);
    setImportPreview(null);
    setFile(null);
    await loadVerified();
  }, 'Verified sizes imported.');

  const saveCalibration = () => run(async () => {
    const result = await apiClient.put('/admin/calibration', { factors: calibration });
    setCalibration(result.data.factors);
  }, 'Calibration settings saved and audited.');

  const updatePart = (id, key, value) => setParts((current) => current.map((part) => part.id === id ? { ...part, [key]: value } : part));
  const updateLimit = (key, value) => setLimits((current) => ({ ...current, [key]: Number(value) }));
  const updatePreviewSize = (key, value) => setPreviewSize((current) => ({ ...current, [key]: Number(value) }));

  return (
    <section className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-300 pb-4">
        <div>
          <p className="text-xs font-bold uppercase text-[#005daa]">Damper configuration</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Part A Administration</h1>
        </div>
        <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Damper administration sections">
          {[
            ['limits', 'Size limits'], ['scaling', 'Scaling rules'], ['verified', 'Verified sizes'], ['calibration', 'Calibration'], ['multiblade', 'Multi-Blade Louver Damper']
          ].map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === key ? 'border-[#005daa] text-[#005daa]' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      {tab === 'limits' && <div className="mt-5 max-w-3xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {['width', 'height', 'depth'].map((dimension) => (
            <fieldset key={dimension} className="border-t-2 border-slate-300 pt-3">
              <legend className="px-1 text-sm font-bold capitalize text-slate-800">{dimension} (mm)</legend>
              <label className="mt-2 block text-xs text-slate-600">Minimum
                <input className={`${fieldClass} mt-1`} type="number" min="1" value={limits[`${dimension}_min_mm`]} onChange={(event) => updateLimit(`${dimension}_min_mm`, event.target.value)} />
              </label>
              <label className="mt-3 block text-xs text-slate-600">Maximum
                <input className={`${fieldClass} mt-1`} type="number" min="1" value={limits[`${dimension}_max_mm`]} onChange={(event) => updateLimit(`${dimension}_max_mm`, event.target.value)} />
              </label>
            </fieldset>
          ))}
        </div>
        <button className={`${buttonClass} mt-5`} onClick={saveLimits}><Save size={15} /> Save limits</button>
      </div>}

      {tab === 'scaling' && <div className="mt-5 space-y-6">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 pb-4">
          {Object.entries(previewSize).map(([key, value]) => <label key={key} className="text-xs font-semibold uppercase text-slate-600">{key.replace('_mm', '')} mm
            <input className={`${fieldClass} mt-1 w-32`} type="number" value={value} onChange={(event) => updatePreviewSize(key, event.target.value)} />
          </label>)}
          <button className={buttonClass} onClick={runPreview}><AlertTriangle size={15} /> Preview scaling</button>
        </div>
        {preview.length > 0 && <div className="overflow-x-auto border border-slate-200">
          <table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="p-2">Part</th><th className="p-2">Base dimensions</th><th className="p-2">Factors</th><th className="p-2">Result dimensions</th><th className="p-2">Qty</th></tr></thead>
            <tbody>{preview.map((row) => <tr key={row.part_id} className="border-t border-slate-200"><td className="p-2">{row.name}</td><td className="p-2 font-mono">{row.base_value.join(' × ')}</td><td className="p-2 font-mono">{Object.values(row.factors).map((v) => Number(v).toFixed(3)).join(' / ')}</td><td className="p-2 font-mono">{row.result_dimensions.map((v) => Number(v).toFixed(1)).join(' × ')}</td><td className="p-2 font-mono">{row.qty}</td></tr>)}</tbody>
          </table>
        </div>}
        <div className="overflow-x-auto border border-slate-200">
          <table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="p-2">Part</th><th className="p-2">Dim 1 rule</th><th className="p-2">Dim 1 formula</th><th className="p-2">Dim 2 rule</th><th className="p-2">Dim 2 formula</th><th className="p-2">Qty rule</th><th className="p-2">Qty formula</th><th className="p-2"></th></tr></thead>
            <tbody>{parts.map((part) => <tr key={part.id} className="border-t border-slate-200"><td className="max-w-56 p-2">{part.name}</td>
              {['dim1_scale_code', 'dim1_custom_formula', 'dim2_scale_code', 'dim2_custom_formula', 'qty_scale_code', 'qty_custom_formula'].map((key) => <td key={key} className="p-2">{key.endsWith('_scale_code') ? <select className={fieldClass} value={part[key] || 'blank'} onChange={(event) => updatePart(part.id, key, event.target.value)}>{SCALE_CODES.map((code) => <option key={code}>{code}</option>)}</select> : <input className={`${fieldClass} min-w-36 font-mono`} placeholder="W / 3000" value={part[key] || ''} onChange={(event) => updatePart(part.id, key, event.target.value)} />}</td>)}
              <td className="p-2"><button className="rounded border border-slate-300 p-2 text-slate-700 hover:bg-slate-100" title="Save scaling rule" aria-label={`Save scaling rule for ${part.name}`} onClick={() => savePart(part)}><Save size={15} /></button></td></tr>)}</tbody>
          </table>
        </div>
      </div>}

      {tab === 'verified' && <div className="mt-5 space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-slate-700">Import verified sizes (.csv, .xlsx)
            <input className={`${fieldClass} mt-1 max-w-sm`} type="file" accept=".csv,.xlsx,.xlsm" onChange={(event) => { setFile(event.target.files?.[0] || null); setImportPreview(null); }} />
          </label>
          <button className={buttonClass} onClick={previewImport}><FileUp size={15} /> Preview import</button>
        </div>
        {importPreview && <div className="border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-center gap-2 font-semibold text-amber-950"><AlertTriangle size={16} />{importPreview.rows_to_add} rows will be added; existing rows are unchanged.</div>
          <div className="mt-3 grid gap-4 md:grid-cols-2"><div><h2 className="mb-1 text-xs font-bold uppercase text-slate-600">Before</h2><pre className="max-h-48 overflow-auto bg-white p-2 text-xs">{JSON.stringify(importPreview.before, null, 2)}</pre></div><div><h2 className="mb-1 text-xs font-bold uppercase text-slate-600">After</h2><pre className="max-h-48 overflow-auto bg-white p-2 text-xs">{JSON.stringify(importPreview.after, null, 2)}</pre></div></div>
          <button className={`${buttonClass} mt-3`} onClick={confirmImport}><Check size={15} /> Confirm import</button>
        </div>}
        <div className="overflow-x-auto border border-slate-200"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="p-2">Label</th><th className="p-2">Width</th><th className="p-2">Height</th><th className="p-2">Depth</th><th className="p-2">Verified total cost</th><th className="p-2">Source</th></tr></thead><tbody>{verified.map((row) => <tr key={row.id} className="border-t border-slate-200"><td className="p-2 font-semibold">{row.label}</td><td className="p-2">{row.width_mm} mm</td><td className="p-2">{row.height_mm} mm</td><td className="p-2">{row.depth_mm} mm</td><td className="p-2">{row.verified_total_cost ?? '—'}</td><td className="p-2">{row.source_note || '—'}</td></tr>)}</tbody></table></div>
      </div>}

      {tab === 'calibration' && <div className="mt-5 max-w-4xl">
        <p className="mb-4 max-w-2xl text-sm text-slate-600">Each factor is inactive by default. Enabled factors affect new damper calculations only; every saved change is recorded in the audit log.</p>
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {CALIBRATION_BLOCKS.map((block) => <div key={block} className="grid grid-cols-1 items-center gap-3 py-3 sm:grid-cols-[1fr_140px_160px]">
            <label className="font-semibold capitalize text-slate-800">{block.replace('_', ' ')}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(calibration[block]?.enabled)} onChange={(event) => setCalibration((current) => ({ ...current, [block]: { ...current[block], enabled: event.target.checked } }))} /> Enabled</label>
            <label className="text-xs text-slate-600">Factor<input className={`${fieldClass} mt-1`} type="number" min="0.000001" step="0.001" value={calibration[block]?.factor ?? 1} onChange={(event) => setCalibration((current) => ({ ...current, [block]: { ...current[block], factor: Number(event.target.value) } }))} /></label>
          </div>)}
        </div>
        <button className={`${buttonClass} mt-4`} onClick={saveCalibration}><Save size={15} /> Save calibration</button>
      </div>}

      {tab === 'multiblade' && <MultiBladeAdminSection onError={setError} onNotice={setNotice} />}
    </section>
  );
}

function MultiBladeAdminSection({ onError, onNotice }) {
  const [data, setData] = useState({ tables: {}, is_dataset_verified: false });
  const [checklist, setChecklist] = useState([]);
  const [rates, setRates] = useState({ bought_out_prices: {}, automation_prices: {}, blade_factors: {} });
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [tableRes, checkRes, rateRes] = await Promise.all([
        apiClient.get('/admin/multi-blade/rule-tables'),
        apiClient.get('/admin/multi-blade/checklist'),
        apiClient.get('/admin/multi-blade/rates'),
      ]);
      setData(tableRes.data);
      setChecklist(checkRes.data);
      setRates(rateRes.data);
    } catch (err) {
      onError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const toggleVerify = async () => {
    try {
      const nextVal = !data.is_dataset_verified;
      await apiClient.post(`/admin/multi-blade/verify-toggle?verified=${nextVal}`);
      onNotice(nextVal ? 'Multi-blade dataset marked verified. Placeholder banner removed.' : 'Dataset marked unverified. Placeholder banner active.');
      await loadAll();
    } catch (err) {
      onError(err.response?.data?.detail || err.message);
    }
  };

  const saveMaxBladeLength = async () => {
    try {
      const rows = data.tables.max_blade_length?.rules_data || [];
      await apiClient.put('/admin/multi-blade/rule-tables/max_blade_length', { rules_data: rows });
      onNotice('Max blade length table saved.');
    } catch (err) {
      onError(err.response?.data?.detail || err.message);
    }
  };

  const saveShaftDiameter = async () => {
    try {
      const rows = data.tables.shaft_diameter?.rules_data || [];
      await apiClient.put('/admin/multi-blade/rule-tables/shaft_diameter', { rules_data: rows });
      onNotice('Shaft diameter table saved.');
    } catch (err) {
      onError(err.response?.data?.detail || err.message);
    }
  };

  const saveRates = async () => {
    try {
      await apiClient.put('/admin/multi-blade/rates', rates);
      onNotice('Multi-blade bought-out and actuator prices saved in a new rates version.');
    } catch (err) {
      onError(err.response?.data?.detail || err.message);
    }
  };

  const toggleChecklistItem = async (itemKey, currentCompleted, notes) => {
    try {
      await apiClient.put(`/admin/multi-blade/checklist/${itemKey}`, { is_completed: !currentCompleted, notes });
      setChecklist((curr) => curr.map((item) => item.item_key === itemKey ? { ...item, is_completed: !currentCompleted } : item));
      onNotice(`Checklist item updated.`);
    } catch (err) {
      onError(err.response?.data?.detail || err.message);
    }
  };

  if (loading) {
    return <div className="mt-5 text-sm text-slate-500">Loading multi-blade administration data...</div>;
  }

  return (
    <div className="mt-5 space-y-8 max-w-5xl">
      {/* 1. Dataset Verification Status Card */}
      <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${data.is_dataset_verified ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}>
        <div>
          <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${data.is_dataset_verified ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
            {data.is_dataset_verified ? 'Company Verified Dataset' : 'Placeholder Dataset Active'}
          </span>
          <h2 className="text-base font-bold text-slate-900 mt-1">
            {data.is_dataset_verified ? 'Multi-Blade Engineering Data is Verified' : 'Placeholder Multi-Blade Data: Not Company-Verified'}
          </h2>
          <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
            {data.is_dataset_verified
              ? 'Quotes and exported PDFs for multi-blade dampers will display official verified status without placeholder banners.'
              : 'Every quote and PDF currently displays a prominent banner: "Placeholder multi-blade data: not company-verified". Toggle to verify once Pune plant parameters are approved.'}
          </p>
        </div>
        <button
          onClick={toggleVerify}
          className={`px-4 py-2 rounded text-xs font-bold transition-all shadow-sm ${data.is_dataset_verified ? 'bg-slate-700 text-white hover:bg-slate-800' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
        >
          {data.is_dataset_verified ? 'Mark Unverified' : 'Mark Dataset Verified'}
        </button>
      </div>

      {/* 2. In-App Checklist: Data We Need From the Company */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Company Multi-Blade Data Checklist</h2>
            <p className="text-xs text-slate-500">Track and collect required Pune plant manufacturing standards and supplier rates.</p>
          </div>
          <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {checklist.filter((c) => c.is_completed).length} / {checklist.length} Completed
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {checklist.map((item) => (
            <div key={item.item_key} className="py-2.5 flex items-start gap-3">
              <input
                type="checkbox"
                id={`check-${item.item_key}`}
                checked={item.is_completed}
                onChange={() => toggleChecklistItem(item.item_key, item.is_completed, item.notes)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex-1 text-xs">
                <label htmlFor={`check-${item.item_key}`} className={`font-semibold cursor-pointer ${item.is_completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                  {item.title}
                </label>
                <p className="text-slate-500 mt-0.5">{item.description}</p>
                <span className="inline-block mt-1 text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  Category: {item.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Rule Tables: Max Blade Length & Shaft Diameter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Max Blade Length Table */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Max Blade Length by Thickness</h2>
            <button onClick={saveMaxBladeLength} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
              <Save size={13} /> Save Table
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mb-2">Exceeding this span triggers automatic section splitting or an error.</p>
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-2">Blade Thickness (mm)</th>
                <th className="p-2">Max Allowable Span (mm)</th>
              </tr>
            </thead>
            <tbody>
              {(data.tables.max_blade_length?.rules_data || []).map((row, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.1"
                      className="w-24 p-1 border rounded text-xs"
                      value={row.thickness_mm}
                      onChange={(e) => {
                        const copy = [...data.tables.max_blade_length.rules_data];
                        copy[idx].thickness_mm = Number(e.target.value);
                        setData({ ...data, tables: { ...data.tables, max_blade_length: { ...data.tables.max_blade_length, rules_data: copy } } });
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      className="w-28 p-1 border rounded text-xs"
                      value={row.max_length_mm}
                      onChange={(e) => {
                        const copy = [...data.tables.max_blade_length.rules_data];
                        copy[idx].max_length_mm = Number(e.target.value);
                        setData({ ...data, tables: { ...data.tables, max_blade_length: { ...data.tables.max_blade_length, rules_data: copy } } });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Shaft Diameter Table */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Min Shaft Diameter by Span</h2>
            <button onClick={saveShaftDiameter} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
              <Save size={13} /> Save Table
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mb-2">Ensures torsional rigidity under operating pressure.</p>
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-2">Max Blade Span (mm)</th>
                <th className="p-2">Min Shaft Dia (mm)</th>
              </tr>
            </thead>
            <tbody>
              {(data.tables.shaft_diameter?.rules_data || []).map((row, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="p-2">
                    <input
                      type="number"
                      className="w-28 p-1 border rounded text-xs"
                      value={row.max_blade_length_mm}
                      onChange={(e) => {
                        const copy = [...data.tables.shaft_diameter.rules_data];
                        copy[idx].max_blade_length_mm = Number(e.target.value);
                        setData({ ...data, tables: { ...data.tables, shaft_diameter: { ...data.tables.shaft_diameter, rules_data: copy } } });
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      className="w-24 p-1 border rounded text-xs"
                      value={row.min_shaft_dia_mm}
                      onChange={(e) => {
                        const copy = [...data.tables.shaft_diameter.rules_data];
                        copy[idx].min_shaft_dia_mm = Number(e.target.value);
                        setData({ ...data, tables: { ...data.tables, shaft_diameter: { ...data.tables.shaft_diameter, rules_data: copy } } });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Multi-Blade Bought-Out & Actuator Pricing */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Multi-Blade Bought-Out & Automation Price List (Placeholder)</h2>
            <p className="text-xs text-slate-500">Edit unit prices for bearings, seals, linkage components, and actuators.</p>
          </div>
          <button onClick={saveRates} className="px-3 py-1.5 bg-[#005daa] text-white rounded text-xs font-semibold hover:bg-[#004785] flex items-center gap-1.5">
            <Save size={14} /> Save Price List
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Bought-out Items */}
          <div>
            <h3 className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-[11px]">Bearings & Linkage Items (Rs/each)</h3>
            <div className="space-y-2">
              {Object.entries(rates.bought_out_prices || {}).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                  <span className="text-slate-600 capitalize">{key.replace(/_/g, ' ')}</span>
                  <input
                    type="number"
                    className="w-28 p-1 border rounded text-right font-mono"
                    value={val}
                    onChange={(e) => setRates({
                      ...rates,
                      bought_out_prices: { ...rates.bought_out_prices, [key]: Number(e.target.value) }
                    })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Actuator & Automation Items */}
          <div>
            <h3 className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-[11px]">Actuators & Accessories (Rs/each)</h3>
            <div className="space-y-2">
              {Object.entries(rates.automation_prices || {}).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                  <span className="text-slate-600 capitalize">{key.replace(/_/g, ' ')}</span>
                  <input
                    type="number"
                    className="w-28 p-1 border rounded text-right font-mono"
                    value={val}
                    onChange={(e) => setRates({
                      ...rates,
                      automation_prices: { ...rates.automation_prices, [key]: Number(e.target.value) }
                    })}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Blade Geometry Rules, Material Densities & Dimensional Limits */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-sm font-bold text-slate-900">Blade Design Engineering Limits & Material Densities</h2>
          <p className="text-xs text-slate-500">Governs physical dimensional constraints, density parameters, and allowed profile definitions.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Material Densities */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-[11px]">Material Densities (kg/m³)</h3>
            <p className="text-[10px] text-slate-500 mb-2">Used in theoretical sheet weight calculation: L × W × T × Density / 10⁹.</p>
            <div className="space-y-2">
              {Object.entries(data.tables?.material_densities || { 'IS 2062': 7850.0, 'Galvanized': 7850.0, 'SS 304': 7930.0, 'SS 316': 7980.0, 'Aluminum': 2700.0 }).map(([mat, dens]) => (
                <div key={mat} className="flex items-center justify-between border-b border-slate-200/60 pb-1">
                  <span className="font-medium text-slate-700">{mat}</span>
                  <span className="font-mono font-bold text-slate-900">{dens} kg/m³</span>
                </div>
              ))}
            </div>
          </div>

          {/* Permitted Blade Profiles */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-[11px]">Permitted Blade Profiles</h3>
            <p className="text-[10px] text-slate-500 mb-2">Valid profiles permitted for selection in New Quote.</p>
            <ul className="space-y-1.5 list-disc list-inside text-slate-700 font-medium">
              {(data.tables?.permitted_profiles || [
                'Flat single-skin sheet blade',
                'Folded single-skin blade',
                'Double-skin hollow blade',
                'Aerofoil blade',
                'Custom cross-section blade'
              ]).map((prof) => (
                <li key={prof} className="text-[11px] leading-tight">
                  <span className="text-slate-900 font-semibold">{prof}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Blade Dimension Limits */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-[11px]">Dimensional Safety Limits</h3>
            <p className="text-[10px] text-slate-500 mb-2">Enforced by backend rule validator.</p>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between border-b border-slate-200/60 pb-1">
                <span className="text-slate-600 font-sans">Thickness range:</span>
                <span className="font-bold text-slate-900">0.8 – 8.0 mm</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1">
                <span className="text-slate-600 font-sans">Min Clearance:</span>
                <span className="font-bold text-slate-900">2.0 mm</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1">
                <span className="text-slate-600 font-sans">Min Overlap:</span>
                <span className="font-bold text-slate-900">0 – 35 %</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1">
                <span className="text-slate-600 font-sans">Min Blade Count:</span>
                <span className="font-bold text-slate-900">2 blades</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-sans">Pitch condition:</span>
                <span className="font-bold text-emerald-800">Pitch &le; Chord</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

