/**
 * UK-specific validation and formatting utilities
 */

/**
 * Validates UK postcode format
 * Examples: SW1A 1AA, M1 1AA, B33 8TH, W1A 0AX
 * @param {string} postcode - Postcode to validate
 * @returns {boolean} - True if valid UK postcode format
 */
export const validateUKPostcode = (postcode) => {
  if (!postcode) return false;
  
  // Remove all spaces and convert to uppercase
  const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
  
  // UK postcode regex pattern
  // Format: [A-Z]{1,2}[0-9][A-Z0-9]? [0-9][ABD-HJLNP-UW-Z]{2}
  const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][ABD-HJLNP-UW-Z]{2}$/;
  
  return ukPostcodeRegex.test(cleanPostcode);
};

/**
 * Formats UK postcode with space
 * @param {string} postcode - Postcode to format
 * @returns {string} - Formatted postcode (e.g., "SW1A 1AA")
 */
export const formatUKPostcode = (postcode) => {
  if (!postcode) return '';
  
  // Remove all spaces and convert to uppercase
  const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
  
  // Format: Insert space before last 3 characters (or last 2 if special case)
  // Most UK postcodes: [Outward][Inward] where Inward is last 3 chars
  if (cleanPostcode.length > 3) {
    const formatted = cleanPostcode.slice(0, -3) + ' ' + cleanPostcode.slice(-3);
    return formatted;
  }
  
  return cleanPostcode;
};

/**
 * Validates UK phone number format
 * Accepts formats like: +44 20 1234 5678, 020 1234 5678, 07123 456789
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} - True if valid UK phone number format
 */
export const validateUKPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return false;
  
  // Remove all spaces, dashes, and parentheses
  const cleanPhone = phoneNumber.replace(/[\s\-()]/g, '');
  
  // Check for UK country code
  if (cleanPhone.startsWith('+44')) {
    const withoutCountryCode = cleanPhone.substring(3);
    // UK numbers without country code should start with 0
    if (withoutCountryCode.startsWith('0')) {
      return validateUKPhoneNumber(withoutCountryCode);
    }
    // Some numbers have country code without leading 0
    return /^\+44[1-9]\d{8,9}$/.test(cleanPhone);
  }
  
  // UK mobile numbers (start with 07) - 11 digits total
  if (cleanPhone.startsWith('07')) {
    return /^07\d{9}$/.test(cleanPhone);
  }
  
  // UK landline numbers (start with 01 or 02) - 10 or 11 digits
  if (cleanPhone.startsWith('01') || cleanPhone.startsWith('02')) {
    return /^0[12]\d{8,9}$/.test(cleanPhone);
  }
  
  // UK special numbers (start with 03) - 11 digits
  if (cleanPhone.startsWith('03')) {
    return /^03\d{9}$/.test(cleanPhone);
  }
  
  // UK non-geographic (start with 05 or 08) - 11 digits
  if (cleanPhone.match(/^(05|08)/)) {
    return /^0[58]\d{9}$/.test(cleanPhone);
  }
  
  return false;
};

/**
 * Formats UK phone number for display
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} - Formatted phone number
 */
export const formatUKPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  // Remove all spaces, dashes, and parentheses
  let cleanPhone = phoneNumber.replace(/[\s\-()]/g, '');
  
  // Handle +44 country code
  if (cleanPhone.startsWith('+44')) {
    cleanPhone = '0' + cleanPhone.substring(3);
  }
  
  // Format based on length and pattern
  // Mobile (11 digits starting with 07): 07123 456789
  if (cleanPhone.startsWith('07') && cleanPhone.length === 11) {
    return cleanPhone.slice(0, 5) + ' ' + cleanPhone.slice(5);
  }
  
  // London/02 numbers (10 digits): 020 1234 5678
  if (cleanPhone.startsWith('02') && cleanPhone.length === 11) {
    return cleanPhone.slice(0, 3) + ' ' + cleanPhone.slice(3, 7) + ' ' + cleanPhone.slice(7);
  }
  
  // Other landline (11 digits): 01234 567890
  if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
    return cleanPhone.slice(0, 5) + ' ' + cleanPhone.slice(5);
  }
  
  return phoneNumber;
};

/**
 * Formats date in UK format (DD/MM/YYYY)
 * @param {string} dateString - ISO date string (YYYY-MM-DD)
 * @returns {string} - UK formatted date (DD/MM/YYYY)
 */
export const formatUKDate = (dateString) => {
  if (!dateString) return '';
  
  // If already in DD/MM/YYYY format, return as is
  if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    return dateString;
  }
  
  // If ISO format (YYYY-MM-DD), convert to DD/MM/YYYY
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
  
  // Try to parse as Date object
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  return dateString;
};

/**
 * Converts UK date format (DD/MM/YYYY) to ISO format (YYYY-MM-DD)
 * @param {string} ukDate - UK formatted date (DD/MM/YYYY)
 * @returns {string} - ISO formatted date (YYYY-MM-DD)
 */
export const ukDateToISO = (ukDate) => {
  if (!ukDate) return '';
  
  // If already in ISO format, return as is
  if (ukDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return ukDate;
  }
  
  // If UK format (DD/MM/YYYY), convert to ISO
  if (ukDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    const [day, month, year] = ukDate.split('/');
    return `${year}-${month}-${day}`;
  }
  
  return ukDate;
};

/**
 * Gets UK address format helper text
 * @returns {string} - Example UK address format
 */
export const getUKAddressExample = () => {
  return 'e.g., Flat 5, 123 High Street, London';
};

/**
 * Validates UK address line (basic validation)
 * @param {string} address - Address line to validate
 * @returns {boolean} - True if address has minimum required characters
 */
export const validateUKAddress = (address) => {
  if (!address) return false;
  return address.trim().length >= 5; // Minimum reasonable address length
};

