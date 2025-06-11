import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

export default function FieldRenderer({ field, formValues, setFormValues }) {
  const [showInputs, setShowInputs] = useState({});
  const sigCanvasRef = useRef({});

  const evaluateConditions = (conditions) => {
    if (!conditions) return true;
    const evalClause = (clause) => {
      const value = formValues[clause.field];
      if (clause.operator === 'eq') return value === clause.value;
      if (clause.operator === 'in') return clause.value.includes(value);
      if (clause.operator === 'AND' || clause.operator === 'OR') {
        const results = clause.clauses.map(evalClause);
        return clause.operator === 'AND' ? results.every(Boolean) : results.some(Boolean);
      }
      return false;
    };
    return Array.isArray(conditions)
      ? conditions.every(evalClause)
      : evalClause(conditions);
  };

  if (field.conditions && !evaluateConditions(field.conditions)) return null;

  if (field.type === 'button' && field.action === 'openAddForm') {
    const targetFieldId = field.id.replace('add', '').replace('Button', 'Data');
    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={() =>
            setShowInputs((prev) => ({ ...prev, [targetFieldId]: true }))
          }
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow"
        >
          {field.label}
        </button>
        {showInputs[targetFieldId] && (
          <input
            type="text"
            className="mt-3 w-full px-4 py-2 border rounded shadow-sm bg-white text-gray-800"
            placeholder={`Enter ${targetFieldId.replace(/([A-Z])/g, ' $1')}`}
            value={formValues[targetFieldId] || ''}
            onChange={(e) =>
              setFormValues((prev) => ({
                ...prev,
                [targetFieldId]: e.target.value,
              }))
            }
          />
        )}
      </div>
    );
  }

  if (field.type === 'text' || field.type === 'number') {
    return (
      <div className="mb-6">
        <label className="block font-semibold text-gray-800 mb-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-500 mb-1 italic">{field.infoText}</p>
        )}
        <input
          type={field.type}
          placeholder={field.placeholder || ''}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 bg-white"
          value={formValues[field.id] || ''}
          onChange={(e) =>
            setFormValues((prev) => ({ ...prev, [field.id]: e.target.value }))
          }
        />
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="mb-6">
        <label className="block font-semibold text-gray-800 mb-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-500 mb-1 italic">{field.infoText}</p>
        )}
        <textarea
          rows={field.rows || 3}
          placeholder={field.placeholder || ''}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 bg-white"
          value={formValues[field.id] || ''}
          onChange={(e) =>
            setFormValues((prev) => ({ ...prev, [field.id]: e.target.value }))
          }
        />
      </div>
    );
  }

  if (field.type === 'radio' && field.options) {
    const selectedOption = field.options.find(
      (opt) => opt.value === formValues[field.id]
    );
    return (
      <div className="mb-6">
        <label className="block font-semibold text-gray-800 mb-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-500 mb-1 italic">{field.infoText}</p>
        )}
        <div className="mt-2 space-y-2">
          {field.options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2">
              <input
                type="radio"
                name={field.id}
                value={opt.value}
                className="accent-indigo-600"
                checked={formValues[field.id] === opt.value}
                onChange={(e) =>
                  setFormValues((prev) => ({
                    ...prev,
                    [field.id]: e.target.value,
                  }))
                }
              />
              <span className="text-gray-800">{opt.label}</span>
            </label>
          ))}
        </div>
        {selectedOption?.willClauseText && (
          <div className="mt-3 p-3 bg-indigo-100 text-indigo-900 rounded text-sm shadow-inner">
            {selectedOption.willClauseText}
          </div>
        )}
      </div>
    );
  }

  if (field.type === 'checkboxGroup' && field.options) {
    return (
      <div className="mb-6">
        <label className="block font-semibold text-gray-800 mb-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-500 mb-1 italic">{field.infoText}</p>
        )}
        <div className="mt-2 flex flex-col space-y-2">
          {field.options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-indigo-600"
                checked={
                  Array.isArray(formValues[field.id])
                    ? formValues[field.id].includes(opt.value)
                    : false
                }
                onChange={(e) => {
                  const newValue = Array.isArray(formValues[field.id])
                    ? [...formValues[field.id]]
                    : [];
                  if (e.target.checked) {
                    newValue.push(opt.value);
                  } else {
                    const index = newValue.indexOf(opt.value);
                    if (index > -1) newValue.splice(index, 1);
                  }
                  setFormValues((prev) => ({
                    ...prev,
                    [field.id]: newValue,
                  }));
                }}
              />
              <span className="text-gray-800">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'section' && field.subFields) {
    return (
      <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-lg mb-6">
        <div className="font-semibold text-indigo-700 mb-2">{field.label}</div>
        {field.infoText && (
          <p className="text-xs text-gray-600 mb-2 italic">{field.infoText}</p>
        )}
        {field.subFields.map((subField) => (
          <FieldRenderer
            key={subField.id}
            field={subField}
            formValues={formValues}
            setFormValues={setFormValues}
          />
        ))}
      </div>
    );
  }

  if (field.type === 'display') {
    return (
      <div className="bg-blue-100 text-blue-900 rounded p-3 my-4 text-sm">
        {field.text}
      </div>
    );
  }

  if (field.type === 'signature') {
    return (
      <div className="my-6">
        <label className="block font-semibold text-gray-800 mb-2">{field.label}</label>
        <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
          <SignatureCanvas
            penColor="black"
            canvasProps={{ width: 500, height: 100, className: 'sigCanvas w-full h-24' }}
            ref={(ref) => (sigCanvasRef.current[field.id] = ref)}
            onEnd={() => {
              const dataUrl = sigCanvasRef.current[field.id]?.getTrimmedCanvas()?.toDataURL('image/png');
              setFormValues((prev) => ({
                ...prev,
                [field.id]: dataUrl,
              }));
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            sigCanvasRef.current[field.id]?.clear();
            setFormValues((prev) => ({
              ...prev,
              [field.id]: '',
            }));
          }}
          className="mt-2 text-sm text-red-500 hover:underline"
        >
          Clear Signature
        </button>
        {field.subLabel && (
          <p className="text-xs text-gray-500 mt-2">{field.subLabel}</p>
        )}
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <div className="mb-6">
        <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
        </label>
        {field.infoText && <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 italic">{field.infoText}</div>}
        <input
          type="date"
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-300"
          value={formValues[field.id] || ''}
          onChange={e => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
        />
      </div>
    );
  }

  return null;
}
