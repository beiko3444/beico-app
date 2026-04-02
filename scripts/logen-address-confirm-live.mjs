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

async function waitUntilSavePopupsClosed(page, timeoutMs = 7000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const open = await page.evaluate(() => {
      const isVisible = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const st = window.getComputedStyle(el);
        return st.display !== 'none' && st.visibility !== 'hidden';
      };
      return isVisible('#popupModal1') || isVisible('#popupModal') || isVisible('#popupModal_MultiCust');
    }).catch(() => false);
    if (!open) return true;
    await sleep(140);
  }
  return false;
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
    }, label).catch(() => false);
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

async function checkAllUnprintedOrders(page, frame) {
  const contexts = [frame, page];

  // 0) Strict grid header checkbox first
  const headerChecked = await clickGridHeaderAllCheckbox(page, frame);
  if (headerChecked) return true;

  // 1) Prefer DOM "전체" checkbox click
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

  // 2) IBSheet API fallback
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

  // 3) CSS fallback
  const checked = await clickFirstVisibleAny(contexts, [
    'th:has-text("전체") input[type="checkbox"]',
    'td:has-text("전체") input[type="checkbox"]',
    'label:has-text("전체") input[type="checkbox"]',
    'table tbody tr input[type="checkbox"]',
    'input[type="checkbox"][name*="chk"]',
    'input[type="checkbox"]',
  ], 3000);
  if (checked) return true;

  // 4) Force first-row checkbox only (row print fallback)
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

    let popupInFrame = false;
    let popupInPage = false;
    for (let i = 0; i < 12; i += 1) {
      popupInFrame = await frame.locator('#popupModal').first().isVisible().catch(() => false);
      popupInPage = popupInFrame ? false : await page.locator('#popupModal').first().isVisible().catch(() => false);
      if (popupInFrame || popupInPage) break;
      await sleep(250);
    }
    const popupCtx = popupInFrame ? frame : (popupInPage ? page : frame);
    const popupCtxName = popupInFrame ? 'frame' : (popupInPage ? 'page' : 'frame(default)');
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

    await sleep(1200);

    console.log('[Live] Save...');
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

    await sleep(1500);

    await clickFirstVisible(frame, [
      '#btn-popupModal1',
      '#popupModal1 button.btn.base.close',
      '#popupModal1 button',
    ], 1200);

    for (let i = 0; i < 8; i += 1) {
      const resolved = await resolveMultiCustomerPopup(frame);
      if (!resolved) break;
      console.log('[Live] Multi-customer popup resolved (first row + select).');
      await sleep(800);
    }

    await waitUntilSavePopupsClosed(page, 8000);
    await sleep(250);

    console.log('[Live] Print flow: 미출력 탭 + 전체 체크...');
    await clickFirstVisibleAny([frame, page], [
      'a:has-text("미출력")',
      'span:has-text("미출력")',
      'li:has-text("미출력")',
    ], 3000);
    await sleep(300);

    const gridReady = await waitForUnprintedGridReady(page, frame, 12000);
    console.log(`[Live] Print flow: grid ready rows=${gridReady.rowCount}, cbs=${gridReady.checkboxCount}`);
    await sleep(180);

    const utilityChecked = await clickUtilityCheckboxNearLabel(page, frame, '관내우선');
    console.log(`[Live] Print flow: 우측 체크박스 ${utilityChecked ? '성공' : '실패/없음'}`);
    await sleep(180);

    const rowFocused = await focusFirstUnprintedRow(page, frame);
    console.log(`[Live] Print flow: 첫 행 선택 ${rowFocused ? '성공' : '실패'}`);
    await sleep(250);

    let allChecked = false;
    let checkedState = { rowCount: 0, checkboxCount: 0, checkedCount: 0 };
    for (let i = 0; i < 3; i += 1) {
      allChecked = await checkAllUnprintedOrders(page, frame);
      await sleep(220);
      checkedState = await getUnprintedGridState(page, frame);
      if (checkedState.checkedCount > 0) break;
      await waitForUnprintedGridReady(page, frame, 2500);
      await focusFirstUnprintedRow(page, frame);
    }
    console.log(`[Live] Print flow: 전체 체크 ${allChecked ? '성공' : '실패'}, checkedRows=${checkedState.checkedCount}`);
    if (checkedState.checkedCount === 0) {
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
