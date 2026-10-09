export function formatINR(val, includeSymbol = true) {
  if (val === null || val === undefined || isNaN(val)) return '-';
  const num = Number(val);
  
  // Format in Indian locale (en-IN)
  const formatted = num.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  
  return includeSymbol ? `₹ ${formatted}` : formatted;
}

export function formatNumber(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return Number(val).toLocaleString('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

export function formatWeight(kg) {
  if (kg === null || kg === undefined || isNaN(kg)) return '0.00 kg';
  return `${Number(kg).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} kg`;
}

export function formatPct(val) {
  if (val === null || val === undefined || isNaN(val)) return '0.00%';
  return `${Number(val).toFixed(2)}%`;
}

export function formatPercent(val) {
  return formatPct(val);
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
