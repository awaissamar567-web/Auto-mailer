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
      body:'Hey {{first_name|there}}, just bumping this up in case it got buried. Happy to share more details if it sounds like a fit, and no worries at all if not.\n\n{{my_name}}' },
    { id:'fu2', name:'Follow-up 2', kind:'followup2',
      subject:'',
      body:'Hey {{first_name|there}}, last note from me on this. If the timing is off, no problem at all. If you want to take a look later, just reply here and I\'ll send it over.\n\n{{my_name}}' },
    { id:'next', name:'Interested', kind:'next',
      subject:'',
      body:'Hey {{first_name|there}}, glad to hear it. I\'ve added you to the early partner list for {{product}}. I\'m finishing the final version now, and you\'ll be one of the first to get your free copy along with your {{commission}} affiliate link.\n\nI\'ll email you here as soon as it\'s ready.\n\n{{my_name}}\n{{brand}}' },
    { id:'counter', name:'Soft no', kind:'counter',
      subject:'',
      body:'Hey {{first_name|there}}, totally understand, and thanks for getting back to me. One quick question if you don\'t mind: is it the timing, or is this just not a fit for your audience? Either way, I won\'t keep emailing.\n\n{{my_name}}' }
  ];
  var THREAD_KINDS = ['followup','followup2','next','counter'];
  var KIND_LABEL = { followup:'Follow-up', followup2:'Follow-up 2', next:'Interested', counter:'Soft no' };
  var DAY = 86400000, FOLLOW2_DAYS = 6;
  var TAG_LABEL = { interested:'Interested', not_interested:'Not interested', question:'Needs your reply', no_reply:'No reply', auto_reply:'Auto-reply', bounced:'Bounced', do_not_contact:'Do not contact', replied:'Replied' };
  var TAG_TONE = { interested:'ok', not_interested:'', question:'warn', no_reply:'', auto_reply:'', bounced:'bad', do_not_contact:'bad', replied:'ok' };
  var DEFAULT_GLOBALS = { my_name:'Awais', brand:'Obsidx', product:'', commission:'40%', link:'' };
  var GLOBAL_LABELS = { my_name:'Your name', brand:'Brand', product:'Product name', commission:'Commission', link:'Link' };
  var DEFAULT_SETTINGS = { gap:45, cap:40, firstTpl:'fit', dueHours:20, sender:'rotate', tz:'', auto:{ on:true, follow:true, next:true, counter:false }, autoDays:'weekdays', workStart:'09:00', workEnd:'19:00' };
  var CAMP_STATES = { scheduled:'Scheduled', running:'Sending', paused:'Paused', done:'Done' };
  var DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
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

  /* ---------- dates in the sending time zone ---------- */
  function tz(){ return S.settings.tz || (function(){ try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch(e){ return 'UTC'; } })(); }
  // Today's date and the minute of day in the sending time zone, so a campaign fires when the creators' clock says so.
  function nowIn(d){
    try {
      var o = {}; new Intl.DateTimeFormat('en-CA', { timeZone:tz(), hourCycle:'h23', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).formatToParts(d || new Date()).forEach(function(x){ o[x.type] = x.value; });
      return { date:o.year + '-' + o.month + '-' + o.day, mins:(Number(o.hour)%24)*60 + Number(o.minute) };
    } catch(e) { var n = d || new Date(); return { date:n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0') + '-' + String(n.getDate()).padStart(2,'0'), mins:n.getHours()*60 + n.getMinutes() }; }
  }
  function todayIso(){ return nowIn().date; }
  function addDays(iso, n){ var p = iso.split('-').map(Number); var d = new Date(Date.UTC(p[0], p[1]-1, p[2] + n)); return d.toISOString().slice(0,10); }
  function weekdayOf(iso){ var p = iso.split('-').map(Number); return (new Date(Date.UTC(p[0], p[1]-1, p[2])).getUTCDay() + 6) % 7; } // 0 = Monday
  function mondayOf(iso){ return addDays(iso, -weekdayOf(iso)); }
  function fmtDay(iso){ var p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1]-1, p[2])).toLocaleDateString(undefined, { month:'short', day:'numeric', timeZone:'UTC' }); }
  function fmtTime(t){ var m = toMins(t), h = Math.floor(m/60), mm = m%60; return (h%12 || 12) + (mm ? ':' + String(mm).padStart(2,'0') : '') + (h < 12 ? 'am' : 'pm'); }

  /* ---------- state ---------- */
  function fresh(){
    return { v:2, updatedAt:0, checkedAt:0,
      contacts: EXAMPLES.map(function(e){ return assign({}, e, { id:uid(), status:'ready' }); }),
      templates: clone(DEFAULT_TEMPLATES),
      globals: assign({}, DEFAULT_GLOBALS),
      settings: assign({}, DEFAULT_SETTINGS),
      campaigns: [] };
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
    THREAD_KINDS.forEach(function(kind){
      if (!n.templates.some(function(t){ return t.kind===kind; })) n.templates.push(clone(DEFAULT_TEMPLATES.filter(function(t){ return t.kind===kind; })[0]));
    });
    n.checkedAt = Number(d.checkedAt) || 0;
    n.cronAt = Number(d.cronAt) || 0;
    n.cronLog = Array.isArray(d.cronLog) ? d.cronLog.slice(0, 30) : [];
    if (d.cronDigest && typeof d.cronDigest === 'object') n.cronDigest = d.cronDigest;
    if (Array.isArray(d.campaigns)) n.campaigns = d.campaigns.filter(function(k){ return k && typeof k==='object' && k.id; }).map(cleanCampaign);
    var campIds = {}; n.campaigns.forEach(function(k){ campIds[k.id] = 1; });
    n.contacts.forEach(function(c){ if (c.campaignId && !campIds[c.campaignId]) delete c.campaignId; });
    if (!n.templates.some(function(t){ return t.kind==='first'; })) n.templates.unshift(clone(DEFAULT_TEMPLATES[0]));
    n.globals = assign({}, DEFAULT_GLOBALS, d.globals);
    n.settings = assign({}, DEFAULT_SETTINGS, d.settings);
    n.settings = cleanSettings(n.settings);
    if (!n.templates.some(function(t){ return t.id===n.settings.firstTpl && t.kind==='first'; })) n.settings.firstTpl = n.templates.filter(function(t){ return t.kind==='first'; })[0].id;
    return n;
  }

  // Saved settings can come from old versions, backups or other devices. Snap them to allowed values.
  var GAP_OPTIONS = [20, 30, 45, 60, 90, 120], DUE_OPTIONS = [12, 20, 24, 48, 72];
  function cleanSettings(st){
    var g = Number(st.gap); st.gap = GAP_OPTIONS.indexOf(g) >= 0 ? g : DEFAULT_SETTINGS.gap;
    var c = Math.round(Number(st.cap)); st.cap = (c >= 1 && c <= 500) ? c : DEFAULT_SETTINGS.cap;
    var dh = Number(st.dueHours); st.dueHours = DUE_OPTIONS.indexOf(dh) >= 0 ? dh : DEFAULT_SETTINGS.dueHours;
    st.tz = validTz(st.tz) ? st.tz : '';
    var a = st.auto && typeof st.auto === 'object' ? st.auto : {};
    st.auto = { on:a.on !== false, follow:a.follow !== false, next:a.next !== false, counter:a.counter === true };
    st.autoDays = st.autoDays === 'all' ? 'all' : 'weekdays';
    st.workStart = cleanTime(st.workStart, '09:00'); st.workEnd = cleanTime(st.workEnd, '19:00');
    if (toMins(st.workEnd) <= toMins(st.workStart)) { st.workStart = '09:00'; st.workEnd = '19:00'; }
    return st;
  }
  function validTz(tz){ if (!tz || typeof tz !== 'string') return false; try { new Intl.DateTimeFormat('en-US', { timeZone:tz }); return true; } catch(e){ return false; } }
  function cleanCampaign(k){
    var out = assign({}, k);
    out.name = String(k.name || 'Campaign').slice(0, 80);
    out.date = /^\d{4}-\d{2}-\d{2}$/.test(k.date || '') ? k.date : todayIso();
    out.start = cleanTime(k.start, '10:00'); out.end = cleanTime(k.end, '13:00');
    if (toMins(out.end) <= toMins(out.start)) out.end = cleanTime(String(Math.min(23, Math.floor(toMins(out.start)/60) + 3)).padStart(2,'0') + ':' + String(toMins(out.start)%60).padStart(2,'0'), '23:59');
    var cap = Math.round(Number(k.cap)); out.cap = cap >= 1 && cap <= 500 ? cap : 0;
    out.sender = k.sender || 'rotate';
    out.state = CAMP_STATES[k.state] ? k.state : 'scheduled';
    if (out.state === 'running') out.state = 'scheduled';
    out.createdAt = Number(k.createdAt) || Date.now();
    return out;
  }
  function cleanTime(t, def){ var m = /^(\d{1,2}):(\d{2})$/.exec(String(t||'')); if (!m || +m[1] > 23 || +m[2] > 59) return def; return String(+m[1]).padStart(2,'0') + ':' + m[2]; }
  function toMins(t){ var p = String(t||'0:0').split(':'); return (+p[0])*60 + (+p[1]); }
  var S = fresh();
  var ui = { week:null, dragId:null, filter:'all', sel:{}, previewId:null, previewKind:'first', editTpl:'fit', lastField:null, run:null, gmail:'checking', from:'', accounts:[], save:'loading', loaded:false, view:'send', rfilter:'all', ai:false, checking:false, checkMsg:'', checkErr:'', drafts:{} };

  function byId(id){ for (var i=0;i<S.contacts.length;i++) if (S.contacts[i].id===id) return S.contacts[i]; return null; }
  function tplById(id){ for (var i=0;i<S.templates.length;i++) if (S.templates[i].id===id) return S.templates[i]; return null; }
  function firstTpl(){ var t = tplById(S.settings.firstTpl); return (t && t.kind==='first') ? t : S.templates.filter(function(t){ return t.kind==='first'; })[0]; }
  function campById(id){ for (var i=0;i<S.campaigns.length;i++) if (S.campaigns[i].id===id) return S.campaigns[i]; return null; }
  function campOf(c){ return c && c.campaignId ? campById(c.campaignId) : null; }
  // A creator in a campaign uses that campaign's template; everyone else uses the one picked in Sending.
  function firstTplFor(c){ var k = campOf(c), t = k && tplById(k.tpl); return (t && t.kind==='first') ? t : firstTpl(); }
  function campContacts(k){ return S.contacts.filter(function(c){ return c.campaignId === k.id && !c.example; }); }
  function campStats(k){
    var list = campContacts(k), r = { total:list.length, sent:0, ready:0, blocked:0, today:0, replied:0 };
    list.forEach(function(c){
      if (c.sentAt) { r.sent++; if (isToday(c.sentAt)) r.today++; if (c.status==='replied') r.replied++; }
      else if (canFirst(c)) r.ready++;
      else r.blocked++;
    });
    return r;
  }
  // Due = its date has come, the clock is inside its window, and it still has creators to send to.
  function campDue(k){
    if (k.state === 'done' || k.state === 'paused') return false;
    var n = nowIn();
    if (n.date < k.date) return false;
    if (n.mins < toMins(k.start) || n.mins >= toMins(k.end)) return false;
    if (k.cap && campStats(k).today >= k.cap) return false;
    return campStats(k).ready > 0;
  }
  function campWindowLeft(k){ var n = nowIn(); return n.date >= k.date && n.mins >= toMins(k.start) && n.mins < toMins(k.end); }
  function tplOfKind(kind){ return S.templates.filter(function(t){ return t.kind===kind; })[0]; }
  function followTpl(){ return tplOfKind('followup'); }
  // The template a threaded email uses. The second follow-up has its own wording.
  function threadTpl(c, kind){
    if (kind === 'followup') return ((c.followCount||0) >= 1 && tplOfKind('followup2')) || followTpl();
    return tplOfKind(kind) || followTpl();
  }
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
    if (kind !== 'first') {
      var ft = threadTpl(c, kind), fb = fill(ft.body, c);
      var base = c.subject || fill(firstTplFor(c).subject, c).text;
      return { subject: /^re:/i.test(base) ? base : 'Re: ' + base, subjectParts:null, body:fb, missing:fb.missing };
    }
    var t = firstTplFor(c), s = fill(t.subject, c), b = fill(t.body, c);
    var miss = s.missing.slice(); b.missing.forEach(function(k){ if (miss.indexOf(k)<0) miss.push(k); });
    return { subject:s.text, subjectParts:s.parts, body:b, missing:miss };
  }

  /* ---------- eligibility + status ---------- */
  function locked(c){ return !!(c.example || c.dnc || c.bounced); }
  function tagOf(c){
    if (c.dnc) return 'do_not_contact';
    if (c.bounced) return 'bounced';
    if (c.status==='replied') return (c.reply && c.reply.tag) || 'replied';
    if (c.reply && c.reply.tag==='auto_reply') return 'auto_reply';
    return 'no_reply';
  }
  function canFirst(c){ return !locked(c) && validEmail(c) && (c.status==='ready' || c.status==='failed') && compose(c,'first').missing.length===0; }
  // Two follow-ups at most, then it stops.
  function canFollow(c){ return !locked(c) && validEmail(c) && (c.status==='sent' || c.status==='followed') && (c.followCount||0) < 2 && !!c.messageId && compose(c,'followup').missing.length===0; }
  function canNext(c){ return !locked(c) && validEmail(c) && c.status==='replied' && tagOf(c)==='interested' && !c.nextAt && !!c.messageId && compose(c,'next').missing.length===0; }
  // One counter-question, only after a soft no, never twice.
  function canCounter(c){ return !locked(c) && validEmail(c) && c.status==='replied' && tagOf(c)==='not_interested' && !!(c.reply && c.reply.soft) && !c.counterAt && !!c.messageId && compose(c,'counter').missing.length===0; }
  function can(kind, c){ return kind==='first' ? canFirst(c) : kind==='followup' ? canFollow(c) : kind==='next' ? canNext(c) : kind==='counter' ? canCounter(c) : false; }
  function follow2At(c){ return (c.sentAt||0) + FOLLOW2_DAYS*DAY; }
  function isDue(c){
    if (locked(c) || !c.messageId || !c.sentAt) return false;
    if (c.status==='sent') return (Date.now()-c.sentAt) >= S.settings.dueHours*HOUR;
    if (c.status==='followed') return (c.followCount||0) === 1 && Date.now() >= follow2At(c);
    return false;
  }
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
  function primaryId(){ return ui.accounts.length ? ui.accounts[0].id : ''; }
  function acctById(id){ for (var i=0;i<ui.accounts.length;i++) if (ui.accounts[i].id===id) return ui.accounts[i]; return null; }
  function acctOf(c){ return c.sentFrom || primaryId(); }
  function shortName(id){ return String(id||'').split('@')[0]; }
  function capPer(){ return Number(S.settings.cap)||40; }
  // Sends today, for one account or all of them. Older rows with no account belong to the first one.
  function sentToday(id){
    var n=0;
    S.contacts.forEach(function(c){
      if (isToday(c.sentAt) && (!id || acctOf(c)===id)) n++;
      if (isToday(c.followAt) && (!id || (c.followFrom || acctOf(c))===id)) n++;
      ['nextAt','counterAt','answerAt'].forEach(function(k){ if (isToday(c[k]) && (!id || acctOf(c)===id)) n++; });
    });
    return n;
  }
  function senderMode(){
    var m = S.settings.sender;
    if (m !== 'rotate' && !acctById(m)) m = 'rotate';
    if (ui.accounts.length < 2) m = ui.accounts.length ? ui.accounts[0].id : 'rotate';
    return m;
  }
  // Which account sends this email. Follow-ups always use the account that sent the first email.
  function pickSender(kind, c){
    if (!ui.accounts.length) return { reason:'none' };
    if (kind !== 'first') {
      var a = acctById(acctOf(c));
      if (!a) return { reason:'missing', id:acctOf(c) };
      if (sentToday(a.id) >= capPer()) return { reason:'cap', id:a.id };
      return { id:a.id };
    }
    var mode = senderMode();
    var k = campOf(c); if (k && k.sender !== 'rotate' && acctById(k.sender)) mode = k.sender;
    if (mode !== 'rotate') return sentToday(mode) >= capPer() ? { reason:'cap', id:mode } : { id:mode };
    var best = null, bestN = Infinity;
    ui.accounts.forEach(function(a){ var n = sentToday(a.id); if (n < capPer() && n < bestN) { best = a; bestN = n; } });
    return best ? { id:best.id } : { reason:'cap' };
  }
  function leftToday(kind){
    if (kind === 'first' && senderMode() !== 'rotate') return Math.max(0, capPer() - sentToday(senderMode()));
    return ui.accounts.reduce(function(t, a){ return t + Math.max(0, capPer() - sentToday(a.id)); }, 0);
  }

  function statusPill(c){
    if (c.example) return '<span class="st example">Example</span>';
    if (c.dnc) return '<span class="st bad">Do not contact</span>';
    if (c.bounced) return '<span class="st bad">Bounced</span>';
    if (!validEmail(c)) return '<span class="st bad">Bad email</span>';
    switch (c.status) {
      case 'ready': {
        var miss = compose(c,'first').missing;
        if (miss.length) return '<span class="st warn" title="Fill these in Your details or add a fallback">Needs ' + esc(miss.join(', ')) + '</span>';
        var k = campOf(c);
        if (k && k.state !== 'done') return '<span class="st ready" title="' + esc(k.name) + '">' + (k.state==='paused' ? 'Paused' : 'Scheduled ' + esc(fmtDay(k.date))) + '</span>';
        return '<span class="st ready">Ready</span>';
      }
      case 'sent': return isDue(c) ? '<span class="st due">Follow-up due</span>' : '<span class="st sent">Sent ' + esc(timeAgo(c.sentAt)) + '</span>';
      case 'followed': return isDue(c) ? '<span class="st due">Follow-up 2 due</span>' : '<span class="st followed">Followed up ' + esc(timeAgo(c.followAt)) + '</span>';
      case 'replied': { var tg = tagOf(c); return '<span class="st ' + (tg==='interested' || tg==='replied' ? 'replied' : (tg==='question' ? 'warn' : 'sent')) + '">' + esc(TAG_LABEL[tg] || 'Replied') + '</span>'; }
      case 'failed': return '<span class="st failed" title="' + esc(c.error||'') + '">Failed</span>';
      case 'unconfirmed': return '<span class="st unconfirmed" title="' + esc(c.error||'') + '">Check Sent folder</span>';
    }
    return '<span class="st">' + esc(c.status) + '</span>';
  }
  function rowActions(c){
    var a = [];
    if (!c.example) {
      if (c.status==='sent' || c.status==='followed') a.push('<button class="btn sm" data-act="replied" type="button">Replied</button>');
      if (c.dnc) a.push('<button class="btn sm" data-act="unreplied" type="button" data-tip="Allow emails to this creator again">Unlock</button>');
      else if (c.status==='replied') a.push('<button class="btn sm" data-act="unreplied" type="button">Undo</button>');
      if (c.status==='unconfirmed') a.push('<button class="btn sm" data-act="marksent" type="button">Mark sent</button>');
      if (c.status==='unconfirmed' || (c.status==='failed' && !c.bounced)) a.push('<button class="btn sm" data-act="reset" type="button">Reset</button>');
    }
    a.push('<button class="btn sm danger" data-act="remove" type="button" aria-label="Remove">&#215;</button>');
    return a.join('');
  }

  /* ---------- import ---------- */
  var ALIASES = {
    name:['name','full name','fullname','full_name','creator','creator name','contact'],
    first_name:['first name','first_name','firstname','first'],
    email:['email','e-mail','email address','email_address','mail'],
    handle:['handle','instagram','ig','username','user','insta','ig handle','instagram handle','tiktok','@','instagram url','instagram link','instagram profile','ig link','ig url','profile','profile link','profile url'],
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
    text = String(text || '').replace(/^\ufeff/, '');
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
    var items = [], columns = [];
    var firstHasEmail = rows[0].some(function(x){ return EMAIL_RE.test(x) || splitNameEmail(x); });
    if (!firstHasEmail) {
      var head = rows[0].map(mapHeader);
      var used = {};
      head = head.map(function(h, i){
        // two columns mapping to the same field: keep the first, turn the next into its own tag
        if (h && h.indexOf('x:') !== 0 && used[h]) h = 'x:' + (String(rows[0][i]).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || h + '_' + i);
        if (h) used[h] = 1;
        return h;
      });
      columns = rows[0].map(function(label, i){ return { label:String(label).trim(), field:head[i] }; });
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
    return { items:items, columns:columns, header:!firstHasEmail };
  }
  // campaignId: rows join that campaign. Anyone already emailed, or already in another campaign, is skipped and counted.
  function importText(text, source, campaignId){
    var rows = parseRows(text || '');
    if (!rows.length) return { msg:'Nothing to add. Paste at least one row.' };
    var parsed = itemsFromRows(rows), items = parsed.items;
    if (items.length && S.contacts.some(function(c){ return c.example; })) S.contacts = S.contacts.filter(function(c){ return !c.example; });
    var added = 0, updated = 0, bad = 0, contacted = 0, elsewhere = 0, dupes = [];
    items.forEach(function(it){
      it.email = String(it.email||'').trim().toLowerCase();
      it.handle = cleanHandle(it.handle);
      if (!it.email && !it.name && !it.handle) return;
      if (!Object.keys(it.extra).length) delete it.extra;
      var ex = it.email ? S.contacts.filter(function(c){ return String(c.email||'').toLowerCase()===it.email; })[0] : null;
      if (ex) {
        if (campaignId) {
          if (ex.sentAt || ex.dnc || ex.bounced) { contacted++; dupes.push(ex.name || ex.email); return; }
          if (ex.campaignId && ex.campaignId !== campaignId) { elsewhere++; dupes.push(ex.name || ex.email); return; }
          ex.campaignId = campaignId;
        }
        ['name','first_name','handle','niche','line'].forEach(function(k){ if (it[k]) ex[k] = it[k]; });
        if (it.extra) ex.extra = assign({}, ex.extra, it.extra);
        updated++;
      } else {
        var c = assign({ id:uid(), status:'ready', name:'', handle:'', niche:'', line:'' }, it);
        if (campaignId) c.campaignId = campaignId;
        S.contacts.push(c); added++;
        if (!validEmail(c)) bad++;
      }
    });
    var parts = [];
    if (added) parts.push('Added ' + added);
    if (updated) parts.push((added ? 'updated ' : 'Updated ') + updated);
    if (bad) parts.push(bad + ' with a bad or missing email');
    if (contacted) parts.push(contacted + ' skipped because you already emailed them');
    if (elsewhere) parts.push(elsewhere + ' skipped because they are in another campaign');
    var kept = items.filter(function(it){ return it.email || it.name || it.handle; });
    var report = { source:source || '', header:parsed.header, total:kept.length, columns:parsed.columns.map(function(col){
      var key = col.field ? (col.field.indexOf('x:') === 0 ? col.field.slice(2) : col.field) : '';
      var filled = kept.filter(function(it){
        if (!col.field) return false;
        var v = col.field.indexOf('x:') === 0 ? (it.extra && it.extra[key]) : it[key];
        return String(v || '').trim() !== '';
      }).length;
      return { label:col.label, field:col.field, key:key, filled:filled };
    }) };
    return { msg: parts.length ? parts.join(', ') + '.' : 'No new creators found in that paste.', added:added, updated:updated, skipped:contacted + elsewhere, dupes:dupes, report:report };
  }
  var FIELD_TAGS = { name:['first_name','name'], first_name:['first_name'], handle:['handle'], niche:['niche'], line:['line'] };
  function tagButtons(keys, isNew){ return keys.map(function(k){ return '<button class="var' + (isNew ? ' new' : '') + '" type="button" data-var="' + esc(k) + '">{{' + esc(k) + '}}</button>'; }).join(''); }
  function renderImportReport(r){
    var box = $('#importReport');
    if (!r || !r.total) { box.hidden = true; box.innerHTML = ''; return; }
    var html = '<div class="ir-head"><b>' + r.total + ' creator' + (r.total===1?'':'s') + '</b>' + (r.source ? ' from ' + esc(r.source) : '') + '. ' +
      (r.header ? 'Each column became a tag automatically. Click a tag to add it to your template.' : 'There was no header row, so columns were matched by what\'s in them: the email, any @handle, then name, niche and line.') + '</div>';
    if (r.header) {
      html += '<ul class="ir-list">' + r.columns.map(function(col){
        var fill = '<span class="ir-fill' + (col.filled < r.total ? ' part' : '') + '" title="Rows with a value">' + col.filled + '/' + r.total + '</span>';
        var what;
        if (!col.field) what = '<span class="ir-note">Ignored, no column name</span>';
        else if (col.field === 'email') what = '<span class="ir-note">Who it sends to</span>';
        else if (col.field.indexOf('x:') === 0) what = tagButtons([col.key], true) + '<span class="ir-badge">New tag</span>';
        else what = tagButtons(FIELD_TAGS[col.field] || [col.key]);
        return '<li><span class="ir-col">' + esc(col.label || '(blank)') + '</span><span class="ir-arrow" aria-hidden="true">&#8594;</span><span class="ir-what">' + what + '</span>' + (col.field ? fill : '') + '</li>';
      }).join('') + '</ul>';
      if (r.columns.some(function(c){ return c.field && c.field !== 'email' && c.filled < r.total; })) {
        html += '<p class="help">Some creators are missing a value. If you use that tag, add a fallback like <code>{{niche|your niche}}</code> so their email still sends.</p>';
      }
    }
    box.innerHTML = html; box.hidden = false;
  }
  function importFile(file){
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { $('#importMsg').textContent = 'That file is over 2 MB. Split it into smaller files.'; return; }
    if (!/\.(csv|tsv|txt)$/i.test(file.name) && !/csv|tab-separated|text\/plain/i.test(file.type)) { $('#importMsg').textContent = 'Upload a .csv or .tsv file. In Google Sheets use File, Download, CSV.'; return; }
    var reader = new FileReader();
    reader.onload = function(){
      var r = importText(String(reader.result || ''), file.name, $('#importCamp').value || '');
      $('#importMsg').textContent = r.msg;
      renderImportReport(r.report);
      if (r.added || r.updated) ui.filter = 'all';
      save(); renderAll();
    };
    reader.onerror = function(){ $('#importMsg').textContent = 'Couldn\'t read that file. Try downloading it again as CSV.'; };
    reader.readAsText(file);
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
      if (j.ok && j.state && !running() && !dirty) adopt(j.state);
      if (j.ok) ui.save = 'cloud';
      else if (j.code === 'unauthorized') ui.save = 'loggedout';
      else if (j.code === 'too_big') ui.save = 'full';
      else ui.save = 'error';
    }, function(){ ui.save = 'error'; }).then(function(){ writing = false; renderSavePill(); if (dirty) flush(); });
  }
  // Take a newer copy from the server (sends the scheduler made) without disturbing what's on screen.
  function adopt(data){
    var keepEdit = ui.editTpl;
    S = normalize(data);
    if (tplById(keepEdit)) ui.editTpl = keepEdit;
    saveLocal(); renderAll(); renderTabs(); renderSettings();
  }
  function pullCloud(){
    if (!cloud || running() || writing || dirty || !ui.loaded) return;
    var act = document.activeElement;
    if (act && (act.tagName === 'TEXTAREA' || act.tagName === 'INPUT') && act.type !== 'checkbox') return;
    api('/api/state').then(function(j){
      if (j.ok && j.state && (Number(j.state.updatedAt)||0) > (Number(S.updatedAt)||0) && !running() && !dirty) adopt(j.state);
    }, function(){});
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
      // The server has no clock of its own for you, so pin the sending zone to this browser's zone
      // when none is set. Otherwise the scheduler would read campaign times as UTC.
      var autoTz = !S.settings.tz;
      if (autoTz) { try { S.settings.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch(e) {} if (!validTz(S.settings.tz)) S.settings.tz = ''; }
      ui.loaded = true;
      ui.save = cloud ? 'cloud' : 'local';
      ui.editTpl = S.settings.firstTpl;
      $('#importBox').open = !S.contacts.some(function(c){ return !c.example; });
      var v = ''; try { v = localStorage.getItem('creator-mailer-view') || ''; } catch(e) {}
      if (v === 'calendar' || v === 'replies') setView(v);
      renderAll(); renderEditor(); renderSettings(); renderBackupHelp();
      if (r.push) { dirty = true; flush(); }
      else if (autoTz && S.settings.tz) save();
      maybeStartTour();
    });
  }

  /* ---------- Gmail (via the app's API) ---------- */
  function checkStatus(){
    api('/api/status').then(function(j){
      if (j.code === 'unauthorized') return goLogin();
      ui.accounts = (j.mail && Array.isArray(j.mail.accounts)) ? j.mail.accounts : [];
      ui.from = (j.mail && j.mail.from) || '';
      ui.gmail = ui.accounts.length ? 'ok' : 'missing'; ui.ai = !!j.ai;
      renderGmailPill(); renderSenderSettings(); renderAll();
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
      case 'auth': case 'limit': case 'throttled': case 'network': case 'account':
        return { stop:true, msg:m };
      default:
        c.status = 'unconfirmed'; c.error = m || 'Gmail did not confirm this email.';
        return { stop:true, msg:(m ? m + ' ' : '') + 'Check your Gmail Sent folder for ' + c.email + ', then use Mark sent or Reset on that row before sending more.' };
    }
  }
  // Follow-ups reply to our first email. Next steps reply to the creator's own message, so it lands under it.
  function threadInto(payload, c, kind){
    if (!c.messageId) return;
    var theirs = kind !== 'followup' && c.reply && c.reply.msgId;
    payload.inReplyTo = theirs || c.messageId;
    if (theirs) payload.references = [c.messageId];
  }
  // A typed answer to a creator's question, sent in their thread from the account they wrote to.
  function sendAnswer(c, text){
    var a = acctById(acctOf(c));
    if (!a) return Promise.resolve({ msg:'The Gmail account ' + acctOf(c) + ' is not set up anymore.' });
    if (sentToday(a.id) >= capPer()) return Promise.resolve({ msg:a.email + ' hit its daily limit of ' + capPer() + '. Raise it in Sending or wait until tomorrow.' });
    var base = c.subject || 'your message';
    var payload = { to:String(c.email).trim(), subject:/^re:/i.test(base) ? base : 'Re: ' + base, body:text, from:a.id };
    threadInto(payload, c, 'answer');
    return api('/api/send', { method:'POST', body:JSON.stringify(payload) }).then(function(j){
      if (j.code === 'unauthorized') { goLogin(); return { msg:'Logged out.' }; }
      if (!j.ok) return { msg:j.message || 'That reply did not send.' };
      c.answerAt = Date.now(); c.answerCount = (c.answerCount||0) + 1;
      return { ok:true };
    }, function(){ return { msg:'Lost connection. Check your Gmail Sent folder before sending it again.' }; });
  }

  /* ---------- replies ---------- */
  function sentList(){ return S.contacts.filter(function(c){ return !c.example && c.sentAt; }); }
  function backToSent(c){ c.status = c.prevStatus && c.prevStatus!=='replied' && c.prevStatus!=='failed' ? c.prevStatus : (c.followAt ? 'followed' : 'sent'); }
  // One place that turns a tag into contact state, for both inbox results and manual changes.
  function applyTag(c, tag, info){
    info = info || {};
    var old = c.reply || {};
    c.reply = { tag:tag, soft:!!info.soft, by:info.by || 'manual',
      snippet: info.snippet != null ? info.snippet : (old.snippet || ''),
      at: info.at || old.at || Date.now(), from: info.from || old.from || '', msgId: info.msgId != null ? info.msgId : (old.msgId || '') };
    c.dnc = tag === 'do_not_contact';
    c.bounced = tag === 'bounced';
    if (tag === 'bounced') { if (c.status!=='failed') c.prevStatus = c.status; c.status = 'failed'; c.error = 'This address bounced. The email was not delivered.'; }
    else if (tag === 'auto_reply' || tag === 'no_reply') { if (c.status==='replied' || c.status==='failed') backToSent(c); c.error = ''; if (tag === 'no_reply') { delete c.reply; c.replyClearedAt = Date.now(); } }
    else { if (c.status!=='replied') { c.prevStatus = c.status; c.repliedAt = c.reply.at; } c.status = 'replied'; c.error = ''; }
    delete ui.sel[c.id];
  }
  function checkReplies(quiet){
    if (ui.checking) return Promise.resolve(false);
    var list = sentList().filter(function(c){ return validEmail(c); });
    if (!list.length) { if (!quiet) { ui.checkMsg = 'Nothing to check yet. Send your first emails, then come back.'; ui.checkErr = ''; renderReplies(); } return Promise.resolve(false); }
    ui.checking = true; ui.checkErr = ''; if (!quiet) ui.checkMsg = 'Reading your inbox…'; renderReplies();
    var body = { contacts:list.map(function(c){ return { id:c.id, email:String(c.email).trim().toLowerCase(), messageId:c.messageId||'', sentAt:c.sentAt, from:acctOf(c), known:(c.reply && c.reply.msgId) || '' }; }) };
    return api('/api/replies', { method:'POST', body:JSON.stringify(body) }).then(function(j){
      ui.checking = false;
      if (j.code === 'unauthorized') { goLogin(); return false; }
      if (!j.ok) { ui.checkErr = j.message || 'Could not read the inbox. Try again in a minute.'; ui.checkMsg = ''; renderReplies(); return false; }
      ui.ai = !!j.ai;
      var fresh = 0;
      (j.results || []).forEach(function(r){
        var c = byId(r.id); if (!c || r.same || !r.tag) return;
        // A tag you set by hand stays until the creator writes again.
        if (c.reply && c.reply.by==='manual' && (!r.at || r.at <= (c.reply.at||0))) return;
        if (c.dnc && r.tag !== 'do_not_contact') return;
        applyTag(c, r.tag, { soft:r.soft, by:r.by, snippet:String(r.snippet||''), at:Number(r.at)||Date.now(), from:String(r.from||''), msgId:String(r.msgId||'') });
        if (r.tag !== 'auto_reply') fresh++;
      });
      S.checkedAt = Date.now();
      ui.checkMsg = fresh ? fresh + ' new repl' + (fresh===1?'y':'ies') + ' found.' : 'No new replies.';
      ui.checkErr = (j.errors || []).map(function(e){ return e.message; }).join(' ');
      save(); renderAll();
      return true;
    }, function(){ ui.checking = false; ui.checkErr = 'Could not reach the server.'; ui.checkMsg = ''; renderReplies(); return false; });
  }

  function sendOne(c, kind, from){
    var comp = compose(c, kind);
    var payload = { to:String(c.email).trim(), subject:comp.subject, body:comp.body.text, from:from };
    if (kind !== 'first') threadInto(payload, c, kind);
    payload.once = kind === 'first' ? c.id + ':first' : kind === 'followup' ? c.id + ':follow' + ((c.followCount||0) + 1) : c.id + ':' + kind;
    return api('/api/send', { method:'POST', body:JSON.stringify(payload) }).then(function(j){
      if (j.code === 'duplicate') {
        if (!j.messageId) return { stop:true, msg:'The scheduler is sending to ' + c.email + ' right now. Its status updates in a minute.' };
        j.ok = true; // already sent elsewhere: record it, never send again
      }
      if (j.ok) {
        if (kind === 'first') {
          c.subject = comp.subject; c.tpl = firstTplFor(c).id; c.messageId = j.messageId || '';
          c.status = 'sent'; c.sentAt = Date.now(); c.sentFrom = j.from || from;
        } else if (kind === 'followup') {
          c.status = 'followed'; c.followAt = Date.now(); c.followCount = (c.followCount||0) + 1; c.followFrom = j.from || from;
        } else if (kind === 'next') c.nextAt = Date.now();
        else if (kind === 'counter') c.counterAt = Date.now();
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
  function askToStart(kind, ids, camp){
    if (running()) return;
    if (ui.gmail === 'missing') { toast('Gmail is not set up yet. Add the Gmail settings in Vercel first.'); return; }
    if (!ui.accounts.length) { toast('Still checking your Gmail accounts. Try again in a second.'); return; }
    var list = ids.map(byId).filter(function(c){ return c && can(kind, c); });
    if (!list.length) { toast(kind==='first' ? 'None of those can get a first email yet.' : (kind==='followup' ? 'None of those can get a follow-up.' : 'None of those can get this email.')); return; }
    var left = leftToday(kind);
    var n = list.length, gap = Number(S.settings.gap)||45;
    var mins = Math.max(1, Math.round(((n-1) * gap) / 60));
    var title = 'Send ' + n + ' ' + RUN_NOUN[kind] + (n>1?'s':'') + '?';
    var body = [];
    var fromText;
    if (kind !== 'first') fromText = ui.accounts.length > 1 ? 'Each one goes out from the account that sent the first email, as a reply in that thread.' : 'They go out from ' + esc(ui.from) + ' as replies in each original thread.';
    else if (senderMode() === 'rotate') fromText = 'They alternate between ' + ui.accounts.map(function(a){ return esc(a.email); }).join(' and ') + '.';
    else fromText = 'They go out from ' + esc(senderMode()) + '.';
    body.push('<p>' + (n>1 ? 'One about every ' + gap + ' seconds, so roughly ' + mins + ' minute' + (mins>1?'s':'') + '. ' : '') + fromText + '</p>');
    if (n > left) body.push('<p>You have ' + left + ' send' + (left===1?'':'s') + ' left today under your limit of ' + capPer() + (ui.accounts.length > 1 ? ' per account' : '') + ', so ' + (left ? 'it will stop after ' + left + '.' : 'nothing will send until tomorrow.') + '</p>');
    body.push('<ul>' + list.slice(0,5).map(function(c){ return '<li>' + esc(c.name || c.handle || c.email) + ' <span class="mono">' + esc(c.email) + '</span></li>'; }).join('') + (n>5 ? '<li>and ' + (n-5) + ' more</li>' : '') + '</ul>');
    if (n===1 && kind!=='first' && kind!=='followup') body.push('<div class="mail"><div class="mail-body">' + esc(compose(list[0], kind).body.text) + '</div></div>');
    if (kind === 'followup') body.push('<p>Your inbox is checked first, so anyone who already replied is skipped.</p>');
    if (n>1) body.push('<p>Keep this tab open until it finishes.</p>');
    openModal(title, body.join(''), 'Start sending', function(){ runBatch(kind, list.map(function(c){ return c.id; }), camp); });
  }
  var RUN_NOUN = { first:'first email', followup:'follow-up', next:'next-step email', counter:'counter-question' };
  function runBatch(kind, ids, camp){
    var run = ui.run = { kind:kind, ids:ids, index:0, ok:0, failed:0, skipped:0, stopped:false, finished:false, nextAt:null, currentId:null, msg:'', err:'', skipNote:'', campId:camp ? camp.id : null };
    if (camp) { camp.state = 'running'; camp.startedAt = camp.startedAt || Date.now(); }
    renderRun(); renderSendbar(); renderPreview();
    function step(){
      if (run.stopped || run.index >= run.ids.length) return finish();
      var c = byId(run.ids[run.index]);
      if (!c || !can(kind, c)) { run.index++; return step(); }
      if (campStop()) return finish();
      var pick = pickSender(kind, c);
      if (!pick.id || pick.reason) {
        if (kind === 'first' || pick.reason === 'none') {
          run.err = pick.reason === 'none' ? 'Gmail is not set up.' : (senderMode() === 'rotate' && ui.accounts.length > 1 ? 'Every account reached its daily limit of ' + capPer() + '.' : 'Daily limit of ' + capPer() + ' reached on ' + (pick.id || ui.from) + '.') + ' Raise it in Sending if you want to keep going today.';
          return finish();
        }
        run.skipped++;
        run.skipNote = pick.reason === 'missing' ? pick.id + ' is no longer set up' : pick.id + ' hit its daily limit';
        run.index++; return step();
      }
      run.currentId = c.id; run.from = pick.id; renderRun();
      sendOne(c, kind, pick.id).then(function(res){
        if (res.stop) { run.err = res.msg; save(); renderAll(); return finish(); }
        if (res.ok) run.ok++; else run.failed++;
        run.index++; run.currentId = null;
        save(); renderAll();
        if (run.index < run.ids.length && !run.stopped && !campStop()) wait(gapMs(), run).then(step); else finish();
      });
    }
    // A campaign stops for the day when its own cap is hit or its window closes; the rest goes out in the next window.
    function campStop(){
      if (!camp) return false;
      if (campStats(camp).ready && camp.cap && campStats(camp).today >= camp.cap) { run.note = 'Daily limit of ' + camp.cap + ' for ' + camp.name + ' reached. It continues tomorrow.'; return true; }
      if (campStats(camp).ready && !campWindowLeft(camp)) { run.note = 'The ' + camp.name + ' window ended. It continues in the next one.'; return true; }
      return false;
    }
    function finish(){
      run.finished = true; run.currentId = null; run.nextAt = null;
      var noun = kind==='first' ? 'email' : RUN_NOUN[kind];
      run.msg = (camp ? camp.name + ': ' : '') + (run.stopped ? 'Stopped. ' : (run.err ? '' : 'Done. ')) + run.ok + ' ' + noun + (run.ok===1?'':'s') + ' sent' + (run.failed ? ', ' + run.failed + ' failed (see the list)' : '') + (run.skipped ? ', ' + run.skipped + ' skipped because ' + run.skipNote : '') + '.' + (run.note ? ' ' + run.note : '');
      if (camp) {
        if (run.err) camp.errAt = Date.now();
        if (run.stopped) camp.state = 'paused';
        else if (!campStats(camp).ready) { camp.state = 'done'; camp.doneAt = Date.now(); }
        else camp.state = 'scheduled';
        save();
      }
      renderRun(); renderSendbar(); renderAll();
    }
    // Never follow up on someone who already answered: read the inbox before a follow-up batch.
    if (kind === 'followup') checkReplies(true).then(step, step); else step();
  }
  function gapMs(){
    var g = Number(S.settings.gap); if (GAP_OPTIONS.indexOf(g) < 0) g = DEFAULT_SETTINGS.gap;
    return Math.round(g * 1000 * (0.75 + Math.random()*0.5)); // never more than 150 seconds
  }
  // performance.now() keeps counting evenly even if the computer's clock changes mid-batch.
  function clock(){ return (window.performance && typeof performance.now === 'function') ? performance.now() : Date.now(); }
  function fmtWait(ms){ var s = Math.max(0, Math.ceil(ms/1000)); return s >= 90 ? Math.floor(s/60) + 'm ' + (s%60) + 's' : s + 's'; }
  function wait(ms, run){
    return new Promise(function(res){
      var end = clock() + Math.min(ms, 150000); run.nextAt = end; run.skipWait = false;
      var t = setInterval(function(){
        if (run.stopped || run.skipWait || clock() >= end) { clearInterval(t); run.nextAt = null; run.skipWait = false; res(); }
        renderRun();
      }, 500);
    });
  }

  // While this tab is open, a campaign whose window has arrived starts on its own. The cron job does the same with the tab closed.
  function serverActive(){ return cloud && S.settings.auto.on && S.cronAt && Date.now() - S.cronAt < 25*60000; }
  function tickCampaigns(){
    if (!ui.loaded || running() || !ui.accounts.length || !$('#modal').hidden) return;
    if (serverActive()) return; // the scheduler is running, so the tab doesn't race it
    if (!S.settings.auto.on) return;
    var due = S.campaigns.filter(function(k){ return campDue(k) && !(k.errAt && Date.now() - k.errAt < 30*60000); })
      .sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : toMins(a.start) - toMins(b.start); })[0];
    if (!due) return;
    var ids = campContacts(due).filter(canFirst).map(function(c){ return c.id; });
    if (!ids.length) return;
    toast('Starting ' + due.name + '.');
    runBatch('first', ids, due);
  }

  /* ---------- modal ---------- */
  var modalOk = null, modalReturn = null;
  function openModal(title, html, okLabel, onOk){
    modalReturn = document.activeElement;
    $('#mTitle').textContent = title; $('#mBody').innerHTML = html; $('#mOk').textContent = okLabel;
    $('#modal .modal-card').classList.toggle('wide', html.indexOf('camp-form') >= 0);
    modalOk = onOk; $('#modal').hidden = false; $('#mOk').focus();
  }
  function closeModal(){ $('#modal').hidden = true; modalOk = null; if (modalReturn && modalReturn.focus) modalReturn.focus(); }

  /* ---------- render ---------- */
  var ICONS = {
    cloud:'<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    laptop:'<rect width="18" height="12" x="3" y="4" rx="2"/><path d="M2 20h20"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
  };
  function svgIcon(name){ return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>'; }
  // Status icons: the colour of the dot shows the state, the full text shows on hover or tap.
  function setStatus(el, tone, text, extra){
    el.setAttribute('data-tone', tone || '');
    el.setAttribute('aria-label', text);
    el.setAttribute('data-tip', extra ? text + '. ' + extra : text);
  }
  function renderGmailPill(){
    var p = $('#gmailPill'), map = {
      checking:['', 'Checking Gmail…'],
      ok:['ok', ui.accounts.length > 1 ? ui.accounts.length + ' Gmail accounts' : 'Sending as ' + ui.from],
      missing:['bad', 'Gmail not set up'],
      offline:['warn', 'Can\'t reach the server']
    }[ui.gmail] || ['', ui.gmail];
    setStatus(p, map[0], map[1], ui.gmail==='missing' ? 'Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel, then redeploy' : (ui.accounts.length > 1 ? ui.accounts.map(function(a){ return a.email; }).join(', ') : ''));
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
    var icon = (ui.save === 'local') ? 'laptop' : 'cloud';
    if (p.getAttribute('data-icon') !== icon) { p.querySelector('svg').outerHTML = svgIcon(icon); p.setAttribute('data-icon', icon); }
    setStatus(p, map[0], map[1]);
  }
  function renderCapPill(){
    var k = Math.max(1, ui.accounts.length), cap = capPer() * k, n = sentToday(), left = Math.max(0, cap - n);
    $('#capValue').textContent = n + '/' + cap;
    if (ui.accounts.length > 1) $('#capStatus').textContent = ui.accounts.map(function(a){ return shortName(a.id) + ' ' + sentToday(a.id) + '/' + capPer(); }).join('  ·  ');
    else $('#capStatus').textContent = left ? left + ' left today' : 'Daily limit reached';
    $('#capFill').style.width = Math.min(100, (n / cap) * 100) + '%';
    $('#capHero').setAttribute('aria-label', 'Sent today: ' + n + ' of ' + cap);
  }
  function renderInsight(k){
    var reached = k.sent + k.replied;
    var rate = reached ? k.replied / reached : 0;
    $('#insValue').textContent = Math.round(rate*100) + '%';
    $('#insHeadline').textContent = reached
      ? k.replied + ' of ' + reached + ' replied' + (k.due ? ', ' + k.due + ' follow-up' + (k.due===1?'':'s') + ' due' : '')
      : 'No emails sent yet';
    var lit = rate > 0 ? Math.min(8, Math.max(1, Math.round(rate*8))) : 0, h = '';
    for (var t=0; t<8; t++) h += '<span data-tick="' + (t < lit ? 'on' : 'off') + '"></span>';
    $('#insTicks').innerHTML = h;
    $('#insight').setAttribute('aria-label', 'Reply rate ' + Math.round(rate*100) + ' percent');
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
    var allReady = S.contacts.filter(function(c){ return canFirst(c) && !campOf(c); }).length;
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
    if (c) text = 'Sending ' + (run.index+1) + ' of ' + total + ' to ' + (c.name || c.handle || c.email) + (ui.accounts.length > 1 && run.from ? ' from ' + shortName(run.from) : '') + '…';
    else if (run.nextAt) text = run.ok + ' of ' + total + ' sent. Next in ' + fmtWait(run.nextAt - clock());
    else text = 'Starting…';
    el.className = 'runline show';
    el.innerHTML = '<div class="progress" aria-hidden="true"><span style="width:' + pct + '%"></span></div><span class="msg">' + esc(text) + '</span>' + (run.nextAt ? '<button class="btn sm" type="button" data-run="next">Send next now</button>' : '') + '<button class="btn sm" type="button" data-run="stop">Stop</button>';
  }
  function renderFilters(k){
    var defs = [['all','All'],['ready','Ready'],['sent','Sent'],['due','Follow-up due'],['replied','Replied'],['issues','Needs attention']];
    $('#viewReplies').textContent = 'Replies' + (k.replied ? ' ' + k.replied : '');
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
  function renderImportCamp(){
    var sel = $('#importCamp'), cur = sel.value;
    var open = S.campaigns.filter(function(k){ return k.state !== 'done'; }).sort(function(a, b){ return a.date < b.date ? -1 : 1; });
    sel.innerHTML = '<option value="">No campaign, send by hand</option>' + open.map(function(k){ return '<option value="' + esc(k.id) + '">' + esc(k.name) + ' (' + esc(fmtDay(k.date)) + ')</option>'; }).join('');
    sel.value = open.some(function(k){ return k.id === cur; }) ? cur : '';
    sel.closest('.field').hidden = !open.length;
  }
  function renderTable(){
    renderImportCamp();
    var rows = S.contacts.filter(function(c){ return matchFilter(c, ui.filter); });
    var tb = $('#tbody');
    if (!rows.length) {
      tb.innerHTML = '<tr><td colspan="4" class="empty">' + (S.contacts.length ? 'No creators match this filter.' : 'No creators yet. Open Add creators and paste your list.') + '</td></tr>';
    } else {
      tb.innerHTML = rows.map(function(c){
        var title = c.name || c.handle || c.email || 'Unnamed';
        var k = campOf(c);
        var sub = [c.name && c.handle ? c.handle : '', c.email, c.niche, k ? k.name : '', (ui.accounts.length > 1 && c.sentAt && (c.status==='sent' || c.status==='followed' || c.status==='replied')) ? 'via ' + shortName(acctOf(c)) : ''].filter(Boolean).join(' · ');
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
  function previewFrom(c, kind){
    if (!ui.accounts.length) return 'your Gmail';
    if (kind === 'followup' || c.sentAt) return acctOf(c) || ui.from;
    var m = senderMode();
    return m === 'rotate' ? ui.accounts.map(function(a){ return a.email; }).join(' or ') + ' (rotates)' : m;
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
    $('#pvHead').innerHTML = '<dt>From</dt><dd>' + esc(previewFrom(c, kind)) + '</dd><dt>To</dt><dd>' + esc(c.email || 'no email') + '</dd><dt>Subject</dt><dd>' + subjHTML + '</dd>' + (kind==='followup' ? '<dt>Thread</dt><dd>' + (c.messageId ? 'Replies to the first email' : 'No first email yet') + '</dd>' : '');
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
    if (c.dnc) w.push(['bad', 'This creator asked not to be contacted. Nothing more will be sent to them.']);
    else if (c.bounced) w.push(['bad', 'This address bounced. Nothing more will be sent to it.']);
    else if (c.status==='replied') w.push(['ok', 'This creator replied. See the Replies tab for the next step.']);
    if (kind==='followup' && (c.followCount||0) >= 2) w.push(['', 'Both follow-ups are sent. Nothing more goes out unless they reply.']);
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
    renderStats(k); renderInsight(k); renderFilters(k); renderBulk(); renderTable(); renderSendbar(); renderPreview(); renderCapPill(); renderSavePill(); renderVars(); renderReplies(); renderCalendar(); if (ui.loaded) renderAuto();
  }
  /* calendar view */
  function renderCalendar(){
    if (!$('#calendarView') || !ui.loaded) return;
    var today = todayIso();
    if (!ui.week) ui.week = mondayOf(today);
    var days = []; for (var i=0;i<7;i++) days.push(addDays(ui.week, i));
    var end = days[6];
    $('#calTitle').textContent = fmtDay(days[0]) + ' to ' + fmtDay(end) + (ui.week === mondayOf(today) ? ' (this week)' : '');
    var busy = running();
    var totals = { camps:0, creators:0, sent:0 };
    $('#calGrid').innerHTML = days.map(function(d, i){
      var camps = S.campaigns.filter(function(k){ return k.date === d; }).sort(function(a, b){ return toMins(a.start) - toMins(b.start); });
      var cards = camps.map(function(k){
        var st = campStats(k); totals.camps++; totals.creators += st.total; totals.sent += st.sent;
        var state = k.state;
        var live = ui.run && ui.run.campId === k.id && !ui.run.finished;
        if (live) state = 'running';
        var note;
        if (state === 'done') note = st.sent + ' sent' + (st.replied ? ', ' + st.replied + ' replied' : '');
        else if (live) note = 'Sending now, ' + st.sent + ' of ' + st.total;
        else if (state === 'paused') note = st.sent + ' of ' + st.total + ' sent, paused';
        else if (st.ready === 0 && st.total > 0 && st.blocked) note = st.blocked + ' blocked, fix missing tags';
        else if (d < today && st.ready) note = 'Overdue, ' + st.ready + ' left. Sends in the next window.';
        else if (st.sent) note = st.sent + ' of ' + st.total + ' sent, ' + st.ready + ' to go';
        else note = st.total + ' creator' + (st.total===1?'':'s') + (st.blocked ? ', ' + st.blocked + ' blocked' : '');
        var movable = state !== 'done' && !live;
        var t = tplById(k.tpl);
        return '<article class="camp" data-camp="' + esc(k.id) + '" data-state="' + state + '"' + (movable ? ' draggable="true"' : '') + ' tabindex="0" role="button" aria-label="' + esc(k.name) + ', ' + esc(CAMP_STATES[state]) + '">' +
          '<div class="camp-top"><b>' + esc(k.name) + '</b><span class="st ' + (state==='done' ? 'replied' : state==='running' ? 'due' : state==='paused' ? 'warn' : 'ready') + '">' + CAMP_STATES[state] + '</span></div>' +
          '<span class="camp-meta">' + esc(fmtTime(k.start) + ' to ' + fmtTime(k.end)) + ' · ' + esc(t ? t.name : 'No template') + (k.sender !== 'rotate' ? ' · ' + esc(shortName(k.sender)) : '') + (k.cap ? ' · ' + k.cap + '/day' : '') + '</span>' +
          '<span class="camp-note">' + esc(note) + '</span>' +
          (st.total ? '<span class="camp-bar" aria-hidden="true"><span style="width:' + Math.round(st.sent / st.total * 100) + '%"></span></span>' : '') +
        '</article>';
      }).join('');
      return '<div class="cal-day' + (d === today ? ' today' : '') + (d < today ? ' past' : '') + '" data-day="' + d + '">' +
        '<div class="cal-head"><span>' + DAY_NAMES[i] + '</span><b>' + esc(fmtDay(d)) + '</b></div>' +
        cards + '<button class="cal-add" type="button" data-new="' + d + '" aria-label="New campaign on ' + esc(fmtDay(d)) + '">+</button></div>';
    }).join('');
    $('#calSummary').textContent = totals.camps ? totals.camps + ' campaign' + (totals.camps===1?'':'s') + ' this week, ' + totals.sent + ' of ' + totals.creators + ' emails sent.' : 'Nothing scheduled this week. Click + on a day to add a campaign.';
    var n = nowIn();
    $('#calClock').textContent = 'Sending clock: ' + tz() + ', now ' + fmtTime(String(Math.floor(n.mins/60)) + ':' + String(n.mins%60).padStart(2,'0')) + '. ' +
      (serverActive() ? 'The scheduler sends campaigns on time, even with this tab closed.' : (S.settings.auto.on ? 'Campaigns start on their own while this tab is open. Set up the scheduler in Sending to run them with the tab closed.' : 'Automation is off in Sending, so campaigns only go out when you press Send now.'));
    if (!busy) tickCampaigns();
  }
  function tplOptions(sel){ return S.templates.filter(function(t){ return t.kind==='first'; }).map(function(t){ return '<option value="' + esc(t.id) + '"' + (t.id===sel ? ' selected' : '') + '>' + esc(t.name || 'Untitled') + '</option>'; }).join(''); }
  function senderOptions(sel){
    var o = '<option value="rotate">' + (ui.accounts.length > 1 ? 'Rotate between accounts' : 'Default account') + '</option>';
    ui.accounts.forEach(function(a){ o += '<option value="' + esc(a.id) + '"' + (a.id===sel ? ' selected' : '') + '>' + esc(a.email) + '</option>'; });
    return o;
  }
  function campForm(k){
    k = k || {};
    return '<div class="camp-form">' +
      '<div class="field"><label for="cfName">Campaign name</label><input type="text" id="cfName" autocomplete="off" value="' + esc(k.name || '') + '" placeholder="e.g. Food creators, week 1"></div>' +
      '<div class="set-grid">' +
        '<div class="field"><label for="cfDate">Send date</label><input type="date" id="cfDate" value="' + esc(k.date || todayIso()) + '"></div>' +
        '<div class="field"><label for="cfTpl">Template</label><select id="cfTpl">' + tplOptions(k.tpl || S.settings.firstTpl) + '</select></div>' +
        '<div class="field"><label for="cfStart">Send each day from</label><input type="time" id="cfStart" value="' + esc(k.start || '10:00') + '"></div>' +
        '<div class="field"><label for="cfEnd">Until</label><input type="time" id="cfEnd" value="' + esc(k.end || '13:00') + '"></div>' +
        '<div class="field"><label for="cfSender">Send from</label><select id="cfSender">' + senderOptions(k.sender) + '</select></div>' +
        '<div class="field"><label for="cfCap">Per day for this campaign</label><input type="number" id="cfCap" min="1" max="500" value="' + (k.cap || '') + '" placeholder="Account limit (' + capPer() + ')"></div>' +
      '</div>' +
      (k.id ? '' : '<div class="field"><label for="cfCsv">Creators</label><input type="file" id="cfCsv" accept=".csv,.tsv,.txt,text/csv"><textarea id="cfPaste" class="code" rows="3" placeholder="or paste rows here"></textarea></div>') +
      '<p class="help">Emails only go out between these times, starting on the send date. If not everyone gets emailed that day, the rest go out at the same times the next day. The campaign finishes on its own once everyone has been emailed. Times are in ' + esc(tz()) + '. Creators already emailed, or in another campaign, are skipped.</p>' +
      '</div>';
  }
  function readCampForm(k){
    k.name = $('#cfName').value.trim() || k.name || 'Campaign';
    k.date = $('#cfDate').value || k.date || todayIso();
    k.start = $('#cfStart').value || '10:00'; k.end = $('#cfEnd').value || '13:00';
    k.tpl = $('#cfTpl').value; k.sender = $('#cfSender').value || 'rotate';
    k.cap = Math.round(Number($('#cfCap').value)) || 0;
    k.editedAt = Date.now();
    return cleanCampaign(k);
  }
  function openNewCampaign(date){
    openModal('New campaign', campForm({ date:date }), 'Create campaign', function(){
      var k = readCampForm({ id:'k' + Date.now().toString(36), createdAt:Date.now(), state:'scheduled' });
      var file = $('#cfCsv') && $('#cfCsv').files && $('#cfCsv').files[0];
      var pasted = $('#cfPaste') ? $('#cfPaste').value : '';
      var finishCreate = function(text, source){
        S.campaigns.push(k);
        var r = text && text.trim() ? importText(text, source, k.id) : { msg:'No creators yet. Add them from the Creators panel with this campaign selected, or edit the campaign.' };
        save(); ui.week = mondayOf(k.date); renderAll();
        toast(k.name + ' created. ' + r.msg + (r.dupes && r.dupes.length ? ' Skipped: ' + r.dupes.slice(0,4).join(', ') + (r.dupes.length > 4 ? ' and ' + (r.dupes.length-4) + ' more' : '') + '.' : ''));
      };
      if (file) { var rd = new FileReader(); rd.onload = function(){ finishCreate(String(rd.result||''), file.name); }; rd.onerror = function(){ finishCreate('', ''); }; rd.readAsText(file); }
      else finishCreate(pasted, '');
    });
  }
  function openEditCampaign(k){
    var st = campStats(k), live = ui.run && ui.run.campId === k.id && !ui.run.finished;
    var html = campForm(k) +
      '<p class="help">' + st.total + ' creators: ' + st.sent + ' sent, ' + st.ready + ' ready, ' + st.blocked + ' blocked.</p>' +
      '<div class="row">' +
        (live ? '' : (k.state === 'paused' ? '<button class="btn sm" type="button" data-cf="resume">Resume</button>' : (k.state !== 'done' ? '<button class="btn sm" type="button" data-cf="pause">Pause</button>' : ''))) +
        (!live && st.ready && ui.accounts.length ? '<button class="btn sm" type="button" data-cf="now">Send now</button>' : '') +
        '<button class="btn sm" type="button" data-cf="show">Show creators</button>' +
        '<button class="btn sm danger" type="button" data-cf="delete">Delete campaign</button>' +
      '</div>';
    openModal('Edit campaign', html, 'Save', function(){ readCampForm(k); save(); renderAll(); });
    $('#mBody').addEventListener('click', function(e){
      var b = e.target.closest('[data-cf]'); if (!b) return;
      var act = b.getAttribute('data-cf');
      if (act === 'pause') { k.state = 'paused'; k.editedAt = Date.now(); closeModal(); save(); renderAll(); return; }
      if (act === 'resume') { k.state = 'scheduled'; k.editedAt = Date.now(); delete k.errAt; closeModal(); save(); renderAll(); return; }
      if (act === 'now') { closeModal(); var ids = campContacts(k).filter(canFirst).map(function(c){ return c.id; }); askToStart('first', ids, k); return; }
      if (act === 'show') { closeModal(); ui.filter = 'all'; ui.sel = {}; campContacts(k).forEach(function(c){ ui.sel[c.id] = true; }); ui.previewId = (campContacts(k)[0] || {}).id || null; setView('send'); renderAll(); $('#creatorsPanel').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }); return; }
      if (act === 'delete') {
        closeModal();
        openModal('Delete ' + k.name + '?', '<p>Emails already sent keep their history. Creators not yet emailed are removed from your list too.</p>', 'Delete', function(){
          S.contacts = S.contacts.filter(function(c){ return !(c.campaignId === k.id && !c.sentAt); });
          S.contacts.forEach(function(c){ if (c.campaignId === k.id) delete c.campaignId; });
          S.campaigns = S.campaigns.filter(function(x){ return x !== k; });
          save(); renderAll();
        });
      }
    });
  }

  /* replies view */
  function setView(v){
    ui.view = v === 'replies' ? 'replies' : v === 'calendar' ? 'calendar' : 'send';
    $('#sendView').hidden = ui.view !== 'send'; $('#repliesView').hidden = ui.view !== 'replies'; $('#calendarView').hidden = ui.view !== 'calendar';
    $('#viewSend').setAttribute('aria-pressed', ui.view==='send'); $('#viewReplies').setAttribute('aria-pressed', ui.view==='replies'); $('#viewCalendar').setAttribute('aria-pressed', ui.view==='calendar');
    try { localStorage.setItem('creator-mailer-view', ui.view); } catch(e) {}
    renderReplies(); renderCalendar();
    if (ui.view === 'replies' && ui.loaded && !running() && sentList().length && Date.now() - (S.checkedAt||0) > 30*60000) checkReplies(false);
  }
  function untilText(ts){
    var ms = ts - Date.now(); if (ms <= 0) return 'now';
    var h = Math.ceil(ms/HOUR); return h < 36 ? 'in ' + h + 'h' : 'in ' + Math.ceil(ms/DAY) + ' days';
  }
  function followLine(c){
    var n = c.followCount||0;
    if (n >= 2) return { text:'Both follow-ups sent. Nothing more goes out unless they reply.' };
    var label = 'follow-up ' + (n+1);
    if (isDue(c)) return canFollow(c) ? { text:'No reply yet. ' + (n ? 'Last follow-up' : 'Follow-up 1') + ' is due.', btn:['follow','Send ' + label] } : { text:'Follow-up is due, but its template is missing a value.' };
    return { text:'No reply yet. ' + label.charAt(0).toUpperCase() + label.slice(1) + ' due ' + untilText(n ? follow2At(c) : c.sentAt + S.settings.dueHours*HOUR) + '.' };
  }
  function nextLine(c, tag){
    switch (tag) {
      case 'interested':
        if (c.nextAt) return { text:'Next-step email sent ' + timeAgo(c.nextAt) + '. They are on your interested list.' };
        return canNext(c) ? { text:'On your interested list. Send them the next step.', btn:['next','Send next step'] } : { text:'On your interested list. The Interested template is missing a value, so fill in Your details first.' };
      case 'not_interested':
        if (c.counterAt) return { text:'Counter-question sent ' + timeAgo(c.counterAt) + '. Nothing more will be sent.' };
        if (!(c.reply && c.reply.soft)) return { text:'Firm no. Nothing more will be sent.' };
        return canCounter(c) ? { text:'Soft no. You can ask one polite question, once.', btn:['counter','Send counter-question'] } : { text:'Soft no.' };
      case 'question': case 'replied':
        return { text: c.answerAt ? 'You answered ' + timeAgo(c.answerAt) + '. Check again later for their reply.' : 'They need an answer from you.', box:true };
      case 'bounced': return { text:'The address is bad, so the email never arrived. Try a DM or find another email.' };
      case 'do_not_contact': return { text:'Locked. Nothing more will ever be sent to this creator.' };
      case 'auto_reply': { var f = followLine(c); f.text = 'Auto-reply, so it does not count as a reply. ' + f.text.replace(/^No reply yet\. /, ''); return f; }
      default: return followLine(c);
    }
  }
  var TAG_ORDER = ['question','replied','interested','not_interested','auto_reply','no_reply','bounced','do_not_contact'];
  var TAG_CHOICES = [['interested','Interested'],['question','Needs your reply'],['not_interested:soft','Not interested (soft no)'],['not_interested:hard','Not interested (firm no)'],['no_reply','No reply'],['auto_reply','Auto-reply'],['bounced','Bounced'],['do_not_contact','Do not contact']];
  function renderReplies(){
    if (!$('#repliesView')) return;
    var list = sentList(), n = { all:list.length };
    TAG_ORDER.forEach(function(t){ n[t] = 0; });
    list.forEach(function(c){ n[tagOf(c)]++; });
    var replied = list.filter(function(c){ return c.status==='replied'; }).length;
    var delivered = list.length - n.bounced;
    var pct = function(a){ return delivered > 0 ? Math.round((a/delivered)*100) + '%' : '0%'; };
    $('#rStats').innerHTML = [['Sent', list.length], ['Replied', replied], ['Interested', n.interested], ['Not interested', n.not_interested], ['Needs reply', n.question + n.replied], ['No reply', n.no_reply + n.auto_reply], ['Bounced', n.bounced], ['Reply rate', pct(replied)], ['Interest rate', pct(n.interested)]]
      .map(function(x){ return '<div class="stat"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('');

    $('#btnCheck').disabled = ui.checking || !ui.accounts.length;
    $('#btnCheck').textContent = ui.checking ? 'Checking…' : 'Check for replies';
    $('#rcStatus').textContent = [ui.checkMsg, S.checkedAt ? 'Last checked ' + timeAgo(S.checkedAt) + '.' : 'Not checked yet.', ui.ai ? 'AI tagging is on.' : 'Tagging by keywords. Add GROQ_API_KEY in Vercel to turn on AI tagging.'].filter(Boolean).join(' ');
    $('#rcErr').textContent = ui.checkErr; $('#rcErr').hidden = !ui.checkErr;

    if (ui.rfilter !== 'all' && !n[ui.rfilter]) ui.rfilter = 'all';
    $('#rFilters').innerHTML = [['all','All']].concat(TAG_ORDER.filter(function(t){ return n[t]; }).map(function(t){ return [t, TAG_LABEL[t]]; })).map(function(d){
      return '<button class="chip" type="button" data-rf="' + d[0] + '" aria-pressed="' + (ui.rfilter===d[0]) + '">' + esc(d[1]) + ' ' + n[d[0]] + '</button>';
    }).join('');

    var busy = running();
    var nNext = list.filter(canNext).length, nCounter = list.filter(canCounter).length, nDue = list.filter(function(c){ return isDue(c) && canFollow(c); }).length;
    $('#rBulk').innerHTML =
      '<button class="btn sm" type="button" data-rb="next"' + (nNext && !busy ? '' : ' disabled') + '>Send next step to interested (' + nNext + ')</button>' +
      '<button class="btn sm" type="button" data-rb="follow"' + (nDue && !busy ? '' : ' disabled') + '>Send follow-ups due (' + nDue + ')</button>' +
      '<button class="btn sm" type="button" data-rb="counter"' + (nCounter && !busy ? '' : ' disabled') + '>Send counter-questions (' + nCounter + ')</button>' +
      '<button class="btn sm" type="button" data-rb="csv"' + (n.interested ? '' : ' disabled') + '>Download interested list (' + n.interested + ')</button>';

    // Don't rebuild the cards under someone who is typing an answer.
    var act = document.activeElement;
    if (act && act.tagName === 'TEXTAREA' && act.closest('#rCards')) return;
    var shown = list.filter(function(c){ return ui.rfilter==='all' || tagOf(c)===ui.rfilter; }).sort(function(a, b){
      var d = TAG_ORDER.indexOf(tagOf(a)) - TAG_ORDER.indexOf(tagOf(b));
      return d || ((b.reply && b.reply.at) || b.sentAt) - ((a.reply && a.reply.at) || a.sentAt);
    });
    if (!shown.length) { $('#rCards').innerHTML = '<div class="empty">' + (list.length ? 'No creators with this tag.' : 'No emails sent yet. Replies show up here after your first batch.') + '</div>'; return; }
    $('#rCards').innerHTML = shown.map(function(c){
      var tag = tagOf(c), r = c.reply || {}, line = nextLine(c, tag);
      var cur = tag === 'not_interested' ? 'not_interested:' + (r.soft ? 'soft' : 'hard') : (tag === 'replied' ? 'question' : tag);
      var sub = [c.name && c.handle ? c.handle : '', c.email, ui.accounts.length > 1 ? 'via ' + shortName(acctOf(c)) : ''].filter(Boolean).join(' · ');
      var meta = r.at && tag !== 'no_reply' ? (tag==='bounced' ? 'Bounced ' : 'Replied ') + timeAgo(r.at) + (r.from && r.from !== String(c.email).toLowerCase() && tag!=='bounced' ? ' from ' + r.from : '') + '. Tagged by ' + (r.by==='ai' ? 'AI' : (r.by==='rules' ? 'keywords' : 'you')) + '.' : 'First email sent ' + timeAgo(c.sentAt) + (c.followAt ? ', last follow-up ' + timeAgo(c.followAt) : '') + '.';
      return '<article class="rcard" data-id="' + esc(c.id) + '">' +
        '<div class="rc-top"><div class="rc-who"><b>' + esc(c.name || c.handle || c.email) + '</b><span class="sub">' + esc(sub) + '</span></div><span class="st ' + (TAG_TONE[tag]==='ok' ? 'replied' : (TAG_TONE[tag] || 'sent')) + '">' + esc(tag==='not_interested' ? (r.soft ? 'Soft no' : 'Not interested') : TAG_LABEL[tag]) + '</span></div>' +
        (r.snippet && tag !== 'no_reply' ? '<blockquote class="rc-snip">' + esc(r.snippet) + '</blockquote>' : '') +
        '<p class="help">' + esc(meta) + '</p>' +
        '<div class="rc-next"><span>' + esc(line.text) + '</span>' + (line.btn ? '<button class="btn sm primary" type="button" data-ra="' + line.btn[0] + '"' + (busy ? ' disabled' : '') + '>' + esc(line.btn[1]) + '</button>' : '') + '</div>' +
        (line.box ? '<div class="rc-answer"><textarea rows="3" data-draft aria-label="Your reply to ' + esc(c.name || c.email) + '" placeholder="Write your reply. It goes out in the same thread.">' + esc(ui.drafts[c.id] || '') + '</textarea><div class="row"><button class="btn sm primary" type="button" data-ra="answer">Send reply</button><span class="help" data-amsg></span></div></div>' : '') +
        '<div class="rc-foot"><label>Tag <select data-rtag aria-label="Change tag">' + TAG_CHOICES.map(function(o){ return '<option value="' + o[0] + '"' + (o[0]===cur ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<a class="linkbtn" target="_blank" rel="noopener" href="https://mail.google.com/mail/u/0/#search/' + encodeURIComponent(c.email) + '">Open in Gmail</a></div>' +
      '</article>';
    }).join('');
  }
  function interestedCsv(){
    var q = function(v){ v = String(v==null?'':v); if (/^[=+\-@\t\r]/.test(v) && v.charAt(0) !== '@') v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; };
    var rows = sentList().filter(function(c){ return tagOf(c)==='interested'; });
    return [['name','email','handle','niche','replied_at','next_step_sent','their_reply'].join(',')].concat(rows.map(function(c){
      var r = c.reply || {};
      return [c.name, c.email, c.handle, c.niche, r.at ? new Date(r.at).toISOString().slice(0,10) : '', c.nextAt ? 'yes' : 'no', /^[=+\-@]/.test(r.snippet||'') ? "'" + r.snippet : (r.snippet||'')].map(q).join(',');
    })).join('\n');
  }
  function renderBackupHelp(){
    $('#backupHelp').textContent = cloud
      ? 'Your list saves to the cloud and this browser. A backup file is a second copy you control.'
      : 'Your list is saved in this browser only. Download a backup now and then, or connect cloud storage in Vercel so it follows you to other devices.';
  }

  /* editor */
  function renderTabs(){
    $('#tabs').innerHTML = S.templates.map(function(t){
      var tag = t.kind!=='first' ? (KIND_LABEL[t.kind] || 'Follow-up') : (t.id===S.settings.firstTpl ? 'In use' : '');
      if (tag === t.name) tag = 'In thread';
      return '<button class="tab" role="tab" type="button" data-tpl="' + esc(t.id) + '" aria-selected="' + (t.id===ui.editTpl) + '">' + esc(t.name || 'Untitled') + (tag ? ' <span class="k' + (tag==='In use' ? ' on' : '') + '">' + tag + '</span>' : '') + '</button>';
    }).join('');
  }
  function renderEditor(){
    var t = tplById(ui.editTpl) || firstTpl(); ui.editTpl = t.id;
    renderTabs();
    $('#tplName').value = t.name || '';
    $('#tplSubject').value = t.subject || '';
    $('#tplBody').value = t.body || '';
    var isFu = t.kind !== 'first';
    $('#subjectField').hidden = isFu; $('#followNote').hidden = !isFu;
    $('#followNote').textContent = { followup:'Follow-ups go out as a reply in the same email thread, so they keep the first email\'s subject. This one is sent first.',
      followup2:'The second and last follow-up, due ' + FOLLOW2_DAYS + ' days after the first email. Sent in the same thread.',
      next:'Sent from the Replies tab to creators tagged Interested, as a reply to their message.',
      counter:'Sent once from the Replies tab after a soft no (busy, not right now). Never sent after a firm no.' }[t.kind] || '';
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
  function renderSenderSettings(){
    var sel = $('#setSender'), hint = $('#senderHint');
    var opts = '';
    if (ui.accounts.length > 1) opts += '<option value="rotate">Rotate between all ' + ui.accounts.length + ' accounts</option>';
    ui.accounts.forEach(function(a){ opts += '<option value="' + esc(a.id) + '">' + esc(a.email) + (ui.accounts.length > 1 ? ' only' : '') + '</option>'; });
    if (!opts) opts = '<option value="">No Gmail account set up</option>';
    sel.innerHTML = opts;
    sel.value = senderMode();
    sel.disabled = ui.accounts.length < 2;
    $('#capLabel').textContent = ui.accounts.length > 1 ? 'Daily limit per account' : 'Daily limit';
    hint.textContent = ui.accounts.length > 1
      ? 'Rotating sends each first email from whichever account has sent the least today. Follow-ups always reply from the account that sent the first email.'
      : 'Want a second inbox? Add GMAIL_USER_2 and GMAIL_APP_PASSWORD_2 in Vercel, then redeploy. First emails will rotate between both accounts.';
  }
  function renderAuto(){
    var a = S.settings.auto;
    $('#autoOn').checked = a.on; $('#autoFollow').checked = a.follow; $('#autoNext').checked = a.next; $('#autoCounter').checked = a.counter;
    ['#autoFollow','#autoNext','#autoCounter','#autoDays','#workStart','#workEnd'].forEach(function(s){ $(s).disabled = !a.on; });
    $('#autoDays').value = S.settings.autoDays; $('#workStart').value = S.settings.workStart; $('#workEnd').value = S.settings.workEnd;
    var last = S.cronLog && S.cronLog[0], txt;
    if (!cloud) txt = 'Needs cloud storage. Connect Upstash Redis in Vercel Storage, then reload.';
    else if (!S.cronAt) txt = 'The scheduler has not run yet. Press Run now to test it, then set up the 15-minute trigger below.';
    else {
      var bits = [];
      if (last) { if (last.sent) bits.push(last.sent + ' sent'); if (last.replies) bits.push(last.replies + ' new repl' + (last.replies===1?'y':'ies')); if (!bits.length) bits.push('nothing was due'); }
      txt = 'Scheduler last ran ' + timeAgo(S.cronAt) + (last && last.source === 'manual' ? ' (Run now)' : '') + ': ' + bits.join(', ') + '.' + (last && last.note ? ' ' + last.note : '') + (Date.now() - S.cronAt > 30*60000 ? ' That is a while ago, so check the 15-minute trigger.' : '');
    }
    $('#autoStatus').textContent = txt;
    var errs = last && last.errors && last.errors.length ? last.errors : [];
    $('#autoErr').textContent = errs.join(' '); $('#autoErr').hidden = !errs.length;
    $('#btnRunNow').disabled = !cloud || running() || ui.cronBusy;
    $('#btnRunNow').textContent = ui.cronBusy ? 'Running…' : 'Run now';
  }
  function renderSettings(){
    renderAuto();
    $('#setTpl').innerHTML = S.templates.filter(function(t){ return t.kind==='first'; }).map(function(t){ return '<option value="' + esc(t.id) + '"' + (t.id===S.settings.firstTpl ? ' selected' : '') + '>' + esc(t.name || 'Untitled') + '</option>'; }).join('');
    $('#setGap').value = String(S.settings.gap); if (!$('#setGap').value) $('#setGap').value = '45';
    $('#setCap').value = S.settings.cap;
    $('#setDue').value = String(S.settings.dueHours); if (!$('#setDue').value) $('#setDue').value = '20';
    $('#setTz').value = S.settings.tz || ''; $('#setTz').placeholder = tz();
  }

  /* ---------- walkthrough ---------- */
  var TOUR = [
    { title:'Welcome to Creator Mailer', text:'This tool sends personalized emails to creators from your Gmail, one at a time, and tracks who replied. Here\'s a one-minute tour.' },
    { target:'#importBox', title:'Add your creators', text:'Upload a CSV or paste rows from Google Sheets. Each column becomes a tag automatically: <code>name, email, handle, niche, line</code>, plus any extra column you add.', before:function(){ $('#importBox').open = true; } },
    { target:'#youBox', title:'Fill in your details', text:'Your name, brand, product and commission go into every email. Emails stay blocked until the product name is filled in, so a blank tag never goes out.', before:function(){ $('#youBox').open = true; } },
    { target:'#tabs', title:'Pick a template', text:'Choose Fitness affiliate or UGC webinars, then edit the wording below. The one marked In use is what first emails send.' },
    { target:'#vars', title:'Personalize with tags', text:'Click a tag to insert it at your cursor. Each tag swaps in that creator\'s details. Add a fallback like <code>{{first_name|there}}</code> for anyone missing it.' },
    { target:'#previewPanel', title:'Check the preview', text:'Click any creator\'s name to see exactly what they\'ll get. Highlighted words came from their row. Red means something is missing.' },
    { target:'#sendbar', title:'Select and send', text:'Tick creators or click All ready, then press Send first email. It sends one about every 45 seconds. Keep the tab open while it runs.' },
    { target:'#tableWrap', title:'Track and follow up', text:'Statuses update as emails go out. After about 20 hours you\'ll see Follow-up due. The follow-up lands as a reply in the same thread. Two follow-ups at most, then it stops.' },
    { target:'#viewSeg', title:'Read your replies', text:'Open Replies and press Check for replies. It reads your Gmail inbox, tags each creator (interested, not interested, needs your reply) and offers the next step in the same thread.', before:function(){ setView('send'); } },
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
  function resetContact(c){ c.resetAt = Date.now(); c.status='ready'; c.error=''; delete c.sentAt; delete c.followAt; delete c.messageId; delete c.subject; delete c.sentFrom; delete c.followFrom; delete c.followCount; delete c.reply; delete c.bounced; delete c.nextAt; delete c.counterAt; delete c.answerAt; delete c.prevStatus; }

  function bind(){
    $('#btnImport').addEventListener('click', function(){
      var r = importText($('#importText').value, '', $('#importCamp').value || '');
      $('#importMsg').textContent = r.msg;
      renderImportReport(r.report);
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
      if (act==='unreplied') { c.replyClearedAt = Date.now(); c.dnc = false; if (c.sentAt) backToSent(c); else c.status = 'ready'; delete c.reply; }
      if (act==='marksent') { c.status = 'sent'; c.sentAt = c.sentAt || Date.now(); c.error = ''; }
      if (act==='reset') resetContact(c);
      if (act==='remove') { S.contacts = S.contacts.filter(function(x){ return x !== c; }); delete ui.sel[c.id]; toast('Removed ' + (c.name || c.handle || c.email) + '.'); }
      save(); renderAll();
    });
    function csvText(){
      var cols = ['name','email','handle','niche','status','sent_at','followed_up_at','sent_from','reply_tag','replied_at'];
      var q = function(v){ v = String(v==null?'':v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; };
      var iso = function(ts){ return ts ? new Date(ts).toISOString().slice(0,16).replace('T',' ') : ''; };
      var real = S.contacts.filter(function(c){ return !c.example; });
      return { n: real.length, text: [cols.join(',')].concat(real.map(function(c){ return [c.name,c.email,c.handle,c.niche,c.status,iso(c.sentAt),iso(c.followAt),c.sentAt ? acctOf(c) : '', c.sentAt ? tagOf(c) : '', iso(c.reply && c.reply.at)].map(q).join(','); })).join('\n') };
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
      if (q==='ready') { S.contacts.filter(function(c){ return canFirst(c) && !campOf(c); }).forEach(function(c){ ui.sel[c.id]=true; }); ui.filter='ready'; ui.previewKind='first'; }
      if (q==='due') { S.contacts.filter(function(c){ return isDue(c) && canFollow(c); }).forEach(function(c){ ui.sel[c.id]=true; }); ui.filter='due'; ui.previewKind='followup'; }
      renderAll();
    });
    $('#btnFirst').addEventListener('click', function(){ askToStart('first', selIds()); });
    $('#btnFollow').addEventListener('click', function(){ askToStart('followup', selIds()); });
    $('#runline').addEventListener('click', function(e){
      var b = e.target.closest('[data-run]'); if (!b || !ui.run) return;
      if (b.getAttribute('data-run')==='stop') { ui.run.stopped = true; renderRun(); }
      else if (b.getAttribute('data-run')==='next') { ui.run.skipWait = true; }
      else { ui.run = null; renderRun(); renderSendbar(); }
    });

    // calendar
    $('#calPrev').addEventListener('click', function(){ ui.week = addDays(ui.week || mondayOf(todayIso()), -7); renderCalendar(); });
    $('#calNext').addEventListener('click', function(){ ui.week = addDays(ui.week || mondayOf(todayIso()), 7); renderCalendar(); });
    $('#calToday').addEventListener('click', function(){ ui.week = mondayOf(todayIso()); renderCalendar(); });
    $('#btnNewCamp').addEventListener('click', function(){ openNewCampaign(todayIso()); });
    $('#calGrid').addEventListener('click', function(e){
      var nb = e.target.closest('[data-new]'); if (nb) return openNewCampaign(nb.getAttribute('data-new'));
      var card = e.target.closest('[data-camp]'); if (!card) return;
      var k = campById(card.getAttribute('data-camp')); if (k) openEditCampaign(k);
    });
    $('#calGrid').addEventListener('keydown', function(e){ if (e.key !== 'Enter' && e.key !== ' ') return; var card = e.target.closest('[data-camp]'); if (!card) return; e.preventDefault(); var k = campById(card.getAttribute('data-camp')); if (k) openEditCampaign(k); });
    $('#calGrid').addEventListener('dragstart', function(e){ var card = e.target.closest('[data-camp]'); if (!card) return; ui.dragId = card.getAttribute('data-camp'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ui.dragId); } catch(err) {} });
    $('#calGrid').addEventListener('dragover', function(e){ var day = e.target.closest('[data-day]'); if (!day || !ui.dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; day.classList.add('over'); });
    $('#calGrid').addEventListener('dragleave', function(e){ var day = e.target.closest('[data-day]'); if (day) day.classList.remove('over'); });
    $('#calGrid').addEventListener('drop', function(e){
      var day = e.target.closest('[data-day]'); if (!day || !ui.dragId) return;
      e.preventDefault();
      var k = campById(ui.dragId); ui.dragId = null;
      if (!k || k.state === 'done') return;
      k.date = day.getAttribute('data-day'); if (k.state === 'running') k.state = 'scheduled';
      save(); renderAll(); toast(k.name + ' moved to ' + fmtDay(k.date) + '.');
    });
    $('#calGrid').addEventListener('dragend', function(){ ui.dragId = null; });
    function autoChanged(){ save(); renderAuto(); renderCalendar(); }
    $('#autoOn').addEventListener('change', function(e){ S.settings.auto.on = e.target.checked; autoChanged(); });
    $('#autoFollow').addEventListener('change', function(e){ S.settings.auto.follow = e.target.checked; autoChanged(); });
    $('#autoNext').addEventListener('change', function(e){ S.settings.auto.next = e.target.checked; autoChanged(); });
    $('#autoCounter').addEventListener('change', function(e){ S.settings.auto.counter = e.target.checked; autoChanged(); });
    $('#autoDays').addEventListener('change', function(e){ S.settings.autoDays = e.target.value; autoChanged(); });
    ['#workStart','#workEnd'].forEach(function(sel){ $(sel).addEventListener('change', function(){ S.settings.workStart = $('#workStart').value; S.settings.workEnd = $('#workEnd').value; S.settings = cleanSettings(S.settings); autoChanged(); }); });
    $('#btnRunNow').addEventListener('click', function(){
      if (ui.cronBusy || running()) return;
      ui.cronBusy = true; renderAuto();
      // Save first so the scheduler sees the latest list.
      clearTimeout(saveTimer); dirty = true;
      var go = function(){
        api('/api/cron', { method:'POST' }).then(function(j){
          ui.cronBusy = false;
          if (j.code === 'unauthorized') return goLogin();
          if (!j.ok) { toast(j.message || 'The scheduler did not run.'); renderAuto(); return; }
          if (j.skipped) toast(j.skipped);
          else toast('Scheduler ran: ' + ((j.log && j.log.sent) || 0) + ' sent, ' + ((j.log && j.log.replies) || 0) + ' new replies.');
          api('/api/state').then(function(s2){ if (s2.ok && s2.state) adopt(s2.state); else renderAuto(); });
        }, function(){ ui.cronBusy = false; toast('Could not reach the server.'); renderAuto(); });
      };
      if (cloud) api('/api/state', { method:'PUT', body: JSON.stringify({ state:S }) }).then(function(){ dirty = false; go(); }, go); else go();
    });
    $('#setTz').addEventListener('change', function(e){ var v = e.target.value.trim(); if (v && !validTz(v)) { toast('That time zone is not recognized. Use a name like America/New_York.'); e.target.value = S.settings.tz; return; } S.settings.tz = v; save(); renderCalendar(); });

    // replies view
    $('#viewSeg').addEventListener('click', function(e){ var b = e.target.closest('button'); if (b) setView(b.id === 'viewReplies' ? 'replies' : b.id === 'viewCalendar' ? 'calendar' : 'send'); });
    $('#btnCheck').addEventListener('click', function(){ checkReplies(false); });
    $('#rFilters').addEventListener('click', function(e){ var b = e.target.closest('[data-rf]'); if (!b) return; ui.rfilter = b.getAttribute('data-rf'); renderReplies(); });
    $('#rBulk').addEventListener('click', function(e){
      var b = e.target.closest('[data-rb]'); if (!b) return;
      var act = b.getAttribute('data-rb'), list = sentList();
      if (act==='csv') { download('interested-creators-' + new Date().toISOString().slice(0,10) + '.csv', interestedCsv(), 'text/csv'); return; }
      if (act==='next') askToStart('next', list.filter(canNext).map(function(c){ return c.id; }));
      if (act==='counter') askToStart('counter', list.filter(canCounter).map(function(c){ return c.id; }));
      if (act==='follow') askToStart('followup', list.filter(function(c){ return isDue(c) && canFollow(c); }).map(function(c){ return c.id; }));
    });
    $('#rCards').addEventListener('input', function(e){
      if (!e.target.hasAttribute('data-draft')) return;
      var card = e.target.closest('[data-id]'); if (card) ui.drafts[card.getAttribute('data-id')] = e.target.value;
    });
    $('#rCards').addEventListener('change', function(e){
      if (!e.target.hasAttribute('data-rtag')) return;
      var card = e.target.closest('[data-id]'), c = card && byId(card.getAttribute('data-id')); if (!c) return;
      var v = e.target.value.split(':');
      applyTag(c, v[0], { soft:v[1]==='soft', by:'manual' });
      save(); renderAll(); toast('Tag changed to ' + (TAG_LABEL[v[0]] || v[0]) + '.');
    });
    $('#rCards').addEventListener('click', function(e){
      var b = e.target.closest('[data-ra]'); if (!b) return;
      var card = b.closest('[data-id]'), c = card && byId(card.getAttribute('data-id')); if (!c) return;
      var act = b.getAttribute('data-ra');
      if (act==='next' || act==='counter') return askToStart(act, [c.id]);
      if (act==='follow') return askToStart('followup', [c.id]);
      if (act==='answer') {
        var ta = card.querySelector('[data-draft]'), msg = card.querySelector('[data-amsg]'), text = String(ta.value || '').trim();
        if (locked(c)) { msg.textContent = 'This creator is locked. Change the tag first.'; return; }
        if (!text) { msg.textContent = 'Write your reply first.'; ta.focus(); return; }
        if (running()) { msg.textContent = 'Wait for the current batch to finish.'; return; }
        b.disabled = true; msg.textContent = 'Sending…';
        sendAnswer(c, text).then(function(res){
          if (res.ok) { delete ui.drafts[c.id]; ta.blur(); save(); renderAll(); toast('Reply sent to ' + (c.name || c.email) + '.'); }
          else { b.disabled = false; msg.textContent = res.msg; }
        });
      }
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
      if (t && (t.kind==='first' || t.kind==='followup' || t.kind==='followup2')) ui.previewKind = t.kind==='first' ? 'first' : 'followup';
      if (t && t.kind==='first' && !running()) { S.settings.firstTpl = t.id; save(); renderSettings(); }
      renderEditor(); renderAll();
    });
    $('#tplName').addEventListener('input', function(e){ tplById(ui.editTpl).name = e.target.value; renderTabs(); renderSettings(); editorChanged(); });
    $('#tplSubject').addEventListener('input', function(e){ tplById(ui.editTpl).subject = e.target.value; editorChanged(); });
    $('#tplBody').addEventListener('input', function(e){ tplById(ui.editTpl).body = e.target.value; editorChanged(); });
    ['#tplSubject','#tplBody'].forEach(function(s){ $(s).addEventListener('focus', function(e){ ui.lastField = e.target; }); });
    function insertTag(name, focus){
      var ta = ui.lastField && !ui.lastField.closest('[hidden]') ? ui.lastField : $('#tplBody');
      var tag = '{{' + name + '}}';
      var s = ta.selectionStart == null ? ta.value.length : ta.selectionStart, en = ta.selectionEnd == null ? s : ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + tag + ta.value.slice(en);
      if (focus) ta.focus({ preventScroll:true });
      try { ta.setSelectionRange(s + tag.length, s + tag.length); } catch(err) {}
      ta.dispatchEvent(new Event('input'));
      return ta;
    }
    $('#vars').addEventListener('click', function(e){
      var b = e.target.closest('[data-var]'); if (!b) return;
      insertTag(b.getAttribute('data-var'), true);
    });
    $('#importReport').addEventListener('click', function(e){
      var b = e.target.closest('[data-var]'); if (!b) return;
      var ta = insertTag(b.getAttribute('data-var'), false);
      toast('Added {{' + b.getAttribute('data-var') + '}} to the ' + (ta.id === 'tplSubject' ? 'subject' : 'email body') + ' of ' + (tplById(ui.editTpl) || {}).name + '.');
    });
    $('#btnPickCsv').addEventListener('click', function(){ $('#csvFile').click(); });
    $('#csvFile').addEventListener('change', function(e){ importFile(e.target.files && e.target.files[0]); e.target.value = ''; });
    var dz = $('#dropzone');
    ['dragenter','dragover'].forEach(function(ev){ dz.addEventListener(ev, function(e){ e.preventDefault(); dz.classList.add('over'); }); });
    ['dragleave','dragend'].forEach(function(ev){ dz.addEventListener(ev, function(){ dz.classList.remove('over'); }); });
    dz.addEventListener('drop', function(e){ e.preventDefault(); dz.classList.remove('over'); importFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
    // a file dropped anywhere else on the page shouldn't open in the tab
    window.addEventListener('dragover', function(e){ e.preventDefault(); });
    window.addEventListener('drop', function(e){ if (!e.target.closest || !e.target.closest('#dropzone')) e.preventDefault(); });
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
      var t = tplById(ui.editTpl); if (!t || t.kind!=='first' || DEFAULT_TEMPLATES.some(function(d){ return d.id===t.id; })) return;
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
    $('#setSender').addEventListener('change', function(e){ S.settings.sender = e.target.value || 'rotate'; save(); renderAll(); });

    function testMsg(text, cls){ var m = $('#testMsg'); m.textContent = text; m.className = 'help ' + (cls||''); }
    $('#btnTest').addEventListener('click', function(){
      if (!ui.accounts.length) { testMsg('Gmail is not set up yet. Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel.', 'bad'); return; }
      var c = byId(ui.previewId) || S.contacts[0] || assign({}, EXAMPLES[0]);
      var comp = compose(c, 'first');
      if (comp.missing.length) { testMsg('Fill in ' + comp.missing.join(', ') + ' first, so the test looks real.', 'bad'); return; }
      var btn = $('#btnTest'); btn.disabled = true;
      var list = ui.accounts.slice(), okList = [], errs = [];
      testMsg('Sending ' + (list.length > 1 ? list.length + ' tests, one from each account…' : 'test…'));
      // Each account sends a test to itself, one after another.
      list.reduce(function(p, a){
        return p.then(function(){
          return api('/api/send', { method:'POST', body:JSON.stringify({ to:a.email, from:a.id, subject:'[Test] ' + comp.subject, body:comp.body.text }) }).then(function(j){
            if (j.code === 'unauthorized') { goLogin(); throw new Error('logout'); }
            if (j.ok) okList.push(a.email); else errs.push(j.message || ('The test from ' + a.email + ' did not send.'));
          }, function(){ errs.push('Could not reach the server.'); });
        });
      }, Promise.resolve()).then(function(){
        var msg = (okList.length ? 'Test sent from ' + okList.join(' and ') + ' to itself, using ' + (c.name || c.handle || c.email) + '\'s details. Check ' + (okList.length > 1 ? 'both inboxes' : 'your inbox') + '.' : '') + (errs.length ? ' ' + errs.join(' ') : '');
        testMsg(msg.trim(), errs.length ? 'bad' : 'ok');
      }, function(){}).then(function(){ btn.disabled = false; });
    });
    $('#btnVerify').addEventListener('click', function(){
      var btn = $('#btnVerify'); btn.disabled = true; testMsg('Checking Gmail login…');
      api('/api/status?verify=1').then(function(j){
        if (j.code === 'unauthorized') return goLogin();
        var list = (j.mail && j.mail.accounts) || [];
        if (!list.length) { testMsg('Gmail is not set up yet. Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel, then redeploy.', 'bad'); return; }
        var good = list.filter(function(a){ return a.verified; }), bad = list.filter(function(a){ return !a.verified; });
        var msg = (good.length ? 'Login works for ' + good.map(function(a){ return a.email; }).join(' and ') + '.' : '') + bad.map(function(a){ return ' ' + ((a.error && a.error.message) || ('Login failed for ' + a.email + '.')); }).join('');
        testMsg(msg.trim(), bad.length ? 'bad' : 'ok');
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
    function setTheme(t){
      document.documentElement.setAttribute('data-mode', t);
      try { localStorage.setItem('creator-mailer-mode', t); } catch(e) {}
      var b = $('#btnTheme'), label = t === 'dark' ? 'Light mode' : 'Dark mode';
      b.innerHTML = svgIcon(t === 'dark' ? 'sun' : 'moon');
      b.setAttribute('aria-label', label); b.setAttribute('data-tip', label);
    }
    setTheme(document.documentElement.getAttribute('data-mode') === 'light' ? 'light' : 'dark');
    $('#btnTheme').addEventListener('click', function(){ setTheme(document.documentElement.getAttribute('data-mode') === 'light' ? 'dark' : 'light'); });
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
    setInterval(pullCloud, 45000);
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) pullCloud(); });
    setInterval(function(){ if (!running()) { var k = counts(); renderStats(k); renderInsight(k); renderCapPill(); tickCampaigns(); renderCalendar(); } }, 60000);
  }

  /* ---------- boot ---------- */
  bind();
  renderAll(); renderEditor(); renderSettings(); renderSenderSettings(); renderGmailPill(); renderBackupHelp();
  initStore();
  checkStatus();

  return function(){};
}
