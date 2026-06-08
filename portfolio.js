/* =========================================================================
   Shreyas Achary — Portfolio interactions
   Vanilla JS. IntersectionObserver with a scroll/load fallback so nothing
   can ever stay invisible in an embedded iframe.
   ========================================================================= */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";

  /* ---------- THEME (shared with tweaks panel) ------------------------- */
  const root = document.documentElement;
  window.__applyTheme = function (theme) {
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem("sa_theme", theme); } catch (e) {}
    window.dispatchEvent(new CustomEvent("sa-theme", { detail: theme }));
  };
  (function initTheme() {
    let t;
    try { t = localStorage.getItem("sa_theme"); } catch (e) {}
    if (t) root.setAttribute("data-theme", t);
  })();
  const themeBtn = $("#themeToggle");
  if (themeBtn) themeBtn.addEventListener("click", () => {
    window.__applyTheme(root.getAttribute("data-theme") === "light" ? "dark" : "light");
  });

  /* ---------- NAV ------------------------------------------------------ */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 12);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });

  const burger = $("#burger"), navLinks = $("#navLinks");
  if (burger) burger.addEventListener("click", () => navLinks.classList.toggle("open"));
  $$("#navLinks a").forEach((a) => a.addEventListener("click", () => navLinks.classList.remove("open")));

  // active link via scroll spy (rect-based, robust)
  const linkMap = {};
  $$("#navLinks a").forEach((a) => { linkMap[a.getAttribute("href").slice(1)] = a; });
  const spySections = ["work", "skills", "experience", "contact"].map((id) => document.getElementById(id)).filter(Boolean);
  function updateSpy() {
    const vh = window.innerHeight, mid = vh * 0.42;
    let current = null;
    for (const s of spySections) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) current = s.id;
    }
    $$("#navLinks a").forEach((a) => a.classList.remove("active"));
    if (current && linkMap[current]) linkMap[current].classList.add("active");
  }
  addEventListener("scroll", () => requestAnimationFrame(updateSpy), { passive: true });

  /* ---- enable scroll-reveal animations (FOUC-safe: content is visible
     by default; this opts into the hidden->shown transition) ---- */
  root.classList.add("anim-ready");

  /* ---------- REVEAL (IO + fallback) ----------------------------------- */
  let revObs = null;
  if ("IntersectionObserver" in window) {
    revObs = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revObs.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -7% 0px", threshold: 0.04 });
  }
  function observeReveals() {
    $$(".reveal:not(.in)").forEach((el) => { if (revObs) revObs.observe(el); else el.classList.add("in"); });
  }
  // fallback: reveal anything already within the viewport
  function revealInView() {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    $$(".reveal:not(.in)").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.96 && r.bottom > 0) el.classList.add("in");
    });
  }
  observeReveals();
  revealInView();
  addEventListener("load", () => { observeReveals(); revealInView(); updateSpy(); });
  addEventListener("scroll", revealInView, { passive: true });
  // hard safety net — guarantee nothing stays hidden in any embed
  setTimeout(revealInView, 600);
  setTimeout(() => { root.classList.add("reveal-all"); }, 1900);

  /* ---------- COUNTERS ------------------------------------------------- */
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const suffix = el.dataset.suffix || "";
    const thousands = el.dataset.thousands === "1";
    const dur = reduce ? 0 : 1300;
    const start = performance.now();
    const fmt = (v) => {
      let s = decimals ? v.toFixed(decimals) : Math.round(v).toString();
      if (thousands) s = Number(Math.round(v)).toLocaleString("en-US");
      return s + suffix;
    };
    if (reduce) { el.textContent = fmt(target); return; }
    (function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }
  function armCounters() {
    if (!("IntersectionObserver" in window)) { $$("[data-count]").forEach(animateCount); return; }
    const obs = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) { animateCount(e.target); obs.unobserve(e.target); } });
    }, { threshold: 0.5 });
    $$("[data-count]").forEach((el) => obs.observe(el));
  }
  armCounters();

  /* ---------- PROFICIENCY BARS ---------------------------------------- */
  function armBars() {
    const fills = $$(".profic .fill");
    const grow = (f) => { f.style.width = f.dataset.w + "%"; };
    if (!("IntersectionObserver" in window)) { fills.forEach(grow); return; }
    const obs = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) { grow(e.target); obs.unobserve(e.target); } });
    }, { threshold: 0.35 });
    fills.forEach((f) => obs.observe(f));
  }
  armBars();

  /* ---------- SPARKLINES ---------------------------------------------- */
  $$("[data-spark]").forEach((svg) => {
    const pts = svg.dataset.spark.trim().split(/\s+/).map((p) => p.split(",").map(Number));
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  });

  /* ---------- HERO LINE CHART (predicted vs actual) -------------------- */
  (function buildLineChart() {
    const svg = $("#heroLine");
    if (!svg) return;
    svg.innerHTML = "";
    const W = 320, H = 132, padX = 6, padY = 14;
    const actual    = [40, 44, 41, 52, 48, 60, 57, 66, 63, 72, 75, 82];
    const predicted = [42, 43, 45, 50, 51, 58, 60, 64, 67, 71, 77, 80];
    const n = actual.length;
    const max = Math.max(...actual, ...predicted) + 6, min = Math.min(...actual, ...predicted) - 6;
    const x = (i) => padX + (i / (n - 1)) * (W - padX * 2);
    const y = (v) => padY + (1 - (v - min) / (max - min)) * (H - padY * 2);
    const g = document.createElementNS(NS, "g"); g.setAttribute("class", "grid");
    for (let i = 0; i < 4; i++) {
      const yy = padY + (i / 3) * (H - padY * 2);
      const ln = document.createElementNS(NS, "line");
      ln.setAttribute("x1", padX); ln.setAttribute("x2", W - padX);
      ln.setAttribute("y1", yy); ln.setAttribute("y2", yy);
      g.appendChild(ln);
    }
    svg.appendChild(g);
    const line = (data) => data.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    const area = document.createElementNS(NS, "path");
    area.setAttribute("class", "area");
    area.setAttribute("d", line(predicted) + ` L ${x(n - 1).toFixed(1)} ${H - padY} L ${x(0).toFixed(1)} ${H - padY} Z`);
    svg.appendChild(area);
    const pB = document.createElementNS(NS, "path"); pB.setAttribute("class", "lineB"); pB.setAttribute("d", line(actual)); svg.appendChild(pB);
    const pA = document.createElementNS(NS, "path"); pA.setAttribute("class", "lineA"); pA.setAttribute("d", line(predicted)); svg.appendChild(pA);
    if (!reduce) {
      const len = pA.getTotalLength();
      pA.style.strokeDasharray = len; pA.style.strokeDashoffset = len;
      pA.getBoundingClientRect();
      pA.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.4,.8,.3,1)";
      requestAnimationFrame(() => { pA.style.strokeDashoffset = "0"; });
    }
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("class", "dot"); dot.setAttribute("r", "3.5");
    dot.setAttribute("cx", x(n - 1)); dot.setAttribute("cy", y(predicted[n - 1]));
    svg.appendChild(dot);
  })();

  /* ---------- HERO BARS (PCA variance explained) ----------------------- */
  (function buildBars() {
    const wrap = $("#heroBars");
    if (!wrap) return;
    const data = [88, 70, 52, 40, 31, 24, 19, 15, 12, 9, 7, 5]; // decreasing — scree-like
    const max = Math.max(...data);
    data.forEach(() => wrap.appendChild(document.createElement("i")));
    const grow = () => [...wrap.children].forEach((i, k) => {
      setTimeout(() => { i.style.height = (data[k] / max) * 100 + "%"; }, reduce ? 0 : k * 50);
    });
    if (!("IntersectionObserver" in window)) { grow(); return; }
    const obs = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) { grow(); obs.unobserve(e.target); } });
    }, { threshold: 0.4 });
    obs.observe(wrap);
  })();

  /* ---------- PROJECTS DATA (real) ------------------------------------- */
  const projects = [
    {
      feat: true, kicker: "GenAI · RAG agent", num: "01",
      title: "RepoDoc AI — Auto Doc Generator",
      tools: ["Python", "LangGraph", "FAISS", "RAG", "Streamlit"],
      thumb: "streamlit · live demo",
      link: "https://auto-doc-generator.streamlit.app/",
      desc: "Point it at a GitHub repo and it returns accurate, repo-grounded documentation — via a retrieve → write → judge → revise agent with a hard citation policy.",
      impactN: "≥0.75", impactL: "quality gate per section",
      problem: "Engineers spend most of their time understanding code, not writing it, and documentation goes stale fast — slowing onboarding and creating audit risk from undocumented decisions.",
      approach: "A GitHub URL is shallow-cloned and chunked with AST extraction (module/class/function docstrings, notebook cells, selective text). Two FAISS indexes — TEXT vs CODE — feed MMR retrieval under a strict 6,000-char budget so prose sections stay readable and architecture sections can pull code. A LangGraph state machine runs retrieve → write → judge → revise, gated at score ≥ 0.75 with valid citations and no hallucination flags (max 2 retries). Every sentence ends in a repo citation or is marked inference. Output exports to Markdown and a Pandoc .docx with Mermaid diagrams.",
      results: [["≥0.75", "quality-gate score"], ["2×", "FAISS indexes (text+code)"], ["100%", "sentences source-cited"]],
      chart: "bars", chartLabel: "section quality scores"
    },
    {
      feat: false, kicker: "Power Platform · Unilever", num: "02",
      title: "Audit Collaboration & Tracking System",
      tools: ["Power Apps", "Power Automate", "SharePoint", "Power BI"],
      thumb: "power apps · canvas",
      desc: "Replaced a legacy, automation-less audit tool for Unilever across 3 APAC regions — cutting the audit cycle from 8 to 6 weeks.",
      impactN: "−25%", impactL: "audit cycle time (8→6 wks)",
      problem: "The legacy system had no automation, email, or status-update capability. Coordinating ~20 live audit projects across Indonesia, Thailand and Vietnam was manual, slow and easy to lose track of.",
      approach: "Built a Power Apps canvas app with three working areas — project creation / audit trail, document requests, and agreed actions — plus a home dashboard, on SharePoint Online as the single database. Power Automate handled status updates and email notifications, an embedded Power BI report surfaced progress, and user-based login separated auditor and auditee views.",
      results: [["8→6 wk", "audit cycle"], ["3", "APAC regions"], ["~20", "projects tracked"]],
      chart: "bars", chartLabel: "cycle time by region"
    },
    {
      feat: false, kicker: "ML · statistics", num: "03",
      title: "Wine Quality Analysis",
      tools: ["Python", "scikit-learn", "statsmodels"],
      thumb: "notebook · models",
      desc: "A statistical and ML study of 6,497 wines to find what drives quality and whether chemistry can predict the score.",
      impactN: "0.47", impactL: "Random Forest R²",
      problem: "Understand how red and white wines differ chemically, and whether 11 physicochemical indicators can reliably predict a quality rating.",
      approach: "Ran Welch's t-tests (α = 0.01) across all 11 indicators to formally test red/white differences. Fitted linear regression (R² = 0.292) and implemented AIC forward selection from scratch (stepwise OLS), which agreed on the key drivers and dropped citric acid and chlorides. A Random Forest (R² ≈ 0.47) outperformed linear models, with alcohol the top feature across all three approaches. K-means (k = 3 via elbow) and Spectral clustering confirmed natural, label-free chemical groupings.",
      results: [["6,497", "wines analysed"], ["0.47", "Random Forest R²"], ["3", "natural clusters"]],
      chart: "line", chartLabel: "predicted vs actual quality"
    },
    {
      feat: false, kicker: "Multivariate · R", num: "04",
      title: "Pressure-Sensor Analytics",
      tools: ["R", "LDA / QDA", "PCA", "PCR"],
      thumb: "R · multivariate",
      desc: "Multivariate analysis of 144-sensor pressure-mat data to classify posture, subject identity and BMI.",
      impactN: "90%", impactL: "LDA posture accuracy",
      problem: "144 sensors across 400 observations, with heavy outliers and a p ≫ n risk. Uncover posture structure, test whether it aligns with posture or subject, and predict subject ID and BMI.",
      approach: "Applied IQR capping across all 144 variables to tame outliers without discarding data. Ward's hierarchical and K-means clustering (k = 3) tested label-free structure. LDA reached 90% posture-classification accuracy; I diagnosed why full-feature QDA failed (too few per-class observations to estimate covariance) and fixed it with a 20-variable subset at 88.75%. PCA reduced 144 sensors to ~40 components retaining 90% variance, and a PCR model predicted BMI at RMSE 3.23.",
      results: [["90%", "LDA accuracy"], ["3.23", "BMI RMSE (PCR)"], ["144→40", "PCs at 90% var"]],
      chart: "bars", chartLabel: "variance explained by component"
    },
    {
      feat: false, kicker: "Power Platform · Unilever", num: "05",
      title: "Employee Onboarding Automation",
      tools: ["Power Apps", "SQL Server", "Power Automate"],
      thumb: "power apps · SQL Server",
      desc: "An end-to-end onboarding system for ~5,000 new Unilever employees — device requests, access provisioning, courses and escalation routing.",
      impactN: "5,000", impactL: "employees onboarded",
      problem: "Onboarding — ID badges, access cards, laptops, role-based requests and courses — ran on manual back-and-forth and key-person knowledge that didn't scale.",
      approach: "Built a Power Apps front end backed by SQL Server that registered each new joiner and tracked every onboarding step, with Power Automate handling automated escalation routing for the edge cases that genuinely needed a human. Under standard conditions, manual intervention dropped to near zero and the process became repeatable without depending on any one person.",
      results: [["~5,000", "employees onboarded"], ["≈0", "manual touches (standard)"], ["1", "repeatable process"]],
      chart: "bars", chartLabel: "onboarding steps automated"
    },
    {
      feat: false, kicker: "Power Platform · SQL", num: "06",
      title: "FMCG Legal Analytics Dashboard",
      tools: ["Power Apps", "SQL Server", "Power BI"],
      thumb: "power bi · embedded",
      desc: "A Power Apps + SQL Server tool tracking counterfeit-product cases for Unilever, with an embedded Power BI trends dashboard.",
      impactN: "10+", impactL: "counterfeit cases tracked",
      problem: "Legal needed live visibility into counterfeit-product cases — how many filed, how many pending, current status and case owner — without chasing updates by email.",
      approach: "Backed a Power Apps canvas app with SQL Server so cases could be filed and updated in one place, wired automated email notifications on every case-state change to keep stakeholders aligned, and embedded a Power BI dashboard surfacing legal trends and case metrics.",
      results: [["10+", "cases tracked"], ["auto", "stakeholder alerts"], ["1", "live trends view"]],
      chart: "line", chartLabel: "case status over time"
    }
  ];

  const grid = $("#projGrid");
  projects.forEach((p, idx) => {
    const art = document.createElement("article");
    art.className = "proj reveal" + (p.feat ? " feat" : "");
    if (idx % 2 === 1) art.setAttribute("data-d", "1");
    art.innerHTML = `
      <div class="card" tabindex="0" role="button" aria-label="Open case study: ${p.title}">
        <div class="thumb">
          <div class="ph"></div>
          <div class="live-mini"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 14 3-4 3 2 4-6"/></svg></i></div>
          <span class="ph-tag">${p.thumb}</span>
        </div>
        <div class="card-body">
          <div class="card-top">
            <span class="k">${p.kicker}</span>
            <span class="tools">${p.tools.slice(0, 2).map((t) => `<span>${t}</span>`).join("")}</span>
          </div>
          <h3>${p.title}</h3>
          <p class="desc">${p.desc}</p>
          <div class="card-foot">
            <span class="impact"><b>${p.impactN}</b><span>${p.impactL}</span></span>
            <span class="open">Case study <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
          </div>
        </div>
      </div>`;
    grid.appendChild(art);
    const card = art.querySelector(".card");
    card.addEventListener("click", () => openModal(p));
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(p); } });
  });
  observeReveals();
  revealInView();

  /* ---------- MODAL ---------------------------------------------------- */
  const scrim = $("#scrim"), modal = $("#modal");
  let lastFocus = null;
  function modalChartSVG(kind) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 520 150"); svg.setAttribute("preserveAspectRatio", "none");
    const W = 520, H = 150, px = 8, py = 16;
    if (kind === "bars") {
      const data = [92, 88, 80, 74, 66, 58, 50, 44, 38, 30];
      const max = Math.max(...data), bw = (W - px * 2) / data.length;
      data.forEach((v, i) => {
        const r = document.createElementNS(NS, "rect");
        const h = (v / max) * (H - py * 2);
        r.setAttribute("x", px + i * bw + bw * 0.18);
        r.setAttribute("y", H - py - h);
        r.setAttribute("width", bw * 0.64);
        r.setAttribute("height", h);
        r.setAttribute("rx", "3");
        r.setAttribute("fill", i === 0 ? "var(--accent)" : "var(--accent-line)");
        svg.appendChild(r);
      });
    } else {
      const a = [50, 56, 52, 64, 60, 72, 70, 80, 78, 88];
      const b = [52, 54, 57, 62, 64, 70, 73, 77, 82, 86];
      const max = Math.max(...a, ...b) + 6, min = Math.min(...a, ...b) - 6, n = a.length;
      const x = (i) => px + (i / (n - 1)) * (W - px * 2);
      const y = (v) => py + (1 - (v - min) / (max - min)) * (H - py * 2);
      const path = (d, stroke, dash) => {
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", d.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" "));
        p.setAttribute("fill", "none"); p.setAttribute("stroke", stroke);
        p.setAttribute("stroke-width", "2.4"); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
        if (dash) p.setAttribute("stroke-dasharray", "3 5");
        return p;
      };
      svg.appendChild(path(b, "var(--text-3)", true));
      svg.appendChild(path(a, "var(--accent)", false));
    }
    return svg;
  }
  function openModal(p) {
    lastFocus = document.activeElement;
    $("#modalKicker").textContent = p.kicker;
    $("#modalTitle").textContent = p.title;
    $("#modalTools").innerHTML = p.tools.map((t) => `<span>${t}</span>`).join("");
    const linkBtn = p.link
      ? `<a class="btn btn-primary" href="${p.link}" target="_blank" rel="noopener" style="margin-top:18px">View live demo <span class="arr">↗</span></a>`
      : "";
    const body = $("#modalBody");
    body.innerHTML = `
      <div class="modal-results">${p.results.map((r) => `<div class="r"><b>${r[0]}</b><span>${r[1]}</span></div>`).join("")}</div>
      <div class="block"><h4>The problem</h4><p>${p.problem}</p></div>
      <div class="block"><h4>What I built</h4><p>${p.approach}</p></div>
      <div class="block"><h4>${p.chartLabel || "Signal"}</h4><div class="modal-chart"></div></div>
      ${linkBtn}`;
    body.querySelector(".modal-chart").appendChild(modalChartSVG(p.chart));
    body.scrollTop = 0;
    scrim.classList.add("open"); modal.classList.add("open");
    document.body.style.overflow = "hidden";
    $("#modalClose").focus();
  }
  function closeModal() {
    scrim.classList.remove("open"); modal.classList.remove("open");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }
  $("#modalClose").addEventListener("click", closeModal);
  scrim.addEventListener("click", closeModal);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) closeModal(); });
})();
