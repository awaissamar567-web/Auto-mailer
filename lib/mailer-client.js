// Creator Mailer: browser app. Runs once after the markup in app/markup.js is mounted.

export function initMailer() {
  if (typeof window === 'undefined' || window.__cmInit) return () => {};
  window.__cmInit = true;

  /* ---------- constants ---------- */
  var LS_KEY = 'creator-mailer-v1';
  var TOUR_KEY = 'creator-mailer-tour-v1';
  var EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/i;
  var VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\}\}/g;
  var HOUR = 3600000;

  var DEFAULT_TEMPLATES = [
    { id:'fit', name:'Fitness affiliate', kind:'first',
      subject:'Partnership idea for {{handle|your page}}',
      body:'Hey {{first_name|there}},\n\n{{line|I\'ve been going through your content and I like how simple and practical you keep things for your audience.}}\n\nI\'m {{my_name}}. I built {{product}}, a fitness product that\'s already getting great feedback from early customers, and I\'m looking for a few coaches to partner with as affiliates. You\'d earn {{commission}} on every sale. I handle the product, delivery and support, so all you do is share it with your audience.\n\nIf you\'re open to it, I can send you a free copy first so you can see if it\'s a fit. Want me to send it over?\n\n{{my_name}}\n{{brand}}' },
    { id:'ugc', name:'UGC webinars', kind:'first',
      subject:'Idea for {{handle|your audience}}',
      body:'Hey {{first_name|there}},\n\n{{line|Really like the UGC work you\'ve been putting out. You make products look like something people actually use.}}\n\nQuick idea. A lot of creators your size have followers who\'d happily pay to learn what they do, they just don\'t have a way to sell it yet. I help creators run free webinars and summits that turn those followers into students, then set up the offers behind them so it actually brings in money.\n\nI handle the setup and the backend, you show up and teach. Open to a quick chat this week?\n\n{{my_name}}\n{{brand}}' },
    { id:'fu', name:'Follow-up', kind:'followup',
      subject:'',
      body:'Hey {{first_name|there}}, just bumping this up in case it got buried. Happy to share more details if it sounds like a fit, and no worries at all if not.\n\n{{my_name}}' }
  ];
  var DEFAULT_GLOBALS = { my_name:'Awais', brand:'Obsidx', product:'', commission:'40%', link:'' };
  var GLOBAL_LABELS = { my_name:'Your name', brand:'Brand', product:'Product name', commission:'Commission', link:'Link' };
  var DEFAULT_SETTINGS = { gap:45, cap:40, firstTpl:'fit', dueHours:20 };
  var EXAMPLES = [
    { name:'Maya Torres', email:'maya@example.com', handle:'@mayamoves', niche:'fitness coach', line:'Your 20-minute home workout series is really useful, especially the form cues.', example:true },
    { name:'Jordan Lee', email:'jordan@example.com', handle:'@jordanmakesugc', niche:'UGC creator', line:'', example:true },
    { name:'', email:'coachdee@example.com', handle:'@coachdee', niche:'gym coach', line:'', example:true }
  ];
  var CREATOR_VARS = ['first_name','name','handle','niche','line'];

  /* ---------- helpers ---------- */
  function $(s){ return document.querySelector(s); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
  function uid(){ return 'c' + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }
  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function assign(a){ for (var i=1;i<arguments.length;i++){ var b=arguments[i]; if (b) for (var k in b) if (Object.prototype.hasOwnProperty.call(b,k)) a[k]=b[k]; } return a; }
  function validEmail(c){ return EMAIL_RE.test(String(c.email||'').trim()); }
  function timeAgo(ts){
    if (!ts) return '';
    var m = Math.round((Date.now() - ts)/60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    var h = Math.round(m/60); if (h < 24) return h + 'h ago';
    return Math.round(h/24) + 'd ago';
  }
  function isToday(ts){ if (!ts) return false; var a = new Date(ts), b = new Date(); return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  function reducedMotion(){ try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){ return false; } }

  var toastTimer;
  function toast(msg){ var t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(function(){ t.classList.remove('show'); }, 2800); }

  function copyText(text){
    function fallback(){
      try { var ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); var ok=document.execCommand('copy'); ta.remove(); return ok; } catch(e){ return false; }
    }
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function(){ return true; }, function(){ return fallback(); }); } catch(e) {}
    return Promise.resolve(fallback());
  }
  function download(name, text, type){
    var blob = new Blob([text], { type:type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function api(path, opts){
    return fetch(path, assign({ headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', cache:'no-store' }, opts)).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){
        j = j || {}; j.httpStatus = r.status;
        if (r.status === 401) j.code = 'unauthorized';
        return j;
      });
    });
  }
  function goLogin(){ window.location.href = '/login'; }

  /* ---------- state ---------- */
  function fresh(){
    return { v:2, updatedAt:0,
      contacts: EXAMPLES.map(function(e){ return assign({}, e, { id:uid(), status:'ready' }); }),
      templates: clone(DEFAULT_TEMPLATES),
      globals: assign({}, DEFAULT_GLOBALS),
      settings: assign({}, DEFAULT_SETTINGS) };
  }
  function normalize(d){
    var n = fresh();
    if (!d || typeof d !== 'object') return n;
    n.updatedAt = Number(d.updatedAt) || 0;
    if (Array.isArray(d.contacts)) n.contacts = d.contacts.filter(function(c){ return c && typeof c==='object'; }).map(function(c){
      var s = c.status || 'ready'; if (s === 'draft') s = 'ready';
      return assign({}, c, { id:c.id||uid(), status:s });
    });
    if (Array.isArray(d.templates) && d.templates.length) n.templates = d.templates.filter(function(t){ return t && t.id; });
    if (!n.templates.some(function(t){ return t.kind==='followup'; })) n.templates.push(clone(DEFAULT_TEMPLATES[2]));
    if (!n.templates.some(function(t){ return t.kind==='first'; })) n.templates.unshift(clone(DEFAULT_TEMPLATES[0]));
    n.globals = assign({}, DEFAULT_GLOBALS, d.globals);
    n.settings = assign({}, DEFAULT_SETTINGS, d.settings);
    if (!n.templates.some(function(t){ return t.id===n.settings.firstTpl && t.kind==='first'; })) n.settings.firstTpl = n.templates.filter(function(t){ return t.kind==='first'; })[0].id;
    return n;
  }

  var S = fresh();
  var ui = { filter:'all', sel:{}, previewId:null, previewKind:'first', editTpl:'fit', lastField:null, run:null, gmail:'checking', from:'', save:'loading', loaded:false };

  function byId(id){ for (var i=0;i<S.contacts.length;i++) if (S.contacts[i].id===id) return S.contacts[i]; return null; }
  function tplById(id){ for (var i=0;i<S.templates.length;i++) if (S.templates[i].id===id) return S.templates[i]; return null; }
  function firstTpl(){ var t = tplById(S.settings.firstTpl); return (t && t.kind==='first') ? t : S.templates.filter(function(t){ return t.kind==='first'; })[0]; }
  function followTpl(){ return S.templates.filter(function(t){ return t.kind==='followup'; })[0]; }
  function selIds(){ return Object.keys(ui.sel).filter(function(id){ return ui.sel[id] && byId(id); }); }
  function running(){ return !!(ui.run && !ui.run.finished); }

  /* ---------- templating ---------- */
  function varsFor(c){
    var v = {}, k;
    for (k in S.globals) v[k] = S.globals[k];
    var name = String(c.name||'').trim();
    v.name = name;
    v.first_name = String(c.first_name||'').trim() || name.split(/\s+/)[0] || '';
    v.email = c.email || ''; v.handle = c.handle || ''; v.niche = c.niche || ''; v.line = c.line || '';
    if (c.extra) for (k in c.extra) if (String(c.extra[k]||'').trim()) v[k] = c.extra[k];
    return v;
  }
  function fill(tpl, c){
    tpl = String(tpl || '');
    var vars = varsFor(c), parts = [], missing = [], last = 0, m;
    VAR_RE.lastIndex = 0;
    while ((m = VAR_RE.exec(tpl))) {
      if (m.index > last) parts.push({ t:'s', v:tpl.slice(last, m.index) });
      var key = m[1].toLowerCase();
      var val = String(vars[key] == null ? '' : vars[key]).trim();
      if (val) parts.push({ t:'v', v:val });
      else if (m[2] !== undefined) parts.push({ t:'f', v:m[2].trim() });
      else { parts.push({ t:'m', v:m[0] }); if (missing.indexOf(key) < 0) missing.push(key); }
      last = m.index + m[0].length;
    }
    if (last < tpl.length) parts.push({ t:'s', v:tpl.slice(last) });
    var text = parts.map(function(p){ return p.v; }).join('').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
    return { text:text, parts:parts, missing:missing };
  }
  function partsHTML(parts){
    return parts.map(function(p){
      if (p.t==='s') return esc(p.v);
      if (p.t==='v') return '<mark>' + esc(p.v) + '</mark>';
      if (p.t==='f') return p.v ? '<mark class="fb" title="Fallback text">' + esc(p.v) + '</mark>' : '';
      return '<mark class="miss" title="No value">' + esc(p.v) + '</mark>';
    }).join('').replace(/\n{3,}/g,'\n\n').trim();
  }
  function compose(c, kind){
    if (kind === 'followup') {
      var ft = followTpl(), fb = fill(ft.body, c);
      var base = c.subject || fill(firstTpl().subject, c).text;
      return { subject: /^re:/i.test(base) ? base : 'Re: ' + base, subjectParts:null, body:fb, missing:fb.missing };
    }
    var t = firstTpl(), s = fill(t.subject, c), b = fill(t.body, c);
    var miss = s.missing.slice(); b.missing.forEach(function(k){ if (miss.indexOf(k)<0) miss.push(k); });
    return { subject:s.text, subjectParts:s.parts, body:b, missing:miss };
  }

  /* ---------- eligibility + status ---------- */
  function canFirst(c){ return !c.example && validEmail(c) && (c.status==='ready' || c.status==='failed') && compose(c,'first').missing.length===0; }
  function canFollow(c){ return !c.example && validEmail(c) && (c.status==='sent' || c.status==='followed') && !!c.messageId && compose(c,'followup').missing.length===0; }
  function isDue(c){ return !c.example && c.status==='sent' && !!c.messageId && c.sentAt && (Date.now()-c.sentAt) >= S.settings.dueHours*HOUR; }
  function hasIssue(c){ return !c.example && (c.status==='failed' || c.status==='unconfirmed' || !validEmail(c) || (c.status==='ready' && compose(c,'first').missing.length>0)); }
  function matchFilter(c, f){
    switch (f) {
      case 'ready': return !c.example && c.status==='ready';
      case 'sent': return c.status==='sent' || c.status==='followed';
      case 'due': return isDue(c);
      case 'replied': return c.status==='replied';
      case 'issues': return hasIssue(c);
      default: return true;
    }
  }
  function sentToday(){ var n=0; S.contacts.forEach(function(c){ if (isToday(c.sentAt)) n++; if (isToday(c.followAt)) n++; }); return n; }

  function statusPill(c){
    if (c.example) return '<span class="st example">Example</span>';
    if (!validEmail(c)) return '<span class="st bad">Bad email</span>';
    switch (c.status) {
      case 'ready': {
        var miss = compose(c,'first').missing;
        if (miss.length) return '<span class="st warn" title="Fill these in Your details or add a fallback">Needs ' + esc(miss.join(', ')) + '</span>';
        return '<span class="st ready">Ready</span>';
      }
      case 'sent': return isDue(c) ? '<span class="st due">Follow-up due</span>' : '<span class="st sent">Sent ' + esc(timeAgo(c.sentAt)) + '</span>';
      case 'followed': return '<span class="st followed">Followed up ' + esc(timeAgo(c.followAt)) + '</span>';
      case 'replied': return '<span class="st replied">Replied</span>';
      case 'failed': return '<span class="st failed" title="' + esc(c.error||'') + '">Failed</span>';
      case 'unconfirmed': return '<span class="st unconfirmed" title="' + esc(c.error||'') + '">Check Sent folder</span>';
    }
    return '<span class="st">' + esc(c.status) + '</span>';
  }
  function rowActions(c){
    var a = [];
    if (!c.example) {
      if (c.status==='sent' || c.status==='followed') a.push('<button class="btn sm" data-act="replied" type="button">Replied</button>');
      if (c.status==='replied') a.push('<button class="btn sm" data-act="unreplied" type="button">Undo</button>');
      if (c.status==='unconfirmed') a.push('<button class="btn sm" data-act="marksent" type="button">Mark sent</button>');
      if (c.status==='unconfirmed' || c.status==='failed') a.push('<button class="btn sm" data-act="reset" type="button">Reset</button>');
    }
    a.push('<button class="btn sm danger" data-act="remove" type="button" aria-label="Remove">&#215;</button>');
    return a.join('');
  }

  /* ---------- import ---------- */
  var ALIASES = {
    name:['name','full name','fullname','full_name','creator','creator name','contact'],
    first_name:['first name','first_name','firstname','first'],
    email:['email','e-mail','email address','email_address','mail'],
    handle:['handle','instagram','ig','username','user','insta','ig handle','instagram handle','tiktok','@'],
    niche:['niche','category','type','vertical'],
    line:['line','note','notes','custom','compliment','personal line','opener','personalization','custom line','icebreaker']
  };
  function mapHeader(h){
    var k = String(h||'').trim().toLowerCase();
    for (var f in ALIASES) if (ALIASES[f].indexOf(k) >= 0) return f;
    var slug = k.replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    return slug ? 'x:' + slug : null;
  }
  function parseRows(text){
    var firstLine = (text.split(/\r?\n/).filter(function(l){ return l.trim(); })[0]) || '';
    var delim = firstLine.indexOf('\t') >= 0 ? '\t' : (firstLine.split(';').length > firstLine.split(',').length ? ';' : ',');
    var rows = [], row = [], f = '', q = false;
    for (var i=0;i<text.length;i++) {
      var ch = text[i];
      if (q) { if (ch==='"') { if (text[i+1]==='"') { f+='"'; i++; } else q=false; } else f+=ch; }
      else if (ch==='"' && f.trim()==='') { q=true; f=''; }
      else if (ch===delim) { row.push(f); f=''; }
      else if (ch==='\n' || ch==='\r') { if (ch==='\r' && text[i+1]==='\n') i++; row.push(f); rows.push(row); row=[]; f=''; }
      else f+=ch;
    }
    if (f!=='' || row.length) { row.push(f); rows.push(row); }
    return rows.map(function(r){ return r.map(function(x){ return String(x).trim(); }); }).filter(function(r){ return r.some(function(x){ return x; }); });
  }
  function cleanHandle(h){
    h = String(h||'').trim(); if (!h) return '';
    var m = h.match(/(?:instagram\.com|tiktok\.com\/@?)\/?([A-Za-z0-9._]+)/i);
    if (m) return '@' + m[1];
    return h.charAt(0)==='@' ? h : (/^[A-Za-z0-9._]+$/.test(h) ? '@' + h : h);
  }
  function splitNameEmail(cell){
    var m = String(cell).match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
    return m ? { name:m[1].trim(), email:m[2].trim() } : null;
  }
  function itemsFromRows(rows){
    var items = [];
    var firstHasEmail = rows[0].some(function(x){ return EMAIL_RE.test(x) || splitNameEmail(x); });
    if (!firstHasEmail) {
      var head = rows[0].map(mapHeader);
      rows.slice(1).forEach(function(r){
        if (r.length > head.length && head.length) { var tail = r.slice(head.length-1).join(', '); r = r.slice(0, head.length-1).concat([tail]); }
        var it = { extra:{} };
        head.forEach(function(h, i){
          var v = r[i] || ''; if (!h || !v) return;
          if (h.indexOf('x:')===0) it.extra[h.slice(2)] = v; else it[h] = v;
        });
        if (it.email) { var ne = splitNameEmail(it.email); if (ne) { it.email = ne.email; if (!it.name) it.name = ne.name; } }
        items.push(it);
      });
    } else {
      rows.forEach(function(r){
        var it = { extra:{} }, rest = [];
        r.forEach(function(cell){
          var ne = splitNameEmail(cell);
          if (!it.email && ne && EMAIL_RE.test(ne.email)) { it.email = ne.email; if (ne.name) rest.unshift(ne.name); }
          else if (!it.email && EMAIL_RE.test(cell)) it.email = cell;
          else if (!it.handle && (/^@\w/.test(cell) || /instagram\.com|tiktok\.com/i.test(cell))) it.handle = cell;
          else if (cell) rest.push(cell);
        });
        it.name = rest[0] || ''; it.niche = rest[1] || ''; it.line = rest.slice(2).join(', ');
        items.push(it);
      });
    }
    return items;
  }
  function importText(text){
    var rows = parseRows(text || '');
    if (!rows.length) return { msg:'Nothing to add. Paste at least one row.' };
    var items = itemsFromRows(rows);
    if (items.length && S.contacts.some(function(c){ return c.example; })) S.contacts = S.contacts.filter(function(c){ return !c.example; });
    var added = 0, updated = 0, bad = 0;
    items.forEach(function(it){
      it.email = String(it.email||'').trim().toLowerCase();
      it.handle = cleanHandle(it.handle);
      if (!it.email && !it.name && !it.handle) return;
      if (!Object.keys(it.extra).length) delete it.extra;
      var ex = it.email ? S.contacts.filter(function(c){ return String(c.email||'').toLowerCase()===it.email; })[0] : null;
      if (ex) {
        ['name','first_name','handle','niche','line'].forEach(function(k){ if (it[k]) ex[k] = it[k]; });
        if (it.extra) ex.extra = assign({}, ex.extra, it.extra);
        updated++;
      } else {
        var c = assign({ id:uid(), status:'ready', name:'', handle:'', niche:'', line:'' }, it);
        S.contacts.push(c); added++;
        if (!validEmail(c)) bad++;
      }
    });
    var parts = [];
    if (added) parts.push('Added ' + added);
    if (updated) parts.push((added ? 'updated ' : 'Updated ') + updated);
    if (bad) parts.push(bad + ' with a bad or missing email');
    return { msg: parts.length ? parts.join(', ') + '.' : 'No new creators found in that paste.', added:added };
  }

  /* ---------- storage: this browser + optional cloud ---------- */
  var cloud = false, saveTimer = null, writing = false, dirty = false;
  function saveLocal(){ try { localStorage.setItem(LS_KEY, JSON.stringify(S)); return true; } catch(e) { return false; } }
  function save(){
    if (!ui.loaded) return;
    S.updatedAt = Date.now();
    var ok = saveLocal();
    if (cloud) { dirty = true; ui.save = 'saving'; clearTimeout(saveTimer); saveTimer = setTimeout(flush, 800); }
    else ui.save = ok ? 'local' : 'error';
    renderSavePill();
  }
  function flush(){
    if (!cloud || !dirty || writing) return;
    writing = true; dirty = false;
    api('/api/state', { method:'PUT', body: JSON.stringify({ state:S }) }).then(function(j){
      if (j.ok) ui.save = 'cloud';
      else if (j.code === 'unauthorized') ui.save = 'loggedout';
      else if (j.code === 'too_big') ui.save = 'full';
      else ui.save = 'error';
    }, function(){ ui.save = 'error'; }).then(function(){ writing = false; renderSavePill(); if (dirty) flush(); });
  }
  function initStore(){
    var local = null;
    try { var raw = localStorage.getItem(LS_KEY); if (raw) local = JSON.parse(raw); } catch(e) {}
    return api('/api/state').then(function(j){
      if (j.code === 'unauthorized') { goLogin(); return { stop:true }; }
      if (j.ok) {
        cloud = true;
        var remote = j.state;
        if (remote && (!local || (Number(remote.updatedAt)||0) >= (Number(local.updatedAt)||0))) return { data:remote, push:false };
        return { data:local, push:!!local };
      }
      return { data:local, push:false };
    }, function(){ return { data:local, push:false }; }).then(function(r){
      if (r.stop) return;
      S = normalize(r.data);
      ui.loaded = true;
      ui.save = cloud ? 'cloud' : 'local';
      ui.editTpl = S.settings.firstTpl;
      $('#importBox').open = !S.contacts.some(function(c){ return !c.example; });
      renderAll(); renderEditor(); renderSettings(); renderBackupHelp();
      if (r.push) { dirty = true; flush(); }
      maybeStartTour();
    });
  }

  /* ---------- Gmail (via the app's API) ---------- */
  function checkStatus(){
    api('/api/status').then(function(j){
      if (j.code === 'unauthorized') return goLogin();
      ui.from = (j.mail && j.mail.from) || '';
      ui.gmail = j.mail && j.mail.configured ? 'ok' : 'missing';
      renderGmailPill(); renderPreview();
    }, function(){ ui.gmail = 'offline'; renderGmailPill(); });
  }
  function outcome(j, c){
    var m = j.message || '';
    switch (j.code) {
      case 'recipient': case 'invalid':
        c.status = 'failed'; c.error = m || 'Gmail refused this address.';
        return { ok:false };
      case 'unauthorized':
        return { stop:true, msg:'You were logged out. Log in again, then press Send.' };
      case 'config':
        ui.gmail = 'missing'; renderGmailPill();
        return { stop:true, msg:m || 'Gmail is not set up on the server.' };
      case 'auth': case 'limit': case 'throttled': case 'network':
        return { stop:true, msg:m };
      default:
        c.status = 'unconfirmed'; c.error = m || 'Gmail did not confirm this email.';
        return { stop:true, msg:(m ? m + ' ' : '') + 'Check your Gmail Sent folder for ' + c.email + ', then use Mark sent or Reset on that row before sending more.' };
    }
  }
  function sendOne(c, kind){
    var comp = compose(c, kind);
    var payload = { to:String(c.email).trim(), subject:comp.subject, body:comp.body.text };
    if (kind === 'followup' && c.messageId) payload.inReplyTo = c.messageId;
    return api('/api/send', { method:'POST', body:JSON.stringify(payload) }).then(function(j){
      if (j.ok) {
        if (kind === 'first') {
          c.subject = comp.subject; c.tpl = firstTpl().id; c.messageId = j.messageId || '';
          c.status = 'sent'; c.sentAt = Date.now();
        } else {
          c.status = 'followed'; c.followAt = Date.now(); c.followCount = (c.followCount||0) + 1;
        }
        c.error = '';
        return { ok:true };
      }
      return outcome(j, c);
    }, function(){
      c.status = 'unconfirmed'; c.error = 'Lost connection while sending.';
      return { stop:true, msg:'Lost connection while sending to ' + c.email + '. Check your Gmail Sent folder, then use Mark sent or Reset on that row.' };
    });
  }

  /* ---------- runs ---------- */
  function askToStart(kind, ids){
    if (running()) return;
    if (ui.gmail === 'missing') { toast('Gmail is not set up yet. Add the Gmail settings in Vercel first.'); return; }
    var list = ids.map(byId).filter(function(c){ return c && (kind==='first' ? canFirst(c) : canFollow(c)); });
    if (!list.length) { toast(kind==='first' ? 'None of those can get a first email yet.' : 'None of those have a first email to follow up on.'); return; }
    var left = Math.max(0, (Number(S.settings.cap)||40) - sentToday());
    var n = list.length, gap = Number(S.settings.gap)||45;
    var mins = Math.max(1, Math.round(((n-1) * gap) / 60));
    var title = (kind==='first' ? 'Send ' + n + ' first email' : 'Send ' + n + ' follow-up') + (n>1?'s':'') + '?';
    var body = [];
    body.push('<p>' + (n>1 ? 'One about every ' + gap + ' seconds, so roughly ' + mins + ' minute' + (mins>1?'s':'') + '. ' : '') + 'They go out from ' + esc(ui.from || 'your Gmail') + (kind==='followup' ? ' as replies in each original thread' : '') + '.</p>');
    if (n > left) body.push('<p>Your daily limit is ' + S.settings.cap + ' and you\'ve sent ' + sentToday() + ' today, so it will stop after ' + left + '.</p>');
    body.push('<ul>' + list.slice(0,5).map(function(c){ return '<li>' + esc(c.name || c.handle || c.email) + ' <span class="mono">' + esc(c.email) + '</span></li>'; }).join('') + (n>5 ? '<li>and ' + (n-5) + ' more</li>' : '') + '</ul>');
    if (n>1) body.push('<p>Keep this tab open until it finishes.</p>');
    openModal(title, body.join(''), 'Start sending', function(){ runBatch(kind, list.map(function(c){ return c.id; })); });
  }
  function runBatch(kind, ids){
    var run = ui.run = { kind:kind, ids:ids, index:0, ok:0, failed:0, stopped:false, finished:false, nextAt:null, currentId:null, msg:'', err:'' };
    renderRun(); renderSendbar(); renderPreview();
    function step(){
      if (run.stopped || run.index >= run.ids.length) return finish();
      if (sentToday() >= (Number(S.settings.cap)||40)) { run.err = 'Daily limit of ' + S.settings.cap + ' reached. Raise it in Sending if you want to keep going today.'; return finish(); }
      var c = byId(run.ids[run.index]);
      if (!c || !(kind==='first' ? canFirst(c) : canFollow(c))) { run.index++; return step(); }
      run.currentId = c.id; renderRun();
      sendOne(c, kind).then(function(res){
        if (res.stop) { run.err = res.msg; save(); renderAll(); return finish(); }
        if (res.ok) run.ok++; else run.failed++;
        run.index++; run.currentId = null;
        save(); renderAll();
        if (run.index < run.ids.length && !run.stopped) wait(gapMs(), run).then(step); else finish();
      });
    }
    function finish(){
      run.finished = true; run.currentId = null; run.nextAt = null;
      var noun = kind==='first' ? 'email' : 'follow-up';
      run.msg = (run.stopped ? 'Stopped. ' : (run.err ? '' : 'Done. ')) + run.ok + ' ' + noun + (run.ok===1?'':'s') + ' sent' + (run.failed ? ', ' + run.failed + ' failed (see the list)' : '') + '.';
      renderRun(); renderSendbar(); renderAll();
    }
    step();
  }
  function gapMs(){ var g = (Number(S.settings.gap)||45) * 1000; return Math.round(g * (0.75 + Math.random()*0.5)); }
  function wait(ms, run){
    return new Promise(function(res){
      var end = Date.now() + ms; run.nextAt = end;
      var t = setInterval(function(){
        if (run.stopped || Date.now() >= end) { clearInterval(t); run.nextAt = null; res(); }
        renderRun();
      }, 500);
    });
  }

  /* ---------- modal ---------- */
  var modalOk = null, modalReturn = null;
  function openModal(title, html, okLabel, onOk){
    modalReturn = document.activeElement;
    $('#mTitle').textContent = title; $('#mBody').innerHTML = html; $('#mOk').textContent = okLabel;
    modalOk = onOk; $('#modal').hidden = false; $('#mOk').focus();
  }
  function closeModal(){ $('#modal').hidden = true; modalOk = null; if (modalReturn && modalReturn.focus) modalReturn.focus(); }

  /* ---------- render ---------- */
  function renderGmailPill(){
    var p = $('#gmailPill'), map = {
      checking:['', 'Checking Gmail…'],
      ok:['ok', 'Sending as ' + ui.from],
      missing:['bad', 'Gmail not set up'],
      offline:['warn', 'Can\'t reach the server']
    }[ui.gmail] || ['', ui.gmail];
    p.className = 'pill ' + map[0]; p.textContent = map[1];
    p.title = ui.gmail==='missing' ? 'Add GMAIL_USER and GMAIL_APP_PASSWORD in your Vercel project settings, then redeploy.' : '';
  }
  function renderSavePill(){
    var p = $('#savePill'), map = {
      loading:['', 'Loading your list…'],
      cloud:['ok', 'Saved to cloud'],
      saving:['', 'Saving…'],
      local:['warn', 'Saved in this browser'],
      error:['bad', 'Couldn\'t save to cloud. Kept in this browser'],
      loggedout:['bad', 'Logged out. Log in to keep saving'],
      full:['bad', 'List too big to save. Remove old creators']
    }[ui.save] || ['', ''];
    p.className = 'pill ' + map[0]; p.textContent = map[1];
  }
  function renderCapPill(){
    var n = sentToday(), cap = Number(S.settings.cap)||40, p = $('#capPill');
    p.textContent = 'Sent today ' + n + ' / ' + cap;
    p.className = 'pill ' + (n >= cap ? 'bad' : (n >= cap*0.8 ? 'warn' : ''));
  }
  function counts(){
    var r = { all:0, ready:0, sent:0, due:0, replied:0, issues:0 };
    S.contacts.forEach(function(c){
      r.all++;
      ['ready','sent','due','replied','issues'].forEach(function(f){ if (matchFilter(c,f)) r[f]++; });
    });
    return r;
  }
  function renderStats(k){
    $('#stats').innerHTML = [
      ['Ready', k.ready, ''], ['Sent', k.sent, ''], ['Follow-up due', k.due, k.due ? 'due' : ''], ['Replied', k.replied, '']
    ].map(function(s){ return '<div class="stat ' + s[2] + '"><b>' + s[1] + '</b><span>' + s[0] + '</span></div>'; }).join('');
  }
  function renderSendbar(){
    var sel = selIds().map(byId);
    var nf = sel.filter(canFirst).length, nu = sel.filter(canFollow).length;
    var busy = running();
    $('#btnFirst').textContent = 'Send first email (' + nf + ')';
    $('#btnFirst').disabled = !nf || busy;
    $('#btnFollow').textContent = 'Send follow-up (' + nu + ')';
    $('#btnFollow').disabled = !nu || busy;
    var allReady = S.contacts.filter(canFirst).length;
    var allDue = S.contacts.filter(function(c){ return isDue(c) && canFollow(c); }).length;
    var nSel = sel.length;
    $('#quick').innerHTML =
      '<span>' + (nSel ? nSel + ' selected.' : 'Tick creators in the list, or quick select:') + '</span>' +
      '<button class="linkbtn" type="button" data-q="ready"' + (allReady ? '' : ' disabled') + '>All ready (' + allReady + ')</button>' +
      '<button class="linkbtn" type="button" data-q="due"' + (allDue ? '' : ' disabled') + '>Follow-ups due (' + allDue + ')</button>' +
      (nSel ? '<button class="linkbtn" type="button" data-q="none">Clear selection</button>' : '') +
      '<span>Using <b>' + esc(firstTpl().name) + '</b>.</span>';
  }
  function renderRun(){
    var el = $('#runline'), run = ui.run;
    if (!run) { el.className = 'runline'; el.innerHTML = ''; return; }
    if (run.finished) {
      var err = !!run.err;
      el.className = 'runline show ' + (err ? 'err' : 'done');
      el.innerHTML = '<span class="msg">' + esc(run.msg) + (err ? ' ' + esc(run.err) : '') + '</span><button class="btn sm" type="button" data-run="dismiss">Dismiss</button>';
      return;
    }
    var total = run.ids.length, pct = Math.round((run.index / total) * 100);
    var c = run.currentId ? byId(run.currentId) : null;
    var text;
    if (c) text = 'Sending ' + (run.index+1) + ' of ' + total + ' to ' + (c.name || c.handle || c.email) + '…';
    else if (run.nextAt) text = run.ok + ' of ' + total + ' sent. Next in ' + Math.max(0, Math.ceil((run.nextAt - Date.now())/1000)) + 's';
    else text = 'Starting…';
    el.className = 'runline show';
    el.innerHTML = '<div class="progress" aria-hidden="true"><span style="width:' + pct + '%"></span></div><span class="msg">' + esc(text) + '</span><button class="btn sm" type="button" data-run="stop">Stop</button>';
  }
  function renderFilters(k){
    var defs = [['all','All'],['ready','Ready'],['sent','Sent'],['due','Follow-up due'],['replied','Replied'],['issues','Needs attention']];
    if (!defs.some(function(d){ return d[0]===ui.filter; })) ui.filter = 'all';
    $('#filters').innerHTML = defs.map(function(d){
      return '<button class="chip" type="button" data-f="' + d[0] + '" aria-pressed="' + (ui.filter===d[0]) + '">' + d[1] + ' ' + k[d[0]] + '</button>';
    }).join('');
  }
  function renderBulk(){
    var n = selIds().length;
    $('#bulk').innerHTML =
      '<button class="btn sm" type="button" data-b="csv">Download CSV</button>' +
      '<button class="btn sm" type="button" data-b="copy">Copy as CSV</button>' +
      (n ? '<button class="btn sm" type="button" data-b="reset">Reset ' + n + ' to ready</button><button class="btn sm danger" type="button" data-b="remove">Remove ' + n + '</button>' : '');
  }
  function renderTable(){
    var rows = S.contacts.filter(function(c){ return matchFilter(c, ui.filter); });
    var tb = $('#tbody');
    if (!rows.length) {
      tb.innerHTML = '<tr><td colspan="4" class="empty">' + (S.contacts.length ? 'No creators match this filter.' : 'No creators yet. Open Add creators and paste your list.') + '</td></tr>';
    } else {
      tb.innerHTML = rows.map(function(c){
        var title = c.name || c.handle || c.email || 'Unnamed';
        var sub = [c.name && c.handle ? c.handle : '', c.email, c.niche].filter(Boolean).join(' · ');
        var cls = (c.id===ui.previewId ? 'is-preview ' : '') + (c.example ? 'is-example' : '');
        return '<tr data-id="' + esc(c.id) + '" class="' + cls + '">' +
          '<td class="ck"><input type="checkbox" data-act="sel" ' + (ui.sel[c.id] ? 'checked' : '') + ' aria-label="Select ' + esc(title) + '"' + (c.example ? ' disabled' : '') + '></td>' +
          '<td class="who"><button type="button" data-act="preview"><span class="nm">' + esc(title) + '</span></button><span class="sub">' + esc(sub) + '</span></td>' +
          '<td>' + statusPill(c) + '</td>' +
          '<td class="ac">' + rowActions(c) + '</td></tr>';
      }).join('');
    }
    var shown = rows.filter(function(c){ return !c.example; });
    var sa = $('#selAll');
    sa.checked = shown.length > 0 && shown.every(function(c){ return ui.sel[c.id]; });
    sa.indeterminate = !sa.checked && shown.some(function(c){ return ui.sel[c.id]; });
    $('#countLabel').textContent = S.contacts.filter(function(c){ return !c.example; }).length + ' creators';
    $('#exampleNote').hidden = !S.contacts.some(function(c){ return c.example; });
  }
  function previewList(){ return S.contacts.filter(function(c){ return matchFilter(c, ui.filter); }); }
  function renderPreview(){
    var list = previewList();
    if (!byId(ui.previewId) || list.indexOf(byId(ui.previewId)) < 0) ui.previewId = list.length ? list[0].id : (S.contacts[0] ? S.contacts[0].id : null);
    var c = byId(ui.previewId);
    $('#pvFirst').setAttribute('aria-pressed', ui.previewKind==='first');
    $('#pvFollow').setAttribute('aria-pressed', ui.previewKind==='followup');
    var idx = c ? list.indexOf(c) : -1;
    $('#pvPrev').disabled = idx <= 0; $('#pvNext').disabled = idx < 0 || idx >= list.length - 1;
    $('#pvPos').textContent = idx >= 0 ? (idx+1) + ' of ' + list.length : '';
    if (!c) {
      $('#pvName').textContent = 'No creator';
      $('#pvHead').innerHTML = ''; $('#pvBody').textContent = 'Add a creator to see the personalized email here.';
      $('#pvWarns').innerHTML = ''; $('#pvActions').innerHTML = ''; return;
    }
    $('#pvName').textContent = c.name || c.handle || c.email;
    var kind = ui.previewKind, comp = compose(c, kind);
    var subjHTML = comp.subjectParts ? partsHTML(comp.subjectParts) : esc(comp.subject);
    $('#pvHead').innerHTML = '<dt>From</dt><dd>' + esc(ui.from || 'your Gmail') + '</dd><dt>To</dt><dd>' + esc(c.email || 'no email') + '</dd><dt>Subject</dt><dd>' + subjHTML + '</dd>' + (kind==='followup' ? '<dt>Thread</dt><dd>' + (c.messageId ? 'Replies to the first email' : 'No first email yet') + '</dd>' : '');
    $('#pvBody').innerHTML = partsHTML(comp.body.parts);
    var w = [];
    if (c.example) w.push(['', 'Example row. It won\'t be sent.']);
    if (!validEmail(c)) w.push(['bad', 'This email address doesn\'t look valid. Fix it in your sheet and paste the row again.']);
    comp.missing.forEach(function(k){
      var where = Object.prototype.hasOwnProperty.call(S.globals, k) ? 'Fill it in Your details' : 'Add it to this creator\'s row';
      w.push(['bad', 'No value for {{' + k + '}}. ' + where + ', or add a fallback like {{' + k + '|text}}.']);
    });
    var ph = comp.body.text.match(/\[[^\]\n]{2,40}\]/);
    if (ph) w.push(['', 'Looks like a placeholder is still in the text: ' + ph[0]]);
    if (kind==='first' && comp.subject.length > 70) w.push(['', 'Subject is ' + comp.subject.length + ' characters. Under 50 reads better on phones.']);
    if (kind==='followup' && !c.messageId) w.push(['', 'Follow-ups need a first email sent from this tool, so there\'s a thread to reply in.']);
    if (c.status==='replied') w.push(['ok', 'This creator replied. Nothing more will be sent to them.']);
    if (c.error && (c.status==='failed' || c.status==='unconfirmed')) w.push(['bad', c.error]);
    if (!w.length) w.push(['ok', kind==='first' ? 'Ready to send.' : (canFollow(c) ? 'Ready to follow up.' : 'Nothing to flag.')]);
    $('#pvWarns').innerHTML = w.map(function(x){ return '<li class="' + x[0] + '">' + esc(x[1]) + '</li>'; }).join('');

    var a = [], busy = running();
    if (kind==='first') a.push('<button class="btn primary" type="button" data-pv="send"' + (canFirst(c) && !busy ? '' : ' disabled') + '>Send this one</button>');
    else a.push('<button class="btn primary" type="button" data-pv="send"' + (canFollow(c) && !busy ? '' : ' disabled') + '>Send this follow-up</button>');
    a.push('<button class="btn" type="button" data-pv="copy">Copy text</button>');
    if (validEmail(c) && !c.example) {
      if (kind==='followup' && c.messageId) a.push('<a class="btn" target="_blank" rel="noopener" href="https://mail.google.com/mail/u/0/#search/' + encodeURIComponent('to:' + c.email) + '">Find thread in Gmail</a>');
      else a.push('<a class="btn" target="_blank" rel="noopener" href="https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(c.email) + '&su=' + encodeURIComponent(comp.subject) + '&body=' + encodeURIComponent(comp.body.text) + '">Open in Gmail</a>');
    }
    $('#pvActions').innerHTML = a.join('');
  }
  function renderAll(){
    var k = counts();
    renderStats(k); renderFilters(k); renderBulk(); renderTable(); renderSendbar(); renderPreview(); renderCapPill(); renderSavePill(); renderVars();
  }
  function renderBackupHelp(){
    $('#backupHelp').textContent = cloud
      ? 'Your list saves to the cloud and this browser. A backup file is a second copy you control.'
      : 'Your list is saved in this browser only. Download a backup now and then, or connect cloud storage in Vercel so it follows you to other devices.';
  }

  /* editor */
  function renderTabs(){
    $('#tabs').innerHTML = S.templates.map(function(t){
      var tag = t.kind==='followup' ? 'Follow-up' : (t.id===S.settings.firstTpl ? 'In use' : '');
      return '<button class="tab" role="tab" type="button" data-tpl="' + esc(t.id) + '" aria-selected="' + (t.id===ui.editTpl) + '">' + esc(t.name || 'Untitled') + (tag ? ' <span class="k">' + tag + '</span>' : '') + '</button>';
    }).join('');
  }
  function renderEditor(){
    var t = tplById(ui.editTpl) || firstTpl(); ui.editTpl = t.id;
    renderTabs();
    $('#tplName').value = t.name || '';
    $('#tplSubject').value = t.subject || '';
    $('#tplBody').value = t.body || '';
    var isFu = t.kind === 'followup';
    $('#subjectField').hidden = isFu; $('#followNote').hidden = !isFu;
    var def = DEFAULT_TEMPLATES.filter(function(d){ return d.id===t.id; })[0];
    $('#btnTplReset').hidden = !def; $('#btnTplDelete').hidden = !!def || isFu;
    renderVars(); renderYou();
  }
  function renderVars(){
    var extras = {};
    S.contacts.forEach(function(c){ if (c.extra) Object.keys(c.extra).forEach(function(k){ if (CREATOR_VARS.indexOf(k)<0) extras[k]=1; }); });
    var cv = CREATOR_VARS.concat(Object.keys(extras).filter(function(k){ return !Object.prototype.hasOwnProperty.call(S.globals, k); }));
    var gv = Object.keys(S.globals);
    function chips(list){ return list.map(function(k){ return '<button class="var" type="button" data-var="' + esc(k) + '">{{' + esc(k) + '}}</button>'; }).join(''); }
    $('#vars').innerHTML = '<div class="vargroup"><span class="lbl">Creator</span>' + chips(cv) + '</div><div class="vargroup"><span class="lbl">You</span>' + chips(gv) + '</div>';
  }
  function renderYou(){
    $('#youGrid').innerHTML = Object.keys(S.globals).map(function(k){
      return '<div class="field"><label for="g_' + esc(k) + '">' + esc(GLOBAL_LABELS[k] || k) + '<code>{{' + esc(k) + '}}</code></label><input type="text" id="g_' + esc(k) + '" data-g="' + esc(k) + '" value="' + esc(S.globals[k]) + '" autocomplete="off"' + (k==='product' ? ' placeholder="e.g. your program\'s name"' : '') + '></div>';
    }).join('');
    if (!String(S.globals.product||'').trim()) $('#youBox').open = true;
  }
  function renderSettings(){
    $('#setTpl').innerHTML = S.templates.filter(function(t){ return t.kind==='first'; }).map(function(t){ return '<option value="' + esc(t.id) + '"' + (t.id===S.settings.firstTpl ? ' selected' : '') + '>' + esc(t.name || 'Untitled') + '</option>'; }).join('');
    $('#setGap').value = String(S.settings.gap); if (!$('#setGap').value) $('#setGap').value = '45';
    $('#setCap').value = S.settings.cap;
    $('#setDue').value = String(S.settings.dueHours); if (!$('#setDue').value) $('#setDue').value = '20';
  }

  /* ---------- walkthrough ---------- */
  var TOUR = [
    { title:'Welcome to Creator Mailer', text:'This tool sends personalized emails to creators from your Gmail, one at a time, and tracks who replied. Here\'s a one-minute tour.' },
    { target:'#importBox', title:'Add your creators', text:'Paste rows straight from Google Sheets with a header row: <code>name, email, handle, niche, line</code>. The line column is your personal compliment for each creator.', before:function(){ $('#importBox').open = true; } },
    { target:'#youBox', title:'Fill in your details', text:'Your name, brand, product and commission go into every email. Emails stay blocked until the product name is filled in, so a blank tag never goes out.', before:function(){ $('#youBox').open = true; } },
    { target:'#tabs', title:'Pick a template', text:'Choose Fitness affiliate or UGC webinars, then edit the wording below. The one marked In use is what first emails send.' },
    { target:'#vars', title:'Personalize with tags', text:'Click a tag to insert it at your cursor. Each tag swaps in that creator\'s details. Add a fallback like <code>{{first_name|there}}</code> for anyone missing it.' },
    { target:'#previewPanel', title:'Check the preview', text:'Click any creator\'s name to see exactly what they\'ll get. Blue words came from their row. Red means something is missing.' },
    { target:'#sendbar', title:'Select and send', text:'Tick creators or click All ready, then press Send first email. It sends one about every 45 seconds. Keep the tab open while it runs.' },
    { target:'#tableWrap', title:'Track and follow up', text:'Statuses update as emails go out. After about 20 hours you\'ll see Follow-up due. The follow-up lands as a reply in the same thread. Click Replied when someone answers so they get nothing else.' },
    { target:'#testRow', title:'Test before your first batch', text:'Send a test to yourself to see the real email in your inbox. You can replay this tour anytime from Take the tour.' }
  ];
  var tour = null;
  function maybeStartTour(){
    var done = false; try { done = localStorage.getItem(TOUR_KEY) === 'done'; } catch(e) {}
    if (!done) setTimeout(function(){ startTour(); }, 500);
  }
  function startTour(){
    if (tour) return;
    var block = document.createElement('div'); block.className = 'tour-block';
    var spot = document.createElement('div'); spot.className = 'tour-spot center';
    var card = document.createElement('div'); card.className = 'tour-card'; card.setAttribute('role','dialog'); card.setAttribute('aria-modal','true'); card.setAttribute('aria-labelledby','tcTitle'); card.tabIndex = -1;
    document.body.appendChild(block); document.body.appendChild(spot); document.body.appendChild(card);
    tour = { i:0, block:block, spot:spot, card:card, raf:0 };
    card.addEventListener('click', function(e){
      var b = e.target.closest('[data-t]'); if (!b) return;
      var a = b.getAttribute('data-t');
      if (a === 'next') { if (tour.i >= TOUR.length-1) endTour(); else showStep(tour.i+1); }
      else if (a === 'back') showStep(tour.i-1);
      else endTour();
    });
    window.addEventListener('resize', onTourMove); window.addEventListener('scroll', onTourMove, true);
    document.addEventListener('keydown', onTourKey);
    showStep(0);
  }
  function onTourKey(e){
    if (!tour) return;
    if (e.key === 'Escape') endTour();
    else if (e.key === 'ArrowRight') { if (tour.i < TOUR.length-1) showStep(tour.i+1); }
    else if (e.key === 'ArrowLeft') { if (tour.i > 0) showStep(tour.i-1); }
  }
  function onTourMove(){ if (!tour) return; cancelAnimationFrame(tour.raf); tour.raf = requestAnimationFrame(placeTour); }
  function showStep(i){
    tour.i = i;
    var s = TOUR[i];
    if (s.before) s.before();
    var last = i === TOUR.length-1;
    tour.card.innerHTML =
      '<div class="tc-step">' + (s.target ? 'Step ' + i + ' of ' + (TOUR.length-1) : 'Quick tour') + '</div>' +
      '<h3 id="tcTitle">' + esc(s.title) + '</h3><p>' + s.text + '</p>' +
      '<div class="tc-foot"><div class="tc-dots" aria-hidden="true">' + TOUR.map(function(_, j){ return '<span class="' + (j===i ? 'on' : '') + '"></span>'; }).join('') + '</div>' +
      '<div class="tc-btns">' + (last ? '' : '<button class="tc-skip" type="button" data-t="skip">Skip</button>') +
      (i > 0 ? '<button class="btn sm" type="button" data-t="back">Back</button>' : '') +
      '<button class="btn sm primary" type="button" data-t="next">' + (i===0 ? 'Show me' : (last ? 'Finish' : 'Next')) + '</button></div></div>';
    var el = s.target ? document.querySelector(s.target) : null;
    if (el) el.scrollIntoView({ block:'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    placeTour();
    setTimeout(placeTour, 380);
    var nb = tour.card.querySelector('[data-t="next"]'); if (nb) nb.focus({ preventScroll:true });
  }
  function placeTour(){
    if (!tour) return;
    var s = TOUR[tour.i], el = s.target ? document.querySelector(s.target) : null;
    var card = tour.card, spot = tour.spot;
    var vw = window.innerWidth, vh = window.innerHeight, cw = card.offsetWidth, ch = card.offsetHeight, gap = 14, pad = 8;
    if (!el) {
      spot.classList.add('center');
      card.style.left = Math.max(12, (vw - cw) / 2) + 'px';
      card.style.top = Math.max(12, (vh - ch) / 2.4) + 'px';
      return;
    }
    spot.classList.remove('center');
    var r = el.getBoundingClientRect();
    var top = Math.max(4, r.top - pad), bottom = Math.min(vh - 4, r.bottom + pad);
    spot.style.left = (r.left - pad) + 'px'; spot.style.top = top + 'px';
    spot.style.width = (r.width + pad*2) + 'px'; spot.style.height = Math.max(0, bottom - top) + 'px';
    if (vw <= 600) return; // CSS pins the card to the bottom on phones
    var t;
    if (r.bottom + gap + ch <= vh - 12) t = r.bottom + gap;
    else if (r.top - gap - ch >= 12) t = r.top - gap - ch;
    else t = Math.min(vh - ch - 12, Math.max(12, r.top + 16));
    var l = r.left;
    if (r.width < cw) l = r.left + r.width/2 - cw/2;
    if (t > r.top && t < r.bottom && r.width > cw + 40) l = r.right - cw - 16; // overlapping a big panel: tuck into its corner
    card.style.left = Math.min(Math.max(12, l), vw - cw - 12) + 'px';
    card.style.top = t + 'px';
  }
  function endTour(){
    if (!tour) return;
    try { localStorage.setItem(TOUR_KEY, 'done'); } catch(e) {}
    window.removeEventListener('resize', onTourMove); window.removeEventListener('scroll', onTourMove, true);
    document.removeEventListener('keydown', onTourKey);
    tour.block.remove(); tour.spot.remove(); tour.card.remove();
    tour = null;
    var b = $('#btnTour'); if (b) b.focus({ preventScroll:true });
  }

  /* ---------- events ---------- */
  var editTimer;
  function editorChanged(){ clearTimeout(editTimer); editTimer = setTimeout(function(){ save(); }, 400); renderAll(); }
  function resetContact(c){ c.status='ready'; c.error=''; delete c.sentAt; delete c.followAt; delete c.messageId; delete c.subject; }

  function bind(){
    $('#btnImport').addEventListener('click', function(){
      var r = importText($('#importText').value);
      $('#importMsg').textContent = r.msg;
      if (r.added) { $('#importText').value = ''; ui.filter = 'all'; }
      save(); renderAll();
    });
    $('#btnClearExamples').addEventListener('click', function(){
      S.contacts = S.contacts.filter(function(c){ return !c.example; });
      $('#importBox').open = true; save(); renderAll();
    });
    $('#filters').addEventListener('click', function(e){ var b = e.target.closest('[data-f]'); if (!b) return; ui.filter = b.getAttribute('data-f'); renderAll(); });
    $('#selAll').addEventListener('change', function(e){
      var on = e.target.checked;
      S.contacts.filter(function(c){ return matchFilter(c, ui.filter) && !c.example; }).forEach(function(c){ if (on) ui.sel[c.id]=true; else delete ui.sel[c.id]; });
      renderAll();
    });
    $('#tbody').addEventListener('click', function(e){
      var el = e.target.closest('[data-act]'); if (!el) return;
      var tr = el.closest('tr'), c = tr && byId(tr.getAttribute('data-id')); if (!c) return;
      var act = el.getAttribute('data-act');
      if (act==='sel') { if (el.checked) ui.sel[c.id]=true; else delete ui.sel[c.id]; renderAll(); return; }
      if (act==='preview') { ui.previewId = c.id; ui.previewKind = (c.status==='sent' || c.status==='followed') ? 'followup' : 'first'; renderAll(); return; }
      if (act==='replied') { c.prevStatus = c.status; c.status = 'replied'; c.repliedAt = Date.now(); delete ui.sel[c.id]; }
      if (act==='unreplied') { c.status = c.prevStatus || (c.followAt ? 'followed' : 'sent'); }
      if (act==='marksent') { c.status = 'sent'; c.sentAt = c.sentAt || Date.now(); c.error = ''; }
      if (act==='reset') resetContact(c);
      if (act==='remove') { S.contacts = S.contacts.filter(function(x){ return x !== c; }); delete ui.sel[c.id]; toast('Removed ' + (c.name || c.handle || c.email) + '.'); }
      save(); renderAll();
    });
    function csvText(){
      var cols = ['name','email','handle','niche','status','sent_at','followed_up_at'];
      var q = function(v){ v = String(v==null?'':v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; };
      var iso = function(ts){ return ts ? new Date(ts).toISOString().slice(0,16).replace('T',' ') : ''; };
      var real = S.contacts.filter(function(c){ return !c.example; });
      return { n: real.length, text: [cols.join(',')].concat(real.map(function(c){ return [c.name,c.email,c.handle,c.niche,c.status,iso(c.sentAt),iso(c.followAt)].map(q).join(','); })).join('\n') };
    }
    $('#bulk').addEventListener('click', function(e){
      var b = e.target.closest('[data-b]'); if (!b) return;
      var act = b.getAttribute('data-b'), ids = selIds();
      if (act==='csv') { var d = csvText(); download('creator-mailer-' + new Date().toISOString().slice(0,10) + '.csv', d.text, 'text/csv'); return; }
      if (act==='copy') { var c2 = csvText(); copyText(c2.text).then(function(ok){ toast(ok ? 'Copied ' + c2.n + ' rows. Paste them into your sheet.' : 'Couldn\'t copy. Your browser blocked it.'); }); return; }
      if (act==='remove') {
        openModal('Remove ' + ids.length + ' creator' + (ids.length>1?'s':'') + '?', '<p>Their send history in this tool goes too. Emails already in Gmail stay there.</p>', 'Remove', function(){
          S.contacts = S.contacts.filter(function(c){ return !ui.sel[c.id]; }); ui.sel = {}; save(); renderAll();
        });
        return;
      }
      if (act==='reset') {
        openModal('Reset ' + ids.length + ' to ready?', '<p>This clears their sent status, so they can get a first email again. Only do this if those emails never went out.</p>', 'Reset', function(){
          ids.forEach(function(id){ var c = byId(id); if (c && !c.example) resetContact(c); });
          save(); renderAll();
        });
      }
    });
    $('#quick').addEventListener('click', function(e){
      var b = e.target.closest('[data-q]'); if (!b) return;
      var q = b.getAttribute('data-q');
      ui.sel = {};
      if (q==='ready') { S.contacts.filter(canFirst).forEach(function(c){ ui.sel[c.id]=true; }); ui.filter='ready'; ui.previewKind='first'; }
      if (q==='due') { S.contacts.filter(function(c){ return isDue(c) && canFollow(c); }).forEach(function(c){ ui.sel[c.id]=true; }); ui.filter='due'; ui.previewKind='followup'; }
      renderAll();
    });
    $('#btnFirst').addEventListener('click', function(){ askToStart('first', selIds()); });
    $('#btnFollow').addEventListener('click', function(){ askToStart('followup', selIds()); });
    $('#runline').addEventListener('click', function(e){
      var b = e.target.closest('[data-run]'); if (!b || !ui.run) return;
      if (b.getAttribute('data-run')==='stop') { ui.run.stopped = true; renderRun(); }
      else { ui.run = null; renderRun(); renderSendbar(); }
    });

    // preview
    $('#pvFirst').addEventListener('click', function(){ ui.previewKind='first'; renderPreview(); });
    $('#pvFollow').addEventListener('click', function(){ ui.previewKind='followup'; renderPreview(); });
    function stepPreview(d){ var l = previewList(), i = l.indexOf(byId(ui.previewId)); var n = l[i+d]; if (n) { ui.previewId = n.id; renderTable(); renderPreview(); } }
    $('#pvPrev').addEventListener('click', function(){ stepPreview(-1); });
    $('#pvNext').addEventListener('click', function(){ stepPreview(1); });
    $('#pvActions').addEventListener('click', function(e){
      var b = e.target.closest('[data-pv]'); if (!b) return;
      var c = byId(ui.previewId); if (!c) return;
      if (b.getAttribute('data-pv')==='send') askToStart(ui.previewKind, [c.id]);
      else { var comp = compose(c, ui.previewKind); copyText('Subject: ' + comp.subject + '\n\n' + comp.body.text).then(function(ok){ toast(ok ? 'Email copied.' : 'Couldn\'t copy. Your browser blocked it.'); }); }
    });

    // editor
    $('#tabs').addEventListener('click', function(e){
      var b = e.target.closest('[data-tpl]'); if (!b) return;
      ui.editTpl = b.getAttribute('data-tpl');
      var t = tplById(ui.editTpl);
      ui.previewKind = t && t.kind==='followup' ? 'followup' : 'first';
      if (t && t.kind==='first' && !running()) { S.settings.firstTpl = t.id; save(); renderSettings(); }
      renderEditor(); renderAll();
    });
    $('#tplName').addEventListener('input', function(e){ tplById(ui.editTpl).name = e.target.value; renderTabs(); renderSettings(); editorChanged(); });
    $('#tplSubject').addEventListener('input', function(e){ tplById(ui.editTpl).subject = e.target.value; editorChanged(); });
    $('#tplBody').addEventListener('input', function(e){ tplById(ui.editTpl).body = e.target.value; editorChanged(); });
    ['#tplSubject','#tplBody'].forEach(function(s){ $(s).addEventListener('focus', function(e){ ui.lastField = e.target; }); });
    $('#vars').addEventListener('click', function(e){
      var b = e.target.closest('[data-var]'); if (!b) return;
      var ta = ui.lastField && !ui.lastField.closest('[hidden]') ? ui.lastField : $('#tplBody');
      var tag = '{{' + b.getAttribute('data-var') + '}}';
      var s = ta.selectionStart == null ? ta.value.length : ta.selectionStart, en = ta.selectionEnd == null ? s : ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + tag + ta.value.slice(en);
      ta.focus(); try { ta.setSelectionRange(s + tag.length, s + tag.length); } catch(err) {}
      ta.dispatchEvent(new Event('input'));
    });
    $('#youGrid').addEventListener('input', function(e){ var k = e.target.getAttribute('data-g'); if (!k) return; S.globals[k] = e.target.value; editorChanged(); });
    $('#btnNewTpl').addEventListener('click', function(){
      var base = firstTpl();
      var t = { id:'t' + Date.now().toString(36), name:'New template', kind:'first', subject:base.subject, body:base.body };
      var fuIdx = S.templates.indexOf(followTpl());
      S.templates.splice(fuIdx < 0 ? S.templates.length : fuIdx, 0, t);
      ui.editTpl = t.id; S.settings.firstTpl = t.id; save(); renderEditor(); renderSettings(); renderAll();
      $('#tplName').focus(); $('#tplName').select();
    });
    $('#btnTplReset').addEventListener('click', function(){
      var d = DEFAULT_TEMPLATES.filter(function(x){ return x.id===ui.editTpl; })[0]; if (!d) return;
      openModal('Reset "' + d.name + '" to the original text?', '<p>Your edits to this template are replaced.</p>', 'Reset', function(){
        var t = tplById(ui.editTpl); t.name = d.name; t.subject = d.subject; t.body = d.body; save(); renderEditor(); renderSettings(); renderAll();
      });
    });
    $('#btnTplDelete').addEventListener('click', function(){
      var t = tplById(ui.editTpl); if (!t || t.kind==='followup' || DEFAULT_TEMPLATES.some(function(d){ return d.id===t.id; })) return;
      openModal('Delete "' + (t.name||'Untitled') + '"?', '<p>This template is removed. Emails already sent aren\'t affected.</p>', 'Delete', function(){
        S.templates = S.templates.filter(function(x){ return x !== t; });
        if (S.settings.firstTpl === t.id) S.settings.firstTpl = S.templates.filter(function(x){ return x.kind==='first'; })[0].id;
        ui.editTpl = S.settings.firstTpl; save(); renderEditor(); renderSettings(); renderAll();
      });
    });

    // settings
    $('#setTpl').addEventListener('change', function(e){ S.settings.firstTpl = e.target.value; save(); renderTabs(); renderAll(); });
    $('#setGap').addEventListener('change', function(e){ S.settings.gap = Number(e.target.value)||45; save(); });
    $('#setCap').addEventListener('change', function(e){ var v = Math.max(1, Math.min(500, Math.round(Number(e.target.value)||40))); S.settings.cap = v; e.target.value = v; save(); renderAll(); });
    $('#setDue').addEventListener('change', function(e){ S.settings.dueHours = Number(e.target.value)||20; save(); renderAll(); });

    function testMsg(text, cls){ var m = $('#testMsg'); m.textContent = text; m.className = 'help ' + (cls||''); }
    $('#btnTest').addEventListener('click', function(){
      if (!ui.from) { testMsg('Gmail is not set up yet. Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel.', 'bad'); return; }
      var c = byId(ui.previewId) || S.contacts[0] || assign({}, EXAMPLES[0]);
      var comp = compose(c, 'first');
      if (comp.missing.length) { testMsg('Fill in ' + comp.missing.join(', ') + ' first, so the test looks real.', 'bad'); return; }
      var btn = $('#btnTest'); btn.disabled = true; testMsg('Sending test…');
      api('/api/send', { method:'POST', body:JSON.stringify({ to:ui.from, subject:'[Test] ' + comp.subject, body:comp.body.text }) }).then(function(j){
        if (j.ok) testMsg('Test sent to ' + ui.from + ', using ' + (c.name || c.handle || c.email) + '\'s details. Check your inbox.', 'ok');
        else if (j.code === 'unauthorized') goLogin();
        else testMsg(j.message || 'The test did not send.', 'bad');
      }, function(){ testMsg('Could not reach the server.', 'bad'); }).then(function(){ btn.disabled = false; });
    });
    $('#btnVerify').addEventListener('click', function(){
      var btn = $('#btnVerify'); btn.disabled = true; testMsg('Checking Gmail login…');
      api('/api/status?verify=1').then(function(j){
        if (j.code === 'unauthorized') return goLogin();
        if (!j.mail || !j.mail.configured) testMsg('Gmail is not set up yet. Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel, then redeploy.', 'bad');
        else if (j.mail.verified) testMsg('Gmail login works for ' + j.mail.from + '.', 'ok');
        else testMsg((j.mail.error && j.mail.error.message) || 'Gmail login failed.', 'bad');
      }, function(){ testMsg('Could not reach the server.', 'bad'); }).then(function(){ btn.disabled = false; });
    });

    // backup
    $('#btnBackup').addEventListener('click', function(){
      download('creator-mailer-backup-' + new Date().toISOString().slice(0,10) + '.json', JSON.stringify(S, null, 2), 'application/json');
    });
    $('#btnRestore').addEventListener('click', function(){ $('#restoreFile').click(); });
    $('#restoreFile').addEventListener('change', function(e){
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function(){
        var data; try { data = JSON.parse(reader.result); } catch(err) { toast('That file isn\'t a Creator Mailer backup.'); return; }
        if (!data || !Array.isArray(data.contacts)) { toast('That file isn\'t a Creator Mailer backup.'); return; }
        var n = data.contacts.filter(function(c){ return c && !c.example; }).length;
        var when = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'an unknown date';
        openModal('Restore this backup?', '<p>It has ' + n + ' creators, saved ' + esc(when) + '. It replaces your current list and templates.</p>', 'Restore', function(){
          S = normalize(data); ui.sel = {}; ui.editTpl = S.settings.firstTpl; save(); renderAll(); renderEditor(); renderSettings(); toast('Backup restored.');
        });
      };
      reader.readAsText(f);
      e.target.value = '';
    });

    // header
    $('#btnTour').addEventListener('click', function(){ startTour(); });
    $('#btnLogout').addEventListener('click', function(){
      if (running()) { toast('Stop the current batch before logging out.'); return; }
      api('/api/logout', { method:'POST' }).then(goLogin, goLogin);
    });

    // modal
    $('#mCancel').addEventListener('click', closeModal);
    $('#mOk').addEventListener('click', function(){ var f = modalOk; closeModal(); if (f) f(); });
    $('#modal').addEventListener('click', function(e){ if (e.target.id==='modal') closeModal(); });
    document.addEventListener('keydown', function(e){ if (e.key==='Escape' && !$('#modal').hidden) closeModal(); });
    window.addEventListener('beforeunload', function(e){ if (running()) { e.preventDefault(); e.returnValue = ''; } });
    setInterval(function(){ if (!running()) { renderStats(counts()); renderCapPill(); } }, 60000);
  }

  /* ---------- boot ---------- */
  bind();
  renderAll(); renderEditor(); renderSettings(); renderGmailPill(); renderBackupHelp();
  initStore();
  checkStatus();

  return function(){};
}
