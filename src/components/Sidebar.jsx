/*
 * 📱 SIDEBAR NAVIGATION LOGGING
 * 
 * This Sidebar component includes comprehensive logging for navigation tracking:
 * 
 * 🧭 NAVIGATION EVENTS:
 * - [SIDEBAR NAVIGATION] - Section navigation with from/to details and direction
 * - [SIDEBAR] - Mobile sidebar open/close events (menu button, X button, backdrop clicks)
 * 
 * Tracks user navigation patterns, section completion progress, and mobile vs desktop usage!
 */

import React, { useMemo, useState } from 'react';
import formData from '../data/Complete-WillSuite-Form-Data.json';
import { CheckCircle2, Circle, Menu, X } from 'lucide-react';


export default function Sidebar({ currentIndex, setCurrentIndex }) {
  const [isOpen, setIsOpen] = useState(false);
  const sections = useMemo(() => formData?.formSections || [], []);
  const currentLabel = useMemo(
    () => sections?.[currentIndex]?.formSection || 'Sections',
    [sections, currentIndex]
  );

  const goToSection = (idx) => {
    setCurrentIndex(idx);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile/Tablet top bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="px-3 sm:px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center justify-center h-11 w-11 sm:h-10 sm:w-10 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 touch-manipulation"
            aria-label="Open sections"
          >
            <Menu size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-500 leading-tight">Current section</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{currentLabel}</p>
          </div>

          <div className="text-xs font-semibold text-indigo-600 whitespace-nowrap">
            {currentIndex + 1}/{sections.length}
          </div>
        </div>
      </div>

      {/* Mobile/Tablet drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setIsOpen(false);
            }}
            aria-label="Close sections"
          />

          <aside
            className="absolute inset-y-0 left-0 w-[85%] max-w-sm bg-white border-r border-gray-200 shadow-2xl p-4 sm:p-5 overflow-y-auto"
            aria-label="Sections"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                Sections
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                }}
                className="inline-flex items-center justify-center h-11 w-11 sm:h-10 sm:w-10 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 touch-manipulation"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <ul className="space-y-2">
              {sections.map((section, idx) => {
                const isActive = idx === currentIndex;
                const isCompleted = idx < currentIndex;

                return (
                  <li key={section.formSection}>
                    <button
                      type="button"
                      onClick={() => goToSection(idx)}
                      className={`w-full text-left px-4 py-3.5 sm:py-3 rounded-xl transition-colors duration-200 font-medium min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                          : isCompleted
                          ? 'text-gray-800 hover:bg-indigo-50 active:bg-indigo-100 border border-transparent hover:border-indigo-100'
                          : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100 border border-transparent'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
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
          </aside>
        </div>
      )}

      {/* Desktop sidebar (in-flow + sticky) */}
      <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-gray-200 p-6 shadow-lg overflow-y-auto lg:sticky lg:top-0 lg:h-dvh transition-colors duration-300">
        <nav aria-label="Sidebar Navigation">
          <div className="mb-6 mt-2">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-4 mb-2">
              Sections
            </h2>
          </div>
          <ul className="space-y-2">
            {sections.map((section, idx) => {
              const isActive = idx === currentIndex;
              const isCompleted = idx < currentIndex;

              return (
                <li key={section.formSection}>
                  <button
                    type="button"
                    onClick={() => goToSection(idx)}
                    className={`group w-full text-left px-4 py-3 rounded-xl transition-all duration-300 font-medium tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transform hover:scale-[1.02] active:scale-[0.99] ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-100 to-indigo-50 text-indigo-800 border-l-4 border-indigo-600 shadow-md'
                        : isCompleted
                        ? 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 border-l-4 border-transparent hover:border-indigo-300'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800 border-l-4 border-transparent'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
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
    </>
  );
}
