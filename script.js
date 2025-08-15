// ===== Helper: DOM =====
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// ===== Elements =====
const listView = $('#listView');
const editorView = $('#editorView');
const linkList = $('#linkList');
const progressEl = $('#progress');
const prevBtn = $('#prevBtn');
const nextBtn = $('#nextBtn');
const toggleEditorBtn = $('#toggleEditor');
const sharePageBtn = $('#sharePageBtn');
const copyPageLinkBtn = $('#copyPageLinkBtn');

const itemsInput = $('#itemsInput');
const buildLinkBtn = $('#buildLinkBtn');
const openListBtn = $('#openListBtn');
const shareResult = $('#shareResult');

const titleInput = $('#titleInput');
const themeInput = $('#themeInput');

// ===== State =====
let entries = []; // { label, appUrl, webUrl }
let idx = 0;      // current index
const STORAGE_KEY = 'line-addfriend-progress:' + location.pathname + location.search;

// ===== URL Params ↔ Data =====
function parseParams(){
  const p = new URLSearchParams(location.search);
  const mode = p.get('mode'); // 'oa' | 'links'
  const ids = (p.get('ids')||'').split(',').map(s=>s.trim()).filter(Boolean); // OA IDs
  const links = (p.get('links')||'').split(',').map(s=>decodeURIComponent(s.trim())).filter(Boolean); // full links
  const title = p.get('title');
  const theme = p.get('theme');
  if(title) document.title = title;
  if(theme){
    document.documentElement.style.setProperty('--primary', theme);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if(themeColor) themeColor.setAttribute('content', theme);
  }

  // Build entries
  if(mode === 'links' && links.length){
    entries = links.map((href,i)=>({
      label: `ลิงก์ #${i+1}`,
      appUrl: href,
      webUrl: href
    }));
  } else if(ids.length){
    entries = ids.map((raw)=>{
      let id = raw.replace(/^@+/, ''); // ลบ @ นำหน้า ถ้ามี
      const app = `line://ti/p/@${id}`; // เปิดในแอป
      const web = `https://line.me/R/ti/p/@${id}`; // ผ่านเว็บ
      return { label: `@${id}`, appUrl: app, webUrl: web };
    });
  }
}

function buildList(){
  linkList.innerHTML = '';
  const tmpl = $('#itemTmpl');
  entries.forEach((e,i)=>{
    const li = tmpl.content.firstElementChild.cloneNode(true);
    li.dataset.index = i;
    $('.name', li).textContent = e.label;
    const appA = $('.open-app', li);
    const webA = $('.open-web', li);
    const copyBtn = $('.copy', li);
    const qrBtn = $('.togglqr', li);
    const qrImg = $('.qr', li);

    appA.href = e.appUrl;
    webA.href = e.webUrl;
    copyBtn.dataset.copy = e.webUrl;

    copyBtn.addEventListener('click', async ()=>{
      try{
        await navigator.clipboard.writeText(e.webUrl);
        toast('คัดลอกแล้ว');
      }catch(_){ toast('คัดลอกไม่สำเร็จ'); }
    });

    qrBtn.addEventListener('click', ()=>{
      if(qrImg.hasAttribute('hidden')){
        const data = encodeURIComponent(e.webUrl);
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${data}`; // lazy load
        qrImg.removeAttribute('hidden');
      } else {
        qrImg.setAttribute('hidden','');
      }
    });

    linkList.appendChild(li);
  });
}

function updateProgress(){
  if(!entries.length){ progressEl.textContent = 'ยังไม่มีรายการ'; return; }
  progressEl.textContent = `รายการทั้งหมด ${entries.length} • ขณะนี้อยู่ที่ ${idx+1}/${entries.length}`;
  // focus current item into view
  const current = linkList.querySelector(`.item[data-index="${idx}"]`);
  if(current) current.scrollIntoView({behavior:'smooth', block:'center'});
}

function loadProgress(){
  try{ const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
       if(typeof saved.idx === 'number') idx = Math.min(Math.max(0, saved.idx), Math.max(0, entries.length-1));
  }catch(_){}
}
function saveProgress(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({idx})); }catch(_){}
}

function goto(n){
  if(!entries.length) return; 
  idx = Math.min(Math.max(0,n), entries.length-1);
  saveProgress();
  updateProgress();
}

prevBtn.addEventListener('click', ()=> goto(idx-1));
nextBtn.addEventListener('click', ()=> goto(idx+1));

// ===== Editor =====
function currentMode(){
  return (document.querySelector('input[name="mode"]:checked')||{}).value || 'oa';
}

function buildShareUrl(){
  const base = location.origin + location.pathname;
  const lines = itemsInput.value.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const p = new URLSearchParams();
  const mode = currentMode();
  if(mode === 'links'){
    p.set('mode','links');
    p.set('links', lines.map(encodeURIComponent).join(','));
  }else{
    const clean = lines.map(s=>s.replace(/^@+/, '')).filter(Boolean);
    p.set('ids', clean.join(','));
  }
  if(titleInput.value.trim()) p.set('title', titleInput.value.trim());
  if(/^#?[0-9a-fA-F]{6}$/.test(themeInput.value.trim())){
    const hex = themeInput.value.trim().startsWith('#') ? themeInput.value.trim() : ('#'+themeInput.value.trim());
    p.set('theme', hex);
  }
  return base + '?' + p.toString();
}

buildLinkBtn.addEventListener('click', async ()=>{
  const url = buildShareUrl();
  try{
    await navigator.clipboard.writeText(url);
    shareResult.textContent = 'คัดลอกลิงก์เรียบร้อย: ' + url;
  }catch(_){
    shareResult.textContent = 'ลิงก์ที่ได้: ' + url;
  }
});

openListBtn.addEventListener('click', ()=>{
  const url = buildShareUrl();
  location.href = url; // เปิดหน้า list mode ทันที
});

// ===== Page share (Web Share API) =====
sharePageBtn.addEventListener('click', async ()=>{
  const url = location.href;
  if(navigator.share){
    try{ await navigator.share({ title: document.title, url }); }catch(_){ /* cancelled */ }
  }else{
    try{ await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์หน้านี้แล้ว'); }
    catch(_){ toast('คัดลอกไม่สำเร็จ'); }
  }
});
copyPageLinkBtn.addEventListener('click', async ()=>{
  try{ await navigator.clipboard.writeText(location.href); toast('คัดลอกลิงก์หน้านี้แล้ว'); }catch(_){ toast('คัดลอกไม่สำเร็จ'); }
});

// ===== Editor toggle =====
function setEditor(visible){
  editorView.hidden = !visible;
  listView.hidden = visible;
  toggleEditorBtn.setAttribute('aria-expanded', String(visible));
}

toggleEditorBtn.addEventListener('click', ()=>{
  setEditor(!editorView.hidden);
});

// ===== Toast (very lightweight) =====
let toastTimer = null;
function toast(msg){
  let t = document.getElementById('toast');
  if(!t){
    t = document.createElement('div');
    t.id = 'toast';
    t.style.position='fixed'; t.style.left='50%'; t.style.bottom='90px'; t.style.transform='translateX(-50%)';
    t.style.padding='10px 14px'; t.style.background='rgba(0,0,0,.85)'; t.style.border='1px solid #222'; t.style.borderRadius='999px';
    t.style.color='#fff'; t.style.zIndex='1000'; t.style.fontSize='14px';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity='1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.style.opacity='0'; }, 1400);
}

// ===== Init =====
(function init(){
  parseParams();
  if(entries.length){
    buildList();
    loadProgress();
    updateProgress();
    setEditor(false); // เปิดเป็นโหมดรายการถ้ามีพารามใน URL
  } else {
    setEditor(true); // ไม่มีพาราม แสดง Editor เพื่อกรอก
    // TODO: เติมตัวอย่างรายการอัตโนมัติถ้าต้องการ
  }
})();
