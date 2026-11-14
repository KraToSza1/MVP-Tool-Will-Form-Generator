/**
 * Keyboard / autofill hints for text inputs on phones: number pad for phone numbers, @ key for email,
 * capitals for postcodes, and browser contact autofill for the client's own details.
 * Partner fields get the keyboard hint but no autofill token (autofill would insert the client's own data).
 */
const PHONE_ID = /^(partner)?(mobile|mobilenumber|tel\d*|phone|phonenumber|telephone|telephonenumber)$/i;
const EMAIL_ID = /^(partner)?email$/i;
const POSTCODE_ID = /^(partner)?postcode$/i;
const ADDRESS_LINE_ID = /^(partner)?address([123])$/i;
const FIRST_NAME_ID = /^(partner)?firstname$/i;
const LAST_NAME_ID = /^(partner)?lastname$/i;

export function getMobileInputHints(field) {
  const id = String(field?.id || '');
  if (!id) return {};
  const isPartner = /^partner/i.test(id);
  const auto = (token) => (isPartner ? 'off' : token);

  if (PHONE_ID.test(id)) return { inputMode: 'tel', autoComplete: auto('tel') };
  if (EMAIL_ID.test(id) || field?.type === 'email') {
    return { inputMode: 'email', autoComplete: auto('email'), autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false };
  }
  if (POSTCODE_ID.test(id)) {
    return { autoComplete: auto('postal-code'), autoCapitalize: 'characters', autoCorrect: 'off', spellCheck: false };
  }
  const addr = id.match(ADDRESS_LINE_ID);
  if (addr) return { autoComplete: auto(`address-line${addr[2]}`) };
  if (FIRST_NAME_ID.test(id)) return { autoComplete: auto('given-name'), autoCapitalize: 'words' };
  if (LAST_NAME_ID.test(id)) return { autoComplete: auto('family-name'), autoCapitalize: 'words' };
  return {};
}
