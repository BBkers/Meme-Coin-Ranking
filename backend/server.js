
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const Redis = require("ioredis");
const axios = require("axios");
const { WebSocketServer } = require("ws");

const redis = new Redis(process.env.REDIS_URL);
const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

async function fetchPairs() {
  const res = await axios.get("https://api.dexscreener.com/latest/dex/pairs/solana");
  return res.data.pairs || [];
}

function score(c) {
  return c.volume * 0.4 + c.liquidity * 0.3 + c.change * 0.3;
}

function process(pairs) {
  return pairs.map(p => ({
    name: p.baseToken.name,
    symbol: p.baseToken.symbol,
    price: +p.priceUsd,
    volume: p.volume.h24,
    liquidity: p.liquidity.usd,
    change: p.priceChange.h24
  }))
  .filter(c => c.volume > 50000)
  .map(c => ({...c, score: score(c)}))
  .sort((a,b)=>b.score-a.score)
  .slice(0,30);
}

async function sendTelegram(msg) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text: msg
  });
}

async function tick() {
  let cached = await redis.get("coins");
  let coins;
  if (cached) {
    coins = JSON.parse(cached);
  } else {
    const pairs = await fetchPairs();
    coins = process(pairs);
    await redis.set("coins", JSON.stringify(coins), "EX", 10);
  }

  wss.clients.forEach(c => c.send(JSON.stringify(coins)));

  if (coins[0] && coins[0].change > 20) {
    sendTelegram(`🚨 Pump detected: ${coins[0].symbol}`);
  }
}

setInterval(tick, 10000);

server.listen(4000, ()=>console.log("Backend live"));
