import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit,
  FileCheck2,
  Lock,
  MessageSquare,
  Plus,
  Scale,
  ShieldAlert,
  SlidersHorizontal,
  Thermometer,
  X,
  XCircle,
} from 'lucide-react';
import {
  ChecklistDefectRecord,
  ColorMixEntry,
  IncomingLotRecord,
  LabRecord,
  OutgoingRecord,
  TOMATO_VARIETIES,
  VARIETY_ORDER,
  VarietyCode,
} from '../types/qc';
import {
  addDaysToIsoDate,
  daysBetweenIsoDates,
  evaluateColorMixRules,
  formatDateToYYMMDD,
  formatThaiDate,
  getMixLotNumbers,
} from '../utils/lotHelpers';
import { CP_ALL_DC_OPTIONS } from '../data/initialData';

import { NotificationVariant } from './PopupNotification';

interface OutgoingQCViewProps {
  lots: IncomingLotRecord[];
  labRecords: LabRecord[];
  outgoingRecords: OutgoingRecord[];
  preselectedOqcId?: string | null;
  onSaveOutgoing: (record: OutgoingRecord) => void;
  onOpenCOA: (oqcId: string) => void;
  onNotify: (title: string, message: string, variant?: NotificationVariant) => void;
}

type MixPresetMode = 'preset_5' | 'preset_4' | 'preset_3' | 'custom';

const PRESET_5_COLORS: VarietyCode[] = ['SL', 'FV', 'BL', 'GR', 'CM'];
const PRESET_4_GREEN_MIX: VarietyCode[] = ['SL', 'FV', 'BL', 'GR'];
const PRESET_3_RYG: VarietyCode[] = ['SL', 'BL', 'GR'];

function matchesPreset(
  mix: ColorMixEntry[],
  target: VarietyCode[]
): boolean {
  const activeCodes = mix
    .filter((m) => (Number(m.percentage) || 0) > 0)
    .map((m) => m.varietyCode);
  if (activeCodes.length !== target.length) return false;
  return target.every((code) => activeCodes.includes(code));
}

function detectMixPresetMode(mix: ColorMixEntry[]): MixPresetMode {
  if (matchesPreset(mix, PRESET_5_COLORS)) return 'preset_5';
  if (matchesPreset(mix, PRESET_4_GREEN_MIX)) return 'preset_4';
  if (matchesPreset(mix, PRESET_3_RYG)) return 'preset_3';
  return 'custom';
}

interface ChecklistStandardMeta {
  itemNumber: number;
  title: string;
  categoryTag: string;
  criterion7Eleven: string;
  criterionSummary: string;
  commonReasons: string[];
  commonActions: string[];
}

export const CHECKLIST_STANDARDS: Record<number, ChecklistStandardMeta> = {
  1: {
    itemNumber: 1,
    title: 'การปิดผนึกฝากล่อง (Lid Sealing)',
    categoryTag: 'ตรวจพินิจ (Visual)',
    criterion7Eleven:
      'ฝากล่อง PET แบบล็อคสนิท 4 มุม ปิดแน่นหนา ไม่เผยอ ไม่ฉีกขาด และไม่หลุดเปิดขณะขนส่ง',
    criterionSummary: 'ฝากล่อง PET ล็อคสนิทครบ 4 มุม ไม่เผยอ',
    commonReasons: [
      'ฝากล่องปิดไม่สนิท มีมุมเผยอ 1-2 ด้าน',
      'สลักล็อคฝากล่องหักชำรุด',
      'ฝากล่องฉีกขาดจากการกดทับ',
      'กล่องบิดเบี้ยวทำให้ฝาปิดไม่เข้าล็อค',
    ],
    commonActions: [
      'คัดแยกกล่องที่ฝาเผยอออกและเปลี่ยนกล่อง PET ใหม่ทันที',
      'ตรวจสอบเครื่องรีดล็อคฝาและปรับแรงกดให้เข้าล็อคสนิท',
      'ตรวจสอบซ้ำ 100% ในรอบบรรจุนี้ก่อนปล่อยจัดส่ง',
      'อบรมพนักงานบรรจุให้ตรวจสอบเสียงคลิกล็อคทุกกล่อง',
    ],
  },
  3: {
    itemNumber: 3,
    title: 'ฉลาก MFG/EXP (+6 วัน) & ข้อความ "ล้างก่อนรับประทาน"',
    categoryTag: 'ตรวจฉลาก (Label)',
    criterion7Eleven:
      'อายุสินค้า (Shelf-life) 6 วันนับจากวันผลิต (MFG+6 วัน) และต้องระบุข้อความบังคับ "ล้างก่อนรับประทาน" (Wash before consumption) ชัดเจนบนฉลากทุกแพ็ค',
    criterionSummary: 'อายุสินค้า 6 วันนับจากผลิต & ระบุ "ล้างก่อนรับประทาน"',
    commonReasons: [
      'วันหมดอายุบนฉลากคำนวณเกิน 6 วันจากวันผลิต',
      'ตกหล่นข้อความบังคับ "ล้างก่อนรับประทาน"',
      'ตัวพิมพ์วันที่บนฉลากเลือนราง ไม่ชัดเจน',
      'ติดฉลากกลับด้านหรือฉลากยับย่นบดบังข้อความ',
    ],
    commonActions: [
      'สั่งพิมพ์ฉลากใหม่ที่ระบุวันผลิตและ EXP +6 วันถูกต้อง และติดทับทันที',
      'แก้ไขแบบฉลากให้มีข้อความ "ล้างก่อนรับประทาน" และพิมพ์ติดใหม่ทุกแพ็ค',
      'เปลี่ยนตลับหมึกเครื่องพิมพ์ฉลากและทดสอบความคมชัด',
      'กักสินค้าและตรวจสอบฉลาก 100% ก่อนยกเลิกการ HOLD',
    ],
  },
  4: {
    itemNumber: 4,
    title: 'น้ำหนักสุทธิสินค้า (Net Weight)',
    categoryTag: 'ชั่งวัด (Weight)',
    criterion7Eleven:
      'น้ำหนักสุทธิต่อแพ็คไม่น้อยกว่า 140.0 กรัม (≥ 140 g) ไม่รวมน้ำหนักกล่องบรรจุภัณฑ์',
    criterionSummary: 'น้ำหนักสุทธิ ≥ 140.0 กรัมต่อแพ็ค',
    commonReasons: [
      'น้ำหนักสุทธิสุ่มตรวจได้ต่ำกว่า 140 กรัม (เช่น 136-138 กรัม)',
      'การตั้งค่าน้ำหนักบนเครื่องชั่งคัดแยกเบี่ยงเบน',
      'ขนาดผลมะเขือเทศคละไม่ได้สัดส่วนน้ำหนักตามเกณฑ์',
      'ความคลาดเคลื่อนของเครื่องชั่งดิจิทัล',
    ],
    commonActions: [
      'ชั่งตรวจสอบ 100% และเติมผลมะเขือเทศให้ได้น้ำหนัก ≥ 140 กรัมทุกแพ็ค',
      'ปรับเทียบ (Calibrate) เครื่องชั่งดิจิทัลด้วยตุ้มน้ำหนักมาตรฐาน 200 กรัม',
      'คัดแยกแพ็คที่น้ำหนักต่ำกว่าเกณฑ์ออกเพื่อบรรจุใหม่',
      'เพิ่มความถี่ในการสุ่มตรวจน้ำหนักระหว่างบรรจุเป็นทุกๆ 50 แพ็ค',
    ],
  },
  5: {
    itemNumber: 5,
    title: 'ลักษณะทางกายภาพของสินค้า (Physical Quality)',
    categoryTag: 'ตรวจพินิจ (Physical)',
    criterion7Eleven:
      'ผลสดตึง ผิวเงางาม ขั้วเขียวสด ไม่มีหยดน้ำเกาะภายในกล่อง ไม่พบผลแตก/ช้ำ/รอยแผล/เชื้อรา สิ่งแปลกปลอม 0%',
    criterionSummary: 'ผลสดตึง ไร้หยดน้ำ ไม่พบผลช้ำหรือเชื้อรา',
    commonReasons: [
      'พบหยดน้ำเกาะภายในกล่องบรรจุภัณฑ์เนื่องจากอุณหภูมิเปลี่ยนเฉียบพลัน',
      'พบผลแตกหรือช้ำบริเวณขั้วผล',
      'มีผลเหี่ยวหรือสีไม่สม่ำเสมอในแพ็ค',
      'พบขั้วหลุดเกิน 10% หรือขั้วแห้งดำ',
    ],
    commonActions: [
      'คัดแยกผลที่มีรอยแตกหรือช้ำออก 100% และบรรจุผลสดใหม่ทดแทน',
      'เปิดระบายอากาศและเช็ดแห้งในห้องควบคุมความเย็นเพื่อป้องกันหยดน้ำ',
      'ปรับลดแรงกระแทกระหว่างสายพานลำเลียงบรรจุ',
      'สุ่มตรวจเข้มงวด 2 เท่าก่อนนำจัดเรียงลงตะกร้าขนส่ง',
    ],
  },
  6: {
    itemNumber: 6,
    title: 'จำนวนสินค้าตรงตามใบสั่งซื้อ (Order & Actual Quantity)',
    categoryTag: 'ยอดส่งมอบ (Delivery)',
    criterion7Eleven:
      'ยอดบรรจุจริงต้องครบถ้วนตรงตามใบสั่งซื้อ PO (ครบ 100% ไม่ขาดส่ง) และบรรจุลงตะกร้าตามจำนวนที่กำหนด',
    criterionSummary: 'ยอดบรรจุจริงตรงตาม PO ครบ 100% ขาดไม่ได้',
    commonReasons: [
      'ยอดบรรจุจริงไม่ครบตามจำนวนสั่งซื้อในใบ PO (ยอดขาด)',
      'จำนวนตะกร้าขนส่งไม่สัมพันธ์กับยอดแพ็คที่บรรจุ',
      'สินค้าชำรุดระหว่างบรรจุทำให้ยอดรวมไม่ครบ',
      'การนับจำนวนแพ็คต่อตะกร้าคลาดเคลื่อน',
    ],
    commonActions: [
      'เร่งบรรจุสินค้าเพิ่มเติมให้ครบตามจำนวนใบสั่งซื้อ PO ก่อนเวลาตัดรอบขนส่ง',
      'ตรวจนับจำนวนแพ็คต่อตะกร้าใหม่ทุกใบและบันทึกยอดจริง',
      'ประสานงานฝ่ายผลิตเพื่อเสริมวัตถุดิบเร่งด่วน',
      'ติดป้ายระบุจำนวนแพ็คที่แน่นอนบนตะกร้าขนส่งทุกใบ',
    ],
  },
  7: {
    itemNumber: 7,
    title: 'อุณหภูมิห้องขณะตรวจ/พักสินค้า (Room Temperature 2–6 °C)',
    categoryTag: 'ควบคุมความเย็น (Cold Chain)',
    criterion7Eleven:
      'ควบคุมอุณหภูมิห้องระหว่างการตรวจและเตรียมจัดส่งสินค้าให้อยู่ในช่วง 2.0 °C ถึง 6.0 °C ตลอดเวลา (Cold Chain Control)',
    criterionSummary: 'ควบคุมความเย็น 2.0 – 6.0 °C ตลอดการตรวจ',
    commonReasons: [
      'อุณหภูมิห้องตรวจวัดได้สูงกว่า 6.0 °C (เช่น 7.5 °C)',
      'ประตูห้องควบคุมความเย็นเปิดค้างขณะลำเลียงสินค้า',
      'ระบบทำความเย็นห้องตรวจมีปัญหาหรืออยู่ในช่วง Defrost',
      'ตำแหน่งวัดอุณหภูมิใกล้ทางเข้า-ออกหรือจุดรับแดด',
    ],
    commonActions: [
      'ปรับตั้งค่าเครื่องทำความเย็นและรอให้อุณหภูมิลดลงสู่ 2.0-6.0 °C ก่อนปล่อยสินค้า',
      'ปิดม่านริ้วพลาสติกและประตูกันความเย็นทันทีเพื่อรักษาอุณหภูมิ',
      'ย้ายสินค้าไปพักในห้องเย็นหลัก (Cold Storage) ที่มีอุณหภูมิ 3-4 °C ทันที',
      'แจ้งฝ่ายช่างซ่อมบำรุงตรวจสอบระบบทำความเย็นฉุกเฉิน',
    ],
  },
  8: {
    itemNumber: 8,
    title: 'ความสะอาดและความเรียบร้อยของตะกร้าขนส่ง (Crate Sanitization)',
    categoryTag: 'สุขอนามัย (Sanitation)',
    criterion7Eleven:
      'ตะกร้าพลาสติกขนส่งต้องผ่านการล้างฆ่าเชื้อ แห้งสนิท ไม่มีคราบดิน ฝุ่น หรือสิ่งสกปรก จัดเรียงซ้อนล็อกมั่นคง ไม่แตกร้าว',
    criterionSummary: 'ตะกร้าผ่านการล้างฆ่าเชื้อ แห้งสะอาด เรียงซ้อนมั่นคง',
    commonReasons: [
      'พบฝุ่นหรือคราบดินติดบริเวณก้นหรือขอบตะกร้าขนส่ง',
      'ตะกร้ายังมีความชื้นหรือเปียกน้ำจากการล้าง',
      'พบตะกร้ามีรอยแตกหรือบิดเบี้ยวทำให้ซ้อนไม่ลงล็อค',
      'ไม่มีป้ายระบุสถานะผ่านการล้างฆ่าเชื้อ (Sanitized)',
    ],
    commonActions: [
      'เปลี่ยนตะกร้าขนส่งใบใหม่ที่ผ่านการล้างฆ่าเชื้อและแห้งสะอาดทันที',
      'นำตะกร้าที่มีคราบสกปรกกลับไปล้างทำความสะอาดและอบแห้งใหม่',
      'คัดแยกตะกร้าที่แตกหักหรือชำรุดออกจากวงจรการใช้งาน',
      'จัดเรียงตะกร้าซ้อนล็อคให้มั่นคงและติดสายรัดป้องกันการเอียงล้ม',
    ],
  },
};

export const OutgoingQCView: React.FC<OutgoingQCViewProps> = ({
  lots,
  labRecords,
  outgoingRecords,
  preselectedOqcId,
  onSaveOutgoing,
  onOpenCOA,
  onNotify,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inspectionDate, setInspectionDate] = useState<string>('2026-11-03');
  const [inspectionTime, setInspectionTime] = useState<string>('14:15');
  const [customerName, setCustomerName] = useState<string>(
    'บริษัท ซีพี ออลล์ จำกัด (มหาชน)'
  );
  const [distributionCenter, setDistributionCenter] = useState<string>(
    'DC บางบัวทอง (BTH-DC)'
  );
  const [poNumber, setPoNumber] = useState<string>('');
  const [productName, setProductName] = useState<string>(
    'มะเขือเทศเชอร์รี่คละสีคัดพิเศษ (Medley Cherry Tomato 140 กรัม)'
  );
  const [mfgDate, setMfgDate] = useState<string>('2026-11-03');
  const [expDate, setExpDate] = useState<string>('2026-11-09'); // 6 วันนับจากการผลิต

  // 8 OQC Checklists
  // 1. การปิดผนึกฝากล่อง
  const [check1LidSealing, setCheck1LidSealing] = useState<boolean>(true);
  const [check1Note, setCheck1Note] = useState<string>(
    'ฝากล่อง PET ปิดสนิทครบทุกมุม ไม่เผยอหรือฉีกขาด'
  );

  // 2. การผสมสีครบ 3-5 สายพันธุ์ (บังคับมีสีเขียวคู่กับสีแดง/ชมพู)
  const buildDefaultMix = (): ColorMixEntry[] => {
    return VARIETY_ORDER.map((code) => {
      const candidate =
        lots.find((l) => l.varietyCode === code && l.disposition !== 'REJECT') ||
        lots.find((l) => l.varietyCode === code);
      const defaultLots = candidate ? [candidate.lotNumber] : [];
      return {
        varietyCode: code,
        lotNumber: defaultLots.join(', '),
        lotNumbers: defaultLots,
        percentage: 1,
      };
    });
  };

  const [colorMix, setColorMix] = useState<ColorMixEntry[]>(buildDefaultMix);
  const [presetMode, setPresetMode] = useState<MixPresetMode>('preset_5');
  const [customMixHint, setCustomMixHint] = useState<string>('');

  // 3. ฉลากระบุวันผลิตและวันหมดอายุ (6 วันนับจากการผลิต) + ข้อความบังคับ "ล้างก่อนรับประทาน"
  const [check3ExpiryLabel, setCheck3ExpiryLabel] = useState<boolean>(true);
  const [check3WashLabel, setCheck3WashLabel] = useState<boolean>(true);
  const [check3Note, setCheck3Note] = useState<string>(
    'ฉลากระบุวันผลิต-วันหมดอายุ (+6 วัน) และข้อความบังคับ "ล้างก่อนรับประทาน" (Wash before consumption) ชัดเจน'
  );

  // 4. น้ำหนักสุทธิ (140 กรัม)
  const [netWeightG, setNetWeightG] = useState<number>(142);
  const [check4Note, setCheck4Note] = useState<string>(
    'น้ำหนักสุทธิผ่านเกณฑ์มาตรฐาน ≥ 140 กรัม'
  );

  // 5. ลักษณะทางกายภาพของสินค้า
  const [check5Physical, setCheck5Physical] = useState<boolean>(true);
  const [check5Note, setCheck5Note] = useState<string>(
    'ผลสดตึงเงางาม ไม่มีหยดน้ำเกาะภายในกล่อง ไม่พบผลช้ำหรือเชื้อรา'
  );

  // 6. จำนวนสินค้าตรงตามใบสั่งซื้อ
  const [orderedPacks, setOrderedPacks] = useState<number>(600);
  const [actualPacks, setActualPacks] = useState<number>(600);
  const [crateQty, setCrateQty] = useState<number>(25);

  // 7. อุณหภูมิห้องขณะตรวจตามเกณฑ์ 2-6 °C
  const [roomTempC, setRoomTempC] = useState<number>(4.2);

  // 8. ความสะอาดและความเรียบร้อยของตะกร้าขนส่ง
  const [check8CrateClean, setCheck8CrateClean] = useState<boolean>(true);
  const [check8Note, setCheck8Note] = useState<string>(
    'ตะกร้าขนส่งผ่านการล้างฆ่าเชื้อ แห้งสะอาด จัดเรียงเป็นระเบียบ'
  );

  // Defect Tracking state for Checklists 1, 3, 4, 5, 6, 7, 8
  const [checkDefects, setCheckDefects] = useState<Record<number, ChecklistDefectRecord>>({});
  const [activeDefectModal, setActiveDefectModal] = useState<number | null>(null);
  const [defectReasonInput, setDefectReasonInput] = useState<string>('');
  const [defectActionInput, setDefectActionInput] = useState<string>('');
  const [defectModalError, setDefectModalError] = useState<string | null>(null);

  // Inspector & Remarks (Vehicle Release Sign-off removed)
  const [oqcInspector, setOqcInspector] = useState<string>('ศิริพร รัตนวงศ์ (เจ้าหน้าที่ OQC)');
  const [oqcRemarks, setOqcRemarks] = useState<string>('');

  const labMap = useMemo(() => {
    const m = new Map<string, LabRecord>();
    for (const r of labRecords) m.set(r.lotNumber, r);
    return m;
  }, [labRecords]);

  // Checklist Auto-Evaluations (8 Checklists)
  const mixValidation = useMemo(() => evaluateColorMixRules(colorMix), [colorMix]);

  const activeMixEntries = useMemo(
    () => colorMix.filter((c) => Number(c.percentage) > 0),
    [colorMix]
  );

  const check2MixValid = mixValidation.isValid;

  // Check 3: Shelf life must be 6 days from MFG + label checkbox checked
  const shelfLifeDays = useMemo(
    () => daysBetweenIsoDates(mfgDate, expDate),
    [mfgDate, expDate]
  );
  const isSixDayShelfLife = shelfLifeDays === 6;
  const rawCheck3Pass = check3ExpiryLabel && isSixDayShelfLife && check3WashLabel;

  // Raw checks
  const rawCheck4NetWeightPass = netWeightG >= 140;
  const rawCheck6QtyMatch = orderedPacks > 0 && orderedPacks === actualPacks;
  const rawCheck7RoomTempPass = roomTempC >= 2.0 && roomTempC <= 6.0;

  // Final evaluations incorporating defect overrides
  const isItem1Pass = check1LidSealing && !checkDefects[1];
  const isItem3Pass = rawCheck3Pass && !checkDefects[3];
  const isItem4Pass = rawCheck4NetWeightPass && !checkDefects[4];
  const isItem5Pass = check5Physical && !checkDefects[5];
  const isItem6Pass = rawCheck6QtyMatch && !checkDefects[6];
  const isItem7Pass = rawCheck7RoomTempPass && !checkDefects[7];
  const isItem8Pass = check8CrateClean && !checkDefects[8];

  const passedChecklistCount = [
    isItem1Pass,
    check2MixValid,
    isItem3Pass,
    isItem4Pass,
    isItem5Pass,
    isItem6Pass,
    isItem7Pass,
    isItem8Pass,
  ].filter(Boolean).length;

  const allEightChecksPass = passedChecklistCount === 8;

  const handleSetItemPass = (itemNumber: number) => {
    setCheckDefects((prev) => {
      const next = { ...prev };
      delete next[itemNumber];
      return next;
    });

    switch (itemNumber) {
      case 1:
        setCheck1LidSealing(true);
        break;
      case 3:
        setCheck3ExpiryLabel(true);
        setCheck3WashLabel(true);
        if (shelfLifeDays !== 6) {
          setExpDate(addDaysToIsoDate(mfgDate, 6));
        }
        break;
      case 4:
        if (netWeightG < 140) {
          setNetWeightG(142);
        }
        break;
      case 5:
        setCheck5Physical(true);
        break;
      case 6:
        setActualPacks(orderedPacks);
        break;
      case 7:
        if (roomTempC < 2.0 || roomTempC > 6.0) {
          setRoomTempC(4.2);
        }
        break;
      case 8:
        setCheck8CrateClean(true);
        break;
    }
    onNotify('ปรับสถานะเป็น PASS', `รายการที่ ${itemNumber} ผ่านเกณฑ์มาตรฐาน 7-Eleven`, 'success');
  };

  const handleOpenFailModal = (itemNumber: number) => {
    const existing = checkDefects[itemNumber];
    const std = CHECKLIST_STANDARDS[itemNumber];
    setActiveDefectModal(itemNumber);
    setDefectReasonInput(existing?.reason || std?.commonReasons[0] || '');
    setDefectActionInput(existing?.correctiveAction || std?.commonActions[0] || '');
    setDefectModalError(null);
  };

  const handleConfirmFailModal = () => {
    if (!activeDefectModal) return;
    const reasonTrimmed = defectReasonInput.trim();
    const actionTrimmed = defectActionInput.trim();

    if (!reasonTrimmed || !actionTrimmed) {
      setDefectModalError(
        'กรุณากรอกข้อมูลให้ครบถ้วนทั้ง 2 ช่อง: สาเหตุที่ไม่ผ่านเกณฑ์ และ วิธีแก้ไข (Corrective Action)'
      );
      return;
    }

    const itemNum = activeDefectModal;
    setCheckDefects((prev) => ({
      ...prev,
      [itemNum]: {
        itemNumber: itemNum,
        reason: reasonTrimmed,
        correctiveAction: actionTrimmed,
        recordedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      },
    }));

    switch (itemNum) {
      case 1:
        setCheck1LidSealing(false);
        break;
      case 3:
        setCheck3ExpiryLabel(false);
        break;
      case 5:
        setCheck5Physical(false);
        break;
      case 8:
        setCheck8CrateClean(false);
        break;
    }

    setActiveDefectModal(null);
    setDefectModalError(null);
    onNotify(
      'บันทึกข้อบกพร่อง & วิธีแก้ไขเรียบร้อยแล้ว',
      `รายการที่ ${itemNum} ถูกบันทึกเป็น FAIL พร้อมข้อมูล CAPA`,
      'warning'
    );
  };

  const handlePassAllTableItems = () => {
    setCheck1LidSealing(true);
    setCheck3ExpiryLabel(true);
    setCheck3WashLabel(true);
    if (shelfLifeDays !== 6) {
      setExpDate(addDaysToIsoDate(mfgDate, 6));
    }
    if (netWeightG < 140) setNetWeightG(142);
    setCheck5Physical(true);
    setActualPacks(orderedPacks);
    if (roomTempC < 2.0 || roomTempC > 6.0) setRoomTempC(4.2);
    setCheck8CrateClean(true);
    setCheckDefects({});
    onNotify(
      'ยืนยันผ่านเกณฑ์ทั้งหมด',
      'ปรับสถานะเช็คลิสต์ทั้ง 7 รายการเป็น PASS ผ่านเกณฑ์มาตรฐาน 7-Eleven เรียบร้อยแล้ว',
      'success'
    );
  };

  const hasLinkedLabFail = useMemo(() => {
    return activeMixEntries.some((entry) => {
      const lotsList = getMixLotNumbers(entry);
      if (lotsList.length === 0) return true;
      return lotsList.some((lotNo) => {
        const lab = labMap.get(lotNo);
        return !lab || lab.overallLabStatus !== 'PASS';
      });
    });
  }, [activeMixEntries, labMap]);

  const totalSelectedLotsCount = useMemo(() => {
    return activeMixEntries.reduce(
      (acc, entry) => acc + getMixLotNumbers(entry).length,
      0
    );
  }, [activeMixEntries]);

  const nextOqcNumber = useMemo(() => {
    const yymmdd = formatDateToYYMMDD(inspectionDate);
    const prefix = `OQC-${yymmdd}-`;
    let maxSeq = 0;
    for (const r of outgoingRecords) {
      if (r.oqcNumber.startsWith(prefix)) {
        const n = parseInt(r.oqcNumber.slice(prefix.length), 10);
        if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  }, [inspectionDate, outgoingRecords]);

  const nextCoaNumber = useMemo(() => {
    const cleanDate = inspectionDate.replace(/-/g, '') || '20261103';
    const yyyymm = cleanDate.slice(0, 6) || '202611';
    const prefix = `COA-MCT-${yyyymm}-`;
    let maxSeq = 0;
    for (const r of outgoingRecords) {
      if (r.coaNumber.startsWith(prefix)) {
        const n = parseInt(r.coaNumber.slice(prefix.length), 10);
        if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }, [inspectionDate, outgoingRecords]);

  const handleMfgDateChange = (newMfg: string) => {
    setMfgDate(newMfg);
    setExpDate(addDaysToIsoDate(newMfg, 6));
  };

  const handleToggleLotForVariety = (
    varietyCode: VarietyCode,
    lotNumber: string
  ) => {
    setColorMix((prev) =>
      prev.map((entry) => {
        if (entry.varietyCode !== varietyCode) return entry;
        const currentLots = getMixLotNumbers(entry);
        const exists = currentLots.includes(lotNumber);
        const nextLots = exists
          ? currentLots.filter((l) => l !== lotNumber)
          : [...currentLots, lotNumber];
        return {
          ...entry,
          lotNumbers: nextLots,
          lotNumber: nextLots.join(', '),
        };
      })
    );
  };

  const handleSelectAllLotsForVariety = (
    varietyCode: VarietyCode,
    allLots: string[]
  ) => {
    setColorMix((prev) =>
      prev.map((entry) => {
        if (entry.varietyCode !== varietyCode) return entry;
        return {
          ...entry,
          lotNumbers: allLots,
          lotNumber: allLots.join(', '),
        };
      })
    );
  };

  const handleClearLotsForVariety = (varietyCode: VarietyCode) => {
    setColorMix((prev) =>
      prev.map((entry) => {
        if (entry.varietyCode !== varietyCode) return entry;
        return {
          ...entry,
          lotNumbers: [],
          lotNumber: '',
        };
      })
    );
  };

  const applyMixPreset = (
    activeCodes: VarietyCode[],
    mode: MixPresetMode
  ) => {
    setPresetMode(mode);
    setCustomMixHint('');
    setColorMix((prev) =>
      prev.map((item) => {
        const isSelected = activeCodes.includes(item.varietyCode);
        const currentLots = getMixLotNumbers(item);
        if (isSelected && currentLots.length === 0) {
          const fallbackLot =
            lots.find(
              (l) => l.varietyCode === item.varietyCode && l.disposition !== 'REJECT'
            ) || lots.find((l) => l.varietyCode === item.varietyCode);
          const initialLots = fallbackLot ? [fallbackLot.lotNumber] : [];
          return {
            ...item,
            percentage: 1,
            lotNumbers: initialLots,
            lotNumber: initialLots.join(', '),
          };
        }
        return {
          ...item,
          percentage: isSelected ? 1 : 0,
          lotNumbers: currentLots,
          lotNumber: currentLots.join(', '),
        };
      })
    );
  };

  const handleActivateCustomPreset = () => {
    setPresetMode('custom');
    setCustomMixHint('');
  };

  const handleToggleCustomVariety = (code: VarietyCode) => {
    if (code === 'SL' || code === 'GR') {
      setCustomMixHint(
        'บังคับต้องมีสีเขียว (กรูรามิ) คู่กับสีแดง (โซลาริโน่) เสมอตามเกณฑ์คละสี'
      );
      return;
    }

    setCustomMixHint('');
    setColorMix((prev) => {
      const currentEntry = prev.find((c) => c.varietyCode === code);
      const isCurrentlySelected = (Number(currentEntry?.percentage) || 0) > 0;
      const willBeSelected = !isCurrentlySelected;

      return prev.map((item) => {
        if (item.varietyCode !== code) return item;
        const currentLots = getMixLotNumbers(item);
        if (willBeSelected && currentLots.length === 0) {
          const fallbackLot =
            lots.find(
              (l) => l.varietyCode === item.varietyCode && l.disposition !== 'REJECT'
            ) || lots.find((l) => l.varietyCode === item.varietyCode);
          const initialLots = fallbackLot ? [fallbackLot.lotNumber] : [];
          return {
            ...item,
            percentage: 1,
            lotNumbers: initialLots,
            lotNumber: initialLots.join(', '),
          };
        }
        return {
          ...item,
          percentage: willBeSelected ? 1 : 0,
          lotNumbers: currentLots,
          lotNumber: currentLots.join(', '),
        };
      });
    });
    setPresetMode('custom');
  };

  const handleLoadRecord = (rec: OutgoingRecord) => {
    setEditingId(rec.id);
    setInspectionDate(rec.inspectionDate);
    setInspectionTime(rec.inspectionTime);
    setCustomerName(rec.customerName);
    setDistributionCenter(rec.distributionCenter || 'DC บางบัวทอง (BTH-DC)');
    setPoNumber(rec.poNumber);
    setProductName(rec.productName);
    setMfgDate(rec.mfgDate);
    setExpDate(rec.expDate);
    setCheck1LidSealing(rec.check1LidSealing);
    setCheck1Note(rec.check1Note);
    const clonedMix = rec.colorMix.map((c) => {
      const arr = getMixLotNumbers(c);
      return {
        ...c,
        lotNumbers: arr,
        lotNumber: arr.join(', '),
      };
    });
    setColorMix(clonedMix);
    setPresetMode(detectMixPresetMode(clonedMix));
    setCustomMixHint('');
    setCheck3ExpiryLabel(rec.check3ExpiryLabel);
    setCheck3WashLabel(rec.check3WashLabel ?? true);
    setCheck3Note(rec.check3Note);
    setNetWeightG(rec.netWeightG);
    setCheck4Note(rec.check4Note);
    setCheck5Physical(rec.check5Physical);
    setCheck5Note(rec.check5Note);
    setOrderedPacks(rec.orderedPacks);
    setActualPacks(rec.actualPacks);
    setCrateQty(rec.crateQty);
    setRoomTempC(rec.roomTempC);
    setCheck8CrateClean(rec.check8CrateClean);
    setCheck8Note(rec.check8Note);
    setCheckDefects(rec.checkDefects || {});
    setOqcInspector(rec.oqcInspector);
    setOqcRemarks(rec.oqcRemarks);
  };

  useEffect(() => {
    if (preselectedOqcId) {
      const target = outgoingRecords.find((r) => r.id === preselectedOqcId);
      if (target) {
        handleLoadRecord(target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedOqcId]);

  const resetForm = () => {
    setEditingId(null);
    setCustomerName('บริษัท ซีพี ออลล์ จำกัด (มหาชน)');
    setDistributionCenter('DC บางบัวทอง (BTH-DC)');
    setPoNumber('');
    setMfgDate('2026-11-03');
    setExpDate('2026-11-09');
    setCheck1LidSealing(true);
    setColorMix(buildDefaultMix());
    setPresetMode('preset_5');
    setCustomMixHint('');
    setCheck3ExpiryLabel(true);
    setCheck3WashLabel(true);
    setNetWeightG(142);
    setCheck5Physical(true);
    setOrderedPacks(600);
    setActualPacks(600);
    setCrateQty(25);
    setRoomTempC(4.2);
    setCheck8CrateClean(true);
    setCheckDefects({});
    setOqcRemarks('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !distributionCenter.trim() || !poNumber.trim()) {
      onNotify(
        'กรุณากรอกข้อมูลคู่ค้าให้ครบถ้วน',
        'กรุณาระบุชื่อคู่ค้า/ลูกค้า ศูนย์กระจายสินค้าปลายทาง (DC) และเลขที่ใบสั่งซื้อ (PO No.)',
        'error'
      );
      return;
    }

    if (!oqcInspector.trim()) {
      onNotify(
        'ข้อมูลไม่ครบถ้วน',
        'กรุณาระบุชื่อเจ้าหน้าที่ผู้ตรวจสอบ OQC',
        'error'
      );
      return;
    }

    const activeWithNoLots = activeMixEntries.filter(
      (entry) => getMixLotNumbers(entry).length === 0
    );
    if (activeWithNoLots.length > 0) {
      onNotify(
        'ยังไม่ได้เลือกล็อตวัตถุดิบ',
        `กรุณาเลือกล็อตอย่างน้อย 1 ล็อตสำหรับสี: ${activeWithNoLots
          .map((m) => TOMATO_VARIETIES[m.varietyCode].nameTh)
          .join(', ')}`,
        'error'
      );
      return;
    }

    const existing = outgoingRecords.find((r) => r.id === editingId);
    const oqcStatus = allEightChecksPass ? 'PASS' : 'FAIL';

    const record: OutgoingRecord = {
      id: editingId || `oqc-${Date.now()}`,
      oqcNumber: existing?.oqcNumber || nextOqcNumber,
      coaNumber: existing?.coaNumber || nextCoaNumber,
      inspectionDate,
      inspectionTime,
      customerName: customerName.trim(),
      distributionCenter: distributionCenter.trim(),
      poNumber: poNumber.trim(),
      productName: productName.trim(),
      mfgDate,
      expDate,
      check1LidSealing: isItem1Pass,
      check1Note: check1Note.trim(),
      colorMix: colorMix.map((c) => {
        const isSelected = (Number(c.percentage) || 0) > 0;
        const lotsArr = isSelected ? getMixLotNumbers(c) : [];
        return {
          ...c,
          percentage: isSelected ? Number(c.percentage) || 1 : 0,
          lotNumbers: lotsArr,
          lotNumber: lotsArr.join(', '),
        };
      }),
      check2MixValid,
      check3ExpiryLabel: isItem3Pass,
      check3WashLabel,
      check3Note: check3Note.trim(),
      netWeightG: Number(netWeightG) || 0,
      check4NetWeightPass: isItem4Pass,
      check4Note: check4Note.trim(),
      check5Physical: isItem5Pass,
      check5Note: check5Note.trim(),
      orderedPacks: Number(orderedPacks) || 0,
      actualPacks: Number(actualPacks) || 0,
      crateQty: Number(crateQty) || 0,
      check6QtyMatch: isItem6Pass,
      roomTempC: Number(roomTempC) || 0,
      check7RoomTempPass: isItem7Pass,
      check8CrateClean: isItem8Pass,
      check8Note: check8Note.trim(),
      checkDefects,
      oqcInspector: oqcInspector.trim(),
      oqcStatus,
      oqcRemarks: oqcRemarks.trim(),
    };

    onSaveOutgoing(record);
    onNotify(
      'บันทึกผลตรวจปล่อยสินค้า (OQC) เรียบร้อยแล้ว',
      `เอกสาร ${record.oqcNumber} (ใบรับรอง ${record.coaNumber}) บันทึกสำเร็จ`,
      'success'
    );
    resetForm();
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200"
      >
        {/* Header & Order Info */}
        <div className="p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId
                  ? 'แก้ไขการตรวจคุณภาพสินค้าสำเร็จรูป Finish good (FG Inspection)'
                  : 'การตรวจคุณภาพสินค้าสำเร็จรูป Finish good (8 เช็คลิสต์มาตรฐาน CP ALL DC)'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ตรวจสอบความพร้อมสินค้าสำเร็จรูปครบ 8 หัวข้อมาตรฐาน (ผสมสี 3–5 สายพันธุ์ · อายุสินค้า 6 วัน · น้ำหนักสุทธิ 140 กรัม · อุณหภูมิ 2–6 °C)
              </p>
            </div>
            <div className="text-xs font-medium tabular-nums text-slate-600 shrink-0">
              เลขที่เอกสาร:{' '}
              <strong className="font-semibold text-slate-900">
                {editingId
                  ? outgoingRecords.find((r) => r.id === editingId)?.oqcNumber
                  : nextOqcNumber}
              </strong>{' '}
              · ผ่านเกณฑ์{' '}
              <strong className={allEightChecksPass ? 'text-emerald-700' : 'text-red-700'}>
                {passedChecklistCount}/8 ข้อ
              </strong>
            </div>
          </div>

          {hasLinkedLabFail && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-sky-50 border border-sky-300 text-sky-950 text-xs font-medium flex items-center gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                แจ้งเตือนสำคัญ: มีล็อตมะเขือเทศที่เลือกในสูตรผสมสีมีผลตรวจ QC LAB เป็น FAIL — ระบบจะระงับตรายางดิจิทัล QA PASSED บนใบรับรอง COA อัตโนมัติ
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                ชื่อคู่ค้า / ลูกค้า *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="บริษัท ซีพี ออลล์ จำกัด (มหาชน)"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                ศูนย์กระจายสินค้า (DC) *
              </label>
              <input
                type="text"
                list="cpall-dc-list"
                value={distributionCenter}
                onChange={(e) => setDistributionCenter(e.target.value)}
                placeholder="DC บางบัวทอง (BTH-DC)"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <datalist id="cpall-dc-list">
                {CP_ALL_DC_OPTIONS.map((dc) => (
                  <option key={dc} value={dc} />
                ))}
              </datalist>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                เลขที่ใบสั่งซื้อ (PO No.) *
              </label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="PO-7ELEVEN-XXXX"
                className="w-full px-3 py-2 text-sm font-medium tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                วันที่ตรวจปล่อย
              </label>
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                เวลาตรวจ
              </label>
              <input
                type="time"
                value={inspectionTime}
                onChange={(e) => setInspectionTime(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Quick Destination DC Selector Row matching reference UI */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5 pb-1">
            <span className="text-xs font-semibold text-slate-700">
              เลือกศูนย์กระจายสินค้าปลายทาง (DC):
            </span>
            <div className="flex flex-wrap gap-2">
              {CP_ALL_DC_OPTIONS.map((dc) => {
                const isSelected = distributionCenter === dc;
                return (
                  <button
                    key={dc}
                    type="button"
                    onClick={() => setDistributionCenter(dc)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors border ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 font-medium'
                    }`}
                  >
                    {dc}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                รายการสินค้าสำเร็จรูป (Finished Product Specification)
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                วันที่ผลิต (MFG)
              </label>
              <input
                type="date"
                value={mfgDate}
                onChange={(e) => handleMfgDateChange(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  วันหมดอายุ (EXP +6 วัน)
                </label>
                {!isSixDayShelfLife && (
                  <button
                    type="button"
                    onClick={() => setExpDate(addDaysToIsoDate(mfgDate, 6))}
                    className="text-[11px] font-medium text-slate-700 underline"
                  >
                    ตั้งค่า +6 วัน
                  </button>
                )}
              </div>
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className={`w-full px-3 py-2 text-sm tabular-nums bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                  isSixDayShelfLife
                    ? 'border-slate-300 focus:ring-slate-900'
                    : 'border-red-400 text-red-700 focus:ring-red-600'
                }`}
              />
            </div>
          </div>

          {/* Mandatory Label Requirement Callout */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="text-slate-700">
              <span className="font-semibold text-slate-900">
                ข้อความบังคับบนฉลากสินค้า:
              </span>{' '}
              ต้องระบุข้อความ{' '}
              <strong className="text-slate-900 font-semibold">
                &ldquo;ล้างก่อนรับประทาน&rdquo; (Wash before consumption)
              </strong>{' '}
              บนฉลากบรรจุภัณฑ์อย่างชัดเจนทุกแพ็ค
            </div>
            <span
              className={`font-semibold shrink-0 ${
                check3WashLabel ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {check3WashLabel ? '✓ ยืนยันระบุชัดเจน' : '✗ ยังไม่ยืนยันข้อความบังคับ'}
            </span>
          </div>
        </div>

        {/* Checklist #2 (Featured Full-Width): 3-5 Varieties Color Mix = 100% with Mandatory Green + Red Rule */}
        <div className="p-6 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                เช็คลิสต์ข้อที่ 2: การผสมสีครบ 3–5 สายพันธุ์ (บังคับมีสีเขียวคู่กับสีแดง/ชมพู)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ต้องคละอย่างต่ำ 3 สีขึ้นไป (บังคับต้องมีสีเขียว กรูรามิ คู่กับสีแดง โซลาริโน่) ห้ามให้สีเหลือง แดง ส้ม อยู่ด้วยกันโดยไม่มีสีเขียวมาแซม
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => applyMixPreset(PRESET_5_COLORS, 'preset_5')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                  presetMode === 'preset_5'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                สูตรครบ 5 สี
              </button>
              <button
                type="button"
                onClick={() => applyMixPreset(PRESET_4_GREEN_MIX, 'preset_4')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                  presetMode === 'preset_4'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                สูตร 4 สีแซมเขียว
              </button>
              <button
                type="button"
                onClick={handleActivateCustomPreset}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                  presetMode === 'custom'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>สูตรเลือกสีเอง (ไม่น้อยกว่า 3 สี)</span>
              </button>
              <button
                type="button"
                onClick={() => applyMixPreset(PRESET_3_RYG, 'preset_3')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                  presetMode === 'preset_3'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                สูตร 3 สี แดง–เหลือง–เขียว
              </button>
            </div>
          </div>

          {/* Interactive Custom Mix Builder (Shown when "สูตรเลือกสีเอง (ไม่น้อยกว่า 3 สี)" is active) */}
          {presetMode === 'custom' && (
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="text-xs font-semibold text-slate-800">
                กำหนดสูตรเลือกสีเอง (คละ 3–5 สี · ล็อกสีแดงคู่สีเขียวอัตโนมัติ ป้องกันเหลือง-แดง-ส้มไร้สีเขียว)
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {VARIETY_ORDER.map((code) => {
                  const v = TOMATO_VARIETIES[code];
                  const entry = colorMix.find((c) => c.varietyCode === code);
                  const isSelected = (Number(entry?.percentage) || 0) > 0;
                  const isLockedMandatory = code === 'SL' || code === 'GR';

                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleToggleCustomVariety(code)}
                      className={`px-3 py-1.5 rounded-md border text-xs font-medium inline-flex items-center gap-2 transition-colors ${
                        isSelected
                          ? 'bg-white border-slate-900 text-slate-900 shadow-2xs'
                          : 'bg-white/60 border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: v.swatchHex }}
                      />
                      <span>
                        {v.nameTh} ({v.colorLabelTh})
                      </span>
                      {isLockedMandatory ? (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-700 font-semibold">
                          <Lock className="w-3 h-3" /> บังคับ
                        </span>
                      ) : isSelected ? (
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {customMixHint && (
                <div className="text-[11px] font-medium text-amber-800">
                  * {customMixHint}
                </div>
              )}
            </div>
          )}

          {mixValidation.isWarmTrioWithoutGreen && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-900 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
              <span>
                ผิดเงื่อนไขการคละสี: ห้ามให้สีเหลือง (เบลนนี่) + สีแดง (โซลาริโน่) + สีส้ม (ฟลาวิโอ้) อยู่ด้วยกันโดยไม่มีสีเขียว (กรูรามิ) มาแซม
              </span>
            </div>
          )}

          {/* Segmented Visual Bar */}
          <div className="h-3 w-full rounded-md overflow-hidden bg-slate-100 flex border border-slate-200">
            {activeMixEntries.map((entry) => {
              const v = TOMATO_VARIETIES[entry.varietyCode];
              return (
                <div
                  key={entry.varietyCode}
                  className="h-full flex-1 transition-all"
                  style={{ backgroundColor: v.swatchHex }}
                  title={`${v.nameTh} (${v.colorLabelTh})`}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            {colorMix.map((entry) => {
              const v = TOMATO_VARIETIES[entry.varietyCode];
              const availableLots = lots.filter(
                (l) => l.varietyCode === entry.varietyCode
              );
              const isUsed = (Number(entry.percentage) || 0) > 0;
              const isMandatoryVariety =
                entry.varietyCode === 'GR' || entry.varietyCode === 'SL';
              const selectedLots = getMixLotNumbers(entry);
              const allSelectedPass =
                selectedLots.length > 0 &&
                selectedLots.every(
                  (lNo) => labMap.get(lNo)?.overallLabStatus === 'PASS'
                );
              const failingLots = selectedLots.filter(
                (lNo) => labMap.get(lNo)?.overallLabStatus === 'FAIL'
              );
              const pendingLots = selectedLots.filter(
                (lNo) =>
                  !labMap.get(lNo) ||
                  labMap.get(lNo)?.overallLabStatus === 'PENDING'
              );

              return (
                <div
                  key={entry.varietyCode}
                  className={`p-3.5 rounded-lg border space-y-2.5 transition-colors ${
                    isMandatoryVariety && !isUsed
                      ? 'border-red-300 bg-red-50/30'
                      : isUsed
                      ? 'border-slate-300 bg-slate-50/50'
                      : 'border-slate-200 bg-white opacity-65'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-xs shrink-0"
                        style={{ backgroundColor: v.swatchHex }}
                      />
                      <span className="text-xs font-semibold text-slate-900">
                        {v.nameTh}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {v.colorLabelTh}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    {isMandatoryVariety ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <Lock className="w-3 h-3 text-emerald-700" />
                        คละในแพ็ก (บังคับ)
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleCustomVariety(entry.varietyCode)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border transition-colors ${
                          isUsed
                            ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                      >
                        {isUsed ? (
                          <>
                            <Check className="w-3 h-3" /> คละในแพ็กนี้
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" /> คลิกเพื่อเพิ่มคละ
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {isUsed ? (
                    <div className="space-y-2 pt-1 border-t border-slate-200">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-800">
                          ล็อตที่ใช้บรรจุ:
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ${
                            selectedLots.length > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {selectedLots.length > 0
                            ? `เลือก ${selectedLots.length} ล็อต`
                            : 'ยังไม่เลือก'}
                        </span>
                      </div>

                      {availableLots.length > 0 ? (
                        <>
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>ล็อตพร้อมใช้ ({availableLots.length})</span>
                            <div className="flex items-center gap-1.5 font-medium">
                              <button
                                type="button"
                                onClick={() =>
                                  handleSelectAllLotsForVariety(
                                    entry.varietyCode,
                                    availableLots.map((l) => l.lotNumber)
                                  )
                                }
                                className="text-slate-700 hover:text-slate-900 underline"
                              >
                                เลือกทั้งหมด
                              </button>
                              <span>·</span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleClearLotsForVariety(entry.varietyCode)
                                }
                                className="text-slate-700 hover:text-slate-900 underline"
                              >
                                ล้าง
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5 border border-slate-200 rounded-md p-1.5 bg-white">
                            {availableLots.map((lot) => {
                              const isChecked = selectedLots.includes(
                                lot.lotNumber
                              );
                              const lRec = labMap.get(lot.lotNumber);
                              const labStatus = lRec?.overallLabStatus;
                              const brixText =
                                lRec?.brixValue !== null &&
                                lRec?.brixValue !== undefined
                                  ? `${lRec.brixValue.toFixed(1)}°`
                                  : null;

                              return (
                                <label
                                  key={lot.id}
                                  className={`flex items-start gap-1.5 p-1.5 rounded text-xs cursor-pointer transition-colors border ${
                                    isChecked
                                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() =>
                                      handleToggleLotForVariety(
                                        entry.varietyCode,
                                        lot.lotNumber
                                      )
                                    }
                                    className="mt-0.5 rounded text-slate-900 focus:ring-0 shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-mono text-[10.5px] font-bold leading-tight truncate">
                                      {lot.lotNumber}
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                      {labStatus === 'PASS' ? (
                                        <span
                                          className={`text-[9px] font-semibold px-1 rounded ${
                                            isChecked
                                              ? 'bg-emerald-800 text-emerald-100'
                                              : 'bg-emerald-100 text-emerald-800'
                                          }`}
                                        >
                                          PASS {brixText ? `(${brixText})` : ''}
                                        </span>
                                      ) : labStatus === 'FAIL' ? (
                                        <span
                                          className={`text-[9px] font-bold px-1 rounded ${
                                            isChecked
                                              ? 'bg-red-800 text-red-100'
                                              : 'bg-red-100 text-red-800'
                                          }`}
                                        >
                                          FAIL
                                        </span>
                                      ) : (
                                        <span
                                          className={`text-[9px] px-1 rounded ${
                                            isChecked
                                              ? 'bg-amber-800 text-amber-100'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}
                                        >
                                          รอผลตรวจ
                                        </span>
                                      )}
                                      {lot.disposition ===
                                        'CONDITIONAL_ACCEPT' && (
                                        <span
                                          className={`text-[9px] px-1 rounded ${
                                            isChecked
                                              ? 'bg-slate-700 text-slate-200'
                                              : 'bg-slate-200 text-slate-700'
                                          }`}
                                        >
                                          คัด100%
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>

                          {selectedLots.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {selectedLots.map((lNo) => (
                                <span
                                  key={lNo}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-mono font-medium text-slate-800"
                                >
                                  <span>{lNo}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleLotForVariety(
                                        entry.varietyCode,
                                        lNo
                                      )
                                    }
                                    className="hover:text-red-600 transition-colors"
                                    title="ลบล็อตนี้ออกจากการคละ"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="text-[10px] pt-1 border-t border-slate-200">
                            {selectedLots.length === 0 ? (
                              <div className="text-red-600 font-medium">
                                * กรุณาเลือกอย่างน้อย 1 ล็อต
                              </div>
                            ) : allSelectedPass ? (
                              <div className="text-emerald-700 font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3 shrink-0" />
                                <span>ผ่าน Lab ครบ {selectedLots.length} ล็อต</span>
                              </div>
                            ) : failingLots.length > 0 ? (
                              <div className="text-red-700 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  Lab FAIL: {failingLots.join(', ')}
                                </span>
                              </div>
                            ) : (
                              <div className="text-amber-700 font-medium flex items-center gap-1">
                                <span>
                                  รอผลแล็บ: {pendingLots.length} ล็อต
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic py-2 text-center bg-white rounded border border-dashed border-slate-200">
                          ไม่พบล็อตวัตถุดิบสีนี้
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic py-2 text-center bg-slate-50/50 rounded border border-dashed border-slate-200">
                      ไม่ได้ใช้คละในแพ็กนี้
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs tabular-nums pt-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                จำนวนสีที่คละ:{' '}
                <strong
                  className={
                    mixValidation.activeCount >= 3 && mixValidation.activeCount <= 5
                      ? 'text-emerald-700'
                      : 'text-red-700'
                  }
                >
                  {mixValidation.activeCount} สี (ขั้นต่ำ 3 สี)
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                รวมล็อตที่ใช้:{' '}
                <strong
                  className={
                    totalSelectedLotsCount >= mixValidation.activeCount &&
                    totalSelectedLotsCount > 0
                      ? 'text-emerald-700'
                      : 'text-red-700'
                  }
                >
                  {totalSelectedLotsCount} ล็อต
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                สีบังคับ:{' '}
                <strong
                  className={
                    mixValidation.hasGreen && mixValidation.hasRedOrPink
                      ? 'text-emerald-700'
                      : 'text-red-700'
                  }
                >
                  เขียว {mixValidation.hasGreen ? '✓' : '✗'} / แดง {mixValidation.hasRedOrPink ? '✓' : '✗'}
                </strong>
              </span>
            </div>
            <span className="font-semibold">
              {check2MixValid ? (
                <span className="text-emerald-700 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ผ่านเกณฑ์ ({mixValidation.activeCount} สี · {totalSelectedLotsCount} ล็อต · มีสีเขียวแซมคู่แดง)
                </span>
              ) : (
                <span className="text-red-700 inline-flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> {mixValidation.reasons[0] || 'การผสมสีไม่ผ่านเกณฑ์'}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Checklists 1, 3, 4, 5, 6, 7, 8: 7-Eleven Quality Standards Table */}
        <div className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  7-Eleven Quality Standards
                </span>
                <h3 className="text-sm font-semibold text-slate-900">
                  ตารางตรวจสอบคุณภาพก่อนจัดส่ง (ข้อที่ 1, 3, 4, 5, 6, 7 และ 8)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ระบุข้อกำหนด 7-Eleven, บันทึกข้อมูลจริง, สถานะผลตรวจ (ปุ่ม PASS / FAIL สม่ำเสมอ) พร้อมบันทึกข้อบกพร่องและวิธีแก้ไข (CAPA)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <span className="text-xs font-medium tabular-nums text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                ผ่านเกณฑ์ 7-Eleven:{' '}
                <strong
                  className={
                    [
                      isItem1Pass,
                      isItem3Pass,
                      isItem4Pass,
                      isItem5Pass,
                      isItem6Pass,
                      isItem7Pass,
                      isItem8Pass,
                    ].every(Boolean)
                      ? 'text-emerald-700 font-bold'
                      : 'text-red-700 font-bold'
                  }
                >
                  {
                    [
                      isItem1Pass,
                      isItem3Pass,
                      isItem4Pass,
                      isItem5Pass,
                      isItem6Pass,
                      isItem7Pass,
                      isItem8Pass,
                    ].filter(Boolean).length
                  }
                  /7 ข้อ
                </strong>
              </span>
              <button
                type="button"
                onClick={handlePassAllTableItems}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>ผ่านเกณฑ์ 7-Eleven ทั้งหมด (Pass All)</span>
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 tracking-wider">
                    <th className="py-3 px-4 w-44">ลำดับ & หัวข้อการตรวจ</th>
                    <th className="py-3 px-4 w-60">ข้อกำหนด 7-Eleven</th>
                    <th className="py-3 px-4 min-w-[280px]">ข้อมูลบันทึกจริง / การตรวจวัด</th>
                    <th className="py-3 px-4 w-40 text-center">สถานะผลตรวจ</th>
                    <th className="py-3 px-4 min-w-[220px]">สรุปผล & บันทึกข้อบกพร่อง / CAPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {/* Row 1: การปิดผนึกฝากล่อง */}
                  <tr
                    className={`transition-colors ${
                      isItem1Pass ? 'hover:bg-slate-50/50' : 'bg-red-50/40'
                    }`}
                  >
                    <td className="py-4 px-4 align-top">
                      <div className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 font-bold text-xs shrink-0">
                          1
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900 leading-snug">
                            {CHECKLIST_STANDARDS[1].title}
                          </div>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {CHECKLIST_STANDARDS[1].categoryTag}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-slate-800 leading-relaxed text-[11px]">
                        <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
                          <span>ข้อกำหนด 7-Eleven</span>
                        </div>
                        {CHECKLIST_STANDARDS[1].criterion7Eleven}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-700 border border-slate-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            กล่อง PET ล็อค 4 มุม
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-700 border border-slate-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            ตรวจสัมผัสและแรงกด
                          </span>
                        </div>
                        <input
                          type="text"
                          value={check1Note}
                          onChange={(e) => setCheck1Note(e.target.value)}
                          placeholder="บันทึกผลการปิดผนึกฝากล่อง..."
                          className="w-full px-3 py-1.5 text-xs bg-slate-50/70 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                        />
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top text-center">
                      <div className="inline-flex flex-col gap-1 items-center">
                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/90 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleSetItemPass(1)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              isItem1Pass
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>PASS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFailModal(1)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              !isItem1Pass
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-red-700 hover:bg-red-50'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>FAIL</span>
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {isItem1Pass ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      {isItem1Pass ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-700 font-medium py-1 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>ผ่านเกณฑ์: ฝาปิดสนิทครบ 4 มุม ไม่เผยอ</span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-red-100/70 border border-red-300 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-red-800 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> ไม่ผ่านเกณฑ์ (FAIL)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenFailModal(1)}
                              className="text-[10px] font-semibold text-red-700 hover:text-red-900 underline flex items-center gap-0.5"
                            >
                              <Edit className="w-2.5 h-2.5" /> แก้ไข CAPA
                            </button>
                          </div>
                          <div className="text-[11px] text-red-900">
                            <strong>สาเหตุ:</strong> {checkDefects[1]?.reason || 'ยังไม่ได้ระบุสาเหตุ'}
                          </div>
                          <div className="text-[11px] text-blue-900 bg-white/70 p-1.5 rounded border border-blue-200">
                            <strong>วิธีแก้ไข:</strong>{' '}
                            {checkDefects[1]?.correctiveAction || 'ยังไม่ได้ระบุวิธีแก้ไข'}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Row 3: ฉลากระบุวันผลิต-วันหมดอายุ (+6 วัน) & ล้างก่อนรับประทาน */}
                  <tr
                    className={`transition-colors ${
                      isItem3Pass ? 'hover:bg-slate-50/50' : 'bg-red-50/40'
                    }`}
                  >
                    <td className="py-4 px-4 align-top">
                      <div className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 font-bold text-xs shrink-0">
                          3
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900 leading-snug">
                            {CHECKLIST_STANDARDS[3].title}
                          </div>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {CHECKLIST_STANDARDS[3].categoryTag}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-slate-800 leading-relaxed text-[11px]">
                        <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
                          <span>ข้อกำหนด 7-Eleven</span>
                        </div>
                        {CHECKLIST_STANDARDS[3].criterion7Eleven}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-mono font-medium">
                            MFG {formatThaiDate(mfgDate)} → EXP {formatThaiDate(expDate)} (
                            {shelfLifeDays ?? '-'} วัน)
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isSixDayShelfLife
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {isSixDayShelfLife ? '✓ ตรงเกณฑ์ 6 วัน' : '✗ ไม่ตรง 6 วัน'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={check3ExpiryLabel}
                              onChange={(e) => setCheck3ExpiryLabel(e.target.checked)}
                              className="rounded text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
                            />
                            <span className="text-[11px] text-slate-700 font-medium">
                              ระบุ MFG/EXP (+6 วัน)
                            </span>
                          </label>

                          <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={check3WashLabel}
                              onChange={(e) => setCheck3WashLabel(e.target.checked)}
                              className="rounded text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
                            />
                            <span className="text-[11px] text-slate-700 font-medium">
                              ระบุ "ล้างก่อนรับประทาน"
                            </span>
                          </label>
                        </div>

                        <input
                          type="text"
                          value={check3Note}
                          onChange={(e) => setCheck3Note(e.target.value)}
                          placeholder="บันทึกหมายเหตุการตรวจฉลากสินค้า..."
                          className="w-full px-3 py-1.5 text-xs bg-slate-50/70 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                        />
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top text-center">
                      <div className="inline-flex flex-col gap-1 items-center">
                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/90 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleSetItemPass(3)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              isItem3Pass
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>PASS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFailModal(3)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              !isItem3Pass
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-red-700 hover:bg-red-50'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>FAIL</span>
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {isItem3Pass ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      {isItem3Pass ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-700 font-medium py-1 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>ผ่านเกณฑ์: Shelf-life 6 วัน + ระบุล้างก่อนรับประทานครบถ้วน</span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-red-100/70 border border-red-300 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-red-800 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> ไม่ผ่านเกณฑ์ (FAIL)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenFailModal(3)}
                              className="text-[10px] font-semibold text-red-700 hover:text-red-900 underline flex items-center gap-0.5"
                            >
                              <Edit className="w-2.5 h-2.5" /> แก้ไข CAPA
                            </button>
                          </div>
                          <div className="text-[11px] text-red-900">
                            <strong>สาเหตุ:</strong> {checkDefects[3]?.reason || 'ยังไม่ได้ระบุสาเหตุ'}
                          </div>
                          <div className="text-[11px] text-blue-900 bg-white/70 p-1.5 rounded border border-blue-200">
                            <strong>วิธีแก้ไข:</strong>{' '}
                            {checkDefects[3]?.correctiveAction || 'ยังไม่ได้ระบุวิธีแก้ไข'}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Row 4: น้ำหนักสุทธิสินค้า */}
                  <tr
                    className={`transition-colors ${
                      isItem4Pass ? 'hover:bg-slate-50/50' : 'bg-red-50/40'
                    }`}
                  >
                    <td className="py-4 px-4 align-top">
                      <div className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 font-bold text-xs shrink-0">
                          4
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900 leading-snug">
                            {CHECKLIST_STANDARDS[4].title}
                          </div>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {CHECKLIST_STANDARDS[4].categoryTag}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-slate-800 leading-relaxed text-[11px]">
                        <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
                          <span>ข้อกำหนด 7-Eleven</span>
                        </div>
                        {CHECKLIST_STANDARDS[4].criterion7Eleven}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative w-36 shrink-0">
                            <Scale className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              value={netWeightG}
                              onChange={(e) => setNetWeightG(parseFloat(e.target.value) || 0)}
                              className={`w-full pl-8 pr-11 py-1.5 text-xs font-semibold tabular-nums bg-white border rounded-lg focus:outline-none focus:ring-1 ${
                                rawCheck4NetWeightPass
                                  ? 'border-slate-300 focus:ring-slate-900'
                                  : 'border-red-400 text-red-700 focus:ring-red-600'
                              }`}
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11px] text-slate-400">
                              กรัม
                            </span>
                          </div>

                          <div className="inline-flex items-center gap-1">
                            {[140, 142, 145].map((w) => (
                              <button
                                key={w}
                                type="button"
                                onClick={() => setNetWeightG(w)}
                                className={`px-2 py-1 rounded text-[11px] font-mono font-medium border transition-colors ${
                                  netWeightG === w
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {w}g
                              </button>
                            ))}
                          </div>

                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                              rawCheck4NetWeightPass
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {rawCheck4NetWeightPass
                              ? `+${(netWeightG - 140).toFixed(1)}g จากเกณฑ์`
                              : `ต่ำกว่าเกณฑ์ ${(140 - netWeightG).toFixed(1)}g`}
                          </span>
                        </div>

                        <input
                          type="text"
                          value={check4Note}
                          onChange={(e) => setCheck4Note(e.target.value)}
                          placeholder="บันทึกผลการชั่งน้ำหนักสุทธิ..."
                          className="w-full px-3 py-1.5 text-xs bg-slate-50/70 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                        />
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top text-center">
                      <div className="inline-flex flex-col gap-1 items-center">
                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/90 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleSetItemPass(4)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              isItem4Pass
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>PASS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFailModal(4)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              !isItem4Pass
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-red-700 hover:bg-red-50'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>FAIL</span>
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {isItem4Pass ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      {isItem4Pass ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-700 font-medium py-1 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>ผ่านเกณฑ์: {netWeightG} กรัม (≥ 140.0 กรัม/แพ็ค)</span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-red-100/70 border border-red-300 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-red-800 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> ไม่ผ่านเกณฑ์ (FAIL)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenFailModal(4)}
                              className="text-[10px] font-semibold text-red-700 hover:text-red-900 underline flex items-center gap-0.5"
                            >
                              <Edit className="w-2.5 h-2.5" /> แก้ไข CAPA
                            </button>
                          </div>
                          <div className="text-[11px] text-red-900">
                            <strong>สาเหตุ:</strong> {checkDefects[4]?.reason || 'ยังไม่ได้ระบุสาเหตุ'}
                          </div>
                          <div className="text-[11px] text-blue-900 bg-white/70 p-1.5 rounded border border-blue-200">
                            <strong>วิธีแก้ไข:</strong>{' '}
                            {checkDefects[4]?.correctiveAction || 'ยังไม่ได้ระบุวิธีแก้ไข'}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Row 5: ลักษณะทางกายภาพของสินค้า */}
                  <tr
                    className={`transition-colors ${
                      isItem5Pass ? 'hover:bg-slate-50/50' : 'bg-red-50/40'
                    }`}
                  >
                    <td className="py-4 px-4 align-top">
                      <div className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 font-bold text-xs shrink-0">
                          5
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900 leading-snug">
                            {CHECKLIST_STANDARDS[5].title}
                          </div>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {CHECKLIST_STANDARDS[5].categoryTag}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-slate-800 leading-relaxed text-[11px]">
                        <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
                          <span>ข้อกำหนด 7-Eleven</span>
                        </div>
                        {CHECKLIST_STANDARDS[5].criterion7Eleven}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-700 border border-slate-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            ผลสดตึงเงางาม
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-700 border border-slate-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            ขั้วเขียวสด
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-700 border border-slate-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            ไร้หยดน้ำในกล่อง
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-700 border border-slate-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            ไม่มีผลแตก/ช้ำ
                          </span>
                        </div>
                        <input
                          type="text"
                          value={check5Note}
                          onChange={(e) => setCheck5Note(e.target.value)}
                          placeholder="บันทึกผลการตรวจลักษณะทางกายภาพ..."
                          className="w-full px-3 py-1.5 text-xs bg-slate-50/70 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                        />
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top text-center">
                      <div className="inline-flex flex-col gap-1 items-center">
                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/90 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleSetItemPass(5)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              isItem5Pass
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>PASS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFailModal(5)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              !isItem5Pass
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-red-700 hover:bg-red-50'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>FAIL</span>
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {isItem5Pass ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      {isItem5Pass ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-700 font-medium py-1 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>ผ่านเกณฑ์: ผลสดตึงเงางาม ไร้หยดน้ำเกาะกล่อง</span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-red-100/70 border border-red-300 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-red-800 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> ไม่ผ่านเกณฑ์ (FAIL)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenFailModal(5)}
                              className="text-[10px] font-semibold text-red-700 hover:text-red-900 underline flex items-center gap-0.5"
                            >
                              <Edit className="w-2.5 h-2.5" /> แก้ไข CAPA
                            </button>
                          </div>
                          <div className="text-[11px] text-red-900">
                            <strong>สาเหตุ:</strong> {checkDefects[5]?.reason || 'ยังไม่ได้ระบุสาเหตุ'}
                          </div>
                          <div className="text-[11px] text-blue-900 bg-white/70 p-1.5 rounded border border-blue-200">
                            <strong>วิธีแก้ไข:</strong>{' '}
                            {checkDefects[5]?.correctiveAction || 'ยังไม่ได้ระบุวิธีแก้ไข'}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Row 6: จำนวนสินค้าตรงตามใบสั่งซื้อ */}
                  <tr
                    className={`transition-colors ${
                      isItem6Pass ? 'hover:bg-slate-50/50' : 'bg-red-50/40'
                    }`}
                  >
                    <td className="py-4 px-4 align-top">
                      <div className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 font-bold text-xs shrink-0">
                          6
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900 leading-snug">
                            {CHECKLIST_STANDARDS[6].title}
                          </div>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {CHECKLIST_STANDARDS[6].categoryTag}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-slate-800 leading-relaxed text-[11px]">
                        <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
                          <span>ข้อกำหนด 7-Eleven</span>
                        </div>
                        {CHECKLIST_STANDARDS[6].criterion7Eleven}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="block text-[10px] text-slate-500 mb-0.5">
                              ยอดสั่งซื้อ PO
                            </span>
                            <div className="relative">
                              <input
                                type="number"
                                min={1}
                                value={orderedPacks}
                                onChange={(e) => setOrderedPacks(parseInt(e.target.value, 10) || 0)}
                                className="w-full pl-2.5 pr-8 py-1.5 text-xs font-semibold tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                              />
                              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-slate-400">
                                แพ็ค
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-500 mb-0.5">
                              ยอดบรรจุจริง
                            </span>
                            <div className="relative">
                              <input
                                type="number"
                                min={0}
                                value={actualPacks}
                                onChange={(e) => setActualPacks(parseInt(e.target.value, 10) || 0)}
                                className={`w-full pl-2.5 pr-8 py-1.5 text-xs font-semibold tabular-nums bg-white border rounded-lg focus:outline-none focus:ring-1 ${
                                  rawCheck6QtyMatch
                                    ? 'border-slate-300 focus:ring-slate-900'
                                    : 'border-red-400 text-red-700 focus:ring-red-600'
                                }`}
                              />
                              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-slate-400">
                                แพ็ค
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-500 mb-0.5">
                              ตะกร้าขนส่ง
                            </span>
                            <div className="relative">
                              <input
                                type="number"
                                min={1}
                                value={crateQty}
                                onChange={(e) => setCrateQty(parseInt(e.target.value, 10) || 0)}
                                className="w-full pl-2.5 pr-7 py-1.5 text-xs font-semibold tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                              />
                              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-slate-400">
                                ใบ
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-[11px] flex items-center justify-between">
                          <span
                            className={`font-semibold ${
                              rawCheck6QtyMatch ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {rawCheck6QtyMatch
                              ? '✓ ยอดบรรจุตรงตามใบสั่งซื้อ ครบ 100%'
                              : `✗ ขาด ${orderedPacks - actualPacks} แพ็ค จากยอด PO`}
                          </span>
                          <span className="text-slate-500 text-[10px]">
                            เฉลี่ย ~{(actualPacks / (crateQty || 1)).toFixed(0)} แพ็ค/ตะกร้า
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top text-center">
                      <div className="inline-flex flex-col gap-1 items-center">
                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/90 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleSetItemPass(6)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              isItem6Pass
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>PASS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFailModal(6)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              !isItem6Pass
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-red-700 hover:bg-red-50'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>FAIL</span>
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {isItem6Pass ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      {isItem6Pass ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-700 font-medium py-1 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            ผ่านเกณฑ์: ครบ 100% ({actualPacks} แพ็ค ใน {crateQty} ตะกร้า)
                          </span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-red-100/70 border border-red-300 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-red-800 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> ไม่ผ่านเกณฑ์ (FAIL)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenFailModal(6)}
                              className="text-[10px] font-semibold text-red-700 hover:text-red-900 underline flex items-center gap-0.5"
                            >
                              <Edit className="w-2.5 h-2.5" /> แก้ไข CAPA
                            </button>
                          </div>
                          <div className="text-[11px] text-red-900">
                            <strong>สาเหตุ:</strong> {checkDefects[6]?.reason || 'ยังไม่ได้ระบุสาเหตุ'}
                          </div>
                          <div className="text-[11px] text-blue-900 bg-white/70 p-1.5 rounded border border-blue-200">
                            <strong>วิธีแก้ไข:</strong>{' '}
                            {checkDefects[6]?.correctiveAction || 'ยังไม่ได้ระบุวิธีแก้ไข'}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Row 7: อุณหภูมิห้องขณะตรวจตามเกณฑ์ 2-6 °C */}
                  <tr
                    className={`transition-colors ${
                      isItem7Pass ? 'hover:bg-slate-50/50' : 'bg-red-50/40'
                    }`}
                  >
                    <td className="py-4 px-4 align-top">
                      <div className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 font-bold text-xs shrink-0">
                          7
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900 leading-snug">
                            {CHECKLIST_STANDARDS[7].title}
                          </div>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {CHECKLIST_STANDARDS[7].categoryTag}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-slate-800 leading-relaxed text-[11px]">
                        <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
                          <span>ข้อกำหนด 7-Eleven</span>
                        </div>
                        {CHECKLIST_STANDARDS[7].criterion7Eleven}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative w-36 shrink-0">
                            <Thermometer className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="number"
                              step="0.1"
                              value={roomTempC}
                              onChange={(e) => setRoomTempC(parseFloat(e.target.value) || 0)}
                              className={`w-full pl-8 pr-9 py-1.5 text-xs font-semibold tabular-nums bg-white border rounded-lg focus:outline-none focus:ring-1 ${
                                rawCheck7RoomTempPass
                                  ? 'border-slate-300 focus:ring-slate-900'
                                  : 'border-red-400 text-red-700 focus:ring-red-600'
                              }`}
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11px] font-medium text-slate-500">
                              °C
                            </span>
                          </div>

                          <div className="inline-flex items-center gap-1">
                            {[3.5, 4.2, 5.0].map((presetTemp) => (
                              <button
                                key={presetTemp}
                                type="button"
                                onClick={() => setRoomTempC(presetTemp)}
                                className={`px-2 py-1 rounded text-[11px] font-mono font-medium border transition-colors ${
                                  Math.abs(roomTempC - presetTemp) < 0.05
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {presetTemp.toFixed(1)}°
                              </button>
                            ))}
                          </div>

                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                              rawCheck7RoomTempPass
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {rawCheck7RoomTempPass
                              ? 'อยู่ในช่วงควบคุม 2.0-6.0 °C'
                              : 'อยู่นอกเกณฑ์อุณหภูมิ!'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top text-center">
                      <div className="inline-flex flex-col gap-1 items-center">
                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/90 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleSetItemPass(7)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              isItem7Pass
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>PASS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFailModal(7)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              !isItem7Pass
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-red-700 hover:bg-red-50'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>FAIL</span>
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {isItem7Pass ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      {isItem7Pass ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-700 font-medium py-1 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>ผ่านเกณฑ์: {roomTempC.toFixed(1)} °C (ควบคุมช่วง 2.0–6.0 °C)</span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-red-100/70 border border-red-300 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-red-800 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> ไม่ผ่านเกณฑ์ (FAIL)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenFailModal(7)}
                              className="text-[10px] font-semibold text-red-700 hover:text-red-900 underline flex items-center gap-0.5"
                            >
                              <Edit className="w-2.5 h-2.5" /> แก้ไข CAPA
                            </button>
                          </div>
                          <div className="text-[11px] text-red-900">
                            <strong>สาเหตุ:</strong> {checkDefects[7]?.reason || 'ยังไม่ได้ระบุสาเหตุ'}
                          </div>
                          <div className="text-[11px] text-blue-900 bg-white/70 p-1.5 rounded border border-blue-200">
                            <strong>วิธีแก้ไข:</strong>{' '}
                            {checkDefects[7]?.correctiveAction || 'ยังไม่ได้ระบุวิธีแก้ไข'}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Row 8: ความสะอาดและความเรียบร้อยของตะกร้าขนส่ง */}
                  <tr
                    className={`transition-colors ${
                      isItem8Pass ? 'hover:bg-slate-50/50' : 'bg-red-50/40'
                    }`}
                  >
                    <td className="py-4 px-4 align-top">
                      <div className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 font-bold text-xs shrink-0">
                          8
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900 leading-snug">
                            {CHECKLIST_STANDARDS[8].title}
                          </div>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {CHECKLIST_STANDARDS[8].categoryTag}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-slate-800 leading-relaxed text-[11px]">
                        <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
                          <span>ข้อกำหนด 7-Eleven</span>
                        </div>
                        {CHECKLIST_STANDARDS[8].criterion7Eleven}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-700 border border-slate-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            ผ่านการล้างฆ่าเชื้อ
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-700 border border-slate-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            แห้งสนิท ไร้คราบฝุ่น
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-700 border border-slate-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            จัดเรียงซ้อนล็อคมั่นคง
                          </span>
                        </div>
                        <input
                          type="text"
                          value={check8Note}
                          onChange={(e) => setCheck8Note(e.target.value)}
                          placeholder="บันทึกความสะอาดและการจัดเรียงตะกร้าขนส่ง..."
                          className="w-full px-3 py-1.5 text-xs bg-slate-50/70 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                        />
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top text-center">
                      <div className="inline-flex flex-col gap-1 items-center">
                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/90 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleSetItemPass(8)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              isItem8Pass
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>PASS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFailModal(8)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              !isItem8Pass
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-red-700 hover:bg-red-50'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>FAIL</span>
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {isItem8Pass ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      {isItem8Pass ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-700 font-medium py-1 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>ผ่านเกณฑ์: ตะกร้าผ่านการฆ่าเชื้อ สะอาดพร้อมจัดส่ง</span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-red-100/70 border border-red-300 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-red-800 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> ไม่ผ่านเกณฑ์ (FAIL)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenFailModal(8)}
                              className="text-[10px] font-semibold text-red-700 hover:text-red-900 underline flex items-center gap-0.5"
                            >
                              <Edit className="w-2.5 h-2.5" /> แก้ไข CAPA
                            </button>
                          </div>
                          <div className="text-[11px] text-red-900">
                            <strong>สาเหตุ:</strong> {checkDefects[8]?.reason || 'ยังไม่ได้ระบุสาเหตุ'}
                          </div>
                          <div className="text-[11px] text-blue-900 bg-white/70 p-1.5 rounded border border-blue-200">
                            <strong>วิธีแก้ไข:</strong>{' '}
                            {checkDefects[8]?.correctiveAction || 'ยังไม่ได้ระบุวิธีแก้ไข'}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Inspector & Save Footer (Vehicle Release Sign-off removed) */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                ผู้ตรวจสอบคุณภาพก่อนจัดส่ง (OQC Inspector) *
              </label>
              <input
                type="text"
                value={oqcInspector}
                onChange={(e) => setOqcInspector(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="md:col-span-8">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                หมายเหตุเพิ่มเติม
              </label>
              <input
                type="text"
                value={oqcRemarks}
                onChange={(e) => setOqcRemarks(e.target.value)}
                placeholder="บันทึกข้อสังเกตการตรวจ OQC (ถ้ามี)"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                ยกเลิกการแก้ไข
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{editingId ? 'บันทึกการแก้ไข OQC' : 'บันทึกผลตรวจ OQC และออกเลข COA'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* OQC Shipment History Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">
            รายการตรวจควบคุมคุณภาพก่อนจัดส่ง ({outgoingRecords.length} รอบจัดส่ง)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">เลขที่ OQC / COA</th>
                <th className="py-3 px-4">ลูกค้า / PO</th>
                <th className="py-3 px-4">สายพันธุ์ผสม</th>
                <th className="py-3 px-4 text-right">น้ำหนักสุทธิ</th>
                <th className="py-3 px-4 text-right">อุณหภูมิห้อง</th>
                <th className="py-3 px-4">สรุปผล OQC (8 ข้อ)</th>
                <th className="py-3 px-4 text-right">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {outgoingRecords.map((rec) => {
                const usedCount = rec.colorMix.filter((c) => c.percentage > 0).length;
                const totalLotsInRec = rec.colorMix
                  .filter((c) => c.percentage > 0)
                  .reduce((acc, c) => acc + getMixLotNumbers(c).length, 0);
                return (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 tabular-nums whitespace-nowrap">
                      <div className="font-semibold tracking-tight text-slate-900">{rec.oqcNumber}</div>
                      <div className="text-[11px] text-slate-500">{rec.coaNumber}</div>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-slate-900 truncate">
                        {rec.customerName} · {rec.distributionCenter || '-'}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        PO: {rec.poNumber} · EXP: {formatThaiDate(rec.expDate)}
                      </div>
                    </td>
                    <td className="py-3 px-4 tabular-nums whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{usedCount} สายพันธุ์ (คละสี)</div>
                      <div className="text-[11px] text-slate-500">{totalLotsInRec} ล็อตที่ใช้บรรจุ</div>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                      <span
                        className={
                          rec.check4NetWeightPass
                            ? 'text-emerald-700 font-semibold'
                            : 'text-red-700 font-bold'
                        }
                      >
                        {rec.netWeightG} กรัม
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                      <span
                        className={
                          rec.check7RoomTempPass
                            ? 'text-emerald-700 font-semibold'
                            : 'text-red-700 font-bold'
                        }
                      >
                        {rec.roomTempC.toFixed(1)} °C
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold tabular-nums">
                      {rec.oqcStatus === 'PASS' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>PASS (8/8)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>FAIL</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenCOA(rec.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors inline-flex items-center gap-1.5"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>ดูใบรับรอง COA</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadRecord(rec)}
                          className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 underline"
                        >
                          แก้ไข
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Defect & Corrective Action Pop-up Modal */}
      {activeDefectModal !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-red-50/70 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-red-100 text-red-700 border border-red-200 shrink-0 mt-0.5">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-red-950">
                    บันทึกข้อบกพร่องที่ไม่ผ่านเกณฑ์ & วิธีแก้ไข (Corrective Action)
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-slate-800">
                      รายการที่ {activeDefectModal}: {CHECKLIST_STANDARDS[activeDefectModal]?.title}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-200 text-red-900">
                      {CHECKLIST_STANDARDS[activeDefectModal]?.categoryTag}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveDefectModal(null);
                  setDefectModalError(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                title="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto text-xs">
              {/* 7-Eleven Standard Box */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-slate-800 space-y-1">
                <div className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>ข้อกำหนดมาตรฐาน 7-Eleven</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed pl-5">
                  {CHECKLIST_STANDARDS[activeDefectModal]?.criterion7Eleven}
                </p>
              </div>

              {/* Error Notice */}
              {defectModalError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="font-medium text-xs">{defectModalError}</div>
                </div>
              )}

              {/* Field 1: สาเหตุที่ไม่ผ่านเกณฑ์ (บังคับ) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900 text-xs flex items-center gap-1">
                    <span>1. สาเหตุที่ไม่ผ่านเกณฑ์ (Failure Reason / Non-Conformance)</span>
                    <span className="text-red-600 font-bold">* บังคับ</span>
                  </label>
                  <span className="text-[10px] text-slate-400">เลือกตัวเลือกด่วนหรือพิมพ์ระบุ</span>
                </div>

                {/* Quick Presets for Reason */}
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-500 w-full mb-0.5">
                    คลิกตัวเลือกด่วนเพื่อใส่สาเหตุพบบ่อย:
                  </span>
                  {CHECKLIST_STANDARDS[activeDefectModal]?.commonReasons.map((reasonText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setDefectReasonInput(reasonText);
                        if (defectModalError) setDefectModalError(null);
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] border text-left transition-colors ${
                        defectReasonInput === reasonText
                          ? 'bg-amber-600 text-white border-amber-600 font-medium shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-amber-400 hover:bg-amber-50/70'
                      }`}
                    >
                      {reasonText}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={defectReasonInput}
                  onChange={(e) => {
                    setDefectReasonInput(e.target.value);
                    if (defectModalError) setDefectModalError(null);
                  }}
                  placeholder="พิมพ์ระบุสาเหตุที่ไม่ผ่านเกณฑ์โดยละเอียด..."
                  className={`w-full p-2.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    !defectReasonInput.trim() && defectModalError
                      ? 'border-red-400 focus:ring-red-500 bg-red-50/30'
                      : 'border-slate-300 focus:ring-slate-900'
                  }`}
                />
              </div>

              {/* Field 2: วิธีแก้ไข / การแก้ไข (บังคับ) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900 text-xs flex items-center gap-1">
                    <span>2. วิธีแก้ไข / การแก้ไข (Corrective Action / CAPA)</span>
                    <span className="text-red-600 font-bold">* บังคับ</span>
                  </label>
                  <span className="text-[10px] text-slate-400">เลือกตัวเลือกด่วนหรือพิมพ์ระบุ</span>
                </div>

                {/* Quick Presets for Corrective Action */}
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-500 w-full mb-0.5">
                    คลิกตัวเลือกด่วนเพื่อใส่มาตรการแก้ไข:
                  </span>
                  {CHECKLIST_STANDARDS[activeDefectModal]?.commonActions.map((actionText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setDefectActionInput(actionText);
                        if (defectModalError) setDefectModalError(null);
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] border text-left transition-colors ${
                        defectActionInput === actionText
                          ? 'bg-blue-600 text-white border-blue-600 font-medium shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:bg-blue-50/70'
                      }`}
                    >
                      {actionText}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={defectActionInput}
                  onChange={(e) => {
                    setDefectActionInput(e.target.value);
                    if (defectModalError) setDefectModalError(null);
                  }}
                  placeholder="พิมพ์ระบุขั้นตอนการแก้ไข ปรับปรุง หรือจัดการสินค้าที่ไม่ผ่านเกณฑ์..."
                  className={`w-full p-2.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    !defectActionInput.trim() && defectModalError
                      ? 'border-red-400 focus:ring-red-500 bg-red-50/30'
                      : 'border-slate-300 focus:ring-slate-900'
                  }`}
                />
              </div>

              <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                <strong>หมายเหตุความปลอดภัยอาหาร:</strong> เมื่อบันทึกผลเป็น FAIL
                ระบบจะกำหนดให้รายการตรวจนี้ไม่ผ่านเกณฑ์ และต้องดำเนินการตามวิธีแก้ไข (Corrective
                Action) ที่บันทึกไว้ก่อนจะสามารถปรับสถานะกลับเป็น PASS ได้
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setActiveDefectModal(null);
                  setDefectModalError(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmFailModal}
                className="px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>ยืนยันบันทึกผล FAIL & วิธีแก้ไข</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
