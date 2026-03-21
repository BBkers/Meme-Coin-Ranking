
"use client";
import { useEffect, useState } from "react";

export default function Page() {
  const [coins,setCoins]=useState([]);

  useEffect(()=>{
    const ws = new WebSocket("ws://localhost:4000");
    ws.onmessage = e => setCoins(JSON.parse(e.data));
  },[]);

  return (
    <div className="bg-black text-white min-h-screen p-4">
      <h1 className="text-2xl mb-4">🔥 Meme Dashboard</h1>
      <table className="w-full">
        <thead><tr><th>Name</th><th>Price</th><th>Score</th></tr></thead>
        <tbody>
          {coins.map((c,i)=>(
            <tr key={i}>
              <td>{c.name}</td>
              <td>${c.price}</td>
              <td>{c.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
