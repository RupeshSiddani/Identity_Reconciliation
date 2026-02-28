export interface IdentifyRequest {
  email?: string;
  phoneNumber?: string;
}

export interface ContactResponse {
  primaryContatctId: number; // matching the spec's typo intentionally
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}
