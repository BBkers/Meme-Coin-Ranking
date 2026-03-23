  import express from "express";
  import http from "http";
  import cors from "cors";
  import axios from "axios";
  import Redis from "ioredis";
  import { WebSocketServer } from "ws";
  
  if (process.env.NODE_ENV !== "production") {
    const dotenv = await import("dotenv");
    dotenv.config();
  }
  
  console.log(process.env.TELEGRAM_BOT_TOKEN);

  const redis = new Redis(process.env.REDIS_URL);
  
  const app = express();
  app.use(cors());
  
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  
  const DEX_URL = "https://api.dexscreener.com/latest/dex/search?q=raydium";
  
  async function fetchPairs() {
    const res = await axios.get(DEX_URL);
    return res.data.pairs || [];
  }
  
  function score(c) {
    return c.volume * 0.4 + c.liquidity * 0.3 + c.change * 0.3;
  }
  
  function processPairs(pairs) {
    return pairs
      .map(p => ({
        name: p.baseToken.name,
        symbol: p.baseToken.symbol,
        price: Number(p.priceUsd),
        volume: p.volume.h24,
        liquidity: p.liquidity.usd,
        change: p.priceChange.h24
      }))
      .filter(c => c.volume > 50000 && c.liquidity > 20000)
      .map(c => ({ ...c, score: score(c) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
  }
  
  async function sendTelegram(message) {
    if (!process.env.TELEGRAM_BOT_TOKEN) return;
  
    await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message
      }
    );
  }
  
  async function tick() {
    let cached = await redis.get("coins");
    let coins;
  
    if (cached) {
      coins = JSON.parse(cached);
    } else {
      const pairs = await fetchPairs();
      coins = processPairs(pairs);
      await redis.set("coins", JSON.stringify(coins), "EX", 10);
    }
  
    // Broadcast via WebSocket
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(coins));
      }
    });
  
    // Simple pump alert
    if (coins[0] && coins[0].change > 20) {
      await sendTelegram(`🚨 Pump detected: ${coins[0].symbol}`);
    }
  }
  
  setInterval(tick, 10000);
  
  app.get("/", (req, res) => {
    res.send("Backend running (ESM)");
  });
  
  server.listen(4000, () => {
    console.log("✅ Backend running on port 4000 (ESM)");
  });
  
  