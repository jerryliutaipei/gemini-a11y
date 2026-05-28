# Gemini 選擇器參考表

實地抓取於 gemini.google.com/app（2026-05-28，登入 Pro 帳號）

## 1. 開選單的 JS 觸發法

Gemini 的選單按鈕（gem-icon-button、bard-mode-menu-button）**對 JS .click() 無反應**，必須：

```js
btn.focus();
btn.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
```

選單內的項目對普通 JS `.click()` 有反應，不必再用鍵盤觸發。

## 2. Ctrl+Alt+U 上傳檔案

**主錨點：**
```js
const trigger = document.querySelector('button[aria-label="上傳與工具"]');
// focus + Enter 開選單
// 然後：
const uploadBtn = document.querySelector('button[data-test-id="local-images-files-uploader-button"]');
uploadBtn.click();
```

也可以直接觸發隱藏 file input（待測試是否可省略開選單步驟）：
```js
document.querySelector('button[data-test-id="hidden-local-file-upload-button"]')
```

## 3. Ctrl+Alt+T 工具/模式循環

**5 個模式的 fonticon：**

| 模式 | fonticon | 位置 |
|---|---|---|
| 建立圖像 | `image_create` | 主選單 |
| 建立影片 | `movie` | 主選單 |
| Canvas | `canvas` | 主選單 |
| Deep Research | `deep_research` | 主選單 |
| 創作音樂 | `music` | 「更多工具」子選單 |

**選擇器：**
```js
// 主選單模式：
Array.from(document.querySelectorAll('.cdk-overlay-pane button'))
  .find(b => b.querySelector('mat-icon')?.getAttribute('fonticon') === '<fonticon>');

// 更多工具按鈕：
document.querySelector('button[data-test-id="more-tools-button"]');
```

**重要行為：**
- 進入某模式後，+ 選單就**不再顯示其他模式選項**
- 切換模式前必須先取消當前模式
- 切換流程：取消舊模式 → 開 + 選單 → 點新模式（若為創作音樂則先點「更多工具」展開子選單）

## 4. 模式狀態 chip（取消模式 + 偵測當前模式）

```js
const chip = document.querySelector('gem-button[data-test-id="deselect-drawer-item-gem-button"]');
// 存在 = 當前在某個模式
// 取得當前模式：
const fonticon = chip?.querySelector('mat-icon')?.getAttribute('fonticon');
// fonticon 對應：image_create=圖像、movie=影片、canvas=Canvas、deep_research=Deep Research、music=創作音樂

// 取消模式：
chip?.querySelector('button').click();
```

`aria-label="取消選取「圖片」"` 也能反向取得模式中文名。

## 5. Ctrl+Alt+M 模型循環

**錨點按鈕：** `button[data-test-id="bard-mode-menu-button"]`
- 文字 = 當前模型短名（"Flash"、"Pro" 等）
- `aria-label` = `開啟模式挑選器，目前為「Flash」模式`

**選單項目：** `[data-test-id^="bard-mode-option-"]`
- data-test-id 含 hash（不穩），用 **textContent 文字匹配**：

| 模型 | 文字判斷 |
|---|---|
| Flash-Lite | textContent 含 `Flash-Lite` |
| Flash | textContent 含 `Flash` 且不含 `Flash-Lite` |
| Pro | textContent 含 `Pro` |

**當前模型偵測：** `classList.contains('selected')` 或含 `mat-icon[fonticon="check"]`

## 6. Ctrl+Alt+E 努力程度（思考程度）循環

**進入路徑：** 開模型選單 → 找「思考程度」menuitem → 點擊展開子選單 → 點選目標

```js
// 在 model menu 開啟狀態下：
const thinkingTrigger = Array.from(document.querySelectorAll('.cdk-overlay-pane [role="menuitem"]'))
  .find(el => el.textContent.includes('思考程度'));
thinkingTrigger.click();
// 等子選單出現，子選單在新的 .cdk-overlay-pane 裡：
const items = Array.from(document.querySelectorAll('.cdk-overlay-pane [role="menuitem"]'));
const standard = items.find(el => el.textContent.includes('標準'));
const extended = items.find(el => el.textContent.includes('延長'));
```

**「思考程度」menuitem 自身的 text** = `"思考程度 標準"`（label + 當前值）
→ 可從中切出當前值

## 7. Ctrl+Alt+Q 狀態讀取

| 狀態 | 來源 |
|---|---|
| 當前模型 | `button[data-test-id="bard-mode-menu-button"]` textContent → "Flash" |
| 當前工具模式 | chip 存在性 + chip fonticon → 模式中文名（不存在則為「純文字」） |
| 當前思考程度 | **DOM 沒有持續顯示，需快取**（GM_setValue 存最後設定值，預設「標準」） |

朗讀格式建議：
> 「當前模型：Flash，思考程度：標準，工具模式：純文字」

## 8. SPA 路由與 DOM 變動

Gemini 是 Angular SPA，按 N（新對話）後 URL 變動但 DOM 部分重建：
- `gemini.google.com/app` → 首頁
- `gemini.google.com/app/<chat-id>` → 對話頁

腳本要用 `MutationObserver` 監聽 body，或在 `location.href` 變動時重新綁定。
所有錨點按鈕（+、模型）都會在新對話建立後重新出現。

## 9. 失效訊息

任何選擇器找不到時，aria-live 朗讀：
> 「可能 Gemini 改版，請聯絡 Bob」
