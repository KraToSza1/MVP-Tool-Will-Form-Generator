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
  coverFirm: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6d28d9',
    fontWeight: 'bold',
    marginTop: 18,
    letterSpacing: 1,
    fontFamily: 'Helvetica-Bold',
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
  signatureBlock: {
    marginTop: 40,
    fontSize: 12,
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
const getFullName = (fv) =>
  [fv.title, fv.firstName, fv.middleName, fv.lastName].filter(Boolean).join(' ') || '[Full Name]';

const evaluateConditions = (conditions, formValues) => {
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

const renderFields = (fields, formValues, parentKey = '') =>
  fields.map((field, idx) => {
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

    if (
      ['text', 'textarea', 'radio', 'select', 'number', 'date'].includes(field.type) &&
      value !== undefined &&
      value !== ''
    ) {
      let label = value;
      if ((field.type === 'radio' || field.type === 'select') && field.options) {
        const option = field.options.find((o) => o.value === value);
        label = option ? option.label : value;
      }

      return (
        <View key={key} style={{ marginBottom: 12 }} wrap={true}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <Text style={styles.bodyText}>{label}</Text>
        </View>
      );
    }

    if (Array.isArray(value) && value.length > 0) {
      return (
        <View key={key} style={{ marginBottom: 12 }}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {value.map((item, i) => (
              <View key={`${key}-${i}`} style={{ width: '48%', marginBottom: 12 }}>
                {typeof item === 'object' ? (
                  Object.entries(item).map(([k, v]) => (
                    <Text key={k} style={styles.bodyText}>
                      <Text style={styles.fieldLabel}>{k.replace(/([A-Z])/g, ' $1')}: </Text>
                      {String(v)}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.bodyText}>{String(item)}</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      );
    }

    return null;
  });

// =====================
// MAIN COMPONENT
// =====================
const PDFDocument = ({ formValues = {} }) => (
  <Document>
    {/* COVER PAGE */}
    <Page size="A4" style={styles.coverPage}>
      <View style={styles.borderOuter} fixed />
      <View style={styles.borderInner} fixed />
      <Text style={styles.coverTitle}>Last Will{''}and Testament</Text>
      <Text style={styles.coverOf}>-of-</Text>
      <Image style={styles.coverLogo} src={logo} />
    </Page>

    {/* CONTENT PAGE */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.bodyText}>
        This is the Will of {getFullName(formValues)}.
      </Text>
      {formSchema.formSections.map((section, idx) =>
        renderFields(section.fields, formValues, `section${idx}-`)
      )}
      <Text style={styles.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} fixed />
    </Page>

    {/* SIGNATURE PAGE */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.bodyText}>Signed by, to give effect to this Will, on</Text>
      <Text style={{ marginTop: 18 }}>Date</Text>
      <View style={styles.line} />

      {/* Show Signature if captured */}
      <Text style={{ marginTop: 18 }}>SIGNATURE</Text>
      {formValues.testatorSignature ? (
        <Image src={formValues.testatorSignature} style={styles.signatureImage} />
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

export default PDFDocument;