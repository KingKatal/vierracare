(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TYPE = { care_request: 'Care request', contact: 'Message', application: 'Application' };
  const ST = { new: 'New', in_progress: 'In progress', done: 'Done' };
  const state = { type: '', status: '', q: '' };
  const api = (u, o = {}) => fetch(u, { headers: { 'Content-Type': 'application/json' }, ...o }).then(async r => {
    if (r.status === 401) { show(false); throw new Error('auth'); }
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Error'); return j;
  });
  const show = on => { $('#login').hidden = on; $('#dash').hidden = !on; };

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, err = $('.err', f);
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: f.username.value, password: f.password.value }) });
      err.classList.remove('show'); f.password.value = ''; show(true); load();
    } catch (x) { err.textContent = x.message; err.classList.add('show'); }
  });
  $('#logout').onclick = async () => { await api('/api/admin/logout', { method: 'POST' }).catch(() => {}); show(false); };

  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.type = b.dataset.type; [...$('#tabs').children].forEach(x => x.classList.toggle('on', x === b)); load();
  });
  $('#status').onchange = e => { state.status = e.target.value; load(); };
  let t; $('#q').oninput = e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; load(); }, 250); };

  const fmt = iso => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const label = k => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());

  async function load() {
    try {
      const qs = new URLSearchParams(Object.fromEntries(Object.entries(state).filter(([, v]) => v)));
      const { stats, items } = await api('/api/admin/inquiries?' + qs);
      $('#stats').innerHTML = [['New', stats.new, 1], ['Care requests', stats.care_request], ['Messages', stats.contact], ['Applications', stats.application], ['All time', stats.total]]
        .map(([l, n, hot]) => `<div class="a-stat ${hot ? 'hot' : ''}"><b>${n}</b><span>${l}</span></div>`).join('');
      $('#list').innerHTML = items.length ? items.map(row).join('') : '<div class="a-empty">Nothing here yet. New requests will appear as soon as they arrive.</div>';
    } catch (e) { if (e.message !== 'auth') console.error(e); }
  }

  function row(r) {
    const p = Object.entries(r.payload).filter(([, v]) => v !== '' && !(Array.isArray(v) && !v.length))
      .map(([k, v]) => `<dt>${esc(label(k))}</dt><dd>${esc(Array.isArray(v) ? v.join(', ') : v)}</dd>`).join('');
    return `<article class="a-item ${r.status === 'new' ? 'new' : ''}" data-id="${r.id}">
      <div class="a-head"><span class="a-type ${r.type}">${TYPE[r.type]}</span>
        <div class="a-who"><b>${esc(r.name)}</b><small>${esc([r.phone, r.email].filter(Boolean).join(' · '))}</small></div>
        <span class="a-st ${r.status}">${ST[r.status]}</span><span class="a-when">${fmt(r.created_at)}</span></div>
      <div class="a-body">
        <dl class="a-kv">${p}<dt>Phone</dt><dd>${r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : '—'}</dd><dt>Email</dt><dd>${r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : '—'}</dd></dl>
        <div class="a-edit">
          <select data-f="status">${Object.entries(ST).map(([k, v]) => `<option value="${k}" ${k === r.status ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <textarea data-f="notes" placeholder="Internal notes (only the team sees these)">${esc(r.notes)}</textarea>
          <button class="btn" data-act="save">Save</button><button class="btn a-del" data-act="del">Delete</button>
        </div></div></article>`;
  }

  $('#list').addEventListener('click', async e => {
    const item = e.target.closest('.a-item'); if (!item) return;
    const id = item.dataset.id, act = e.target.dataset.act;
    if (!act) { if (e.target.closest('.a-head')) item.classList.toggle('open'); return; }
    if (act === 'save') {
      await api('/api/admin/inquiries/' + id, { method: 'PATCH', body: JSON.stringify({ status: $('[data-f=status]', item).value, notes: $('[data-f=notes]', item).value }) });
      const open = item.classList.contains('open'); await load(); if (open) $(`[data-id="${id}"]`)?.classList.add('open');
    }
    if (act === 'del' && confirm('Delete this entry permanently?')) { await api('/api/admin/inquiries/' + id, { method: 'DELETE' }); load(); }
  });

  api('/api/admin/me').then(r => { show(r.signedIn); if (r.signedIn) load(); }).catch(() => show(false));
  setInterval(() => { if (!$('#dash').hidden && document.visibilityState === 'visible') load(); }, 60000);
})();
