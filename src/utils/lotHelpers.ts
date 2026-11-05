import {
  ColorMixEntry,
  IncomingLotRecord,
  LabTestStatus,
  VarietyCode,
} from '../types/qc';

const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

/**
 * Formats YYYY-MM-DD into Thai date with CE year (ค.ศ.) as requested e.g. "3 พ.ย. 2026"
 */
export function formatThaiDate(isoDate?: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length < 3) return isoDate;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return isoDate;
  }

  const monthLabel = THAI_MONTHS_SHORT[month - 1] || `${month}`;
  // User requested "เปลี่ยนเป็น คศ" (use CE year e.g., 2026 instead of 2569)
  return `${day} ${monthLabel} ${year}`;
}

/**
 * Calculates number of full calendar days between two YYYY-MM-DD strings
 */
export function daysBetweenIsoDates(date1: string, date2: string): number | null {
  if (!date1 || !date2) return null;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  const diffMs = d2.getTime() - d1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Adds N days to an ISO date string (YYYY-MM-DD)
 */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  if (!isoDate) return isoDate;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Formats YYYY-MM-DD into YYMMDD e.g. 2026-11-03 -> 261103
 */
export function formatDateToYYMMDD(isoDate: string): string {
  if (!isoDate) return '261103';
  const clean = isoDate.replace(/-/g, '');
  if (clean.length === 8) {
    return clean.slice(2);
  }
  return clean;
}

/**
 * Generates the next sequential incoming lot number: LOT-YYMMDD-VV###
 */
export function generateNextLotNumber(
  receivedDate: string,
  varietyCode: VarietyCode,
  existingLots: IncomingLotRecord[],
  offset = 0
): string {
  const yymmdd = formatDateToYYMMDD(receivedDate);
  const prefix = `LOT-${yymmdd}-${varietyCode}`;
  let maxSeq = 0;

  for (const lot of existingLots) {
    if (lot.lotNumber.startsWith(prefix)) {
      const suffix = lot.lotNumber.slice(prefix.length);
      const seq = parseInt(suffix, 10);
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = maxSeq + 1 + offset;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Real-time %Brix evaluation against 7-Eleven standard (> 6.0 %Brix)
 */
export function evaluateLabBrixStatus(brix: number | null): LabTestStatus {
  if (brix === null || !Number.isFinite(brix)) return 'PENDING';
  return brix > 6.0 ? 'PASS' : 'FAIL';
}

/**
 * Evaluates combined status for the 2 main pesticide groups
 */
export function evaluatePesticideTwoGroups(
  opCb: LabTestStatus | null | undefined,
  ocPy: LabTestStatus | null | undefined
): LabTestStatus {
  if (opCb === 'FAIL' || ocPy === 'FAIL') return 'FAIL';
  if (opCb === 'PASS' && ocPy === 'PASS') return 'PASS';
  return 'PENDING';
}

/**
 * Evaluates overall Lab status from Brix and Pesticide
 */
export function evaluateOverallLabStatus(
  brixStatus: LabTestStatus,
  pesticideStatus: LabTestStatus
): LabTestStatus {
  if (brixStatus === 'FAIL' || pesticideStatus === 'FAIL') return 'FAIL';
  if (brixStatus === 'PASS' && pesticideStatus === 'PASS') return 'PASS';
  return 'PENDING';
}

export interface ColorMixValidation {
  isValid: boolean;
  activeCount: number;
  hasGreen: boolean;
  hasRedOrPink: boolean;
  isWarmTrioWithoutGreen: boolean;
  reasons: string[];
}

/**
 * Evaluates color mix business rules:
 * - Must have 3 to 5 colors
 * - Must include Green (GR - กรูรามิ) and Red/Pink (SL - โซลาริโน่)
 * - Prohibits warm trio (Yellow + Red + Orange) without Green!
 */
export function evaluateColorMixRules(colorMix: ColorMixEntry[]): ColorMixValidation {
  const activeEntries = colorMix.filter((c) => Number(c.percentage) > 0);
  const activeCount = activeEntries.length;
  const activeCodes = new Set(activeEntries.map((c) => c.varietyCode));

  const hasGreen = activeCodes.has('GR');
  const hasRedOrPink = activeCodes.has('SL');
  const hasYellow = activeCodes.has('BL');
  const hasOrange = activeCodes.has('FV');

  const isWarmTrioWithoutGreen =
    hasYellow && hasRedOrPink && hasOrange && !hasGreen;

  const reasons: string[] = [];

  if (activeCount < 3) {
    reasons.push('ต้องคละสายพันธุ์อย่างน้อย 3 สีขึ้นไป (ปัจจุบันมี ' + activeCount + ' สี)');
  }
  if (activeCount > 5) {
    reasons.push('จำนวนสายพันธุ์เกินกำหนด (สูงสุด 5 สี)');
  }
  if (!hasGreen) {
    reasons.push('บังคับต้องมีสีเขียว (กรูรามิ)');
  }
  if (!hasRedOrPink) {
    reasons.push('บังคับต้องมีสีแดง (โซลาริโน่)');
  }
  if (isWarmTrioWithoutGreen) {
    reasons.push('ห้ามให้สีเหลือง แดง ส้ม อยู่ด้วยกันโดยไม่มีสีเขียวมาแซม');
  }

  const isValid =
    activeCount >= 3 &&
    activeCount <= 5 &&
    hasGreen &&
    hasRedOrPink &&
    !isWarmTrioWithoutGreen;

  return {
    isValid,
    activeCount,
    hasGreen,
    hasRedOrPink,
    isWarmTrioWithoutGreen,
    reasons,
  };
}

/**
 * Safely extracts all selected lot numbers from a ColorMixEntry (supporting multiple lots per color)
 */
export function getMixLotNumbers(entry?: ColorMixEntry | null): string[] {
  if (!entry) return [];
  if (Array.isArray(entry.lotNumbers) && entry.lotNumbers.length > 0) {
    return entry.lotNumbers.filter((l) => Boolean(l && l.trim()));
  }
  if (entry.lotNumber) {
    return entry.lotNumber
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}
