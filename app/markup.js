// Static markup for the mailer. lib/mailer-client.js wires it up after mount.
export const MARKUP = `
<div class="page">
  <header class="g-head">
    <div>
      <div class="g-eyebrow">Outreach</div>
      <h1 class="g-display">Creator Mailer</h1>
      <p class="g-section-cap">Personalized creator outreach, sent from your own Gmail.</p>
    </div>
    <div class="g-head-right">
      <span id="gmailPill" class="ipill" role="img" tabindex="0" aria-label="Checking Gmail" data-tip="Checking Gmail…"><svg viewBox="0 0 24 24" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg><i class="ipill-dot"></i></span>
      <span id="savePill" class="ipill" role="img" tabindex="0" aria-label="Loading your list" data-tip="Loading your list…"><svg viewBox="0 0 24 24" aria-hidden="true"></svg><i class="ipill-dot"></i></span>
      <span class="head-sep" aria-hidden="true"></span>
      <button class="btn icon" type="button" id="btnTour" aria-label="Take the tour" data-tip="Take the tour"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg></button>
      <button class="btn icon" type="button" id="btnTheme" aria-label="Light mode" data-tip="Light mode"></button>
      <button class="btn icon" type="button" id="btnLogout" aria-label="Log out" data-tip="Log out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg></button>
    </div>
  </header>

  <div class="top-grid">
    <div class="g-hero" data-variant="a" id="insight">
      <span class="g-hero-cap">Reply rate</span>
      <span class="g-hero-num" id="insValue">0%</span>
      <span class="g-hero-status" id="insHeadline">No emails sent yet</span>
      <span class="g-hero-strip"><span class="ticks" id="insTicks" aria-hidden="true"></span></span>
    </div>

    <section class="g-card sendbar" id="sendbar" aria-label="Send">
      <div class="stats" id="stats"></div>
      <div class="actions">
        <button class="btn primary" id="btnFirst" type="button">Send first email (0)</button>
        <button class="btn" id="btnFollow" type="button">Send follow-up (0)</button>
      </div>
      <div class="quick" id="quick"></div>
      <div class="runline" id="runline" role="status" aria-live="polite"></div>
    </section>

    <div class="g-hero" data-variant="b" id="capHero">
      <span class="g-hero-cap">Sent today</span>
      <span class="g-hero-num" id="capValue">0/40</span>
      <span class="g-hero-status" id="capStatus">40 left today</span>
      <span class="g-hero-strip"><span class="hero-bar" aria-hidden="true"><span id="capFill" style="width:0%"></span></span></span>
    </div>
  </div>

  <div class="viewbar">
    <div class="seg" id="viewSeg" role="group" aria-label="Switch view">
      <button type="button" id="viewSend" aria-pressed="true">Outreach</button>
      <button type="button" id="viewReplies" aria-pressed="false">Replies</button>
    </div>
  </div>

  <section class="panel g-card" id="repliesView" aria-labelledby="hReplies" hidden>
    <div class="panel-head">
      <h2 id="hReplies">Replies</h2>
      <button class="btn primary" type="button" id="btnCheck">Check for replies</button>
    </div>
    <p class="help" id="rcStatus" role="status" aria-live="polite"></p>
    <p class="help bad" id="rcErr" hidden></p>
    <div class="rstats" id="rStats"></div>
    <div class="filters" id="rFilters" role="group" aria-label="Filter by tag"></div>
    <div class="bulk" id="rBulk"></div>
    <div class="rcards" id="rCards"></div>
    <p class="help">Checking reads only mail from creators on your list, replies to your emails, and bounce notices. Only a short snippet of each reply is saved.</p>
  </section>

  <main class="grid" id="sendView">
    <div class="col">
      <section class="panel g-card" id="creatorsPanel" aria-labelledby="hCreators">
        <div class="panel-head">
          <h2 id="hCreators">Creators</h2>
          <span class="muted" id="countLabel"></span>
        </div>

        <details class="import" id="importBox">
          <summary>Add creators</summary>
          <div class="import-body">
            <div class="dropzone" id="dropzone">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
              <div class="dz-text"><b>Drop a CSV here</b> or <button class="linkbtn" type="button" id="btnPickCsv">choose a file</button></div>
              <span class="help">From the lead skill, Google Sheets or Excel. Every column becomes a tag automatically.</span>
              <input type="file" id="csvFile" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" hidden>
            </div>
            <div class="or-line"><span>or paste rows</span></div>
            <textarea id="importText" class="code" rows="5" placeholder="name, email, handle, niche, line&#10;Maya Torres, maya@site.com, @mayamoves, fitness coach, Your form cues on squats are so clear"></textarea>
            <div class="row">
              <button class="btn primary" type="button" id="btnImport">Add to list</button>
              <span class="help" id="importMsg"></span>
            </div>
            <div class="import-report" id="importReport" hidden></div>
          </div>
        </details>

        <div class="note" id="exampleNote" hidden>
          <span>These rows are examples so you can see how it works. They never get sent.</span>
          <button class="btn sm" type="button" id="btnClearExamples">Remove examples</button>
        </div>

        <div class="filters" id="filters" role="group" aria-label="Filter creators"></div>
        <div class="bulk" id="bulk"></div>
        <div class="table-wrap" id="tableWrap">
          <table>
            <thead>
              <tr>
                <th class="ck"><input type="checkbox" id="selAll" aria-label="Select all shown"></th>
                <th>Creator</th>
                <th>Status</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody id="tbody"></tbody>
          </table>
        </div>
      </section>

      <section class="panel g-card" id="previewPanel" aria-labelledby="hPrev">
        <div class="panel-head">
          <h2 id="hPrev">Preview</h2>
          <div class="seg" role="group" aria-label="Preview which email">
            <button type="button" id="pvFirst" aria-pressed="true">First email</button>
            <button type="button" id="pvFollow" aria-pressed="false">Follow-up</button>
          </div>
        </div>
        <div class="row" style="justify-content:space-between">
          <div class="pnav">
            <button class="btn sm" type="button" id="pvPrev" aria-label="Previous creator">&#8592;</button>
            <span class="who-name" id="pvName">No creator</span>
            <button class="btn sm" type="button" id="pvNext" aria-label="Next creator">&#8594;</button>
          </div>
          <span class="muted" id="pvPos"></span>
        </div>
        <div class="mail">
          <dl class="mail-head" id="pvHead"></dl>
          <div class="mail-body" id="pvBody"></div>
        </div>
        <ul class="warns" id="pvWarns"></ul>
        <div class="row" id="pvActions"></div>
      </section>
    </div>

    <div class="col">
      <section class="panel g-card" id="messagePanel" aria-labelledby="hMsg">
        <div class="panel-head">
          <h2 id="hMsg">Message</h2>
          <div class="row">
            <button class="btn sm" type="button" id="btnNewTpl">New template</button>
            <button class="btn sm" type="button" id="btnTplReset">Reset to default</button>
            <button class="btn sm danger" type="button" id="btnTplDelete">Delete</button>
          </div>
        </div>
        <div class="tabs" id="tabs" role="tablist" aria-label="Templates"></div>
        <div class="field">
          <label for="tplName">Template name</label>
          <input type="text" id="tplName" autocomplete="off">
        </div>
        <div class="field" id="subjectField">
          <label for="tplSubject">Subject</label>
          <input type="text" id="tplSubject" autocomplete="off">
        </div>
        <p class="hint-line" id="followNote" hidden>Follow-ups go out as a reply in the same email thread, so they keep the first email's subject.</p>
        <div class="field">
          <label for="tplBody">Body</label>
          <textarea id="tplBody" rows="12"></textarea>
        </div>
        <div class="vars" id="vars"></div>
        <p class="hint-line">Click a tag to insert it. Add a fallback with a bar, like <code>{{first_name|there}}</code>, for creators missing that value.</p>
        <details class="you" id="youBox">
          <summary>Your details</summary>
          <div class="you-grid" id="youGrid"></div>
        </details>
      </section>

      <section class="panel g-card" id="settingsPanel" aria-labelledby="hSet">
        <h2 id="hSet">Sending</h2>
        <div class="field">
          <label for="setSender">Send from</label>
          <select id="setSender"></select>
          <p class="help" id="senderHint"></p>
        </div>
        <div class="set-grid">
          <div class="field">
            <label for="setTpl">First email uses</label>
            <select id="setTpl"></select>
          </div>
          <div class="field">
            <label for="setGap">Gap between emails</label>
            <select id="setGap">
              <option value="20">About 20 seconds</option>
              <option value="30">About 30 seconds</option>
              <option value="45">About 45 seconds</option>
              <option value="60">About 1 minute</option>
              <option value="90">About 90 seconds</option>
              <option value="120">About 2 minutes</option>
            </select>
          </div>
          <div class="field">
            <label for="setCap" id="capLabel">Daily limit</label>
            <input type="number" id="setCap" min="1" max="500" step="1">
          </div>
          <div class="field">
            <label for="setDue">Follow-up due after</label>
            <select id="setDue">
              <option value="12">12 hours</option>
              <option value="20">20 hours</option>
              <option value="24">1 day</option>
              <option value="48">2 days</option>
              <option value="72">3 days</option>
            </select>
          </div>
        </div>
        <div class="row" id="testRow">
          <button class="btn" type="button" id="btnTest">Send a test to myself</button>
          <button class="btn" type="button" id="btnVerify">Check Gmail login</button>
          <span class="help" id="testMsg"></span>
        </div>
        <p class="help">Keep this tab open while a batch runs. Gaps are randomized a little so the sends don't look automated. Gmail caps free accounts around 500 emails a day, but cold outreach from one inbox gets flagged far sooner, so 20 to 40 a day is a safer pace.</p>
        <div class="divider"></div>
        <h3 class="h3">Backup</h3>
        <div class="row">
          <button class="btn sm" type="button" id="btnBackup">Download backup</button>
          <button class="btn sm" type="button" id="btnRestore">Restore from backup</button>
          <input type="file" id="restoreFile" accept="application/json,.json" hidden>
        </div>
        <p class="help" id="backupHelp"></p>
      </section>
    </div>
  </main>
</div>

<div class="modal" id="modal" hidden>
  <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <h3 id="mTitle"></h3>
    <div id="mBody"></div>
    <div class="modal-actions">
      <button class="btn" type="button" id="mCancel">Cancel</button>
      <button class="btn primary" type="button" id="mOk">Start</button>
    </div>
  </div>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
`;
