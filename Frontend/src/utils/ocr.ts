import { recognize } from 'tesseract.js';

/**
 * Extracts a GCash payment reference number from raw OCR text.
 * Handles formats like:
 * - "Ref No. 1234 567 890123"
 * - "Reference No. 1234567890123"
 * - "1001 234 5678"
 * - "Txn No. 9876543210123"
 */
export function extractGCashReference(text: string): string | null {
  if (!text) return null;

  // 1. Look for explicit "Ref No", "Reference No", "Ref", "Txn", "Transaction No"
  const refPrefixPatterns = [
    /(?:ref(?:erence)?\s*(?:no|number|#)?[:.\s]*)([0-9]{4}[\s-]?[0-9]{3,4}[\s-]?[0-9]{4,6}|[0-9]{9,16})/i,
    /(?:trans(?:action)?\s*(?:no|number|id|#)?[:.\s]*)([0-9]{4}[\s-]?[0-9]{3,4}[\s-]?[0-9]{4,6}|[0-9]{9,16})/i,
  ];

  for (const pattern of refPrefixPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // 2. Look for common GCash format: 4 digits, space, 3-4 digits, space, 4-6 digits (e.g. 1234 567 890123)
  const gcashFormatMatch = text.match(/\b([0-9]{4}\s+[0-9]{3,4}\s+[0-9]{4,6})\b/);
  if (gcashFormatMatch && gcashFormatMatch[1]) {
    return gcashFormatMatch[1].trim();
  }

  // 3. Fallback: Any sequence of 10 to 16 continuous digits (excluding Philippine mobile numbers starting with 09)
  const digitMatches = text.match(/\b([0-9]{10,16})\b/g);
  if (digitMatches) {
    const nonPhone = digitMatches.find((d) => !d.startsWith('09'));
    if (nonPhone) return nonPhone.trim();
    return digitMatches[0].trim();
  }

  return null;
}

export interface OcrResult {
  rawText: string;
  referenceNumber: string | null;
  confidence?: number;
}

/**
 * Runs Tesseract OCR on a receipt image (data URL, blob, file, or image URL)
 * and extracts the reference number.
 */
export async function extractReceiptReferenceFromImage(
  imageSource: string | File | Blob,
  onProgress?: (progress: number) => void
): Promise<OcrResult> {
  try {
    const result = await recognize(imageSource, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });

    const rawText = result.data.text || '';
    const referenceNumber = extractGCashReference(rawText);
    const confidence = result.data.confidence;

    return {
      rawText,
      referenceNumber,
      confidence,
    };
  } catch (error) {
    console.error('Tesseract OCR error:', error);
    throw error;
  }
}

