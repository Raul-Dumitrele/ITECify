import React, { useEffect, useState, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { io } from 'socket.io-client';
import AuthScreen from './AuthScreen';
import './App.css';

const socket = io('http://localhost:3000');

let widgetIdCounter = 0;
const nextWidgetId = () => `cursor-widget-${++widgetIdCounter}`;

const CODE_TEMPLATES = {
  javascript: "// iTECify JavaScript\nconsole.log('Salut din JS!');",
  python:     "# iTECify Python\nprint('Salut din Python!')",
  cpp:        "#include <iostream>\n\nint main() {\n    std::cout << \"Salut din C++!\" << std::endl;\n    return 0;\n}",
  java:       "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Salut din Java!\");\n    }\n}",
  rust:       "// iTECify Rust\nfn main() {\n    println!(\"Salut din Rust!\");\n}",
};

const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', monaco: 'javascript', filename: 'index.js'  },
  { id: 'python',     label: 'Python',     monaco: 'python',     filename: 'main.py'   },
  { id: 'cpp',        label: 'C++',        monaco: 'cpp',        filename: 'main.cpp'  },
  { id: 'java',       label: 'Java',       monaco: 'java',       filename: 'Main.java' },
  { id: 'rust',       label: 'Rust',       monaco: 'rust',       filename: 'main.rs'   },
];

const FILE_ICONS = {
  js:'🟨', jsx:'🟨', ts:'🔷', tsx:'🔷',
  py:'🐍', cpp:'⚙️', c:'⚙️', java:'☕',
  rs:'🦀', go:'🐹', html:'🌐', css:'🎨',
  json:'📋', md:'📝',
};
const fileIcon = (name) => FILE_ICONS[name.split('.').pop()?.toLowerCase()] || '📄';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('ro-RO', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function injectEasterStyles() {
  if (document.getElementById('easter-styles')) return;
  const s = document.createElement('style'); s.id = 'easter-styles';
  s.textContent = `
    @keyframes confetti-fall {
      0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
    }
    @keyframes easter-pop  {
      from { opacity: 0; transform: translate(-50%,-50%) scale(0.7); }
      to   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
    }
    @keyframes easter-fade {
      from { opacity: 1; transform: translate(-50%,-50%) scale(1); }
      to   { opacity: 0; transform: translate(-50%,-50%) scale(0.85); }
    }
    @keyframes god-pulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(167,139,250,0); }
      50%     { box-shadow: 0 0 30px 4px rgba(167,139,250,0.25); }
    }
    .god-mode { animation: god-pulse 2s ease-in-out infinite; }
    .god-mode .workspace-header strong {
      background: linear-gradient(90deg,#a78bfa,#39d0f0,#3fb950,#f85149,#a78bfa);
      background-size: 300%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: rainbow-shift 2s linear infinite;
    }
    @keyframes rainbow-shift { to { background-position: 300% center; } }
  `;
  document.head.appendChild(s);
}

function spawnConfetti() {
  injectEasterStyles();
  const colors = ['#a78bfa','#39d0f0','#3fb950','#f85149','#d29922','#FF6B6B','#4ECDC4'];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; top:-10px; left:${Math.random()*100}vw;
      width:${6+Math.random()*8}px; height:${6+Math.random()*8}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      border-radius:${Math.random()>0.5?'50%':'2px'};
      z-index:9999; pointer-events:none;
      animation: confetti-fall ${1.5+Math.random()*2}s ease-in forwards;
      animation-delay:${Math.random()*0.8}s;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}

function showEasterEggMessage(msg, emoji = '🎮', duration = 3000) {
  injectEasterStyles();
  const existing = document.getElementById('easter-overlay');
  if (existing) existing.remove();
  const el = document.createElement('div'); el.id = 'easter-overlay';
  el.style.cssText = `
    position:fixed; top:50%; left:50%;
    transform:translate(-50%,-50%);
    background:#0f1117; border:2px solid #a78bfa;
    border-radius:12px; padding:24px 36px; z-index:9999;
    font-family:'Rajdhani',sans-serif; font-size:22px; font-weight:700;
    color:#a78bfa; text-align:center; letter-spacing:.06em;
    box-shadow:0 0 40px rgba(167,139,250,0.4);
    animation: easter-pop 0.3s cubic-bezier(.16,1,.3,1);
  `;
  el.innerHTML = `<div style="font-size:40px;margin-bottom:8px">${emoji}</div>${msg}`;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'easter-fade 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

export default function App() {

  const [authUser, setAuthUser] = useState(null);

  const [files, setFiles]             = useState([{ id: '1', name: 'main.js', language: 'javascript', content: CODE_TEMPLATES.javascript }]);
  const [activeFileId, setActiveFileId] = useState('1');
  const [isEditingId, setIsEditingId]   = useState(null);
  const [tempName, setTempName]         = useState("");
  const renameInputRef = useRef(null);

  const [code, setCode]         = useState(CODE_TEMPLATES.javascript);
  const [language, setLanguage] = useState('javascript');

  const [status, setStatus]         = useState("Deconectat");
  const [output, setOutput]         = useState("Aștept comenzi...");
  const [myColor, setMyColor]       = useState("#39d0f0");
  const [users, setUsers]           = useState({});
  const [aiPrompt, setAiPrompt]     = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isRunning, setIsRunning]   = useState(false);

  const [allHistories, setAllHistories]     = useState({});
  const [timeTravelIdx, setTimeTravelIdx]   = useState(null);
  const [showTimeline, setShowTimeline]     = useState(false);
  const [timeTravelInfo, setTimeTravelInfo] = useState(null);

  const [aiBlock, setAiBlock]       = useState(null);
  const [aiBlockPos, setAiBlockPos] = useState({ x: null, y: null });
  const [overEditor, setOverEditor] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [easterGodMode, setEasterGodMode] = useState(false);
  const [lineCount, setLineCount]         = useState(0);
  const confetti100FiredRef               = useRef(false);
  const konamiIdxRef                      = useRef(0);

  const editorRef         = useRef(null);
  const monacoRef         = useRef(null);
  const editorWrapRef     = useRef(null);
  const terminalRef       = useRef(null);
  const isRemoteChange    = useRef(false);
  const aiBufferRef       = useRef("");
  const aiStartLineRef    = useRef(null);
  const remoteCursors     = useRef({});
  const remoteDecorations = useRef({});
  const aiDecorations     = useRef([]);
  const editorDropDecRef  = useRef([]);
  const dragRef           = useRef({ dragging: false, offsetX: 0, offsetY: 0 });
  const aiBlockPosRef     = useRef({ x: null, y: null });
  const isDroppingRef     = useRef(false);
  const dropLineRef       = useRef(null);
  const codeRef           = useRef(code);
  const aiBlockRef        = useRef(aiBlock);
  const activeFileIdRef   = useRef(activeFileId);
  const filesRef          = useRef(files);

  useEffect(() => { codeRef.current = code; },                [code]);
  useEffect(() => { aiBlockRef.current = aiBlock; },          [aiBlock]);
  useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);
  useEffect(() => { filesRef.current = files; },              [files]);

  const activeHistory = allHistories[activeFileId] || [];


  const selectFile = useCallback((file) => {
    if (file.id === activeFileId) return;

    setTimeTravelIdx(null);
    setTimeTravelInfo(null);

    setActiveFileId(file.id);
    setLanguage(file.language);

    socket.emit('get-file-history', file.id);

    isRemoteChange.current = true;
    setCode(file.content || '');

    setOutput(p => p + `\n[Sistem] Comutat pe: ${file.name}`);
  }, [activeFileId]);

  const addNewFile = () => {
    const id      = Date.now().toString();
    const name    = `file_${files.length + 1}.js`;
    const newFile = { id, name, language: 'javascript', content: CODE_TEMPLATES.javascript };
    const updated = [...files, newFile];
    setFiles(updated);
    socket.emit('update-files', updated);
    setActiveFileId(id);
    setLanguage('javascript');
    setTimeTravelIdx(null);
    setTimeTravelInfo(null);
    isRemoteChange.current = true;
    setCode(CODE_TEMPLATES.javascript);
    setOutput(p => p + `\n[Sistem] Fișier nou: ${name}`);
  };

  const saveFileName = (id) => {
    const trimmed = tempName.trim();
    if (!trimmed) { setIsEditingId(null); return; }
    const ext      = trimmed.split('.').pop()?.toLowerCase();
    const detected = LANGUAGES.find(l => l.filename.endsWith(`.${ext}`));
    setFiles(prev => {
      const updated = prev.map(f => {
        if (f.id !== id) return f;
        const newLangId  = detected?.id || f.language;
        const newContent = (detected && detected.id !== f.language)
          ? CODE_TEMPLATES[detected.id] : f.content;
        if (id === activeFileId) {
          setLanguage(newLangId);
          isRemoteChange.current = true;
          setCode(newContent);
          socket.emit('change-language', newLangId);
          socket.emit('send-code', { fileId: id, code: newContent });
        }
        return { ...f, name: trimmed, language: newLangId, content: newContent };
      });
      socket.emit('update-files', updated);
      return updated;
    });
    setIsEditingId(null);
  };

  const deleteFile = (id, e) => {
    e.stopPropagation();
    if (files.length === 1) return alert("Trebuie să ai cel puțin un fișier!");
    if (!window.confirm("Sigur vrei să ștergi definitiv acest fișier?")) return;
    const filtered = files.filter(f => f.id !== id);
    setFiles(filtered);
    socket.emit('update-files', filtered);
    if (activeFileId === id) {
      const next = filtered[0];
      setActiveFileId(next.id);
      setLanguage(next.language);
      setTimeTravelIdx(null);
      setTimeTravelInfo(null);
      isRemoteChange.current = true;
      setCode(next.content || '');
      socket.emit('get-file-history', next.id);
    }
    setAllHistories(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  useEffect(() => {
    if (isEditingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isEditingId]);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    const tmpl   = CODE_TEMPLATES[newLang];
    const newExt = LANGUAGES.find(l => l.id === newLang)?.filename.split('.').pop();
    if (tmpl) {
      const updated = files.map(f => {
        if (f.id !== activeFileId) return f;
        const base = f.name.split('.')[0] || 'file';
        return { ...f, name: `${base}.${newExt}`, language: newLang, content: tmpl };
      });
      setFiles(updated);
      isRemoteChange.current = true;
      setCode(tmpl);
      socket.emit('send-code', { fileId: activeFileId, code: tmpl });
      socket.emit('change-language', newLang);
      socket.emit('update-files', updated);
      setOutput(`Limbaj schimbat la: ${newLang.toUpperCase()}\n---`);
    }
  };


  useEffect(() => {
    const humanCount = Object.values(users).filter(u => !u.isAI).length + 1;
    if (authUser) {
      document.title = humanCount > 1
        ? `iTECify · ${humanCount} devs online` : 'iTECify · Workspace';
    }
  }, [users, authUser]);

  useEffect(() => {
    const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    const HESOYAM = ['h','e','s','o','y','a','m']; // 7 caractere
    let keyBuffer = []; 
    
    const handleKey = (e) => {
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;

      let key = e.key;
      if (key.length === 1) {
        key = key.toLowerCase();
      }

      keyBuffer.push(key);

      if (keyBuffer.length > 10) {
        keyBuffer.shift();
      }

      if (keyBuffer.join(',') === KONAMI.join(',')) {
        keyBuffer = [];  
        setEasterGodMode(true);
        spawnConfetti();
        showEasterEggMessage('GOD MODE ACTIVAT!\niTECify v∞.0 — Putere maximă!', '🚀', 4000);
        setOutput(prev => prev + '\n\n🚀 [GOD MODE] Konami Code activat!\n> Ești legend.\n');
        setTimeout(() => setEasterGodMode(false), 30000);
      }

      const last7 = keyBuffer.slice(-7);
      if (last7.join(',') === HESOYAM.join(',')) {
        keyBuffer = []; 
        
        const oldTransition = document.body.style.transition;
        document.body.style.transition = 'background-color 0.2s';
        document.body.style.backgroundColor = 'rgba(63, 185, 80, 0.15)'; // Accent green
        setTimeout(() => {
          document.body.style.backgroundColor = '';
          setTimeout(() => document.body.style.transition = oldTransition, 200);
        }, 300);

        showEasterEggMessage('+ $250,000, Full Health & Armor\nRespect +', '💰', 4000);
        setOutput(prev => prev + '\n\n💰 [CHEAT ACTIVAT] HESOYAM\n> Ai primit $250,000 credite pe AWS.\n> Bug-urile au fost vindecate 100%.\n> Ai primit armură împotriva întrebărilor juriului!\n');
      }
    };

    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, []);

  useEffect(() => {
    const check3am = () => {
      const h = new Date().getHours(), m = new Date().getMinutes();
      if (h === 3 && m === 0) showEasterEggMessage(
        'Este ora 3:00 AM...\nEști un adevărat developer! 🌙\niTECify îți mulțumește.',
        '🌙', 6000
      );
    };
    const interval = setInterval(check3am, 60000);
    check3am();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const lines = code.split('\n').length;
    setLineCount(lines);
    if (lines >= 100 && !confetti100FiredRef.current) {
      confetti100FiredRef.current = true;
      spawnConfetti();
      showEasterEggMessage('100 linii de cod! 🎉\nEști pe drumul cel bun!', '🎉', 3500);
    }
    if (lines < 90) confetti100FiredRef.current = false;
  }, [code]);

  useEffect(() => {
    if (code?.includes('// este ora 3 dimineata') && !code.includes('CAFEA')) {
      setOutput(prev => prev + '\n\n☕ [EASTER EGG] CAFEA INJECTATĂ DIRECT ÎN VENE!\n');
      document.body.style.filter = 'contrast(1.5) saturate(1.5)';
      setTimeout(() => document.body.style.filter = 'none', 3000);
    }
  }, [code]);

  useEffect(() => {
    if (terminalRef.current)
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [output]);

  const handleSaveSnapshot = useCallback(() => {
    socket.emit('save-snapshot', { fileId: activeFileIdRef.current });
    setOutput(prev => prev + '\n[Sistem] Snapshot salvat!');
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveSnapshot();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSaveSnapshot]);

  const handleAuth = useCallback((emitFn) => {
    const onSuccess = (userData) => {
      socket.off('auth-error', onError);
      setAuthUser(userData);
      setMyColor(userData.color);
      socket.emit('register-user', userData.username, userData.color);
    };
    const onError = (msg) => {
      socket.off('auth-success', onSuccess);
      window.dispatchEvent(new CustomEvent('itecify-auth-error', { detail: msg }));
    };
    socket.once('auth-success', onSuccess);
    socket.once('auth-error',   onError);
    emitFn(socket);
  }, []);

  const removeRemoteUser = useCallback((id) => {
    const editor = editorRef.current; if (!editor) return;
    if (remoteCursors.current[id]) {
      try { editor.removeContentWidget(remoteCursors.current[id]); } catch (_) {}
      delete remoteCursors.current[id];
    }
    if (remoteDecorations.current[id]) {
      editor.deltaDecorations(remoteDecorations.current[id], []);
      delete remoteDecorations.current[id];
    }
  }, []);

  const renderRemoteCursor = useCallback(({ id, name, color, lineNumber, column }) => {
    const editor = editorRef.current; const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    if (remoteCursors.current[id]) { try { editor.removeContentWidget(remoteCursors.current[id]); } catch (_) {} }
    const widgetId = nextWidgetId();
    const domNode  = document.createElement('div');
    domNode.style.cssText = `position:absolute;width:2px;height:18px;background:${color};z-index:100;pointer-events:none;`;
    const lbl = document.createElement('div'); lbl.textContent = name;
    lbl.style.cssText = `position:absolute;top:-20px;left:2px;background:${color};color:#0a0c10;font-size:11px;font-family:'Rajdhani',sans-serif;font-weight:700;padding:1px 6px;border-radius:3px;white-space:nowrap;pointer-events:none;`;
    domNode.appendChild(lbl);
    const widget = {
      getId:       () => widgetId,
      getDomNode:  () => domNode,
      getPosition: () => ({ position: { lineNumber, column }, preference: [monaco.editor.ContentWidgetPositionPreference.EXACT] }),
    };
    editor.addContentWidget(widget);
    remoteCursors.current[id] = widget;
  }, []);

  const renderRemoteSelection = useCallback(({ id, color, startLine, startColumn, endLine, endColumn }) => {
    const editor = editorRef.current; const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    if (startLine === endLine && startColumn === endColumn) {
      if (remoteDecorations.current[id]) { editor.deltaDecorations(remoteDecorations.current[id], []); remoteDecorations.current[id] = []; }
      return;
    }
    const styleId = `sel-style-${id}`;
    if (!document.getElementById(styleId)) {
      const s = document.createElement('style'); s.id = styleId;
      s.textContent = `.remote-sel-${id}{background:${color}40!important;}`;
      document.head.appendChild(s);
    }
    const prev = remoteDecorations.current[id] || [];
    remoteDecorations.current[id] = editor.deltaDecorations(prev, [{
      range: new monaco.Range(startLine, startColumn, endLine, endColumn),
      options: { className: `remote-sel-${id}`, stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges },
    }]);
  }, []);

  const updateAIBlockDecoration = useCallback((startLine, endLine) => {
    const editor = editorRef.current; const monaco = monacoRef.current;
    if (!editor || !monaco || !startLine) return;
    if (!document.getElementById('ai-block-style')) {
      const s = document.createElement('style'); s.id = 'ai-block-style';
      s.textContent = `.ai-block-decoration{background:#a78bfa18!important;border-left:3px solid #a78bfa!important;}`;
      document.head.appendChild(s);
    }
    aiDecorations.current = editor.deltaDecorations(aiDecorations.current, [{
      range: new monaco.Range(startLine, 1, endLine, 9999),
      options: { isWholeLine: true, className: 'ai-block-decoration', stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges },
    }]);
  }, []);

  const clearAIBlockDecoration = useCallback(() => {
    if (editorRef.current) aiDecorations.current = editorRef.current.deltaDecorations(aiDecorations.current, []);
  }, []);

  const showDropLine = useCallback((lineNumber) => {
    const editor = editorRef.current; const monaco = monacoRef.current;
    if (!editor || !monaco || !lineNumber) return;
    if (!document.getElementById('ai-drop-style')) {
      const s = document.createElement('style'); s.id = 'ai-drop-style';
      s.textContent = `.ai-drop-line{background:#a78bfa33!important;border-top:2px solid #a78bfa!important;}`;
      document.head.appendChild(s);
    }
    editorDropDecRef.current = editor.deltaDecorations(editorDropDecRef.current, [{
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: { isWholeLine: true, className: 'ai-drop-line', stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges },
    }]);
  }, []);

  const clearDropLine = useCallback(() => {
    if (editorRef.current) editorDropDecRef.current = editorRef.current.deltaDecorations(editorDropDecRef.current, []);
  }, []);

  const getEditorLine = useCallback((clientX, clientY) => {
    const editor = editorRef.current; if (!editor) return null;
    try { const t = editor.getTargetAtClientPoint(clientX, clientY); if (t?.position) return t.position.lineNumber; } catch (_) {}
    const wrapEl = editorWrapRef.current; if (!wrapEl) return null;
    const rect  = wrapEl.getBoundingClientRect();
    const relY  = clientY - rect.top + editor.getScrollTop();
    const lineH = editor.getOption(63) || 19;
    return Math.min(Math.max(1, Math.ceil(relY / lineH)), (editor.getModel()?.getLineCount() || 1) + 1);
  }, []);

  useEffect(() => {
    socket.on('connect',    () => setStatus("Conectat ✅"));
    socket.on('disconnect', () => setStatus("Deconectat ❌"));

    socket.on('files-sync', (serverFiles) => {
      if (!Array.isArray(serverFiles) || serverFiles.length === 0) return;
      
      setFiles(serverFiles);
      
      const initialHistories = {};
      serverFiles.forEach(file => {
        if (file.history) {
          initialHistories[file.id] = file.history;
        }
      });
      setAllHistories(prev => ({ ...prev, ...initialHistories }));

      const current = serverFiles.find(f => f.id === activeFileIdRef.current);
      const target  = current || serverFiles[0];
      
      if (!current) setActiveFileId(target.id);
      setLanguage(target.language);
      
      isRemoteChange.current = true;
      setCode(target.content || '');
    });

    socket.on('file-history', ({ id, history }) => {
      setAllHistories(prev => ({ ...prev, [id]: history }));
    });

    socket.on('receive-language', (l) => {
      setLanguage(l);
      setOutput(p => p + `\n[Sistem] Limbaj schimbat → ${l.toUpperCase()}`);
    });
    socket.on('registered', ({ color }) => setMyColor(color));

    socket.on('active-users', (map) =>
      setUsers(Object.fromEntries(
        Object.entries(map).filter(([id]) => id !== socket.id)
          .map(([id, u]) => [id, { name: u.name, color: u.color, isAI: u.isAI }])
      ))
    );
    socket.on('user-joined', ({ id, name, color, isAI }) => {
      if (id !== socket.id) {
        setUsers(p => ({ ...p, [id]: { name, color, isAI } }));
        if (!isAI) setOutput(p => p + `\n[+] ${name} a intrat în sesiune`);
      }
    });
    socket.on('user-left', ({ id }) => {
      setUsers(p => {
        const left = p[id];
        if (left && !left.isAI) setOutput(prev => prev + `\n[-] ${left.name} a ieșit`);
        const n = { ...p }; delete n[id]; return n;
      });
      removeRemoteUser(id);
    });

    socket.on('receive-code', ({ fileId, code: newCode }) => {
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content: newCode } : f));
      if (fileId === activeFileIdRef.current) {
        isRemoteChange.current = true;
        setCode(newCode);
        setTimeTravelIdx(null);
        setTimeTravelInfo(null);
      }
    });

    socket.on('time-travel-info', ({ fileId, index, author, timestamp }) => {
      if (fileId === activeFileIdRef.current) setTimeTravelInfo({ index, author, timestamp });
    });

    socket.on('remote-cursor',    (d) => renderRemoteCursor(d));
    socket.on('remote-selection', (d) => renderRemoteSelection(d));

    socket.on('run-results', chunk => setOutput(p => p + chunk));
    socket.on('run-done', ({ userName }) => {
      setIsRunning(false);
      setOutput(p => p + `\n✓ Execuție finalizată (${userName})\n`);
    });

    socket.on('ai-agent-start', () => {
      setIsAiTyping(true); aiBufferRef.current = ""; aiStartLineRef.current = null;
      setAiBlock(null); clearAIBlockDecoration();
      aiBlockPosRef.current = { x: null, y: null }; setAiBlockPos({ x: null, y: null });
    });
    socket.on('ai-agent-typing', ({ char, lineNumber, column, color, name }) => {
      renderRemoteCursor({ id: 'ai-agent', name, color, lineNumber, column });
      aiBufferRef.current += char;
      if (aiStartLineRef.current === null)
        aiStartLineRef.current = (editorRef.current?.getModel().getLineCount() || 1) + 1;
      updateAIBlockDecoration(aiStartLineRef.current, lineNumber + aiStartLineRef.current - 1);
    });
    socket.on('ai-agent-done', ({ code: aiCode, color }) => {
      setIsAiTyping(false); clearAIBlockDecoration();
      setAiBlock({ code: aiCode, color, insertLine: (editorRef.current?.getModel().getLineCount() || 1) + 1 });
      aiBufferRef.current = ""; aiStartLineRef.current = null;
    });

    return () => {
      ['connect','disconnect','files-sync','code-history','receive-language','registered','active-users',
       'user-joined','user-left','receive-code','time-travel-info','remote-cursor','remote-selection',
       'run-results','run-done','ai-agent-start','ai-agent-typing','ai-agent-done',
      ].forEach(e => socket.off(e));
    };
  }, [renderRemoteCursor, renderRemoteSelection, removeRemoteUser, updateAIBlockDecoration, clearAIBlockDecoration]);

  useEffect(() => {
    if (authUser && activeFileId) socket.emit('get-file-history', activeFileId);
  }, [authUser]); // eslint-disable-line

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor; monacoRef.current = monaco;
    editor.onDidChangeCursorPosition(e => {
      if (!authUser) return;
      socket.emit('cursor-move', { lineNumber: e.position.lineNumber, column: e.position.column });
    });
    editor.onDidChangeCursorSelection(e => {
      if (!authUser) return;
      const s = e.selection;
      socket.emit('selection-change', {
        startLine: s.startLineNumber, startColumn: s.startColumn,
        endLine:   s.endLineNumber,   endColumn:   s.endColumn,
      });
    });
  };

  const handleEditorChange = (value) => {
    if (!isRemoteChange.current) {
      setCode(value);
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: value } : f));
      socket.emit('send-code', { fileId: activeFileId, code: value });
      if (timeTravelIdx !== null) { setTimeTravelIdx(null); setTimeTravelInfo(null); }
    }
    isRemoteChange.current = false;
  };

  const handleTimeTravel = (idx) => {
    const snap = allHistories[activeFileId]?.[idx];
    if (!snap) return;

    isRemoteChange.current = true;
    setCode(snap.code);
    editorRef.current?.setValue(snap.code);

    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: snap.code } : f));
    socket.emit('send-code', { fileId: activeFileId, code: snap.code });
    socket.emit('edit-file', { id: activeFileId, content: snap.code });

    setOutput(prev => prev + `\n[Sistem] Cod restaurat din salvarea #${idx + 1}`);
    
    setTimeTravelIdx(null);
    setTimeTravelInfo(null);
  };

  const handleReturnToLive = () => {
    setShowTimeline(false);
  };

  const handleDeleteSnapshot = (e, idx) => {
    e.stopPropagation();
    socket.emit('delete-snapshot', { id: activeFileId, fileId: activeFileId, index: idx });
  };

  const acceptAIAtLine = useCallback((insertLine, aiCode, currentCode) => {
    const lines = currentCode.split('\n');
    lines.splice(Math.max(0, insertLine - 1), 0, aiCode);
    const newCode = lines.join('\n');
    
    setCode(newCode);
    
    const updatedFiles = filesRef.current.map(f => 
      f.id === activeFileIdRef.current ? { ...f, content: newCode } : f
    );
    
    setFiles(updatedFiles);
    
    socket.emit('send-code', { fileId: activeFileIdRef.current, code: newCode });
    socket.emit('update-files', updatedFiles); 
    
    setAiBlock(null); 
    clearAIBlockDecoration(); 
    clearDropLine();
    setAiBlockPos({ x: null, y: null }); 
    aiBlockPosRef.current = { x: null, y: null };
    setOverEditor(false);
  }, [clearAIBlockDecoration, clearDropLine]);

  const handleAIBlockMouseDown = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    const el = document.getElementById('ai-block-overlay'); if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { dragging: true, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    setIsDragging(true); e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.dragging) return;
      const newX = Math.max(0, Math.min(e.clientX - dragRef.current.offsetX, window.innerWidth  - 420));
      const newY = Math.max(0, Math.min(e.clientY - dragRef.current.offsetY, window.innerHeight - 100));
      aiBlockPosRef.current = { x: newX, y: newY }; setAiBlockPos({ x: newX, y: newY });
      const wrapEl = editorWrapRef.current; if (!wrapEl) return;
      const rect   = wrapEl.getBoundingClientRect();
      const isOver = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      isDroppingRef.current = isOver; setOverEditor(isOver);
      if (isOver) { const line = getEditorLine(e.clientX, e.clientY); if (line) { dropLineRef.current = line; showDropLine(line); } }
      else { dropLineRef.current = null; clearDropLine(); }
    };
    const onUp = () => {
      if (!dragRef.current.dragging) return;
      dragRef.current.dragging = false; setIsDragging(false);
      if (isDroppingRef.current && dropLineRef.current && aiBlockRef.current)
        acceptAIAtLine(dropLineRef.current, aiBlockRef.current.code, codeRef.current);
      else { clearDropLine(); setOverEditor(false); }
      isDroppingRef.current = false; dropLineRef.current = null;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [showDropLine, clearDropLine, getEditorLine, acceptAIAtLine]);

  useEffect(() => {
    const editor = editorRef.current; const monaco = monacoRef.current;
    if (!editor || !monaco || !aiBlock?.insertLine) return;
    if (!document.getElementById('ai-target-style')) {
      const s = document.createElement('style'); s.id = 'ai-target-style';
      s.textContent = `.ai-insert-target{background:#a78bfa22!important;border-top:2px dashed #a78bfa!important;}`;
      document.head.appendChild(s);
    }
    const decs = editor.deltaDecorations([], [{
      range: new monaco.Range(aiBlock.insertLine, 1, aiBlock.insertLine, 1),
      options: { isWholeLine: true, className: 'ai-insert-target', stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges },
    }]);
    return () => { editor.deltaDecorations(decs, []); };
  }, [aiBlock?.insertLine]);

  const moveAITargetUp   = () => { if (aiBlock && aiBlock.insertLine > 1) setAiBlock(p => ({ ...p, insertLine: p.insertLine - 1 })); };
  const moveAITargetDown = () => {
    const max = (editorRef.current?.getModel().getLineCount() || 1) + 1;
    if (aiBlock && aiBlock.insertLine < max) setAiBlock(p => ({ ...p, insertLine: p.insertLine + 1 }));
  };
  const handleAcceptAI = () => { if (aiBlock) acceptAIAtLine(aiBlock.insertLine, aiBlock.code, code); };
  const handleRefuseAI = () => {
    setAiBlock(null); clearAIBlockDecoration(); clearDropLine();
    setAiBlockPos({ x: null, y: null }); aiBlockPosRef.current = { x: null, y: null }; setOverEditor(false);
  };

  const handleRunCode = () => {
    const hasJS   = code.includes('console.log') || code.includes('function') || code.includes('const ') || code.includes('let ');
    const hasPy   = (code.includes('print(') || code.includes('def ')) && !code.includes('console.log');
    const hasCpp  = code.includes('#include') || code.includes('std::') || code.includes('int main');
    const hasJava = code.includes('public class') || code.includes('System.out') || code.includes('String[] args');
    const hasRust = code.includes('fn main') || code.includes('println!');
    let wrong = false;
    if (language === 'javascript' && !hasJS && (hasPy||hasCpp||hasJava||hasRust)) wrong = true;
    if (language === 'python'     && !hasPy && (hasJS||hasCpp||hasJava||hasRust)) wrong = true;
    if (language === 'cpp'        && !hasCpp && (hasJS||hasPy||hasJava||hasRust)) wrong = true;
    if (language === 'java'       && !hasJava && (hasJS||hasPy||hasCpp||hasRust)) wrong = true;
    if (language === 'rust'       && !hasRust && (hasJS||hasPy||hasCpp||hasJava)) wrong = true;
    if (wrong && !window.confirm(`⚠️ Codul nu pare să fie ${language.toUpperCase()}.\nVrei să continui?`)) return;
    setOutput(`▶ Rulare ${language.toUpperCase()}...\n`);
    setIsRunning(true);
    socket.emit('run-code', { code, language, userName: authUser?.username || 'Anonim' });
  };
  const handleExportCode = () => {
  const activeFile = files.find(f => f.id === activeFileId);
  if (!activeFile) return;
  const blob = new Blob([code], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = activeFile.name;
  a.click();
  URL.revokeObjectURL(url);
};
  const handleAskAI = () => {
    if (!aiPrompt.trim() || isAiTyping) return;
    socket.emit('ask-ai', { prompt: aiPrompt, language });
    setAiPrompt("");
  };

  const humanUsersOnline = Object.values(users).filter(u => !u.isAI).length + 1;

  const aiOverlayStyle = {
    position: 'fixed', zIndex: 300, width: '420px', maxHeight: '65vh', overflowY: 'auto',
    userSelect: 'none', pointerEvents: isDragging ? 'none' : 'auto',
    cursor: dragRef.current.dragging ? 'grabbing' : 'grab',
    ...(aiBlockPos.x !== null
      ? { left: `${aiBlockPos.x}px`, top: `${aiBlockPos.y}px`, bottom: 'auto', right: 'auto' }
      : { bottom: '120px', right: '16px' }
    ),
  };

  if (!authUser) return <AuthScreen onAuth={handleAuth} />;

  return (
    <div className={`app-container ${easterGodMode ? 'god-mode' : ''}`}>

      {/* ══ SIDEBAR ════════════════════════════════════════════ */}
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* EXPLORER header */}
        <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Explorer</span>
          <button onClick={addNewFile} title="Fișier nou"
            style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 2px', fontWeight: 300 }}>+</button>
        </div>

        {/* Lista fișiere */}
        <div style={{ maxHeight: '150px', overflowY: 'auto', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {files.map(f => (
            <div key={f.id}>
              {isEditingId === f.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--bg-hover)' }}>
                  <span style={{ fontSize: '13px' }}>{fileIcon(tempName || f.name)}</span>
                  <input
                    ref={renameInputRef}
                    value={tempName}
                    onChange={e => setTempName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveFileName(f.id); if (e.key === 'Escape') setIsEditingId(null); }}
                    onBlur={() => saveFileName(f.id)}
                    style={{ flex: 1, background: 'var(--bg-base)', border: '1px solid var(--accent-cyan)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '2px 6px', borderRadius: '3px', outline: 'none' }}
                  />
                </div>
              ) : (
                <div
                  className="file-item"
                  onClick={() => selectFile(f)}
                  onDoubleClick={() => { setIsEditingId(f.id); setTempName(f.name); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: activeFileId === f.id ? 'var(--bg-hover)' : 'transparent',
                    borderLeftColor: activeFileId === f.id ? 'var(--accent-cyan)' : 'transparent',
                  }}
                >
                  <span style={{ fontSize: '13px', flexShrink: 0 }}>{fileIcon(f.name)}</span>
                  <span style={{
                    flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12.5px',
                    color: activeFileId === f.id ? 'var(--accent-cyan)' : 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{f.name}</span>
                  {/* Badge snapshots per fișier */}
                  {(allHistories[f.id]?.length || 0) > 0 && (
                    <span style={{ flexShrink: 0, fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '8px', padding: '0 4px', lineHeight: '14px' }}>
                      {allHistories[f.id].length}
                    </span>
                  )}
                  {files.length > 1 && (
                    <button onClick={e => deleteFile(f.id, e)} title="Șterge"
                      style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', opacity: 0, padding: '0 3px', fontSize: '12px', flexShrink: 0, transition: 'opacity .12s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                    >×</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ONLINE */}
        <div className="sidebar-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Online</span>
          <span style={{ background: 'rgba(63,185,80,0.15)', color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '1px 6px', borderRadius: '8px' }}>
            {humanUsersOnline}
          </span>
        </div>
        <div className="user-item">
          <span className="user-dot" style={{ background: myColor }} />
          <span className="user-name">{authUser.username} (tu)</span>
        </div>
        {Object.entries(users).map(([id, u]) => (
          <div className="user-item" key={id}>
            <span className="user-dot" style={{ background: u.color }} />
            <span className="user-name">
              {u.isAI ? '🤖 ' : ''}{u.name}
              {u.isAI && isAiTyping && <span className="ai-typing-badge">typing...</span>}
            </span>
          </div>
        ))}

        {/* TIME-TRAVEL */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginTop: '8px' }}>

          <button onClick={() => setShowTimeline(p => !p)} style={{
            width: '100%', padding: '6px 8px', flexShrink: 0,
            background: showTimeline ? 'rgba(167,139,250,0.12)' : 'transparent',
            border: `1px solid ${showTimeline ? 'var(--accent-purple)' : 'var(--border-accent)'}`,
            color: showTimeline ? 'var(--accent-purple)' : 'var(--text-muted)',
            fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 600,
            letterSpacing: '.08em', textTransform: 'uppercase',
            borderRadius: '3px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all .15s',
          }}>
            <span>⏱ Time-Travel</span>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>
              {activeHistory.length > 0 ? `${activeHistory.length} snap` : '—'}
            </span>
          </button>

          {timeTravelIdx !== null && (
            <div style={{ marginTop: '6px', padding: '5px 8px', flexShrink: 0, background: 'rgba(210,153,34,0.1)', border: '1px solid rgba(210,153,34,0.4)', borderRadius: '3px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-yellow)' }}>
              <div>⏪ Snapshot #{timeTravelIdx + 1}</div>
              {timeTravelInfo && <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{timeTravelInfo.author} · {formatTime(timeTravelInfo.timestamp)}</div>}
              <button onClick={handleReturnToLive} style={{ marginTop: '4px', width: '100%', background: 'transparent', border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)', fontFamily: 'var(--font-ui)', fontSize: '10px', padding: '2px 0', borderRadius: '2px', cursor: 'pointer' }}>
                ▶ Înapoi la LIVE
              </button>
            </div>
          )}

          {showTimeline && (
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', flex: 1 }}>
              {activeHistory.length === 0 ? (
                <div style={{ padding: '8px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontStyle: 'italic' }}>
                  Niciun snapshot pentru acest fișier
                </div>
              ) : (
                <>
                  <button onClick={handleReturnToLive} style={{
                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '5px 8px', flexShrink: 0,
                    background: timeTravelIdx === null ? 'rgba(63,185,80,0.12)' : 'transparent',
                    border: `1px solid ${timeTravelIdx === null ? 'var(--accent-green)' : 'var(--border-accent)'}`,
                    borderRadius: '3px', cursor: 'pointer',
                    color: timeTravelIdx === null ? 'var(--accent-green)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, letterSpacing: '.06em', transition: 'all .12s',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', flexShrink: 0 }} />
                    LIVE
                  </button>

                  {[...activeHistory].reverse().map((snap, revIdx) => {
                    const idx      = activeHistory.length - 1 - revIdx;
                    const isActive = timeTravelIdx === idx;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button onClick={() => handleTimeTravel(idx)}
                          title={`${snap.author} · ${formatTime(snap.timestamp)}`}
                          style={{
                            flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px',
                            background: isActive ? 'rgba(167,139,250,0.15)' : 'transparent',
                            border: `1px solid ${isActive ? 'var(--accent-purple)' : 'var(--border-accent)'}`,
                            borderRadius: '3px', cursor: 'pointer', transition: 'all .12s',
                          }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: isActive ? 'var(--accent-purple)' : 'var(--text-dim)', minWidth: '22px', flexShrink: 0 }}>#{idx + 1}</span>
                          <span style={{ flex: 1, overflow: 'hidden' }}>
                            <span style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 600, color: isActive ? 'var(--accent-purple)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{snap.author}</span>
                            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)' }}>{formatTime(snap.timestamp)}</span>
                          </span>
                          {isActive && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-purple)', flexShrink: 0 }} />}
                        </button>
                        <button onClick={e => handleDeleteSnapshot(e, idx)}
                          style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: 'var(--accent-red)', width: '28px', height: '28px', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,81,73,0.22)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,81,73,0.1)'}
                        >✕</button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Info cont */}
        <div style={{ flexShrink: 0, padding: '10px 16px', borderTop: '1px solid #21262d', fontSize: 11, color: '#7d8590', fontFamily: "'Rajdhani', sans-serif" }}>
          <div>📧 {authUser.email}</div>
          {authUser.phone && <div>📞 {authUser.phone}</div>}
        </div>

        <div className="sidebar-footer" style={{ flexShrink: 0, marginTop: 0, borderTop: 'none' }}>
          <div>Status Server:</div>
          <div className={status.includes('✅') ? 'status-online' : 'status-offline'}>{status}</div>
        </div>
      </aside>

      {/* ══ MAIN ═══════════════════════════════════════════════ */}
      <main className="main-content">

        {/* HEADER */}
        <header className="workspace-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <strong>iTECify</strong>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: '3px', padding: '1px 7px' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-green)', animation: 'pulse-green 2.4s ease-in-out infinite' }} />
              {humanUsersOnline} {humanUsersOnline === 1 ? 'dev' : 'devs'}
            </span>
            <span style={{ 
              fontSize: '11px', 
              fontFamily: 'var(--font-mono)', 
              color: '#cbd5e1', /* Un gri deschis, foarte vizibil */
              background: 'rgba(255, 255, 255, 0.08)', /* Un fundal ușor transparent */
              padding: '2px 8px', 
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              📝 {lineCount} linii
            </span>
            {timeTravelIdx !== null && (
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-yellow)', border: '1px solid var(--accent-yellow)', borderRadius: '3px', padding: '1px 6px' }}>
                ⏪ TIME-TRAVEL
              </span>
            )}
          </div>
          <div className="header-controls">
            <button onClick={handleSaveSnapshot} title="Salvează snapshot (Ctrl+S)"
              style={{ background: 'rgba(57,208,240,0.1)', border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: '3px', cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: '5px' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-cyan)'; e.currentTarget.style.color = '#0a0c10'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(57,208,240,0.1)'; e.currentTarget.style.color = 'var(--accent-cyan)'; }}
            >💾 Save</button>
            <button onClick={handleExportCode} title="Descarcă fișierul"
    style={{ background: 'rgba(57,208,240,0.1)', border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: '3px', cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: '5px' }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-cyan)'; e.currentTarget.style.color = '#0a0c10'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(57,208,240,0.1)'; e.currentTarget.style.color = 'var(--accent-cyan)'; }}
  >⬇ Export</button>
            <select className="lang-select" value={language} onChange={e => handleLanguageChange(e.target.value)}>
              {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <button onClick={handleRunCode} className="run-btn" disabled={isRunning} style={{ opacity: isRunning ? 0.6 : 1 }}>
              {isRunning ? '⟳ Running...' : '▶ Run'}
            </button>
          </div>
        </header>

        {/* EDITOR */}
        <div className="editor-wrapper" style={{ position: 'relative' }} ref={editorWrapRef}>
          <Editor
            height="100%"
            theme="vs-dark"
            language={LANGUAGES.find(l => l.id === language)?.monaco || 'javascript'}
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{ fontSize: 14, minimap: { enabled: false }, readOnly: timeTravelIdx !== null }}
          />

          {timeTravelIdx !== null && (
            <div style={{ position: 'absolute', top: 8, left: 8, pointerEvents: 'none', zIndex: 10, background: 'rgba(210,153,34,0.15)', border: '1px solid var(--accent-yellow)', borderRadius: '4px', padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-yellow)' }}>
              ⏪ Snapshot #{timeTravelIdx + 1}
              {timeTravelInfo && ` — ${timeTravelInfo.author} · ${formatTime(timeTravelInfo.timestamp)}`}
            </div>
          )}

          {overEditor && aiBlock && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, border: '2px dashed var(--accent-purple)', borderRadius: '4px', background: 'rgba(167,139,250,0.05)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '16px' }}>
              <span style={{ background: 'rgba(167,139,250,0.9)', color: '#0a0c10', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '4px' }}>
                ⬇ Lasă pentru a insera cod
              </span>
            </div>
          )}
        </div>

        {/* BLOC AI */}
        {aiBlock && (
          <div id="ai-block-overlay" className="ai-block-overlay" style={aiOverlayStyle} onMouseDown={handleAIBlockMouseDown}>
            <div style={{ position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)', width: '32px', height: '3px', background: 'rgba(167,139,250,0.4)', borderRadius: '2px', cursor: 'grab' }} />
            <div className="ai-block-header" style={{ paddingTop: '16px' }}>
              <span style={{ color: aiBlock.color, fontWeight: 700 }}>🤖 AI Agent</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="ai-block-label">Sugestie de cod</span>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>⠿ drag → editor</span>
              </span>
            </div>
            <pre className="ai-block-code">{aiBlock.code}</pre>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid rgba(167,139,250,.15)' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-accept" onClick={handleAcceptAI}>✓ Acceptă</button>
                <button className="btn-refuse" onClick={handleRefuseAI}>✕ Refuză</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--accent-purple)' }}>→ L{aiBlock.insertLine}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <button onMouseDown={e => e.stopPropagation()} onClick={moveAITargetUp}   style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', color: 'var(--text-primary)', cursor: 'pointer', padding: '0 5px', borderRadius: '2px', fontSize: '9px', lineHeight: '14px' }}>▲</button>
                  <button onMouseDown={e => e.stopPropagation()} onClick={moveAITargetDown} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', color: 'var(--text-primary)', cursor: 'pointer', padding: '0 5px', borderRadius: '2px', fontSize: '9px', lineHeight: '14px' }}>▼</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI BAR */}
        <div className="ai-bar">
          <span className="ai-bar-icon" style={{ color: '#a78bfa' }}>🤖</span>
          <input className="ai-bar-input" type="text"
            placeholder={isAiTyping ? "AI Agent scrie..." : "Cere ceva AI-ului... (ex: o funcție de sortare)"}
            value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAskAI()} disabled={isAiTyping}
          />
          <button className={`ai-bar-btn ${isAiTyping ? 'ai-bar-btn--loading' : ''}`} onClick={handleAskAI} disabled={isAiTyping}>
            {isAiTyping ? '...' : 'Ask'}
          </button>
        </div>

        {/* TERMINAL */}
        <footer className="terminal-section">
          <div className="terminal-header">
            $ TERMINAL OUTPUT
            {isRunning && (
              <span style={{ marginLeft: '10px', fontSize: '10px', color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', animation: 'pulse-green 1s ease-in-out infinite' }}>
                ● streaming...
              </span>
            )}
            <button onClick={() => setOutput('')}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '10px', letterSpacing: '.06em', padding: '0 4px' }}
              title="Curăță terminalul">CLR</button>
          </div>
          <pre className="terminal-content" ref={terminalRef}>{output}</pre>
        </footer>

      </main>
    </div>
  );
}
