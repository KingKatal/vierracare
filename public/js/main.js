(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ── Header, progress, parallax (one rAF-throttled scroll handler) ── */
  const header = $('.site-header'), bar = $('.progress i'), arch = $('.arch'), blobs = $$('.blob');
  let ticking = false;
  const onScroll = () => {
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    header.classList.toggle('stuck', y > 24);
    if (bar) bar.style.transform = `scaleX(${h > 0 ? Math.min(y / h, 1) : 0})`;
    if (!reduce && y < innerHeight * 1.2) {
      if (arch) arch.style.setProperty('--py', `${y * -0.06}px`);
      blobs.forEach((b, i) => b.style.translate = `0 ${y * (0.05 + i * 0.03)}px`);
    }
    stepsProgress();
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* ── Mobile menu ── */
  const burger = $('#burger'), nav = $('#nav');
  const setMenu = open => {
    burger.setAttribute('aria-expanded', open); burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('open', open); document.body.classList.toggle('menu-open', open);
  };
  burger?.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  addEventListener('resize', () => { if (innerWidth > 980) setMenu(false); });

  /* ── Scroll reveal ── */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(el => io.observe(el));
  } else revealEls.forEach(el => el.classList.add('in'));

  /* ── Steps line fills as you scroll; each step lights up ── */
  const stepsWrap = $('[data-steps]');
  function stepsProgress() {
    if (!stepsWrap) return;
    const r = stepsWrap.getBoundingClientRect(), vert = innerWidth <= 900;
    const p = Math.max(0, Math.min(1, (innerHeight * 0.7 - r.top) / (r.height || 1)));
    $('.steps-line', stepsWrap).style.setProperty('--p', (p * 100).toFixed(1) + '%');
    $$('.step', stepsWrap).forEach((s, i, all) => s.classList.toggle('lit', p >= (i + 0.35) / all.length));
  }

  /* ── Card spotlight + 3D tilt ── */
  if (fine && !reduce) {
    $$('.card').forEach(c => {
      c.addEventListener('pointermove', e => {
        const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        c.style.setProperty('--mx', x + 'px'); c.style.setProperty('--my', y + 'px');
        if (c.classList.contains('tilt')) {
          const rx = ((y / r.height) - .5) * -6, ry = ((x / r.width) - .5) * 6;
          c.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
        }
      });
      c.addEventListener('pointerleave', () => { c.style.transform = ''; });
    });
    // magnetic buttons
    $$('.magnetic').forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px,${(e.clientY - r.top - r.height / 2) * .28}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  /* ── Page transitions ── */
  const curtain = $('.curtain');
  document.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a || reduce || !curtain) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || a.target === '_blank' || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    if (u.pathname === location.pathname && (u.hash || u.search === location.search)) { setMenu(false); return; } // in-page anchor
    if (/^(\/api|\/admin)/.test(u.pathname)) return;
    e.preventDefault(); setMenu(false);
    curtain.style.animation = 'none'; curtain.style.transition = 'none'; curtain.style.transform = 'translateY(101%)';
    curtain.offsetHeight; // reflow
    curtain.style.transition = 'transform .55s cubic-bezier(.2,.8,.2,1)'; curtain.style.transform = 'translateY(0)';
    setTimeout(() => { location.href = u.href; }, 520);
  });
  addEventListener('pageshow', e => { if (e.persisted && curtain) { curtain.style.transition = 'none'; curtain.style.animation = 'none'; curtain.style.transform = 'translateY(-101%)'; } });

  /* ── Hide social icons with no link configured ── */
  $$('a[data-social]').forEach(a => { if (!a.getAttribute('href')) a.remove(); });
  const wa = $('.fab-wa'); if (wa && /wa\.me\/\?|wa\.me\/$/.test(wa.href)) wa.remove();

  /* ── Forms ── */
  $$('form[data-form]').forEach(form => {
    const err = $('.err', form), wrap = form.parentElement, ok = $('[data-success]', wrap);
    const showErr = m => { err.textContent = m; err.classList.remove('show'); void err.offsetWidth; err.classList.add('show'); err.scrollIntoView({ block: 'center', behavior: 'smooth' }); };

    // multi-step wizard
    let step = 1;
    const steps = $$('.wstep', form), dots = $$('.wizard-top span', form);
    const go = n => {
      step = n; steps.forEach(s => s.classList.toggle('on', +s.dataset.step === n));
      dots.forEach((d, i) => d.classList.toggle('on', i < n));
      err.classList.remove('show'); wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    $$('[data-next]', form).forEach(b => b.addEventListener('click', () => {
      if (step === 1 && $('[name=careFor]', form).value.trim().length < 2) return showErr('Please tell us who needs care.');
      go(step + 1);
    }));
    $$('[data-prev]', form).forEach(b => b.addEventListener('click', () => go(step - 1)));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form), data = {};
      for (const [k, v] of fd.entries()) {
        if (k in data) data[k] = [].concat(data[k], v); else data[k] = v;
      }
      if ('services' in data) data.services = [].concat(data.services);
      const btn = $('[type=submit]', form), label = btn.innerHTML;
      btn.disabled = true; btn.textContent = 'Sending…'; err.classList.remove('show');
      try {
        const r = await fetch(form.dataset.form, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
        form.style.display = 'none'; $$('h2,p', wrap).forEach(el => { if (!ok.contains(el) && !form.contains(el)) el.style.display = 'none'; });
        ok.classList.add('show'); wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (x) {
        btn.disabled = false; btn.innerHTML = label;
        if (form.dataset.wizard !== undefined && /name|email|phone|contact|tick/i.test(x.message)) go(3);
        showErr(x.message || 'Network error. Please check your connection and try again.');
      }
    });
  });

  /* ── Slideshows — auto-advance is driven by the progress animation,
        so pausing (hover/focus) keeps timer and bar perfectly in sync ── */
  const bind = (root, figSel, ctlSel, name) => {
    if (!root) return null;
    const figs = $$(figSel, root), ctls = $$(ctlSel, root);
    if (figs.length < 2) return null;
    let i = 0;
    const show = n => {
      i = (n + figs.length) % figs.length;
      figs.forEach((f, k) => {
        const on = k === i;
        f.classList.toggle('on', on);
        f.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      ctls.forEach((c, k) => {
        const on = k === i;
        c.classList.toggle('on', on);
        if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
      });
    };
    ctls.forEach((c, k) => c.addEventListener('click', () => show(k)));
    root.querySelector('[data-gprev]')?.addEventListener('click', () => show(i - 1));
    root.querySelector('[data-gnext]')?.addEventListener('click', () => show(i + 1));
    if (!reduce) {
      root.addEventListener('animationend', e => {
        if (e.animationName === name && e.target.closest(ctlSel)?.classList.contains('on')) show(i + 1);
      });
      if (fine) {
        const pause = () => root.classList.add('paused');
        const resume = () => root.classList.remove('paused');
        root.addEventListener('pointerenter', pause);
        root.addEventListener('pointerleave', resume);
        root.addEventListener('focusin', pause);
        root.addEventListener('focusout', resume);
      }
    }
    return { root, show, index: () => i };
  };

  // Hero arch — dots double as the timer. Gallery — bars double as the timer.
  bind($('.hero-visual'), '.arch .slide', '.arch .adot', 'adotFill');
  const gallery = bind($('[data-gallery]'), '.gslide', '.gbar', 'gfill');
  gallery?.root.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); gallery.show(gallery.index() - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); gallery.show(gallery.index() + 1); }
  });

  onScroll();
})();
