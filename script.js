  // ── CURSOR / PARTICLES disabled for cleaner UX ────────────────────────────

  // ── SCROLL PROGRESS ───────────────────────────────────────────────────────
  const progressBar = document.getElementById('scroll-progress');
  let progressTicking = false;
  window.addEventListener('scroll', () => {
    if (!progressBar || progressTicking) return;
    progressTicking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      progressBar.style.width = pct + '%';
      progressTicking = false;
    });
  }, { passive: true });

  // ── HEADER SCROLL ─────────────────────────────────────────────────────────
  const header = document.querySelector('header');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        header?.classList.toggle('scrolled', window.scrollY > 24);
        updateActiveNav();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  function updateActiveNav() {
    const links = document.querySelectorAll('.nav-links a[href^="#"]');
    if (!links.length) return;
    const offset = (header?.offsetHeight || 80) + 24;
    let current = 'home';
    document.querySelectorAll('main section[id]').forEach(section => {
      const top = section.getBoundingClientRect().top;
      if (top - offset <= 0) current = section.id;
    });
    links.forEach(link => {
      const href = link.getAttribute('href')?.slice(1);
      link.classList.toggle('is-active', href === current);
    });
    if (typeof window.syncNavIndicator === 'function') {
      window.syncNavIndicator();
    }
  }
  updateActiveNav();

  // Sliding nav underline (desktop)
  (function initNavIndicator() {
    const nav = document.querySelector('.nav-links');
    if (!nav) return;

    const indicator = document.createElement('span');
    indicator.className = 'nav-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    nav.appendChild(indicator);

    const links = () => [...nav.querySelectorAll('a[href^="#"]')];
    let hovering = false;

    function isDesktopNav() {
      return window.matchMedia('(min-width: 1025px)').matches;
    }

    function moveTo(el, { instant = false } = {}) {
      if (!el || !isDesktopNav()) {
        indicator.classList.remove('is-visible');
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const left = r.left - navRect.left + nav.scrollLeft;
      const width = r.width;

      if (instant) {
        const prev = indicator.style.transition;
        indicator.style.transition = 'none';
        indicator.style.left = `${left}px`;
        indicator.style.width = `${width}px`;
        // Force reflow, then restore transition
        void indicator.offsetWidth;
        indicator.style.transition = prev;
      } else {
        indicator.style.left = `${left}px`;
        indicator.style.width = `${width}px`;
      }
      indicator.classList.add('is-visible');
    }

    function syncNavIndicator(opts) {
      if (hovering) return;
      const active = nav.querySelector('a.is-active') || links()[0];
      moveTo(active, opts);
    }

    window.syncNavIndicator = syncNavIndicator;

    links().forEach(link => {
      link.addEventListener('mouseenter', () => {
        hovering = true;
        moveTo(link);
      });
      link.addEventListener('focus', () => {
        hovering = true;
        moveTo(link);
      });
    });

    nav.addEventListener('mouseleave', () => {
      hovering = false;
      syncNavIndicator();
    });
    nav.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!nav.contains(document.activeElement)) {
          hovering = false;
          syncNavIndicator();
        }
      }, 0);
    });

    window.addEventListener('resize', () => syncNavIndicator({ instant: true }), { passive: true });
    window.addEventListener('language-changed', () => {
      window.requestAnimationFrame(() => syncNavIndicator({ instant: true }));
    });

    // Initial place after layout
    window.requestAnimationFrame(() => syncNavIndicator({ instant: true }));
  })();

  const heroVideo = document.querySelector('.video-background video');
  if (heroVideo) {
    const tryPlay = () => heroVideo.play().catch(() => {});
    heroVideo.addEventListener('canplay', tryPlay, { once: true });
    tryPlay();
  }

  function initPageInteractions() {
    document.querySelector('.hero .reveal')?.classList.add('active');
    // calculate() runs after i18n is defined (see bootPage below)
    const factObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.querySelectorAll('[data-target]').forEach(el => animateCount(el));
        factObs.unobserve(e.target);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -40px 0px' });
    const factsSection = document.getElementById('facts');
    if (factsSection) factObs.observe(factsSection);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPageInteractions);
  } else {
    initPageInteractions();
  }

// ── CUSTOM NUMBER STEPPERS ────────────────────────────────────────────────
(function initNumberSteppers() {
  const CHEV_UP = '<svg viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="M1 6.5L6 1.5L11 6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHEV_DOWN = '<svg viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function stepInput(input, direction) {
    const step = parseFloat(input.step) || 1;
    const min = input.min === '' ? -Infinity : parseFloat(input.min);
    const max = input.max === '' ? Infinity : parseFloat(input.max);
    const current = input.value === '' ? 0 : parseFloat(input.value);
    if (Number.isNaN(current)) return false;

    const decimals = (String(input.step).split('.')[1] || '').length;
    let next = current + direction * step;
    next = Math.min(max, Math.max(min, next));
    if (decimals > 0) next = parseFloat(next.toFixed(decimals));

    if (next === current) return false;

    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function bindHoldStep(btn, input, direction) {
    let delayTimer = null;
    let repeatTimer = null;
    let holding = false;
    let intervalMs = 120;

    function clearTimers() {
      if (delayTimer) window.clearTimeout(delayTimer);
      if (repeatTimer) window.clearInterval(repeatTimer);
      delayTimer = null;
      repeatTimer = null;
      holding = false;
      intervalMs = 120;
    }

    function tick() {
      if (!stepInput(input, direction)) {
        clearTimers();
      }
    }

    function startHold(e) {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      clearTimers();
      holding = true;
      tick();

      delayTimer = window.setTimeout(() => {
        if (!holding) return;
        tick();
        repeatTimer = window.setInterval(() => {
          tick();
          // Slightly accelerate while held
          if (intervalMs > 45 && repeatTimer) {
            window.clearInterval(repeatTimer);
            intervalMs = Math.max(45, intervalMs - 12);
            repeatTimer = window.setInterval(tick, intervalMs);
          }
        }, intervalMs);
      }, 380);
    }

    function endHold() {
      clearTimers();
    }

    btn.addEventListener('pointerdown', startHold);
    btn.addEventListener('pointerup', endHold);
    btn.addEventListener('pointerleave', endHold);
    btn.addEventListener('pointercancel', endHold);
    btn.addEventListener('lostpointercapture', endHold);
    // Avoid duplicate step from synthetic click after pointerup
    btn.addEventListener('click', e => e.preventDefault());
  }

  function enhance(input) {
    if (input.closest('.num-field') || input.dataset.noStepper === 'true') return;

    const wrap = document.createElement('div');
    wrap.className = 'num-field';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const steppers = document.createElement('div');
    steppers.className = 'num-steppers';
    steppers.setAttribute('aria-hidden', 'true');

    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'num-step num-step-up';
    up.tabIndex = -1;
    up.innerHTML = CHEV_UP;
    bindHoldStep(up, input, 1);

    const down = document.createElement('button');
    down.type = 'button';
    down.className = 'num-step num-step-down';
    down.tabIndex = -1;
    down.innerHTML = CHEV_DOWN;
    bindHoldStep(down, input, -1);

    steppers.append(up, down);
    wrap.appendChild(steppers);
  }

  function run() {
    document.querySelectorAll('input[type="number"]').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

// ── SMOOTH SCROLL ─────────────────────────────────────────────────────────
const HEADER_OFFSET = 96;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getScrollTargetY(href) {
  const targetId = href.slice(1);
  if (!targetId) return 0;
  if (targetId === 'home') return 0;

  const section = document.getElementById(targetId);
  if (!section) return null;

  const targetElement =
    section.querySelector('.section-eyebrow') ||
    section.querySelector('h2') ||
    section;

  return Math.max(
    0,
    targetElement.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET
  );
}

function smoothScrollTo(targetY) {
  window.scrollTo({
    top: targetY,
    left: 0,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth'
  });
}

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (!href || href === '#' || !href.startsWith('#')) return;

    const targetY = getScrollTargetY(href);
    if (targetY === null) return;

    e.preventDefault();
    smoothScrollTo(targetY);

    if (history.pushState) {
      history.pushState(null, '', href);
    }
  });
});

  // ── REVEAL (visibility failsafe; no content hiding) ───────────────────────
  document.documentElement.classList.add('js-ready');
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
  document.querySelectorAll('.stagger').forEach(el => el.classList.add('in-view'));

  // ── COUNTER ANIMATION ─────────────────────────────────────────────────────
  function animateCount(el) {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const dur    = 1800;
    const start  = performance.now();
    function frame(now) {
      const pct = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - pct, 3);
      const val = Math.round(eased * target);
      el.textContent = val >= 1000 ? val.toLocaleString() + suffix : val + suffix;
      if (pct < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ── CARD MOUSE GLOW ───────────────────────────────────────────────────────
  document.querySelectorAll('.card, .calc-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
      const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
      card.style.setProperty('--mouse-x', x + '%');
      card.style.setProperty('--mouse-y', y + '%');
    });
  });

  // ── CALCULATOR ────────────────────────────────────────────────────────────
  function calculate() {
    const lang = document.querySelector('.lang-btn.active')?.dataset.lang || 'et';
    const noSavings = (typeof i18n !== 'undefined' && i18n[lang]?.calc_no_savings_text) || 'Säästu ei teki';

    const n      = Math.max(0, parseFloat(document.getElementById('autoArv').value)    || 0);
    const km     = Math.max(0, parseFloat(document.getElementById('labisoit').value)    || 0);
    const evEff  = Math.max(0, parseFloat(document.getElementById('evKulu').value)      || 0);
    const ePrice = Math.max(0, parseFloat(document.getElementById('elekterHind').value) || 0);
    const iceEff = Math.max(0, parseFloat(document.getElementById('iceKulu').value)     || 0);
    const fPrice = Math.max(0, parseFloat(document.getElementById('kutuseHind').value)  || 0);

    const evCost  = (km/100) * evEff  * ePrice;
    const iceCost = (km/100) * iceEff * fPrice;
    const savePC  = iceCost - evCost;
    const saveAll = savePC * n;
    const units   = Math.ceil(n/2);
    const invest  = (units*600) + 1150 + (units*150);
    const payback = saveAll > 0 ? (invest/saveAll).toFixed(1) : noSavings;

    document.getElementById('resEvKuluKuu').textContent   = evCost.toFixed(2);
    document.getElementById('resIceKuluKuu').textContent  = iceCost.toFixed(2);
    document.getElementById('resSaastAuto').textContent   = savePC.toFixed(2)  + ' €';
    document.getElementById('resSaastKu').textContent     = saveAll.toFixed(2) + ' €';
    document.getElementById('resInvesteering').textContent = invest.toLocaleString() + ' €';
    document.getElementById('resTasuvus').textContent     = payback;
    const suf = document.getElementById('paybackMonthsSuffix');
    if (suf) suf.style.display = saveAll > 0 ? 'inline' : 'none';
  }

  // ── ALPINE CONFIGURATOR ───────────────────────────────────────────────────
  function deviceCalculator() {
    return {
      loading: false, success: false, error: false, currentLang: 'et', selectedPackageId: 2,
      items: [
        { id: 1, name: '2 laadimispesa ( 1-f + 1-f )', price: 600, qty: 1 },
        { id: 2, name: '2 laadimispesa ( 1-f + 3-f )', price: 800, qty: 0 },
        { id: 3, name: '2 laadimispesa ( 3-f + 3-f )', price: 900, qty: 0 }
      ],
      packages: [
        { id: 1, name: 'Lühike (0–20m)',    basePrice: 500,  extra: 300 },
        { id: 2, name: 'Keskmine (20–40m)', basePrice: 700,  extra: 300 },
        { id: 3, name: 'Pikk (40m+)',       basePrice: 1000, extra: 300 }
      ],
      form: { address:'', peakaitse:100, name:'', email:'', phone:'', message:'' },
      addrSuggestions: [], addrHighlight: -1, addrLoading: false,

      async fetchAddressSuggestions() {
        const q = this.form.address.trim();
        if (q.length < 3) { this.addrSuggestions = []; return; }
        this.addrLoading = true;
        try {
          const r = await fetch(`https://inaadress.maaamet.ee/inaadress/gazetteer?address=${encodeURIComponent(q)}&results=8`);
          const d = await r.json();
          this.addrSuggestions = (d.addresses || []).slice(0, 8);
          this.addrHighlight = -1;
        } catch { this.addrSuggestions = []; }
        finally   { this.addrLoading = false; }
      },
      selectAddress(s) { this.form.address = s.ipikkaadress || s.aadresstekst || ''; this.addrSuggestions = []; this.addrHighlight = -1; },

      get totalQty()        { return this.items.reduce((s,i) => s + i.qty, 0); },
      get seadmeteMaksumus(){ return this.items.reduce((s,i) => s + i.price*i.qty, 0); },
      getTranslatedItemName(item)    { return i18n[this.currentLang]?.['conf_item_'+item.id+'_name'] || item.name; },
      getTranslatedPackageName(id)   { return i18n[this.currentLang]?.['conf_package_'+id+'_name'] || this.packages.find(p=>p.id===id)?.name||''; },
      getI18nText(key,fb='')         { return i18n[this.currentLang]?.[key] || fb; },
      get paigalduseMaksumus() {
        if (!this.totalQty) return 0;
        const p = this.packages.find(p => p.id === this.selectedPackageId);
        return p.basePrice + ((this.totalQty - 1) * p.extra);
      },
      get selectedPackageName() { return this.getTranslatedPackageName(this.selectedPackageId); },
async sendConfiguration() {
        this.loading = true;
        this.success = false;
        this.error = false;
        await this.$nextTick();
        try {
          const formEl = document.getElementById('configForm');
          const formData = new FormData(formEl);
          const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            body: formData
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok && data.success !== false) {
            this.success = true;
            this.form.name = '';
            this.form.email = '';
            this.form.phone = '';
            this.form.message = '';
          } else {
            this.error = true;
          }
        } catch (err) {
          console.error('Form submission failed:', err);
          this.error = true;
        } finally {
          this.loading = false;
        }
      }
    }; // <--- ADD THIS (closes the return object)
  } // <--- ADD THIS (closes the deviceCalculator function)

// ── MOBILE MENU ───────────────────────────────────────────────────────────
const menuToggle        = document.getElementById('menu-toggle');
const navLinksContainer = document.getElementById('nav-links');
const navBackdrop       = document.getElementById('nav-backdrop');

if (menuToggle && navLinksContainer) {
  function setMenuOpen(isOpen) {
    navLinksContainer.classList.toggle('active', isOpen);
    menuToggle.classList.toggle('is-active', isOpen);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    if (navBackdrop) {
      navBackdrop.hidden = !isOpen;
      navBackdrop.classList.toggle('is-open', isOpen);
    }
    document.documentElement.style.overflow = isOpen ? 'hidden' : '';
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  function toggleMenu() {
    setMenuOpen(!navLinksContainer.classList.contains('active'));
  }

  menuToggle.addEventListener('click', toggleMenu);
  navBackdrop?.addEventListener('click', () => setMenuOpen(false));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && navLinksContainer.classList.contains('active')) {
      setMenuOpen(false);
    }
  });

  navLinksContainer.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => setMenuOpen(false));
  });
}

  // ── TRANSLATIONS ──────────────────────────────────────────────────────────
  const i18n = {
    et: {
      nav_home:"Avaleht",nav_solution:"Lahendus",nav_calculator:"Tasuvus",nav_how:"Kuidas töötab",nav_contact:"Kontakt",
      skip_link:"Liigu sisu juurde",
      hero_badge:"Uus toode",hero_h1:"Nutikas <span class='hero-accent'>energialahendus</span> kortermajadele.",
      hero_lead:"Kontrollitud elektriautode laadimine korteriühistutele — ilma suure investeeringu ja keeruka halduseta.",
      hero_btn:"Loo oma lahendus",hero_img_alt:"WEXA laadimispunkt kortermaja parklas",hero_cta_secondary:"Arvuta tasuvus",
      scroll_indicator:"Keri alla",scroll_indicator_aria:"Keri alla",
      "reason-section-title":"Miks tavalised lahendused sageli <span class='hero-accent'>ei tööta</span>?",
      why_card1_h:"Suured alginvesteeringud",why_card1_p:"Traditsioonilised laadimislahendused nõuavad suuri eelinvesteeringuid ja keerukaid elektrisüsteemi ümberkorraldusi.",
      why_card2_h:"Keerukas haldamine",why_card2_p:"Laadimiste arvestus, arvete koostamine ja süsteemi hooldus võtab palju aega ja ressursse.",
      why_card3_h:"Ebaõiglane jagamine",why_card3_p:"Kõik elanikud panustavad ühiselt, aga kasutavad vaid mõned. See ei ole õiglane lahendus.",
      "wexa-heading":"Turvaline ja <span class='hero-accent'>nutikas</span>",
      sol_card1_h:"Teraskorpus",sol_card1_p:"Kogu laadimissüsteem on turvaliselt kapis. Lihtne 230V ja/või 400V ühendus, sobib igale majale.",
      sol_card2_h:"Juhtimine mobiiliäpiga",sol_card2_p:"Elanikud kasutavad süsteemi läbi mobiiliäpi. Automaatne tarbimise ja kulu arvestus.",
      sol_card3_h:"Läbipaistev ja õiglane",sol_card3_p:"Elektrienergia tarbimine arvestatakse täpselt ja korteripõhiselt. Kõik kulud kajastatakse läbipaistvalt kommunaalarvetel.",
      sol_card4_h:"Reaalajas jälgimine",sol_card4_p:"Süsteem jälgib tarbimist ja koormust automaatselt, võimaldades ühistul lihtsalt planeerida energiakasutust.",
      "roi-calculator-title":"Kiire <span class='hero-accent'>tasuvuskalkulaator</span>",
      calc_input_h:"Sisendandmed",calc_label_autos:"Elektriautode arv ühistus",calc_label_km:"Läbisõit 1 auto kohta kuus (km)",
      calc_label_ev_eff:"Elektriauto kulu (kWh/100km)",calc_label_el_price:"Elektri lõpphind (€/kWh)",
      calc_label_ice_eff:"Vana auto kütusekulu (L/100km)",calc_label_fuel_price:"Kütuse hind (€/L)",
      calc_res_h:"Võrdlus ja tulemused",calc_ev_cost_title:"ELEKTRIAUTO KULU",calc_ice_cost_title:"TAVA-AUTO KULU",
      calc_save_auto:"Sääst 1 auto kohta kuus:",calc_save_ky:"Sääst kogu KÜ kohta kuus:",
      calc_invest:"Investeering alates:",calc_payback_label:"Hinnanguline tasuvusaeg",calc_no_savings_text:"Säästu ei teki",
      conf_title:"Loo oma <span class='hero-accent'>lahendus</span>",conf_accent:"lahendus",
      house_equipment_title:"Maja ja seadmete andmed",installation_address_label:"Paigalduse aadress",
      installation_address_placeholder:"Tänav, maja, linn",conf_main_fuse_label:"Maja peakaitse (A)",
      installation_package_title:"Paigalduspakett",conf_unit_price_label:"Ühikuhind",conf_base_label:"Baas",
      conf_item_1_name:"2 laadimispesa ( 1-f + 1-f )",conf_item_2_name:"2 laadimispesa ( 1-f + 3-f )",conf_item_3_name:"2 laadimispesa ( 3-f + 3-f )",
      conf_package_1_name:"Lühike (0-20 m)",conf_package_2_name:"Keskmine (20-40 m)",conf_package_3_name:"Pikk (40 m+)",
      distance_selection_text:"Valige kaugus peakilbi ja esimese seadme vahel:",conf_selected_solution_title:"Valitud lahendus",
      conf_total_devices_label:"Seadmeid kokku:",conf_package_label:"Pakett:",conf_estimated_cost_label:"Orienteeruv maksumus:",
      conf_submit_button_text:"Saada hinnapäring",conf_submit_loading_text:"Saadan...",
      conf_name_placeholder:"Teie nimi",conf_email_placeholder:"E-post",conf_phone_placeholder:"Telefon",conf_message_placeholder:"Lisainfo...",
      how_it_works_title:"Kuidas <span class='hero-accent'>Wexa töötab</span>?",how_it_works_accent:"WEXA töötab",
      how_step1_h:"Paigaldamine",how_step1_p:"Paigaldame süsteemi teie parklasse läbimõeldult ja efektiivselt.",
      how_step2_h:"Seadistamine",how_step2_p:"Seadistame süsteemi vastavalt teie maja võimsusele ja vajadustele.",
      how_step3_h:"Kasutamine",how_step3_p:"Laadimine toimub mobiiliäpi kaudu ning kulud registreeritakse automaatselt.",
      how_step4_h:"Haldamine",how_step4_p:"Korteriühistu lisab kulud kommunaalarvetele, kasutajad näevad kogu ülevaadet läbi mobiiliäpi.",
      load_management_title:"Koormuse <span class='hero-accent'>juhtimine</span>",load_management_accent:"juhtimine",
      wexa_system_description:"WEXA süsteem jälgib elektritarbimist reaalajas ja jaotab koormused automaatselt, et:",
      load_point1:"vältida ülekoormust ja elektrisüsteemi kahjustusi",load_point2:"tagada seadmete turvalise ja tõhusa kasutamise",load_point3:"lihtsustada energiakasutuse planeerimist",
      facts_numbers_title:"Faktid ja <span class='hero-accent'>numbrid</span>",facts_numbers_accent:"numbrid",
      wexa_necessity_text:"Miks WEXA lahendus on Eestis vajalik?",
      apartment_dwellers_stat_text:"Eesti elanikest elab korterelamutes",ev_count_estonia_text:"elektriautot Eestis",
      ev_growth_2024_2025_text:"elektriautode kasv 2024-2025",apartment_solution_needed_text:"kortermaja vajab lahendust",
      contact_section_title:"Võta <span class='hero-accent'>ühendust</span>",contact_section_accent:"ühendust",
      contact_subtitle:"Küsi lisainfot või broneeri kohtumine",contact_email_label:"E-mail",contact_phone_label:"Telefon",contact_address_label:"Aadress",
      why_eyebrow:"Probleem",solution_eyebrow:"WEXA lahendus",how_eyebrow:"Protsess",load_eyebrow:"Tehniline eelis",facts_eyebrow:"Andmed",
      calculator_eyebrow:"Kalkulaator",configurator_eyebrow:"Hinnapäring",contact_eyebrow:"Kontakt",
      currency_per_month:"€/kuu",ice_cost_per_month:"€/kuu",months:"kuud",footer_phone:"+372 5866 6199",
      footer_copyright:"© 2026 Wexa Technologies OÜ. Kõik õigused kaitstud.",footer_quote:"\"Lihtsus on ülim keerukus.\" – Leonardo da Vinci",
      map_title:"WEXA asukoht kaardil",conf_success_message:"✓ Päring edukalt saadetud!",conf_error_message:"Saatmine ebaõnnestus. Palun proovige uuesti.",
      gallery_img1_alt:"WEXA maas laadimisjaam parklas",
      gallery_img2_alt:"WEXA maas laadimisjaam detailvaade",
      gallery_img3_alt:"WEXA seinamoodul kortermaja parklas",
      lightbox_open:"Ava suurem foto",lightbox_close:"Sulge",lightbox_dialog:"Suurendatud foto",lightbox_prev:"Eelmine pilt",lightbox_next:"Järgmine pilt"
    },
    en: {
      nav_home:"Home",nav_solution:"Solution",nav_calculator:"ROI",nav_how:"How it works",nav_contact:"Contact",
      skip_link:"Skip to content",
      hero_badge:"New Product",hero_h1:"Smart <span class='hero-accent'>energy solution</span> for apartment buildings.",
      hero_lead:"Controlled EV charging for apartment associations—without heavy investment or complex management.",
      hero_btn:"Create your solution",hero_img_alt:"WEXA charging point in apartment building parking",hero_cta_secondary:"Calculate Profitability",
      scroll_indicator:"Scroll down",scroll_indicator_aria:"Scroll down",
      "reason-section-title":"Why standard solutions often <span class='hero-accent'>fail</span>?",
      why_card1_h:"High investments",why_card1_p:"Traditional solutions require large upfront costs and complex electrical upgrades.",
      why_card2_h:"Complex management",why_card2_p:"Accounting, invoicing, and maintenance take significant time and resources.",
      why_card3_h:"Unfair sharing",why_card3_p:"All residents pay, but only a few use it. This is not a fair solution.",
      "wexa-heading":"Safe and <span class='hero-accent'>smart</span>",
      sol_card1_h:"Steel Housing",sol_card1_p:"The entire system is safe in a cabinet. Simple 230V/400V connection for any building.",
      sol_card2_h:"App Control",sol_card2_p:"Residents use the system via mobile app with automatic consumption tracking.",
      sol_card3_h:"Transparent & Fair",sol_card3_p:"Energy use is calculated precisely per apartment. All costs appear transparently on utility bills.",
      sol_card4_h:"Real-time Monitoring",sol_card4_p:"System monitors load automatically, allowing the association to plan energy use.",
      "roi-calculator-title":"Quick <span class='hero-accent'>Payback Calculator</span>",
      calc_input_h:"Input Data",calc_label_autos:"Number of EVs in building",calc_label_km:"Monthly mileage per car (km)",
      calc_label_ev_eff:"EV efficiency (kWh/100km)",calc_label_el_price:"Electricity price (€/kWh)",
      calc_label_ice_eff:"Old car fuel consumption (L/100km)",calc_label_fuel_price:"Fuel price (€/L)",
      calc_res_h:"Results & Comparison",calc_ev_cost_title:"EV CONSUMPTION COST",calc_ice_cost_title:"CAR CONSUMPTION COST",
      calc_save_auto:"Savings per car/month:",calc_save_ky:"Total monthly savings:",
      calc_invest:"Investment from:",calc_payback_label:"Estimated payback period",calc_no_savings_text:"No payback",
      conf_title:"Build your <span class='hero-accent'>solution</span>",conf_accent:"solution",
      house_equipment_title:"Building & Equipment Info",installation_address_label:"Installation address",
      installation_address_placeholder:"Street, house, city",conf_main_fuse_label:"Main fuse (A)",
      installation_package_title:"Installation Package",conf_unit_price_label:"Unit price",conf_base_label:"Base price",
      conf_item_1_name:"2 Charging Ports ( 1-p + 1-p )",conf_item_2_name:"2 Charging Ports ( 1-p + 3-p )",conf_item_3_name:"2 Charging Ports ( 3-p + 3-p )",
      conf_package_1_name:"Short (0-20 m)",conf_package_2_name:"Medium (20-40 m)",conf_package_3_name:"Long (40 m+)",
      distance_selection_text:"Select distance between main panel and first device:",conf_selected_solution_title:"Selected Solution",
      conf_total_devices_label:"Total devices:",conf_package_label:"Package:",conf_estimated_cost_label:"Estimated cost:",
      conf_submit_button_text:"Send request",conf_submit_loading_text:"Sending...",
      conf_name_placeholder:"Your name",conf_email_placeholder:"E-mail",conf_phone_placeholder:"Phone",conf_message_placeholder:"Additional info...",
      how_it_works_title:"How <span class='hero-accent'>Wexa works</span>?",how_it_works_accent:"WEXA works",
      how_step1_h:"Installation",how_step1_p:"We install the system in your parking area thoughtfully and efficiently.",
      how_step2_h:"Setup",how_step2_p:"We configure the system according to your building's power capacity.",
      how_step3_h:"Usage",how_step3_p:"Charging happens via mobile app and costs are logged automatically.",
      how_step4_h:"Management",how_step4_p:"The association adds costs to utility bills; users see the full overview in the mobile app.",
      load_management_title:"Load <span class='hero-accent'>Management</span>",load_management_accent:"management",
      wexa_system_description:"WEXA system monitors electricity consumption in real time and automatically distributes loads to:",
      load_point1:"avoid overload and electrical system damage",load_point2:"ensure safe and efficient equipment use",load_point3:"simplify energy usage planning",
      facts_numbers_title:"Facts and <span class='hero-accent'>figures</span>",facts_numbers_accent:"figures",
      wexa_necessity_text:"Why WEXA is necessary in Estonia?",
      apartment_dwellers_stat_text:"of Estonians live in apartment buildings",ev_count_estonia_text:"electric cars in Estonia",
      ev_growth_2024_2025_text:"EV growth 2024-2025",apartment_solution_needed_text:"apartment buildings need a solution",
      contact_section_title:"Get in <span class='hero-accent'>touch</span>",contact_section_accent:"touch",
      contact_subtitle:"Ask for info or book a meeting",contact_email_label:"E-mail",contact_phone_label:"Phone",contact_address_label:"Address",
      why_eyebrow:"Problem",solution_eyebrow:"WEXA Solution",how_eyebrow:"Process",load_eyebrow:"Technical Advantage",facts_eyebrow:"Data",
      calculator_eyebrow:"Calculator",configurator_eyebrow:"Price request",contact_eyebrow:"Contact",
      currency_per_month:"€/month",ice_cost_per_month:"€/month",months:"months",footer_phone:"+372 5866 6199",
      footer_copyright:"© 2026 Wexa Technologies OÜ. All rights reserved.",footer_quote:"\"Simplicity is the ultimate sophistication.\" – Leonardo da Vinci",
      map_title:"WEXA location on map",conf_success_message:"✓ Request sent successfully!",conf_error_message:"Sending failed. Please try again.",
      gallery_img1_alt:"WEXA ground charging station in a parking lot",
      gallery_img2_alt:"WEXA ground charging station close-up",
      gallery_img3_alt:"WEXA wall charging module in an apartment building parking lot",
      lightbox_open:"Open larger photo",lightbox_close:"Close",lightbox_dialog:"Enlarged photo",lightbox_prev:"Previous image",lightbox_next:"Next image"
    },
    ru: {
      nav_home:"Главная",nav_solution:"Решение",nav_calculator:"Окупаемость",nav_how:"Как работает",nav_contact:"Контакт",
      skip_link:"Перейти к содержимому",
      hero_badge:"Новое решение",hero_h1:"Умное <span class='hero-accent'>энергорешение</span> для квартирных домов.",
      hero_lead:"Контролируемая зарядка электромобилей для товариществ — без крупных инвестиций и сложного управления.",
      hero_btn:"Создать своё решение",hero_img_alt:"Зарядная точка WEXA на парковке многоквартирного дома",hero_cta_secondary:"Рассчитать окупаемость",
      scroll_indicator:"Прокрутите вниз",scroll_indicator_aria:"Прокрутите вниз",
      "reason-section-title":"Почему обычные решения часто <span class='hero-accent'>не работают</span>?",
      why_card1_h:"Большие инвестиции",why_card1_p:"Традиционные решения требуют огромных вложений и сложной переделки электросетей.",
      why_card2_h:"Сложное управление",why_card2_p:"Учет зарядок, выставление счетов и обслуживание отнимают много времени.",
      why_card3_h:"Несправедливое распределение",why_card3_p:"Платят все жильцы, а пользуются единицы. Это несправедливо.",
      "wexa-heading":"Безопасное и <span class='hero-accent'>умное</span>",
      sol_card1_h:"Стальной корпус",sol_card1_p:"Вся система спрятана в шкафу. Простое подключение 230В/400В.",
      sol_card2_h:"Управление через приложение",sol_card2_p:"Жильцы используют мобильное приложение для автоматического учета.",
      sol_card3_h:"Прозрачно и справедливо",sol_card3_p:"Потребление считается поквартирно и прозрачно отражается в счетах.",
      sol_card4_h:"Отслеживание в реальном времени",sol_card4_p:"Система следит за нагрузкой, помогая планировать использование энергии.",
      "roi-calculator-title":"Калькулятор <span class='hero-accent'>окупаемости</span>",
      calc_input_h:"Вводные данные",calc_label_autos:"Кол-во электромобилей",calc_label_km:"Пробег 1 машины в месяц (км)",
      calc_label_ev_eff:"Расход электромобиля (кВтч/100км)",calc_label_el_price:"Цена электричества (€/кВтч)",
      calc_label_ice_eff:"Расход топлива старой машины (л/100км)",calc_label_fuel_price:"Цена топлива (€/л)",
      calc_res_h:"Результаты и сравнение",calc_ev_cost_title:"РАСХОД ЭЛЕКТРОМОБИЛЯ",calc_ice_cost_title:"РАСХОД АВТОМОБИЛЯ",
      calc_save_auto:"Экономия 1 машины в месяц:",calc_save_ky:"Общая экономия дома в месяц:",
      calc_invest:"Инвестиция от:",calc_payback_label:"Примерный срок окупаемости",calc_no_savings_text:"Окупаемости нет",
      conf_title:"Создайте своё <span class='hero-accent'>решение</span>",conf_accent:"решение",
      house_equipment_title:"Данные дома и устройств",installation_address_label:"Адрес установки",
      installation_address_placeholder:"Улица, дом, город",conf_main_fuse_label:"Главный предохранитель (А)",
      installation_package_title:"Пакет установки",conf_unit_price_label:"Цена за единицу",conf_base_label:"Базовая цена",
      conf_item_1_name:"2 розетки ( 1-ф + 1-ф )",conf_item_2_name:"2 розетки ( 1-ф + 3-ф )",conf_item_3_name:"2 розетки ( 3-ф + 3-ф )",
      conf_package_1_name:"Короткий (0-20 м)",conf_package_2_name:"Средний (20-40 м)",conf_package_3_name:"Длинный (40 м+)",
      distance_selection_text:"Выберите расстояние от щита до устройства:",conf_selected_solution_title:"Выбранное решение",
      conf_total_devices_label:"Всего устройств:",conf_package_label:"Пакет:",conf_estimated_cost_label:"Ориентировочная стоимость:",
      conf_submit_button_text:"Отправить запрос",conf_submit_loading_text:"Отправка...",
      conf_name_placeholder:"Ваше имя",conf_email_placeholder:"Эл. почта",conf_phone_placeholder:"Телефон",conf_message_placeholder:"Дополнительная информация...",
      how_it_works_title:"Как <span class='hero-accent'>работает Wexa</span>?",how_it_works_accent:"работает WEXA",
      how_step1_h:"Установка",how_step1_p:"Установим нашу систему на парковке продумано и эффективно.",
      how_step2_h:"Настройка",how_step2_p:"Настроим систему под мощности и нужды вашего дома.",
      how_step3_h:"Использование",how_step3_p:"Зарядка происходит через приложение, а расходы регистрируются автоматически.",
      how_step4_h:"Управление",how_step4_p:"Товарищество добавляет расходы в счета, а пользователи видят полную сводку в мобильном приложении.",
      load_management_title:"Управление <span class='hero-accent'>нагрузкой</span>",load_management_accent:"нагрузкой",
      wexa_system_description:"Система WEXA следит за потреблением в реальном времени и автоматически распределяет нагрузку, чтобы:",
      load_point1:"избежать перегрузок и повреждения электросети",load_point2:"обеспечить безопасную и эффективную работу оборудования",load_point3:"упростить планирование энергопотребления",
      facts_numbers_title:"Факты и <span class='hero-accent'>цифры</span>",facts_numbers_accent:"цифры",
      wexa_necessity_text:"Почему решение WEXA необходимо в Эстонии?",
      apartment_dwellers_stat_text:"жителей Эстонии живут в квартирных домах",ev_count_estonia_text:"электромобилей в Эстонии",
      ev_growth_2024_2025_text:"рост электромобилей 2024-2025",apartment_solution_needed_text:"квартирных домов нуждаются в решении",
      contact_section_title:"Свяжитесь <span class='hero-accent'>с нами</span>",contact_section_accent:"с нами",
      contact_subtitle:"Запросите информацию или забронируйте встречу",contact_email_label:"Электронная почта",contact_phone_label:"Телефон",contact_address_label:"Адрес",
      why_eyebrow:"Проблема",solution_eyebrow:"Решение WEXA",how_eyebrow:"Процесс",load_eyebrow:"Техническое преимущество",facts_eyebrow:"Данные",
      calculator_eyebrow:"Калькулятор",configurator_eyebrow:"Ценовое предложение",contact_eyebrow:"Контакт",
      currency_per_month:"€/месяц",ice_cost_per_month:"€/месяц",months:"месяцев",footer_phone:"+372 5866 6199",
      footer_copyright:"© 2026 Wexa Technologies OÜ. Все права защищены.",footer_quote:"\"Простота — высшая степень сложности.\" – Леонардо да Винчи",
      map_title:"Расположение WEXA на карте",conf_success_message:"✓ Запрос успешно отправлен!",conf_error_message:"Не удалось отправить. Пожалуйста, попробуйте ещё раз.",
      gallery_img1_alt:"Наземная зарядная станция WEXA на парковке",
      gallery_img2_alt:"Детальный вид наземной зарядной станции WEXA",
      gallery_img3_alt:"Настенный модуль WEXA на парковке квартирного дома",
      lightbox_open:"Открыть увеличенное фото",lightbox_close:"Закрыть",lightbox_dialog:"Увеличенное фото",lightbox_prev:"Предыдущее изображение",lightbox_next:"Следующее изображение"
    }
  };

  // Boot calculator after i18n exists (calculate reads i18n)
  if (typeof calculate === 'function') calculate();

  // ── LANGUAGE SWITCHER ─────────────────────────────────────────────────────
  const langBtns    = document.querySelectorAll('.lang-btn');
  const mainContent = document.querySelector('main');
  let langSwitching = false;

  function waitMs(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function prefersReducedLangMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

function updateLanguage(lang) {
  document.documentElement.lang = lang;
  const strip = (html) => html.replace(/<[^>]+>/g, '');

  document.querySelectorAll('[data-key]').forEach(el => {
    const v = i18n[lang]?.[el.getAttribute('data-key')];
    if (v === undefined) return;
    if (el.matches('iframe, img, input, textarea')) {
      if (el.hasAttribute('title')) el.setAttribute('title', strip(v));
      if (el.hasAttribute('alt')) el.setAttribute('alt', strip(v));
      if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', strip(v));
      return;
    }
    if (v.includes('<')) el.innerHTML = v;
    else el.textContent = v;
  });
    document.querySelectorAll('[data-placeholder-key]').forEach(el => {
      const v = i18n[lang]?.[el.getAttribute('data-placeholder-key')];
      if (v !== undefined) el.setAttribute('placeholder', v);
    });
    document.querySelectorAll('[data-aria-key]').forEach(el => {
      const v = i18n[lang]?.[el.getAttribute('data-aria-key')];
      if (v !== undefined) el.setAttribute('aria-label', strip(v));
    });
    window.dispatchEvent(new CustomEvent('language-changed', { detail: lang }));
    if (typeof calculate === 'function') calculate();
  }

  async function switchLanguage(lang) {
    if (langSwitching) return;
    langSwitching = true;

    const ph = document.getElementById('phone-link');
    const reduced = prefersReducedLangMotion();

    try {
      if (!mainContent || reduced) {
        updateLanguage(lang);
        if (ph) ph.href = 'tel:+37258666199';
        return;
      }

      mainContent.classList.add('lang-switching');
      await waitMs(380);

      updateLanguage(lang);
      if (ph) ph.href = 'tel:+37258666199';

      // Let the browser paint swapped copy while still hidden, then fade in
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      mainContent.classList.remove('lang-switching');
      await waitMs(380);
    } finally {
      langSwitching = false;
    }
  }

  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active') || langSwitching) return;
      const lang = btn.dataset.lang;

      document.querySelector('.lang-btn.active')?.classList.remove('active');
      document.querySelectorAll('.lang-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');

      switchLanguage(lang);
    });
  });

// ── BACK TO TOP LOGIC ───────────────────────────────────────────────────
const backToTopBtn = document.getElementById('backToTop');

if (backToTopBtn) {
  const SHOW_AFTER = 400;
  const HIDE_BELOW = 80; // stay visible until near the top, then slow fade

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > SHOW_AFTER) {
      backToTopBtn.classList.add('visible');
    } else if (y < HIDE_BELOW) {
      backToTopBtn.classList.remove('visible');
    }
  }, { passive: true });

  backToTopBtn.addEventListener('click', (e) => {
    e.preventDefault();
    smoothScrollTo(0);
  });
}

// ── PROMO IMAGE LIGHTBOX ──────────────────────────────────────────────────
(function () {
  const lightbox = document.getElementById('promo-lightbox');
  const lightboxImg = lightbox?.querySelector('.promo-lightbox__image');
  const gallery = document.querySelector('.promo-images-container');
  const triggers = document.querySelectorAll('.promo-img-btn[data-full-src]');

  if (!triggers.length) return;

  // Pop in / out on scroll
  if (
    gallery &&
    'IntersectionObserver' in window &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    gallery.setAttribute('data-animate', '');
    const tiles = gallery.querySelectorAll('.promo-img-btn');
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-inview');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -4% 0px' }
    );
    tiles.forEach(tile => io.observe(tile));
  } else {
    triggers.forEach(btn => btn.classList.add('is-inview'));
  }

  if (!lightbox || !lightboxImg) return;

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt;
    lightbox.showModal();
  }

  function closeLightbox() {
    if (lightbox.open) lightbox.close();
  }

  triggers.forEach(btn => {
    btn.addEventListener('click', () => {
      const img = btn.querySelector('img');
      openLightbox(btn.dataset.fullSrc, img?.alt || '');
    });
  });

  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  lightbox.querySelector('.promo-lightbox__close')?.addEventListener('click', closeLightbox);

  lightboxImg.addEventListener('click', e => e.stopPropagation());

  lightbox.addEventListener('close', () => {
    lightboxImg.removeAttribute('src');
    lightboxImg.alt = '';
  });
})();