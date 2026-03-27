/**
 * Build valid custom questionnaire fields (IDs starting with custom_) for the editor.
 * Shapes match FieldRenderer expectations.
 */

export const CUSTOM_FIELD_TYPES = [
  { value: 'text', label: 'Single line text' },
  { value: 'textarea', label: 'Paragraph (multi-line)' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency / amount' },
  { value: 'date', label: 'Date' },
  { value: 'radio', label: 'Single choice (list / buttons)' },
  { value: 'checkboxGroup', label: 'Multiple choice (tick any)' },
];

const OPTION_TYPES = new Set(['radio', 'checkboxGroup']);

/** One option per line. Use `value|Label` to set a stable value; otherwise a value is generated. */
export function parseOptionsFromMultiline(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out = [];
  const used = new Set();
  lines.forEach((line, i) => {
    const pipe = line.indexOf('|');
    let value;
    let label;
    if (pipe !== -1) {
      value = line.slice(0, pipe).trim();
      label = line.slice(pipe + 1).trim();
    } else {
      label = line;
      const base = line
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      value = base || `opt_${i}`;
    }
    if (!label) label = value || `Option ${i + 1}`;
    let v = value || `opt_${i}`;
    let n = 0;
    while (used.has(v)) {
      n += 1;
      v = `${value || 'opt'}_${i}_${n}`;
    }
    used.add(v);
    out.push({ value: v, label });
  });
  return out;
}

export function optionsToMultiline(options) {
  if (!Array.isArray(options) || options.length === 0) return '';
  return options
    .map((o) => {
      const v = o.value;
      const l = o.label ?? o.value ?? '';
      if (String(l) === String(v)) return l;
      return `${v}|${l}`;
    })
    .join('\n');
}

function stripEmpty(obj) {
  const next = { ...obj };
  Object.keys(next).forEach((k) => {
    if (next[k] === undefined || next[k] === '') delete next[k];
  });
  return next;
}

/**
 * @param {object} params
 * @param {string} params.id - custom_* id
 * @param {string} params.type
 * @param {string} params.label
 * @param {string} [params.placeholder]
 * @param {string} [params.infoText]
 * @param {boolean} [params.required]
 * @param {string} [params.optionsText] - for radio / checkboxGroup
 * @param {number} [params.rows] - textarea rows
 */
export function createCustomField({
  id,
  type,
  label,
  placeholder,
  infoText,
  required,
  optionsText,
  rows,
}) {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid field id');
  }
  const t = type || 'text';
  const base = stripEmpty({
    id,
    label: (label || '').trim() || 'New question',
    required: required ? true : undefined,
    infoText: (infoText || '').trim() || undefined,
  });

  if (OPTION_TYPES.has(t)) {
    const options = parseOptionsFromMultiline(optionsText);
    if (options.length < 1) {
      throw new Error('Add at least one answer option (one per line).');
    }
    if (t === 'radio') {
      return stripEmpty({
        ...base,
        type: 'radio',
        options,
        value: null,
      });
    }
    return stripEmpty({
      ...base,
      type: 'checkboxGroup',
      options,
      value: [],
    });
  }

  if (t === 'textarea') {
    return stripEmpty({
      ...base,
      type: 'textarea',
      value: '',
      placeholder: (placeholder || '').trim() || undefined,
      rows: typeof rows === 'number' && rows > 0 ? rows : undefined,
    });
  }

  if (t === 'date') {
    return stripEmpty({
      ...base,
      type: 'date',
      value: '',
      placeholder: (placeholder || '').trim() || 'dd/mm/yyyy',
    });
  }

  if (t === 'number' || t === 'currency') {
    return stripEmpty({
      ...base,
      type: t,
      value: '',
      placeholder: (placeholder || '').trim() || undefined,
    });
  }

  return stripEmpty({
    ...base,
    type: 'text',
    value: '',
    placeholder: (placeholder || '').trim() || undefined,
  });
}

/**
 * Apply edits to an existing field; used by FieldEditModal for custom_* fields.
 * Preserves id and non-UI keys (conditions, willClauseText, etc.) where possible.
 */
export function mergeCustomFieldEdit(field, patch) {
  const {
    label,
    placeholder,
    infoText,
    required,
    optionsText,
    rows,
  } = patch;
  const next = {
    ...field,
    label: label ?? field.label,
    required: required ? true : undefined,
    infoText: (infoText || '').trim() || undefined,
  };
  if (!next.required) delete next.required;

  const t = field.type;
  if (OPTION_TYPES.has(t)) {
    const options = parseOptionsFromMultiline(optionsText);
    if (options.length < 1) {
      throw new Error('Add at least one answer option (one per line).');
    }
    next.options = options;
    if (t === 'radio') {
      const v = field.value !== undefined ? field.value : null;
      const ok = v != null && options.some((o) => o.value === v);
      next.value = ok ? v : null;
    } else {
      const prev = Array.isArray(field.value) ? field.value : [];
      const allowed = new Set(options.map((o) => o.value));
      next.value = prev.filter((x) => allowed.has(x));
    }
    return stripEmpty(next);
  }

  if (t === 'textarea') {
    next.placeholder = (placeholder || '').trim() || undefined;
    const r = typeof rows === 'number' && rows > 0 ? rows : field.rows;
    if (r) next.rows = r;
    else delete next.rows;
    return stripEmpty(next);
  }

  if (t === 'date' || t === 'text' || t === 'number' || t === 'currency') {
    next.placeholder = (placeholder || '').trim() || undefined;
    return stripEmpty(next);
  }

  return stripEmpty(next);
}
