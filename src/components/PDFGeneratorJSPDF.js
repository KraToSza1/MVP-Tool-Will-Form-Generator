import { jsPDF } from 'jspdf';
import formSchema from '../data/Complete-WillSuite-Form-Data.json';
import { formatUKDate, formatUKPostcode, formatUKPhoneNumber } from '../utils/ukValidations';

// Helper to convert image to base64 and get dimensions for jsPDF
const loadImageAsBase64 = async (imagePath) => {
  try {
    // In a build environment, we need to fetch the image
    const response = await fetch(imagePath);
    if (!response.ok) throw new Error('Failed to load image');
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          resolve({
            data: reader.result,
            width: img.width,
            height: img.height,
            aspectRatio: img.width / img.height
          });
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Could not load image:', error);
    return null;
  }
};

// Helper to safely convert values to strings, removing corrupted numbers
const safeString = (value) => {
  if (value == null || value === undefined) return '';
  
  let str = String(value);
  // Remove corrupted number patterns
  str = str.replace(/-?\d+\.?\d*[eE][+-]?2\d+/g, '');
  str = str.replace(/-1\.8\d*[eE][+-]?\d+/gi, '');
  str = str.replace(/1\.8\d*[eE][+-]?2\d+/gi, '');
  
  // Check if parsed number is invalid
  const numMatch = str.match(/-?\d+\.?\d*[eE][+-]?\d+/g);
  if (numMatch) {
    numMatch.forEach(match => {
      const num = parseFloat(match);
      if (!isFinite(num) || Math.abs(num) >= 1e10) {
        str = str.replace(match, '');
      }
    });
  }
  
  return str.substring(0, 5000); // Limit length
};

const getFullName = (fv) => {
  if (!fv || typeof fv !== 'object') return '[Full Name]';
  const parts = [fv.title, fv.firstName, fv.middleName, fv.lastName].filter(Boolean).map(safeString);
  return parts.join(' ') || '[Full Name]';
};

const evaluateConditions = (conditions, formValues) => {
  if (!conditions) return true;
  if (!formValues || typeof formValues !== 'object') return false;

  const evalClause = (clause) => {
    if (!clause || !clause.field) return false;
    const value = formValues[clause.field];
    if (clause.operator === 'eq') return value === clause.value;
    if (clause.operator === 'in') {
      if (!Array.isArray(clause.value)) return value === clause.value;
      return clause.value.includes(value);
    }
    if (clause.operator === 'AND' || clause.operator === 'OR') {
      if (!clause.clauses || !Array.isArray(clause.clauses)) return false;
      const results = clause.clauses.map(evalClause);
      return clause.operator === 'AND' ? results.every(Boolean) : results.some(Boolean);
    }
    return false;
  };

  return Array.isArray(conditions)
    ? conditions.every(evalClause)
    : evalClause(conditions);
};

// Text interpolation function (matching FormRenderer logic)
const interpolateText = (text, values, context = '') => {
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
    debtorsSection: 'debtorsData',
    partnerSection: 'partnerData',
    executorsSection: 'executorData',
    substituteExecutorsSection: 'substituteExecutorData',
    professionalExecutorSection: 'professionalExecutorData',
    substituteProfessionalExecutorSection: 'substituteProfessionalExecutorData',
    digitalExecutorsSection: 'digitalExecutorData',
    trusteesSection: 'trusteeData',
    substituteTrusteesSection: 'substituteTrusteeData',
    charityBenefitSection: 'charityBenefitDetails',
    chattelsGiftBeneficiarySection: 'chattelsGiftBeneficiaryData'
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

    // Handle nested section fields
    const fallbackId = fallbackMap[sectionId] || `${sectionId}Data`;
    const sectionData = values[fallbackId] || values[sectionId];
    
    if (Array.isArray(sectionData) && sectionData.length > 0) {
      const firstItem = sectionData[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        const fieldValue = firstItem[subField] || 
                         firstItem[subField.charAt(0).toLowerCase() + subField.slice(1)] ||
                         firstItem[subField.charAt(0).toUpperCase() + subField.slice(1)] ||
                         firstItem[subField.toLowerCase()] ||
                         firstItem[subField.toUpperCase()];
        if (fieldValue && (typeof fieldValue === 'string' || typeof fieldValue === 'number')) {
          const result = safeString(fieldValue);
          if (result.startsWith('data:') || result.length > 10000) {
            return '';
          }
          return result;
        }
      }
    } else if (typeof sectionData === 'object' && sectionData !== null) {
      const fieldValue = sectionData[subField] || 
                       sectionData[subField.charAt(0).toLowerCase() + subField.slice(1)] ||
                       sectionData[subField.charAt(0).toUpperCase() + sectionData.slice(1)] ||
                       sectionData[subField.toLowerCase()] ||
                       sectionData[subField.toUpperCase()];
      if (fieldValue && (typeof fieldValue === 'string' || typeof fieldValue === 'number')) {
        return safeString(fieldValue);
      }
    }

    // Handle direct field references
    if (subField === 'value') {
      const directValue = values[sectionId];
      if (directValue != null) {
        return safeString(directValue);
      }
    }

    // Try direct field lookup
    const directField = values[sectionId];
    if (directField != null && typeof directField === 'string') {
      return safeString(directField);
    }

    return '';
  });

  return interpolated;
};

export const generatePDFWithJSPDF = async (formValues, testatorSignature) => {
  try {
    const doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    });
    
    // Load logo image - try multiple methods
    let logoData = null;
    try {
      // Method 1: Try importing as URL (Vite)
      try {
        const logoModule = await import('../assets/logo_resized.png?url');
        if (logoModule.default) {
          logoData = await loadImageAsBase64(logoModule.default);
        }
      } catch (importError) {
        // Method 2: Try default import
        try {
          const logoModule = await import('../assets/logo_resized.png');
          if (logoModule.default) {
            logoData = await loadImageAsBase64(logoModule.default);
          }
        } catch (importError2) {
          // Method 3: Try direct URL path
          try {
            const logoUrl = '/src/assets/logo_resized.png';
            logoData = await loadImageAsBase64(logoUrl);
          } catch (urlError) {
            // Method 4: Try public path
            try {
              const logoUrl = '/logo_resized.png';
              logoData = await loadImageAsBase64(logoUrl);
            } catch (publicError) {
              console.warn('Could not load logo image, will use text fallback');
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not load logo image, will use text fallback:', e);
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // A4: 210mm x 297mm
    // Professional margins: ~20mm
    const margin = 20;
    const lineHeight = 6;
    let yPos = margin;
    let sectionNumber = 1; // Start numbering sections

    // Helper to add new page if needed
    const checkPageBreak = (requiredHeight = lineHeight) => {
      if (yPos + requiredHeight > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
    };

    // Helper to add text with proper formatting and width constraints
    const addText = (text, x, fontSize = 12, bold = false, align = 'left', maxWidth = null, lineSpacing = null) => {
      checkPageBreak(lineHeight);
      const safeText = safeString(text);
      if (safeText) {
        doc.setFontSize(fontSize);
        doc.setFont('times', bold ? 'bold' : 'normal');
        doc.setTextColor(0, 0, 0);
        
        // Calculate available width - ensure text never goes past right margin
        const availableWidth = maxWidth || (pageWidth - margin - x); // Width from x to right margin
        const lines = doc.splitTextToSize(safeText, availableWidth);
        const spacing = lineSpacing || (fontSize * 0.45);
        
        let currentY = yPos;
        if (align === 'center') {
          lines.forEach(line => {
            const lineWidth = doc.getTextWidth(line);
            const xPos = x - (lineWidth / 2);
            // Ensure text doesn't go past margins
            const clampedX = Math.max(margin, Math.min(xPos, pageWidth - margin - lineWidth));
            doc.text(line, clampedX, currentY);
            currentY += spacing;
          });
        } else if (align === 'right') {
          lines.forEach(line => {
            const lineWidth = doc.getTextWidth(line);
            const xPos = x - lineWidth;
            const clampedX = Math.max(margin, Math.min(xPos, pageWidth - margin - lineWidth));
            doc.text(line, clampedX, currentY);
            currentY += spacing;
          });
        } else {
          // Left align - ensure text stays within margins
          lines.forEach(line => {
            const lineWidth = doc.getTextWidth(line);
            const maxX = pageWidth - margin;
            if (x + lineWidth > maxX) {
              // Text would overflow, truncate at word boundaries if needed
              let truncated = line;
              while (doc.getTextWidth(truncated) > availableWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1);
              }
              doc.text(truncated || line.substring(0, Math.floor(availableWidth / (fontSize * 0.5))), x, currentY);
            } else {
              doc.text(line, x, currentY);
            }
            currentY += spacing;
          });
        }
        yPos = currentY;
      }
      return yPos;
    };

    // ===== COVER PAGE (FIRST PAGE) =====
    // The first page is already created by jsPDF, so we use it for the cover
    
    // Outer border - thick line (1.5pt = ~0.5mm), positioned at 24pt from edges
    const borderMargin = 8.5; // ~24pt = 8.5mm
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);
    doc.rect(borderMargin, borderMargin, pageWidth - (borderMargin * 2), pageHeight - (borderMargin * 2));
    
    // Inner border - thin line (0.5pt = ~0.18mm), positioned at 36pt from edges
    const innerBorderMargin = 12.7; // ~36pt = 12.7mm
    doc.setLineWidth(0.18);
    doc.rect(innerBorderMargin, innerBorderMargin, pageWidth - (innerBorderMargin * 2), pageHeight - (innerBorderMargin * 2));

    // Title - centered, large, bold, split on two lines (matching professional format)
    yPos = pageHeight / 2 - 25;
    doc.setFontSize(24);
    doc.setFont('times', 'bold');
    const titleLine1 = 'Last Will';
    const titleLine2 = 'and Testament';
    const title1Width = doc.getTextWidth(titleLine1);
    const title2Width = doc.getTextWidth(titleLine2);
    doc.text(titleLine1, pageWidth / 2 - title1Width / 2, yPos);
    yPos += 7;
    doc.text(titleLine2, pageWidth / 2 - title2Width / 2, yPos);
    
    yPos += 8;
    doc.setFontSize(18);
    doc.setFont('times', 'italic');
    const ofText = '-of-';
    const ofWidth = doc.getTextWidth(ofText);
    doc.text(ofText, pageWidth / 2 - ofWidth / 2, yPos);
    
    yPos += 10;
    // Name
    const fullName = getFullName(formValues);
    doc.setFontSize(16);
    doc.setFont('times', 'normal');
    const nameText = fullName !== '[Full Name]' ? fullName : '';
    if (nameText) {
      const nameWidth = doc.getTextWidth(nameText);
      doc.text(nameText, pageWidth / 2 - nameWidth / 2, yPos);
    }
    
    // Logo at bottom - center - using actual logo image with proper aspect ratio
    yPos = pageHeight - 50;
    try {
      // Calculate logo size preserving aspect ratio
      let logoWidth = 60; // mm - target width
      let logoHeight = 60; // mm - will be adjusted
      let logoDataString = null;
      
      if (logoData && logoData.data && logoData.aspectRatio) {
        // Use actual image dimensions to preserve aspect ratio
        logoDataString = logoData.data;
        
        // Calculate height based on aspect ratio to prevent squishing
        if (logoData.aspectRatio > 1) {
          // Landscape logo - wider than tall
          logoHeight = logoWidth / logoData.aspectRatio;
        } else {
          // Portrait or square logo - taller than wide
          logoHeight = logoWidth / logoData.aspectRatio;
        }
        
        // Ensure logo isn't too small or too large
        const maxWidth = 70; // mm
        const maxHeight = 30; // mm
        if (logoWidth > maxWidth) {
          logoWidth = maxWidth;
          logoHeight = logoWidth / logoData.aspectRatio;
        }
        if (logoHeight > maxHeight) {
          logoHeight = maxHeight;
          logoWidth = logoHeight * logoData.aspectRatio;
        }
      }
      
      const logoX = pageWidth / 2 - logoWidth / 2;
      const logoY = yPos;
      
      // Try to add actual logo image if loaded
      if (logoDataString && typeof logoDataString === 'string' && logoDataString.startsWith('data:')) {
        try {
          doc.addImage(logoDataString, 'PNG', logoX, logoY, logoWidth, logoHeight);
        } catch (imgError) {
          console.warn('Could not add logo image:', imgError);
          // Fall through to text fallback
          throw imgError;
        }
      } else {
        throw new Error('Logo not available');
      }
    } catch (e) {
      // Fallback to text logo if image fails - styled to match logo design
      yPos = pageHeight - 45;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(106, 62, 155); // Purple color matching logo (#6A3E9B)
      const logoText = 'ARISTONE';
      const logoTextWidth = doc.getTextWidth(logoText);
      doc.text(logoText, pageWidth / 2 - logoTextWidth / 2, yPos);
      yPos += 6;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(192, 192, 192); // Gray color matching logo
      const logoSolicitors = 'SOLICITORS';
      const solicitorsWidth = doc.getTextWidth(logoSolicitors);
      doc.text(logoSolicitors, pageWidth / 2 - solicitorsWidth / 2, yPos);
    }

    // ===== CONTENT PAGE =====
    doc.addPage();
    yPos = margin;
    doc.setFontSize(12);
    doc.setFont('times', 'normal');
    doc.setTextColor(0, 0, 0);

    // Header: "This is the Will of my [Full Name]."
    const fullNameText = fullName !== '[Full Name]' ? fullName : '[Name]';
    yPos = addText(`This is the Will of my ${fullNameText}.`, margin, 12, false);
    yPos += 8;

    // Collect all will clauses from form sections
    const willClauses = [];
    
    if (formSchema && formSchema.formSections && Array.isArray(formSchema.formSections)) {
      formSchema.formSections.forEach((section) => {
        if (!section || !section.fields) return;

        const processFields = (fields) => {
          fields.forEach(field => {
            if (!field) return;

            // Skip if conditions not met
            if (field.conditions && !evaluateConditions(field.conditions, formValues)) {
              return;
            }

            // Skip display/button/hidden/signature fields
            if (['display', 'button', 'hidden', 'signature'].includes(field.type)) {
              return;
            }

            // Check field's willClauseText
            if (field.willClauseText) {
              const interpolated = interpolateText(field.willClauseText, formValues);
              if (interpolated && !/\{\{field:[^}]+\}\}/.test(interpolated) && interpolated.trim() !== '') {
                willClauses.push({
                  sectionLabel: section.formSection,
                  fieldLabel: field.label,
                  text: safeString(interpolated)
                });
              }
            }

            // Check options' willClauseText for radio/select fields
            if (field.options && (field.type === 'radio' || field.type === 'select')) {
              const selectedValue = formValues[field.id];
              if (selectedValue) {
                const selectedOption = field.options.find(opt => opt && opt.value === selectedValue);
                if (selectedOption?.willClauseText) {
                  const interpolated = interpolateText(selectedOption.willClauseText, formValues);
                  if (interpolated && !/\{\{field:[^}]+\}\}/.test(interpolated) && interpolated.trim() !== '') {
                    willClauses.push({
                      sectionLabel: section.formSection,
                      fieldLabel: field.label + ': ' + selectedOption.label,
                      text: safeString(interpolated)
                    });
                  }
                }
              }
            }

            // Handle section fields with subFields
            if (field.type === 'section' && field.subFields) {
              field.subFields.forEach(subField => {
                if (subField.conditions && !evaluateConditions(subField.conditions, formValues)) {
                  return;
                }
                
                if (subField.willClauseText) {
                  const interpolated = interpolateText(subField.willClauseText, formValues);
                  if (interpolated && !/\{\{field:[^}]+\}\}/.test(interpolated) && interpolated.trim() !== '') {
                    willClauses.push({
                      sectionLabel: section.formSection,
                      fieldLabel: field.label + ': ' + (subField.label || ''),
                      text: safeString(interpolated)
                    });
                  }
                }
              });
            }

            // Process nested fields if section type
            if (field.type === 'section' && field.subFields) {
              processFields(field.subFields);
            }
          });
        };

        processFields(section.fields);
      });
    }

    // Render numbered will clauses - matching professional format
    willClauses.forEach((clause, idx) => {
      checkPageBreak(lineHeight * 4);
      
      // Section number and heading (bold) - matching "1. Revoking Previous Wills" format
      // Ensure heading doesn't overflow
      doc.setFontSize(12);
      doc.setFont('times', 'bold');
      const sectionHeading = `${sectionNumber}. ${clause.fieldLabel}`;
      const headingWidth = doc.getTextWidth(sectionHeading);
      const maxHeadingWidth = pageWidth - (margin * 2);
      
      // If heading is too long, split it
      if (headingWidth > maxHeadingWidth) {
        const headingLines = doc.splitTextToSize(sectionHeading, maxHeadingWidth);
        doc.text(headingLines, margin, yPos);
        yPos += headingLines.length * 7;
      } else {
        doc.text(sectionHeading, margin, yPos);
        yPos += 7; // Line spacing
      }
      
      // Clause text (normal weight, left-aligned) - ensure it wraps properly
      doc.setFont('times', 'normal');
      const availableWidth = pageWidth - (margin * 2); // Total width minus both margins
      const clauseLines = doc.splitTextToSize(clause.text, availableWidth);
      doc.text(clauseLines, margin, yPos);
      yPos += clauseLines.length * 6; // Line height
      yPos += 4; // Spacing between sections
      
      sectionNumber++;
    });

    // Add page numbers to all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const pageText = `${i}/${totalPages}`;
      const pageTextWidth = doc.getTextWidth(pageText);
      doc.text(pageText, pageWidth - margin - pageTextWidth, pageHeight - margin);
    }

    // ===== SIGNATURE PAGE =====
    doc.addPage();
    yPos = margin;
    doc.setFontSize(12);
    doc.setFont('times', 'normal');
    doc.setTextColor(0, 0, 0);

    // Signature page header with name
    const signatureHeader = `Signed by my ${fullNameText}, to give effect to this Will, on`;
    yPos = addText(signatureHeader, margin, 12, false);
    yPos += 8;
    
    // Date
    doc.text('Date', margin, yPos);
    yPos += 5;
    doc.setLineWidth(0.35);
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, yPos, margin + 78, yPos);
    yPos += 10;
    
    // SIGNATURE
    doc.setFont('times', 'bold');
    doc.text('SIGNATURE', margin, yPos);
    yPos += 5;
    doc.setFont('times', 'normal');
    
    // Signature image or line
    if (testatorSignature && 
        typeof testatorSignature === 'string' && 
        testatorSignature.startsWith('data:image') &&
        testatorSignature.length > 100 &&
        testatorSignature.length < 1000000) {
      try {
        doc.addImage(testatorSignature, 'PNG', margin, yPos, 78, 35);
        yPos += 40;
      } catch (e) {
        doc.setLineWidth(0.35);
        doc.line(margin, yPos, margin + 78, yPos);
        yPos += 15;
      }
    } else {
      doc.setLineWidth(0.35);
      doc.line(margin, yPos, margin + 78, yPos);
      yPos += 15;
    }

    yPos += 8;
    // Witness confirmation
    const witnessText = `We confirm this Will was signed first by my ${fullNameText} in our presence and then by both of us in the presence of my ${fullNameText}.`;
    yPos = addText(witnessText, margin, 12, false);
    yPos += 15;

    // Witness boxes - side by side with borders
    const boxWidth = (pageWidth - (margin * 2) - 15) / 2; // Two boxes with space between
    const boxHeight = 50;
    const witnessX1 = margin;
    const witnessX2 = margin + boxWidth + 15;
    const witnessY = yPos;

    // Witness 1 Box
    doc.setLineWidth(0.2);
    doc.rect(witnessX1, witnessY, boxWidth, boxHeight);
    
    let currentY = witnessY + 7;
    doc.setFont('times', 'bold');
    doc.text('Witness 1', witnessX1 + 3, currentY);
    
    currentY += 6;
    doc.setFont('times', 'normal');
    doc.text('SIGNATURE', witnessX1 + 3, currentY);
    currentY += 4;
    doc.setLineWidth(0.2);
    doc.line(witnessX1 + 3, currentY, witnessX1 + boxWidth - 3, currentY);
    
    currentY += 6;
    doc.text('Full name', witnessX1 + 3, currentY);
    currentY += 4;
    doc.line(witnessX1 + 3, currentY, witnessX1 + boxWidth - 3, currentY);
    
    currentY += 6;
    doc.text('Address', witnessX1 + 3, currentY);
    currentY += 4;
    doc.line(witnessX1 + 3, currentY, witnessX1 + boxWidth - 3, currentY);
    
    currentY += 6;
    doc.text('Phone', witnessX1 + 3, currentY);
    currentY += 4;
    doc.line(witnessX1 + 3, currentY, witnessX1 + boxWidth - 3, currentY);
    
    currentY += 6;
    doc.text('Occupation', witnessX1 + 3, currentY);
    currentY += 4;
    doc.line(witnessX1 + 3, currentY, witnessX1 + boxWidth - 3, currentY);

    // Witness 2 Box
    currentY = witnessY + 7;
    doc.setFont('times', 'bold');
    doc.text('Witness 2', witnessX2 + 3, currentY);
    
    currentY += 6;
    doc.setFont('times', 'normal');
    doc.text('SIGNATURE', witnessX2 + 3, currentY);
    currentY += 4;
    doc.setLineWidth(0.2);
    doc.line(witnessX2 + 3, currentY, witnessX2 + boxWidth - 3, currentY);
    
    currentY += 6;
    doc.text('Full name', witnessX2 + 3, currentY);
    currentY += 4;
    doc.line(witnessX2 + 3, currentY, witnessX2 + boxWidth - 3, currentY);
    
    currentY += 6;
    doc.text('Address', witnessX2 + 3, currentY);
    currentY += 4;
    doc.line(witnessX2 + 3, currentY, witnessX2 + boxWidth - 3, currentY);
    
    currentY += 6;
    doc.text('Phone', witnessX2 + 3, currentY);
    currentY += 4;
    doc.line(witnessX2 + 3, currentY, witnessX2 + boxWidth - 3, currentY);
    
    currentY += 6;
    doc.text('Occupation', witnessX2 + 3, currentY);
    currentY += 4;
    doc.line(witnessX2 + 3, currentY, witnessX2 + boxWidth - 3, currentY);

    // Update page numbers for signature page
    doc.setPage(totalPages + 1);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const finalPageNum = totalPages + 1;
    const pageText = `${finalPageNum}/${finalPageNum}`;
    const pageTextWidth = doc.getTextWidth(pageText);
    doc.text(pageText, pageWidth - margin - pageTextWidth, pageHeight - margin);

    return doc;
  } catch (error) {
    console.error('[JSPDF] Error generating PDF:', error);
    throw error;
  }
};
