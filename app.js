/**
 * OJ1NTELLIGENCE — Minimalist Financial Intelligence Workspace
 * - Quick Transaction Entry Popup Modal (+ Keyboard shortcut 'N')
 * - Monthly & Yearly Scope Switcher + Top Expense % Ranking & Donut Chart
 * - LocalStorage Persistence (100% client-side in the user's browser)
 */

const CATEGORIES = [
  'อาหาร 🍔',
  'ส่วนตัว 🧑🏻‍🦱',
  'จ่ายเครดิต 💳',
  'บ้าน 🏡',
  'แม่ 🤱🏻',
  'เบิกแม่ 🤶🏻',
  'รถยนตร์ 🚗',
  'อื่นๆ',
  'Dime 💸',
  'ลูกหนี้ 👹',
  'ดูดวง 🔮',
  'รับงาน 🧑🏻‍💻',
  'Grab 🚕',
  'GI ⛳️'
];

const SPECIAL_CREDIT_PAY_CAT = 'จ่ายเครดิต 💳';

// Gemini Pastel Palette for Donut & Ranking Bars
const GEMINI_CHART_PALETTE = [
  '#8AB4F8', // Gemini Blue
  '#C58AF9', // Gemini Purple
  '#F28B82', // Gemini Coral Red
  '#FDD663', // Gemini Gold
  '#81C995', // Gemini Mint Green
  '#78D9EC', // Cyan
  '#FCAD70', // Peach
  '#FF8BCB', // Pink
  '#A8DAB5', // Sage
  '#D7AEFB'  // Lavender
];

const STORAGE_KEYS = {
  PIN_CODE: 'oj1_pin_code',
  TX_CACHE: 'oj1_transactions_local',
  LAST_SYNC: 'oj1_last_saved',
  THEME: 'oj1_theme',
  PRIVACY_MASK: 'oj1_privacy_mask'
};

// ล้างคีย์เก่าที่อาจเคยเก็บ URL หรือแคชจากฐานข้อมูลเดิมในเบราว์เซอร์ออกให้หมด
try {
  localStorage.removeItem('ojbank_webapp_url');
  localStorage.removeItem('ojbank_transactions_cache');
  localStorage.removeItem('ojbank_last_sync');
} catch (_) {
  // ignore storage errors
}

const state = {
  pinCode: localStorage.getItem(STORAGE_KEYS.PIN_CODE) || '',
  theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'dark',
  isPrivacyMasked: localStorage.getItem(STORAGE_KEYS.PRIVACY_MASK) === 'true',
  isUnlocked: false,
  pinBuffer: '',

  // Active View ('all' | 'credit' | 'ledger')
  activeView: 'all',

  // Period Scope ('month' | 'year' | 'all')
  periodScope: 'month',
  selectedMonth: '', // e.g. '2026-11'
  selectedYear: '',  // e.g. '2026'

  // Trend Card Grouping Switcher ('month' | 'year') & Sort Order ('desc' = ใหม่ไปเก่า | 'asc' = เก่าไปใหม่)
  trendGroupMode: 'month',
  trendSortOrder: 'desc', // เริ่มต้นที่ New -> Old (เดือนล่าสุดอยู่บนสุดเสมอ)

  // Ledger Sort Order ('id_desc' = เรียงตาม ID ล่าสุดเหมือนในชีต | 'date_desc' = วันที่ใหม่ไปเก่า | 'date_asc' = วันที่เก่าไปใหม่ | 'id_asc' = ID 1 -> ล่าสุด)
  ledgerSortOrder: 'id_desc',

  // Category Breakdown Mode ('expense' | 'cash' | 'credit' | 'income')
  categoryBreakdownMode: 'expense',

  // Quick Entry Form State
  editingTxId: null, // null = เพิ่มรายการใหม่ | number = แก้ไขรายการตามเลข ID
  selectedAct: 'โอนออก', // 'รับโอน' | 'โอนออก' | 'CREDIT'
  selectedCatago: CATEGORIES[0],
  creditIsPositive: false,

  // Data State
  transactions: [],
  lastId: 0,
  sheetFormulaJ1: null,
  sheetFormulaK1: null,
  isDemoMode: false,

  // Credit Bill Filter State (Default to 'pending' = เฉพาะเครดิตที่รอชำระหลังการจ่ายบัตรครั้งล่าสุด)
  creditFilterMode: 'pending', // 'pending' | 'note' | 'date' | 'all'
  selectedHistoryCycleMonth: '', // เมื่อคลิกดูประวัติการชำระของเดือนเก่า เช่น '2026-11', '2026-10'
  cbStartDate: '',
  cbEndDate: '',
  cbNoteQuery: '',

  // Ledger Filter State
  ledgerActFilter: 'ALL',
  ledgerCatFilter: 'ALL',
  recentSearchQuery: '',
  ledgerLimit: 100,

  // Pending Batch Items for Credit Bill Settlement
  pendingBatchPayItems: []
};

/* =========================================================
   UTILITY HELPERS
   ========================================================= */
function getTodayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonthYearFromDate(dateStr) {
  if (!dateStr) return getTodayIso().slice(0, 7);
  const iso = normalizeDateToIso(dateStr);
  if (iso && iso.length >= 7) return iso.slice(0, 7);
  return getTodayIso().slice(0, 7);
}

function getTxMonthYear(tx) {
  const my = String(tx['Month/Year'] || '').trim();
  if (/^\d{4}-\d{2}$/.test(my)) return my;
  const iso = normalizeDateToIso(tx.date);
  if (iso && iso.length >= 7) return iso.slice(0, 7);
  return my || 'ไม่ระบุ';
}

function getTxYear(tx) {
  const my = getTxMonthYear(tx);
  if (/^\d{4}/.test(my)) return my.slice(0, 4);
  return 'ไม่ระบุ';
}

function normalizeDateToIso(raw, fallbackMonthYear = '') {
  if (!raw) return '';
  const s = String(raw).trim();
  const ymMatch = String(fallbackMonthYear || '').trim().match(/^(\d{4})-(\d{2})$/);
  const fallbackYear = ymMatch ? Number(ymMatch[1]) : null;

  const fixYear = (yNum) => {
    let y = Number(yNum);
    if (y > 2400) y -= 543;
    // กรณีพิมพ์ปีผิดในชีต เช่น 0202, 0206, 206 -> ใช้ปีจากคอลัมน์ Month/Year แทน
    if (y < 1900 || y > 2100) {
      if (fallbackYear && fallbackYear >= 1900 && fallbackYear <= 2100) {
        return fallbackYear;
      }
      if (y === 206 || y === 26) return 2026;
      if (y === 205 || y === 25) return 2025;
      return 2026;
    }
    return y;
  };

  // YYYY-MM-DD หรือ YYY-MM-DD (เช่น 206-06-09)
  const isoLike = s.match(/^(\d{2,4})-(\d{1,2})-(\d{1,2})$/);
  if (isoLike) {
    const year = fixYear(isoLike[1]);
    const month = isoLike[2].padStart(2, '0');
    const day = isoLike[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY หรือ D/M/YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = fixYear(dmy[3]);
    return `${year}-${month}-${day}`;
  }

  // YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) {
    const year = fixYear(ymd[1]);
    return `${year}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  return s;
}

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

/**
 * แสดงวันที่ในรูปแบบ วัน/เดือน/ปี (DD/MM/YYYY) เช่น 18/11/2026
 */
function formatDateDMY(rawDate, fallbackMonthYear = '') {
  const iso = normalizeDateToIso(rawDate, fallbackMonthYear);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return rawDate || '—';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * แสดงเดือนและปีในรูปแบบ เดือน/ปี เช่น "11/2026 (พ.ย. 2026)"
 */
function formatMonthYearDisplay(ym, includeThai = true) {
  if (!ym) return '—';
  const m = String(ym).trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const year = m[1];
  const monthNum = parseInt(m[2], 10);
  const thName = THAI_MONTHS_SHORT[monthNum - 1] || '';
  if (includeThai && thName) {
    return `${m[2]}/${year} (${thName} ${year})`;
  }
  return `${m[2]}/${year}`;
}

/**
 * เรียงลำดับรายการตาม วันที่ (ปี-เดือน-วัน) และตามด้วย ID
 * direction: 'desc' (ใหม่ -> เก่า) หรือ 'asc' (เก่า -> ใหม่)
 */
function compareTransactionsByDate(a, b, direction = 'desc') {
  const isoA = normalizeDateToIso(a.date, a['Month/Year']) || '0000-00-00';
  const isoB = normalizeDateToIso(b.date, b['Month/Year']) || '0000-00-00';
  if (isoA !== isoB) {
    return direction === 'asc'
      ? isoA.localeCompare(isoB)
      : isoB.localeCompare(isoA);
  }
  const idA = Number(a.ID) || 0;
  const idB = Number(b.ID) || 0;
  return direction === 'asc' ? idA - idB : idB - idA;
}

/**
 * แปลงป้าย note รอบบิล เช่น "17Jan", "17Feb", "17Dec" ให้เป็นลำดับเดือนเพื่อเรียงตามปฏิทิน
 */
function getNoteSortWeight(noteStr, latestTxDateIso = '') {
  if (latestTxDateIso && /^\d{4}-\d{2}-\d{2}$/.test(latestTxDateIso)) {
    return latestTxDateIso;
  }
  return String(noteStr || '');
}

function parseSheetNumber(val) {
  if (val === '' || val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const cleaned = String(val).replace(/,/g, '').replace(/฿/g, '').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function formatMoney(num, showPlus = false) {
  if (num === null || num === undefined || num === '' || isNaN(Number(num))) {
    return '—';
  }
  if (state.isPrivacyMasked) {
    return '*****';
  }
  const n = Number(num);
  const absFormatted = Math.abs(n).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (n > 0) return (showPlus ? '+' : '') + absFormatted;
  if (n < 0) return '-' + absFormatted;
  return '0.00';
}

function stripEmojiFromCatago(catago) {
  if (!catago) return 'อื่นๆ';
  const parts = String(catago).trim().split(/\s+/);
  if (parts.length > 1) return parts[0];
  return String(catago).trim();
}

function isCreditPayCategory(catago) {
  return String(catago || '').includes('จ่ายเครดิต');
}

function isCashAct(act) {
  const s = String(act || '').trim();
  return s === 'เงินสด' || s.toUpperCase() === 'CASH';
}

/**
 * ตรวจสอบว่ารายการนี้เป็นธุรกรรม "เงินสด" หรือไม่
 * รองรับทั้ง:
 * 1. ACT = "เงินสด" (กรณีเพิ่มใน Data Validation ของชีตแล้ว)
 * 2. ACT = "โอนออก" / "รับโอน" ที่บันทึกผ่านปุ่มเงินสด (มีป้าย CASH: ในช่อง note และเว้นว่าง PRICE/CRE)
 */
function isCashTx(tx) {
  if (!tx) return false;
  if (isCashAct(tx.ACT)) return true;
  const rawNote = String(tx.note || '').trim();
  if (/^CASH\s*:/i.test(rawNote)) return true;
  // กรณีเคยบันทึกโดยไม่มีคำว่า CASH: นำหน้า แต่ PRICE และ CRE ว่างเปล่า และ note ขึ้นต้นด้วยตัวเลข +/-
  const hasNoPriceAndCre =
    (tx.PRICE === null || tx.PRICE === '' || tx.PRICE === undefined) &&
    (tx.CRE === null || tx.CRE === '' || tx.CRE === undefined);
  if (hasNoPriceAndCre && /^[+\-]\d+(?:,\d{3})*(?:\.\d+)?(?:\s*\||$)/.test(rawNote)) {
    return true;
  }
  return false;
}

/**
 * แยกจำนวนเงินของกระเป๋าเงินสด ออกจากช่อง note
 * รูปแบบการจัดเก็บในช่อง note:
 * - "CASH: -100" หรือ "CASH: +500"
 * - "CASH: -100 | หมายเหตุเพิ่มเติม"
 */
function getCashTxAmount(tx) {
  if (!tx || !isCashTx(tx)) return null;
  if (typeof tx.CASH === 'number' && !isNaN(tx.CASH)) return tx.CASH;

  const rawNote = String(tx.note || '').trim();
  if (rawNote) {
    const m = rawNote.match(/^(?:CASH\s*:\s*)?([+\-]?\d+(?:,\d{3})*(?:\.\d+)?)/i);
    if (m) {
      const val = Number(m[1].replace(/,/g, ''));
      if (!isNaN(val)) return val;
    }
  }

  const p = parseSheetNumber(tx.PRICE);
  if (p !== null) return p;
  return null;
}

/**
 * ดึงเฉพาะข้อความหมายเหตุจริงๆ ของรายการเงินสด (ตัดป้าย CASH: -100 ออกเพื่อแสดงผลสวยงาม)
 */
function getCleanNoteForDisplay(tx) {
  const rawNote = String(tx.note || '').trim();
  if (!isCashTx(tx)) return rawNote;
  const cleaned = rawNote
    .replace(/^(?:CASH\s*:\s*)?[+\-]?\d+(?:,\d{3})*(?:\.\d+)?\s*(?:\|\s*)?/i, '')
    .trim();
  return cleaned;
}

/**
 * สร้างข้อความสำหรับบันทึกในคอลัมน์ note (I) ของรายการเงินสด
 */
function encodeCashNote(signedCashAmount, userNote = '') {
  const num = Number(signedCashAmount) || 0;
  const signStr = num >= 0 ? `+${num}` : `${num}`;
  const cleanUser = String(userNote || '').trim();
  return cleanUser ? `CASH: ${signStr} | ${cleanUser}` : `CASH: ${signStr}`;
}

/**
 * ปรับข้อความหมวดหมู่ (CATAGO) ให้ตรงกับกฎ Data Validation ในคอลัมน์ E ของ Google Sheets 100%
 * (รวมอักขระ Zero-Width Joiner \u200D ใน Emoji 🧑🏻‍🦱 และ 🧑🏻‍💻)
 */
function normalizeCategoryForSheet(rawCat) {
  const s = String(rawCat || '').trim();
  if (!s) return 'อื่นๆ';
  const base = stripEmojiFromCatago(s);
  const exactMatch = CATEGORIES.find(c => c === s || stripEmojiFromCatago(c) === base);
  return exactMatch || s;
}

/**
 * แปลงข้อความในช่อง DETIAL ของรายการ "จ่ายเครดิต 💳" (เช่น "Cr: อาหาร", "credit: ค่าน้ำมันรถ", "ส่วนตัว", "credit: mom")
 * ให้ตรงกับหมวดหมู่หลัก (CATAGO) เพื่อนำไปหักล้างยอดเครดิตที่รอชำระของหมวดนั้นๆ
 */
function matchDetailToCategory(detailStr, availableCategories = CATEGORIES) {
  if (!detailStr) return null;
  const raw = String(detailStr).trim();
  const cleaned = raw
    .replace(/^(cr|credit)\s*[:\-]?\s*/i, '')
    .replace(/^ค่า/, '')
    .trim()
    .toLowerCase();

  if (!cleaned) return null;

  // 1. ตรงกับชื่อหมวดหมู่โดยตรง (ไม่คิด Emoji)
  for (const cat of availableCategories) {
    if (isCreditPayCategory(cat)) continue;
    const base = stripEmojiFromCatago(cat).toLowerCase();
    if (cleaned === base || cleaned.includes(base) || base.includes(cleaned)) {
      return cat;
    }
  }

  // 2. คำพ้องความหมายที่ใช้บ่อยในชีต (เช่น รถยนต์ / น้ำมัน / car / mom / bank)
  const aliasRules = [
    { keywords: ['รถยนตร์', 'รถยนต์', 'น้ำมัน', 'car', 'gas'], targetPrefix: 'รถยนตร์' },
    { keywords: ['อาหาร', 'กิน', 'food'], targetPrefix: 'อาหาร' },
    { keywords: ['ส่วนตัว', 'แบงค์', 'bank', 'ประกัน'], targetPrefix: 'ส่วนตัว' },
    { keywords: ['แม่', 'mom'], targetPrefix: 'แม่' },
    { keywords: ['บ้าน', 'ไฟ', 'เน็ต', 'ais', 'home'], targetPrefix: 'บ้าน' },
    { keywords: ['ดูดวง', 'horo'], targetPrefix: 'ดูดวง' },
    { keywords: ['ลูกหนี้'], targetPrefix: 'ลูกหนี้' },
    { keywords: ['grab'], targetPrefix: 'Grab' },
    { keywords: ['gi', 'กอล์ฟ'], targetPrefix: 'GI' },
    { keywords: ['dime'], targetPrefix: 'Dime' },
    { keywords: ['อื่นๆ', 'อื่น'], targetPrefix: 'อื่นๆ' }
  ];

  for (const rule of aliasRules) {
    if (rule.keywords.some(kw => cleaned.includes(kw))) {
      const matched = availableCategories.find(c => stripEmojiFromCatago(c).toLowerCase() === rule.targetPrefix.toLowerCase());
      if (matched) return matched;
    }
  }

  return null;
}

function showToast(message, type = 'default') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3400);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =========================================================
   BUSINESS LOGIC: TRANSACTION CALCULATION (A-I)
   ========================================================= */
function computePriceAndCre(act, catago, rawAmount, isPositiveToggle = false) {
  const amt = Math.abs(Number(rawAmount) || 0);
  if (amt === 0) {
    return { PRICE: '', CRE: '', CASH: '' };
  }

  if (act === 'รับโอน') {
    return { PRICE: amt, CRE: '', CASH: '' };
  }

  if (act === 'โอนออก') {
    if (isCreditPayCategory(catago)) {
      return { PRICE: -amt, CRE: amt, CASH: '' };
    }
    return { PRICE: -amt, CRE: '', CASH: '' };
  }

  if (act === 'CREDIT') {
    return {
      PRICE: '',
      CRE: isPositiveToggle ? amt : -amt,
      CASH: ''
    };
  }

  if (isCashAct(act)) {
    // กระเป๋าเงินสดแยกต่างหาก: เว้นว่าง PRICE และ CRE เพื่อไม่ให้กระทบสูตร J1, K1 ในชีต
    return {
      PRICE: '',
      CRE: '',
      CASH: isPositiveToggle ? amt : -amt
    };
  }

  return { PRICE: -amt, CRE: '', CASH: '' };
}

/* =========================================================
   INITIALIZATION
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initPrivacyMode();
  initPinLock();
  initViewSwitcher();
  initQuickAddPopup();
  initDashboardControls();
  initSettingsModal();
  loadCachedOrInitialData();
});

/* =========================================================
   PRIVACY MASK MODE (*****)
   ========================================================= */
function initPrivacyMode() {
  applyPrivacyUI();
  const btn = document.getElementById('btnPrivacyToggle');
  if (btn) {
    btn.addEventListener('click', () => {
      state.isPrivacyMasked = !state.isPrivacyMasked;
      localStorage.setItem(STORAGE_KEYS.PRIVACY_MASK, String(state.isPrivacyMasked));
      applyPrivacyUI();
      updateFormPreviewAndSignUI();
      renderDashboard();
    });
  }
}

function applyPrivacyUI() {
  const btn = document.getElementById('btnPrivacyToggle');
  const iconOpen = document.getElementById('iconEyeOpen');
  const iconClosed = document.getElementById('iconEyeClosed');
  if (!btn || !iconOpen || !iconClosed) return;

  btn.classList.toggle('privacy-active', state.isPrivacyMasked);
  if (state.isPrivacyMasked) {
    iconOpen.classList.add('hidden');
    iconClosed.classList.remove('hidden');
  } else {
    iconOpen.classList.remove('hidden');
    iconClosed.classList.add('hidden');
  }
}

/* =========================================================
   THEME SWITCHER
   ========================================================= */
function initTheme() {
  applyTheme(state.theme);
  document.getElementById('btnThemeToggle').addEventListener('click', () => {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEYS.THEME, theme);

  const iconDark = document.getElementById('iconThemeDark');
  const iconLight = document.getElementById('iconThemeLight');

  if (theme === 'dark') {
    iconDark.classList.remove('hidden');
    iconLight.classList.add('hidden');
  } else {
    iconDark.classList.add('hidden');
    iconLight.classList.remove('hidden');
  }
}

/* =========================================================
   PIN LOCK SYSTEM
   ========================================================= */
function initPinLock() {
  const modal = document.getElementById('pinLockModal');
  const keys = modal.querySelectorAll('.pin-key');

  if (state.pinCode) {
    lockApp();
  } else {
    state.isUnlocked = true;
  }

  keys.forEach(btn => {
    btn.addEventListener('click', () => {
      handlePinKeyPress(btn.dataset.key);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (modal.classList.contains('hidden')) return;
    if (/^[0-9]$/.test(e.key)) {
      handlePinKeyPress(e.key);
    } else if (e.key === 'Backspace') {
      handlePinKeyPress('back');
    } else if (e.key === 'Escape') {
      handlePinKeyPress('clear');
    }
  });
}

function lockApp() {
  if (!state.pinCode) {
    showToast('กรุณาตั้งรหัส PIN 4 หลักก่อนล็อกหน้าจอ', 'error');
    return;
  }
  state.isUnlocked = false;
  state.pinBuffer = '';
  updatePinDotsUI();
  document.getElementById('pinErrorMsg').classList.add('hidden');
  document.getElementById('pinLockModal').classList.remove('hidden');
}

function handlePinKeyPress(key) {
  const errEl = document.getElementById('pinErrorMsg');
  errEl.classList.add('hidden');

  if (key === 'clear') {
    state.pinBuffer = '';
  } else if (key === 'back') {
    state.pinBuffer = state.pinBuffer.slice(0, -1);
  } else if (state.pinBuffer.length < 4) {
    state.pinBuffer += key;
  }

  updatePinDotsUI();

  if (state.pinBuffer.length === 4) {
    if (state.pinBuffer === state.pinCode) {
      state.isUnlocked = true;
      state.pinBuffer = '';
      updatePinDotsUI();
      document.getElementById('pinLockModal').classList.add('hidden');
    } else {
      errEl.classList.remove('hidden');
      setTimeout(() => {
        state.pinBuffer = '';
        updatePinDotsUI();
      }, 350);
    }
  }
}

function updatePinDotsUI() {
  const dots = document.querySelectorAll('#pinDots span');
  dots.forEach((dot, idx) => {
    dot.classList.toggle('filled', idx < state.pinBuffer.length);
  });
}

/* =========================================================
   TOP VIEW SWITCHER
   ========================================================= */
function initViewSwitcher() {
  const navPills = document.querySelectorAll('.nav-pill');
  const secAnalytics = document.getElementById('secAnalytics');
  const secCreditBill = document.getElementById('secCreditBill');
  const secLedger = document.getElementById('secLedger');

  navPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const view = pill.dataset.view;
      state.activeView = view;
      navPills.forEach(p => p.classList.toggle('active', p === pill));

      if (view === 'all') {
        secAnalytics.classList.remove('hidden');
        secCreditBill.classList.remove('hidden');
        secLedger.classList.remove('hidden');
      } else if (view === 'credit') {
        secAnalytics.classList.add('hidden');
        secCreditBill.classList.remove('hidden');
        secLedger.classList.add('hidden');
      } else if (view === 'ledger') {
        secAnalytics.classList.add('hidden');
        secCreditBill.classList.add('hidden');
        secLedger.classList.remove('hidden');
      }
    });
  });
}

/* =========================================================
   POPUP MODAL: QUICK TRANSACTION ENTRY
   ========================================================= */
function initQuickAddPopup() {
  const modal = document.getElementById('quickAddModal');
  const btnOpen1 = document.getElementById('btnOpenQuickAdd');
  const btnOpenFab = document.getElementById('btnFabQuickAdd');
  const btnClose = document.getElementById('btnCloseQuickAdd');
  const btnCancel = document.getElementById('btnCancelQuickAdd');

  const inputDate = document.getElementById('inputDate');
  const inputAmount = document.getElementById('inputAmount');
  const btnCreditSignToggle = document.getElementById('btnCreditSignToggle');
  const form = document.getElementById('quickAddForm');

  const openQuickModal = () => {
    state.editingTxId = null;
    document.getElementById('quickModalHeading').textContent = 'บันทึกรายการใหม่ (Quick Entry)';
    document.getElementById('btnSubmitText').textContent = 'บันทึกรายการ';
    inputAmount.value = '';
    document.getElementById('inputDetail').value = '';
    document.getElementById('inputNote').value = '';
    inputDate.value = getTodayIso();
    updateFormPreviewAndSignUI();
    modal.classList.remove('hidden');
    setTimeout(() => {
      inputAmount.focus();
    }, 60);
  };

  const closeQuickModal = () => {
    state.editingTxId = null;
    modal.classList.add('hidden');
  };

  btnOpen1.addEventListener('click', openQuickModal);
  btnOpenFab.addEventListener('click', openQuickModal);
  btnClose.addEventListener('click', closeQuickModal);
  btnCancel.addEventListener('click', closeQuickModal);

  // Close when clicking backdrop outside card
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeQuickModal();
  });

  // Keyboard shortcut: 'n' or 'N' to open popup, 'Escape' to close
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeQuickModal();
      return;
    }

    if (!isTyping && (e.key === 'n' || e.key === 'N') && modal.classList.contains('hidden')) {
      e.preventDefault();
      openQuickModal();
    }
  });

  inputDate.value = getTodayIso();
  renderCatagoGrid();
  populateLedgerCategoryFilter();

  const actBtns = document.querySelectorAll('.act-btn');
  actBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedAct = btn.dataset.act;
      if (state.selectedAct !== 'CREDIT' && !isCashAct(state.selectedAct)) {
        state.creditIsPositive = false;
      }
      actBtns.forEach(b => b.classList.toggle('active', b === btn));
      updateFormPreviewAndSignUI();
    });
  });

  btnCreditSignToggle.addEventListener('click', () => {
    state.creditIsPositive = !state.creditIsPositive;
    updateFormPreviewAndSignUI();
  });

  inputAmount.addEventListener('input', updateFormPreviewAndSignUI);
  inputDate.addEventListener('change', updateFormPreviewAndSignUI);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleQuickAddSubmit(closeQuickModal);
  });

  updateFormPreviewAndSignUI();
}

function renderCatagoGrid() {
  const grid = document.getElementById('catagoGrid');
  if (!grid) return;
  grid.innerHTML = '';

  // นับจำนวนการใช้งานจริงของแต่ละหมวดหมู่ในชีต เพื่อเรียงหมวดที่ใช้เยอะสุดขึ้นก่อนเสมอ
  const freqMap = new Map();
  CATEGORIES.forEach((c, idx) => freqMap.set(c, -idx)); // fallback default priority

  if (state.transactions && state.transactions.length > 0) {
    const counts = new Map();
    state.transactions.forEach(tx => {
      const cat = String(tx.CATAGO || '').trim();
      if (cat) counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    CATEGORIES.forEach(c => {
      const base = stripEmojiFromCatago(c);
      let total = 0;
      counts.forEach((cnt, rawCat) => {
        if (rawCat === c || stripEmojiFromCatago(rawCat) === base) {
          total += cnt;
        }
      });
      freqMap.set(c, total);
    });
  }

  const sortedCategories = CATEGORIES.slice().sort((a, b) => (freqMap.get(b) || 0) - (freqMap.get(a) || 0));

  sortedCategories.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cat-chip ${cat === state.selectedCatago ? 'active' : ''}`;
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      state.selectedCatago = cat;
      document.getElementById('selectedCatagoBadge').textContent = cat;
      grid.querySelectorAll('.cat-chip').forEach(c => {
        c.classList.toggle('active', c.textContent === cat);
      });
      updateFormPreviewAndSignUI();
    });
    grid.appendChild(btn);
  });
}

function populateLedgerCategoryFilter() {
  const sel = document.getElementById('ledgerCatFilter');
  if (!sel) return;
  sel.innerHTML = '<option value="ALL">ทุกหมวดหมู่ (CATAGO)</option>';
  CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });
}

function updateFormPreviewAndSignUI() {
  const rawAmt = document.getElementById('inputAmount').value;
  const dateVal = document.getElementById('inputDate').value || getTodayIso();
  const monthYear = getMonthYearFromDate(dateVal);

  const actImpactHint = document.getElementById('actImpactHint');
  const btnCreditSignToggle = document.getElementById('btnCreditSignToggle');
  const creditSignLabel = document.getElementById('creditSignLabel');
  const amountPrefixSign = document.getElementById('amountPrefixSign');

  const isSpecialCreditPay =
    state.selectedAct === 'โอนออก' && isCreditPayCategory(state.selectedCatago);

  if (state.selectedAct === 'รับโอน') {
    btnCreditSignToggle.classList.add('hidden');
    actImpactHint.className = 'impact-badge impact-in';
    actImpactHint.textContent = 'PRICE เป็นบวก (+) | เว้นว่าง CRE';
    amountPrefixSign.textContent = '+';
    amountPrefixSign.className = 'amount-prefix sign-pos';
  } else if (state.selectedAct === 'โอนออก') {
    btnCreditSignToggle.classList.add('hidden');
    if (isSpecialCreditPay) {
      actImpactHint.className = 'impact-badge impact-special';
      actImpactHint.textContent = 'จ่ายบัตร: PRICE ลบ (-) และ CRE บวก (+)';
      amountPrefixSign.textContent = '-/+';
      amountPrefixSign.className = 'amount-prefix sign-dual';
    } else {
      actImpactHint.className = 'impact-badge impact-out';
      actImpactHint.textContent = 'PRICE ติดลบ (-) | เว้นว่าง CRE';
      amountPrefixSign.textContent = '-';
      amountPrefixSign.className = 'amount-prefix sign-neg';
    }
  } else if (state.selectedAct === 'CREDIT') {
    btnCreditSignToggle.classList.remove('hidden');
    if (state.creditIsPositive) {
      btnCreditSignToggle.classList.add('is-positive');
      creditSignLabel.textContent = 'ส่วนลด/เงินคืนบัตร: บันทึกค่าบวก (+) ใน CRE';
      actImpactHint.className = 'impact-badge impact-in';
      actImpactHint.textContent = 'เว้นว่าง PRICE | CRE เป็นบวก (+)';
      amountPrefixSign.textContent = '+';
      amountPrefixSign.className = 'amount-prefix sign-pos';
    } else {
      btnCreditSignToggle.classList.remove('is-positive');
      creditSignLabel.textContent = 'ใช้บัตรเครดิต: บันทึกค่าลบ (-) ใน CRE';
      actImpactHint.className = 'impact-badge impact-credit';
      actImpactHint.textContent = 'เว้นว่าง PRICE | CRE ติดลบ (-)';
      amountPrefixSign.textContent = '-';
      amountPrefixSign.className = 'amount-prefix sign-neg';
    }
  } else if (isCashAct(state.selectedAct)) {
    btnCreditSignToggle.classList.remove('hidden');
    if (state.creditIsPositive) {
      btnCreditSignToggle.classList.add('is-positive');
      creditSignLabel.textContent = 'รับเงินสดเข้ากระเป๋า (+): ไม่ปนกับบัญชีธนาคาร';
      actImpactHint.className = 'impact-badge impact-in';
      actImpactHint.textContent = 'กระเป๋าเงินสด (+) | เว้นว่าง PRICE & CRE';
      amountPrefixSign.textContent = '+';
      amountPrefixSign.className = 'amount-prefix sign-pos';
    } else {
      btnCreditSignToggle.classList.remove('is-positive');
      creditSignLabel.textContent = 'จ่ายด้วยเงินสด (-): ไม่ปนกับบัญชีธนาคาร';
      actImpactHint.className = 'impact-badge impact-cash';
      actImpactHint.textContent = 'กระเป๋าเงินสด (-) | เว้นว่าง PRICE & CRE';
      amountPrefixSign.textContent = '-';
      amountPrefixSign.className = 'amount-prefix sign-neg';
    }
  }

  const { PRICE, CRE, CASH } = computePriceAndCre(
    state.selectedAct,
    state.selectedCatago,
    rawAmt,
    state.creditIsPositive
  );

  const displayId = state.editingTxId ? state.editingTxId : (state.lastId || 0) + 1;
  document.getElementById('previewNextId').textContent = state.editingTxId ? `แก้ไข #${displayId}` : `ID #${displayId}`;
  document.getElementById('previewMonthYear').textContent = monthYear;
  if (isCashAct(state.selectedAct)) {
    document.getElementById('previewPrice').textContent = 'เว้นว่าง (แยกบัญชี)';
    document.getElementById('previewCre').textContent = CASH === '' ? 'เงินสด 0.00 ฿' : `เงินสด ${formatMoney(CASH, true)} ฿`;
  } else {
    document.getElementById('previewPrice').textContent = PRICE === '' ? 'เว้นว่าง' : `${formatMoney(PRICE, true)} ฿`;
    document.getElementById('previewCre').textContent = CRE === '' ? 'เว้นว่าง' : `${formatMoney(CRE, true)} ฿`;
  }

  // แสดง/ซ่อนตัวช่วยเลือกตัดยอดเครดิตที่รอชำระ เมื่อเลือก โอนออก + จ่ายเครดิต 💳
  renderCreditPayQuickHelper(isSpecialCreditPay);
}

/**
 * เปิดหน้าต่าง Popup เพื่อแก้ไขรายการเดิมตามเลข ID
 */
function openEditTransactionModal(txId) {
  const target = state.transactions.find(t => Number(t.ID) === Number(txId));
  if (!target) {
    showToast(`ไม่พบรายการ #${txId}`, 'error');
    return;
  }

  state.editingTxId = Number(target.ID);
  state.selectedAct = isCashTx(target) ? 'เงินสด' : (target.ACT || 'โอนออก');
  state.selectedCatago = normalizeCategoryForSheet(target.CATAGO || CATEGORIES[0]);

  const p = target.PRICE !== null && target.PRICE !== '' && !isNaN(Number(target.PRICE)) ? Number(target.PRICE) : null;
  const c = target.CRE !== null && target.CRE !== '' && !isNaN(Number(target.CRE)) ? Number(target.CRE) : null;

  let rawAmt = 0;
  if (String(state.selectedAct).toUpperCase() === 'CREDIT') {
    rawAmt = c !== null ? Math.abs(c) : 0;
    state.creditIsPositive = c !== null && c > 0;
  } else if (isCashAct(state.selectedAct)) {
    const cashVal = getCashTxAmount(target);
    rawAmt = cashVal !== null ? Math.abs(cashVal) : 0;
    state.creditIsPositive = cashVal !== null && cashVal > 0;
  } else {
    rawAmt = p !== null ? Math.abs(p) : (c !== null ? Math.abs(c) : 0);
    state.creditIsPositive = false;
  }

  document.getElementById('quickModalHeading').textContent = `แก้ไขรายการ #${state.editingTxId}`;
  document.getElementById('btnSubmitText').textContent = `บันทึกการแก้ไข #${state.editingTxId}`;

  document.querySelectorAll('.act-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.act === state.selectedAct);
  });

  document.getElementById('selectedCatagoBadge').textContent = state.selectedCatago;
  renderCatagoGrid();

  const inputAmount = document.getElementById('inputAmount');
  const inputDetail = document.getElementById('inputDetail');
  const inputDate = document.getElementById('inputDate');
  const inputNote = document.getElementById('inputNote');

  inputAmount.value = rawAmt > 0 ? rawAmt : '';
  inputDetail.value = target.DETIAL || '';
  inputDate.value = normalizeDateToIso(target.date, target['Month/Year']) || getTodayIso();
  inputNote.value = isCashAct(state.selectedAct) ? getCleanNoteForDisplay(target) : (target.note || '');

  updateFormPreviewAndSignUI();
  document.getElementById('quickAddModal').classList.remove('hidden');
  setTimeout(() => {
    inputAmount.focus();
  }, 60);
}

/**
 * เมื่อผู้ใช้กด ACT = "โอนออก" และเลือกหมวด "จ่ายเครดิต 💳" ในหน้าต่าง Quick Entry
 * แสดงรายการหมวดเครดิตที่รอชำระให้คลิก เพื่อเติมจำนวนเงินและ DETIAL (เช่น "Cr: อาหาร") อัตโนมัติ
 */
function renderCreditPayQuickHelper(shouldShow) {
  const helperBox = document.getElementById('creditPayHelperBox');
  const chipsContainer = document.getElementById('creditPayHelperChips');
  const totalEl = document.getElementById('cphTotalPending');
  if (!helperBox || !chipsContainer) return;

  if (!shouldShow) {
    helperBox.classList.add('hidden');
    return;
  }

  helperBox.classList.remove('hidden');
  chipsContainer.innerHTML = '';

  const pendingStatus = computePendingCreditStatus();
  const unpaidGroups = Array.from(pendingStatus.catGroups.values())
    .filter(g => g.netCre < 0)
    .sort((a, b) => a.netCre - b.netCre);

  let totalPending = 0;
  unpaidGroups.forEach(g => {
    totalPending += Math.abs(g.netCre);
  });
  totalPending = Math.round(totalPending * 100) / 100;

  totalEl.textContent = totalPending > 0 ? `รอชำระรวม ${formatMoney(totalPending)} ฿` : 'ไม่มียอดค้าง (0 ฿)';

  if (unpaidGroups.length === 0) {
    chipsContainer.innerHTML = `<span class="text-pos" style="font-size: 0.78rem; font-weight: 600;">✓ ปัจจุบันไม่มียอดเครดิตค้างชำระ (หรือคุณสามารถพิมพ์จำนวนเงินและ DETIAL เช่น "Cr: อาหาร" เองได้เลย)</span>`;
    return;
  }

  const inputAmount = document.getElementById('inputAmount');
  const inputDetail = document.getElementById('inputDetail');

  unpaidGroups.forEach(g => {
    const amt = Math.round(Math.abs(g.netCre) * 100) / 100;
    const shortName = stripEmojiFromCatago(g.catago);
    const targetDetail = `Cr: ${shortName}`;

    const btn = document.createElement('button');
    btn.type = 'button';
    const isCurrentlyPicked = inputDetail.value.trim().toLowerCase() === targetDetail.toLowerCase();
    btn.className = `cph-chip-btn ${isCurrentlyPicked ? 'is-selected' : ''}`;
    btn.innerHTML = `
      <span>${escapeHtml(g.catago)}</span>
      <strong class="mono">${formatMoney(amt)} ฿</strong>
    `;
    btn.addEventListener('click', () => {
      inputAmount.value = amt;
      inputDetail.value = targetDetail;
      updateFormPreviewAndSignUI();
    });
    chipsContainer.appendChild(btn);
  });

  // เพิ่มปุ่มย่อยสำหรับรายการรูดแต่ละชิ้น (เผื่อต้องการจ่ายตัดเฉพาะ 1 รายการ)
  if (pendingStatus.cycleCreditCharges.length > 0 && pendingStatus.cycleCreditCharges.length <= 12) {
    pendingStatus.cycleCreditCharges.forEach(tx => {
      const cAmt = Math.abs(Number(tx.CRE) || 0);
      if (cAmt <= 0) return;
      const shortCat = stripEmojiFromCatago(tx.CATAGO);
      const label = tx.DETIAL ? `Cr: ${shortCat} (${tx.DETIAL})` : `Cr: ${shortCat}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cph-chip-btn';
      btn.style.opacity = '0.88';
      btn.innerHTML = `
        <span>รายการ: ${escapeHtml(tx.DETIAL || shortCat)}</span>
        <strong class="mono">${formatMoney(cAmt)} ฿</strong>
      `;
      btn.addEventListener('click', () => {
        inputAmount.value = cAmt;
        inputDetail.value = `Cr: ${shortCat}`;
        updateFormPreviewAndSignUI();
      });
      chipsContainer.appendChild(btn);
    });
  }
}

async function handleQuickAddSubmit(onSuccessClose) {
  const inputAmount = document.getElementById('inputAmount');
  const inputDetail = document.getElementById('inputDetail');
  const inputDate = document.getElementById('inputDate');
  const inputNote = document.getElementById('inputNote');
  const btnSubmit = document.getElementById('btnSubmitTx');
  const btnSubmitText = document.getElementById('btnSubmitText');

  const rawAmount = Number(inputAmount.value);
  if (!rawAmount || rawAmount <= 0) {
    showToast('กรุณาระบุจำนวนเงินที่มากกว่า 0', 'error');
    inputAmount.focus();
    return;
  }

  const dateStr = inputDate.value || getTodayIso();
  const monthYearStr = getMonthYearFromDate(dateStr);
  const { PRICE, CRE, CASH } = computePriceAndCre(
    state.selectedAct,
    state.selectedCatago,
    rawAmount,
    state.creditIsPositive
  );

  // กรณี ACT = "เงินสด":
  // เนื่องจากคอลัมน์ D (ACT) ใน Google Sheets ตั้งกฎ Data Validation อนุญาตเฉพาะ "รับโอน", "โอนออก", "CREDIT"
  // เราจึงส่งค่า ACT ลงชีตเป็น "รับโอน" (เมื่อรับเงินสด +) หรือ "โอนออก" (เมื่อจ่ายเงินสด -) เพื่อให้ผ่านกฎของชีต 100%
  // โดยเว้นว่างคอลัมน์ PRICE และ CRE (ไม่ให้ปนกับยอดเงินธนาคาร/บัตร) และติดป้าย "CASH: -100" ในคอลัมน์ note แทน!
  const sheetAct = isCashAct(state.selectedAct)
    ? (state.creditIsPositive ? 'รับโอน' : 'โอนออก')
    : state.selectedAct;

  const finalNote = isCashAct(state.selectedAct)
    ? encodeCashNote(CASH, inputNote.value.trim())
    : inputNote.value.trim();

  const txPayload = {
    date: dateStr,
    'Month/Year': monthYearStr,
    ACT: sheetAct,
    CATAGO: normalizeCategoryForSheet(state.selectedCatago),
    DETIAL: inputDetail.value.trim(),
    PRICE: PRICE,
    CRE: CRE,
    note: finalNote
  };

  btnSubmit.disabled = true;
  btnSubmitText.textContent = 'กำลังบันทึก...';

  try {
    if (state.editingTxId) {
      const targetId = state.editingTxId;
      await updateTransactionInBackend(targetId, txPayload);
      state.editingTxId = null;
      showToast(`แก้ไขรายการ #${targetId} สำเร็จ`, 'success');
    } else {
      await saveTransactionsToBackend([txPayload]);
      showToast(`บันทึกสำเร็จ (#${state.lastId} ${state.selectedCatago})`, 'success');
    }

    inputAmount.value = '';
    inputDetail.value = '';
    inputNote.value = '';
    state.creditIsPositive = false;
    updateFormPreviewAndSignUI();

    if (typeof onSuccessClose === 'function') {
      onSuccessClose();
    }
  } catch (err) {
    showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmitText.textContent = state.editingTxId ? `บันทึกการแก้ไข #${state.editingTxId}` : 'บันทึกรายการ';
  }
}

/* =========================================================
   GOOGLE SHEETS PARSER & SYNC
   ========================================================= */
function parseApiResponseToTransactions(json) {
  if (Array.isArray(json.transactionsRows) && json.transactionsRows.length > 0) {
    const rawRows = json.transactionsRows;
    const headerRow = rawRows[0];

    if (Array.isArray(headerRow)) {
      if (headerRow[9] !== undefined && headerRow[9] !== '') {
        state.sheetFormulaJ1 = parseSheetNumber(headerRow[9]);
      }
      if (headerRow[10] !== undefined && headerRow[10] !== '') {
        state.sheetFormulaK1 = parseSheetNumber(headerRow[10]);
      }
    }

    const parsedList = [];
    for (let i = 1; i < rawRows.length; i++) {
      const r = rawRows[i];
      if (!Array.isArray(r)) continue;

      const isEmptyAtoI = r.slice(0, 9).every(cell => cell === '' || cell === null || cell === undefined);
      if (isEmptyAtoI) continue;

      const catVal = String(r[4] || '').trim();
      const detVal = String(r[5] || '').trim();
      const priceVal = parseSheetNumber(r[6]);
      const creVal = parseSheetNumber(r[7]);
      const noteVal = String(r[8] !== undefined && r[8] !== null ? r[8] : '').trim();

      // ข้ามแถวที่ว่างเปล่า (ไม่มีทั้งหมวดหมู่ รายละเอียด จำนวนเงิน และ note)
      if (!catVal && !detVal && priceVal === null && creVal === null && !noteVal) {
        continue;
      }

      const rawId = r[0];
      const numId = Number(String(rawId).replace(/,/g, '').trim());
      let monthYear = String(r[2] || '').trim();
      const dateIso = normalizeDateToIso(r[1], monthYear);
      if (!monthYear && dateIso.length >= 7) {
        monthYear = dateIso.slice(0, 7);
      }

      parsedList.push({
        ID: !isNaN(numId) && String(rawId).trim() !== '' ? numId : String(rawId || i),
        date: dateIso,
        'Month/Year': monthYear,
        ACT: String(r[3] || '').trim(),
        CATAGO: String(r[4] || '').trim(),
        DETIAL: String(r[5] || '').trim(),
        PRICE: parseSheetNumber(r[6]),
        CRE: parseSheetNumber(r[7]),
        note: String(r[8] !== undefined && r[8] !== null ? r[8] : '').trim()
      });
    }
    return parsedList;
  }

  if (Array.isArray(json.data)) {
    return json.data.map((item, idx) => {
      const my = String(item['Month/Year'] || '').trim();
      const dateIso = normalizeDateToIso(item.date, my);
      return {
        ID: item.ID !== undefined ? Number(item.ID) || item.ID : idx + 1,
        date: dateIso,
        'Month/Year': my || (dateIso ? dateIso.slice(0, 7) : ''),
        ACT: String(item.ACT || '').trim(),
        CATAGO: String(item.CATAGO || '').trim(),
        DETIAL: String(item.DETIAL || '').trim(),
        PRICE: parseSheetNumber(item.PRICE),
        CRE: parseSheetNumber(item.CRE),
        note: String(item.note || '').trim()
      };
    });
  }

  return [];
}

function loadCachedOrInitialData() {
  state.transactions = [];
  state.lastId = 0;

  const cached = localStorage.getItem(STORAGE_KEYS.TX_CACHE);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.transactions = parsed.map(tx => ({
          ...tx,
          date: normalizeDateToIso(tx.date, tx['Month/Year'])
        }));
        recalculateLastId();
      }
    } catch (_) {
      state.transactions = [];
      state.lastId = 0;
    }
  }

  ensureValidSelectedPeriods();
  updateConnectionBadge();
  updateFormPreviewAndSignUI();
  renderDashboard();
}

function recalculateLastId() {
  let max = 0;
  state.transactions.forEach(t => {
    const n = Number(t.ID);
    if (!isNaN(n) && n > max) max = n;
  });
  state.lastId = max;
}

function persistCache() {
  localStorage.setItem(STORAGE_KEYS.TX_CACHE, JSON.stringify(state.transactions));
  localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
}

function updateConnectionBadge() {
  const badge = document.getElementById('connectionBadge');
  const syncTimeEl = document.getElementById('lastSyncTimeText');
  const banner = document.getElementById('setupBanner');

  if (banner) {
    banner.classList.add('hidden');
  }

  if (badge) {
    badge.className = 'status-pill status-online';
    badge.textContent = `LocalStorage (${state.transactions.length.toLocaleString()})`;
  }

  if (syncTimeEl) {
    const lastSaved = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    if (lastSaved) {
      const savedDate = new Date(lastSaved);
      if (!isNaN(savedDate.getTime())) {
        syncTimeEl.textContent = `บันทึกล่าสุด ${savedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} (LocalStorage)`;
        return;
      }
    }
    syncTimeEl.textContent = 'พร้อมใช้งาน (LocalStorage)';
  }
}

async function fetchTransactionsFromSheet(showNotification = true) {
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) btnRefresh.classList.add('spinning');

  try {
    loadCachedOrInitialData();
    if (showNotification) {
      showToast(`รีเฟรชข้อมูลจาก LocalStorage สำเร็จ (${state.transactions.length.toLocaleString()} รายการ)`, 'success');
    }
  } finally {
    if (btnRefresh) {
      setTimeout(() => btnRefresh.classList.remove('spinning'), 250);
    }
  }
}

async function saveTransactionsToBackend(itemsArray) {
  if (!Array.isArray(itemsArray) || itemsArray.length === 0) return;

  // บันทึกลง LocalStorage ของเบราว์เซอร์ผู้ใช้งานโดยตรง
  const createdLocal = itemsArray.map(item => {
    state.lastId += 1;
    const newTx = {
      ID: state.lastId,
      date: normalizeDateToIso(item.date, item['Month/Year']) || getTodayIso(),
      'Month/Year': item['Month/Year'] || getMonthYearFromDate(item.date),
      ACT: item.ACT,
      CATAGO: item.CATAGO,
      DETIAL: item.DETIAL || '',
      PRICE: item.PRICE === '' || item.PRICE === null || item.PRICE === undefined ? null : Number(item.PRICE),
      CRE: item.CRE === '' || item.CRE === null || item.CRE === undefined ? null : Number(item.CRE),
      note: item.note || ''
    };
    state.transactions.push(newTx);
    return newTx;
  });

  ensureValidSelectedPeriods();
  persistCache();
  updateConnectionBadge();
  updateFormPreviewAndSignUI();
  renderDashboard();
  return createdLocal;
}

/**
 * แก้ไขรายการเดิมใน LocalStorage ตามเลข ID
 */
async function updateTransactionInBackend(txId, updatedFields) {
  const numId = Number(txId);

  const idx = state.transactions.findIndex(t => Number(t.ID) === numId);
  if (idx !== -1) {
    state.transactions[idx] = {
      ...state.transactions[idx],
      ID: numId,
      date: normalizeDateToIso(updatedFields.date, updatedFields['Month/Year']),
      'Month/Year': updatedFields['Month/Year'] || getMonthYearFromDate(updatedFields.date),
      ACT: updatedFields.ACT,
      CATAGO: updatedFields.CATAGO,
      DETIAL: updatedFields.DETIAL || '',
      PRICE: parseSheetNumber(updatedFields.PRICE),
      CRE: parseSheetNumber(updatedFields.CRE),
      note: updatedFields.note || ''
    };
  }

  ensureValidSelectedPeriods();
  persistCache();
  updateConnectionBadge();
  updateFormPreviewAndSignUI();
  renderDashboard();
}

/**
 * ลบรายการใน LocalStorage ตามเลข ID
 */
async function deleteTransactionFromBackend(txId) {
  const numId = Number(txId);
  const target = state.transactions.find(t => Number(t.ID) === numId);
  const label = target ? `#${numId} (${target.CATAGO || target.ACT} ${target.DETIAL || ''})` : `#${numId}`;

  if (!window.confirm(`ยืนยันการลบรายการ ${label} ออกจากเบราว์เซอร์ (LocalStorage) หรือไม่?`)) {
    return;
  }

  state.transactions = state.transactions.filter(t => Number(t.ID) !== numId);
  recalculateLastId();
  ensureValidSelectedPeriods();
  persistCache();
  updateConnectionBadge();
  updateFormPreviewAndSignUI();
  renderDashboard();
  showToast(`ลบรายการ #${numId} เรียบร้อยแล้ว`, 'success');
}

/* =========================================================
   PERIOD SCOPE MANAGEMENT (MONTH / YEAR / ALL TIME)
   ========================================================= */
function ensureValidSelectedPeriods() {
  const monthSet = new Set();
  const yearSet = new Set();

  state.transactions.forEach(tx => {
    const my = getTxMonthYear(tx);
    if (/^\d{4}-\d{2}$/.test(my)) {
      monthSet.add(my);
      yearSet.add(my.slice(0, 4));
    }
  });

  // หากยังไม่มีรายการใดๆ ให้แสดงเดือนและปีปัจจุบันใน Dropdown
  if (monthSet.size === 0) {
    const currentYm = getTodayIso().slice(0, 7);
    monthSet.add(currentYm);
    yearSet.add(currentYm.slice(0, 4));
  }

  // เรียงลำดับเดือนและปีตามปฏิทินจากเก่า -> ใหม่ (Chronological Order)
  const sortedMonthsAsc = Array.from(monthSet).sort((a, b) => a.localeCompare(b));
  const sortedYearsAsc = Array.from(yearSet).sort((a, b) => a.localeCompare(b));

  // ค่าเริ่มต้นให้เลือกเดือน/ปีล่าสุดที่มีข้อมูล
  const latestMonth = sortedMonthsAsc[sortedMonthsAsc.length - 1] || getTodayIso().slice(0, 7);
  const latestYear = sortedYearsAsc[sortedYearsAsc.length - 1] || String(new Date().getFullYear());

  if (!state.selectedMonth || !monthSet.has(state.selectedMonth)) {
    state.selectedMonth = latestMonth;
  }
  if (!state.selectedYear || !yearSet.has(state.selectedYear)) {
    state.selectedYear = latestYear;
  }

  // Populate Dropdowns (แสดงรูปแบบ เดือน/ปี เช่น "12/2025 (ธ.ค. 2025)" เรียงตามลำดับเดือนและปี)
  const monthSel = document.getElementById('monthFilterSelect');
  const yearSel = document.getElementById('yearFilterSelect');

  monthSel.innerHTML = '';
  sortedMonthsAsc.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = formatMonthYearDisplay(m, false);
    monthSel.appendChild(opt);
  });
  if (sortedMonthsAsc.includes(state.selectedMonth)) {
    monthSel.value = state.selectedMonth;
  }

  yearSel.innerHTML = '';
  sortedYearsAsc.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    yearSel.appendChild(opt);
  });
  if (sortedYearsAsc.includes(state.selectedYear)) {
    yearSel.value = state.selectedYear;
  }

  updateScopeButtonsUI();
}

function updateScopeButtonsUI() {
  const scopeBtns = document.querySelectorAll('.scope-btn');
  const monthSel = document.getElementById('monthFilterSelect');
  const yearSel = document.getElementById('yearFilterSelect');

  scopeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scope === state.periodScope);
  });

  if (state.periodScope === 'month') {
    monthSel.classList.remove('hidden');
    yearSel.classList.add('hidden');
  } else if (state.periodScope === 'year') {
    monthSel.classList.add('hidden');
    yearSel.classList.remove('hidden');
  } else {
    monthSel.classList.add('hidden');
    yearSel.classList.add('hidden');
  }
}

function getTransactionsForActivePeriod() {
  if (state.periodScope === 'month') {
    return state.transactions.filter(tx => getTxMonthYear(tx) === state.selectedMonth);
  }
  if (state.periodScope === 'year') {
    return state.transactions.filter(tx => getTxYear(tx) === state.selectedYear);
  }
  return state.transactions;
}

function getActivePeriodDisplayLabel() {
  if (state.periodScope === 'month') return formatMonthYearDisplay(state.selectedMonth, false);
  if (state.periodScope === 'year') return state.selectedYear;
  return 'All-Time';
}

/* =========================================================
   DASHBOARD ANALYTICS & CONTROLS
   ========================================================= */
function initDashboardControls() {
  document.getElementById('btnRefresh').addEventListener('click', () => {
    fetchTransactionsFromSheet(true);
  });

  // Scope Switcher (รายเดือน / รายปี / ทั้งหมด)
  document.querySelectorAll('.scope-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.periodScope = btn.dataset.scope;
      if (state.periodScope === 'year') {
        state.trendGroupMode = 'year';
      } else if (state.periodScope === 'month') {
        state.trendGroupMode = 'month';
      }
      syncTrendGroupButtonsUI();
      updateScopeButtonsUI();
      renderDashboard();
    });
  });

  document.getElementById('monthFilterSelect').addEventListener('change', (e) => {
    state.selectedMonth = e.target.value;
    state.periodScope = 'month';
    updateScopeButtonsUI();
    renderDashboard();
  });

  document.getElementById('yearFilterSelect').addEventListener('change', (e) => {
    state.selectedYear = e.target.value;
    state.periodScope = 'year';
    updateScopeButtonsUI();
    renderDashboard();
  });

  // Trend Card Grouping Switcher (มุมมองรายเดือน / มุมมองรายปี)
  document.querySelectorAll('.trend-group-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.trendGroupMode = btn.dataset.trendGroup;
      syncTrendGroupButtonsUI();
      renderTrendSection();
    });
  });

  // Toggle Trend Sort Order (Old -> New vs New -> Old)
  const btnToggleTrendSort = document.getElementById('btnToggleTrendSort');
  if (btnToggleTrendSort) {
    btnToggleTrendSort.addEventListener('click', () => {
      state.trendSortOrder = state.trendSortOrder === 'asc' ? 'desc' : 'asc';
      document.getElementById('trendSortLabel').textContent =
        state.trendSortOrder === 'asc' ? '⇅ Old → New' : '⇅ New → Old';
      renderTrendSection();
    });
  }

  // Toggle Ledger Sort Order (ID ล่าสุด -> วันที่ใหม่ไปเก่า -> วันที่เก่าไปใหม่ -> ID เก่าไปใหม่)
  const btnToggleLedgerSort = document.getElementById('btnToggleLedgerSort');
  if (btnToggleLedgerSort) {
    btnToggleLedgerSort.addEventListener('click', () => {
      const modes = ['id_desc', 'date_desc', 'date_asc', 'id_asc'];
      const labels = {
        id_desc: '⇅ ID: ล่าสุด → เก่า',
        date_desc: '⇅ Date: New → Old',
        date_asc: '⇅ Date: Old → New',
        id_asc: '⇅ ID: เก่า → ล่าสุด'
      };
      const nextIdx = (modes.indexOf(state.ledgerSortOrder) + 1) % modes.length;
      state.ledgerSortOrder = modes[nextIdx];
      document.getElementById('ledgerSortLabel').textContent = labels[state.ledgerSortOrder];
      renderRecentTransactions();
    });
  }

  // Category Breakdown Mode Buttons
  const catModeBtns = document.querySelectorAll('.cat-mode-btn');
  catModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.categoryBreakdownMode = btn.dataset.catMode;
      catModeBtns.forEach(b => b.classList.toggle('active', b === btn));
      renderCategoryBreakdown();
    });
  });

  // Credit Bill Filter Mode Tabs
  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      state.creditFilterMode = tab.dataset.filterMode;
      filterTabs.forEach(t => t.classList.toggle('active', t === tab));

      const pendingBox = document.getElementById('creditFilterPendingBox');
      if (pendingBox) {
        pendingBox.classList.toggle('hidden', state.creditFilterMode !== 'pending');
      }
      document.getElementById('creditFilterDateBox').classList.toggle(
        'hidden',
        state.creditFilterMode !== 'date'
      );
      document.getElementById('creditFilterNoteBox').classList.toggle(
        'hidden',
        state.creditFilterMode !== 'note'
      );

      renderCreditBillSection();
    });
  });

  const cbStartDate = document.getElementById('cbStartDate');
  const cbEndDate = document.getElementById('cbEndDate');
  const cbPayDate = document.getElementById('cbPayDate');
  cbPayDate.value = getTodayIso();

  cbStartDate.addEventListener('change', () => {
    state.cbStartDate = cbStartDate.value;
    renderCreditBillSection();
  });
  cbEndDate.addEventListener('change', () => {
    state.cbEndDate = cbEndDate.value;
    renderCreditBillSection();
  });

  document.querySelectorAll('.chips-scroll-row [data-range]').forEach(chip => {
    chip.addEventListener('click', () => {
      applyQuickDateRange(chip.dataset.range);
    });
  });

  const cbNoteQuery = document.getElementById('cbNoteQuery');
  cbNoteQuery.addEventListener('input', () => {
    state.cbNoteQuery = cbNoteQuery.value;
    renderCreditBillSection();
  });
  document.getElementById('btnClearNoteQuery').addEventListener('click', () => {
    cbNoteQuery.value = '';
    state.cbNoteQuery = '';
    renderCreditBillSection();
  });

  document.getElementById('btnBatchPayCredit').addEventListener('click', openBatchPayModal);
  document.getElementById('btnCloseBatchModal').addEventListener('click', closeBatchPayModal);
  document.getElementById('btnCancelBatchPay').addEventListener('click', closeBatchPayModal);
  document.getElementById('btnConfirmBatchPay').addEventListener('click', executeBatchPayCredit);

  document.getElementById('ledgerActFilter').addEventListener('change', (e) => {
    state.ledgerActFilter = e.target.value;
    state.ledgerLimit = 100;
    renderRecentTransactions();
  });

  document.getElementById('ledgerCatFilter').addEventListener('change', (e) => {
    state.ledgerCatFilter = e.target.value;
    state.ledgerLimit = 100;
    renderRecentTransactions();
  });

  document.getElementById('recentSearchInput').addEventListener('input', (e) => {
    state.recentSearchQuery = e.target.value;
    state.ledgerLimit = 100;
    renderRecentTransactions();
  });

  document.getElementById('btnLoadMoreLedger').addEventListener('click', () => {
    state.ledgerLimit += 100;
    renderRecentTransactions();
  });
}

function syncTrendGroupButtonsUI() {
  document.querySelectorAll('.trend-group-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.trendGroup === state.trendGroupMode);
  });
}

function applyQuickDateRange(rangeKey) {
  const now = new Date();
  let start = '';
  let end = '';

  const toIso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (rangeKey === 'cycle-current') {
    // รอบบิลที่รอชำระทุกวันที่ 17-18 (รายการตั้งแต่วันที่ 17 เดือนก่อน ถึง 16 เดือนนี้)
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 17);
    const e = new Date(now.getFullYear(), now.getMonth(), 16);
    start = toIso(s);
    end = toIso(e);
  } else if (rangeKey === 'cycle-unpaid') {
    // รายการรูดตั้งแต่วันที่ 17 เดือนนี้ ถึงปัจจุบัน (รอชำระวันที่ 17-18 เดือนหน้า)
    const s = new Date(now.getFullYear(), now.getMonth(), 17);
    start = toIso(s);
    end = toIso(now);
  } else if (rangeKey === 'this-month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    start = toIso(s);
    end = toIso(e);
  } else if (rangeKey === 'last-month') {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    start = toIso(s);
    end = toIso(e);
  } else if (rangeKey === 'last-30') {
    const s = new Date(now);
    s.setDate(s.getDate() - 30);
    start = toIso(s);
    end = toIso(now);
  } else if (rangeKey === 'clear') {
    start = '';
    end = '';
  }

  state.cbStartDate = start;
  state.cbEndDate = end;
  document.getElementById('cbStartDate').value = start;
  document.getElementById('cbEndDate').value = end;
  renderCreditBillSection();
}

function renderDashboard() {
  renderCatagoGrid();
  renderKpiSummary();
  renderCategoryBreakdown();
  renderTrendSection();
  renderCreditBillSection();
  renderRecentTransactions();
}

/* =========================================================
   1. KPI SUMMARY & GREETING BAR
   ========================================================= */
function renderKpiSummary() {
  let allTimePrice = 0;
  let allTimeCre = 0;
  let allTimeCashWallet = 0;
  let allTimeCashIn = 0;
  let allTimeCashOut = 0;

  state.transactions.forEach(tx => {
    const p = tx.PRICE;
    const c = tx.CRE;
    if (p !== null && p !== '' && !isNaN(Number(p))) allTimePrice += Number(p);
    if (c !== null && c !== '' && !isNaN(Number(c))) allTimeCre += Number(c);

    if (isCashTx(tx)) {
      const cashAmt = getCashTxAmount(tx);
      if (cashAmt !== null && !isNaN(cashAmt)) {
        allTimeCashWallet += cashAmt;
        if (cashAmt > 0) allTimeCashIn += cashAmt;
        else if (cashAmt < 0) allTimeCashOut += Math.abs(cashAmt);
      }
    }
  });

  const priceEl = document.getElementById('statTotalPrice');
  const creEl = document.getElementById('statTotalCre');
  const cashWalletEl = document.getElementById('statTotalCashWallet');
  const cashWalletSubEl = document.getElementById('statCashWalletSub');

  priceEl.textContent = `${formatMoney(allTimePrice, false)} ฿`;
  priceEl.className = `kpi-val mono ${allTimePrice >= 0 ? 'text-pos' : 'text-neg'}`;

  if (cashWalletEl) {
    cashWalletEl.textContent = `${formatMoney(allTimeCashWallet, false)} ฿`;
    cashWalletEl.className = `kpi-val mono ${allTimeCashWallet > 0 ? 'text-cash' : allTimeCashWallet < 0 ? 'text-neg' : ''}`;
  }
  if (cashWalletSubEl) {
    cashWalletSubEl.innerHTML = `In <span class="mono">+${formatMoney(allTimeCashIn)}</span> • Out <span class="mono">${formatMoney(allTimeCashOut)}</span>`;
  }

  creEl.textContent = `${formatMoney(allTimeCre, false)} ฿`;
  creEl.className = `kpi-val mono ${allTimeCre < 0 ? 'text-cre' : allTimeCre > 0 ? 'text-pos' : ''}`;

  // Period-specific KPIs (Month / Year / All)
  const periodTxs = getTransactionsForActivePeriod();
  const periodLabel = getActivePeriodDisplayLabel();

  document.getElementById('activePeriodLabel').textContent = periodLabel;
  document.getElementById('kpiPeriodBadge1').textContent = periodLabel;
  document.getElementById('kpiPeriodBadge2').textContent = periodLabel;
  document.getElementById('kpiPeriodBadge3').textContent = periodLabel;

  let income = 0;
  let incomeCount = 0;
  let cashOutAll = 0;      // ทุกแถวที่ PRICE < 0
  let cashOutDirect = 0;   // โอนออกปกติ (ไม่รวมจ่ายเครดิต)
  let cashWalletSpend = 0; // จ่ายด้วยเงินสด (ACT = เงินสด ที่ติดลบ)
  let creditSpend = 0;     // ยอดรูดบัตร CREDIT

  const spendByCat = new Map();

  periodTxs.forEach(tx => {
    const act = String(tx.ACT || '').trim();
    const cat = String(tx.CATAGO || 'อื่นๆ').trim() || 'อื่นๆ';
    const p = Number(tx.PRICE) || 0;
    const c = Number(tx.CRE) || 0;

    if (isCashTx(tx)) {
      const cashVal = getCashTxAmount(tx) || 0;
      if (cashVal > 0) {
        income += cashVal;
        incomeCount += 1;
      } else if (cashVal < 0) {
        cashWalletSpend += Math.abs(cashVal);
        cashOutAll += cashVal;
        spendByCat.set(cat, (spendByCat.get(cat) || 0) + Math.abs(cashVal));
      }
      return;
    }

    if (p > 0) {
      income += p;
      incomeCount += 1;
    } else if (p < 0) {
      cashOutAll += p;
      if (!isCreditPayCategory(cat)) {
        cashOutDirect += Math.abs(p);
        spendByCat.set(cat, (spendByCat.get(cat) || 0) + Math.abs(p));
      }
    }

    if (act.toUpperCase() === 'CREDIT' && c < 0) {
      creditSpend += Math.abs(c);
      spendByCat.set(cat, (spendByCat.get(cat) || 0) + Math.abs(c));
    }
  });

  const trueTotalSpend = cashOutDirect + cashWalletSpend + creditSpend;
  const netCashflow = income + cashOutAll;

  document.getElementById('monthIncomeVal').textContent = `${formatMoney(income, true)} ฿`;
  document.getElementById('monthIncomeCount').textContent = `${incomeCount.toLocaleString()} Transactions`;

  document.getElementById('periodTotalSpendVal').textContent = `${formatMoney(trueTotalSpend, false)} ฿`;
  document.getElementById('monthExpenseVal').textContent = formatMoney(Math.abs(cashOutDirect));
  const cashSpendEl = document.getElementById('monthCashSpendVal');
  if (cashSpendEl) cashSpendEl.textContent = formatMoney(cashWalletSpend);
  document.getElementById('monthCreditVal').textContent = formatMoney(creditSpend);

  const netEl = document.getElementById('monthNetVal');
  netEl.textContent = `${formatMoney(netCashflow, true)} ฿`;
  netEl.className = `kpi-val mono ${netCashflow >= 0 ? 'text-pos' : 'text-neg'}`;

  // Top Spending Category Highlight
  let topCatName = '—';
  let topCatAmt = 0;
  spendByCat.forEach((amt, cat) => {
    if (amt > topCatAmt) {
      topCatAmt = amt;
      topCatName = cat;
    }
  });

  const topPct = trueTotalSpend > 0 ? Math.round((topCatAmt / trueTotalSpend) * 100) : 0;
  document.getElementById('topSpendHighlight').textContent =
    topCatAmt > 0 ? `Top: ${topCatName} (${topPct}%)` : 'No Spend';

  // Headline
  const headline = document.getElementById('geminiHeadline');
  if (state.periodScope === 'year') {
    headline.textContent = `YEAR ${state.selectedYear} OVERVIEW`;
  } else if (state.periodScope === 'month') {
    headline.textContent = `MONTH ${formatMonthYearDisplay(state.selectedMonth, false)} OVERVIEW`;
  } else {
    headline.textContent = `ALL-TIME OVERVIEW`;
  }
}

/* =========================================================
   2. CATEGORY RANKING WITH % SHARE & DONUT CHART
   ========================================================= */
function renderCategoryBreakdown() {
  const container = document.getElementById('categoryBreakdownList');
  const podiumBox = document.getElementById('topThreeCategoriesBox');
  const donutEl = document.getElementById('categoryDonutChart');
  const donutTotalEl = document.getElementById('donutCenterTotal');
  const donutLabelEl = document.getElementById('donutCenterLabel');
  const tooltipEl = document.getElementById('catBreakdownTooltip');

  container.innerHTML = '';
  podiumBox.innerHTML = '';

  const txs = getTransactionsForActivePeriod();
  const periodLabel = getActivePeriodDisplayLabel();
  const mode = state.categoryBreakdownMode;

  if (mode === 'expense') {
    if (tooltipEl) tooltipEl.setAttribute('data-tip', `ค่าใช้จ่ายจริงแยกตามหมวดหมู่ (โอนออกปกติ + จ่ายเงินสด + รูดบัตร CREDIT ไม่นับจ่ายบัตรซ้ำ) • ${periodLabel}`);
    donutLabelEl.textContent = 'TOTAL SPEND';
  } else if (mode === 'cash') {
    if (tooltipEl) tooltipEl.setAttribute('data-tip', `ยอดโอนออกจากบัญชี (PRICE ติดลบ ไม่รวมจ่ายบิลบัตร) แยกตามหมวดหมู่ • ${periodLabel}`);
    donutLabelEl.textContent = 'BANK OUT';
  } else if (mode === 'cashwallet') {
    if (tooltipEl) tooltipEl.setAttribute('data-tip', `ยอดจ่ายด้วยเงินสด (ACT = เงินสด) แยกตามหมวดหมู่ • ${periodLabel}`);
    donutLabelEl.textContent = 'CASH 💵';
  } else if (mode === 'credit') {
    if (tooltipEl) tooltipEl.setAttribute('data-tip', `ยอดรูดบัตรเครดิต (ACT = CREDIT) แยกตามหมวดหมู่ • ${periodLabel}`);
    donutLabelEl.textContent = 'CREDIT CARD';
  } else {
    if (tooltipEl) tooltipEl.setAttribute('data-tip', `ยอดรายรับ (รับโอน + รับเงินสด) แยกตามหมวดหมู่ • ${periodLabel}`);
    donutLabelEl.textContent = 'INCOME';
  }

  const catMap = new Map();
  let grandTotal = 0;

  txs.forEach(tx => {
    const cat = String(tx.CATAGO || 'อื่นๆ').trim() || 'อื่นๆ';
    const act = String(tx.ACT || '').trim();
    const p = Number(tx.PRICE) || 0;
    const c = Number(tx.CRE) || 0;
    const isCash = isCashTx(tx);
    const cashVal = isCash ? (getCashTxAmount(tx) || 0) : 0;

    let amountToAdd = 0;

    if (mode === 'expense') {
      if (isCash && cashVal < 0) {
        amountToAdd = Math.abs(cashVal);
      } else if (!isCash && act === 'โอนออก' && !isCreditPayCategory(cat) && p < 0) {
        amountToAdd = Math.abs(p);
      } else if (act.toUpperCase() === 'CREDIT' && c < 0) {
        amountToAdd = Math.abs(c);
      }
    } else if (mode === 'cash') {
      if (!isCash && !isCreditPayCategory(cat) && p < 0) amountToAdd = Math.abs(p);
    } else if (mode === 'cashwallet') {
      if (isCash && cashVal < 0) amountToAdd = Math.abs(cashVal);
    } else if (mode === 'credit') {
      if (act.toUpperCase() === 'CREDIT' && c < 0) amountToAdd = Math.abs(c);
    } else if (mode === 'income') {
      if (p > 0) amountToAdd = p;
      else if (isCash && cashVal > 0) amountToAdd = cashVal;
    }

    if (amountToAdd > 0) {
      if (!catMap.has(cat)) {
        catMap.set(cat, { catago: cat, total: 0, count: 0, items: [] });
      }
      const item = catMap.get(cat);
      item.total += amountToAdd;
      item.count += 1;
      item.items.push({
        tx,
        amount: amountToAdd
      });
      grandTotal += amountToAdd;
    }
  });

  const sorted = Array.from(catMap.values()).sort((a, b) => b.total - a.total);
  donutTotalEl.textContent = `${formatMoney(grandTotal)} ฿`;

  if (sorted.length === 0 || grandTotal === 0) {
    donutEl.style.background = `conic-gradient(var(--bg-elevated) 0deg 360deg)`;
    podiumBox.innerHTML = '<div class="empty-cell">ไม่มีข้อมูลในช่วงเวลานี้</div>';
    container.innerHTML = '<div class="empty-cell">ไม่พบรายการในหมวดหมู่นี้</div>';
    return;
  }

  // Build Conic Gradient for Donut Chart
  let currentDeg = 0;
  const gradientStops = [];

  sorted.forEach((item, idx) => {
    const color = GEMINI_CHART_PALETTE[idx % GEMINI_CHART_PALETTE.length];
    item.color = color;
    item.pctExact = (item.total / grandTotal) * 100;
    item.pctDisplay = item.pctExact >= 10
      ? item.pctExact.toFixed(1)
      : item.pctExact.toFixed(1);

    const degSpan = (item.total / grandTotal) * 360;
    const nextDeg = currentDeg + degSpan;
    gradientStops.push(`${color} ${currentDeg.toFixed(1)}deg ${nextDeg.toFixed(1)}deg`);
    currentDeg = nextDeg;
  });

  donutEl.style.background = `conic-gradient(${gradientStops.join(', ')})`;

  // Render Top 3 Podium (คลิกเพื่อกางดูสรุปด้านล่างได้ทันที)
  sorted.slice(0, 3).forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'podium-row';
    row.style.cursor = 'pointer';
    row.title = 'คลิกเพื่อกางดูสรุปรายการของหมวดนี้';
    row.innerHTML = `
      <div class="podium-left">
        <span class="podium-rank" style="background: ${item.color}">${idx + 1}</span>
        <div>
          <div class="podium-name">${escapeHtml(item.catago)}</div>
          <div class="cat-tx-count">${item.count.toLocaleString()} รายการ</div>
        </div>
      </div>
      <div class="podium-right">
        <div class="podium-pct mono" style="color: ${item.color}">${item.pctDisplay}%</div>
        <div class="podium-amt mono">${formatMoney(item.total)} ฿</div>
      </div>
    `;
    row.addEventListener('click', () => {
      const targetAcc = container.querySelector(`[data-rank-cat="${CSS.escape(item.catago)}"]`);
      if (targetAcc) {
        targetAcc.classList.toggle('open');
        targetAcc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
    podiumBox.appendChild(row);
  });

  // Render Full Ranked List with % Progress Bar & Clean Summary Table Drawer
  sorted.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = 'cat-rank-item';
    el.setAttribute('data-rank-cat', item.catago);

    let cashTotal = 0;
    let cashCount = 0;
    let cashWalletTotal = 0;
    let cashWalletCount = 0;
    let creditTotal = 0;
    let creditCount = 0;

    (item.items || []).forEach(({ tx, amount }) => {
      const actStr = String(tx.ACT || '').trim();
      if (actStr.toUpperCase() === 'CREDIT') {
        creditTotal += amount;
        creditCount += 1;
      } else if (isCashTx(tx)) {
        cashWalletTotal += amount;
        cashWalletCount += 1;
      } else {
        cashTotal += amount;
        cashCount += 1;
      }
    });

    // เรียงรายการย่อยตามยอดเงินมาก -> น้อย เพื่อให้เห็นรายการใหญ่สุดของหมวดนี้ก่อนชัดเจน
    const sortedSubItems = (item.items || [])
      .slice()
      .sort((a, b) => b.amount - a.amount || compareTransactionsByDate(a.tx, b.tx, 'desc'));

    const subTableRowsHtml = sortedSubItems
      .map(({ tx, amount }, subIdx) => {
        const subPct = item.total > 0 ? Math.round((amount / item.total) * 100) : 0;
        const isCash = isCashTx(tx);
        const actStr = isCash ? 'เงินสด' : String(tx.ACT || '');
        let actPillClass = 'act-pill-out';
        if (actStr === 'รับโอน') actPillClass = 'act-pill-in';
        else if (actStr.toUpperCase() === 'CREDIT') actPillClass = 'act-pill-cre';
        else if (isCash) actPillClass = 'act-pill-cash';

        const amtColorClass = mode === 'income'
          ? 'text-pos'
          : actStr.toUpperCase() === 'CREDIT'
            ? 'text-cre'
            : isCash
              ? 'text-cash'
              : 'text-neg';

        return `
          <tr>
            <td class="mono text-muted" style="width: 36px;">${subIdx + 1}</td>
            <td class="mono" style="width: 96px;">${escapeHtml(formatDateDMY(tx.date, tx['Month/Year']))}</td>
            <td><strong>${escapeHtml(tx.DETIAL || '(ไม่ระบุรายละเอียด)')}</strong></td>
            <td style="width: 86px;"><span class="act-pill ${actPillClass}" style="font-size: 0.68rem;">${escapeHtml(actStr)}</span></td>
            <td class="text-right mono text-muted" style="width: 58px;">${subPct}%</td>
            <td class="text-right mono" style="width: 110px;"><strong class="${amtColorClass}">${formatMoney(amount)} ฿</strong></td>
          </tr>
        `;
      })
      .join('');

    const summaryBarHtml = mode === 'income'
      ? `
        <div class="cat-drawer-summary-bar">
          <span>สรุปหมวด <strong>${escapeHtml(item.catago)}</strong> (${item.count} รายการ)</span>
          <span class="mono text-pos"><strong>รวมรายรับ +${formatMoney(item.total)} ฿</strong></span>
        </div>
      `
      : `
        <div class="cat-drawer-summary-bar">
          <span>🏦 โอนออก: <strong class="mono text-neg">${formatMoney(cashTotal)} ฿</strong> (${cashCount})</span>
          <span>💵 เงินสด: <strong class="mono text-cash">${formatMoney(cashWalletTotal)} ฿</strong> (${cashWalletCount})</span>
          <span>💳 บัตร CREDIT: <strong class="mono text-cre">${formatMoney(creditTotal)} ฿</strong> (${creditCount})</span>
        </div>
      `;

    el.innerHTML = `
      <button type="button" class="cat-rank-trigger" title="คลิกเพื่อกางดูสรุปรายการในหมวดนี้">
        <div class="cat-rank-head">
          <div class="cat-rank-title">
            <span class="cat-color-dot" style="background: ${item.color}"></span>
            <span class="cat-name-text">${idx + 1}. ${escapeHtml(item.catago)}</span>
            <span class="cat-tx-count">(${item.count.toLocaleString()} รายการ)</span>
          </div>
          <div class="cat-rank-numbers">
            <span class="cat-pct-badge mono">${item.pctDisplay}%</span>
            <span class="cat-amt-text mono">${formatMoney(item.total)} ฿</span>
            <span class="cat-chevron-btn">▼</span>
          </div>
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width: ${Math.max(2, item.pctExact)}%; background: ${item.color}"></div>
        </div>
      </button>
      <div class="cat-sub-drawer">
        ${summaryBarHtml}
        <div class="cat-sub-table-wrap">
          <table class="cat-sub-table">
            <thead>
              <tr>
                <th>#</th>
                <th>วัน/เดือน/ปี</th>
                <th>รายการ (DETIAL)</th>
                <th>ช่องทาง</th>
                <th class="text-right">สัดส่วน</th>
                <th class="text-right">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              ${subTableRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    el.querySelector('.cat-rank-trigger').addEventListener('click', () => {
      el.classList.toggle('open');
    });

    container.appendChild(el);
  });
}

/* =========================================================
   3. MONTHLY & YEARLY CASHFLOW COMPARISON
   ========================================================= */
function renderTrendSection() {
  const isYearly = state.trendGroupMode === 'year';
  document.getElementById('trendTableColHeader').textContent = isYearly ? 'ปี (Year)' : 'เดือน/ปี (Month/Year)';

  const groupMap = new Map();

  state.transactions.forEach(tx => {
    const key = isYearly ? getTxYear(tx) : getTxMonthYear(tx);
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        income: 0,
        expense: 0,
        credit: 0,
        catSpend: new Map()
      });
    }
    const bucket = groupMap.get(key);
    const act = String(tx.ACT || '').trim();
    const cat = String(tx.CATAGO || 'อื่นๆ').trim() || 'อื่นๆ';
    const p = Number(tx.PRICE) || 0;
    const c = Number(tx.CRE) || 0;

    if (isCashTx(tx)) {
      const cashVal = getCashTxAmount(tx) || 0;
      if (cashVal > 0) {
        bucket.income += cashVal;
      } else if (cashVal < 0) {
        bucket.expense += cashVal;
        bucket.catSpend.set(cat, (bucket.catSpend.get(cat) || 0) + Math.abs(cashVal));
      }
      return;
    }

    if (p > 0) {
      bucket.income += p;
    } else if (p < 0) {
      // โอนออก: ไม่รวมรายการ "จ่ายเครดิต 💳" ในยอดรายจ่ายโอนออก เพื่อไม่ให้ซ้ำซ้อนกับคอลัมน์รูดบัตร (CRE)
      if (!isCreditPayCategory(cat)) {
        bucket.expense += p;
        bucket.catSpend.set(cat, (bucket.catSpend.get(cat) || 0) + Math.abs(p));
      } else {
        bucket.creditPaid = (bucket.creditPaid || 0) + Math.abs(p);
      }
    }

    if (act.toUpperCase() === 'CREDIT' && c < 0) {
      bucket.credit += c;
      bucket.catSpend.set(cat, (bucket.catSpend.get(cat) || 0) + Math.abs(c));
    }
  });

  // เรียงลำดับตามเวลา (เก่า -> ใหม่ หรือ ใหม่ -> เก่า ตามที่เลือก)
  const sortedKeys = Array.from(groupMap.keys()).sort((a, b) =>
    state.trendSortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
  );

  // Visual Chart Bars
  const chartBox = document.getElementById('monthlyVisualChart');
  chartBox.innerHTML = '';

  const chartKeys = sortedKeys.slice(0, isYearly ? 10 : 14);
  let maxVal = 1;
  chartKeys.forEach(k => {
    const v = groupMap.get(k);
    maxVal = Math.max(maxVal, v.income, Math.abs(v.expense), Math.abs(v.credit));
  });

  if (chartKeys.length === 0) {
    chartBox.innerHTML = '<div class="empty-cell">ยังไม่มีข้อมูล</div>';
  } else {
    chartKeys.forEach(k => {
      const v = groupMap.get(k);
      const incPct = Math.min(100, Math.round((v.income / maxVal) * 100));
      const expPct = Math.min(100, Math.round((Math.abs(v.expense) / maxVal) * 100));
      const crePct = Math.min(100, Math.round((Math.abs(v.credit) / maxVal) * 100));
      const net = v.income + v.expense;

      const isSelected = isYearly
        ? (state.periodScope === 'year' && state.selectedYear === k)
        : (state.periodScope === 'month' && state.selectedMonth === k);

      const displayKey = isYearly ? k : formatMonthYearDisplay(k, false);

      const row = document.createElement('div');
      row.className = `t-bar-row ${isSelected ? 'is-selected' : ''}`;
      row.title = 'คลิกเพื่อดูรายละเอียดช่วงเวลานี้';
      row.innerHTML = `
        <div class="t-bar-label mono">${escapeHtml(displayKey)}</div>
        <div class="t-bar-tracks">
          <div class="t-track">
            <div class="t-fill-inc" style="width: ${incPct}%"></div>
          </div>
          <div class="t-track">
            <div class="t-fill-exp" style="width: ${expPct}%"></div>
            <div class="t-fill-cre" style="width: ${crePct}%"></div>
          </div>
        </div>
        <div class="text-right mono ${net >= 0 ? 'text-pos' : 'text-neg'}"><strong>${formatMoney(net, true)} ฿</strong></div>
      `;
      row.addEventListener('click', () => {
        selectPeriodFromTrendRow(k, isYearly);
      });
      chartBox.appendChild(row);
    });
  }

  // Table
  const tbody = document.getElementById('monthlyTableBody');
  tbody.innerHTML = '';

  if (sortedKeys.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">ยังไม่มีข้อมูล</td></tr>';
    return;
  }

  sortedKeys.forEach(k => {
    const v = groupMap.get(k);
    const net = v.income + v.expense;

    let topCat = '—';
    let topAmt = 0;
    let totalCatSpend = 0;
    v.catSpend.forEach((amt, cat) => {
      totalCatSpend += amt;
      if (amt > topAmt) {
        topAmt = amt;
        topCat = cat;
      }
    });
    const topPct = totalCatSpend > 0 ? Math.round((topAmt / totalCatSpend) * 100) : 0;
    const topText = topAmt > 0 ? `${topCat} (${topPct}%)` : '—';

    const isSelected = isYearly
      ? (state.periodScope === 'year' && state.selectedYear === k)
      : (state.periodScope === 'month' && state.selectedMonth === k);

    const displayKey = isYearly ? k : formatMonthYearDisplay(k, true);

    const tr = document.createElement('tr');
    tr.className = isSelected ? 'active-row' : '';
    tr.style.cursor = 'pointer';
    tr.innerHTML = `
      <td class="mono"><strong>${escapeHtml(displayKey)}</strong></td>
      <td class="text-right mono text-pos">${formatMoney(v.income, true)}</td>
      <td class="text-right mono text-neg">${formatMoney(v.expense, false)}</td>
      <td class="text-right mono text-cre">${formatMoney(v.credit, false)}</td>
      <td class="text-right">${escapeHtml(topText)}</td>
      <td class="text-right mono ${net >= 0 ? 'text-pos' : 'text-neg'}"><strong>${formatMoney(net, true)}</strong></td>
    `;
    tr.addEventListener('click', () => {
      selectPeriodFromTrendRow(k, isYearly);
    });
    tbody.appendChild(tr);
  });
}

function selectPeriodFromTrendRow(key, isYearly) {
  if (isYearly) {
    state.periodScope = 'year';
    state.selectedYear = key;
    document.getElementById('yearFilterSelect').value = key;
  } else {
    state.periodScope = 'month';
    state.selectedMonth = key;
    document.getElementById('monthFilterSelect').value = key;
  }
  updateScopeButtonsUI();
  renderDashboard();
}

/**
 * สร้างรายการประวัติการชำระบัตรเครดิตของแต่ละเดือนที่ผ่านมา (Monthly Credit Settlement History)
 * เพื่อให้เห็นทุกเดือนที่ผ่านมาแบบในภาพ ว่าแต่ละเดือนชำระไปเมื่อไหร่ ถึง ID ไหน ยอดรวมเท่าไหร่ และคลิกเข้าไปดูรายการรูดบัตรของรอบนั้นได้
 */
function buildPastCreditSettlementCycles() {
  const sortedTxs = state.transactions
    .slice()
    .sort((a, b) => (Number(a.ID) || 0) - (Number(b.ID) || 0));

  // จัดกลุ่มรายการ "จ่ายเครดิต 💳" ตามเดือน (Month/Year)
  const monthPayMap = new Map();

  sortedTxs.forEach(tx => {
    if (!isCreditPayCategory(tx.CATAGO)) return;
    const ym = getTxMonthYear(tx);
    const idNum = Number(tx.ID) || 0;
    const dIso = normalizeDateToIso(tx.date);
    const payAmt = Number(tx.CRE) || Math.abs(Number(tx.PRICE) || 0);
    if (payAmt <= 0) return;

    if (!monthPayMap.has(ym)) {
      monthPayMap.set(ym, {
        monthYear: ym,
        minPaidId: idNum,
        maxPaidId: idNum,
        lastPaidDateIso: dIso,
        totalPaid: 0,
        paymentTxs: []
      });
    }
    const bucket = monthPayMap.get(ym);
    if (idNum < bucket.minPaidId) bucket.minPaidId = idNum;
    if (idNum >= bucket.maxPaidId) {
      bucket.maxPaidId = idNum;
      bucket.lastPaidDateIso = dIso;
    }
    bucket.totalPaid = Math.round((bucket.totalPaid + payAmt) * 100) / 100;
    bucket.paymentTxs.push(tx);
  });

  // เรียงลำดับเดือนจากเก่า -> ใหม่ เพื่อผูกช่วงรายการ CREDIT ของแต่ละรอบเดือน
  const sortedMonthsAsc = Array.from(monthPayMap.keys()).sort((a, b) => a.localeCompare(b));
  let prevCycleMaxId = 0;

  sortedMonthsAsc.forEach(ym => {
    const cycle = monthPayMap.get(ym);
    cycle.startAfterId = prevCycleMaxId;
    cycle.endAtId = cycle.maxPaidId;

    // ดึงเฉพาะรายการ ACT = "CREDIT" ที่อยู่ในช่วงรอบบิลของเดือนนี้ (ไม่รวมรายการ โอนออก: จ่ายเครดิต เพื่อไม่ให้ซ้ำซ้อน)
    cycle.creditCharges = sortedTxs.filter(tx => {
      const id = Number(tx.ID) || 0;
      const isCredit = String(tx.ACT || '').trim().toUpperCase() === 'CREDIT';
      return isCredit && id > cycle.startAfterId && id <= cycle.endAtId;
    });

    let totalCharged = 0;
    cycle.creditCharges.forEach(tx => {
      const c = Number(tx.CRE) || 0;
      if (c < 0) totalCharged += Math.abs(c);
      else if (c > 0) totalCharged -= c;
    });
    cycle.totalCharged = Math.round(Math.max(0, totalCharged) * 100) / 100;

    prevCycleMaxId = cycle.maxPaidId;
  });

  return Array.from(monthPayMap.values()).sort((a, b) =>
    b.monthYear.localeCompare(a.monthYear)
  );
}
/**
 * คำนวณสถานะเครดิตที่รอชำระจริงๆ:
 * 1. หาจุดที่ยอดสะสม CRE ในชีตกลายเป็น 0 ครั้งล่าสุด (Full Settlement Checkpoint เช่น วันที่ 18/11/2026 ID #1443)
 * 2. นับจากจุดนั้น หากมีรายการรูดบัตรใหม่ (ACT = "CREDIT") จะถูกนำมาสะสมแยกตามหมวดหมู่ (CATAGO)
 * 3. หากมีการบันทึก "โอนออก" -> "จ่ายเครดิต 💳" รายการใหม่ จะดูช่อง DETIAL (เช่น "Cr: อาหาร", "อาหาร", "รถยนต์")
 *    แล้วนำยอดที่จ่ายไปหักล้าง (Offset) ออกจากหมวดหมู่หรือรายการที่ตรงกันทันที!
 */
function computePendingCreditStatus() {
  const sortedTxs = state.transactions
    .slice()
    .sort((a, b) => (Number(a.ID) || 0) - (Number(b.ID) || 0));

  let runningCre = 0;
  let lastZeroCheckpointId = 0;
  let lastZeroCheckpointDateIso = '';
  let lastPaidId = 0;
  let lastPaidDateIso = '';
  let lastBatchAmount = 0;

  sortedTxs.forEach(tx => {
    const idNum = Number(tx.ID) || 0;
    const c = tx.CRE !== null && tx.CRE !== '' && !isNaN(Number(tx.CRE)) ? Number(tx.CRE) : 0;
    runningCre = Math.round((runningCre + c) * 100) / 100;

    if (isCreditPayCategory(tx.CATAGO)) {
      lastPaidId = idNum;
      lastPaidDateIso = normalizeDateToIso(tx.date);
    }

    // ถ้าหลังจากรายการนี้ ยอดหนี้สะสม CRE เท่ากับ 0 (หรือมากกว่าเท่ากับ -0.05) ถือว่าเคลียร์หนี้ก่อนหน้าหมดแล้ว
    if (runningCre >= -0.05 && idNum > 0 && (isCreditPayCategory(tx.CATAGO) || c > 0)) {
      lastZeroCheckpointId = idNum;
      lastZeroCheckpointDateIso = normalizeDateToIso(tx.date);
    }
  });

  // คำนวณยอดที่จ่ายในวันชำระล่าสุด
  if (lastPaidDateIso) {
    sortedTxs.forEach(tx => {
      if (isCreditPayCategory(tx.CATAGO) && normalizeDateToIso(tx.date) === lastPaidDateIso) {
        const c = Number(tx.CRE) || Math.abs(Number(tx.PRICE) || 0);
        if (c > 0) lastBatchAmount += c;
      }
    });
  }

  // ดึงรายการทั้งหมดหลังจุด Checkpoint ที่เคลียร์เป็น 0 ครั้งล่าสุด
  const activeCycleTxs = sortedTxs.filter(tx => (Number(tx.ID) || 0) > lastZeroCheckpointId);

  // แยกเป็นรายการรูดบัตร (CREDIT) และรายการทยอยจ่ายบัตร (จ่ายเครดิต 💳) ในรอบปัจจุบัน
  const cycleCreditCharges = activeCycleTxs.filter(
    tx => String(tx.ACT || '').trim().toUpperCase() === 'CREDIT'
  );
  const cyclePayments = activeCycleTxs.filter(
    tx => isCreditPayCategory(tx.CATAGO)
  );

  // จัดกลุ่มยอดรูดบัตรตามหมวดหมู่
  const knownCats = Array.from(new Set([...CATEGORIES, ...cycleCreditCharges.map(t => String(t.CATAGO || 'อื่นๆ').trim())]));
  const catGroups = new Map();

  cycleCreditCharges.forEach(tx => {
    const cat = String(tx.CATAGO || 'อื่นๆ').trim() || 'อื่นๆ';
    if (!catGroups.has(cat)) {
      catGroups.set(cat, {
        catago: cat,
        rawChargeSum: 0, // ค่าติดลบ เช่น -1500
        paidOffset: 0,   // ยอดที่จ่ายหักล้างไปแล้วในหมวดนี้ (ค่าบวก)
        netCre: 0,       // ยอดคงเหลือสุทธิ (ติดลบ = ยังค้างชำระ)
        items: [],
        paymentItems: []
      });
    }
    const g = catGroups.get(cat);
    const c = Number(tx.CRE) || 0;
    g.rawChargeSum = Math.round((g.rawChargeSum + c) * 100) / 100;
    g.items.push(tx);
  });

  // นำรายการ "โอนออก -> จ่ายเครดิต 💳" มาดู DETIAL เพื่อหักล้างยอดค้างของหมวดที่ตรงกัน
  let unmatchedPaymentPool = 0;

  cyclePayments.forEach(payTx => {
    const payAmt = Number(payTx.CRE) || Math.abs(Number(payTx.PRICE) || 0);
    if (payAmt <= 0) return;

    const det = String(payTx.DETIAL || '').trim();
    const matchedCat = matchDetailToCategory(det, knownCats);

    if (matchedCat && catGroups.has(matchedCat)) {
      const g = catGroups.get(matchedCat);
      g.paidOffset = Math.round((g.paidOffset + payAmt) * 100) / 100;
      g.paymentItems.push(payTx);
    } else {
      // ลองตรวจว่า DETIAL ตรงกับชื่อรายการย่อย (เช่น จ่ายเฉพาะรายการ "บุฟเฟ่ต์") หรือไม่
      let matchedBySubDetail = null;
      if (det) {
        const detLower = det.replace(/^(cr|credit)\s*[:\-]?\s*/i, '').trim().toLowerCase();
        for (const [catName, g] of catGroups.entries()) {
          if (g.items.some(sub => String(sub.DETIAL || '').toLowerCase().includes(detLower))) {
            matchedBySubDetail = catName;
            break;
          }
        }
      }

      if (matchedBySubDetail && catGroups.has(matchedBySubDetail)) {
        const g = catGroups.get(matchedBySubDetail);
        g.paidOffset = Math.round((g.paidOffset + payAmt) * 100) / 100;
        g.paymentItems.push(payTx);
      } else {
        unmatchedPaymentPool = Math.round((unmatchedPaymentPool + payAmt) * 100) / 100;
      }
    }
  });

  // คำนวณยอดคงเหลือแต่ละหมวดหมู่หลังหักล้าง
  catGroups.forEach(g => {
    g.netCre = Math.round((g.rawChargeSum + g.paidOffset) * 100) / 100;
  });

  // หากมีเงินจ่ายบัตรที่ไม่ระบุหมวดหมู่ (หรือหมวดนั้นจ่ายเกิน) นำไปหักล้างหมวดที่ยังค้างอยู่ตามลำดับ
  if (unmatchedPaymentPool > 0) {
    for (const g of catGroups.values()) {
      if (g.netCre < 0 && unmatchedPaymentPool > 0) {
        const debt = Math.abs(g.netCre);
        const deduct = Math.min(debt, unmatchedPaymentPool);
        g.paidOffset = Math.round((g.paidOffset + deduct) * 100) / 100;
        g.netCre = Math.round((g.rawChargeSum + g.paidOffset) * 100) / 100;
        unmatchedPaymentPool = Math.round((unmatchedPaymentPool - deduct) * 100) / 100;
      }
    }
  }

  return {
    lastZeroCheckpointId,
    lastZeroCheckpointDateIso,
    lastPaidId,
    lastPaidDateIso,
    lastBatchAmount,
    cycleCreditCharges,
    cyclePayments,
    catGroups
  };
}

function renderCreditBillSection() {
  const allCreditTxs = state.transactions.filter(
    tx => String(tx.ACT || '').trim().toUpperCase() === 'CREDIT'
  );

  const pastCycles = buildPastCreditSettlementCycles();
  const pendingStatus = computePendingCreditStatus();
  const {
    lastZeroCheckpointId,
    lastZeroCheckpointDateIso,
    lastPaidId,
    lastPaidDateIso,
    lastBatchAmount,
    cycleCreditCharges,
    catGroups: pendingCatGroups
  } = pendingStatus;

  // คำนวณยอดหนี้ที่ยังรอชำระจริงในรอบปัจจุบัน
  let pendingTotalPayable = 0;
  let pendingActiveCatCount = 0;
  pendingCatGroups.forEach(g => {
    if (g.netCre < 0) {
      pendingTotalPayable += Math.abs(g.netCre);
      pendingActiveCatCount += 1;
    }
  });
  pendingTotalPayable = Math.round(pendingTotalPayable * 100) / 100;

  // Badge บนเมนูด้านบน
  document.getElementById('navCreditBadge').textContent =
    pendingTotalPayable > 0 ? `${pendingActiveCatCount} หมวด` : '0';

  // อัปเดตแถบแจ้งสถานะการชำระล่าสุด (Current Status Banner)
  const bannerEl = document.getElementById('lastSettlementBanner');
  if (bannerEl) {
    if (lastZeroCheckpointId > 0 || lastPaidId > 0) {
      const refDate = lastZeroCheckpointDateIso || lastPaidDateIso;
      const refId = lastZeroCheckpointId || lastPaidId;
      const statusText = pendingTotalPayable === 0
        ? `<span class="text-pos"><strong>✓ ชำระครบทั้งหมดแล้ว ไม่มียอดค้าง (0 ฿)</strong> (จะเริ่มนับยอดใหม่เมื่อบันทึกรายการ CREDIT ถัดไป)</span>`
        : `<span class="text-cre"><strong>รอชำระสุทธิ ${formatMoney(pendingTotalPayable)} ฿</strong> (${pendingActiveCatCount} หมวดหมู่)</span>`;

      bannerEl.innerHTML = `
        <div>
          <span>สถานะปัจจุบัน: ชำระบัตรล่าสุดเมื่อ <strong class="mono">${escapeHtml(formatDateDMY(refDate))}</strong> (ถึง ID <strong class="mono">#${refId}</strong> • ยอดชำระรวม <strong class="mono">${formatMoney(lastBatchAmount)} ฿</strong>)</span>
        </div>
        <div>${statusText}</div>
      `;
    } else {
      bannerEl.innerHTML = `<span>แสดงรายการ CREDIT ที่รอชำระทั้งหมด</span>`;
    }
  }

  // แสดงรายการประวัติการชำระบัตรเครดิตของทุกเดือนที่ผ่านมา แบบในภาพ ให้คลิกเข้าไปดูได้
  const historyListEl = document.getElementById('pastSettlementHistoryList');
  const btnResetPending = document.getElementById('btnResetToCurrentPending');

  if (btnResetPending) {
    btnResetPending.classList.toggle('hidden', !state.selectedHistoryCycleMonth);
    btnResetPending.onclick = () => {
      state.selectedHistoryCycleMonth = '';
      renderCreditBillSection();
    };
  }

  if (historyListEl) {
    historyListEl.innerHTML = '';
    if (pastCycles.length === 0) {
      historyListEl.innerHTML = '<div class="empty-cell">ยังไม่มีประวัติการชำระบัตรเครดิต</div>';
    } else {
      pastCycles.forEach(cycle => {
        const isSelected = state.selectedHistoryCycleMonth === cycle.monthYear;
        const rowBtn = document.createElement('button');
        rowBtn.type = 'button';
        rowBtn.className = `sh-row-banner ${isSelected ? 'active' : ''}`;
        rowBtn.innerHTML = `
          <div>
            <span><strong>เดือน ${escapeHtml(formatMonthYearDisplay(cycle.monthYear, true))}</strong> — ชำระเมื่อ <strong class="mono">${escapeHtml(formatDateDMY(cycle.lastPaidDateIso))}</strong> (ถึง ID <strong class="mono">#${cycle.maxPaidId}</strong> • ยอดชำระรวม <strong class="mono text-cre">${formatMoney(cycle.totalPaid)} ฿</strong>)</span>
          </div>
          <div>
            <span class="text-pos"><strong>✓ ชำระแล้ว (${cycle.creditCharges.length} รายการรูด)</strong> • <span style="text-decoration: underline;">${isSelected ? 'กำลังแสดงรายละเอียด ▼' : 'คลิกเพื่อดูรายละเอียด →'}</span></span>
          </div>
        `;
        rowBtn.addEventListener('click', () => {
          if (state.selectedHistoryCycleMonth === cycle.monthYear) {
            state.selectedHistoryCycleMonth = '';
          } else {
            state.selectedHistoryCycleMonth = cycle.monthYear;
          }
          renderCreditBillSection();
        });
        historyListEl.appendChild(rowBtn);
      });
    }
  }

  renderAvailableNoteChips(allCreditTxs);

  const accContainer = document.getElementById('creditCategoryAccordion');
  accContainer.innerHTML = '';

  // กรณีคลิกเลือกดูประวัติของเดือนที่ผ่านมาในโหมด Pending
  if (state.creditFilterMode === 'pending' && state.selectedHistoryCycleMonth) {
    const selectedCycle = pastCycles.find(c => c.monthYear === state.selectedHistoryCycleMonth);
    if (selectedCycle) {
      const cycleTxs = selectedCycle.creditCharges; // เฉพาะรายการ ACT = CREDIT เท่านั้น ไม่เอา โอนออก: จ่ายเครดิต มาซ้ำซ้อน
      document.getElementById('creditBillCountBadge').textContent = `${cycleTxs.length.toLocaleString()} รายการรูด`;
      document.getElementById('cbFilterSummaryText').textContent =
        `ประวัติบิลบัตรเดือน ${formatMonthYearDisplay(selectedCycle.monthYear, true)} (ชำระแล้วเมื่อ ${formatDateDMY(selectedCycle.lastPaidDateIso)})`;

      const totalEl = document.getElementById('cbTotalAmount');
      totalEl.textContent = `${formatMoney(selectedCycle.totalPaid, false)} ฿`;
      totalEl.className = 'ct-number mono text-cre';

      const catGroups = new Map();
      let sumCre = 0;
      cycleTxs.forEach(tx => {
        const creVal = Number(tx.CRE) || 0;
        sumCre += creVal;
        const cat = String(tx.CATAGO || 'อื่นๆ').trim() || 'อื่นๆ';
        if (!catGroups.has(cat)) {
          catGroups.set(cat, { catago: cat, sumCre: 0, items: [] });
        }
        const g = catGroups.get(cat);
        g.sumCre += creVal;
        g.items.push(tx);
      });

      const totalChargedAbs = sumCre < 0 ? Math.abs(sumCre) : selectedCycle.totalPaid;
      const sortedHistGroups = Array.from(catGroups.values()).sort((a, b) => a.sumCre - b.sumCre);

      if (sortedHistGroups.length === 0) {
        accContainer.innerHTML = '<div class="empty-cell">ไม่พบรายการรูดบัตรในรอบเดือนนี้</div>';
      } else {
        sortedHistGroups.forEach(group => {
          const catPayable = group.sumCre < 0 ? Math.abs(group.sumCre) : 0;
          const pct = totalChargedAbs > 0 ? Math.round((catPayable / totalChargedAbs) * 100) : 0;
          const itemEl = document.createElement('div');
          itemEl.className = 'acc-item open'; // กางให้ดูทันทีเมื่อคลิกเลือกเดือน

          const subRowsHtml = group.items
            .slice()
            .sort((a, b) => compareTransactionsByDate(a, b, 'asc'))
            .map(sub => {
              const c = Number(sub.CRE) || 0;
              const noteBadge = sub.note ? ` • note: ${escapeHtml(sub.note)}` : '';
              return `
                <div class="acc-sub-row">
                  <div class="acc-sub-info">
                    <span class="acc-sub-title">${escapeHtml(sub.DETIAL || '(ไม่มีรายละเอียด)')}</span>
                    <span class="acc-sub-meta mono">#${escapeHtml(sub.ID)} • ${escapeHtml(formatDateDMY(sub.date))}${noteBadge}</span>
                  </div>
                  <span class="mono ${c < 0 ? 'text-neg' : 'text-pos'}">${formatMoney(c, true)} ฿</span>
                </div>
              `;
            })
            .join('');

          itemEl.innerHTML = `
            <button type="button" class="acc-header">
              <div class="acc-left">
                <span class="acc-cat-name">${escapeHtml(group.catago)}</span>
                <span class="acc-count">${group.items.length} รายการ • ${pct}%</span>
              </div>
              <div class="acc-right">
                <span class="acc-amount mono">${formatMoney(catPayable, false)} ฿</span>
                <span class="acc-chevron">▼</span>
              </div>
            </button>
            <div class="acc-body">
              ${subRowsHtml}
            </div>
          `;

          itemEl.querySelector('.acc-header').addEventListener('click', () => {
            itemEl.classList.toggle('open');
          });
          accContainer.appendChild(itemEl);
        });
      }

      // ปิดปุ่มจ่ายบัตรซ้ำเพราะเป็นบิลเดือนเก่าที่ชำระแล้ว
      state.pendingBatchPayItems = [];
      document.getElementById('btnBatchPayCredit').disabled = true;
      document.getElementById('settlePreviewSummary').innerHTML =
        `<span class="text-pos">✓ บิลของเดือน <strong>${escapeHtml(formatMonthYearDisplay(selectedCycle.monthYear, true))}</strong> ชำระเรียบร้อยแล้วเมื่อวันที่ ${escapeHtml(formatDateDMY(selectedCycle.lastPaidDateIso))}</span>`;
      return;
    }
  }

  // โหมด 1: "รอชำระรอบปัจจุบัน" (หักล้างตาม DETIAL ของหมวด จ่ายเครดิต 💳 อัตโนมัติ)
  if (state.creditFilterMode === 'pending') {
    const refDate = lastZeroCheckpointDateIso || lastPaidDateIso;
    const refId = lastZeroCheckpointId || lastPaidId;

    document.getElementById('creditBillCountBadge').textContent =
      pendingTotalPayable > 0 ? `${cycleCreditCharges.length} รายการรูด` : '0 รายการค้าง';
    document.getElementById('cbFilterSummaryText').textContent =
      refId > 0
        ? `ยอดรอชำระสุทธิ (นับต่อจาก ID #${refId} หักล้างรายการจ่ายเครดิตตาม DETIAL แล้ว)`
        : 'ยอดเครดิตที่รอชำระสุทธิ';

    const totalEl = document.getElementById('cbTotalAmount');
    totalEl.textContent = `${formatMoney(pendingTotalPayable, false)} ฿`;
    totalEl.className = `ct-number mono ${pendingTotalPayable === 0 ? 'text-pos' : ''}`;

    // เฉพาะหมวดที่ยังมียอดค้างชำระ (netCre < 0) หรือมีรายการในรอบนี้
    const sortedPendingGroups = Array.from(pendingCatGroups.values())
      .filter(g => g.netCre < 0)
      .sort((a, b) => a.netCre - b.netCre);

    if (sortedPendingGroups.length === 0) {
      accContainer.innerHTML = `
        <div class="empty-cell" style="padding: 36px 20px;">
          <div style="font-size: 1.05rem; font-weight: 700; color: var(--pos-color); margin-bottom: 6px;">
            ✦ ไม่มียอดเครดิตค้างชำระ (0 ฿)
          </div>
          <div style="font-size: 0.82rem; color: var(--text-secondary);">
            คุณได้ชำระค่าบัตรเครดิตครบทั้งหมดแล้ว${refDate ? `เมื่อวันที่ <strong>${escapeHtml(formatDateDMY(refDate))}</strong> (ถึงรายการ ID #${refId})` : ''}<br/>
            ระบบจะเริ่มแสดงยอดค้างชำระใหม่เมื่อคุณบันทึกรายการ <code>CREDIT</code> และสามารถทยอยตัดจ่ายรายหมวดด้วยการบันทึก <code>โอนออก</code> → <code>จ่ายเครดิต 💳</code> แล้วระบุหมวดในช่อง <code>DETIAL</code> ได้เลย
          </div>
        </div>
      `;
    } else {
      sortedPendingGroups.forEach(group => {
        const catPayable = Math.abs(group.netCre);
        const pct = pendingTotalPayable > 0 ? Math.round((catPayable / pendingTotalPayable) * 100) : 0;
        const itemEl = document.createElement('div');
        itemEl.className = 'acc-item';

        const subChargeRows = group.items
          .slice()
          .sort((a, b) => compareTransactionsByDate(a, b, 'asc'))
          .map(sub => {
            const c = Number(sub.CRE) || 0;
            const noteBadge = sub.note ? ` • note: ${escapeHtml(sub.note)}` : '';
            return `
              <div class="acc-sub-row">
                <div class="acc-sub-info">
                  <span class="acc-sub-title">${escapeHtml(sub.DETIAL || '(ไม่มีรายละเอียด)')}</span>
                  <span class="acc-sub-meta mono">#${escapeHtml(sub.ID)} • ${escapeHtml(formatDateDMY(sub.date))}${noteBadge}</span>
                </div>
                <span class="mono ${c < 0 ? 'text-neg' : 'text-pos'}">${formatMoney(c, true)} ฿</span>
              </div>
            `;
          })
          .join('');

        const subPaymentRows = (group.paymentItems || [])
          .map(pay => {
            const pAmt = Number(pay.CRE) || Math.abs(Number(pay.PRICE) || 0);
            return `
              <div class="acc-sub-row" style="background: var(--pos-bg); padding: 6px 8px; border-radius: 6px; margin-top: 4px;">
                <div class="acc-sub-info">
                  <span class="acc-sub-title text-pos">✓ หักล้างแล้ว: ${escapeHtml(pay.DETIAL || 'จ่ายเครดิต')}</span>
                  <span class="acc-sub-meta mono">#${escapeHtml(pay.ID)} • ${escapeHtml(formatDateDMY(pay.date))}</span>
                </div>
                <span class="mono text-pos">+${formatMoney(pAmt)} ฿</span>
              </div>
            `;
          })
          .join('');

        const offsetBadge = group.paidOffset > 0
          ? `<span class="acc-count text-pos">จ่ายแล้ว ${formatMoney(group.paidOffset)} ฿</span>`
          : '';

        itemEl.innerHTML = `
          <button type="button" class="acc-header">
            <div class="acc-left">
              <span class="acc-cat-name">${escapeHtml(group.catago)}</span>
              <span class="acc-count">${group.items.length} รายการ • ${pct}%</span>
              ${offsetBadge}
            </div>
            <div class="acc-right">
              <span class="acc-amount mono">${formatMoney(catPayable, false)} ฿</span>
              <span class="acc-chevron">▼</span>
            </div>
          </button>
          <div class="acc-body">
            ${subChargeRows}
            ${subPaymentRows}
          </div>
        `;

        itemEl.querySelector('.acc-header').addEventListener('click', () => {
          itemEl.classList.toggle('open');
        });

        accContainer.appendChild(itemEl);
      });
    }

    state.pendingBatchPayItems = sortedPendingGroups.map(g => {
      const amountToPay = Math.round(Math.abs(g.netCre) * 100) / 100;
      const shortCat = stripEmojiFromCatago(g.catago);
      return {
        sourceCatago: g.catago,
        amount: amountToPay,
        detial: `Cr: ${shortCat}`
      };
    });

    const btnBatchPay = document.getElementById('btnBatchPayCredit');
    const settleSummary = document.getElementById('settlePreviewSummary');
    btnBatchPay.disabled = state.pendingBatchPayItems.length === 0;

    if (state.pendingBatchPayItems.length > 0) {
      settleSummary.innerHTML = `พร้อมสร้างรายการตัดจ่ายบัตรทั้งหมด <strong>${state.pendingBatchPayItems.length} หมวดหมู่</strong> รวมเป็นเงิน <strong class="mono text-cre">${formatMoney(pendingTotalPayable)} ฿</strong>`;
    } else {
      settleSummary.textContent = 'ไม่มียอดเครดิตค้างชำระในรอบปัจจุบัน';
    }
    return;
  }

  // โหมด 2, 3, 4: ดูย้อนหลังตามช่วงวันที่ / Note / ทั้งหมด
  let filtered = allCreditTxs;
  let filterDesc = 'ประวัติรายการ CREDIT ทั้งหมด';

  if (state.creditFilterMode === 'date') {
    const s = state.cbStartDate;
    const e = state.cbEndDate;
    if (s || e) {
      filtered = allCreditTxs.filter(tx => {
        const d = String(tx.date || '').trim();
        if (!d) return false;
        if (s && d < s) return false;
        if (e && d > e) return false;
        return true;
      });
      filterDesc = `ช่วงวันที่ ${s ? formatDateDMY(s) : '...'} ถึง ${e ? formatDateDMY(e) : '...'}`;
    } else {
      filterDesc = 'ทุกช่วงวันที่ (เลือกวันที่เพื่อดูย้อนหลัง)';
    }
  } else if (state.creditFilterMode === 'note') {
    const q = state.cbNoteQuery.trim().toLowerCase();
    if (q) {
      filtered = allCreditTxs.filter(tx =>
        String(tx.note || '').toLowerCase().includes(q)
      );
      filterDesc = `รอบบิล note: "${state.cbNoteQuery.trim()}"`;
    } else {
      filterDesc = 'คลิกชิปรอบบิลด้านล่างเพื่อดูยอดตามป้าย Note';
    }
  }

  document.getElementById('creditBillCountBadge').textContent = `${filtered.length.toLocaleString()} รายการ`;
  document.getElementById('cbFilterSummaryText').textContent = filterDesc;

  const categoryGroups = new Map();
  let sumCre = 0;

  filtered.forEach(tx => {
    const creVal = Number(tx.CRE) || 0;
    sumCre += creVal;

    const cat = String(tx.CATAGO || 'อื่นๆ').trim() || 'อื่นๆ';
    if (!categoryGroups.has(cat)) {
      categoryGroups.set(cat, {
        catago: cat,
        sumCre: 0,
        items: []
      });
    }
    const g = categoryGroups.get(cat);
    g.sumCre += creVal;
    g.items.push(tx);
  });

  const totalPayable = sumCre < 0 ? Math.abs(sumCre) : 0;
  const totalEl = document.getElementById('cbTotalAmount');
  totalEl.textContent = `${formatMoney(totalPayable, false)} ฿`;
  totalEl.className = `ct-number mono ${totalPayable === 0 ? 'text-pos' : ''}`;

  const sortedGroups = Array.from(categoryGroups.values()).sort((a, b) => a.sumCre - b.sumCre);

  if (sortedGroups.length === 0) {
    accContainer.innerHTML = '<div class="empty-cell">ไม่พบรายการ CREDIT ตามตัวกรองที่เลือก</div>';
  } else {
    sortedGroups.forEach(group => {
      const catPayable = group.sumCre < 0 ? Math.abs(group.sumCre) : 0;
      const pct = totalPayable > 0 ? Math.round((catPayable / totalPayable) * 100) : 0;
      const itemEl = document.createElement('div');
      itemEl.className = 'acc-item';

      const subRowsHtml = group.items
        .slice()
        .sort((a, b) => compareTransactionsByDate(a, b, 'asc'))
        .map(sub => {
          const c = Number(sub.CRE) || 0;
          const noteBadge = sub.note ? ` • note: ${escapeHtml(sub.note)}` : '';
          return `
            <div class="acc-sub-row">
              <div class="acc-sub-info">
                <span class="acc-sub-title">${escapeHtml(sub.DETIAL || '(ไม่มีรายละเอียด)')}</span>
                <span class="acc-sub-meta mono">#${escapeHtml(sub.ID)} • ${escapeHtml(formatDateDMY(sub.date))}${noteBadge}</span>
              </div>
              <span class="mono ${c < 0 ? 'text-neg' : 'text-pos'}">${formatMoney(c, true)} ฿</span>
            </div>
          `;
        })
        .join('');

      itemEl.innerHTML = `
        <button type="button" class="acc-header">
          <div class="acc-left">
            <span class="acc-cat-name">${escapeHtml(group.catago)}</span>
            <span class="acc-count">${group.items.length} รายการ • ${pct}%</span>
          </div>
          <div class="acc-right">
            <span class="acc-amount mono">${formatMoney(catPayable, false)} ฿</span>
            <span class="acc-chevron">▼</span>
          </div>
        </button>
        <div class="acc-body">
          ${subRowsHtml}
        </div>
      `;

      itemEl.querySelector('.acc-header').addEventListener('click', () => {
        itemEl.classList.toggle('open');
      });

      accContainer.appendChild(itemEl);
    });
  }

  state.pendingBatchPayItems = sortedGroups
    .filter(g => g.sumCre < 0)
    .map(g => {
      const amountToPay = Math.round(Math.abs(g.sumCre) * 100) / 100;
      const shortCat = stripEmojiFromCatago(g.catago);
      return {
        sourceCatago: g.catago,
        amount: amountToPay,
        detial: `Cr: ${shortCat}`
      };
    });

  const btnBatchPay = document.getElementById('btnBatchPayCredit');
  const settleSummary = document.getElementById('settlePreviewSummary');
  btnBatchPay.disabled = state.pendingBatchPayItems.length === 0;

  if (state.pendingBatchPayItems.length > 0) {
    settleSummary.innerHTML = `พร้อมสร้างรายการตัดจ่ายบัตรทั้งหมด <strong>${state.pendingBatchPayItems.length} หมวดหมู่</strong> รวมเป็นเงิน <strong class="mono text-cre">${formatMoney(totalPayable)} ฿</strong>`;
  } else {
    settleSummary.textContent = 'ไม่มีรายการหนี้บัตรค้างจ่ายในตัวกรองปัจจุบัน';
  }
}

function renderAvailableNoteChips(creditTxs) {
  const container = document.getElementById('availableNotesChips');
  const noteInfoMap = new Map();

  // เรียงรายการตามวันที่จริงจากเก่า -> ใหม่ เพื่อให้ Note เรียงลำดับตามเดือนและปีของรอบบิล
  creditTxs
    .slice()
    .sort((a, b) => compareTransactionsByDate(a, b, 'asc'))
    .forEach(tx => {
      const n = String(tx.note || '').trim();
      if (!n) return;
      const isoDate = normalizeDateToIso(tx.date);
      if (!noteInfoMap.has(n)) {
        noteInfoMap.set(n, { count: 0, firstDate: isoDate || '9999-99-99', lastDate: isoDate || '0000-00-00' });
      }
      const info = noteInfoMap.get(n);
      info.count += 1;
      if (isoDate && isoDate < info.firstDate) info.firstDate = isoDate;
      if (isoDate && isoDate > info.lastDate) info.lastDate = isoDate;
    });

  // เรียงลำดับ Note ตามวันที่เริ่มต้นของรอบบิล (เก่า -> ใหม่ ตามลำดับเดือนและปี)
  const sortedNotes = Array.from(noteInfoMap.entries()).sort((a, b) =>
    a[1].firstDate.localeCompare(b[1].firstDate)
  );

  container.innerHTML = '';
  sortedNotes.forEach(([noteText, info]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip-pill ${state.cbNoteQuery.toLowerCase() === noteText.toLowerCase() ? 'active' : ''}`;
    btn.textContent = `🏷️ ${noteText} (${info.count})`;
    btn.addEventListener('click', () => {
      if (state.cbNoteQuery.toLowerCase() === noteText.toLowerCase()) {
        state.cbNoteQuery = '';
        document.getElementById('cbNoteQuery').value = '';
      } else {
        state.cbNoteQuery = noteText;
        document.getElementById('cbNoteQuery').value = noteText;
      }
      renderCreditBillSection();
    });
    container.appendChild(btn);
  });
}

function openBatchPayModal() {
  if (state.pendingBatchPayItems.length === 0) return;

  const payDate = document.getElementById('cbPayDate').value || getTodayIso();
  const payNote = document.getElementById('cbPayNote').value.trim();
  const listEl = document.getElementById('batchPayPreviewList');
  listEl.innerHTML = '';

  state.pendingBatchPayItems.forEach(item => {
    const row = document.createElement('div');
    row.className = 'batch-preview-item';
    row.innerHTML = `
      <div>
        <div><strong>${escapeHtml(item.detial)}</strong> <span class="tag-badge">${escapeHtml(SPECIAL_CREDIT_PAY_CAT)}</span></div>
        <div class="acc-sub-meta mono">ACT: โอนออก • วันที่: ${escapeHtml(payDate)}${payNote ? ' • note: ' + escapeHtml(payNote) : ''}</div>
      </div>
      <div class="text-right mono">
        <div class="text-neg">PRICE: -${formatMoney(item.amount)} ฿</div>
        <div class="text-pos">CRE: +${formatMoney(item.amount)} ฿</div>
      </div>
    `;
    listEl.appendChild(row);
  });

  document.getElementById('batchPayModal').classList.remove('hidden');
}

function closeBatchPayModal() {
  document.getElementById('batchPayModal').classList.add('hidden');
}

async function executeBatchPayCredit() {
  if (state.pendingBatchPayItems.length === 0) return;

  const payDate = document.getElementById('cbPayDate').value || getTodayIso();
  const monthYear = getMonthYearFromDate(payDate);
  const payNote = document.getElementById('cbPayNote').value.trim();
  const btnConfirm = document.getElementById('btnConfirmBatchPay');

  const batchPayloads = state.pendingBatchPayItems.map(item => ({
    date: payDate,
    'Month/Year': monthYear,
    ACT: 'โอนออก',
    CATAGO: SPECIAL_CREDIT_PAY_CAT,
    DETIAL: item.detial,
    PRICE: -Math.abs(item.amount),
    CRE: Math.abs(item.amount),
    note: payNote
  }));

  btnConfirm.disabled = true;
  btnConfirm.textContent = 'กำลังบันทึกแบบชุด...';

  try {
    await saveTransactionsToBackend(batchPayloads);
    closeBatchPayModal();
    showToast(`บันทึกจ่ายบัตรสำเร็จ ${batchPayloads.length} หมวดหมู่`, 'success');
  } catch (err) {
    showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.textContent = 'ยืนยันบันทึกทั้งหมด';
  }
}

/* =========================================================
   5. TRANSACTIONS LEDGER TABLE
   ========================================================= */
function renderRecentTransactions() {
  const tbody = document.getElementById('recentTxTableBody');
  const countBadge = document.getElementById('ledgerCountBadge');
  const navLedgerBadge = document.getElementById('navLedgerBadge');
  const showingInfo = document.getElementById('ledgerShowingInfo');
  const btnLoadMore = document.getElementById('btnLoadMoreLedger');

  tbody.innerHTML = '';
  navLedgerBadge.textContent = state.transactions.length.toLocaleString();

  const q = state.recentSearchQuery.trim().toLowerCase();
  let list = getTransactionsForActivePeriod().slice();

  if (state.ledgerActFilter !== 'ALL') {
    if (isCashAct(state.ledgerActFilter)) {
      list = list.filter(tx => isCashTx(tx));
    } else {
      list = list.filter(tx => !isCashTx(tx) && String(tx.ACT || '').trim() === state.ledgerActFilter);
    }
  }

  if (state.ledgerCatFilter !== 'ALL') {
    list = list.filter(tx => String(tx.CATAGO || '').trim() === state.ledgerCatFilter);
  }

  if (q) {
    list = list.filter(tx => {
      const hay = `${tx.ID} ${tx.date} ${tx['Month/Year']} ${tx.ACT} ${tx.CATAGO} ${tx.DETIAL} ${tx.note}`.toLowerCase();
      return hay.includes(q);
    });
  }

  // เรียงลำดับตามโหมดที่เลือก (ค่าเริ่มต้น: เรียงตามเลข ID ล่าสุดลงไปเก่าสุด เหมือนลำดับแถวใน Google Sheets)
  list.sort((a, b) => {
    const idA = Number(a.ID) || 0;
    const idB = Number(b.ID) || 0;
    if (state.ledgerSortOrder === 'id_desc') return idB - idA;
    if (state.ledgerSortOrder === 'id_asc') return idA - idB;
    if (state.ledgerSortOrder === 'date_asc') return compareTransactionsByDate(a, b, 'asc');
    return compareTransactionsByDate(a, b, 'desc');
  });

  countBadge.textContent = `${list.length.toLocaleString()} แถว`;

  const displayList = list.slice(0, state.ledgerLimit);
  showingInfo.textContent = `แสดง ${displayList.length.toLocaleString()} จากทั้งหมด ${list.length.toLocaleString()} รายการ (${getActivePeriodDisplayLabel()})`;

  if (list.length > state.ledgerLimit) {
    btnLoadMore.classList.remove('hidden');
  } else {
    btnLoadMore.classList.add('hidden');
  }

  if (displayList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-cell">ไม่พบรายการธุรกรรมในช่วงเวลานี้</td></tr>';
    return;
  }

  displayList.forEach(tx => {
    const p = tx.PRICE !== null && tx.PRICE !== '' && !isNaN(Number(tx.PRICE)) ? Number(tx.PRICE) : null;
    const c = tx.CRE !== null && tx.CRE !== '' && !isNaN(Number(tx.CRE)) ? Number(tx.CRE) : null;
    const isCash = isCashTx(tx);
    const cashVal = isCash ? getCashTxAmount(tx) : null;
    const cleanNote = isCash ? getCleanNoteForDisplay(tx) : (tx.note || '');

    const actStr = isCash ? 'เงินสด 💵' : String(tx.ACT || '');
    let actPillClass = 'act-pill-out';
    if (isCash) actPillClass = 'act-pill-cash';
    else if (actStr === 'รับโอน') actPillClass = 'act-pill-in';
    else if (actStr.toUpperCase() === 'CREDIT') actPillClass = 'act-pill-cre';

    let priceHtml = `<span class="text-muted">—</span>`;
    if (isCash && cashVal !== null) {
      priceHtml = `<span class="mono ${cashVal >= 0 ? 'text-pos' : 'text-cash'}" title="กระเป๋าเงินสด (แยกจากบัญชีธนาคาร)"><strong>💵 ${formatMoney(cashVal, true)}</strong></span>`;
    } else if (p !== null) {
      priceHtml = `<span class="mono ${p >= 0 ? 'text-pos' : 'text-neg'}"><strong>${formatMoney(p, true)}</strong></span>`;
    }

    const creHtml = c !== null
      ? `<span class="mono ${c > 0 ? 'text-pos' : 'text-cre'}"><strong>${formatMoney(c, true)}</strong></span>`
      : `<span class="text-muted">—</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono"><strong>#${escapeHtml(tx.ID)}</strong></td>
      <td class="mono">${escapeHtml(formatDateDMY(tx.date, tx['Month/Year']))}</td>
      <td class="mono text-muted">${escapeHtml(formatMonthYearDisplay(getTxMonthYear(tx), false))}</td>
      <td><span class="act-pill ${actPillClass}">${escapeHtml(actStr)}</span></td>
      <td><strong>${escapeHtml(tx.CATAGO)}</strong></td>
      <td>${escapeHtml(tx.DETIAL || '—')}</td>
      <td class="text-right">${priceHtml}</td>
      <td class="text-right">${creHtml}</td>
      <td class="mono">${escapeHtml(cleanNote)}</td>
      <td class="text-right">
        <div class="row-actions-cell">
          <button type="button" class="btn-row-action btn-row-edit" title="แก้ไขรายการ #${escapeHtml(tx.ID)}" aria-label="แก้ไข">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="btn-row-action btn-row-delete" title="ลบรายการ #${escapeHtml(tx.ID)}" aria-label="ลบ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </td>
    `;

    tr.querySelector('.btn-row-edit').addEventListener('click', () => {
      openEditTransactionModal(tx.ID);
    });

    tr.querySelector('.btn-row-delete').addEventListener('click', () => {
      deleteTransactionFromBackend(tx.ID);
    });

    tbody.appendChild(tr);
  });
}

/* =========================================================
   SETTINGS MODAL
   ========================================================= */
function initSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const inputNewPin = document.getElementById('inputNewPin');

  const openModal = () => {
    updatePinStatusBadge();
    modal.classList.remove('hidden');
  };

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  document.getElementById('btnOpenSettings').addEventListener('click', openModal);
  const btnBannerSetup = document.getElementById('btnBannerSetup');
  if (btnBannerSetup) btnBannerSetup.addEventListener('click', openModal);
  document.getElementById('btnCloseSettings').addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.getElementById('btnSavePin').addEventListener('click', () => {
    const pin = inputNewPin.value.trim();
    if (!/^\d{4}$/.test(pin)) {
      showToast('กรุณาตั้งรหัส PIN เป็นตัวเลข 4 หลัก', 'error');
      return;
    }
    state.pinCode = pin;
    localStorage.setItem(STORAGE_KEYS.PIN_CODE, pin);
    inputNewPin.value = '';
    updatePinStatusBadge();
    showToast('ตั้งรหัส PIN 4 หลักเรียบร้อย', 'success');
  });

  document.getElementById('btnLockNow').addEventListener('click', () => {
    closeModal();
    lockApp();
  });

  document.getElementById('btnRemovePin').addEventListener('click', () => {
    state.pinCode = '';
    localStorage.removeItem(STORAGE_KEYS.PIN_CODE);
    updatePinStatusBadge();
    showToast('ยกเลิกรหัส PIN แล้ว');
  });

  document.getElementById('btnLoadDemoData').addEventListener('click', () => {
    loadSampleDemoTransactions();
    closeModal();
    showToast('โหลดข้อมูลตัวอย่างจำลอง 3 รายการเรียบร้อย', 'success');
  });

  document.getElementById('btnClearLocalCache').addEventListener('click', () => {
    state.transactions = [];
    state.lastId = 0;
    state.isDemoMode = false;
    localStorage.removeItem(STORAGE_KEYS.TX_CACHE);
    localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
    ensureValidSelectedPeriods();
    updateConnectionBadge();
    updateFormPreviewAndSignUI();
    renderDashboard();
    showToast('รีเซ็ตข้อมูลทั้งหมดเป็น 0 เรียบร้อยแล้ว');
  });
}

function updatePinStatusBadge() {
  const badge = document.getElementById('pinStatusBadge');
  if (state.pinCode) {
    badge.textContent = 'เปิดใช้งาน PIN แล้ว';
    badge.className = 'tag-badge text-pos';
  } else {
    badge.textContent = 'ยังไม่ได้ตั้งรหัส';
    badge.className = 'tag-badge';
  }
}

function loadSampleDemoTransactions() {
  const today = getTodayIso();
  const ym = getMonthYearFromDate(today);
  state.isDemoMode = true;
  state.transactions = [
    {
      ID: 1,
      date: `${ym}-01`,
      'Month/Year': ym,
      ACT: 'รับโอน',
      CATAGO: 'รับงาน 🧑🏻‍💻',
      DETIAL: 'รายรับตัวอย่าง (Demo)',
      PRICE: 25000,
      CRE: null,
      note: 'ตัวอย่าง'
    },
    {
      ID: 2,
      date: `${ym}-05`,
      'Month/Year': ym,
      ACT: 'โอนออก',
      CATAGO: 'อาหาร 🍔',
      DETIAL: 'ค่าอาหารกลางวัน (Demo)',
      PRICE: -350,
      CRE: null,
      note: 'ตัวอย่าง'
    },
    {
      ID: 3,
      date: today,
      'Month/Year': ym,
      ACT: 'CREDIT',
      CATAGO: 'ส่วนตัว 🧑🏻‍🦱',
      DETIAL: 'ซื้อของใช้ส่วนตัว (Demo)',
      PRICE: null,
      CRE: -1200,
      note: 'ตัวอย่าง'
    }
  ];
  recalculateLastId();
  ensureValidSelectedPeriods();
  persistCache();
  updateConnectionBadge();
  updateFormPreviewAndSignUI();
  renderDashboard();
}
