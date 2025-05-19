import React, { useState } from 'react'
import formData from '../data/Complete-WillSuite-Form-Data.json'

export default function FormRenderer() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentSection = formData.formSections[currentIndex]

  const goNext = () => {
    if (currentIndex < formData.formSections.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  return (
    <div className="form-section">
      <h2 className="text-xl font-bold mb-4">{currentSection.formSection}</h2>
      <div className="space-y-4">
        {currentSection.fields.map((field) => (
          <div key={field.id} className="form-field-group">
            <label className="block font-medium">{field.label}</label>

            {field.type === 'text' && (
              <input
                type="text"
                placeholder={field.placeholder || ''}
                className="mt-1 w-full border px-3 py-2 rounded"
              />
            )}

            {field.type === 'radio' && (
              <div className="mt-2 space-y-1">
                {field.options.map((opt) => (
                  <label key={opt.value} className="flex items-center space-x-2">
                    <input type="radio" name={field.id} value={opt.value} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <button
          onClick={goBack}
          disabled={currentIndex === 0}
          className="bg-gray-300 text-gray-700 px-4 py-2 rounded disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={goNext}
          disabled={currentIndex === formData.formSections.length - 1}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Next
        </button>
      </div>
    </div>
  )
}
