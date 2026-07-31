const fs = require('fs');
let content = fs.readFileSync('src/pages/ClickTheTarget.jsx', 'utf8');

const targetStr = `        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]">
            <p className="mb-6 font-display text-xl opacity-80 text-center px-4">
              Click the target as many times as you can in 30 seconds!
            </p>
            <button onClick={startGame} className="btn-primary">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>`;

const replaceStr = `        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]">
            <p className="mb-6 font-display text-xl opacity-80 text-center px-4">
              Click the target as many times as you can in 30 seconds!<br/>
              <span className="text-sm opacity-60 mt-2 block font-mono tracking-widest uppercase">Target: ≥ 40 for 🎯 Aimbot</span>
            </p>
            <button onClick={startGame} className="btn-primary">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync('src/pages/ClickTheTarget.jsx', content, 'utf8');
  console.log("Patched target successfully.");
} else {
  console.log("Could not find target string.");
}
