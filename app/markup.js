// Static markup for the mailer. lib/mailer-client.js wires it up after mount.
export const MARKUP = `
<div class="wrap">
  <header class="top">
    <div class="brand">
      <h1>Creator Mailer</h1>
      <p>Personalized creator outreach, sent from your own Gmail.</p>
    </div>
    <div class="top-right">
      <div class="pills">
        <span id="gmailPill" class="pill">Checking Gmail…</span>
        <span id="savePill" class="pill">Loading your list…</span>
        <span id="capPill" class="pill">Sent today 0 / 40</span>
      </div>
      <div class="row">
        <button class="btn sm" type="button" id="btnTour">Take the tour</button>
        <button class="btn sm" type="button" id="btnLogout">Log out</button>
      </div>
    </div>
  </header>

  <section class="sendbar" id="sendbar" aria-label="Send">
    <div class="stats" id="stats"></div>
    <div class="actions">
      <button class="btn primary" id="btnFirst" type="button">Send first email (0)</button>
      <button class="btn" id="btnFollow" type="button">Send follow-up (0)</button>
    </div>
    <div class="quick" id="quick"></div>
    <div class="runline" id="runline" role="status" aria-live="polite"></div>
  </section>

  <main class="grid">
    <div class="col">
      <section class="panel" id="creatorsPanel" aria-labelledby="hCreators">
        <div class="panel-head">
          <h2 id="hCreators">Creators</h2>
          <span class="muted" id="countLabel"></span>
        </div>

        <details class="import" id="importBox">
          <summary>Add creators</summary>
          <div class="import-body">
            <p class="help">Paste rows from Google Sheets or a CSV, with a header row. It reads <span class="mono">name, email, handle, niche, line</span>. Any other column becomes its own tag. A plain list of emails works too.</p>
            <textarea id="importText" class="code" rows="6" placeholder="name, email, handle, niche, line&#10;Maya Torres, maya@site.com, @mayamoves, fitness coach, Your form cues on squats are so clear"></textarea>
            <div class="row">
              <button class="btn primary" type="button" id="btnImport">Add to list</button>
              <span class="help" id="importMsg"></span>
            </div>
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

      <section class="panel" id="previewPanel" aria-labelledby="hPrev">
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
      <section class="panel" id="messagePanel" aria-labelledby="hMsg">
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

      <section class="panel" id="settingsPanel" aria-labelledby="hSet">
        <h2 id="hSet">Sending</h2>
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
            <label for="setCap">Daily limit</label>
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
