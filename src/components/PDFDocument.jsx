import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image
} from '@react-pdf/renderer';
import logo from '../assets/logo_resized.png';
import formSchema from '../data/Complete-WillSuite-Form-Data.json';
import { formatUKDate, formatUKPostcode, formatUKPhoneNumber } from '../utils/ukValidations';

// =====================
// STYLES
// =====================
const styles = StyleSheet.create({
  coverPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Times-Roman',
    backgroundColor: '#fff',
    position: 'relative',
  },
  borderOuter: {
    position: 'absolute',
    top: 24, left: 24, right: 24, bottom: 24,
    border: '1.5pt solid #222',
    borderRadius: 2,
  },
  borderInner: {
    position: 'absolute',
    top: 36, left: 36, right: 36, bottom: 36,
    border: '0.5pt solid #222',
    borderRadius: 1,
  },
  coverTitle: {
    fontSize: 36,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 18,
    marginTop: 60,
  },
  coverOf: {
    fontSize: 20,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 18,
  },
  coverLogo: {
    width: 220,
    marginTop: 60,
    alignSelf: 'center',
  },
  page: {
    padding: 50,
    fontSize: 12,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
    color: '#111',
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    textTransform: 'uppercase',
    borderBottom: '1pt solid #222',
    paddingBottom: 4,
  },
  bodyText: {
    fontSize: 12,
    lineHeight: 1.4,
    marginBottom: 8,
  },
  signatureImage: {
    marginTop: 10,
    width: 220,
    height: 100,
    objectFit: 'contain',
  },
  line: {
    borderBottom: '1pt solid #222',
    width: 220,
    marginVertical: 10,
  },
  witnessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 10,
  },
  witnessCol: {
    width: '45%',
  },
  pageNum: {
    position: 'absolute',
    fontSize: 10,
    bottom: 24,
    right: 24,
    color: '#444',
    textAlign: 'right',
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    color: '#222',
  },
});

// =====================
// UTILS
// =====================
const getFullName = (fv) => {
  if (!fv || typeof fv !== 'object') return '[Full Name]';
  return [fv.title, fv.firstName, fv.middleName, fv.lastName].filter(Boolean).join(' ') || '[Full Name]';
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

const renderFields = (fields, formValues, parentKey = '', depth = 0) => {
  if (!fields || !Array.isArray(fields) || !formValues || typeof formValues !== 'object') {
    return [];
  }
  
  return fields.map((field, idx) => {
    if (!field) return null;
    
    const key = `${parentKey}${field.id || idx}`;
    const value = formValues[field.id];

    if (
      ['display', 'button', 'hidden'].includes(field.type) ||
      (field.conditions && !evaluateConditions(field.conditions, formValues))
    ) {
      return null;
    }

    if (field.type === 'section' && field.subFields) {
      const hasValue = field.subFields.some((sub) => formValues[sub.id]);
      if (!hasValue) return null;
      return (
        <View key={key} style={{ marginBottom: 32 }} wrap={false} break>
          <Text style={styles.sectionTitle}>{field.label}</Text>
          {renderFields(field.subFields, formValues, key + '-')}
        </View>
      );
    }

    // Skip signature fields and data URLs completely
    if (field.type === 'signature' || (typeof value === 'string' && value.startsWith('data:'))) {
      return null;
    }
    
    // Skip very long strings
    if (typeof value === 'string' && value.length > 50000) {
      return null;
    }
    
    if (
      ['text', 'textarea', 'radio', 'select', 'number', 'date'].includes(field.type) &&
      value !== undefined &&
      value !== ''
    ) {
      let label = String(value || '').substring(0, 5000);
      
      // Remove corrupted numbers from text before rendering
      label = label.replace(/-?\d+\.?\d*[eE][+-]?2\d+/g, '').replace(/-1\.8\d*[eE][+-]?\d+/gi, '').replace(/1\.8\d*[eE][+-]?2\d+/gi, '');
      
      if ((field.type === 'radio' || field.type === 'select') && field.options && Array.isArray(field.options)) {
        try {
          const option = field.options.find((o) => o && o.value === value);
          if (option && option.label) {
            let optionLabel = String(option.label);
            // Sanitize option label too
            optionLabel = optionLabel.replace(/-?\d+\.?\d*[eE][+-]?2\d+/g, '').replace(/-1\.8\d*[eE][+-]?\d+/gi, '').replace(/1\.8\d*[eE][+-]?2\d+/gi, '');
            label = optionLabel;
          }
        } catch (e) {
          label = String(value || '');
        }
      }

      try {
        if (field.type === 'date') {
          label = formatUKDate(value) || label;
        } else if (field.id === 'postcode' || (field.id && field.id.toLowerCase().includes('postcode'))) {
          label = formatUKPostcode(value) || label;
        } else if (field.id === 'mobile' || field.id === 'tel2' || (field.id && (field.id.toLowerCase().includes('phone') || field.id.toLowerCase().includes('tel')))) {
          label = formatUKPhoneNumber(value) || label;
        }
      } catch (formatError) {
        label = String(value || '');
      }
      
      // Final sanitization pass
      label = label.replace(/-?\d+\.?\d*[eE][+-]?2\d+/g, '').replace(/-1\.8\d*[eE][+-]?\d+/gi, '').replace(/1\.8\d*[eE][+-]?2\d+/gi, '');
      
      if (label.length === 0) return null;
      
      try {
        return (
          <View key={key} style={{ marginBottom: 12 }} wrap>
            <Text style={styles.fieldLabel}>{String(field.label || '')}</Text>
            <Text style={styles.bodyText} wrap>{label}</Text>
          </View>
        );
      } catch (renderError) {
        console.error(`Error rendering field "${field.id}":`, renderError);
        return null;
      }
    }

    if (Array.isArray(value) && value.length > 0) {
      const safeItems = value.filter((item) => {
        if (typeof item === 'string' && (item.length > 50000 || item.startsWith('data:'))) {
          return false;
        }
        return item != null;
      });
      
      if (safeItems.length === 0) return null;
      
      try {
        return (
          <View key={key} style={{ marginBottom: 12 }}>
            <Text style={styles.fieldLabel}>{field.label || ''}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {safeItems.map((item, i) => {
                try {
                  if (typeof item === 'object' && item !== null) {
                    return (
                      <View key={`${key}-${i}`} style={{ width: '48%', marginBottom: 12 }}>
                        {Object.entries(item)
                          .filter(([k, v]) => {
                            if (typeof v === 'string' && (v.length > 5000 || v.startsWith('data:'))) {
                              return false;
                            }
                            return v != null;
                          })
                          .map(([k, v]) => {
                            let safeValue = String(v || '').substring(0, 1000);
                            // Remove corrupted numbers from nested values
                            safeValue = safeValue.replace(/-?\d+\.?\d*[eE][+-]?2\d+/g, '').replace(/-1\.8\d*[eE][+-]?\d+/gi, '').replace(/1\.8\d*[eE][+-]?2\d+/gi, '');
                            return (
                              <Text key={k} style={styles.bodyText}>
                                <Text style={styles.fieldLabel}>{k.replace(/([A-Z])/g, ' $1')}: </Text>
                                {safeValue}
                              </Text>
                            );
                          })}
                      </View>
                    );
                  }
                  let safeItem = String(item || '').substring(0, 1000);
                  // Remove corrupted numbers from array items
                  safeItem = safeItem.replace(/-?\d+\.?\d*[eE][+-]?2\d+/g, '').replace(/-1\.8\d*[eE][+-]?\d+/gi, '').replace(/1\.8\d*[eE][+-]?2\d+/gi, '');
                  return (
                    <View key={`${key}-${i}`} style={{ width: '48%', marginBottom: 12 }}>
                      <Text style={styles.bodyText}>{safeItem}</Text>
                    </View>
                  );
                } catch (itemError) {
                  return null;
                }
              })}
            </View>
          </View>
        );
      } catch (arrayError) {
        console.error(`Error rendering array field "${field.id}":`, arrayError);
        return null;
      }
    }

    return null;
  }).filter(Boolean);
};

// =====================
// MAIN COMPONENT
// =====================
const PDFDocument = ({ formValues = {}, testatorSignature = null }) => {
  const safeFormValues = formValues && typeof formValues === 'object' ? formValues : {};
  
  try {
    return (
      <Document>
      {/* COVER PAGE */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.borderOuter} fixed />
        <View style={styles.borderInner} fixed />
        <Text style={styles.coverTitle}>Last Will and Testament</Text>
        <Text style={styles.coverOf}>-of-</Text>
        {logo && <Image style={styles.coverLogo} src={logo} />}
      </Page>

    {/* CONTENT PAGE */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.bodyText}>
        {(() => {
          try {
            const fullName = getFullName(safeFormValues);
            if (!fullName || typeof fullName !== 'string' || fullName.length === 0 || fullName.length > 500) {
              return 'This is the Will of [Name].';
            }
            return `This is the Will of ${fullName}.`;
          } catch (nameError) {
            return 'This is the Will of [Name].';
          }
        })()}
      </Text>
      {formSchema && formSchema.formSections && Array.isArray(formSchema.formSections)
        ? formSchema.formSections.map((section, idx) => {
            if (!section || !section.fields) return null;
            try {
              return renderFields(section.fields, safeFormValues, `section${idx}-`, 0);
            } catch (sectionError) {
              console.error(`Error rendering section ${idx}:`, sectionError);
              return null;
            }
          })
        : null}
      <Text style={styles.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} fixed />
    </Page>

    {/* SIGNATURE PAGE */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.bodyText}>Signed by, to give effect to this Will, on</Text>
      <Text style={{ marginTop: 18 }}>Date</Text>
      <View style={styles.line} />

      <Text style={{ marginTop: 18 }}>SIGNATURE</Text>
      {testatorSignature && 
       typeof testatorSignature === 'string' && 
       testatorSignature.startsWith('data:image') &&
       testatorSignature.length > 100 &&
       testatorSignature.length < 1000000 ? (
        <Image 
          src={testatorSignature} 
          style={styles.signatureImage}
          cache={false}
        />
      ) : (
        <View style={styles.line} />
      )}

      <Text style={styles.bodyText}>
        We confirm this Will was signed first by in our presence and then by both of us in the presence of.
      </Text>

      <View style={styles.witnessRow}>
        <View style={styles.witnessCol}>
          <Text>Witness 1</Text>
          <Text style={{ marginTop: 10 }}>SIGNATURE</Text>
          <View style={styles.line} />
          <Text>Full name</Text>
          <View style={styles.line} />
        </View>
        <View style={styles.witnessCol}>
          <Text>Witness 2</Text>
          <Text style={{ marginTop: 10 }}>SIGNATURE</Text>
          <View style={styles.line} />
          <Text>Full name</Text>
          <View style={styles.line} />
        </View>
      </View>

      <Text style={styles.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} fixed />
    </Page>
  </Document>
    );
    } catch (error) {
      console.error('PDF Document Error:', error);
      return (
        <Document>
          <Page size="A4" style={styles.page}>
            <Text style={styles.bodyText}>Error generating PDF document.</Text>
            <Text style={styles.bodyText}>Error: {error.message || 'Unknown error'}</Text>
          </Page>
        </Document>
      );
    }
};

export default PDFDocument;
