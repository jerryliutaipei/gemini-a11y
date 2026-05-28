# Gemini Accessibility Shortcuts

為 NVDA 螢幕閱讀器使用者打造的 Tampermonkey 用戶腳本，
讓視障使用者能用 5 個 `Ctrl+Alt+X` 快捷鍵快速操作 Gemini（[gemini.google.com](https://gemini.google.com)）。

## 安裝

1. 在 Chrome 安裝 [Tampermonkey 擴充功能](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. 點下方安裝連結，Tampermonkey 會自動跳出安裝畫面：

   👉 **[gemini-a11y.user.js](https://raw.githubusercontent.com/jerryliutaipei/gemini-a11y/main/gemini-a11y.user.js)**

3. 點「Install」/「安裝」即可。
4. 打開 [gemini.google.com](https://gemini.google.com)，按 `Ctrl+Alt+Q`，
   NVDA 應該朗讀「當前模型：Flash、努力程度：標準、工具模式：純文字」。

之後每次有新版，Tampermonkey 會自動拉新版（預設每 24 小時檢查一次）。

## 快捷鍵清單

| 快捷鍵 | 動作 |
|---|---|
| `Ctrl+Alt+U` | **U**pload 上傳檔案 |
| `Ctrl+Alt+T` | **T**ool 工具/模式循環：建立圖像 → 建立影片 → Canvas → Deep Research → 創作音樂 → 純文字 → 循環 |
| `Ctrl+Alt+M` | **M**odel 模型循環：Flash-Lite → Flash → Pro → 循環 |
| `Ctrl+Alt+E` | **E**ffort 努力程度循環：標準 → 延長 → 循環 |
| `Ctrl+Alt+Q` | **Q**uery 朗讀當前狀態 |

按下後 NVDA 會自動朗讀「已切換為 OOO」，聽到要的就停。

## 失效訊息

如果 Gemini 改版導致按鍵失效，腳本會朗讀：

> 可能 Gemini 改版，請聯絡 Bob

## 架構

腳本分三層，方便未來加 Claude / ChatGPT / YouTube 等網站：

- **框架層**（跨站可重用）：aria-live 朗讀器、選單觸發、等待工具
- **站點層**（`GEMINI_SITE`）：所有 Gemini 特定選擇器與邏輯集中於此
- **動作層**：5 個動作呼叫站點層

要加新站，複製 `GEMINI_SITE` 物件改成 `CLAUDE_SITE` / `CHATGPT_SITE` 等，再加 `@match` 行即可。

## 選擇器參考

詳見 [SELECTORS.md](./SELECTORS.md)，記錄了所有 Gemini DOM 錨點與 fallback 策略，方便未來 Gemini 改版時對照修補。

## 更新方法（維護者）

```bash
# 1. 改完程式碼
# 2. 把 @version 數字往上加（0.1.0 → 0.1.1）
# 3. push 到 main
git add gemini-a11y.user.js
git commit -m "fix: ..."
git push
```

Tampermonkey 端會在 24 小時內自動拉新版，Alice 完全無感升級。
若需立即更新，可在 Tampermonkey 儀表板手動觸發「Check for updates」。

## License

MIT
