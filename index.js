const express = require('express');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000; // Render 會使用環境變數的 PORT

// --- OpenAI 設定 ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- 靜態檔案託管 ---
// 確保這行在所有 API 路由之前
app.use(express.static(path.join(__dirname, 'public')));

// --- 中介軟體 ---
app.use(express.json());

// --- API 路由 ---

// 讀取酒單的邏輯只在需要時執行一次
let menu = [];
let menuText = '';
try {
  const menuPath = path.join(__dirname, 'menu.json');
  const menuJson = fs.readFileSync(menuPath, 'utf8');
  menu = JSON.parse(menuJson);
  menuText = JSON.stringify(menu, null, 2);
} catch (error) {
  console.error('讀取酒單時發生致命錯誤:', error);
  process.exit(1); 
}

// 酒單 API
app.get('/api/menu', (req, res) => {
  res.json(menu);
});

// 聊天 API
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: '缺少訊息內容' });
  }

  try {
    const systemPrompt = `
你是一位友善且知識淵博的酒吧侍酒師。你的名字是 "Aidy"。
你的任務是根據客人喜好，從以下的酒單中為他推薦最適合的酒，並像朋友一樣與他聊天。
你的對話風格應該要輕鬆、口語化，可以適度使用 emoji。
你的知識庫就是這份 JSON 格式的酒單：
\`\`\`json
${menuText}
\`\`\`
對話指南：
1.  主動問候並詢問客人喜歡什麼樣的口味（例如：酸、甜、烈、清爽、果香、藥草等）。
2.  根據客人的回答，從酒單中尋找符合 'tags' 或 'description' 的酒款。
3.  一次推薦 1-2 款酒，並用自己的話簡單介紹它們的特色，不要只是背誦酒單描述。
4.  如果客人猶豫不決，可以再追問更細節的偏好，例如「那你比較喜歡用哪種基酒的呢？像是琴酒還是威士忌？」
5.  如果客人點的酒不在酒單上，要委婉地告知，並推薦酒單上風味類似的品項。
6.  最終目標是引導客人說出「好，那我要一杯ＸＸＸ」，完成點單。
7.  保持對話簡短、親切，就像在跟朋友聊天。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    res.json({ reply: completion.choices[0].message.content });

  } catch (error) {
    console.error('與 OpenAI API 通訊時發生錯誤:', error);
    res.status(500).json({ error: 'AI 暫時無法回應，請稍後再試' });
  }
});

// --- 伺服器啟動 ---
app.listen(PORT, () => {
  console.log(`伺服器正在 http://localhost:${PORT} 上運行`);
}); 