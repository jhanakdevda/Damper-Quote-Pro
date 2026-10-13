/**
 * Safe client-side mathematical formula evaluator for parametric engineering costing.
 * Evaluates algebraic formulas with custom parameters, constants, and math functions.
 */

export const DEFAULT_FORMULAS = {
  plateWeight: 'L * W * T * density * qty',
  roundWeight: '0.785 * d * d * length * density * qty',
  rawMaterial: 'weight * rate',
  machiningLabour: '((L + W) * 2 * T * labour_rate / labour_divisor + mc + rolling) * qty',
  boughtOut: 'racks + pinions + bearings + hardware + gland_packing + (finishing_rate * total_weight)',
  fabrication: 'total_weight * fabrication_rate',
  totalCost: 'raw_material + machining + bought_out + automation + fabrication',
  quotedPrice: 'total_cost * (1 + markup_pct / 100)',
  bladeCount: 'ceil(height / pitch)',
  bladeSpan: '(width / sections) - (2 * clearance)',
  bladeChord: '(height / count) * (1 + overlap_pct / 100)',
  bladeWeight: 'chord * span * thickness * density',
  tieRod: 'height * sections',
  edgeSeals: 'span * count * 2 + (2 * height)',
};

export function evaluateFormula(expression, context = {}, fallbackValue = 0) {
  if (!expression || typeof expression !== 'string') return fallbackValue;
  try {
    let expr = expression
      .trim()
      .replace(/\^/g, '**')
      .replace(/\bceil\b/gi, 'Math.ceil')
      .replace(/\bfloor\b/gi, 'Math.floor')
      .replace(/\bround\b/gi, 'Math.round')
      .replace(/\bsqrt\b/gi, 'Math.sqrt')
      .replace(/\bpow\b/gi, 'Math.pow')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\bmax\b/gi, 'Math.max')
      .replace(/\bmin\b/gi, 'Math.min');

    // Only allow alphanumeric characters, math symbols, parentheses, dot, comma
    const safeRegex = /^[a-zA-Z0-9_\s\+\-\*\/\.\(\)\,\<\>\=\?\:\%\&\|\!]+$/;
    if (!safeRegex.test(expr)) {
      return fallbackValue;
    }

    const keys = Object.keys(context);
    const values = Object.values(context).map(v => (v === undefined || v === null || isNaN(v)) ? 0 : Number(v));

    const fn = new Function(...keys, `return (${expr});`);
    const result = fn(...values);

    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return result;
    }
    return fallbackValue;
  } catch (err) {
    return fallbackValue;
  }
}

export function validateFormulaSyntax(expression, sampleContext = {}) {
  if (!expression || typeof expression !== 'string' || !expression.trim()) {
    return { valid: false, error: 'Formula expression cannot be empty' };
  }
  try {
    let expr = expression
      .trim()
      .replace(/\^/g, '**')
      .replace(/\bceil\b/gi, 'Math.ceil')
      .replace(/\bfloor\b/gi, 'Math.floor')
      .replace(/\bround\b/gi, 'Math.round')
      .replace(/\bsqrt\b/gi, 'Math.sqrt')
      .replace(/\bpow\b/gi, 'Math.pow')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\bmax\b/gi, 'Math.max')
      .replace(/\bmin\b/gi, 'Math.min');

    const safeRegex = /^[a-zA-Z0-9_\s\+\-\*\/\.\(\)\,\<\>\=\?\:\%\&\|\!]+$/;
    if (!safeRegex.test(expr)) {
      return { valid: false, error: 'Contains unsupported characters' };
    }

    const keys = Object.keys(sampleContext);
    const values = Object.values(sampleContext).map(v => Number(v) || 1);
    const fn = new Function(...keys, `return (${expr});`);
    const testResult = fn(...values);

    if (typeof testResult === 'number' && !isNaN(testResult) && isFinite(testResult)) {
      return { valid: true, sampleResult: testResult };
    }
    return { valid: false, error: 'Formula evaluated to NaN or non-numeric result' };
  } catch (err) {
    return { valid: false, error: err.message || 'Syntax error in expression' };
  }
}
