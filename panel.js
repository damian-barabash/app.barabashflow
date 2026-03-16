/* BARABASH FLOW — panel.js v8 */
const SB   = 'https://ztcyhlitwwganjhgbbtm.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Y3lobGl0d3dnYW5qaGdiYnRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTg5NTUsImV4cCI6MjA4NzY3NDk1NX0.7vjhHT3n8DTuXHbfvGIBoA6wxWtcgDoIJ_UfNamg0Zs';
const EDGE = SB + '/functions/v1';
const LOGO_URL = SB + '/storage/v1/object/public/assets/logo.png';

/* ── AUTH ── */
const Auth = {
  get token()  { return localStorage.getItem('bf_token'); },
  get userId() { return localStorage.getItem('bf_uid'); },
  get role()   { return localStorage.getItem('bf_role'); },
  get name()   { return localStorage.getItem('bf_name'); },
  get email()  { return localStorage.getItem('bf_email'); },
  get exp()    { return Number(localStorage.getItem('bf_exp')||0); },
  isValid()    { return !!(this.token && this.role && this.exp && Date.now() < this.exp); },
  requireAdmin()  { if (!this.isValid() || this.role !== 'admin')  { location.href='login.html'; return false; } return true; },
  requireClient() { if (!this.isValid() || this.role !== 'client') { location.href='login.html'; return false; } return true; },
  clear() { ['bf_token','bf_uid','bf_role','bf_name','bf_email','bf_exp'].forEach(k=>localStorage.removeItem(k)); },
  async logout() {
    try { await fetch(SB+'/auth/v1/logout',{method:'POST',headers:{apikey:ANON,Authorization:'Bearer '+this.token}}); } catch(_){}
    this.clear(); location.href='login.html';
  }
};

/* ── HTTP ── */
function hdr(x={}) { return {apikey:ANON, Authorization:'Bearer '+Auth.token, 'Content-Type':'application/json', ...x}; }
async function dbGet(table, qs='') {
  const r = await fetch(`${SB}/rest/v1/${table}${qs}`, {headers:hdr({Accept:'application/json'})});
  if (r.status===401) { Auth.clear(); location.href='login.html'; return []; }
  const d = await r.json(); return Array.isArray(d) ? d : [];
}
async function dbPost(table, body) {
  const r = await fetch(`${SB}/rest/v1/${table}`, {method:'POST', headers:hdr({Prefer:'return=representation'}), body:JSON.stringify(body)});
  const d = await r.json(); return Array.isArray(d) ? d[0] : d;
}
async function dbPatch(table, filter, body) {
  const r = await fetch(`${SB}/rest/v1/${table}?${filter}`, {method:'PATCH', headers:hdr({Prefer:'return=representation'}), body:JSON.stringify(body)});
  const d = await r.json(); return Array.isArray(d) ? d[0] : d;
}
async function edgeFn(fn, body) {
  const r = await fetch(`${EDGE}/${fn}`, {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+Auth.token}, body:JSON.stringify(body)});
  return r.json();
}

/* ── PROFILES CACHE ── */
const _profileCache = {};
async function loadProfiles(userIds) {
  const missing = [...new Set(userIds)].filter(id => id && !_profileCache[id]);
  if (!missing.length) return;
  const profiles = await dbGet('profiles', `?id=in.(${missing.join(',')})&select=id,display_name,email,role`);
  profiles.forEach(p => { _profileCache[p.id] = p; });
  missing.forEach(id => { if (!_profileCache[id]) _profileCache[id] = {id, display_name:null, email:null, role:'client'}; });
}
function getProfile(userId) { return _profileCache[userId] || null; }

/* ── FILE UPLOAD ── */
async function uploadFile(file, bucket) {
  const ext  = file.name.split('.').pop();
  const name = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const r = await fetch(`${SB}/storage/v1/object/${bucket}/${name}`, {
    method:'POST',
    headers:{apikey:ANON, Authorization:'Bearer '+Auth.token, 'Content-Type':file.type||'application/octet-stream'},
    body:file
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.message||'Upload failed'); }
  return {url:`${SB}/storage/v1/object/public/${bucket}/${name}`, name:file.name, size:file.size, mime:file.type};
}

/* ── FILE PREVIEW (posts/docs) ── */
function renderFilePreview(url, name, mime) {
  if (!url) return '';
  const isImg = mime && mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';
  if (isImg) return `<div class="file-preview"><img class="img-thumb" src="${esc(url)}" alt="${esc(name)}" onclick="openLightbox('img','${esc(url)}')"></div>`;
  if (isPdf) return `<div class="file-preview pdf-preview">
    <div class="pdf-icon">📄</div>
    <div class="pdf-name" title="${esc(name)}">${esc(name||'Dokument PDF')}</div>
    <button class="btn btn-sm btn-outline" onclick="openLightbox('pdf','${esc(url)}')"><i class="ri-eye-line"></i> Podgląd</button>
    <a href="${esc(url)}" download="${esc(name)}" class="btn btn-sm btn-primary"><i class="ri-download-line"></i></a>
  </div>`;
  return `<div class="file-preview"><div class="file-chip">
    <i class="ri-file-line"></i><span>${esc(name||'Plik')}</span>
    <a href="${esc(url)}" download="${esc(name)}" class="btn btn-sm btn-primary" style="margin-left:8px"><i class="ri-download-line"></i> Pobierz</a>
  </div></div>`;
}

/* ── LINK DETECTION ──
   Detects URLs in text and wraps them in <a> tags.
   Returns a DocumentFragment so content is safe (no XSS). */
function makeTextWithLinks(text) {
  const URL_RE = /https?:\/\/[^\s<>"']+/g;
  const fragment = document.createDocumentFragment();
  let last = 0;
  let match;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) {
      fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
    }
    const a = document.createElement('a');
    a.href = match[0];
    a.textContent = match[0];
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'chat-link';
    fragment.appendChild(a);
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(last)));
  }
  return fragment;
}

/* ── PRELOADED LOGO (no flicker) ── */
const _logoImgCache = (() => { const img = new Image(); img.src = LOGO_URL; return img; })();

/* ── AVATAR ── */
function makeMsgAvatar(senderId) {
  const profile = getProfile(senderId);
  const isAdmin = profile?.role === 'admin';
  const name    = profile?.display_name || profile?.email || '';
  const div = document.createElement('div');
  div.className = 'msg-av';
  if (isAdmin) {
    div.style.cssText = 'background:transparent;padding:0;overflow:hidden;flex-shrink:0;border-radius:50%';
    const img = _logoImgCache.cloneNode();
    img.style.cssText = 'width:30px;height:30px;border-radius:50%;object-fit:cover;display:block';
    img.alt = name || 'Admin';
    img.addEventListener('error', () => {
      img.remove();
      div.style.cssText = 'background:linear-gradient(135deg,#9b27af,#e040fb)';
      div.textContent = initials(name) || 'D';
    });
    div.appendChild(img);
  } else {
    div.style.background = 'linear-gradient(135deg,#5b21b6,#7c3aed)';
    div.textContent = initials(name) || '?';
  }
  return div;
}

/* ── BUILD MSG ELEMENT ── */
function buildMsgEl(m, reads, currentUserId) {
  const isMe    = m.sender_id === currentUserId;
  const profile = getProfile(m.sender_id);
  const isAdmin = profile?.role === 'admin';

  if (m.type === 'system') {
    const div = document.createElement('div');
    div.className = 'chat-system';
    div.textContent = m.content;
    return div;
  }

  const senderName = isAdmin
    ? (profile?.display_name || 'Dmytrii Barabash')
    : (profile?.display_name || profile?.email || 'Klient');

  const wrapper = document.createElement('div');
  wrapper.className = 'msg' + (isMe ? ' mine' : '');
  wrapper.dataset.msgId = m.id;

  const av = makeMsgAvatar(m.sender_id);

  const content = document.createElement('div');
  content.className = 'msg-content';

  const senderEl = document.createElement('div');
  senderEl.className = 'msg-sender';
  senderEl.textContent = senderName;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  // ── File attachment in message ──
  if (m.file_url) {
    const mime = m.mime_type || '';
    const isImg = mime.startsWith('image/');
    const isPdf = mime === 'application/pdf';

    if (isImg) {
      const img = document.createElement('img');
      img.src = m.file_url;
      img.className = 'chat-img-attachment';
      img.alt = m.file_name || 'image';
      img.addEventListener('click', () => openLightbox('img', m.file_url));
      bubble.appendChild(img);
    } else if (isPdf) {
      const fileChip = _makeFileChip('📄', m.file_name||'Dokument', m.file_url, m.file_size);
      const previewBtn = document.createElement('button');
      previewBtn.className = 'btn btn-sm btn-outline';
      previewBtn.style.marginLeft = '8px';
      previewBtn.innerHTML = '<i class="ri-eye-line"></i>';
      previewBtn.addEventListener('click', () => openLightbox('pdf', m.file_url));
      fileChip.appendChild(previewBtn);
      bubble.appendChild(fileChip);
    } else {
      bubble.appendChild(_makeFileChip('📎', m.file_name||'Plik', m.file_url, m.file_size));
    }
    // Optional text caption after file
    if (m.content) {
      const cap = document.createElement('div');
      cap.style.marginTop = '6px';
      cap.appendChild(makeTextWithLinks(m.content));
      bubble.appendChild(cap);
    }
  } else if (m.content) {
    // ── Text with link detection ──
    bubble.appendChild(makeTextWithLinks(m.content));
  }

  const timeRow = document.createElement('div');
  timeRow.className = 'msg-time';
  const timeSpan = document.createElement('span');
  timeSpan.textContent = timeAgo(m.created_at);
  timeRow.appendChild(timeSpan);

  // Read receipt
  if (isMe) {
    const isRead = reads && reads.some(r => r.message_id === m.id && r.user_id !== currentUserId);
    const rcpt = document.createElement('span');
    rcpt.className = 'msg-reads' + (isRead ? ' read' : '');
    rcpt.dataset.receipt = 'true';
    rcpt.textContent = isRead ? ' ✓✓' : ' ✓';
    rcpt.title = isRead ? 'Przeczytano' : 'Wysłano';
    timeRow.appendChild(rcpt);
  }

  content.appendChild(senderEl);
  content.appendChild(bubble);
  content.appendChild(timeRow);
  wrapper.appendChild(av);
  wrapper.appendChild(content);
  return wrapper;
}

function _makeFileChip(icon, name, url, size) {
  const chip = document.createElement('div');
  chip.className = 'chat-file-chip';
  chip.innerHTML = `<span style="font-size:20px">${icon}</span>`;
  const info = document.createElement('div');
  info.className = 'chat-file-info';
  const nameEl = document.createElement('div');
  nameEl.className = 'chat-file-name';
  nameEl.textContent = name;
  const sizeEl = document.createElement('div');
  sizeEl.className = 'chat-file-size';
  sizeEl.textContent = fmtSize(size);
  info.appendChild(nameEl);
  info.appendChild(sizeEl);
  const dlBtn = document.createElement('a');
  dlBtn.href = url;
  dlBtn.download = name;
  dlBtn.target = '_blank';
  dlBtn.className = 'btn btn-sm btn-primary';
  dlBtn.innerHTML = '<i class="ri-download-line"></i>';
  chip.appendChild(info);
  chip.appendChild(dlBtn);
  return chip;
}

/* ── SMART DIFF CHAT RENDER ── */
let _chatState = { projectId: null, msgIds: [], readMap: {} };

async function renderChat(projectId, currentUserId, boxId) {
  const [msgs, reads] = await Promise.all([
    dbGet('messages', `?project_id=eq.${projectId}&select=id,content,type,sender_id,created_at,file_url,file_name,file_size,mime_type&order=created_at.asc`),
    dbGet('message_reads', `?select=message_id,user_id`)
  ]);

  const senderIds = [...new Set(msgs.map(m => m.sender_id).filter(Boolean))];
  await loadProfiles(senderIds);

  const box = document.getElementById(boxId);
  if (!box) return msgs.length;

  const newReadMap = {};
  msgs.forEach(m => {
    if (m.sender_id === currentUserId)
      newReadMap[m.id] = reads.some(r => r.message_id === m.id && r.user_id !== currentUserId);
  });

  const newMsgIds = msgs.map(m => m.id).join(',');
  const prevIds   = (_chatState.msgIds||[]).join(',');
  const sameProject = _chatState.projectId === projectId;
  const sameMsgs    = sameProject && newMsgIds === prevIds;

  if (sameMsgs) {
    // Only update receipts in place
    msgs.forEach(m => {
      if (m.sender_id !== currentUserId) return;
      const isRead  = newReadMap[m.id];
      const wasRead = _chatState.readMap[m.id];
      if (isRead !== wasRead) {
        const msgEl = box.querySelector(`[data-msg-id="${m.id}"]`);
        if (msgEl) {
          const rcpt = msgEl.querySelector('[data-receipt]');
          if (rcpt) {
            rcpt.className = 'msg-reads' + (isRead ? ' read' : '');
            rcpt.textContent = isRead ? ' ✓✓' : ' ✓';
            rcpt.title = isRead ? 'Przeczytano' : 'Wysłano';
          }
        }
      }
    });
    _chatState.readMap = newReadMap;
    return msgs.length;
  }

  // Full redraw
  const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  const prevCount   = _chatState.msgIds ? _chatState.msgIds.length : 0;
  _chatState = { projectId, msgIds: msgs.map(m => m.id), readMap: newReadMap };

  box.innerHTML = '';
  msgs.forEach((m, i) => {
    const el = buildMsgEl(m, reads, currentUserId);
    // Animate only NEW messages (not full history reload)
    if (sameProject && i >= prevCount) {
      el.classList.add('msg-entering');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('msg-entered')));
    }
    box.appendChild(el);
  });
  if (wasAtBottom || !sameProject) box.scrollTop = box.scrollHeight;

  return msgs.length;
}

/* ── TYPING INDICATOR ──
   Sends heartbeat to typing_indicators table while user types.
   Polls for other users typing and shows animated dots. */
let _typingTimer = null;
let _isTyping    = false;

async function setTyping(projectId, typing) {
  if (typing === _isTyping) return;
  _isTyping = typing;
  try {
    if (typing) {
      await fetch(`${SB}/rest/v1/typing_indicators`, {
        method: 'POST',
        headers: hdr({Prefer:'resolution=merge-duplicates'}),
        body: JSON.stringify({user_id:Auth.userId, project_id:projectId, updated_at:new Date().toISOString()})
      });
    } else {
      await fetch(`${SB}/rest/v1/typing_indicators?user_id=eq.${Auth.userId}&project_id=eq.${projectId}`, {
        method: 'DELETE', headers: hdr()
      });
    }
  } catch(_) {}
}

function onChatInputKey(e, projectId) {
  if (e.key === 'Enter' && !e.shiftKey) return; // sending, handled elsewhere
  // Start typing
  setTyping(projectId, true);
  // Auto-stop after 3 seconds of no typing
  clearTimeout(_typingTimer);
  _typingTimer = setTimeout(() => setTyping(projectId, false), 3000);
}

async function pollTyping(projectId, currentUserId, indicatorId) {
  const cutoff = new Date(Date.now() - 5000).toISOString(); // active in last 5s
  const rows = await dbGet('typing_indicators',
    `?project_id=eq.${projectId}&user_id=neq.${currentUserId}&updated_at=gte.${cutoff}&select=user_id`);

  const el = document.getElementById(indicatorId);
  if (!el) return;

  if (rows.length > 0) {
    await loadProfiles(rows.map(r => r.user_id));
    const names = rows.map(r => {
      const p = getProfile(r.user_id);
      return p?.display_name || p?.email || 'Ktoś';
    });
    const label = names.join(', ') + (names.length===1 ? ' pisze...' : ' piszą...');
    el.innerHTML = `<div class="typing-indicator"><span>${esc(label)}</span><span class="typing-dots"><span></span><span></span><span></span></span></div>`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
    el.innerHTML = '';
  }
}

/* ── CHAT FILE INPUT SETUP ──
   Creates hidden file input + attach button for chat input row.
   Call after DOM is ready. Returns cleanup function. */
function setupChatFileInput(inputRowId, onFilePicked) {
  const row = document.getElementById(inputRowId);
  if (!row) return ()=>{};

  // Hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,application/pdf,.doc,.docx,.ppt,.pptx,.zip,.txt,.xls,.xlsx';
  fileInput.style.display = 'none';
  fileInput.id = 'chat-file-input';
  row.appendChild(fileInput);

  // Attach button
  const btn = document.createElement('button');
  btn.className = 'btn btn-ghost btn-sm chat-attach-btn';
  btn.innerHTML = '<i class="ri-attachment-2"></i>';
  btn.title = 'Wyślij plik';
  btn.type = 'button';
  btn.addEventListener('click', () => fileInput.click());
  // Insert before the send button
  row.insertBefore(btn, row.lastElementChild);

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) { onFilePicked(file); fileInput.value=''; }
  });
  return () => { fileInput.remove(); btn.remove(); };
}

/* ── LIGHTBOX ── */
function openLightbox(type, url) {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  const c = document.getElementById('lb-content');
  c.innerHTML = '';
  if (type==='img') { const img=document.createElement('img'); img.src=url; c.appendChild(img); }
  else { const f=document.createElement('iframe'); f.src=url; c.appendChild(f); }
  lb.classList.add('open');
}
function closeLightbox() { document.getElementById('lightbox')?.classList.remove('open'); }
document.addEventListener('keydown', e => { if(e.key==='Escape') closeLightbox(); });

/* ── POPUP ── */
function showPopup({title, text, icon, onAction, actionLabel}) {
  let container = document.getElementById('notif-popup');
  if (!container) {
    container = document.createElement('div');
    container.className='notif-popup'; container.id='notif-popup';
    document.body.appendChild(container);
  }
  const item = document.createElement('div');
  item.className = 'notif-popup-item';
  const iconDiv = document.createElement('div');
  iconDiv.className = 'notif-popup-icon';
  if (icon) {
    const img=document.createElement('img'); img.src=icon; img.alt='';
    img.addEventListener('error',()=>{ iconDiv.textContent='🔔'; });
    iconDiv.appendChild(img);
  } else { iconDiv.textContent='🔔'; }
  const body=document.createElement('div'); body.className='notif-popup-body';
  const s=document.createElement('div'); s.className='notif-popup-sender'; s.textContent=title;
  const t=document.createElement('div'); t.className='notif-popup-text'; t.textContent=String(text||'').replace(/<[^>]+>/g,'');
  body.appendChild(s); body.appendChild(t);
  if (onAction) {
    const btn=document.createElement('span'); btn.className='notif-popup-btn'; btn.textContent=actionLabel||'Przejdź →';
    btn.addEventListener('click',()=>{ onAction(); item.classList.add('removing'); setTimeout(()=>item.remove(),300); });
    body.appendChild(btn);
  }
  const close=document.createElement('button'); close.className='notif-popup-close'; close.innerHTML='<i class="ri-close-line"></i>';
  close.addEventListener('click',()=>{ item.classList.add('removing'); setTimeout(()=>item.remove(),300); });
  item.appendChild(iconDiv); item.appendChild(body); item.appendChild(close);
  container.appendChild(item);
  setTimeout(()=>{ if(item.parentElement){ item.classList.add('removing'); setTimeout(()=>item.remove(),300); } },6000);
}

/* ── TOAST ── */
function toast(msg, type='success') {
  const el=document.createElement('div'); el.className=`toast ${type}`;
  el.innerHTML=`<i class="ri-${type==='success'?'check-line':'error-warning-line'}"></i>${msg}`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(),400); },3500);
}

/* ── MODAL ── */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.addEventListener('click', e => { if(e.target.classList.contains('modal-backdrop')) e.target.classList.remove('open'); });

/* ── UTILS ── */
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function timeAgo(d) {
  if (!d) return '';
  const m=Math.floor((Date.now()-new Date(d))/60000);
  if (m<1) return 'przed chwilą'; if (m<60) return `${m} min temu`;
  const h=Math.floor(m/60); if (h<24) return `${h} godz. temu`; if (h<48) return 'wczoraj';
  return new Date(d).toLocaleDateString('pl-PL',{day:'numeric',month:'short'});
}
function initials(s) { const c=String(s||'').trim()[0]; return c?c.toUpperCase():''; }
function postIcon(t)  { return {text:'📝',link:'🔗',image:'🖼️',file:'📎',video:'🎬'}[t]||'📝'; }
function statusLabel(s){ return {active:'Aktywny',completed:'Zakończony',paused:'Wstrzymany',archived:'Archiwum',open:'Otwarty'}[s]||s; }
function statusClass(s){ return s||'active'; }
function emptyHTML(icon,txt){ return `<div class="empty"><i class="${icon}"></i><p>${txt}</p></div>`; }
function fmtSize(b){ if(!b)return''; if(b<1024)return b+'B'; if(b<1048576)return(b/1024).toFixed(0)+'KB'; return(b/1048576).toFixed(1)+'MB'; }

/* ── FILE SELECTION (posts/docs) ── */
function onFileSelected(inputId, previewId, areaId, storeKey) {
  const file=document.getElementById(inputId)?.files?.[0]; if(!file)return;
  window[storeKey]=file;
  const previewEl=document.getElementById(previewId); if(!previewEl)return;
  if (file.type.startsWith('image/')) {
    const url=URL.createObjectURL(file);
    previewEl.innerHTML=`<img src="${url}" style="max-height:120px;border-radius:8px;max-width:100%;object-fit:cover">`;
  } else {
    const icon=file.type==='application/pdf'?'📄':'📎';
    previewEl.innerHTML=`<div class="file-chip">${icon} ${esc(file.name)} <span style="color:var(--t3);font-size:11px">(${fmtSize(file.size)})</span></div>`;
  }
  const area=document.getElementById(areaId); if(area)area.style.borderColor='var(--a)';
}

/* ── PRELOADER ── */
function runPreloader() {
  const bar=document.getElementById('preBar'),pre=document.getElementById('preloader');
  if (!bar||!pre) return;
  let w=0;
  const iv=setInterval(()=>{
    w=Math.min(w+Math.random()*18+5,100); bar.style.width=w+'%';
    if (w>=100) { clearInterval(iv); setTimeout(()=>pre.classList.add('hidden'),350); }
  },55);
}

/* ── SIDEBAR ── */
function openSidebar()  { document.getElementById('sidebar')?.classList.add('open'); document.getElementById('sidebarOverlay')?.classList.add('show'); }
function closeSidebar() { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('sidebarOverlay')?.classList.remove('show'); }

/* ── PRESENCE HEARTBEAT ── */
function startPresenceHeartbeat() {
  if (!Auth.token || !Auth.userId) return;
  async function beat() {
    try {
      await fetch(`${SB}/rest/v1/user_presence`, {
        method:'POST',
        headers:{...hdr({Prefer:'resolution=merge-duplicates'}),'Content-Type':'application/json'},
        body:JSON.stringify({user_id:Auth.userId, last_seen:new Date().toISOString(), page:location.pathname})
      });
    } catch(_){}
  }
  beat();
  setInterval(beat, 30000);
  function goOffline() {
    const offlineTime = new Date(Date.now()-10*60*1000).toISOString();
    fetch(`${SB}/rest/v1/user_presence`, {
      method:'POST',
      headers:{...hdr({Prefer:'resolution=merge-duplicates'}),'Content-Type':'application/json'},
      body:JSON.stringify({user_id:Auth.userId, last_seen:offlineTime, page:'offline'}),
      keepalive:true
    }).catch(()=>{});
    // Clear typing on leave
    if (window._currentPID) {
      fetch(`${SB}/rest/v1/typing_indicators?user_id=eq.${Auth.userId}&project_id=eq.${window._currentPID}`,
        {method:'DELETE', headers:hdr(), keepalive:true}).catch(()=>{});
    }
  }
  document.addEventListener('visibilitychange', () => { if(document.hidden) goOffline(); else beat(); });
  window.addEventListener('beforeunload', goOffline);
}