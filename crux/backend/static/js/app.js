(function(){
  let state = { topics: [] };
  let activeTopicId = null;
  let currentFilter = 'all';
  let searchTerm = '';
  let ridgeIdCounter = 0;

  const els = {
    topicList: document.getElementById('topicList'),
    topicTitle: document.getElementById('topicTitle'),
    topicSub: document.getElementById('topicSub'),
    topicFrac: document.getElementById('topicFrac'),
    topicRidge: document.getElementById('topicRidge'),
    overallRidge: document.getElementById('overallRidge'),
    overallDone: document.getElementById('overallDone'),
    overallTotal: document.getElementById('overallTotal'),
    pitchList: document.getElementById('pitchList'),
    searchInput: document.getElementById('searchInput'),
    addPitchForm: document.getElementById('addPitchForm'),
    pNameInput: document.getElementById('pNameInput'),
    pNumInput: document.getElementById('pNumInput'),
    pDiffInput: document.getElementById('pDiffInput'),
    pLinkInput: document.getElementById('pLinkInput'),
    modalOverlay: document.getElementById('modalOverlay'),
    newTopicInput: document.getElementById('newTopicInput'),
    statusNote: document.getElementById('statusNote'),
  };

  function showStatus(msg){
    els.statusNote.textContent = msg;
    els.statusNote.classList.add('show');
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(() => els.statusNote.classList.remove('show'), 1400);
  }

  // ---------- API ----------
  async function api(path, opts){
    const res = await fetch(path, Object.assign({
      headers: { 'Content-Type': 'application/json' }
    }, opts));
    if(!res.ok){
      let msg = 'Request failed';
      try{ const body = await res.json(); msg = body.error || msg; }catch(e){}
      throw new Error(msg);
    }
    if(res.status === 204) return null;
    return res.json();
  }

  async function loadState(){
    try{
      state = await api('/api/state');
      if(!activeTopicId && state.topics.length) activeTopicId = state.topics[0].id;
    }catch(e){
      console.error('Could not load routes from the server.', e);
      showStatus('Could not reach the server — check the containers are running');
    }
  }

  // ---------- Ridge-line progress (signature visual) ----------
  function ridgeSVG(total, done, viewW, viewH){
    ridgeIdCounter++;
    const id = 'ridge-' + ridgeIdCounter;
    const n = Math.max(total, 1);
    const segW = viewW / n;
    const points = [];
    for(let i = 0; i <= n; i++){
      const x = i * segW;
      const seed = i * 12.9898;
      const h = viewH * 0.22 + viewH * 0.55 * Math.abs(Math.sin(seed) * Math.cos(seed * 0.73));
      points.push([x, viewH - h]);
    }
    const pct = total > 0 ? done / n : 0;
    const fillX = pct * viewW;
    const pointsStr = points.map(p => p.join(',')).join(' ');
    const areaPath = `M0,${viewH} ` + points.map(p => `L${p[0]},${p[1]}`).join(' ') + ` L${viewW},${viewH} Z`;

    return `
      <svg viewBox="0 0 ${viewW} ${viewH}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${id}-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#F0955A" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="#FFCE8E" stop-opacity="0.95"/>
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="var(--line)" opacity="0.4"></path>
        <clipPath id="${id}-clip"><rect x="0" y="0" width="${fillX}" height="${viewH}"></rect></clipPath>
        <path d="${areaPath}" fill="url(#${id}-grad)" clip-path="url(#${id}-clip)"></path>
        <polyline points="${pointsStr}" fill="none" stroke="var(--ink-dimmer)" stroke-width="1" opacity="0.6"></polyline>
      </svg>`;
  }

  function getActiveTopic(){
    return state.topics.find(t => t.id === activeTopicId) || state.topics[0];
  }

  // ---------- Renders ----------
  function renderOverall(){
    let total = 0, done = 0;
    state.topics.forEach(t => { total += t.total; done += t.done; });
    els.overallDone.textContent = done;
    els.overallTotal.textContent = total;
    els.overallRidge.innerHTML = ridgeSVG(total, done, 180, 44);
  }

  function renderSidebar(){
    els.topicList.innerHTML = '';
    state.topics.forEach(t => {
      const item = document.createElement('div');
      item.className = 'topic-item' + (t.id === activeTopicId ? ' active' : '');
      item.innerHTML = `<span class="t-name"></span><span class="t-count">${t.done}/${t.total}</span>`;
      item.querySelector('.t-name').textContent = t.name;
      item.addEventListener('click', () => {
        activeTopicId = t.id;
        searchTerm = '';
        els.searchInput.value = '';
        renderMain();
        renderSidebar();
      });
      els.topicList.appendChild(item);
    });
  }

  function renderMain(){
    const t = getActiveTopic();
    if(!t){
      els.topicTitle.textContent = 'No routes yet';
      els.topicSub.textContent = 'Start a route from the sidebar to log your first pitch.';
      els.topicFrac.textContent = '0/0';
      els.topicRidge.innerHTML = '';
      els.pitchList.innerHTML = '';
      return;
    }
    els.topicTitle.textContent = t.name;
    els.topicSub.textContent = t.total ? `${t.total} pitches logged on this route` : 'No pitches logged yet — log your first one below';
    els.topicFrac.textContent = `${t.done}/${t.total}`;
    els.topicRidge.innerHTML = ridgeSVG(t.total, t.done, 700, 60);
    renderPitchList(t);
  }

  function renderPitchList(t){
    els.pitchList.innerHTML = '';
    let list = t.questions;
    if(currentFilter === 'done') list = list.filter(q => q.done);
    if(currentFilter === 'pending') list = list.filter(q => !q.done);
    if(searchTerm) list = list.filter(q => q.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if(!t.questions.length){
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No pitches logged on this route yet — log your first one below.';
      els.pitchList.appendChild(empty);
      return;
    }
    if(!list.length){
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Nothing matches here.';
      els.pitchList.appendChild(empty);
      return;
    }

    list.forEach(q => {
      const idx = t.questions.indexOf(q) + 1;
      const wrap = document.createElement('div');
      wrap.className = 'pwrap';

      const row = document.createElement('div');
      row.className = 'prow' + (q.done ? ' done' : '');
      row.innerHTML = `
        <button class="p-check" title="Toggle climbed">${q.done ? '✓' : ''}</button>
        <span class="p-idx">${String(idx).padStart(2,'0')}</span>
        <span class="p-text"></span>
        ${q.difficulty ? `<span class="grade-chip ${q.difficulty}">${q.difficulty}</span>` : ''}
        ${q.number ? `<span class="lc-tag">LC ${q.number}</span>` : ''}
        ${q.link ? `<a class="p-link" href="${q.link}" target="_blank" rel="noopener">Open ↗</a>` : ''}
        ${q.hint ? `<button class="p-beta-btn" title="Suggested approach">Beta</button>` : ''}
        <button class="p-note-btn${q.notes ? ' has-note' : ''}" title="Field notes"><span class="dot"></span>Notes</button>
      `;
      row.querySelector('.p-text').textContent = q.name;

      row.querySelector('.p-check').addEventListener('click', async () => {
        try{
          await api(`/api/questions/${q.id}`, { method: 'PATCH', body: JSON.stringify({ done: !q.done }) });
          await loadState();
          renderAll();
        }catch(e){ showStatus('Could not save — try again'); }
      });

      let betaPanel = null;
      const betaBtn = row.querySelector('.p-beta-btn');
      if(betaBtn){
        betaBtn.addEventListener('click', () => {
          if(!betaPanel){
            betaPanel = document.createElement('div');
            betaPanel.className = 'p-panel';
            betaPanel.innerHTML = `<div class="panel-label">Beta — suggested approach</div><div class="beta-text"></div>`;
            betaPanel.querySelector('.beta-text').textContent = q.hint;
            wrap.appendChild(betaPanel);
          }
          betaPanel.classList.toggle('open');
        });
      }

      const notePanel = document.createElement('div');
      notePanel.className = 'p-panel';
      notePanel.innerHTML = `
        <div class="panel-label">Field notes</div>
        <textarea placeholder="Your approach, mistakes, complexity, things to remember…"></textarea>
        <div class="note-panel-footer">
          <div class="note-hint">Saves automatically as you type</div>
          <button class="p-delete-link">Delete pitch</button>
        </div>
      `;
      const textarea = notePanel.querySelector('textarea');
      textarea.value = q.notes;
      let saveTimer;
      textarea.addEventListener('input', () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
          try{
            await api(`/api/questions/${q.id}`, { method: 'PATCH', body: JSON.stringify({ notes: textarea.value }) });
            q.notes = textarea.value;
            row.querySelector('.p-note-btn').classList.toggle('has-note', !!textarea.value.trim());
          }catch(e){ showStatus('Could not save note'); }
        }, 500);
      });

      const deleteLink = notePanel.querySelector('.p-delete-link');
      deleteLink.addEventListener('click', async () => {
        if(deleteLink.dataset.confirming === 'true'){
          try{
            await api(`/api/questions/${q.id}`, { method: 'DELETE' });
            await loadState();
            renderAll();
          }catch(e){ showStatus('Could not delete — try again'); }
        } else {
          deleteLink.dataset.confirming = 'true';
          deleteLink.textContent = 'Click again to confirm';
          deleteLink.classList.add('confirming');
          setTimeout(() => {
            deleteLink.dataset.confirming = 'false';
            deleteLink.textContent = 'Delete pitch';
            deleteLink.classList.remove('confirming');
          }, 2500);
        }
      });

      row.querySelector('.p-note-btn').addEventListener('click', () => {
        notePanel.classList.toggle('open');
        if(notePanel.classList.contains('open')) textarea.focus();
      });

      wrap.appendChild(row);
      wrap.appendChild(notePanel);
      els.pitchList.appendChild(wrap);
    });
  }

  function renderAll(){
    renderOverall();
    renderSidebar();
    renderMain();
  }

  // ---------- Events ----------
  els.searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    const t = getActiveTopic();
    if(t) renderPitchList(t);
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      const t = getActiveTopic();
      if(t) renderPitchList(t);
    });
  });

  els.addPitchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = getActiveTopic();
    if(!t) return;
    const name = els.pNameInput.value.trim();
    if(!name) return;
    try{
      await api(`/api/topics/${t.id}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          number: els.pNumInput.value.trim(),
          difficulty: els.pDiffInput.value,
          link: els.pLinkInput.value.trim(),
        })
      });
      els.pNameInput.value = ''; els.pNumInput.value = ''; els.pDiffInput.value = ''; els.pLinkInput.value = '';
      await loadState();
      renderAll();
    }catch(e){ showStatus('Could not log pitch — try again'); }
  });

  document.getElementById('addTopicBtn').addEventListener('click', () => {
    els.newTopicInput.value = '';
    els.modalOverlay.classList.add('show');
    els.newTopicInput.focus();
  });
  document.getElementById('modalCancel').addEventListener('click', () => {
    els.modalOverlay.classList.remove('show');
  });
  document.getElementById('modalCreate').addEventListener('click', async () => {
    const name = els.newTopicInput.value.trim();
    if(!name) return;
    try{
      const topic = await api('/api/topics', { method: 'POST', body: JSON.stringify({ name }) });
      activeTopicId = topic.id;
      els.modalOverlay.classList.remove('show');
      await loadState();
      renderAll();
    }catch(e){ showStatus('Could not create route — try again'); }
  });
  els.newTopicInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') document.getElementById('modalCreate').click();
  });
  els.modalOverlay.addEventListener('click', (e) => {
    if(e.target === els.modalOverlay) els.modalOverlay.classList.remove('show');
  });

  // ---------- Init ----------
  (async function init(){
    await loadState();
    renderAll();
  })();
})();
