import React, { useEffect } from "react";
import FormRenderer from "./components/FormRenderer.jsx";
import logo from "./assets/aristone-logo.svg";
import { Buffer } from "buffer";

export default function App() {
  // ---------------------------
  // Global Buffer Support (Required for PDF generation)
  // ---------------------------
  useEffect(() => {
    window.Buffer = window.Buffer || Buffer;
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row overflow-hidden text-gray-800 bg-gray-50">
      {/* --------------------------- */}
      {/* Main Content Area */}
      {/* --------------------------- */}
      <main className="flex-1 h-screen overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {/* --------------------------- */}
          {/* Header Section */}
          {/* --------------------------- */}
          <header className="relative border shadow-md px-4 sm:px-6 py-4 rounded-xl mb-6 bg-white border-gray-200">
            <div className="text-center">
              <img
                src={logo}
                alt="Aristone Logo"
                className="h-10 sm:h-12 mx-auto mb-2"
              />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Will Tool MVP</h1>
            </div>
          </header>

          {/* --------------------------- */}
          {/* Main Form Renderer */}
          {/* --------------------------- */}
          <FormRenderer />
        </div>
      </main>
    </div>
  );
}
