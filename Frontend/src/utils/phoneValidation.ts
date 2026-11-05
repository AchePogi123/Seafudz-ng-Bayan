/**
 * Validates Philippine mobile phone numbers.
 * Requirement: Phone number must have exactly 9 digits (excluding the '09' prefix).
 * Standard format: 09XXXXXXXXX (11 digits total).
 */

export interface PhoneValidationResult {
  isValid: boolean;
  message?: string;
  normalized?: string;
  subscriberDigits?: string;
}

export function validatePhilippinePhone(input: string): PhoneValidationResult {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      message: 'Phone number is required.',
    };
  }

  // Extract only numeric digits
  let digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return {
      isValid: false,
      message: 'Phone number must contain numbers.',
    };
  }

  // Strip international country code if present (+63 or 63)
  if (digits.startsWith('63') && digits.length >= 11) {
    digits = digits.slice(2);
  }

  // Determine subscriber portion (excluding 09)
  let subscriberDigits = '';

  if (digits.startsWith('09')) {
    subscriberDigits = digits.slice(2);
  } else if (digits.startsWith('9') && digits.length === 10) {
    // e.g. 9171234567 (10 digits starting with 9) -> subscriber part is after 9
    subscriberDigits = digits.slice(1);
  } else if (!digits.startsWith('0') && digits.length === 9) {
    // User directly entered 9 digits excluding 09
    subscriberDigits = digits;
  } else if (digits.startsWith('0') && digits.length > 2 && !digits.startsWith('09')) {
    return {
      isValid: false,
      message: 'Mobile number must start with 09 followed by exactly 9 digits (e.g. 09XXXXXXXXX).',
    };
  } else {
    // Raw length check against 9 digits
    subscriberDigits = digits.startsWith('09') ? digits.slice(2) : digits;
  }

  if (subscriberDigits.length < 9) {
    return {
      isValid: false,
      message: `Phone number is too short. It must have exactly 9 digits (excluding 09). You entered ${subscriberDigits.length} digit${subscriberDigits.length === 1 ? '' : 's'}.`,
      subscriberDigits,
    };
  }

  if (subscriberDigits.length > 9) {
    return {
      isValid: false,
      message: `Phone number is too long. It must have exactly 9 digits (excluding 09). You entered ${subscriberDigits.length} digits.`,
      subscriberDigits,
    };
  }

  // Exactly 9 subscriber digits!
  return {
    isValid: true,
    normalized: `09${subscriberDigits}`,
    subscriberDigits,
  };
}
