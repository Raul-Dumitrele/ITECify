require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const DB_PATH = path.join(__dirname, 'accounts.json');

function loadAccounts() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const map = new Map();
      for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')))) map.set(k, v);
      console.log(`📂 Conturi încărcate: ${map.size}`);
      return map;
    }
  } catch (e) { console.error('Eroare accounts.json:', e.message); }
  return new Map();
}
function saveAccounts() {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(Object.fromEntries(accounts), null, 2)); }
  catch (e) { console.error('Eroare salvare accounts:', e.message); }
}
const accounts = loadAccounts();

const FILES_PATH = path.join(__dirname, 'files.json');

function loadFiles() {
  try {
    if (fs.existsSync(FILES_PATH)) {
      const arr = JSON.parse(fs.readFileSync(FILES_PATH, 'utf-8'));
      if (Array.isArray(arr) && arr.length > 0) { console.log(`📄 Fișiere: ${arr.length}`); return arr; }
    }
  } catch (e) { console.error('Eroare files.json:', e.message); }
  return null;
}
function saveFiles() {
  try { fs.writeFileSync(FILES_PATH, JSON.stringify(projectFiles, null, 2)); }
  catch (e) { console.error('Eroare salvare files:', e.message); }
}

let projectFiles = loadFiles() || [{
  id: '1', name: 'main.js', language: 'javascript',
  content: "// Bine ai venit la iTECify!\nconsole.log('Salut!');",
}];

const fileHistories = {};  

function getHistory(fileId) {
  if (!fileHistories[fileId]) fileHistories[fileId] = [];
  return fileHistories[fileId];
}

function pushHistory(fileId, code, author) {
  const hist = getHistory(fileId);
  hist.push({ timestamp: Date.now(), code, author });
  if (hist.length > 100) hist.shift();
  // Trimitem istoricul actualizat TUTUROR utilizatorilor
  io.emit('code-history', {
    fileId,
    snapshots: hist.map((s, i) => ({ index: i, timestamp: s.timestamp, author: s.author })),
  });
}

function emitHistoryTo(socket, fileId) {
  const hist = getHistory(fileId);
  socket.emit('code-history', {
    fileId,
    snapshots: hist.map((s, i) => ({ index: i, timestamp: s.timestamp, author: s.author })),
  });
}

const activeUsers = {};

const CURSOR_COLORS = [
  '#FF6B6B','#4ECDC4','#45B7D1','#96CEB4',
  '#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9',
];

const AI_AGENT = { id: 'ai-agent', name: 'AI Agent', color: '#a78bfa', isAI: true };

const currentCodePerFile = {};
projectFiles.forEach(f => { currentCodePerFile[f.id] = f.content || ''; });

let aiTypingInterval = null;

function getColorForUser(preferred) {
  if (preferred) return preferred;
  const used = Object.values(activeUsers).map(u => u.color);
  return CURSOR_COLORS.find(c => !used.includes(c))
    || CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
}

function stopAITyping() {
  if (aiTypingInterval) { clearInterval(aiTypingInterval); aiTypingInterval = null; }
}

app.get('/health', (req, res) =>
  res.json({ status: 'ok', accounts: accounts.size, files: projectFiles.length, sessions: Object.keys(activeUsers).length })
);

io.on('connection', (socket) => {
  console.log(`Conectat: ${socket.id}`);

  socket.on('auth-signup', ({ username, email, phone, password, color }) => {
    if (!username || !email || !password) return socket.emit('auth-error', 'Username, email și parola sunt obligatorii.');
    if (accounts.has(username.toLowerCase())) return socket.emit('auth-error', 'Username-ul este deja folosit.');
    if ([...accounts.values()].some(a => a.email === email.toLowerCase().trim())) return socket.emit('auth-error', 'Email-ul este deja înregistrat.');
    const account = { username: username.trim(), email: email.toLowerCase().trim(), phone: phone || '', password, color: color || getColorForUser() };
    accounts.set(username.toLowerCase(), account);
    saveAccounts();
    console.log(`✅ Cont nou: ${account.username}`);
    socket.emit('auth-success', { username: account.username, email: account.email, phone: account.phone, color: account.color });
  });

  socket.on('auth-signin', ({ username, password }) => {
    if (!username || !password) return socket.emit('auth-error', 'Completează username și parola.');
    const account = accounts.get(username.toLowerCase());
    if (!account) return socket.emit('auth-error', 'Username-ul nu există.');
    if (account.password !== password) return socket.emit('auth-error', 'Parolă incorectă.');
    console.log(`🔑 Login: ${account.username}`);
    socket.emit('auth-success', { username: account.username, email: account.email, phone: account.phone, color: account.color });
  });

  socket.on('register-user', (name, color) => {
    const userColor = getColorForUser(color);
    activeUsers[socket.id] = { name, color: userColor, cursor: null };

    socket.emit('registered', { id: socket.id, color: userColor });
    socket.emit('active-users', { ...activeUsers, [AI_AGENT.id]: AI_AGENT });

    // Trimitem fișierele la noul user
    socket.emit('files-sync', projectFiles);

    socket.broadcast.emit('user-joined', { id: socket.id, name, color: userColor });
    console.log(`👤 User în sesiune: ${name}`);
  });

  socket.on('get-file-history', (fileId) => {
    emitHistoryTo(socket, fileId);
  });

  socket.on('send-code', ({ fileId, code }) => {
    if (!fileId || code === undefined) return;
    currentCodePerFile[fileId] = code;
    // Actualizăm și în projectFiles
    const idx = projectFiles.findIndex(f => f.id === fileId);
    if (idx !== -1) projectFiles[idx].content = code;
    socket.broadcast.emit('receive-code', { fileId, code });
  });

  socket.on('save-snapshot', (data) => {
    if (!data) return; // Protecție anti-crash

    const targetId = data.id || data.fileId;
    if (!targetId) return;

    const fileIndex = projectFiles.findIndex(f => f.id === targetId);
    if (fileIndex === -1) return;  

    const file = projectFiles[fileIndex];
    const user = activeUsers[socket.id];
    
    const codeToSave = data.content !== undefined ? data.content : file.content;

    if (!file.history) file.history = [];
    
    file.history.push({
      timestamp: Date.now(),
      code: codeToSave,
      author: user ? user.name : 'Unknown'
    });
    
    if (file.history.length > 100) {
      file.history.shift();
    }
    
    io.emit('file-history', { id: targetId, history: file.history });
    
    saveFiles(); 
    
    console.log(`Snapshot salvat în fișierul ${file.name} de ${user?.name || 'Unknown'}`);
  });
  socket.on('get-file-history', (id) => {
    const file = projectFiles.find(f => f.id === id);
    if (file) {
      socket.emit('file-history', { id, history: file.history || [] });
    }
  });

  socket.on('time-travel', ({ id, index }) => {
    const file = projectFiles.find(f => f.id === id);
    
    if (file && file.history && file.history[index]) {
      const snap = file.history[index];
      
      socket.emit('receive-code', { fileId: id, code: snap.code });
      socket.emit('time-travel-info', {
        fileId: id, 
        index: index, 
        author: snap.author, 
        timestamp: snap.timestamp
      });
      console.log(`⏪ Time-travel în ${file.name} → snapshot #${index}`);
    }
  });

  socket.on('delete-snapshot', (data) => {
    if (!data) return; // Protecție anti-crash
    
    const targetId = data.id || data.fileId;
    const index = data.index;

    const file = projectFiles.find(f => f.id === targetId);
    
    if (file && file.history && index >= 0 && index < file.history.length) {
      file.history.splice(index, 1);
      saveFiles(); 
      
      io.emit('file-history', { id: targetId, history: file.history });
      io.emit('code-history', { fileId: targetId, snapshots: file.history });
      
      console.log(`🗑️ Snapshot #${index} șters din ${file.name}`);
    } else {
      console.log(`⚠️ Nu am putut șterge (Fișier invalid sau index greșit)`);
    }
  });

  socket.on('update-files', (updatedFiles) => {
    if (!Array.isArray(updatedFiles)) return;
    projectFiles = updatedFiles;
    projectFiles.forEach(f => {
      if (currentCodePerFile[f.id] === undefined) currentCodePerFile[f.id] = f.content || '';
    });
    saveFiles();
    socket.broadcast.emit('files-sync', projectFiles);
    console.log(`💾 Fișiere salvate: ${projectFiles.length}`);
  });

  socket.on('cursor-move', (data) => {
    if (!activeUsers[socket.id]) return;
    activeUsers[socket.id].cursor = data;
    socket.broadcast.emit('remote-cursor', { id: socket.id, name: activeUsers[socket.id].name, color: activeUsers[socket.id].color, ...data });
  });

  socket.on('selection-change', (data) => {
    if (!activeUsers[socket.id]) return;
    socket.broadcast.emit('remote-selection', { id: socket.id, name: activeUsers[socket.id].name, color: activeUsers[socket.id].color, ...data });
  });

  socket.on('ask-ai', async ({ prompt, language }) => {
    console.log(`\n=== AI (${language}) ← ${activeUsers[socket.id]?.name} ===`);
    io.emit('ai-agent-start', { name: AI_AGENT.name, color: AI_AGENT.color });
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile", temperature: 0.1, max_tokens: 1024,
        messages: [
          { role: "system", content: `You are an expert coding assistant. Respond with ONLY pure ${language} code. No explanations, no markdown, no backticks, no comments. Just the raw code.` },
          { role: "user", content: prompt },
        ],
      });
      const text = completion.choices[0].message.content.replace(/```[\w]*\n?|```/g, "").trim();
      stopAITyping();
      let idx = 0;
      const chars = text.split('');
      aiTypingInterval = setInterval(() => {
        if (idx >= chars.length) {
          stopAITyping();
          io.emit('ai-agent-done', { code: text, color: AI_AGENT.color });
          io.emit('remote-cursor', { id: AI_AGENT.id, name: AI_AGENT.name, color: AI_AGENT.color, lineNumber: 1, column: 1 });
          return;
        }
        const char = chars[idx++];
        const written = chars.slice(0, idx).join('');
        const lines   = written.split('\n');
        io.emit('ai-agent-typing', { char, color: AI_AGENT.color, name: AI_AGENT.name, lineNumber: lines.length, column: lines[lines.length - 1].length + 1 });
      }, 28);
    } catch (err) {
      console.error("Eroare AI:", err.message || err);
      stopAITyping();
      io.emit('ai-agent-done', { code: "// Eroare: verifică cheia Groq din .env", color: AI_AGENT.color });
    }
  });

  socket.on('run-code', (data) => {
    const { code, language = 'javascript', userName = 'Cineva' } = typeof data === 'object' ? data : { code: data };
    const dockerImages = { javascript: 'node:alpine', python: 'python:3.11-alpine', cpp: 'gcc:13', java: 'eclipse-temurin:17-jdk-alpine', rust: 'rust:alpine' };
    const dangerous = ['process.exit', 'rm -rf', '__import__("os")', 'subprocess', 'eval(', 'System.exit', 'Runtime.getRuntime'];
    const found = dangerous.filter(p => code.includes(p));
    if (found.length > 0) { io.emit('run-results', `⚠️ [${userName}] Blocat — vulnerabilitate: ${found.join(', ')}`); return; }
    io.emit('run-results', `▶ ${userName} rulează (${language})...\n`);
    const image = dockerImages[language] || dockerImages.javascript;
    let cmd = [];
    if (language === 'javascript') cmd = ['node', '-e', code];
    else if (language === 'python') cmd = ['python3', '-c', code];
    else if (language === 'cpp') { const esc = code.replace(/'/g, "'\\''"); cmd = ['sh', '-c', `echo '${esc}' > temp.cpp && g++ temp.cpp -o app && ./app`]; }
    else if (language === 'java') { const esc = code.replace(/'/g, "'\\''"); cmd = ['sh', '-c', `echo '${esc}' > Main.java && javac Main.java && java Main`]; }
    else if (language === 'rust') { const esc = code.replace(/'/g, "'\\''"); cmd = ['sh', '-c', `echo '${esc}' > main.rs && rustc main.rs -o app && ./app`]; }
    const proc = spawn('docker', ['run', '-i', '--rm', '--memory=128m', '--cpus=0.5', '--pids-limit=64', '--network=none', image, ...cmd]);
    const timeout = setTimeout(() => { proc.kill('SIGKILL'); io.emit('run-results', '\n[Timeout] Execuția a depășit 10 secunde.'); }, 10000);
    proc.stdout.on('data', chunk => io.emit('run-results', chunk.toString()));
    proc.stderr.on('data', chunk => io.emit('run-results', chunk.toString()));
    proc.on('close', exitCode => {
      clearTimeout(timeout);
      if (exitCode !== null && exitCode !== 0) io.emit('run-results', `\n[Exit code: ${exitCode}]`);
      io.emit('run-done', { userName });
    });
    if (language === 'javascript') { proc.stdin.write(code); proc.stdin.end(); }
  });

  socket.on('change-language', (newLang) => { socket.broadcast.emit('receive-language', newLang); });

  socket.on('disconnect', () => {
    const user = activeUsers[socket.id];
    if (user) { delete activeUsers[socket.id]; socket.broadcast.emit('user-left', { id: socket.id }); console.log(`Deconectat: ${user.name}`); }
  });
});

process.on('SIGINT',  () => { saveAccounts(); saveFiles(); console.log('\n💾 Date salvate.'); process.exit(0); });
process.on('SIGTERM', () => { saveAccounts(); saveFiles(); process.exit(0); });

server.listen(3000, () => {
  console.log('');
  console.log('  iTECify Backend  →  port 3000');
  console.log(`  Conturi          →  ${accounts.size}`);
  console.log(`  Fișiere          →  ${projectFiles.length}`);
  console.log('  Time-Travel      →  per fișier, max 100 snapshots');
  console.log('  AI               →  Groq LLaMA 3.3 70B');
  console.log('');
});