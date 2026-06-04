import dns from "node:dns/promises";

const EMAIL_FORMAT =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const DOMAIN_LABEL = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)$/;

export type EmailValidationResult =
  | { valid: true; email: string; domain: string }
  | { valid: false; reason: "format" | "domain" | "dns" };

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

export async function validateEmailDomainDns(domain: string): Promise<boolean> {
  try {
    const mx = await dns.resolveMx(domain);
    if (mx.length > 0) return true;
  } catch {
    // fall through to A/AAAA lookup
  }

  try {
    await dns.resolve4(domain);
    return true;
  } catch {
    try {
      await dns.resolve6(domain);
      return true;
    } catch {
      return false;
    }
  }
}

export async function validateEmail(
  email: string,
  options?: { checkDns?: boolean },
): Promise<EmailValidationResult> {
  const normalized = email.trim().toLowerCase();

  if (!validateEmailFormat(normalized)) {
    return { valid: false, reason: "format" };
  }

  const domain = normalized.split("@")[1];
  if (!validateEmailDomainStructure(normalized)) {
    return { valid: false, reason: "domain" };
  }

  if (options?.checkDns !== false) {
    const dnsOk = await validateEmailDomainDns(domain);
    if (!dnsOk) {
      return { valid: false, reason: "dns" };
    }
  }

  return { valid: true, email: normalized, domain };
}

export const INVALID_EMAIL_MESSAGE =
  "Please enter a valid email address.";
