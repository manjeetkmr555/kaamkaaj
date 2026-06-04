const EMAIL_FORMAT =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const DOMAIN_LABEL = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)$/;

export const INVALID_EMAIL_MESSAGE =
  "Please enter a valid email address.";

export type ClientEmailCheck = {
  valid: boolean;
  message?: string;
  stage?: "format" | "domain";
};

export function validateEmailFormat(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  return EMAIL_FORMAT.test(trimmed);
}

export function validateEmailDomainStructure(email: string): boolean {
  const domain = email.trim().split("@")[1]?.toLowerCase();
  if (!domain) return false;

  if (domain.length > 253 || domain.startsWith(".") || domain.endsWith(".")) {
    return false;
  }

  const labels = domain.split(".");
  if (labels.length < 2) return false;

  const tld = labels[labels.length - 1];
  if (!tld || tld.length < 2 || !/^[a-zA-Z]{2,63}$/.test(tld)) {
    return false;
  }

  return labels.every((label) => DOMAIN_LABEL.test(label));
}

export function validateEmailClient(email: string): ClientEmailCheck {
  const trimmed = email.trim();

  if (!trimmed) {
    return { valid: false };
  }

  if (!validateEmailFormat(trimmed)) {
    return {
      valid: false,
      message: INVALID_EMAIL_MESSAGE,
      stage: "format",
    };
  }

  if (!validateEmailDomainStructure(trimmed)) {
    return {
      valid: false,
      message: INVALID_EMAIL_MESSAGE,
      stage: "domain",
    };
  }

  return { valid: true };
}
