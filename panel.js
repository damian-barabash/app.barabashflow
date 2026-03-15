/* BARABASH FLOW — panel.js */
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
  requireAdmin()  { if (!this.token || this.role !== 'admin')  { location.href='login.html'; return false; } return true; },
  requireClient() { if (!this.token || this.role !== 'client') { location.href='login.html'; return false; } return true; },
  async logout() {
    try { await fetch(SB+'/auth/v1/logout',{method:'POST',headers:{apikey:ANON,Authorization:'Bearer '+this.token}}); } catch(_){}
    ['bf_token','bf_uid','bf_role','bf_name','bf_email','bf_exp'].forEach(k=>localStorage.removeItem(k));
    location.href='login.html';
  }
};

/* ── HTTP HELPERS ── */
function hdr(x={}) {
  return {apikey:ANON,Authorization:'Bearer '+Auth.token,'Content-Type':'application/json',...x};
}
async function dbGet(table, qs='') {
  const r = await fetch(`${SB}/rest/v1/${table}${qs}`, {headers:hdr({Accept:'application/json'})});
  const d = await r.json();
  return Array.isArray(d) ? d : [];
}
async function dbPost(table, body) {
  const r = await fetch(`${SB}/rest/v1/${table}`, {method:'POST',headers:hdr({Prefer:'return=representation'}),body:JSON.stringify(body)});
  const d = await r.json(); return Array.isArray(d) ? d[0] : d;
}
async function dbPatch(table, filter, body) {
  const r = await fetch(`${SB}/rest/v1/${table}?${filter}`, {method:'PATCH',headers:hdr({Prefer:'return=representation'}),body:JSON.stringify(body)});
  const d = await r.json(); return Array.isArray(d) ? d[0] : d;
}
async function edgeFn(fn, body) {
  const r = await fetch(`${EDGE}/${fn}`, {
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+Auth.token},
    body:JSON.stringify(body)
  });
  return r.json();
}

/* ── FILE UPLOAD TO SUPABASE STORAGE ── */
async function uploadFile(file, bucket) {
  const ext  = file.name.split('.').pop();
  const name = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const r = await fetch(`${SB}/storage/v1/object/${bucket}/${name}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer '+Auth.token, 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  });
  if (!r.ok) { const e=await r.json(); throw new Error(e.message||'Upload failed'); }
  return { url: `${SB}/storage/v1/object/public/${bucket}/${name}`, name: file.name, size: file.size, mime: file.type };
}

/* ── FILE PREVIEW RENDERER ── */
function renderFilePreview(url, name, mime, forPost=true) {
  if (!url) return '';
  const isImg = mime && mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';
  if (isImg) {
    return `<div class="file-preview"><img class="img-thumb" src="${esc(url)}" alt="${esc(name)}" onclick="openLightbox('img','${esc(url)}')"></div>`;
  }
  if (isPdf) {
    return `<div class="file-preview pdf-preview">
      <div class="pdf-icon">📄</div>
      <div class="pdf-name" title="${esc(name)}">${esc(name||'Dokument PDF')}</div>
      <button class="btn btn-sm btn-outline" onclick="openLightbox('pdf','${esc(url)}')"><i class="ri-eye-line"></i></button>
      <a href="${esc(url)}" download="${esc(name)}" class="btn btn-sm btn-primary"><i class="ri-download-line"></i></a>
    </div>`;
  }
  return `<div class="file-preview">
    <div class="file-chip">
      <i class="ri-file-line"></i>
      <span>${esc(name||'Plik')}</span>
      <a href="${esc(url)}" download="${esc(name)}" class="btn btn-sm btn-primary" style="margin-left:8px"><i class="ri-download-line"></i></a>
    </div>
  </div>`;
}

/* ── LIGHTBOX ── */
function openLightbox(type, url) {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.id = 'lightbox';
    lb.innerHTML = `<button class="lightbox-close" onclick="closeLightbox()"><i class="ri-close-line"></i></button><div id="lb-content"></div>`;
    lb.addEventListener('click', e => { if(e.target===lb) closeLightbox(); });
    document.body.appendChild(lb);
  }
  const c = document.getElementById('lb-content');
  if (type==='img') c.innerHTML = `<img src="${esc(url)}" alt="preview">`;
  else if (type==='pdf') c.innerHTML = `<iframe src="${esc(url)}"></iframe>`;
  lb.classList.add('open');
}
function closeLightbox() { document.getElementById('lightbox')?.classList.remove('open'); }

/* ── POPUP NOTIFICATIONS (messenger-style) ── */
const PopupQueue = [];
let popupShowing = false;
function showPopup({title, text, icon, onAction, actionLabel}) {
  const container = document.getElementById('notif-popup') || (() => {
    const el = document.createElement('div');
    el.className = 'notif-popup'; el.id = 'notif-popup';
    document.body.appendChild(el); return el;
  })();
  const item = document.createElement('div');
  item.className = 'notif-popup-item';
  const iconHtml = icon
    ? `<div class="notif-popup-icon"><img src="${esc(icon)}" onerror="this.parentElement.innerHTML='🔔'"></div>`
    : `<div class="notif-popup-icon">🔔</div>`;
  item.innerHTML = `${iconHtml}
    <div class="notif-popup-body">
      <div class="notif-popup-sender">${esc(title)}</div>
      <div class="notif-popup-text">${esc(text)}</div>
      ${onAction ? `<span class="notif-popup-btn" id="popup-action-${Date.now()}">${esc(actionLabel||'Przejdź')}</span>` : ''}
    </div>
    <button class="notif-popup-close" onclick="this.closest('.notif-popup-item').remove()"><i class="ri-close-line"></i></button>`;
  if (onAction) {
    const btn = item.querySelector('.notif-popup-btn');
    if (btn) btn.addEventListener('click', () => { onAction(); item.remove(); });
  }
  container.appendChild(item);
  setTimeout(() => {
    item.classList.add('removing');
    setTimeout(() => item.remove(), 300);
  }, 6000);
}

/* ── TOAST ── */
function toast(msg, type='success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="ri-${type==='success'?'check-line':'error-warning-line'}"></i>${msg}`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3500);
}

/* ── MODAL ── */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) e.target.classList.remove('open');
});

/* ── UTILS ── */
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function timeAgo(d) {
  if (!d) return '';
  const m = Math.floor((Date.now()-new Date(d))/60000);
  if (m<1) return 'przed chwilą';
  if (m<60) return `${m} min temu`;
  const h = Math.floor(m/60);
  if (h<24) return `${h} godz. temu`;
  if (h<48) return 'wczoraj';
  return new Date(d).toLocaleDateString('pl-PL',{day:'numeric',month:'short'});
}
function initials(s) { return String(s||'?').trim()[0].toUpperCase(); }
function postIcon(t)  { return {text:'📝',link:'🔗',image:'🖼️',file:'📎',video:'🎬'}[t]||'📝'; }
function statusLabel(s){ return {active:'Aktywny',completed:'Zakończony',paused:'Wstrzymany',archived:'Archiwum',open:'Otwarty'}[s]||s; }
function statusClass(s){ return s||'active'; }
function emptyHTML(icon,txt){ return `<div class="empty"><i class="${icon}"></i><p>${txt}</p></div>`; }
function fmtSize(b) { if(!b)return''; if(b<1024)return b+'B'; if(b<1048576)return(b/1024).toFixed(0)+'KB'; return(b/1048576).toFixed(1)+'MB'; }

/* ── PRELOADER ── */
function runPreloader() {
  const bar=document.getElementById('preBar'), pre=document.getElementById('preloader');
  if (!bar||!pre) return;
  let w=0;
  const iv=setInterval(()=>{
    w=Math.min(w+Math.random()*18+5,100);
    bar.style.width=w+'%';
    if(w>=100){clearInterval(iv);setTimeout(()=>pre.classList.add('hidden'),350);}
  },55);
}

/* ── REALTIME POLLING with popup notifications ── */
let _lastMsgCount = {};
let _lastNotifCount = 0;
function startRealtimePolling(projectId, onNewMsg, onNewNotif) {
  let pid = projectId;
  const iv = setInterval(async () => {
    if (pid) {
      const msgs = await dbGet('messages', `?project_id=eq.${pid}&select=id,content,sender_id,sender:profiles(display_name,email,role)&order=created_at.desc&limit=1`);
      if (msgs.length && msgs[0].id !== _lastMsgCount[pid]) {
        if (_lastMsgCount[pid]) { // not first load
          const m = msgs[0];
          const isAdmin = m.sender?.role==='admin';
          if (m.sender_id !== Auth.userId) {
            showPopup({
              title: isAdmin ? 'Dmytrii Barabash' : (m.sender?.display_name||m.sender?.email||'Klient'),
              text: m.content,
              icon: isAdmin ? LOGO_URL : null,
              actionLabel: 'Przejdź do czatu',
              onAction: onNewMsg
            });
          }
        }
        _lastMsgCount[pid] = msgs[0].id;
        if (onNewMsg && _lastMsgCount[pid]) onNewMsg(true);
      }
    }
    if (Auth.role==='client') {
      const notifs = await dbGet('notifications',`?user_id=eq.${Auth.userId}&is_read=eq.false&select=id,content,type,project_id&order=created_at.desc&limit=1`);
      if (notifs.length && notifs[0].id !== _lastNotifCount) {
        if (_lastNotifCount) {
          const n = notifs[0];
          showPopup({
            title: 'Barabash Flow',
            text: n.content.replace(/<[^>]+>/g,''),
            icon: LOGO_URL,
            actionLabel: 'Przejdź →',
            onAction: onNewNotif ? ()=>onNewNotif(n) : null
          });
        }
        _lastNotifCount = notifs[0].id;
        if (onNewNotif) onNewNotif(null, true);
      }
    }
  }, 5000);
  return iv;
}