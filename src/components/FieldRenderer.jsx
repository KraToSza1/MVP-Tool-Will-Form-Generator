import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import DatePicker from 'react-datepicker';
import { registerLocale, setDefaultLocale } from 'react-datepicker';
import { enGB } from 'date-fns/locale';
import { Plus, X, Check, User, Mail, Phone, MapPin, Calendar, FileText, Edit, Trash2, PenTool, Info, AlertCircle, CheckCircle2, Upload } from 'lucide-react';

import 'react-datepicker/dist/react-datepicker.css';
import {
  validateUKPostcode,
  formatUKPostcode,
  validateUKPhoneNumber,
  formatUKPhoneNumber,
  formatUKDate,
  ukDateToISO,
  getUKAddressExample,
} from '../utils/ukValidations';

// Register UK locale for date picker
registerLocale('en-GB', enGB);
setDefaultLocale('en-GB');

export default function FieldRenderer({ field, formValues, setFormValues }) {
  
  const [showInputs, setShowInputs] = useState({});
  const [inputValues, setInputValues] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const sigCanvasRef = useRef({});
  const inputRefs = useRef({});
  
  // Icon mapping for field types
  const getFieldIcon = (fieldType, fieldId) => {
    if (fieldId?.toLowerCase().includes('email')) return <Mail size={16} />;
    if (fieldId?.toLowerCase().includes('phone') || fieldId?.toLowerCase().includes('mobile') || fieldId?.toLowerCase().includes('tel')) return <Phone size={16} />;
    if (fieldId?.toLowerCase().includes('address') || fieldId?.toLowerCase().includes('postcode')) return <MapPin size={16} />;
    if (fieldType === 'date') return <Calendar size={16} />;
    if (fieldType === 'signature') return <PenTool size={16} />;
    if (fieldType === 'textarea') return <FileText size={16} />;
    if (fieldId?.toLowerCase().includes('name')) return <User size={16} />;
    return <Edit size={16} />;
  };

  // Helper function to log form value changes (minimal logging)
  const logFormChange = (fieldId, value, changeType = 'UPDATE') => {
    // Only log errors for corrupted data
    if (typeof value === 'number' && (!isFinite(value) || Math.abs(value) >= 1e10 || isNaN(value))) {
      console.error(`[FORM] Invalid number in field "${fieldId}":`, value);
    } else if (typeof value === 'string' && (value.includes('-1.8e+') || value.includes('1.8e+22'))) {
      console.error(`[FORM] Corrupted data in field "${fieldId}"`);
    }
  };

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

  if (field.conditions && !evaluateConditions(field.conditions)) {
    return null;
  }

  if (field.type === 'button' && field.action === 'openAddForm') {
    const targetFieldId = field.id.replace('add', '').replace('Button', 'Data');
    const currentInputValue = inputValues[targetFieldId] || '';
    const existingItems = Array.isArray(formValues[targetFieldId]) 
      ? formValues[targetFieldId] 
      : (formValues[targetFieldId] ? [formValues[targetFieldId]] : []);

    const handleAddItem = () => {
      if (!currentInputValue.trim()) {
        return;
      }

      const newItem = currentInputValue.trim();
      const updatedItems = [...existingItems, newItem];
      
      
      setFormValues((prev) => ({
        ...prev,
        [targetFieldId]: updatedItems,
      }));

      // Clear input and close it
      setInputValues((prev) => ({ ...prev, [targetFieldId]: '' }));
      setShowInputs((prev) => ({ ...prev, [targetFieldId]: false }));
    };

    const handleRemoveItem = (indexToRemove) => {
      const itemToRemove = existingItems[indexToRemove];
      const updatedItems = existingItems.filter((_, index) => index !== indexToRemove);
      setFormValues((prev) => ({
        ...prev,
        [targetFieldId]: updatedItems.length > 0 ? updatedItems : [],
      }));
    };

    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddItem();
      }
    };

    return (
      <div className="mb-4 animate-slideIn">
        {/* Enhanced Add Button */}
        <button
          type="button"
          onClick={() => {
            setShowInputs((prev) => ({ ...prev, [targetFieldId]: true }));
            setTimeout(() => {
              inputRefs.current[targetFieldId]?.focus();
            }, 100);
          }}
          className="group bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transform hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          <span>{field.label}</span>
        </button>

        {/* Enhanced Input Form with Animation */}
        {showInputs[targetFieldId] && (
          <div className="mt-4 p-5 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl shadow-lg animate-slideDown">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Edit size={18} />
                </div>
                <input
                  ref={(ref) => (inputRefs.current[targetFieldId] = ref)}
                  type="text"
                  className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 bg-white transition-all duration-300 shadow-sm focus:shadow-md"
                  placeholder={`Enter ${targetFieldId.replace(/([A-Z])/g, ' $1').replace('Data', '')} (press Enter to add)`}
                  value={currentInputValue}
                  onChange={(e) =>
                    setInputValues((prev) => ({ ...prev, [targetFieldId]: e.target.value }))
                  }
                  onKeyPress={handleKeyPress}
                />
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!currentInputValue.trim()}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-5 py-3 rounded-xl shadow-md transition-all duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transform hover:scale-105 active:scale-95 disabled:transform-none"
              >
                <Check className="w-5 h-5" />
                <span>Add</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInputs((prev) => ({ ...prev, [targetFieldId]: false }));
                  setInputValues((prev) => ({ ...prev, [targetFieldId]: '' }));
                }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-5 py-3 rounded-xl transition-all duration-300 font-medium flex items-center gap-2 transform hover:scale-105 active:scale-95"
              >
                <X className="w-5 h-5" />
                <span>Cancel</span>
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2 flex items-center gap-2">
              <Info size={14} />
              <span>Press Enter or click Add to save. You can add multiple items.</span>
            </p>
          </div>
        )}

        {/* Enhanced List of Added Items */}
        {existingItems.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-500" />
              <span>Added ({existingItems.length}):</span>
            </p>
            {existingItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-white border border-gray-300 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-[1.02] group"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <span className="text-gray-800 flex-1 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                    {index + 1}
                  </div>
                  {item}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="ml-3 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-all duration-300 flex items-center gap-2 transform hover:scale-110 active:scale-95"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (field.type === 'text' || field.type === 'number') {
    // UK-specific field handling
    const isPostcode = field.id === 'postcode' || field.id.toLowerCase().includes('postcode');
    const isPhone = field.id === 'mobile' || field.id === 'tel2' || field.id.toLowerCase().includes('phone') || field.id.toLowerCase().includes('tel');
    const isEmail = field.id === 'email' || field.id.toLowerCase().includes('email');
    const isName = field.id === 'firstName' || field.id === 'lastName' || field.id === 'middleName' || field.id.toLowerCase().includes('name');
    
    const validateEmail = (email) => {
      if (!email) return true; // Empty is okay, required validation handles that
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };
    
    const validateName = (name) => {
      if (!name) return true; // Empty is okay, required validation handles that
      // Name should be at least 2 characters, contain letters, spaces, hyphens, apostrophes
      const nameRegex = /^[a-zA-Z\s\-']+$/;
      if (name.length < 2) return false;
      if (!nameRegex.test(name)) return false;
      return true;
    };
    
    const handleChange = (e) => {
      let value = e.target.value;
      const isBlur = e.type === 'blur';
      
      // Clear previous errors on change (validate on blur)
      if (!isBlur) {
        setValidationErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field.id];
          return newErrors;
        });
      }
      
      // Format and validate postcode
      if (isPostcode) {
        if (isBlur) {
          const formatted = formatUKPostcode(value);
          if (formatted && formatted !== value) {
            value = formatted;
          }
          // Validate postcode
          if (value && !validateUKPostcode(value)) {
            setValidationErrors((prev) => ({ ...prev, [field.id]: 'Please enter a valid UK postcode (e.g., SW1A 1AA or M1 1AA)' }));
          } else if (field.required && !value) {
            setValidationErrors((prev) => ({ ...prev, [field.id]: 'This field is required. Please enter a postcode.' }));
          } else {
            setValidationErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors[field.id];
              return newErrors;
            });
          }
        }
      }
      
      // Format and validate phone number
      if (isPhone) {
        if (isBlur) {
          const formatted = formatUKPhoneNumber(value);
          if (formatted && formatted !== value) {
            value = formatted;
          }
          // Validate phone number
          if (value && !validateUKPhoneNumber(value)) {
            setValidationErrors((prev) => ({ ...prev, [field.id]: 'Please enter a valid UK phone number (e.g., 07123 456789 or 020 1234 5678)' }));
          } else if (field.required && !value) {
            setValidationErrors((prev) => ({ ...prev, [field.id]: 'This field is required. Please enter a phone number.' }));
          } else {
            setValidationErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors[field.id];
              return newErrors;
            });
          }
        }
      }
      
      // Validate email
      if (isEmail && isBlur) {
        if (value && !validateEmail(value)) {
          setValidationErrors((prev) => ({ ...prev, [field.id]: 'Please enter a valid email address (e.g., name@example.com)' }));
        } else if (field.required && !value) {
          setValidationErrors((prev) => ({ ...prev, [field.id]: 'This field is required. Please enter an email address.' }));
        } else {
          setValidationErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[field.id];
            return newErrors;
          });
        }
      }
      
      // Validate name fields
      if (isName && isBlur) {
        if (value && !validateName(value)) {
          setValidationErrors((prev) => ({ ...prev, [field.id]: 'Please enter a valid name (letters only, at least 2 characters)' }));
        } else if (field.required && !value) {
          setValidationErrors((prev) => ({ ...prev, [field.id]: 'This field is required. Please enter a name.' }));
        } else {
          setValidationErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[field.id];
            return newErrors;
          });
        }
      }
      
      // Validate required fields (generic)
      if (!isPostcode && !isPhone && !isEmail && !isName && isBlur) {
        if (field.required && !value.trim()) {
          setValidationErrors((prev) => ({ ...prev, [field.id]: `This field is required. Please enter ${field.label.toLowerCase()}.` }));
        } else {
          setValidationErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[field.id];
            return newErrors;
          });
        }
      }
      
      logFormChange(field.id, value, 'TEXT/NUMBER');
      setFormValues((prev) => ({ ...prev, [field.id]: value }));
    };

    // Get UK-specific placeholder
    let placeholder = field.placeholder || '';
    if (isPostcode && !placeholder) {
      placeholder = 'e.g., SW1A 1AA';
    } else if (isPhone && !placeholder) {
      placeholder = field.id === 'mobile' ? 'e.g., 07123 456789' : 'e.g., 020 1234 5678';
    }

    const FieldIcon = getFieldIcon(field.type, field.id);
    
    return (
      <div className="mb-4 group">
        <label className="block font-semibold text-gray-800 mb-1.5 flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600">
            {FieldIcon}
          </div>
          <span>{field.label}</span>
          {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-600 mb-1.5 italic flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{field.infoText}</span>
          </p>
        )}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {FieldIcon}
          </div>
          <input
            type={field.type}
            placeholder={placeholder}
            className={`w-full border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 bg-white transition-all duration-300 shadow-sm focus:shadow-md ${
              validationErrors[field.id] ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
            }`}
            value={formValues[field.id] || ''}
            onChange={handleChange}
            onBlur={handleChange}
          />
        </div>
        {validationErrors[field.id] && (
          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{validationErrors[field.id]}</span>
          </p>
        )}
        {isPostcode && !validationErrors[field.id] && (
          <p className="text-xs text-gray-500 mt-1.5">UK postcode format (e.g., SW1A 1AA, M1 1AA)</p>
        )}
        {isPhone && !validationErrors[field.id] && (
          <p className="text-xs text-gray-500 mt-1.5">UK phone number (mobile: 07123 456789, landline: 020 1234 5678)</p>
        )}
      </div>
    );
  }

  if (field.type === 'textarea') {
    const FieldIcon = getFieldIcon(field.type, field.id);
    
    const handleTextareaChange = (e) => {
      const value = e.target.value;
      const isBlur = e.type === 'blur';
      
      // Clear previous errors on change (validate on blur)
      if (!isBlur) {
        setValidationErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field.id];
          return newErrors;
        });
      }
      
      // Validate required fields on blur
      if (isBlur && field.required && !value.trim()) {
        setValidationErrors((prev) => ({ ...prev, [field.id]: `This field is required. Please enter ${field.label.toLowerCase()}.` }));
      } else if (isBlur) {
        setValidationErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field.id];
          return newErrors;
        });
      }
      
      logFormChange(field.id, value, 'TEXTAREA');
      setFormValues((prev) => ({ ...prev, [field.id]: value }));
    };
    
    return (
      <div className="mb-4 group" data-field-id={field.id}>
        <label className="block font-semibold text-gray-800 mb-1.5 flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600">
            {FieldIcon}
          </div>
          <span>{field.label}</span>
          {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-600 mb-1.5 italic flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{field.infoText}</span>
          </p>
        )}
        <div className="relative">
          <div className="absolute left-3 top-3 text-gray-400 pointer-events-none">
            {FieldIcon}
          </div>
          <textarea
            rows={field.rows || 4}
            placeholder={field.placeholder || ''}
            className={`w-full border rounded-xl pl-10 pr-4 py-3 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 bg-white transition-all duration-300 shadow-sm focus:shadow-md ${
              validationErrors[field.id] ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
            }`}
            value={formValues[field.id] || ''}
            onChange={handleTextareaChange}
            onBlur={handleTextareaChange}
          />
        </div>
        {validationErrors[field.id] && (
          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{validationErrors[field.id]}</span>
          </p>
        )}
      </div>
    );
  }

  if (field.type === 'radio' && field.options) {
    const selectedOption = field.options.find(
      (opt) => opt.value === formValues[field.id]
    );
    const FieldIcon = getFieldIcon(field.type, field.id);
    
    return (
      <div className="mb-4 group" data-field-id={field.id}>
        <label className="block font-semibold text-gray-800 mb-1.5 flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600">
            {FieldIcon}
          </div>
          <span>{field.label}</span>
          {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-600 mb-1.5 italic flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{field.infoText}</span>
          </p>
        )}
        <div className={`mt-2 ${field.id === 'title' ? 'flex flex-wrap gap-2' : 'space-y-1'}`}>
          {field.options.map((opt) => (
            <label key={opt.value} className={`flex items-center gap-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 cursor-pointer border border-transparent hover:border-indigo-200 ${
              field.id === 'title' 
                ? 'px-3 py-2 bg-white shadow-sm hover:shadow-md' 
                : 'px-2 py-1.5'
            }`}>
              <input
                type="radio"
                name={field.id}
                value={opt.value}
                className="accent-indigo-600 w-4 h-4"
                checked={formValues[field.id] === opt.value}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      logFormChange(field.id, newValue, 'RADIO');
                      
                      // Clear validation errors when selection is made
                      setValidationErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors[field.id];
                        return newErrors;
                      });
                      
                      setFormValues((prev) => ({
                        ...prev,
                        [field.id]: newValue,
                      }));
                    }}
              />
              <span className={`text-gray-800 ${field.id === 'title' ? '' : 'flex-1'}`}>{opt.label}</span>
            </label>
          ))}
        </div>
        {validationErrors[field.id] && (
          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{validationErrors[field.id]}</span>
          </p>
        )}
        {selectedOption?.willClauseText && (() => {
          const hasUnresolvedPlaceholders = /\{\{field:[^}]+\}\}/.test(selectedOption.willClauseText);
          if (hasUnresolvedPlaceholders) {
            return null;
          }
          
          return (
            <div className="mt-2 p-2 bg-indigo-100 text-indigo-900 rounded-lg text-sm shadow-inner border border-indigo-200">
              {selectedOption.willClauseText}
            </div>
          );
        })()}
      </div>
    );
  }

  if (field.type === 'checkboxGroup' && field.options) {
    const FieldIcon = getFieldIcon(field.type, field.id);
    
    return (
      <div className="mb-4 group" data-field-id={field.id}>
        <label className="block font-semibold text-gray-800 mb-1.5 flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600">
            {FieldIcon}
          </div>
          <span>{field.label}</span>
          {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-600 mb-1.5 italic flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{field.infoText}</span>
          </p>
        )}
        <div className="mt-2 flex flex-col space-y-1">
          {field.options.map((opt) => {
            const optValue = (opt.value !== undefined && opt.value !== false && opt.value !== null && opt.value !== '') 
              ? opt.value 
              : (opt.id || opt.label);
            const isChecked = Array.isArray(formValues[field.id])
              ? formValues[field.id].includes(optValue)
              : false;
            
            return (
              <label key={optValue || opt.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded-lg transition-colors duration-200 border border-transparent hover:border-indigo-200">
                <input
                  type="checkbox"
                  className="accent-indigo-600 w-4 h-4"
                  checked={isChecked}
                  onChange={(e) => {
                    const newValue = Array.isArray(formValues[field.id])
                      ? [...formValues[field.id]]
                      : [];
                    const action = e.target.checked ? 'CHECKED' : 'UNCHECKED';
                    if (e.target.checked) {
                      newValue.push(optValue);
                    } else {
                      const index = newValue.indexOf(optValue);
                      if (index > -1) newValue.splice(index, 1);
                    }
                    // Clear validation errors when selection is made
                    if (newValue.length > 0 || !field.required) {
                      setValidationErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors[field.id];
                        return newErrors;
                      });
                    } else if (field.required && newValue.length === 0) {
                      setValidationErrors((prev) => ({ ...prev, [field.id]: `This field is required. Please select at least one option.` }));
                    }
                    
                    logFormChange(field.id, newValue, 'CHECKBOX GROUP');
                    setFormValues((prev) => ({
                      ...prev,
                      [field.id]: newValue,
                    }));
                  }}
                />
                <span className="text-gray-800 flex-1">{opt.label}</span>
              </label>
            );
          })}
        </div>
        {validationErrors[field.id] && (
          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{validationErrors[field.id]}</span>
          </p>
        )}
      </div>
    );
  }

  if (field.type === 'section' && field.subFields) {
    const isAddressSection = field.label.toLowerCase().includes('address');
    
    return (
      <div className="bg-indigo-50 border-l-4 border-indigo-600 p-3 rounded-lg mb-4 transition-colors duration-300">
        <div className="font-semibold text-indigo-700 mb-1.5">{field.label}</div>
        {field.infoText && (
          <p className="text-xs text-gray-600 mb-1.5 italic">{field.infoText}</p>
        )}
        {isAddressSection && (
          <p className="text-xs text-gray-600 mb-1.5 italic">UK address format: {getUKAddressExample()}</p>
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
    const FieldIcon = getFieldIcon(field.type, field.id);
    
    return (
      <div className="my-4 group">
        <label className="block font-semibold text-gray-800 mb-1.5 flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600">
            {FieldIcon}
          </div>
          <span>{field.label}</span>
          {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
        </label>
        <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm transition-colors duration-300">
          <SignatureCanvas
            penColor="black"
            canvasProps={{ width: 500, height: 100, className: 'sigCanvas w-full h-24' }}
            ref={(ref) => (sigCanvasRef.current[field.id] = ref)}
            onEnd={() => {
              try {
                const canvas = sigCanvasRef.current[field.id];
                if (!canvas) return;
                
                let dataUrl = null;
                
                try {
                  const trimmedCanvas = canvas.getTrimmedCanvas();
                  if (trimmedCanvas && typeof trimmedCanvas.toDataURL === 'function') {
                    dataUrl = trimmedCanvas.toDataURL('image/png');
                  }
                } catch (trimError) {
                  console.warn('getTrimmedCanvas failed, falling back to regular canvas:', trimError);
                  if (canvas && canvas.getCanvas && typeof canvas.getCanvas().toDataURL === 'function') {
                    dataUrl = canvas.getCanvas().toDataURL('image/png');
                  }
                }
                
                if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image')) {
                  logFormChange(field.id, dataUrl ? 'Signature data URL' : null, 'SIGNATURE');
                  
                  // Clear validation errors when signature is captured
                  setValidationErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors[field.id];
                    return newErrors;
                  });
                  
                  setFormValues((prev) => ({
                    ...prev,
                    [field.id]: dataUrl,
                  }));
                } else {
                  console.warn('Invalid signature data URL generated');
                  if (field.required) {
                    setValidationErrors((prev) => ({ ...prev, [field.id]: 'This field is required. Please provide a signature.' }));
                  }
                }
              } catch (error) {
                console.error('Error processing signature:', error);
              }
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            sigCanvasRef.current[field.id]?.clear();
            
            // Set validation error if required when clearing
            if (field.required) {
              setValidationErrors((prev) => ({ ...prev, [field.id]: 'This field is required. Please provide a signature.' }));
            } else {
              setValidationErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field.id];
                return newErrors;
              });
            }
            
            setFormValues((prev) => ({
              ...prev,
              [field.id]: '',
            }));
          }}
          className="mt-2 px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-300 font-medium"
        >
          Clear Signature
        </button>
        {field.subLabel && (
          <p className="text-xs text-gray-500 mt-2">{field.subLabel}</p>
        )}
        {validationErrors[field.id] && (
          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{validationErrors[field.id]}</span>
          </p>
        )}
      </div>
    );
  }

  if (field.type === 'date') {
    const dateValue = formValues[field.id]
      ? (formValues[field.id].match(/^\d{4}-\d{2}-\d{2}$/) 
          ? new Date(formValues[field.id]) 
          : ukDateToISO(formValues[field.id]) 
          ? new Date(ukDateToISO(formValues[field.id]))
          : null)
      : null;

    const isValidDate = dateValue && !isNaN(dateValue.getTime());
    const FieldIcon = getFieldIcon(field.type, field.id);

    return (
      <div className="mb-4 group" data-field-id={field.id}>
        <label className="block font-semibold text-gray-800 mb-1.5 flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600">
            {FieldIcon}
          </div>
          <span>{field.label}</span>
          {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-600 mb-1.5 italic flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{field.infoText}</span>
          </p>
        )}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
            {FieldIcon}
          </div>
          <DatePicker
            selected={isValidDate ? dateValue : null}
            onChange={(date) => {
              if (date) {
                const isoDate = date.toISOString().split('T')[0];
                logFormChange(field.id, isoDate, 'DATE');
                
                // Validate date
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const selectedDate = new Date(date);
                selectedDate.setHours(0, 0, 0, 0);
                
                // Clear errors if valid
                setValidationErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors[field.id];
                  return newErrors;
                });
                
                setFormValues((prev) => ({ ...prev, [field.id]: isoDate }));
              } else {
                if (field.required) {
                  setValidationErrors((prev) => ({ ...prev, [field.id]: 'This field is required. Please select a date.' }));
                }
                setFormValues((prev) => ({ ...prev, [field.id]: '' }));
              }
            }}
            dateFormat="dd/MM/yyyy"
            placeholderText="DD/MM/YYYY"
            locale="en-GB"
            showYearDropdown
            showMonthDropdown
            dropdownMode="select"
            maxDate={new Date()}
            withPortal
            portalId="root-portal"
            popperPlacement="bottom-start"
            popperModifiers={[
              {
                name: 'offset',
                options: {
                  offset: [0, 8],
                },
              },
              {
                name: 'preventOverflow',
                options: {
                  rootBoundary: 'viewport',
                  boundary: 'viewport',
                  padding: 8,
                },
              },
              {
                name: 'flip',
                options: {
                  fallbackPlacements: ['top-start', 'bottom-start'],
                  boundary: 'viewport',
                },
              },
            ]}
            customInput={
              <input
                readOnly
                className={`w-full border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 bg-white transition-all duration-300 shadow-sm focus:shadow-md cursor-pointer ${
                  validationErrors[field.id] ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
                }`}
              />
            }
          />
        </div>
        {validationErrors[field.id] && (
          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{validationErrors[field.id]}</span>
          </p>
        )}
        {formValues[field.id] && isValidDate && !validationErrors[field.id] && (
          <p className="text-xs text-gray-500 mt-1">
            Selected: {formatUKDate(formValues[field.id])}
          </p>
        )}
      </div>
    );
  }

  return null;
}
