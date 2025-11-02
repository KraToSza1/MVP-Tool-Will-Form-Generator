import React from 'react';
import formData from '../data/Complete-WillSuite-Form-Data.json';
import { CheckCircle2, Circle } from 'lucide-react';


export default function Sidebar({ currentIndex, setCurrentIndex }) {
  
  
  return (
    <aside className="hidden lg:block fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 p-6 shadow-lg z-40 overflow-y-auto transition-colors duration-300">
      <nav aria-label="Sidebar Navigation">
        <div className="mb-6 mt-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-4 mb-2">
            Sections
          </h2>
        </div>
        <ul className="space-y-2">
          {formData.formSections.map((section, idx) => {
            const isActive = idx === currentIndex;
            const isCompleted = idx < currentIndex;

            return (
              <li key={section.formSection}>
                <button
                  onClick={() => setCurrentIndex(idx)}
                  className={`group w-full text-left px-4 py-3 rounded-xl transition-all duration-300 font-medium tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transform hover:scale-105 active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-100 to-indigo-50 text-indigo-800 border-l-4 border-indigo-600 shadow-md'
                      : isCompleted
                      ? 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 border-l-4 border-transparent hover:border-indigo-300'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 size={18} className="text-green-500" />
                      ) : isActive ? (
                        <Circle size={18} className="text-indigo-600 fill-current animate-pulse" />
                      ) : (
                        <Circle size={18} className="text-gray-400" />
                      )}
                    </div>
                    <span className="flex-1 text-sm">{section.formSection}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
