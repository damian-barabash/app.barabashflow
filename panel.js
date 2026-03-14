/* ============================================================
   BARABASH FLOW — panel.js (shared)
   ============================================================ */
const SB_URL  = 'https://ztcyhlitwwganjhgbbtm.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Y3lobGl0d3dnYW5qaGdiYnRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTg5NTUsImV4cCI6MjA4NzY3NDk1NX0.7vjhHT3n8DTuXHbfvGIBoA6wxWtcgDoIJ_UfNamg0Zs';
const EDGE    = SB_URL + '/functions/v1';

/* AUTH */
const Auth = {
  get token()  { return localStorage.getItem('bf_token'); },
  get userId() { return localStorage.getItem('bf_user_id'); },
  get role()   { return localStorage.getItem('bf_role'); },
  get name()   { return localStorage.getItem('bf_name'); },
  get email()  { return localStorage.getItem('bf_email'); },
  requireAdmin()  { if (!this.token || this.role !== 'admin')  { location.href='login.html'; return false; } return true; },
  requireClient() { if (!this.token || this.role !== 'client') { location.href='login.html'; return false; } return true; },
  async logout() {
    try { await fetch(SB_URL+'/auth/v1/logout',{method:'POST',headers:{apikey:SB_ANON,Authorization:'Bearer '+this.token}}); } catch(_){}
    ['bf_token','bf_user_id','bf_role','bf_name','bf_email'].forEach(k=>localStorage.removeItem(k));
    location.href='login.html';
  }
};

/* REST HELPERS */
function _h(x={}) { return {apikey:SB_ANON,Authorization:'Bearer '+Auth.token,'Content-Type':'application/json',...x}; }
async function dbGet(table,qs=''){
  const r=await fetch(SB_URL+'/rest/v1/'+table+qs,{headers:_h({Accept:'application/json'})});
  const d=await r.json(); return Array.isArray(d)?d:[];
}
async function dbPost(table,body){
  const r=await fetch(SB_URL+'/rest/v1/'+table,{method:'POST',headers:_h({Prefer:'return=representation'}),body:JSON.stringify(body)});
  const d=await r.json(); return Array.isArray(d)?d[0]:d;
}
async function dbPatch(table,filter,body){
  const r=await fetch(SB_URL+'/rest/v1/'+table+'?'+filter,{method:'PATCH',headers:_h({Prefer:'return=representation'}),body:JSON.stringify(body)});
  const d=await r.json(); return Array.isArray(d)?d[0]:d;
}
async function dbDelete(table,filter){
  await fetch(SB_URL+'/rest/v1/'+table+'?'+filter,{method:'DELETE',headers:_h()});
}
async function edgeFn(fn,body){
  const r=await fetch(EDGE+'/'+fn,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+Auth.token},body:JSON.stringify(body)});
  return r.json();
}

/* TOAST */
function toast(msg,type='success'){
  const el=document.createElement('div');
  el.className='bf-toast bf-toast-'+type;
  el.innerHTML='<i class="ri-'+(type==='success'?'check-line':'error-warning-line')+'"></i>'+msg;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),400);},3500);
}

/* MODAL */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.addEventListener('click',e=>{ if(e.target.classList.contains('modal-overlay')) e.target.classList.remove('open'); });

/* UTILS */
function timeAgo(d){
  if(!d)return'';
  const m=Math.floor((Date.now()-new Date(d))/60000);
  if(m<1)return'przed chwilą';if(m<60)return m+' min temu';
  const h=Math.floor(m/60);if(h<24)return h+' godz. temu';if(h<48)return'wczoraj';
  return new Date(d).toLocaleDateString('pl-PL',{day:'numeric',month:'short'});
}
function avatarInitials(s){ return String(s||'?').trim()[0].toUpperCase(); }
function postIcon(t){ return{text:'📝',link:'🔗',image:'🖼️',file:'📎',video:'🎬'}[t]||'📝'; }
function statusLabel(s){ return{active:'Aktywny',completed:'Zakończony',paused:'Wstrzymany',archived:'Archiwum',open:'Otwarty'}[s]||s; }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function emptyState(icon,txt){ return'<div class="empty"><i class="'+icon+'"></i><p>'+txt+'</p></div>'; }

/* PRELOADER */
function runPreloader(){
  const bar=document.getElementById('preBar'),pre=document.getElementById('preloader');
  if(!bar||!pre)return;
  let w=0;
  const iv=setInterval(()=>{
    w=Math.min(w+Math.random()*18+5,100);
    bar.style.width=w+'%';
    if(w>=100){clearInterval(iv);setTimeout(()=>pre.classList.add('hidden'),300);}
  },55);
}