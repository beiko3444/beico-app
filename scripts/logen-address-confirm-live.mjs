import { chromium } from 'playwright-core';

const LOGIN_ID = process.env.LOGEN_LOGIN_ID || '54751300';
const LOGIN_PASSWORD = process.env.LOGEN_LOGIN_PASSWORD || 'dprtmxmfozj1!';

const RECIPIENT_PHONE = process.env.LOGEN_DEBUG_RECIPIENT_PHONE || '01012341234';
const RECIPIENT_NAME = process.env.LOGEN_DEBUG_RECIPIENT_NAME || '\uC5D1\uC2A4\uD2B8\uB798\uCEE4';
const RECIPIENT_ADDRESS = process.env.LOGEN_DEBUG_RECIPIENT_ADDRESS || '\uC11C\uC6B8 \uAC15\uB0A8\uAD6C \uD14C\uD5E4\uB780\uB85C 427';
const RECIPIENT_DETAIL = process.env.LOGEN_DEBUG_RECIPIENT_DETAIL || '101\uD638';

const SINGLE_ORDER_URL = 'https://logis.ilogen.com/lrm01f-reserve/lrm01f0050.html';
const LIVE_SLOWMO = Number(process.env.LOGEN_DEBUG_SLOWMO || 180);
const STEP_PAUSE_MS = Number(process.env.LOGEN_DEBUG_STEP_PAUSE || 220);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatPhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return String(raw || '').trim();
};
const RECIPIENT_PHONE_FMT = formatPhone(RECIPIENT_PHONE);

async function closeInitialPopup(page) {
  const selectors = [
    '#btn-popupModal1',
    '#popupModal1 button.btn.base.close',
    '#popupModal1 button.btn.outline.close',
    '#popupModal1 .btn.close',
    '[onclick^="fn_popClose"]',
    '.modalContainer .btn.outline.close',
    '.modalWrap .btn.close',
  ];

  for (let i = 0; i < 12; i += 1) {
    let clicked = false;
    for (const selector of selectors) {
      const loc = page.locator(selector).first();
      if (await loc.isVisible().catch(() => false)) {
        await loc.click({ force: true }).catch(() => {});
        clicked = true;
        await sleep(100);
      }
    }
    // Fast-path fallback for popup close function.
    const closedByFn = await page.evaluate(() => {
      if (typeof window.fn_popClose === 'function') {
        window.fn_popClose('N');
        return true;
      }
      return false;
    }).catch(() => false);
    if (closedByFn) clicked = true;
    if (!clicked) break;
  }
}

async function clickFirstVisible(frame, selectors, timeout = 1800) {
  for (const selector of selectors) {
    try {
      const loc = frame.locator(selector).first();
      await loc.waitFor({ state: 'visible', timeout });
      await loc.click({ force: true, timeout: 3000 });
      return true;
    } catch {
      // next selector
    }
  }
  return false;
}

async function resolveMultiCustomerPopup(frame) {
  return await frame.evaluate(() => {
    const popup = document.querySelector('#popupModal_MultiCust');
    if (!popup) return false;

    const style = window.getComputedStyle(popup);
    const visible = style.display !== 'none' && style.visibility !== 'hidden';
    if (!visible) return false;

    const firstCell =
      document.querySelector('#popupModal_MultiCust table tbody tr td')
      || document.querySelector('#popupModal_MultiCust .IBMain td');

    if (firstCell) {
      firstCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      firstCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }

    const selectBtn = document.querySelector('#selectBtn');
    if (selectBtn) {
      selectBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    }

    return false;
  }).catch(() => false);
}

async function clickFirstVisibleAny(contexts, selectors, timeout = 1800) {
  for (const ctx of contexts) {
    const clicked = await clickFirstVisible(ctx, selectors, timeout);
    if (clicked) return true;
  }
  return false;
}

function getAllContexts(page, frame) {
  const contexts = [];
  if (frame) contexts.push(frame);
  contexts.push(page);
  for (const f of page.frames()) {
    if (!f) continue;
    if (frame && f === frame) continue;
    if (f.url() === 'about:blank') continue;
    contexts.push(f);
  }
  return contexts;
}

async function hasOpenSavePopup(contexts) {
  for (const ctx of contexts) {
    const open = await ctx.evaluate(() => {
      const isVisible = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const st = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect?.();
        return st.display !== 'none'
          && st.visibility !== 'hidden'
          && st.opacity !== '0'
          && !!rect
          && rect.width > 0
          && rect.height > 0;
      };
      return isVisible('#popupModal1') || isVisible('#popupModal') || isVisible('#popupModal_MultiCust');
    }).catch(() => false);
    if (open) return true;
  }
  return false;
}

async function waitUntilSavePopupsClosed(page, frame, timeoutMs = 7000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const open = await hasOpenSavePopup(getAllContexts(page, frame));
    if (!open) return true;
    await sleep(140);
  }
  return false;
}

async function dismissSavePopups(page, frame) {
  const contexts = getAllContexts(page, frame);

  await clickFirstVisibleAny(contexts, [
    '#popupModal1 button:has-text("확인")',
    '#popupModal1 button:has-text("예")',
    '#popupModal button:has-text("확인")',
    '#popupModal button:has-text("예")',
    'button:has-text("확인")',
    'button:has-text("예")',
    'input[type="button"][value="확인"]',
    'input[type="button"][value="예"]',
    '#btn-popupModal1',
    '#selectBtn',
  ], 900);

  for (const ctx of contexts) {
    await ctx.evaluate(() => {
      const call = (name, ...args) => {
        try {
          if (typeof window[name] === 'function') {
            window[name](...args);
            return true;
          }
        } catch {}
        return false;
      };
      call('fn_popClose', 'N');
      call('fn_comm_popClose');
      call('fn_btnRcvCustMultiOk');
    }).catch(() => {});
  }

  // 다수회원조회가 뜨면 즉시 첫 행 선택 후 확인.
  for (const ctx of contexts) {
    await resolveMultiCustomerPopup(ctx);
  }
}

async function focusFirstUnprintedRow(page, frame) {
  const contexts = [frame, page];
  for (const ctx of contexts) {
    const focused = await ctx.evaluate(() => {
      const row =
        document.querySelector('.IBMain tbody tr')
        || document.querySelector('.IBMain table tbody tr')
        || document.querySelector('table tbody tr');
      if (!row) return false;
      const cell = row.querySelector('td') || row;
      try {
        cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      } catch {}
      return true;
    }).catch(() => false);
    if (focused) return true;
  }
  return false;
}

async function clickUtilityCheckboxNearLabel(page, frame, labelText) {
  const contexts = [frame, page];
  for (const ctx of contexts) {
    const ok = await ctx.evaluate((label) => {
      const nodes = Array.from(document.querySelectorAll('label, span, th, td, div, a'));
      for (const n of nodes) {
        const txt = (n.textContent || '').replace(/\s+/g, ' ').trim();
        if (!txt || !txt.includes(label)) continue;
        const cb =
          n.querySelector?.('input[type="checkbox"]')
          || n.previousElementSibling?.querySelector?.('input[type="checkbox"]')
          || n.nextElementSibling?.querySelector?.('input[type="checkbox"]')
          || n.closest?.('tr, div, li')?.querySelector?.('input[type="checkbox"]');
        if (!cb) continue;
        cb.click();
        return true;
      }
      return false;
    }, labelText).catch(() => false);
    if (ok) return true;
  }
  return false;
}

async function clickGridHeaderAllCheckbox(page, frame) {
  const contexts = [frame, page];
  for (const ctx of contexts) {
    const ok = await ctx.evaluate(() => {
      const headerRows = Array.from(document.querySelectorAll('tr')).filter((tr) => {
        const txt = (tr.textContent || '').replace(/\s+/g, ' ').trim();
        return txt.includes('No.') && txt.includes('전체');
      });
      for (const row of headerRows) {
        const cb = row.querySelector('input[type="checkbox"]');
        if (cb) {
          cb.click();
          return true;
        }
      }
      return false;
    }).catch(() => false);
    if (ok) return true;
  }
  return false;
}

async function clickIBSheetHeaderAllIcon(page, frame) {
  const contexts = [frame, page];
  for (const ctx of contexts) {
    const ok = await ctx.evaluate(() => {
      const isVisible = (el) => {
        if (!el) return false;
        const st = window.getComputedStyle(el);
        const r = el.getBoundingClientRect?.();
        return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0' && !!r && r.width > 0 && r.height > 0;
      };
      const clickIcon = (icon) => {
        if (!isVisible(icon)) return false;
        try {
          icon.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        } catch {}
        try {
          icon.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          icon.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          icon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          icon.click?.();
        } catch {}
        return true;
      };

      // Prefer the header icon located in the header row containing "No." and "전체".
      const headerRows = Array.from(document.querySelectorAll('tr, .IBHScroll, .IBHead, .IBHeaderRow, .IBMain')).filter((el) => {
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        return txt.includes('No.') && txt.includes('전체');
      });
      for (const row of headerRows) {
        const icon =
          row.querySelector('div.IBHeaderIcon')
          || row.querySelector('div[class*="IBHeaderIcon"]')
          || row.querySelector('div[class*="IBCheck0"]')
          || null;
        if (clickIcon(icon)) return true;
      }

      // Fallback: first visible IBSheet header icon.
      const icons = Array.from(document.querySelectorAll('div.IBHeaderIcon, div[class*="IBHeaderIcon"], div[class*="IBCheck0"]'));
      for (const icon of icons) {
        if (clickIcon(icon)) return true;
      }
      return false;
    }).catch(() => false);
    if (ok) return true;
  }
  return false;
}

async function getUnprintedGridState(page, frame) {
  const contexts = [frame, page];
  for (const ctx of contexts) {
    const state = await ctx.evaluate(() => {
      const rowCount =
        document.querySelectorAll('.IBMain tbody tr').length
        || document.querySelectorAll('.IBMain table tbody tr').length
        || document.querySelectorAll('table tbody tr').length;
      const checkboxCount =
        document.querySelectorAll('.IBMain tbody tr input[type="checkbox"]').length
        || document.querySelectorAll('table tbody tr input[type="checkbox"]').length
        || document.querySelectorAll('input[type="checkbox"]').length;
      const checkedCount =
        document.querySelectorAll('.IBMain tbody tr input[type="checkbox"]:checked').length
        || document.querySelectorAll('table tbody tr input[type="checkbox"]:checked').length
        || 0;
      return { rowCount, checkboxCount, checkedCount };
    }).catch(() => null);
    if (state && (state.rowCount > 0 || state.checkboxCount > 0)) return state;
  }
  return { rowCount: 0, checkboxCount: 0, checkedCount: 0 };
}

async function waitForUnprintedGridReady(page, frame, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await getUnprintedGridState(page, frame);
    if (state.rowCount > 0 && state.checkboxCount > 0) return state;
    await sleep(180);
  }
  return await getUnprintedGridState(page, frame);
}

async function waitForNoPrintRowsByApi(frame, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await frame.evaluate(() => {
      const slipTy = $('input[name="rboSlipTy"]:checked').val();
      const normalSheet = window.lrm01f0050Sheet1;
      const rtnSheet = window.lrm01f0050RtnSheet1;
      const getRows = (sheet) => {
        if (!sheet || typeof sheet.getDataRows !== 'function') return [];
        const rows = sheet.getDataRows() || [];
        return Array.isArray(rows) ? rows : [];
      };
      const normalRows = getRows(normalSheet);
      const rtnRows = getRows(rtnSheet);

      let sheet = slipTy === '200' ? rtnSheet : normalSheet;
      let rows = getRows(sheet);
      if (rows.length === 0) {
        const altSheet = sheet === normalSheet ? rtnSheet : normalSheet;
        const altRows = getRows(altSheet);
        if (altRows.length > rows.length) {
          sheet = altSheet;
          rows = altRows;
        }
      }

      if (!sheet || typeof sheet.getDataRows !== 'function') return { rowCount: 0, checkedCount: 0 };
      let checkedCount = 0;
      try {
        if (typeof sheet.getRowsByChecked === 'function') {
          checkedCount = (sheet.getRowsByChecked('CheckData') || []).length;
        }
      } catch {}
      return { rowCount: Array.isArray(rows) ? rows.length : 0, checkedCount };
    }).catch(() => ({ rowCount: 0, checkedCount: 0 }));
    if (state.rowCount > 0) return state;
    await sleep(180);
  }
  return await frame.evaluate(() => {
    const slipTy = $('input[name="rboSlipTy"]:checked').val();
    const normalSheet = window.lrm01f0050Sheet1;
    const rtnSheet = window.lrm01f0050RtnSheet1;
    const getRows = (sheet) => {
      if (!sheet || typeof sheet.getDataRows !== 'function') return [];
      const rows = sheet.getDataRows() || [];
      return Array.isArray(rows) ? rows : [];
    };
    const normalRows = getRows(normalSheet);
    const rtnRows = getRows(rtnSheet);
    let sheet = slipTy === '200' ? rtnSheet : normalSheet;
    let rows = getRows(sheet);
    if (rows.length === 0) {
      const altSheet = sheet === normalSheet ? rtnSheet : normalSheet;
      const altRows = getRows(altSheet);
      if (altRows.length > rows.length) {
        sheet = altSheet;
        rows = altRows;
      }
    }
    if (!sheet || typeof sheet.getDataRows !== 'function') return { rowCount: 0, checkedCount: 0 };
    let checkedCount = 0;
    try {
      if (typeof sheet.getRowsByChecked === 'function') {
        checkedCount = (sheet.getRowsByChecked('CheckData') || []).length;
      }
    } catch {}
    return { rowCount: Array.isArray(rows) ? rows.length : 0, checkedCount };
  }).catch(() => ({ rowCount: 0, checkedCount: 0 }));
}

async function selectNoPrintRowsByApi(frame) {
  return await frame.evaluate(() => {
    const slipTy = $('input[name="rboSlipTy"]:checked').val();
    const normalSheet = window.lrm01f0050Sheet1;
    const rtnSheet = window.lrm01f0050RtnSheet1;
    const getRows = (sheet) => {
      if (!sheet || typeof sheet.getDataRows !== 'function') return [];
      const rows = sheet.getDataRows() || [];
      return Array.isArray(rows) ? rows : [];
    };
    let sheet = slipTy === '200' ? rtnSheet : normalSheet;
    let rows = getRows(sheet);
    if (rows.length === 0) {
      const altSheet = sheet === normalSheet ? rtnSheet : normalSheet;
      const altRows = getRows(altSheet);
      if (altRows.length > rows.length) {
        sheet = altSheet;
        rows = altRows;
      }
    }

    if (!sheet || typeof sheet.getDataRows !== 'function') return { ok: false, rowCount: 0, checkedCount: 0, reason: 'no-sheet' };
    if (!Array.isArray(rows) || rows.length === 0) return { ok: false, rowCount: 0, checkedCount: 0, reason: 'no-rows' };

    // Primary: page-native selection path
    try {
      window.grd2ChkIdx = rows.slice();
      if (typeof window.fn_grdChk === 'function') {
        window.fn_grdChk('rdo_noprint');
      }
    } catch {}

    let checkedCount = 0;
    try {
      if (typeof sheet.getRowsByChecked === 'function') {
        checkedCount = (sheet.getRowsByChecked('CheckData') || []).length;
      }
    } catch {}

    // Fallback: force CheckData value for each row
    if (checkedCount === 0) {
      for (const row of rows) {
        try {
          sheet.setValue({ row, col: 'CheckData', val: 1, render: 1 });
        } catch {}
      }
      try {
        const h = sheet.getHeaderRows?.();
        if (Array.isArray(h) && h.length && typeof sheet.setIconCheck === 'function') {
          sheet.setIconCheck(h[0], 'CheckData', 1);
        }
      } catch {}
      try {
        if (typeof sheet.getRowsByChecked === 'function') {
          checkedCount = (sheet.getRowsByChecked('CheckData') || []).length;
        }
      } catch {}
    }

    return { ok: checkedCount > 0, rowCount: rows.length, checkedCount, reason: checkedCount > 0 ? 'ok' : 'not-checked' };
  }).catch(() => ({ ok: false, rowCount: 0, checkedCount: 0, reason: 'eval-failed' }));
}

async function checkAllUnprintedOrders(page, frame) {
  const contexts = [frame, page];

  // 0) Exact IBSheet header icon click first (what user points to: div.IBHeaderIcon...).
  const headerIconChecked = await clickIBSheetHeaderAllIcon(page, frame);
  if (headerIconChecked) return true;

  // 1) Strict grid header checkbox fallback
  const headerChecked = await clickGridHeaderAllCheckbox(page, frame);
  if (headerChecked) return true;

  // 2) Prefer DOM "전체" checkbox click
  for (const ctx of contexts) {
    const clickedByDom = await ctx.evaluate(() => {
      const clickIfCheckbox = (el) => {
        if (!el) return false;
        if (el.tagName === 'INPUT' && el.type === 'checkbox') {
          if (!el.checked) {
            el.checked = true;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
          el.click();
          return true;
        }
        return false;
      };

      const nodes = Array.from(document.querySelectorAll('th, td, span, label, div, a'));
      for (const n of nodes) {
        const txt = (n.textContent || '').replace(/\s+/g, ' ').trim();
        if (!txt || !txt.includes('전체')) continue;
        if (clickIfCheckbox(n.querySelector('input[type="checkbox"]'))) return true;
        if (clickIfCheckbox(n.previousElementSibling?.querySelector?.('input[type="checkbox"]'))) return true;
        if (clickIfCheckbox(n.nextElementSibling?.querySelector?.('input[type="checkbox"]'))) return true;
        if (clickIfCheckbox(n.closest('tr, thead, table, .IBMain')?.querySelector?.('input[type="checkbox"]'))) return true;
      }
      return false;
    }).catch(() => false);
    if (clickedByDom) return true;
  }

  // 3) IBSheet API fallback
  for (const ctx of contexts) {
    const checkedBySheet = await ctx.evaluate(() => {
      const win = window;
      for (const key of Object.keys(win)) {
        const obj = win[key];
        if (!obj || typeof obj !== 'object') continue;
        try {
          if (typeof obj.allCheck === 'function') {
            obj.allCheck(1);
            return true;
          }
        } catch {}
      }
      return false;
    }).catch(() => false);
    if (checkedBySheet) return true;
  }

  // 4) CSS fallback
  const checked = await clickFirstVisibleAny(contexts, [
    'th:has-text("전체") input[type="checkbox"]',
    'td:has-text("전체") input[type="checkbox"]',
    'label:has-text("전체") input[type="checkbox"]',
    'table tbody tr input[type="checkbox"]',
    'input[type="checkbox"][name*="chk"]',
    'input[type="checkbox"]',
  ], 3000);
  if (checked) return true;

  // 5) Force first-row checkbox only (row print fallback)
  for (const ctx of contexts) {
    const firstRowChecked = await ctx.evaluate(() => {
      const row =
        document.querySelector('.IBMain tbody tr')
        || document.querySelector('.IBMain table tbody tr')
        || document.querySelector('table tbody tr');
      if (!row) return false;
      const cb = row.querySelector('input[type="checkbox"]');
      if (!cb) return false;
      if (!cb.checked) {
        cb.checked = true;
        cb.dispatchEvent(new Event('input', { bubbles: true }));
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
      cb.click();
      return true;
    }).catch(() => false);
    if (firstRowChecked) return true;
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    slowMo: Number.isFinite(LIVE_SLOWMO) ? LIVE_SLOWMO : 80,
  });

  const context = await browser.newContext({
    locale: 'ko-KR',
    viewport: { width: 1500, height: 1000 },
  });

  const page = await context.newPage();

  page.on('dialog', async (dialog) => {
    try {
      console.log('[Dialog]', dialog.type(), dialog.message());
      await dialog.accept();
    } catch {
      // ignore
    }
  });

  let failed = false;

  try {
    console.log('[Live] Login...');
    await page.goto('https://logis.ilogen.com/', { waitUntil: 'domcontentloaded' });
    await sleep(1200);
    await page.fill('[id="user.id"]', LOGIN_ID);
    await page.fill('[id="user.pw"]', LOGIN_PASSWORD);
    await page.click('a[onclick="basicLogin()"]');
    await sleep(1200);

    await closeInitialPopup(page);
    await sleep(300);
    await closeInitialPopup(page);

    console.log('[Live] Move to single order page...');
    await page.goto(SINGLE_ORDER_URL, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    const frame = page.frames().find((f) => f.url().includes('/lrm01f-reserve/lrm01f0050.html') || f.url().includes('/lrm01f0050.html'));
    if (!frame) throw new Error('Order frame not found');

    // Block LOGEN auto multi-customer popup trigger chain during recipient input.
    await frame.evaluate(() => {
      const noOp = () => undefined;
      window.SelectCustInfo = noOp;
      window.fn_MultCustSearch = noOp;
      window.fn_lcm_MultiCustPopup = noOp;
      window.fn_getMultiCustList = noOp;
      window.fn_custInfoByRcvCustNm = noOp;
      window.fn_btnRcvCustName_Click = noOp;
      window.fn_custInfoByRcvTelNo = noOp;
      window.fn_btnRcvCustTelNo_Click = noOp;

      const clearHandlers = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return;
        el.onblur = null;
        el.onchange = null;
        el.onkeyup = null;
        el.removeAttribute('onblur');
        el.removeAttribute('onchange');
        el.removeAttribute('onkeyup');
      };

      clearHandlers('#strRcvCustNm');
      clearHandlers('#strRcvCustTelNo');
      clearHandlers('#strRcvCustCellNo');
    }).catch(() => {});

    console.log('[Live] Fill recipient phone/name (value only)...');
    const recipientSet = await frame.evaluate(({ phone, name }) => {
      const setOnly = (selector, value) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        el.value = value;
        return true;
      };
      const telOk = setOnly('#strRcvCustTelNo', phone);
      const nameOk = setOnly('#strRcvCustNm', name);
      return telOk && nameOk;
    }, { phone: RECIPIENT_PHONE_FMT, name: RECIPIENT_NAME });
    if (!recipientSet) throw new Error('Recipient phone/name inputs not found');

    console.log('[Live] Address keyword + magnifier...');
    await frame.fill('#strRcvZipCd', RECIPIENT_ADDRESS);

    const magnifierClicked = await clickFirstVisible(frame, [
      '#btnRcvZipCd',
      '#rcvForm .mZip #btnRcvZipCd',
      '#rcvForm .mZip span.form-btn[onclick*="fn_popRcvAddrSearch"]',
      '.mZip span.form-btn[onclick*="fn_popRcvAddrSearch"]',
      '.mZip span.form-btn',
      '.mZip .las.la-search',
    ]);
    if (!magnifierClicked) {
      const strictClick = await frame.evaluate(() => {
        const zipInput = document.querySelector('#strRcvZipCd');
        if (!zipInput) return false;
        const container = zipInput.closest('.mZip, .form-conts, .w-line, .relative') || zipInput.parentElement;
        if (!container) return false;
        const clickTarget =
          container.querySelector('#btnRcvZipCd')
          || container.querySelector('span.form-btn[onclick*="fn_popRcvAddrSearch"]')
          || container.querySelector('span.form-btn')
          || container.querySelector('.las.la-search')
          || null;
        if (clickTarget) {
          clickTarget.click();
          return true;
        }
        if (typeof window.fn_popRcvAddrSearch === 'function') {
          window.fn_popRcvAddrSearch();
          return true;
        }
        return false;
      }).catch(() => false);
      if (!strictClick) throw new Error('Address magnifier button not found (#btnRcvZipCd / fn_popRcvAddrSearch)');
    }
    await frame.evaluate(() => {
      if (typeof window.fn_popRcvAddrSearch === 'function') {
        window.fn_popRcvAddrSearch();
      }
    }).catch(() => {});

    await sleep(1200);

    const popupCandidates = getAllContexts(page, frame);
    const inspectPopupCtx = async (ctx) => {
      return await ctx.evaluate(() => {
        const popup = document.querySelector('#popupModal');
        const style = popup ? window.getComputedStyle(popup) : null;
        const rect = popup?.getBoundingClientRect?.();
        const popupVisible = !!popup
          && !!style
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && style.opacity !== '0'
          && !!rect
          && rect.width > 0
          && rect.height > 0;
        const hasPopupInput = !!document.querySelector('#commPopSchVal1');
        const hasSearchFn = typeof window.fn_comm_getDataList === 'function';
        const hasSheet = !!window.popGridSheet;
        const sheetRows = (() => {
          const sheet = window.popGridSheet;
          if (!sheet || typeof sheet.getDataRows !== 'function') return 0;
          const rows = sheet.getDataRows();
          return Array.isArray(rows) ? rows.length : 0;
        })();
        const domRows = document.querySelectorAll('#popupModal .IBMain tbody tr, #popupModal table tbody tr').length;
        const rowCount = Math.max(sheetRows, domRows);
        return { popupVisible, hasPopupInput, hasSearchFn, hasSheet, rowCount };
      }).catch(() => ({ popupVisible: false, hasPopupInput: false, hasSearchFn: false, hasSheet: false, rowCount: 0 }));
    };

    let popupCtx = frame;
    let popupCtxName = 'frame(default)';
    for (let i = 0; i < 14; i += 1) {
      let best = { score: -1, ctx: frame, name: 'frame(default)' };
      for (const ctx of popupCandidates) {
        const state = await inspectPopupCtx(ctx);
        const score = (state.popupVisible ? 100 : 0)
          + (state.rowCount > 0 ? 60 : 0)
          + (state.hasPopupInput ? 25 : 0)
          + (state.hasSearchFn ? 15 : 0)
          + (state.hasSheet ? 10 : 0);
        const name = ctx === frame ? 'frame' : (ctx === page ? 'page' : `subframe:${ctx.url()}`);
        if (score > best.score) best = { score, ctx, name };
      }
      popupCtx = best.ctx;
      popupCtxName = best.name;
      if (best.score >= 25) break;

      await frame.evaluate(() => {
        if (typeof window.fn_popRcvAddrSearch === 'function') {
          window.fn_popRcvAddrSearch();
        }
      }).catch(() => {});
      await page.evaluate(() => {
        if (typeof window.fn_popRcvAddrSearch === 'function') {
          window.fn_popRcvAddrSearch();
        }
      }).catch(() => {});
      await sleep(250);
    }

    console.log(`[Live] Popup context: ${popupCtxName}`);
    const popupDebug = await popupCtx.evaluate(() => ({
      popupVisible: (() => {
        const p = document.querySelector('#popupModal');
        if (!p) return false;
        const st = window.getComputedStyle(p);
        return st.display !== 'none' && st.visibility !== 'hidden';
      })(),
      hasPopupInput: !!document.querySelector('#commPopSchVal1'),
      hasSearchFn: typeof window.fn_comm_getDataList === 'function',
      hasSheet: !!window.popGridSheet,
      popupHtml: (document.querySelector('#popupModal')?.outerHTML || '').slice(0, 500),
    })).catch(() => null);
    console.log('[Live] Popup debug:', JSON.stringify(popupDebug));

    const keywordCandidates = [
      RECIPIENT_ADDRESS,
      RECIPIENT_ADDRESS.split(/\s+/).slice(0, 3).join(' '),
      RECIPIENT_ADDRESS.split(/\s+/).slice(0, 2).join(' '),
      RECIPIENT_ADDRESS.split(/\s+/).slice(0, 1).join(' '),
    ].filter((v, i, arr) => !!v && arr.indexOf(v) === i);

    const getPopupRowCount = async () => {
      return await popupCtx.evaluate(() => {
        const sheetRows = (() => {
          const sheet = window.popGridSheet;
          if (!sheet || typeof sheet.getDataRows !== 'function') return 0;
          const rows = sheet.getDataRows();
          return Array.isArray(rows) ? rows.length : 0;
        })();
        const domRows = document.querySelectorAll('#popupModal .IBMain tbody tr, #popupModal table tbody tr').length;
        return Math.max(sheetRows, domRows);
      }).catch(() => 0);
    };

    let rowCount = 0;
    const popupInput = popupCtx.locator('#commPopSchVal1').first();
    const popupVisible = await popupCtx.locator('#popupModal').first().isVisible().catch(() => false);
    if (popupVisible && await popupInput.isVisible().catch(() => false)) {
      for (const keyword of keywordCandidates) {
        await popupInput.fill(keyword).catch(() => {});
        await clickFirstVisible(popupCtx, [
          '#popupModal button[onclick*="fn_comm_getDataList"]',
          '#popupModal span.form-btn[onclick*="fn_comm_getDataList"]',
          '#popupModal .form-btn[onclick*="fn_comm_getDataList"]',
          '#popupModal button',
          '#popupModal .btn.base',
        ], 1500);
        await popupCtx.evaluate(() => {
          if (typeof window.fn_comm_getDataList === 'function') {
            window.fn_comm_getDataList();
          }
        }).catch(() => {});
        for (let i = 0; i < 15; i += 1) {
          rowCount = await getPopupRowCount();
          if (rowCount > 0) break;
          await sleep(250);
        }
        if (rowCount > 0) break;
      }
    } else {
      for (let i = 0; i < 20; i += 1) {
        rowCount = await getPopupRowCount();
        if (rowCount > 0) break;
        await sleep(250);
      }
    }
    if (!rowCount) {
      for (const ctx of popupCandidates) {
        if (ctx === popupCtx) continue;
        const otherRowCount = await ctx.evaluate(() => {
          const sheetRows = (() => {
            const sheet = window.popGridSheet;
            if (!sheet || typeof sheet.getDataRows !== 'function') return 0;
            const rows = sheet.getDataRows();
            return Array.isArray(rows) ? rows.length : 0;
          })();
          const domRows = document.querySelectorAll('#popupModal .IBMain tbody tr, #popupModal table tbody tr').length;
          return Math.max(sheetRows, domRows);
        }).catch(() => 0);
        if (otherRowCount > 0) {
          popupCtx = ctx;
          rowCount = otherRowCount;
          console.log('[Live] Popup context fallback switched to row-ready context.');
          break;
        }
      }
    }

    if (!rowCount) {
      const rowDebug = await popupCtx.evaluate(() => ({
        sheetRows: (() => {
          const rows = window.popGridSheet?.getDataRows?.() || [];
          return Array.isArray(rows) ? rows.length : 0;
        })(),
        domRows: document.querySelectorAll('#popupModal .IBMain tbody tr, #popupModal table tbody tr').length,
        popupVisible: (() => {
          const p = document.querySelector('#popupModal');
          if (!p) return false;
          const st = window.getComputedStyle(p);
          return st.display !== 'none' && st.visibility !== 'hidden';
        })(),
        popupDisplay: (() => {
          const p = document.querySelector('#popupModal');
          if (!p) return '';
          const st = window.getComputedStyle(p);
          return `${st.display}/${st.visibility}`;
        })(),
      })).catch(() => null);
      console.log('[Live] Popup row debug:', JSON.stringify(rowDebug));
      throw new Error('No rows in address popup');
    }

    const firstZip = await popupCtx.evaluate(() => {
      const rows = window.popGridSheet?.getDataRows?.() || [];
      if (!rows.length) return '';
      return String(rows[0].bsiZonNo ?? '');
    }).catch(() => '');

    console.log('[Live] Double click postal row...', firstZip);
    let dbl = false;
    const selectors = firstZip
      ? [
          `#popupModal td:has-text("${firstZip.replace(/"/g, '\\"')}")`,
          '#popupModal .IBMain td',
          '#popupModal table tbody tr td',
        ]
      : ['#popupModal .IBMain td', '#popupModal table tbody tr td'];

    for (const sel of selectors) {
      const target = popupCtx.locator(sel).first();
      if (await target.isVisible().catch(() => false)) {
        await target.click({ force: true }).catch(() => {});
        await target.dblclick({ force: true }).catch(() => {});
        await sleep(450);
        const applied = await frame.evaluate(() => {
          const zip = document.querySelector('#strRcvZipCd')?.value || '';
          const bldg = document.querySelector('#strRcvBldgCd')?.value || '';
          const addr1 = document.querySelector('#strRcvCustAddr1')?.value || '';
          return !!zip && (!!bldg || !!addr1);
        }).catch(() => false);
        if (applied) {
          dbl = true;
          break;
        }
      }
    }

    if (!dbl) {
      const forced = await popupCtx.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#popupModal .IBMain tr, #popupModal table tbody tr'));
        for (const tr of rows) {
          const txt = (tr.textContent || '').trim();
          if (!txt) continue;
          tr.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          tr.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          return true;
        }
        return false;
      }).catch(() => false);
      if (!forced) throw new Error('Postal row double-click failed');
    }

    await sleep(Math.max(200, STEP_PAUSE_MS));

    const returnInvoked = await popupCtx.evaluate(() => {
      const sheet = window.popGridSheet;
      const rows = sheet?.getDataRows?.() || [];
      if (!Array.isArray(rows) || rows.length === 0) return false;
      if (typeof window.fn_comm_popReturn !== 'function') return false;
      window.fn_comm_popReturn(rows[0]);
      return true;
    }).catch(() => false);
    if (returnInvoked) {
      await sleep(Math.max(180, STEP_PAUSE_MS));
    }

    let addressApplied = await frame.evaluate(() => {
      const zip = document.querySelector('#strRcvZipCd')?.value || '';
      const bldg = document.querySelector('#strRcvBldgCd')?.value || '';
      const addr1 = document.querySelector('#strRcvCustAddr1')?.value || '';
      return !!zip && (!!bldg || !!addr1);
    }).catch(() => false);

    if (!addressApplied) {
      const firstPopupRow = await popupCtx.evaluate(() => {
        const rows = window.popGridSheet?.getDataRows?.() || [];
        if (!Array.isArray(rows) || rows.length === 0) return null;
        const raw = rows[0];
        return {
          bsiZonNo: String(raw.bsiZonNo ?? ''),
          bldgCd: String(raw.bldgCd ?? ''),
          sidoNam: String(raw.sidoNam ?? ''),
          sigunguNam: String(raw.sigunguNam ?? ''),
          dongRiNam: String(raw.dongRiNam ?? ''),
          bunjiHo: String(raw.bunjiHo ?? ''),
          roadNam: String(raw.roadNam ?? ''),
          strcNum: String(raw.strcNum ?? ''),
          branCd: String(raw.branCd ?? ''),
          branNm: String(raw.branNm ?? ''),
        };
      }).catch(() => null);

      if (firstPopupRow) {
        await frame.evaluate((row) => {
          const setValue = (selector, value) => {
            const el = document.querySelector(selector);
            if (!el) return;
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          };
          const makeAddr = window.makeAddr;
          const addr1 = typeof makeAddr === 'function'
            ? makeAddr(row.sidoNam, row.sigunguNam, row.dongRiNam, row.bunjiHo, '', row.roadNam, row.strcNum)
            : [row.sidoNam, row.sigunguNam, row.roadNam, row.strcNum].filter(Boolean).join(' ');
          setValue('#strRcvZipCd', row.bsiZonNo);
          setValue('#strRcvBldgCd', row.bldgCd);
          setValue('#strRcvCustAddr1', addr1);
          setValue('#strDlvBranCd', row.branCd);
          setValue('#strDlvBranNm', row.branNm);
        }, firstPopupRow).catch(() => {});
      }
      await sleep(Math.max(180, STEP_PAUSE_MS));
      addressApplied = await frame.evaluate(() => {
        const zip = document.querySelector('#strRcvZipCd')?.value || '';
        const bldg = document.querySelector('#strRcvBldgCd')?.value || '';
        const addr1 = document.querySelector('#strRcvCustAddr1')?.value || '';
        return !!zip && (!!bldg || !!addr1);
      }).catch(() => false);
      if (!addressApplied) throw new Error('Address was not applied after postal row double-click');
    }

    const popupHasDetailInput = await popupCtx.locator('#commAddr2').first().isVisible().catch(() => false);
    if (popupHasDetailInput) {
      console.log('[Live] Fill popup detail address + confirm...');
      await popupCtx.fill('#commAddr2', RECIPIENT_DETAIL).catch(() => {});

      // Ensure popup return payload exists; some IBSheet states open detail page without hddAddrObj.
      await popupCtx.evaluate(() => {
        const getTextLines = (cell) => (cell?.textContent || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
        const firstRow = document.querySelector('#popupModal .IBMain tbody tr, #popupModal table tbody tr');
        const cells = firstRow ? Array.from(firstRow.querySelectorAll('td')) : [];
        const line = (idx, n = 0) => {
          const lines = getTextLines(cells[idx]);
          return lines[n] || '';
        };
        const firstObjFromDom = cells.length >= 5 ? {
          bsiZonNo: line(0, 0),
          sidoNam: line(1, 0),
          sigunguNam: line(2, 0),
          roadNam: line(3, 0),
          dongRiNam: line(3, 1),
          strcNum: line(4, 0),
          bunjiHo: line(4, 1),
          bldgNm: line(5, 0),
          branNm: line(7, 0),
        } : null;

        const sheetRows = window.popGridSheet?.getDataRows?.() || [];
        const firstObjFromSheet = Array.isArray(sheetRows) && sheetRows.length ? sheetRows[0] : null;
        const raw = firstObjFromSheet || firstObjFromDom;
        if (!raw) return;

        const makeAddr = window.makeAddr;
        const addr1 = typeof makeAddr === 'function'
          ? makeAddr(
            String(raw.sidoNam ?? ''),
            String(raw.sigunguNam ?? ''),
            String(raw.dongRiNam ?? ''),
            String(raw.bunjiHo ?? ''),
            '',
            String(raw.roadNam ?? ''),
            String(raw.strcNum ?? ''),
          )
          : [raw.sidoNam, raw.sigunguNam, raw.roadNam, raw.strcNum].filter(Boolean).join(' ');

        const hddAddrObj = document.querySelector('#hddAddrObj');
        if (hddAddrObj && !hddAddrObj.value) {
          hddAddrObj.value = JSON.stringify(raw);
        }
        const hddAddr1 = document.querySelector('#hddAddr1');
        if (hddAddr1 && !hddAddr1.value) {
          hddAddr1.value = addr1;
        }
      }).catch(() => {});

      // Fast path: call confirm-return function first, then one quick click fallback.
      let popupClosed = await popupCtx.evaluate(() => {
        try {
          if (typeof window.fn_comm_addr_return === 'function') {
            window.fn_comm_addr_return();
          }
        } catch {}
        const popup = document.querySelector('#popupModal');
        if (!popup) return true;
        const st = window.getComputedStyle(popup);
        return st.display === 'none' || st.visibility === 'hidden';
      }).catch(() => false);

      if (!popupClosed) {
        await clickFirstVisible(popupCtx, [
          '#btnCommAddrConfim',
          '#popupModal button[onclick*="fn_comm_addr_return"]',
          '#popupModal .btn.base.w100.mt-3',
          '#popupModal button:has-text("확인")',
        ], 900);
        await popupCtx.evaluate(() => {
          try {
            if (typeof window.fn_comm_addr_return === 'function') {
              window.fn_comm_addr_return();
            }
          } catch {}
        }).catch(() => {});
        await sleep(Math.max(180, STEP_PAUSE_MS));
        popupClosed = !(await popupCtx.locator('#popupModal').first().isVisible().catch(() => false));
      }
      if (!popupClosed) {
        const forcedClosed = await popupCtx.evaluate((detail) => {
          const setValue = (selector, value) => {
            const el = document.querySelector(selector);
            if (!el) return;
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          };
          try {
            if (typeof window.fn_comm_addr_return === 'function') {
              window.fn_comm_addr_return();
            }
          } catch {}

          const getTextLines = (cell) => (cell?.textContent || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
          const firstRow = document.querySelector('#popupModal .IBMain tbody tr, #popupModal table tbody tr');
          const cells = firstRow ? Array.from(firstRow.querySelectorAll('td')) : [];
          if (cells.length >= 5) {
            const line = (idx, n = 0) => {
              const lines = getTextLines(cells[idx]);
              return lines[n] || '';
            };
            const row = {
              bsiZonNo: line(0, 0),
              sidoNam: line(1, 0),
              sigunguNam: line(2, 0),
              roadNam: line(3, 0),
              dongRiNam: line(3, 1),
              strcNum: line(4, 0),
              bunjiHo: line(4, 1),
              branNm: line(7, 0),
            };
            const makeAddr = window.makeAddr;
            const addr1 = typeof makeAddr === 'function'
              ? makeAddr(row.sidoNam, row.sigunguNam, row.dongRiNam, row.bunjiHo, '', row.roadNam, row.strcNum)
              : [row.sidoNam, row.sigunguNam, row.roadNam, row.strcNum].filter(Boolean).join(' ');
            setValue('#strRcvZipCd', row.bsiZonNo);
            setValue('#strRcvCustAddr1', addr1);
            if (row.branNm) setValue('#strDlvBranNm', row.branNm);
          }
          if (detail) setValue('#strRcvCustAddr2', detail);

          try {
            if (typeof window.fn_comm_popClose === 'function') {
              window.fn_comm_popClose();
            }
          } catch {}
          const popup = document.querySelector('#popupModal');
          if (popup) {
            popup.style.display = 'none';
            popup.style.visibility = 'hidden';
          }
          if (!popup) return true;
          const st = window.getComputedStyle(popup);
          return st.display === 'none' || st.visibility === 'hidden';
        }, RECIPIENT_DETAIL).catch(() => false);

        if (!forcedClosed) {
          const stillOpen = await popupCtx.locator('#popupModal').first().isVisible().catch(() => false);
          if (stillOpen) throw new Error('Detail address entered but confirm did not close popup');
        }
      }
    } else {
      console.log('[Live] Fill parent detail address...');
      await frame.fill('#strRcvCustAddr2', RECIPIENT_DETAIL).catch(() => {});
    }

    await frame.evaluate(() => {
      const cell = document.querySelector('#strRcvCustCellNo');
      if (!cell) return;
      cell.value = '';
      cell.dispatchEvent(new Event('input', { bubbles: true }));
      cell.dispatchEvent(new Event('change', { bubbles: true }));
    }).catch(() => {});

    const readyBeforeSave = await frame.evaluate(() => {
      const val = (sel) => (document.querySelector(sel)?.value || '').trim();
      return {
        tel: val('#strRcvCustTelNo'),
        name: val('#strRcvCustNm'),
        cell: val('#strRcvCustCellNo'),
        zip: val('#strRcvZipCd'),
        bldg: val('#strRcvBldgCd'),
        addr1: val('#strRcvCustAddr1'),
        addr2: val('#strRcvCustAddr2'),
      };
    }).catch(() => null);

    if (!readyBeforeSave || !readyBeforeSave.tel || !readyBeforeSave.name || !readyBeforeSave.zip || !readyBeforeSave.bldg || !readyBeforeSave.addr1 || !readyBeforeSave.addr2) {
      throw new Error(`Save precheck failed: ${JSON.stringify(readyBeforeSave)}`);
    }

    await sleep(700);

    console.log('[Live] Save step 1/4: 저장(F5)...');
    const savedByButton = await clickFirstVisible(page, [
      '.button-area button.btn.base.save[onclick*="fn_save"]',
      'button.btn.base.save[onclick*="fn_save"]',
      'button[onclick="fn_save()"]',
    ], 3000);
    if (!savedByButton) {
      const savedByFn = await page.evaluate(() => {
        if (typeof window.fn_save === 'function') {
          window.fn_save();
          return true;
        }
        return false;
      }).catch(() => false);
      if (!savedByFn) {
        await page.keyboard.press('F5').catch(() => {});
      }
    }

    await sleep(1200);

    console.log('[Live] Save step 2/4: 저장 확인 팝업 처리...');
    for (let i = 0; i < 14; i += 1) {
      await dismissSavePopups(page, frame);
      const closed = await waitUntilSavePopupsClosed(page, frame, 900);
      if (closed) break;
      await sleep(200);
    }
    const closedAfterSave = await waitUntilSavePopupsClosed(page, frame, 4000);
    if (!closedAfterSave) {
      throw new Error('Save confirm popup still open after save sequence');
    }

    console.log('[Live] Save step 3/4: 저장 이후 상태 재검증...');
    const postSaveState = await frame.evaluate(() => {
      const val = (sel) => (document.querySelector(sel)?.value || '').trim();
      return {
        tel: val('#strRcvCustTelNo'),
        name: val('#strRcvCustNm'),
        cell: val('#strRcvCustCellNo'),
        zip: val('#strRcvZipCd'),
        bldg: val('#strRcvBldgCd'),
        addr1: val('#strRcvCustAddr1'),
        addr2: val('#strRcvCustAddr2'),
      };
    }).catch(() => null);
    const formStillFilled = !!postSaveState?.tel && !!postSaveState?.name && !!postSaveState?.zip && !!postSaveState?.bldg && !!postSaveState?.addr1 && !!postSaveState?.addr2;
    const formResetAfterSave = !!postSaveState
      && !postSaveState.tel
      && !postSaveState.name
      && !postSaveState.cell
      && !postSaveState.zip
      && !postSaveState.bldg
      && !postSaveState.addr1
      && !postSaveState.addr2;
    if (!formStillFilled && !formResetAfterSave) {
      throw new Error(`Save postcheck failed: ${JSON.stringify(postSaveState)}`);
    }

    console.log('[Live] Save step 4/4: 완료, 이제 체크데이터 단계로 진행');
    await sleep(250);

    console.log('[Live] Print flow: 미출력 탭 + 전체 체크...');
    await clickFirstVisibleAny([frame, page], [
      'a:has-text("미출력")',
      'span:has-text("미출력")',
      'li:has-text("미출력")',
    ], 3000);
    await sleep(300);

    // Use page-native retrieval/filter path to ensure IBSheet rows are ready in noprint tab.
    await frame.evaluate(() => {
      try {
        if (typeof window.fn_retrieve === 'function') {
          window.fn_retrieve('noprint', 'btn');
        } else if (typeof window.fn_noPrint === 'function') {
          window.fn_noPrint();
        }
      } catch {}
    }).catch(() => {});
    await sleep(250);

    const apiReady = await waitForNoPrintRowsByApi(frame, 14000);
    console.log(`[Live] Print flow(api): rows=${apiReady.rowCount}, checked=${apiReady.checkedCount}`);

    const gridReady = await waitForUnprintedGridReady(page, frame, 12000);
    console.log(`[Live] Print flow: grid ready rows=${gridReady.rowCount}, cbs=${gridReady.checkboxCount}`);
    await sleep(180);

    // Do not touch 관내우선 utility checkbox; it can switch list context and break CheckData selection.
    await sleep(180);

    const rowFocused = await focusFirstUnprintedRow(page, frame);
    console.log(`[Live] Print flow: 첫 행 선택 ${rowFocused ? '성공' : '실패'}`);
    await sleep(250);

    let allChecked = false;
    let checkedState = { rowCount: 0, checkboxCount: 0, checkedCount: 0 };
    let checkedByApi = 0;
    for (let i = 0; i < 3; i += 1) {
      const apiSelected = await selectNoPrintRowsByApi(frame);
      checkedByApi = Math.max(checkedByApi, apiSelected.checkedCount || 0);
      console.log(`[Live] Print flow: CheckData attempt#${i + 1} api ok=${apiSelected.ok} checked=${apiSelected.checkedCount} reason=${apiSelected.reason}`);
      if (apiSelected.ok) {
        checkedState = {
          rowCount: apiSelected.rowCount,
          checkboxCount: Math.max(checkedState.checkboxCount, apiSelected.rowCount),
          checkedCount: apiSelected.checkedCount,
        };
        allChecked = true;
        break;
      }

      allChecked = await checkAllUnprintedOrders(page, frame);
      await sleep(220);
      const apiAfterDom = await waitForNoPrintRowsByApi(frame, 2500);
      checkedByApi = Math.max(checkedByApi, apiAfterDom.checkedCount || 0);
      checkedState = await getUnprintedGridState(page, frame);
      if (checkedByApi > 0 || checkedState.checkedCount > 0) {
        allChecked = true;
        break;
      }
      await waitForUnprintedGridReady(page, frame, 2500);
      await focusFirstUnprintedRow(page, frame);
    }
    const effectiveChecked = Math.max(checkedByApi, checkedState.checkedCount);
    console.log(`[Live] Print flow: 전체 체크 ${allChecked ? '성공' : '실패'}, checkedRows(api/dom)=${checkedByApi}/${checkedState.checkedCount}`);
    if (effectiveChecked === 0) {
      throw new Error('미출력 체크가 적용되지 않아 운송장출력 진행 중단');
    }
    await sleep(260);

    console.log('[Live] Print flow: 운송장출력...');
    const printClicked = await clickFirstVisibleAny([frame, page], [
      'button:has-text("운송장출력")',
      'a:has-text("운송장출력")',
      'input[type="button"][value*="운송장출력"]',
    ], 4000);
    if (!printClicked) {
      await page.evaluate(() => {
        if (typeof window.fn_printPop === 'function') {
          window.fn_printPop();
        }
      }).catch(() => {});
    }

    await sleep(1200);
    await clickFirstVisibleAny([frame, page], [
      '#popupModal button:has-text("운송장출력")',
      '#popupModal a:has-text("운송장출력")',
      'button:has-text("운송장출력")',
      'input[type="button"][value*="운송장출력"]',
    ], 2000);
    await sleep(500);
    await clickFirstVisibleAny([frame, page], [
      '#popupModal button:has-text("예")',
      'button:has-text("예")',
      'input[type="button"][value="예"]',
      'button:has-text("확인")',
    ], 2000);
    await sleep(1000);

    const state = await frame.evaluate(() => ({
      tel: document.querySelector('#strRcvCustTelNo')?.value || '',
      cell: document.querySelector('#strRcvCustCellNo')?.value || '',
      name: document.querySelector('#strRcvCustNm')?.value || '',
      zip: document.querySelector('#strRcvZipCd')?.value || '',
      bldgCd: document.querySelector('#strRcvBldgCd')?.value || '',
      addr1: document.querySelector('#strRcvCustAddr1')?.value || '',
      addr2: document.querySelector('#strRcvCustAddr2')?.value || '',
      branCd: document.querySelector('#strDlvBranCd')?.value || '',
      branNm: document.querySelector('#strDlvBranNm')?.value || '',
      multiPopupVisible: (() => {
        const popup = document.querySelector('#popupModal_MultiCust');
        if (!popup) return false;
        const style = window.getComputedStyle(popup);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })(),
    }));

    console.log('[Live] Final recipient state:', JSON.stringify(state, null, 2));
    console.log('[Live] Keep browser open for manual check. Close window when done.');

    await page.waitForTimeout(1000 * 60 * 20);
  } catch (error) {
    failed = true;
    console.error('[Live] Failed:', error);
    console.log('[Live] Browser kept open for debugging (20 min).');
    await page.waitForTimeout(1000 * 60 * 20);
  } finally {
    if (!failed) {
      await browser.close().catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error('[Live] Failed:', error);
  process.exit(1);
});
