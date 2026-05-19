// Aristone Solicitors Company Profile - Complete Details
export const ARISTONE_PROFILE = {
  firmName: "Aristone Solicitors",
  legalEntityName: "Aristone Limited",
  tradingAs: "Aristone Solicitors", 
  sraNumber: "649717",
  companyNumber: "11373276",
  website: "https://www.aristonesolicitors.co.uk",
  email: "info@aristonesolicitors.co.uk",
  
  // Primary office (Luton)
  primaryOffice: {
    label: "Luton Office",
    addressLine1: "Ground Floor, 12 Cardiff Road",
    city: "Luton",
    postcode: "LU1 1QG",
    country: "United Kingdom",
    phone: "+44 1582 383 888",
    phoneFormatted: "01582 383 888"
  },
  
  // Secondary office (London)
  secondaryOffice: {
    label: "London Office", 
    addressLine1: "Summit House, 12 Red Lion Square",
    city: "London",
    postcode: "WC2R 4QH",
    country: "United Kingdom", 
    phone: "+44 2034 393 888",
    phoneFormatted: "02034 393 888"
  },
  
  // Legal compliance line
  complianceLine: "Authorised and regulated by the Solicitors Regulation Authority (SRA). SRA No. 649717.",
  
  // Named contact
  namedContact: "Ms Kuljit Lally",
  
  // Full legal format for professional appointments
  fullLegalFormat: "Aristone Limited (trading as Aristone Solicitors), SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG",
  
  // Auto-population object for form selections
  autoPopulateData: {
    firmName: "Aristone Limited (trading as Aristone Solicitors)",
    address: "Ground Floor, 12 Cardiff Road, Luton, LU1 1QG", 
    phone: "01582 383 888",
    email: "info@aristonesolicitors.co.uk",
    sraNumber: "649717",
    fullDetails: "Aristone Limited (trading as Aristone Solicitors), SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG"
  }
};

// Professional selection options template
export const ARISTONE_PROFESSIONAL_OPTIONS = [
  {
    value: "Aristone",
    label: "🥇 Aristone Solicitors (Recommended)",
    autoPopulate: ARISTONE_PROFILE.autoPopulateData
  },
  {
    value: "Other",
    label: "Other Professional (please specify)"
  }
];

// Helper function to get formatted firm name for legal documents
export const getAristoneLegalName = () => {
  return ARISTONE_PROFILE.fullLegalFormat;
};

/** Professional executor / trustee auto-populate block for PDF and form selections. */
export function getAristoneProfessionalExecutorOptions() {
  const { firmName, address, fullDetails } = ARISTONE_PROFILE.autoPopulateData;
  return {
    fullDetails: fullDetails || `${firmName}, of ${address}, Solicitors`,
    firmName,
    address,
    designation: 'Solicitors',
  };
}

// Helper function to get contact details
export const getAristoneContactDetails = () => {
  return {
    email: ARISTONE_PROFILE.email,
    phone: ARISTONE_PROFILE.primaryOffice.phoneFormatted,
    address: `${ARISTONE_PROFILE.primaryOffice.addressLine1}, ${ARISTONE_PROFILE.primaryOffice.city}, ${ARISTONE_PROFILE.primaryOffice.postcode}`,
    website: ARISTONE_PROFILE.website
  };
};