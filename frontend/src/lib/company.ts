/** Who runs Rankwise: one place for the legal pages, the footer and anything else that names the business. */
export const COMPANY = {
  name: "Rankwise",
  email: "rudraai737@gmail.com",
  city: "Hyderabad",
  region: "Telangana",
  country: "India",
  /** last time the legal pages changed in substance */
  legalUpdated: "20 October 2026",
} as const;

export const LEGAL_LINKS = [
  ["Privacy policy", "/privacy"],
  ["Cookie policy", "/cookies"],
  ["Terms of service", "/terms"],
  ["Refund policy", "/refund-policy"],
  ["Contact", "/contact"],
] as const;
