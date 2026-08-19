// 浏览器端聊天页 HTML（访问 http://<ip>:<port>/ 时返回）
// 内部 JS 全程使用引号拼接，避免反引号/插值与外层模板字符串冲突

export function chatPageHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>文件传输</title>
<style>
  :root{ color-scheme:light dark; --bg:#f5f5f7; --card:rgba(255,255,255,.72); --text:#1d1d1f; --muted:#6e6e73; --line:rgba(60,60,67,.12); --accent:#007aff; --me:#007aff; --metext:#fff; --bubble-other:rgba(255,255,255,.9); --bubble-text-other:#1d1d1f }
  @media (prefers-color-scheme: dark){ :root{ --bg:#0b0d12; --card:rgba(28,30,40,.72); --text:#f5f5f7; --muted:#9a9aa3; --line:rgba(255,255,255,.1); --accent:#3b82f6; --me:#0a84ff; --metext:#fff; --bubble-other:rgba(40,42,52,.9); --bubble-text-other:#f5f5f7 } }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent }
  html,body{ height:100%; margin:0 }
  body{ display:flex; flex-direction:column; height:100dvh; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC",sans-serif }
  header{ display:flex; align-items:center; gap:8px; padding:14px 16px; padding-top:calc(14px + env(safe-area-inset-top)); border-bottom:1px solid var(--line); background:var(--card); backdrop-filter:blur(20px) saturate(140%); -webkit-backdrop-filter:blur(20px) saturate(140%) }
  header .title{ font-size:17px; font-weight:600; flex:1 }
  .status{ font-size:13px; display:flex; align-items:center; gap:5px }
  .status.on{ color:#34c759 }
  .status.off{ color:var(--muted) }
  main{ flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:14px 14px 24px; display:flex; flex-direction:column; gap:10px }
  .msg{ display:flex; width:100% }
  .msg.me{ justify-content:flex-end }
  .msg.other{ justify-content:flex-start }
  .bubble{ max-width:78%; padding:10px 14px; border-radius:18px; font-size:16px; line-height:1.42; word-break:break-word; white-space:pre-wrap; box-shadow:0 1px 2px rgba(0,0,0,.08) }
  .bubble.text{ background:var(--bubble-other); color:var(--bubble-text-other) }
  .msg.me .bubble.text{ background:var(--me); color:var(--metext) }
  .bubble.file{ display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--bubble-other); color:var(--bubble-text-other) }
  .msg.me .bubble.file{ background:var(--me); color:var(--metext) }
  .bubble.file.image{ flex-direction:column; padding:6px; gap:8px; align-items:stretch }
  .bubble.file.image img{ width:100%; max-width:220px; border-radius:12px; display:block }
  .bubble.file .meta{ font-size:12px; opacity:.8; margin-top:4px }
  .ficon{ font-size:22px }
  .finame{ font-weight:500 }
  .fsize{ font-size:12px; opacity:.7 }
  .dlbtn{ text-decoration:none; color:inherit; font-size:13px; padding:6px 12px; border-radius:10px; background:rgba(120,120,128,.18); white-space:nowrap }
  .msg.me .dlbtn{ background:rgba(255,255,255,.25) }
  footer{ display:flex; gap:8px; align-items:center; padding:10px 12px; padding-bottom:calc(10px + env(safe-area-inset-bottom)); border-top:1px solid var(--line); background:var(--card); backdrop-filter:blur(20px) saturate(140%); -webkit-backdrop-filter:blur(20px) saturate(140%) }
  footer input[type="text"]{ flex:1; font-size:16px; padding:10px 14px; border-radius:18px; border:1px solid var(--line); background:transparent; color:var(--text); outline:none }
  footer button{ border:none; background:var(--accent); color:#fff; padding:10px 16px; border-radius:18px; font-size:15px; font-weight:600 }
  footer .icon{ background:transparent; color:var(--accent); padding:8px 10px; font-size:24px; line-height:1 }
  footer button:active{ opacity:.7 }
  .pair-gate{ position:fixed; inset:0; z-index:10; display:flex; align-items:center; justify-content:center; padding:24px; background:var(--bg) }
  .pair-card{ width:min(100%,360px); padding:26px 22px; border:1px solid var(--line); border-radius:24px; background:var(--card); box-shadow:0 16px 48px rgba(0,0,0,.12); text-align:center }
  .pair-icon{ font-size:42px; margin-bottom:10px }
  .pair-card h1{ margin:0 0 8px; font-size:23px }
  .pair-card p{ margin:0 0 20px; color:var(--muted); font-size:14px; line-height:1.5 }
  .pair-card input[type="text"]{ width:100%; border:1px solid var(--line); border-radius:15px; padding:13px 12px; background:transparent; color:var(--text); font-size:24px; font-weight:600; text-align:center; letter-spacing:.28em; outline:none }
  .pair-card input[type="text"]:focus{ border-color:var(--accent); box-shadow:0 0 0 3px rgba(0,122,255,.14) }
  .remember{ display:flex; align-items:center; justify-content:center; gap:8px; margin-top:14px; color:var(--muted); font-size:14px }
  .remember input{ width:18px; height:18px; accent-color:var(--accent) }
  .pair-card button{ width:100%; margin-top:12px; border:0; border-radius:15px; padding:13px; background:var(--accent); color:#fff; font-size:16px; font-weight:600 }
  .pair-card button:disabled{ opacity:.55 }
  .pair-error{ min-height:20px; margin-top:10px; color:#ff3b30; font-size:13px }
  body.paired .pair-gate{ display:none }
</style>
</head>
<body>
<section id="pairGate" class="pair-gate" aria-label="配对认证">
  <form id="pairForm" class="pair-card">
    <div class="pair-icon">🔐</div>
    <h1>与设备配对</h1>
    <p>请输入 Scripting 设备上显示的 6 位配对码</p>
    <input id="pairInput" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" aria-label="6 位配对码">
    <label class="remember"><input id="rememberInput" type="checkbox" checked> 信任此浏览器，下次自动连接</label>
    <button id="pairBtn" type="submit">配对</button>
    <div id="pairError" class="pair-error" role="alert"></div>
  </form>
</section>
<header>
  <div class="title">文件传输</div>
  <div id="status" class="status off">● 等待配对…</div>
</header>
<main id="messages"></main>
<footer>
  <button id="attachBtn" class="icon">+</button>
  <input id="fileInput" type="file" multiple hidden>
  <input id="textInput" type="text" placeholder="说点什么…">
  <button id="sendBtn">发送</button>
</footer>
<script>
var messagesEl = document.getElementById('messages');
var textInput = document.getElementById('textInput');
var sendBtn = document.getElementById('sendBtn');
var attachBtn = document.getElementById('attachBtn');
var fileInput = document.getElementById('fileInput');
var statusEl = document.getElementById('status');
var pairForm = document.getElementById('pairForm');
var pairInput = document.getElementById('pairInput');
var rememberInput = document.getElementById('rememberInput');
var pairBtn = document.getElementById('pairBtn');
var pairError = document.getElementById('pairError');
var authToken = sessionStorage.getItem('lan-transfer-token') || '';
var resuming = false;

function deviceName(){
  var platform = navigator.userAgentData && navigator.userAgentData.platform;
  return String(platform || navigator.platform || '浏览器').slice(0, 60);
}

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function fmtSize(b){ b = b || 0; if (b < 1024) return b + ' B'; var u = ['KB','MB','GB','TB']; var i = Math.min(Math.floor(Math.log(b) / Math.log(1024)) - 1, u.length - 1); return (b / Math.pow(1024, i + 1)).toFixed(b >= Math.pow(1024, i + 2) ? 1 : 0) + ' ' + u[i]; }
function isImage(mime){ return String(mime || '').toLowerCase().indexOf('image/') === 0; }

function addMessage(m){
  var wrap = document.createElement('div');
  wrap.className = 'msg ' + (m.role === 'browser' ? 'me' : 'other');
  var inner = '';
  if (m.kind === 'text'){
    inner = '<div class="bubble text">' + esc(m.text || '') + '</div>';
  } else if (isImage(m.mime)){
    inner = '<div class="bubble file image"><img src="' + esc(m.url || '') + '" alt="' + esc(m.fileName || '') + '"><div class="meta">' + esc(m.fileName || '图片') + ' · ' + fmtSize(m.fileSize) + '</div></div>';
  } else {
    inner = '<div class="bubble file"><div class="ficon">📎</div><div class="finame">' + esc(m.fileName || '文件') + '</div><div class="fsize">' + fmtSize(m.fileSize) + '</div><a class="dlbtn" href="' + esc(m.url || '') + '" download="' + esc(m.fileName || '') + '">下载</a></div>';
  }
  wrap.innerHTML = inner;
  messagesEl.appendChild(wrap);
  wrap.scrollIntoView({ behavior: 'smooth' });
}

var ws = null, reconnectTimer = null;
function connect(){
  if (!authToken) return;
  try { ws = new WebSocket((location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/ws'); }
  catch (e){ scheduleReconnect(); return; }
  ws.onopen = function(){ ws.send(JSON.stringify({ type: 'auth', token: authToken })); };
  ws.onclose = function(){ setStatus(false); scheduleReconnect(); };
  ws.onerror = function(){};
  ws.onmessage = function(ev){ handleIncoming(ev.data); };
}
function scheduleReconnect(){ if (!authToken || reconnectTimer) return; reconnectTimer = setTimeout(function(){ reconnectTimer = null; connect(); }, 2000); }
function setStatus(on){ statusEl.textContent = on ? '● 已连接到设备' : '● 正在连接设备…'; statusEl.className = 'status ' + (on ? 'on' : 'off'); }

function handleIncoming(raw){
  var p; try { p = JSON.parse(raw); } catch (e){ return; }
  if (p.type === 'auth_ok'){ setStatus(true); }
  else if (p.type === 'auth_error'){
    resumeTrusted(true);
  }
  else if (p.role === 'app' && p.type === 'text'){ addMessage({ role: 'app', kind: 'text', text: p.text }); }
  else if (p.role === 'app' && p.type === 'file'){ addMessage({ role: 'app', kind: 'file', fileName: p.fileName, fileSize: p.fileSize, mime: p.mime, url: location.origin + p.url }); }
}

pairInput.addEventListener('input', function(){ pairInput.value = pairInput.value.replace(/\\D/g, '').slice(0, 6); pairError.textContent = ''; });
pairForm.onsubmit = function(e){
  e.preventDefault();
  var code = pairInput.value.trim();
  if (!/^\\d{6}$/.test(code)){ pairError.textContent = '请输入 6 位数字配对码'; return; }
  pairBtn.disabled = true;
  pairError.textContent = '';
  fetch('/pair', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: code, remember: rememberInput.checked, deviceName: deviceName() })
  }).then(function(res){ return res.json().catch(function(){ return {}; }).then(function(body){ return { status: res.status, body: body }; }); })
    .then(function(result){
      if (result.status !== 200 || !result.body.token) throw new Error(result.body.error || '配对失败');
      authToken = result.body.token;
      sessionStorage.setItem('lan-transfer-token', authToken);
      document.body.classList.add('paired');
      pairInput.value = '';
      connect();
    })
    .catch(function(err){ pairError.textContent = err.message || '配对失败'; })
    .then(function(){ pairBtn.disabled = false; });
};

function clearPairing(message){
  authToken = '';
  sessionStorage.removeItem('lan-transfer-token');
  document.body.classList.remove('paired');
  pairError.textContent = message || '';
  statusEl.textContent = '● 等待配对…';
  statusEl.className = 'status off';
  if (reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws){ try { ws.close(); } catch (e){} ws = null; }
  pairInput.focus();
}

function resumeTrusted(showError){
  if (resuming) return;
  resuming = true;
  authToken = '';
  sessionStorage.removeItem('lan-transfer-token');
  if (reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws){ try { ws.close(); } catch (e){} ws = null; }
  statusEl.textContent = '● 正在恢复受信任会话…';
  statusEl.className = 'status off';
  fetch('/resume', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceName: deviceName() })
  }).then(function(res){ return res.json().catch(function(){ return {}; }).then(function(body){ return { status: res.status, body: body }; }); })
    .then(function(result){
      if (result.status !== 200 || !result.body.token) throw new Error(result.body.error || '自动连接失败');
      authToken = result.body.token;
      sessionStorage.setItem('lan-transfer-token', authToken);
      document.body.classList.add('paired');
      connect();
    })
    .catch(function(err){
      clearPairing(showError ? (err.message || '自动连接失败，请重新配对') : '');
    })
    .then(function(){ resuming = false; });
}

function authorizedFetch(url, options){
  options = options || {};
  options.headers = Object.assign({}, options.headers || {}, { authorization: 'Bearer ' + authToken });
  return fetch(url, options).then(function(res){
    if (res.status === 401){ clearPairing('配对会话已失效，请重新配对'); throw new Error('未授权'); }
    if (!res.ok) throw new Error('请求失败（' + res.status + '）');
    return res;
  });
}

function sendText(){
  var t = textInput.value.trim();
  if (!t || !ws || ws.readyState !== 1) return;
  var id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  ws.send(JSON.stringify({ type: 'text', text: t, id: id, ts: Date.now() }));
  addMessage({ role: 'browser', kind: 'text', text: t });
  textInput.value = '';
}
sendBtn.onclick = sendText;
textInput.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendText(); } });

attachBtn.onclick = function(){ fileInput.click(); };
fileInput.onchange = function(){
  var files = Array.prototype.slice.call(fileInput.files || []);
  fileInput.value = '';
  files.forEach(uploadFile);
};
function uploadFile(file){
  addMessage({ role: 'browser', kind: 'file', fileName: file.name, fileSize: file.size, mime: file.type, url: URL.createObjectURL(file) });
  // 直传原始字节（服务端 multipart 解析不可用），文件名走查询参数、类型走 content-type
  authorizedFetch('/upload?name=' + encodeURIComponent(file.name || '未命名'), {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file
  }).catch(function(){});
}

if (authToken){ document.body.classList.add('paired'); connect(); }
else { document.body.classList.add('paired'); resumeTrusted(false); }
</script>
</body>
</html>`;
}
