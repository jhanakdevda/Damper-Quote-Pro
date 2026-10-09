import React, { useEffect, useState } from 'react';
import { 
  PlusCircle, 
  TrendingUp, 
  DollarSign, 
  FileCheck, 
  Clock, 
  ArrowUpRight, 
  FileText, 
  Download,
  Search,
  ExternalLink
} from 'lucide-react';
import { dashboardApi, quotesApi } from '../services/api';
import { formatINR, formatNumber } from '../utils/formatters';

export default function Dashboard({ setView, setSelectedQuoteId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await dashboardApi.getSummary();
      setData(res);
    } catch (err) {
      setError('Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      Draft: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
      Sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      Won: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      Lost: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-slate-100'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {
    total_quotes_this_month: 0,
    total_quoted_value_month: 0,
    avg_quote_value: 0,
    status_counts: { Draft: 0, Sent: 0, Won: 0, Lost: 0 },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome banner & primary action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-blue-300 bg-blue-800/40 px-2.5 py-1 rounded-md border border-blue-700/50">
            Damper Quote Pro • Pune Operations
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">
            Estimation & Costing Dashboard
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            Live pricing for rack-and-pinion sliding-flap dampers. Standardize quotations, protect fabrication margins, and export audit-ready Excel and PDF sheets.
          </p>
        </div>
        <button
          onClick={() => setView('new-quote')}
          className="shrink-0 flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-semibold px-5 py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02]"
        >
          <PlusCircle className="w-5 h-5" />
          <span>New Damper Quote</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Quotes This Month</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {kpis.total_quotes_this_month}
          </div>
          <p className="text-xs text-slate-500 mt-1">Generated across all roles</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Quoted Value</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatINR(kpis.total_quoted_value_month)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Current month pipeline</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Average Quote Value</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatINR(kpis.avg_quote_value)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Per damper order average</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Pipeline Status</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              {kpis.status_counts.Sent || 0} Sent
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              {kpis.status_counts.Won || 0} Won
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {kpis.status_counts.Draft || 0} Draft
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Active RFQs tracked</p>
        </div>
      </div>

      {/* Recent Quotes Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recent Quotes</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Latest cost sheets and customer quotations</p>
          </div>
          <button
            onClick={() => setView('quotes')}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>View All Quotes</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3">Quote #</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Size (W × H × D)</th>
                <th className="px-5 py-3 text-right">Qty</th>
                <th className="px-5 py-3 text-right">Quoted Total</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {data?.recent_quotes && data.recent_quotes.length > 0 ? (
                data.recent_quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                      {q.quote_number}
                    </td>
                    <td className="px-5 py-3">{q.customer_name}</td>
                    <td className="px-5 py-3 font-mono">
                      {q.width_mm} × {q.height_mm} × {q.depth_mm} mm
                    </td>
                    <td className="px-5 py-3 text-right font-mono">{q.quantity}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900 dark:text-white font-mono">
                      {formatINR(q.quoted_price_batch)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {getStatusBadge(q.status)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => quotesApi.downloadPdf(q.id)}
                          title="Download Quotation PDF"
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => quotesApi.downloadExcel(q.id)}
                          title="Download Live Excel Formula Sheet"
                          className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedQuoteId(q.id);
                            setView('quotes');
                          }}
                          className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-5 py-8 text-center text-slate-400">
                    No quotes generated yet. Click "New Damper Quote" to create the first one!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
