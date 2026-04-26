(() => {
  "use strict";

  const STORAGE_KEY = "hanemy-beta-v060-pastel-state";
  const FIRST_RUN_KEY = "hanemy-beta-v060-pastel-first-run";

  const categories = [
    { key: "food", name: "食費", icon: "🍴" },
    { key: "transport", name: "交通費", icon: "🚌" },
    { key: "social", name: "交際費", icon: "🎮" },
    { key: "date", name: "デート代", icon: "☕" },
    { key: "hobby", name: "趣味", icon: "🎧" },
    { key: "fashion", name: "服・美容", icon: "👕" },
    { key: "study", name: "勉強", icon: "📚" },
    { key: "reserve", name: "予備費", icon: "🧺" },
    { key: "saving", name: "貯金", icon: "💎" },
  ];

  const templates = {
    home: {
      label: "実家暮らし",
      icon: "🏠",
      short: "自由費多め",
      dailyMinimumCost: 300,
      rates: { food: 20, transport: 12, social: 15, date: 8, hobby: 12, fashion: 8, study: 5, reserve: 10, saving: 10 },
    },
    alone: {
      label: "一人暮らし",
      icon: "🛋️",
      short: "生活安全寄り",
      dailyMinimumCost: 900,
      rates: { food: 35, transport: 8, social: 8, date: 6, hobby: 6, fashion: 5, study: 4, reserve: 18, saving: 10 },
    },
    allowance: {
      label: "仕送り＋バイト",
      icon: "👛",
      short: "親共有向き",
      dailyMinimumCost: 700,
      rates: { food: 30, transport: 10, social: 8, date: 6, hobby: 6, fashion: 5, study: 4, reserve: 21, saving: 10 },
    },
    parttime: {
      label: "バイト中心",
      icon: "🎒",
      short: "変動に強め",
      dailyMinimumCost: 600,
      rates: { food: 30, transport: 10, social: 7, date: 5, hobby: 6, fashion: 5, study: 4, reserve: 23, saving: 10 },
    },
  };

  const inputIds = ["incomeJob", "incomeAllowance", "incomeOther", "fixedPhone", "fixedSubscription", "fixedPass", "fixedOther", "periodStartDay"];
  const quickCategories = categories.filter((category) => category.key !== "saving");

  let state = createInitialState();
  let quickMode = "add";
  let selectedUnit = 1000;
  const quickCounts = {};
  let autosaveTimer = null;

  function el(id) { return document.getElementById(id); }
  function yen(value) { return Math.round(Number(value || 0)).toLocaleString("ja-JP"); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function round100(value) { return Math.floor(Number(value || 0) / 100) * 100; }
  function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
  function fmtMD(date) { return `${date.getMonth() + 1}/${date.getDate()}`; }
  function numberFromInput(id) {
    const value = Number(el(id)?.value || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function createInitialState() {
    const base = templates.allowance;
    return {
      mode: "allowance",
      customLabel: "カスタム",
      periodStartDay: 1,
      income: { job: 0, allowance: 0, other: 0 },
      fixed: { phone: 0, subscription: 0, pass: 0, other: 0 },
      rates: { ...base.rates },
      dailyMinimumCost: base.dailyMinimumCost,
      budgets: Object.fromEntries(categories.map((category) => [category.key, 0])),
      spent: Object.fromEntries(categories.map((category) => [category.key, 0])),
    };
  }

  function activeModeLabel() {
    if (state.mode === "custom") return state.customLabel || "カスタム";
    return templates[state.mode]?.label || "生活タイプ未設定";
  }

  function getPeriod() {
    const now = today();
    const startDay = clamp(Number(state.periodStartDay || 1), 1, 28);
    let year = now.getFullYear();
    let month = now.getMonth();
    if (now.getDate() < startDay) month -= 1;
    const start = new Date(year, month, startDay);
    const end = new Date(year, month + 1, startDay - 1);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  function remainingDays() {
    const { end } = getPeriod();
    return Math.max(1, Math.floor((end - today()) / 86400000) + 1);
  }

  function elapsedDays() {
    const { start } = getPeriod();
    return Math.max(1, Math.floor((today() - start) / 86400000) + 1);
  }

  function totals() {
    const income = Number(state.income.job || 0) + Number(state.income.allowance || 0) + Number(state.income.other || 0);
    const fixed = Number(state.fixed.phone || 0) + Number(state.fixed.subscription || 0) + Number(state.fixed.pass || 0) + Number(state.fixed.other || 0);
    const free = income - fixed;
    const budget = categories.reduce((sum, category) => sum + Number(state.budgets[category.key] || 0), 0);
    const spent = categories.reduce((sum, category) => sum + Number(state.spent[category.key] || 0), 0);
    const left = budget - spent;
    const days = remainingDays();
    const minimumLine = days * Number(state.dailyMinimumCost || 0);
    const safeLeft = left - minimumLine;
    const safeDaily = budget > 0 && safeLeft > 0 ? round100(safeLeft / days) : 0;
    return { income, fixed, free, budget, spent, left, days, minimumLine, safeLeft, safeDaily };
  }

  function statusKey(total) {
    if (total.budget <= 0) return "neutral";
    if (total.left < 0) return "danger";
    if (total.safeLeft <= 0) return "caution";
    if (total.left <= total.budget * 0.2) return "caution";
    return "safe";
  }

  function statusLabel(key) {
    return { safe: "安定", caution: "注意", danger: "危険", neutral: "未設定" }[key] || "未設定";
  }

  function getDangerForecast(total) {
    if (total.budget <= 0) return { text: "未設定", note: "生活タイプと今月のお金を入れると表示されます。" };
    if (total.left < 0) return { text: "すでに予算オーバー", note: "まずは今日の追加支出を止めたい状態です。" };
    if (total.safeLeft <= 0) return { text: "生活ラインが近いです", note: "月末までの最低限を残すなら、今日は抑えたい状態です。" };
    if (total.spent <= 0) return { text: "このままなら月末まで持ちます", note: "まだ支出ペースが低いので、安全寄りです。" };

    const averageSpend = total.spent / elapsedDays();
    if (averageSpend <= 0) return { text: "このままなら月末まで持ちます", note: "今の入力では危険日は出ていません。" };

    const daysCanLast = Math.floor(total.safeLeft / averageSpend);
    if (daysCanLast < total.days) {
      const dangerDate = addDays(today(), Math.max(0, daysCanLast));
      return { text: `${fmtMD(dangerDate)}ごろ注意`, note: "生活ラインを残すなら、少しペースを落とすと安心です。" };
    }

    return { text: "このままなら月末まで持ちます", note: "今のペースなら生活費は大きく崩れにくい状態です。" };
  }

  function applyRatesToBudgets() {
    const free = Math.max(0, totals().free);
    const totalRate = categories.reduce((sum, category) => sum + Math.max(0, Number(state.rates[category.key] || 0)), 0);
    let allocated = 0;
    const rated = categories.filter((category) => Number(state.rates[category.key] || 0) > 0);

    categories.forEach((category) => {
      const rate = Math.max(0, Number(state.rates[category.key] || 0));
      if (free <= 0 || totalRate <= 0 || rate <= 0) {
        state.budgets[category.key] = 0;
        return;
      }
      const isLast = rated[rated.length - 1]?.key === category.key;
      const next = isLast ? Math.max(0, free - allocated) : round100(free * (rate / totalRate));
      state.budgets[category.key] = next;
      allocated += next;
    });
  }

  function readInputsToState() {
    state.periodStartDay = clamp(numberFromInput("periodStartDay") || 1, 1, 28);
    state.income.job = numberFromInput("incomeJob");
    state.income.allowance = numberFromInput("incomeAllowance");
    state.income.other = numberFromInput("incomeOther");
    state.fixed.phone = numberFromInput("fixedPhone");
    state.fixed.subscription = numberFromInput("fixedSubscription");
    state.fixed.pass = numberFromInput("fixedPass");
    state.fixed.other = numberFromInput("fixedOther");
  }

  function writeStateToInputs() {
    el("periodStartDay").value = String(state.periodStartDay || 1);
    el("incomeJob").value = state.income.job || "";
    el("incomeAllowance").value = state.income.allowance || "";
    el("incomeOther").value = state.income.other || "";
    el("fixedPhone").value = state.fixed.phone || "";
    el("fixedSubscription").value = state.fixed.subscription || "";
    el("fixedPass").value = state.fixed.pass || "";
    el("fixedOther").value = state.fixed.other || "";
    el("customModeName").value = state.customLabel || "カスタム";
    el("customDailyMinimum").value = state.dailyMinimumCost || 0;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function scheduleSave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(save, 250);
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return;
      const initial = createInitialState();
      state = {
        ...initial,
        ...saved,
        income: { ...initial.income, ...(saved.income || {}) },
        fixed: { ...initial.fixed, ...(saved.fixed || {}) },
        rates: { ...initial.rates, ...(saved.rates || {}) },
        budgets: { ...initial.budgets, ...(saved.budgets || {}) },
        spent: { ...initial.spent, ...(saved.spent || {}) },
      };
    } catch {
      state = createInitialState();
    }
  }

  function render() {
    applyRatesToBudgets();
    const total = totals();
    const key = statusKey(total);
    const forecast = getDangerForecast(total);

    el("modeLabel").textContent = activeModeLabel();
    el("statusBadge").textContent = statusLabel(key);
    el("statusBadge").className = `status-badge ${key}`;
    el("leftMoney").textContent = yen(total.left);
    el("freeMoney").textContent = yen(total.free);
    el("remainingDaysText").textContent = total.budget > 0 ? `残り${total.days}日` : "-";
    el("dangerForecastText").textContent = forecast.text;
    el("dailyAllowanceText").textContent = total.budget > 0 ? (total.safeDaily > 0 ? `${yen(total.safeDaily)}円くらい` : "今日は支出を抑えたい") : "未設定";
    el("dailyAllowanceNote").textContent = forecast.note;
    el("allowanceBox").className = `allowance-box ${key}`;
    el("stickyBar").textContent = `今月あと使えるお金：${yen(total.left)}円 ｜ ${statusLabel(key)}`;

    renderModeButtons();
    renderCategoryStrip(total);
    renderQuickTotal();
    renderCustomRateInputs(false);
    save();

    window.HANEMY_STATE = {
      ...total,
      statusKey: key,
      statusLabel: statusLabel(key),
      mode: state.mode,
      modeLabel: activeModeLabel(),
      dangerForecast: forecast.text,
      dailyAllowance: total.safeDaily,
      categories,
      budgets: { ...state.budgets },
      spent: { ...state.spent },
    };
  }

  function renderCategoryStrip(total) {
    const wrap = el("categoryStrip");
    if (!wrap) return;
    if (total.budget <= 0) {
      wrap.innerHTML = `<p class="empty-message">今月の準備をすると、カテゴリごとの残り金額が出ます。</p>`;
      return;
    }
    wrap.innerHTML = categories.filter((category) => Number(state.budgets[category.key] || 0) > 0).map((category) => {
      const budget = Number(state.budgets[category.key] || 0);
      const spent = Number(state.spent[category.key] || 0);
      const left = budget - spent;
      const ratio = budget > 0 ? spent / budget : 0;
      const percent = Math.round(ratio * 100);
      const className = left < 0 ? "danger" : ratio >= 0.8 ? "caution" : "safe";
      const leftLabel = left < 0 ? `${yen(Math.abs(left))}円超過` : `あと${yen(left)}円`;
      return `<div class="cat-row ${className}">
        <span class="cat-icon" aria-hidden="true">${category.icon || "•"}</span>
        <div class="cat-main">
          <span class="cat-name">${category.name}</span>
          <small>使った ${yen(spent)}円 / 目安 ${yen(budget)}円</small>
          <span class="cat-track"><span class="cat-bar" style="width:${clamp(percent, 0, 100)}%"></span></span>
        </div>
        <div class="cat-money">
          <strong>${leftLabel}</strong>
          <span>${percent}%</span>
        </div>
      </div>`;
    }).join("");
  }

  function renderQuickList() {
    const list = el("quickList");
    if (!list) return;
    list.innerHTML = quickCategories.map((category) => {
      const count = quickCounts[category.key] || 0;
      return `<div class="quick-item ${count > 0 ? "has-count" : ""}" data-quick-item="${category.key}">
        <span class="quick-icon" aria-hidden="true">${category.icon || "•"}</span>
        <div class="quick-copy"><strong>${category.name}</strong><small><span id="quickAmount_${category.key}">${yen(count * selectedUnit)}</span>円${quickMode === "subtract" ? "取り消し" : "追加"}</small></div>
        <div class="counter">
          <button type="button" class="secondary" data-minus="${category.key}" aria-label="${category.name}を減らす">−</button>
          <span id="count_${category.key}">${count}</span>
          <button type="button" data-plus="${category.key}" aria-label="${category.name}を増やす">＋</button>
        </div>
      </div>`;
    }).join("");

    list.querySelectorAll("[data-plus]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.plus;
        quickCounts[key] = Math.min(99, (quickCounts[key] || 0) + 1);
        renderQuickList();
        renderQuickTotal();
      });
    });

    list.querySelectorAll("[data-minus]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.minus;
        quickCounts[key] = Math.max(0, (quickCounts[key] || 0) - 1);
        renderQuickList();
        renderQuickTotal();
      });
    });
  }

  function quickTotal() {
    return quickCategories.reduce((sum, category) => sum + (quickCounts[category.key] || 0) * selectedUnit, 0);
  }

  function renderQuickTotal() {
    const total = quickTotal();
    el("quickTotal").textContent = yen(total);
    el("quickTotalLabel").textContent = quickMode === "subtract" ? "取り消し予定" : "追加予定";
    const button = el("applyQuickButton");
    button.disabled = total <= 0;
    button.textContent = quickMode === "subtract" ? "取り消す" : "反映する";
  }

  function resetQuickCounts() {
    quickCategories.forEach((category) => { quickCounts[category.key] = 0; });
    renderQuickList();
    renderQuickTotal();
  }

  function applyQuickInput() {
    const total = quickTotal();
    if (total <= 0) return;
    quickCategories.forEach((category) => {
      const amount = (quickCounts[category.key] || 0) * selectedUnit;
      if (amount <= 0) return;
      const current = Number(state.spent[category.key] || 0);
      state.spent[category.key] = quickMode === "subtract" ? Math.max(0, current - amount) : current + amount;
    });
    const label = quickMode === "subtract" ? "取り消しました" : "追加しました";
    resetQuickCounts();
    render();
    scheduleSave();
    toast(`${yen(total)}円を${label}。`);
  }

  function setupPeriodSelect() {
    const select = el("periodStartDay");
    select.innerHTML = "";
    for (let day = 1; day <= 28; day += 1) {
      const option = document.createElement("option");
      option.value = String(day);
      option.textContent = `${day}日`;
      select.appendChild(option);
    }
  }

  function renderModeButtons() {
    const html = Object.entries(templates).map(([key, item]) => `<button type="button" data-mode-select="${key}" class="mode-choice-card ${state.mode === key ? "active" : ""}"><span class="mode-check">✓</span><span class="mode-icon" aria-hidden="true">${item.icon || ""}</span><strong>${item.label}</strong><small>${item.short}</small></button>`).join("") +
      `<button type="button" data-mode-select="custom" class="mode-choice-card ${state.mode === "custom" ? "active" : ""}"><span class="mode-check">✓</span><span class="mode-icon" aria-hidden="true">⚙️</span><strong>${state.customLabel || "カスタム"}</strong><small>自分用設定</small></button>`;

    const mini = el("modeMiniGrid");
    if (mini && mini.dataset.html !== html) {
      mini.dataset.html = html;
      mini.innerHTML = html;
      mini.querySelectorAll("[data-mode-select]").forEach((button) => button.addEventListener("click", () => applyMode(button.dataset.modeSelect)));
    }
  }

  function renderModeOverlay() {
    const list = el("modeList");
    list.innerHTML = Object.entries(templates).map(([key, item]) => `<button type="button" data-overlay-mode="${key}"><span class="mode-icon" aria-hidden="true">${item.icon || ""}</span><strong>${item.label}</strong><span>${item.short}</span></button>`).join("") +
      `<button type="button" data-overlay-mode="custom"><span class="mode-icon" aria-hidden="true">⚙️</span><strong>${state.customLabel || "カスタム"}</strong><span>自分で調整した設定</span></button>`;
    list.querySelectorAll("[data-overlay-mode]").forEach((button) => button.addEventListener("click", () => {
      applyMode(button.dataset.overlayMode);
      closeModeOverlay();
    }));
  }

  function applyMode(mode) {
    if (mode !== "custom" && templates[mode]) {
      state.mode = mode;
      state.rates = { ...templates[mode].rates };
      state.dailyMinimumCost = templates[mode].dailyMinimumCost;
    } else {
      state.mode = "custom";
      state.customLabel = state.customLabel || "カスタム";
    }
    applyRatesToBudgets();
    render();
    scheduleSave();
    toast(`${activeModeLabel()}に設定しました。`);
  }

  function renderCustomRateInputs(attachListeners = true) {
    const grid = el("customRateGrid");
    if (!grid) return;
    const currentTotal = categories.reduce((sum, category) => sum + Number(state.rates[category.key] || 0), 0);
    el("rateTotal").textContent = currentTotal;

    if (grid.dataset.rendered === "true" && !attachListeners) {
      categories.forEach((category) => {
        const input = el(`customRate_${category.key}`);
        if (input && document.activeElement !== input) input.value = Number(state.rates[category.key] || 0);
      });
      const minInput = el("customDailyMinimum");
      if (minInput && document.activeElement !== minInput) minInput.value = Number(state.dailyMinimumCost || 0);
      return;
    }

    grid.innerHTML = categories.map((category) => `<label class="rate-field"><span>${category.name}</span><input id="customRate_${category.key}" type="number" min="0" max="100" step="1" value="${Number(state.rates[category.key] || 0)}" /></label>`).join("");
    grid.dataset.rendered = "true";

    grid.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.id.replace("customRate_", "");
        state.rates[key] = clamp(Number(input.value || 0), 0, 100);
        state.mode = "custom";
        updateRateTotalOnly();
        applyRatesToBudgets();
        render();
        scheduleSave();
      });
    });
  }

  function updateRateTotalOnly() {
    const total = categories.reduce((sum, category) => sum + Number(state.rates[category.key] || 0), 0);
    el("rateTotal").textContent = total;
  }

  function saveCustomMode() {
    state.mode = "custom";
    state.customLabel = el("customModeName").value.trim() || "カスタム";
    state.dailyMinimumCost = Math.max(0, Number(el("customDailyMinimum").value || 0));
    categories.forEach((category) => {
      state.rates[category.key] = clamp(Number(el(`customRate_${category.key}`)?.value || 0), 0, 100);
    });
    applyRatesToBudgets();
    render();
    scheduleSave();
    toast("カスタム生活タイプを反映しました。");
  }

  function adjustMoneyInput(id, step) {
    const input = el(id);
    if (!input) return;
    const current = Number(input.value || 0);
    const next = Math.max(0, round100(current + Number(step || 0)));
    input.value = next || "";
    readInputsToState();
    render();
    scheduleSave();
  }

  function openModeOverlay() { renderModeOverlay(); el("modeOverlay").hidden = false; }
  function closeModeOverlay() { el("modeOverlay").hidden = true; localStorage.setItem(FIRST_RUN_KEY, "true"); }

  function bind() {
    inputIds.forEach((id) => {
      el(id)?.addEventListener("input", () => { readInputsToState(); render(); scheduleSave(); });
      el(id)?.addEventListener("change", () => { readInputsToState(); render(); scheduleSave(); });
    });

    document.querySelectorAll("[data-unit]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedUnit = Number(button.dataset.unit) || 1000;
        document.querySelectorAll("[data-unit]").forEach((item) => item.classList.toggle("active", item === button));
        renderQuickList();
        renderQuickTotal();
      });
    });

    document.querySelectorAll("[data-quick-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        quickMode = button.dataset.quickMode === "subtract" ? "subtract" : "add";
        document.querySelectorAll("[data-quick-mode]").forEach((item) => item.classList.toggle("active", item === button));
        renderQuickList();
        renderQuickTotal();
      });
    });

    document.querySelectorAll("[data-money-step]").forEach((button) => {
      button.addEventListener("click", () => adjustMoneyInput(button.dataset.moneyStep, Number(button.dataset.step || 0)));
    });

    el("applyQuickButton").addEventListener("click", applyQuickInput);
    el("noSpendButton").addEventListener("click", () => toast("今日は大きな支出なしとして確認しました。"));
    el("openQuickButton").addEventListener("click", () => el("quickCard").scrollIntoView({ behavior: "smooth", block: "start" }));
    el("openSetupButton").addEventListener("click", () => el("setupCard").scrollIntoView({ behavior: "smooth", block: "start" }));
    el("openModeButton").addEventListener("click", openModeOverlay);
    el("skipModeButton").addEventListener("click", closeModeOverlay);
    el("saveCustomModeButton").addEventListener("click", saveCustomMode);
    el("customModeName").addEventListener("input", () => { state.customLabel = el("customModeName").value.trim() || "カスタム"; state.mode = "custom"; render(); scheduleSave(); });
    el("customDailyMinimum").addEventListener("input", () => { state.dailyMinimumCost = Math.max(0, Number(el("customDailyMinimum").value || 0)); state.mode = "custom"; render(); scheduleSave(); });

    const observer = new IntersectionObserver((entries) => {
      el("stickyBar").classList.toggle("show", !entries[0].isIntersecting);
      el("stickyBar").setAttribute("aria-hidden", entries[0].isIntersecting ? "true" : "false");
    }, { threshold: 0, rootMargin: "-52px 0px 0px 0px" });
    observer.observe(el("heroCard"));
  }

  function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2200);
  }

  function init() {
    setupPeriodSelect();
    quickCategories.forEach((category) => { quickCounts[category.key] = 0; });
    load();
    writeStateToInputs();
    renderModeButtons();
    renderModeOverlay();
    renderCustomRateInputs(true);
    renderQuickList();
    bind();
    render();
    if (!localStorage.getItem(FIRST_RUN_KEY)) openModeOverlay();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
