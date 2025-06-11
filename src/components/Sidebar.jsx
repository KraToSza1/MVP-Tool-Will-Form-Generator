import React from 'react';
import formData from '../data/Complete-WillSuite-Form-Data.json';

export default function Sidebar({ currentIndex, setCurrentIndex }) {
  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 p-6 shadow z-40 overflow-y-auto">
      <ul className="space-y-2 mt-20">
        {formData.formSections.map((section, idx) => {
          const isActive = idx === currentIndex;

          return (
            <li key={section.formSection}>
              <button
                onClick={() => setCurrentIndex(idx)}
                className={`w-full text-left px-4 py-2 rounded transition font-medium tracking-wide ${
                  isActive
                    ? 'bg-indigo-100 text-indigo-800 border-l-4 border-indigo-600 shadow-inner'
                    : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 border-l-4 border-transparent'
                }`}
              >
                {section.formSection}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
