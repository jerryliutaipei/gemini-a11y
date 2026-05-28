// ==UserScript==
// @name         Gemini Accessibility Shortcuts (for Alice)
// @namespace    https://github.com/jerryliutaipei/gemini-a11y
// @version      0.1.1
// @description  Ctrl+Alt 快捷鍵讓 NVDA 使用者快速操作 Gemini：U 上傳 / T 工具循環 / M 模型循環 / E 努力程度 / Q 朗讀狀態
// @author       Bob
// @match        https://gemini.google.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @homepageURL  https://github.com/jerryliutaipei/gemini-a11y
// @supportURL   https://github.com/jerryliutaipei/gemini-a11y/issues
// @updateURL    https://raw.githubusercontent.com/jerryliutaipei/gemini-a11y/main/gemini-a11y.user.js
// @downloadURL  https://raw.githubusercontent.com/jerryliutaipei/gemini-a11y/main/gemini-a11y.user.js
// ==/UserScript==

/*
 * 架構說明（為未來擴充 Claude / ChatGPT / YouTube 準備）：
 *
 *   ┌─────────────────────────────────────────────────┐
 *   │ [框架層] 不含任何 Gemini 字串，可重用：              │
 *   │   - createAnnouncer()  aria-live 朗讀器           │
 *   │   - openCdkMenu()      Angular CDK 選單開啟       │
 *   │   - waitFor()          通用等待                   │
 *   │   - sleep()            等待                       │
 *   └─────────────────────────────────────────────────┘
 *                          ↓ 由站點層注入
 *   ┌─────────────────────────────────────────────────┐
 *   │ [站點層] GEMINI_SITE：所有 Gemini 特定邏輯集中    │
 *   │   選擇器、循環順序、狀態讀取、失效訊息            │
 *   │   未來加 Claude，就複製這層改成 CLAUDE_SITE       │
 *   └─────────────────────────────────────────────────┘
 *                          ↓
 *   ┌─────────────────────────────────────────────────┐
 *   │ [動作層] 5 個動作呼叫站點層                       │
 *   │   actionUpload / actionCycleMode / actionCycleModel │
 *   │   actionCycleEffort / actionQueryState           │
 *   └─────────────────────────────────────────────────┘
 *                          ↓
 *   ┌─────────────────────────────────────────────────┐
 *   │ [分派層] Ctrl+Alt+X 鍵盤事件路由                  │
 *   └─────────────────────────────────────────────────┘
 */

(function () {
  'use strict';

  // =====================================================
  // [框架層] 跨站可重用工具
  // =====================================================

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** 建立 aria-live 朗讀容器（讓 NVDA 自動讀出訊息） */
  function createAnnouncer() {
    const ID = 'a11y-shortcuts-live';
    function ensureLive() {
      let live = document.getElementById(ID);
      if (!live) {
        live = document.createElement('div');
        live.id = ID;
        live.setAttribute('aria-live', 'polite');
        live.setAttribute('aria-atomic', 'true');
        live.setAttribute('role', 'status');
        // visually hidden
        live.style.cssText =
          'position:absolute;width:1px;height:1px;padding:0;margin:-1px;' +
          'overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
        document.body.appendChild(live);
      }
      return live;
    }
    return {
      announce(msg) {
        const live = ensureLive();
        // 清空再填，確保 NVDA 偵測為新訊息
        live.textContent = '';
        setTimeout(() => {
          live.textContent = msg;
        }, 50);
      },
    };
  }

  /**
   * 開啟 Angular CDK 選單。
   * 實測 (2026-05-28)：直接 .click() 即可——但要在「沒有其他選單開啟」的狀態下。
   * 若已有選單開啟、click 會關閉而非切換，故呼叫前需先確保乾淨狀態。
   */
  function openCdkMenu(trigger) {
    if (!trigger) return false;
    trigger.click();
    return true;
  }

  /** 等待選單浮層出現 */
  async function waitForPane(timeout = 1500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (document.querySelector('.cdk-overlay-pane')) return true;
      await sleep(50);
    }
    return false;
  }

  /** 等待某條件成立（回傳結果），逾時回 null */
  async function waitFor(getter, timeout = 1500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = getter();
      if (result) return result;
      await sleep(50);
    }
    return null;
  }

  /** 關閉所有開啟的 CDK 選單 */
  function closeMenus() {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true,
      })
    );
  }

  // =====================================================
  // [站點層] Gemini 特定設定（未來其他站複製此物件改寫）
  // =====================================================

  const GEMINI_SITE = {
    match: 'gemini.google.com',
    failureMessage: '可能 Gemini 改版，請聯絡 Bob',

    /** 工具模式循環（按 Ctrl+Alt+T） */
    modeCycle: [
      { key: 'image_create',  label: '建立圖像',      inMoreTools: false },
      { key: 'movie',         label: '建立影片',      inMoreTools: false },
      { key: 'canvas',        label: 'Canvas',       inMoreTools: false },
      { key: 'deep_research', label: 'Deep Research', inMoreTools: false },
      { key: 'music',         label: '創作音樂',      inMoreTools: true  },
      { key: null,            label: '純文字',        inMoreTools: false },
    ],

    /** 模型循環（按 Ctrl+Alt+M） */
    modelCycle: [
      {
        label: 'Flash-Lite',
        match: (text) => text.includes('Flash-Lite'),
      },
      {
        label: 'Flash',
        match: (text) => text.includes('Flash') && !text.includes('Flash-Lite'),
      },
      {
        label: 'Pro',
        match: (text) => /\bPro\b/.test(text),
      },
    ],

    /** 努力程度循環（按 Ctrl+Alt+E） */
    effortCycle: [
      { label: '標準', match: '標準' },
      { label: '延長', match: '延長' },
    ],

    // ----- DOM 錨點 -----
    getPlusButton: () =>
      document.querySelector('button[aria-label="上傳與工具"]'),

    getModelMenuButton: () =>
      document.querySelector('button[data-test-id="bard-mode-menu-button"]'),

    getUploadButton: () =>
      document.querySelector('button[data-test-id="local-images-files-uploader-button"]'),

    getMoreToolsButton: () =>
      document.querySelector('button[data-test-id="more-tools-button"]'),

    getCurrentModeChip: () =>
      document.querySelector('gem-button[data-test-id="deselect-drawer-item-gem-button"]'),

    /** 在已開啟的選單裡找模式按鈕（用 mat-icon fonticon 識別） */
    findModeButtonByFonticon: (fonticon) =>
      Array.from(document.querySelectorAll('.cdk-overlay-pane button')).find(
        (b) => b.querySelector('mat-icon')?.getAttribute('fonticon') === fonticon
      ),

    /** 在已開啟的模型選單裡找模型項目（用 textContent 匹配） */
    findModelOptionByMatcher: (matchFn) =>
      Array.from(
        document.querySelectorAll('[data-test-id^="bard-mode-option-"]')
      ).find((el) => matchFn((el.textContent || '').trim())),

    /** 找「思考程度」menuitem 觸發子選單 */
    findThinkingTrigger: () =>
      Array.from(
        document.querySelectorAll('.cdk-overlay-pane [role="menuitem"]')
      ).find((el) => (el.textContent || '').includes('思考程度')),

    /** 在思考程度子選單裡找選項 */
    findEffortOption: (matchText) =>
      Array.from(
        document.querySelectorAll('.cdk-overlay-pane [role="menuitem"]')
      )
        .filter((el) => !((el.textContent || '').includes('思考程度')))
        .find((el) => (el.textContent || '').includes(matchText)),

    // ----- 狀態讀取 -----

    /** 當前工具模式 fonticon（null 表示純文字） */
    getCurrentModeKey() {
      const chip = this.getCurrentModeChip();
      return chip?.querySelector('mat-icon')?.getAttribute('fonticon') || null;
    },

    /** 當前模式的中文 label */
    getCurrentModeLabel() {
      const key = this.getCurrentModeKey();
      if (key === null) return '純文字';
      return this.modeCycle.find((m) => m.key === key)?.label || '未知模式';
    },

    /**
     * 當前模型 label。
     * Gemini 在努力程度為「延長」時，aria-label 會變成「目前為「Flash 延長」模式」，
     * 直接取「」內整段會把努力程度也吃進來。改用 modelCycle 的 match function
     * 反推（與 actionCycleModel 同一條邏輯），確保 Q 朗讀不重複講「延長」。
     */
    getCurrentModel() {
      const btn = this.getModelMenuButton();
      const aria = btn?.getAttribute('aria-label') || '';
      const m = aria.match(/「(.+?)」/);
      const raw = m ? m[1] : (btn?.textContent || '').trim();
      // 反查 modelCycle，找到匹配的乾淨 label
      const hit = this.modelCycle.find((mc) => mc.match(raw));
      return hit ? hit.label : (raw || '未知');
    },

    /** 努力程度從快取讀（DOM 無持續顯示） */
    getCurrentEffort() {
      try {
        return GM_getValue('gemini.lastEffort', '標準');
      } catch (_) {
        return '標準';
      }
    },

    setCurrentEffort(label) {
      try {
        GM_setValue('gemini.lastEffort', label);
      } catch (_) {}
    },
  };

  // =====================================================
  // [動作層] 5 個動作
  // =====================================================

  const A = GEMINI_SITE;
  const announcer = createAnnouncer();
  const announce = (m) => announcer.announce(m);
  const fail = () => announce(A.failureMessage);

  // --- Ctrl+Alt+U 上傳檔案 ---
  async function actionUpload() {
    const plus = A.getPlusButton();
    if (!plus) return fail();
    openCdkMenu(plus);
    if (!(await waitForPane())) return fail();
    await sleep(120);
    const upload = await waitFor(() => A.getUploadButton(), 800);
    if (!upload) {
      closeMenus();
      return fail();
    }
    upload.click();
    announce('開啟上傳檔案視窗');
  }

  // --- Ctrl+Alt+T 工具/模式循環 ---
  async function actionCycleMode() {
    const currentKey = A.getCurrentModeKey();
    const cycle = A.modeCycle;
    let nextIdx;
    if (currentKey === null) {
      nextIdx = 0;
    } else {
      const idx = cycle.findIndex((m) => m.key === currentKey);
      nextIdx = (idx + 1) % cycle.length;
    }
    const next = cycle[nextIdx];

    // 1) 取消舊模式（若有）
    if (currentKey !== null) {
      const chip = A.getCurrentModeChip();
      const cancelBtn = chip?.querySelector('button');
      if (cancelBtn) {
        cancelBtn.click();
        await sleep(250);
      }
    }

    // 2) 若下一站是「純文字」，已取消即完成
    if (next.key === null) {
      announce(`已切換為${next.label}`);
      return;
    }

    // 3) 開 + 選單
    const plus = A.getPlusButton();
    if (!plus) return fail();
    openCdkMenu(plus);
    if (!(await waitForPane())) return fail();
    await sleep(150);

    // 4) 若需要打開「更多工具」子選單
    if (next.inMoreTools) {
      const moreBtn = A.getMoreToolsButton();
      if (!moreBtn) {
        closeMenus();
        return fail();
      }
      moreBtn.click();
      await sleep(250);
    }

    // 5) 點目標模式
    const target = await waitFor(() => A.findModeButtonByFonticon(next.key), 800);
    if (!target) {
      closeMenus();
      return fail();
    }
    target.click();
    announce(`已切換為${next.label}`);
  }

  // --- Ctrl+Alt+M 模型循環 ---
  async function actionCycleModel() {
    const currentModel = A.getCurrentModel();
    const cycle = A.modelCycle;
    // 用 match function 而非 label 嚴格比對，因為 aria-label 可能含「延長」等後綴
    const idx = cycle.findIndex((m) => m.match(currentModel));
    const nextIdx = idx === -1 ? 0 : (idx + 1) % cycle.length;
    const next = cycle[nextIdx];

    const modelBtn = A.getModelMenuButton();
    if (!modelBtn) return fail();
    openCdkMenu(modelBtn);
    if (!(await waitForPane())) return fail();
    await sleep(150);

    const target = await waitFor(() => A.findModelOptionByMatcher(next.match), 800);
    if (!target) {
      closeMenus();
      return fail();
    }
    target.click();
    announce(`已切換為${next.label}`);
  }

  // --- Ctrl+Alt+E 努力程度循環 ---
  async function actionCycleEffort() {
    const currentEffort = A.getCurrentEffort();
    const cycle = A.effortCycle;
    const idx = cycle.findIndex((e) => e.label === currentEffort);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % cycle.length;
    const next = cycle[nextIdx];

    const modelBtn = A.getModelMenuButton();
    if (!modelBtn) return fail();
    openCdkMenu(modelBtn);
    if (!(await waitForPane())) return fail();
    await sleep(150);

    const thinking = A.findThinkingTrigger();
    if (!thinking) {
      closeMenus();
      return fail();
    }
    thinking.click();
    await sleep(250);

    const target = await waitFor(() => A.findEffortOption(next.match), 800);
    if (!target) {
      closeMenus();
      return fail();
    }
    target.click();
    A.setCurrentEffort(next.label);
    announce(`已切換努力程度：${next.label}`);
  }

  // --- Ctrl+Alt+Q 朗讀當前狀態 ---
  function actionQueryState() {
    const model = A.getCurrentModel();
    const effort = A.getCurrentEffort();
    const mode = A.getCurrentModeLabel();
    announce(`當前模型：${model}，努力程度：${effort}，工具模式：${mode}`);
  }

  // =====================================================
  // [分派層] Ctrl+Alt+X 鍵盤事件
  // =====================================================

  const ACTIONS = {
    u: actionUpload,
    t: actionCycleMode,
    m: actionCycleModel,
    e: actionCycleEffort,
    q: actionQueryState,
  };

  document.addEventListener(
    'keydown',
    (e) => {
      // 必須 Ctrl + Alt，不能有 Shift 或 Meta（避免衝突）
      if (!e.ctrlKey || !e.altKey || e.shiftKey || e.metaKey) return;
      const key = (e.key || '').toLowerCase();
      const action = ACTIONS[key];
      if (!action) return;

      e.preventDefault();
      e.stopPropagation();

      Promise.resolve()
        .then(() => action())
        .catch((err) => {
          console.error('[Gemini-a11y] Action error:', err);
          announce(A.failureMessage);
        });
    },
    true
  );

  console.log(
    '[Gemini-a11y v0.1.0] Loaded. Ctrl+Alt + U(上傳) / T(工具) / M(模型) / E(努力) / Q(狀態)'
  );
})();
