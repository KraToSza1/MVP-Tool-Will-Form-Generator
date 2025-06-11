import React, { useState, useEffect } from 'react';
import formData from '../data/Complete-WillSuite-Form-Data.json';
import Sidebar from './Sidebar.jsx';
import FieldRenderer from './FieldRenderer.jsx';
import { Download } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PDFDocument from './PDFDocument.jsx';

export default function FormRenderer() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [formValues, setFormValues] = useState(() => {
    const saved = localStorage.getItem('willForm');
    return saved ? JSON.parse(saved) : {};
  });
  const [submitted, setSubmitted] = useState(false);
  const [expandedFields, setExpandedFields] = useState({});
  const currentSection = formData.formSections[currentIndex];

  // ---------------------------
  // Text Interpolation Logic
  // ---------------------------
  const interpolateText = (text, values) => {
    if (typeof text !== 'string') return text;

    const fallbackMap = {
      guardiansSection: 'guardianData',
      substituteGuardiansSection: 'substituteGuardianData',
      guardianshipDetailsSection: 'guardianshipDetailsData',
      signingOnBehalfSection: 'signingOnBehalfData',
      interpreterSection: 'interpreterData',
      chattelRecipientsSection: 'chattelRecipientsData',
      excludedPersonSection: 'excludedPersonData',
      petCarerSection: 'petCarerData',
      substitutePetCarerSection: 'substitutePetCarerData',
      professionalTrusteesSection: 'professionalTrusteeData',
      substituteProfessionalTrusteesSection: 'substituteProfessionalTrusteeData',
      separateTrusteesSection: 'separateTrusteeData',
      monetaryGiftsSection: 'monetaryGiftsDetails',
      specificGiftsSection: 'specificGiftsDetails',
      propertyGiftsSection: 'propertyGiftsDetails',
      debtorsSection: 'debtorsData'
    };

    const interpolated = text.replace(/\{\{field:([^}]+)\}\}/g, (_, fullKey) => {
      const [sectionId, subField] = fullKey.split(':');

      if (subField === 'fullDetails' || subField === 'fullList') {
        const fallbackId = fallbackMap[sectionId] || `${sectionId}Data`;
        const array = values[fallbackId] || values[sectionId] || [];
        if (Array.isArray(array) && array.length > 0) {
          return array.map(item =>
            typeof item === 'object'
              ? Object.values(item).filter(Boolean).join(', ')
              : item
          ).join('; ');
        }
        return '';
      }

      const customValue = values[`${sectionId}:${subField}`] || values[`${sectionId}${subField}`] || values[`${sectionId}_${subField}`];
      if (customValue) return customValue;

      const value = values[fullKey] || values[sectionId] || '';
      return (typeof value === 'string' || typeof value === 'number') && value !== '' ? value : '';
    });

    return interpolated.replace(/\{\{field:[^}]+\}\}/g, '');
  };

  // ---------------------------
  // Validation: Required Fields
  // ---------------------------
  const allRequiredFilled = currentSection.fields.every(field => {
    if (field.required) {
      if (field.type === 'checkboxGroup') {
        return Array.isArray(formValues[field.id]) && formValues[field.id].length > 0;
      }
      return !!formValues[field.id];
    }
    return true;
  });

  const isFormFullyCompleted = () => {
    return formData.formSections.every(section =>
      section.fields.every(field => {
        if (field.required) {
          if (field.type === 'checkboxGroup') {
            return Array.isArray(formValues[field.id]) && formValues[field.id].length > 0;
          }
          return !!formValues[field.id];
        }
        return true;
      })
    );
  };

  // ---------------------------
  // Navigation Logic
  // ---------------------------
  const goNext = () => {
    if (currentIndex < formData.formSections.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setSubmitted(true);
      localStorage.removeItem('willForm');
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const saveDraft = () => {
    localStorage.setItem('willForm', JSON.stringify(formValues));
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} />

      {/* Main Content */}
      <main className="flex-1 flex justify-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl bg-white rounded-xl shadow-md p-6 sm:p-10">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / formData.formSections.length) * 100}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1 text-right">
              Step {currentIndex + 1} of {formData.formSections.length}
            </div>
          </div>

          {/* Title & PDF Download */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              {formData.formTitle || 'Legacy Last Will & Testament Questionnaire'}
            </h1>

            {isFormFullyCompleted() ? (
              <PDFDownloadLink
                document={<PDFDocument formValues={formValues} />}
                fileName="Will-Preview.pdf"
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow transition"
              >
                {({ loading }) => loading ? 'Generating PDF...' : (<><Download size={18} /><span>Download PDF</span></>)}
              </PDFDownloadLink>
            ) : (
              <span className="text-sm text-gray-400 italic">Complete all required fields to enable download</span>
            )}
          </div>

          {/* Section Header */}
          <h2 className="text-xl font-semibold border-b pb-2 mb-8 text-gray-700 border-indigo-600">
            {currentSection.formSection}
          </h2>

          {/* Fields */}
          <div className="space-y-8">
            {currentSection.fields.map((field) => (
              <div key={field.id}>
                <FieldRenderer
                  field={{ ...field, willClauseText: interpolateText(field.willClauseText, formValues) }}
                  formValues={formValues}
                  setFormValues={setFormValues}
                  expandedFields={expandedFields}
                  setExpandedFields={setExpandedFields}
                />
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row justify-between mt-12 gap-4">
            <button
              onClick={goBack}
              disabled={currentIndex === 0}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded disabled:opacity-50 transition duration-200"
            >
              Back
            </button>
            <button
              onClick={goNext}
              disabled={!allRequiredFilled}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl shadow-lg transition disabled:opacity-50"
            >
              {currentIndex === formData.formSections.length - 1 ? 'Submit' : 'Next'}
            </button>
          </div>

          {/* Save + Preview */}
          <div className="mt-6 flex flex-col sm:flex-row gap-4 items-start">
            <button
              onClick={saveDraft}
              className="bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded shadow transition duration-200"
              type="button"
            >
              Save Draft
            </button>

            <aside className="flex-1 bg-gray-100 border border-gray-300 p-4 rounded shadow-inner w-full">
              <h3 className="font-bold mb-2 text-gray-800">Clause Preview</h3>
              <div className="text-sm whitespace-pre-line text-gray-700">
                {currentSection.fields.map(field => {
                  if (!field.willClauseText) return null;
                  const interpolated = interpolateText(field.willClauseText, formValues);
                  if (/\{\{field:[^}]+\}\}/.test(interpolated)) return null;
                  return (
                    <div key={field.id} className="mb-4">
                      {interpolated}
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Modal */}
      {submitted && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 px-4">
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-lg text-center max-w-md w-full">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-900">Submission Complete!</h2>
            <p className="text-gray-700">Your will form has been submitted successfully.</p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
