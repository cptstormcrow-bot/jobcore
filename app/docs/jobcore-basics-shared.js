/**
 * jobcore-basics-shared.js
 * Self-contained vanilla-JS shared behavior for the JobCore Basics manual.
 * No external dependencies, no CDNs. Provides:
 *   1. A baked-in cross-fragment search index (SEARCH_INDEX).
 *   2. Active-section highlighting via IntersectionObserver.
 *   3. A search-box substring filter over the index, rendering result links.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // 1. Baked-in search index
  // ---------------------------------------------------------------------
  var SEARCH_INDEX = [
    // front-matter.html -> jobcore-basics-front-matter.html
    { id: 'title-page-heading', text: 'JobCore Basics', page: 'jobcore-basics-front-matter.html' },
    { id: 'how-to-use-this-manual', text: 'How to Use This Manual', page: 'jobcore-basics-front-matter.html' },
    { id: 'badge-legend', text: 'Badge System', page: 'jobcore-basics-front-matter.html' },

    // ch1.html -> jobcore-basics-front-matter.html
    { id: 'ch1-heading', text: 'Chapter 1 — What Is JobCore?', page: 'jobcore-basics-front-matter.html' },
    { id: 'the-module-contract', text: 'The JobcoreModule Contract', page: 'jobcore-basics-front-matter.html' },
    { id: 'why-compile-time-only', text: 'Why Modules Are Compile-Time-Only', page: 'jobcore-basics-front-matter.html' },
    { id: 'the-four-modules', text: 'The Four Modules', page: 'jobcore-basics-front-matter.html' },
    { id: 'two-axis-gating', text: 'Two Independent Gating Axes', page: 'jobcore-basics-front-matter.html' },
    { id: 'axis-1-compile-time-registration', text: 'Axis 1 — Compile-Time Registration', page: 'jobcore-basics-front-matter.html' },
    { id: 'axis-2-runtime-enablement', text: 'Axis 2 — Runtime Per-Org Enablement', page: 'jobcore-basics-front-matter.html' },

    // ch2.html -> jobcore-basics-front-matter.html
    { id: 'ch2-title', text: 'Chapter 2 — The Job Lifecycle & Platform Foundations', page: 'jobcore-basics-front-matter.html' },
    { id: 'ch2-spine', text: 'The Job Spine', page: 'jobcore-basics-front-matter.html' },
    { id: 'ch2-states', text: 'The States, in Lifecycle Order', page: 'jobcore-basics-front-matter.html' },
    { id: 'state-new', text: 'New', page: 'jobcore-basics-front-matter.html' },
    { id: 'state-qualified', text: 'Qualified', page: 'jobcore-basics-front-matter.html' },
    { id: 'state-scheduled', text: 'Scheduled', page: 'jobcore-basics-front-matter.html' },
    { id: 'state-assigned', text: 'Assigned', page: 'jobcore-basics-front-matter.html' },
    { id: 'state-accepted', text: 'Accepted', page: 'jobcore-basics-front-matter.html' },
    { id: 'state-completed', text: 'Completed', page: 'jobcore-basics-front-matter.html' },
    { id: 'state-paid', text: 'Paid', page: 'jobcore-basics-front-matter.html' },
    { id: 'state-closed', text: 'Closed', page: 'jobcore-basics-front-matter.html' },
    { id: 'state-declined', text: 'Declined', page: 'jobcore-basics-front-matter.html' },
    { id: 'state-cancelled', text: 'Cancelled', page: 'jobcore-basics-front-matter.html' },
    { id: 'ch2-transitions-table', text: 'The TRANSITIONS Table', page: 'jobcore-basics-front-matter.html' },
    { id: 'ch2-role-gating', text: 'Role Gating: OFFICE vs. FIELD', page: 'jobcore-basics-front-matter.html' },
    { id: 'ch2-preconditions', text: 'The Three Preconditions', page: 'jobcore-basics-front-matter.html' },
    { id: 'ch2-cancellation-window', text: 'Cancellation Window Closes at en_route', page: 'jobcore-basics-front-matter.html' },
    { id: 'ch2-payroll-stamping', text: 'Device-Clock Payroll Stamping', page: 'jobcore-basics-front-matter.html' },
    { id: 'ch2-audit-log', text: 'Audit Log and the metadata Workaround', page: 'jobcore-basics-front-matter.html' },
    { id: 'ch2-rls', text: 'Platform Foundation: Tenant Isolation (RLS) Hardening', page: 'jobcore-basics-front-matter.html' },
    { id: 'ch2-rls-suite', text: 'RLS Test Suite', page: 'jobcore-basics-front-matter.html' },
    { id: 'ch2-rls-fixes', text: 'RLS Fixes', page: 'jobcore-basics-front-matter.html' },
    { id: 'ch2-rls-acrv2', text: 'ACR v2', page: 'jobcore-basics-front-matter.html' },
    { id: 'ch2-rls-reverified', text: 'RLS Reverified', page: 'jobcore-basics-front-matter.html' },

    // ch3.html -> jobcore-basics-admin-finance.html
    { id: 'ch3-title', text: 'Chapter 3 — Admin & Finance', page: 'jobcore-basics-admin-finance.html' },
    { id: 'ch3-what-is-wired', text: 'What Is Actually Wired', page: 'jobcore-basics-admin-finance.html' },
    { id: 'ch3-admin-typical-day', text: "Admin's Typical Day", page: 'jobcore-basics-admin-finance.html' },
    { id: 'ch3-accountant-typical-day', text: "Accountant's Typical Day", page: 'jobcore-basics-admin-finance.html' },
    { id: 'ch3-honesty-summary', text: 'Honesty Summary', page: 'jobcore-basics-admin-finance.html' },

    // ch4.html -> jobcore-basics-field-tech.html
    { id: 'ch4-title', text: 'Chapter 4 — Field Tech', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-typical-day', text: 'A Typical Day — Service Technician', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-day-daylist', text: 'Day List', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-day-greeting', text: 'Greeting', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-day-onmyway', text: 'On My Way', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-day-start', text: 'Start', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-day-jobdetail', text: 'Job Detail', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-day-completion', text: 'Completion', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-payment-collection', text: 'Collecting Payment from the Homeowner', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-payment-handoff', text: 'Payment Handoff', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-payment-satisfaction-gate', text: 'Satisfaction Gate', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-payment-methods', text: 'Payment Methods', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-payment-mark-paid-gap', text: 'Mark Paid Gap', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-payment-closing', text: 'Closing', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-day-earnings', text: 'End of Day: Earnings', page: 'jobcore-basics-field-tech.html' },
    { id: 'ch4-8hour-note', text: 'The 8-Hour-Day Efficiency Note', page: 'jobcore-basics-field-tech.html' },

    // ch5.html -> jobcore-basics-sales-payments.html
    { id: 'ch5-title', text: 'Chapter 5 — Sales & Marketing', page: 'jobcore-basics-sales-payments.html' },
    { id: 'ch5-scope-note', text: 'Scope Note', page: 'jobcore-basics-sales-payments.html' },
    { id: 'ch5-typical-day', text: 'Typical Day', page: 'jobcore-basics-sales-payments.html' },
    { id: 'ch5-day-review-library', text: 'Review Library', page: 'jobcore-basics-sales-payments.html' },
    { id: 'ch5-day-pitch-picker', text: 'Pitch Picker', page: 'jobcore-basics-sales-payments.html' },
    { id: 'ch5-day-composer', text: 'Composer', page: 'jobcore-basics-sales-payments.html' },
    { id: 'ch5-day-reporting', text: 'Reporting', page: 'jobcore-basics-sales-payments.html' },
    { id: 'ch5-provider-extensibility', text: 'Provider Extensibility', page: 'jobcore-basics-sales-payments.html' },
    { id: 'ch5-token-storage', text: 'Token Storage', page: 'jobcore-basics-sales-payments.html' },

    // ch6.html -> jobcore-basics-sales-payments.html
    { id: 'ch6-title', text: 'Chapter 6 — Payment & Review', page: 'jobcore-basics-sales-payments.html' },
    { id: 'ch6-what-it-contains', text: 'What It Contains', page: 'jobcore-basics-sales-payments.html' },
    { id: 'ch6-honest-status', text: 'Honest Status', page: 'jobcore-basics-sales-payments.html' },

    // ch7.html -> jobcore-basics-appendices.html
    { id: 'ch7-title', text: 'Chapter 7 — Design System, Security Posture & Roadmap', page: 'jobcore-basics-appendices.html' },
    { id: 'ch7-token-reference', text: 'Token Reference', page: 'jobcore-basics-appendices.html' },
    { id: 'ch7-token-colors', text: 'Colors', page: 'jobcore-basics-appendices.html' },
    { id: 'ch7-token-typography', text: 'Typography', page: 'jobcore-basics-appendices.html' },
    { id: 'ch7-token-spacing', text: 'Spacing', page: 'jobcore-basics-appendices.html' },
    { id: 'ch7-token-radius', text: 'Radius', page: 'jobcore-basics-appendices.html' },
    { id: 'ch7-token-shadow', text: 'Shadow', page: 'jobcore-basics-appendices.html' },
    { id: 'ch7-badge-legend', text: 'Badge Legend', page: 'jobcore-basics-appendices.html' },
    { id: 'ch7-rls-hardening', text: 'RLS Hardening', page: 'jobcore-basics-appendices.html' },
    { id: 'ch7-roadmap', text: 'Roadmap', page: 'jobcore-basics-appendices.html' },

    // appendices.html -> jobcore-basics-appendices.html
    { id: 'appendices-title', text: 'Appendices', page: 'jobcore-basics-appendices.html' },
    { id: 'appendix-a-platform-notes', text: 'Appendix A — Platform Notes', page: 'jobcore-basics-appendices.html' },
    { id: 'appendix-b-handoff-deep-links', text: 'Appendix B — Handoff Deep Links', page: 'jobcore-basics-appendices.html' },
    { id: 'appendix-b-awaiting-payment-screen', text: 'Appendix B — Awaiting Payment Screen', page: 'jobcore-basics-appendices.html' },
    { id: 'appendix-c-component-reference', text: 'Appendix C — Component Reference', page: 'jobcore-basics-appendices.html' },
    { id: 'appendix-c-footnote-barrel-export', text: 'Appendix C — Footnote / Barrel Export', page: 'jobcore-basics-appendices.html' }
  ];

  // ---------------------------------------------------------------------
  // 2. Active-section highlighting via IntersectionObserver
  // ---------------------------------------------------------------------
  function initActiveSectionHighlighting() {
    var headings = Array.prototype.slice.call(
      document.querySelectorAll('[id]')
    ).filter(function (el) {
      return /^H[1-6]$/.test(el.tagName);
    });

    if (!headings.length || typeof IntersectionObserver === 'undefined') {
      return;
    }

    var navLinks = Array.prototype.slice.call(
      document.querySelectorAll('nav a[href*="#"], .toc a[href*="#"]')
    );

    function setActive(id) {
      navLinks.forEach(function (link) {
        var hash = link.getAttribute('href').split('#')[1];
        if (hash === id) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -70% 0px',
        threshold: 0
      }
    );

    headings.forEach(function (heading) {
      observer.observe(heading);
    });
  }

  // ---------------------------------------------------------------------
  // 3. Search-box substring filter over SEARCH_INDEX
  // ---------------------------------------------------------------------
  function initSearchBox() {
    var input = document.getElementById('jobcore-search-input');
    var results = document.getElementById('jobcore-search-results');

    if (!input || !results) {
      return;
    }

    function render(query) {
      results.innerHTML = '';

      var trimmed = query.trim().toLowerCase();
      if (!trimmed) {
        results.hidden = true;
        return;
      }

      var matches = SEARCH_INDEX.filter(function (entry) {
        return entry.text.toLowerCase().indexOf(trimmed) !== -1;
      });

      if (!matches.length) {
        var empty = document.createElement('li');
        empty.className = 'jobcore-search-empty';
        empty.textContent = 'No results.';
        results.appendChild(empty);
        results.hidden = false;
        return;
      }

      matches.forEach(function (entry) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = entry.page + '#' + entry.id;
        a.textContent = entry.text;
        li.appendChild(a);
        results.appendChild(li);
      });

      results.hidden = false;
    }

    input.addEventListener('input', function () {
      render(input.value);
    });
  }

  // ---------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------
  function init() {
    initActiveSectionHighlighting();
    initSearchBox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose index for debugging / potential reuse by other scripts.
  window.JOBCORE_BASICS_SEARCH_INDEX = SEARCH_INDEX;
})();
