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
    <div className="h-screen w-screen flex overflow-hidden text-gray-800 bg-gray-50">
      {/* This outer div ensures the sidebar is fixed and the main content scrolls */}

      {/* --------------------------- */}
      {/* Main Content Area */}a
      {/* --------------------------- */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto py-10 px-4">
          {/* --------------------------- */}
          {/* Header Section (Unchanged) */}
          {/* --------------------------- */}
          <header className="relative border shadow-md px-8 py-6 rounded-xl mb-10 bg-white">
            <div className="text-center">
              <img src={logo} alt="Aristone Logo" className="h-12 mx-auto mb-2" />
              <h1 className="text-3xl font-bold">Will Tool MVP</h1>
            </div>
          </header>

          {/* --------------------------- */}
          {/* Main Form Renderer */}
          {/* --------------------------- */}
          <FormRenderer />
        </div>
      </div>
    </div>
  );
}
