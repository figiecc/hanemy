(function () {
  "use strict";

  const moneyIds = [
    "incomeJob", "incomeAllowance", "incomeOther",
    "fixedPhone", "fixedSubscription", "fixedPass", "fixedOther"
  ];

  const rateItems = [
    { rateId: "rateFood", budgetId: "budgetFood" },
    { rateId: "rateTransport", budgetId: "budgetTransport" },
    { rateId: "rateSocial", budgetId: "budgetSocial" },
    { rateId: "rateDate", budgetId: "budgetDate" },
    { rateId: "rateHobby", budgetId: "budgetHobby" },
    { rateId: "rateFashion", budgetId: "budgetFashion" },
    { rateId: "rateStudy", budgetId: "budgetStudy" },
    { rateId: "rateReserve", budgetId: "budgetReserve" },
    { rateId: "rateSaving", budgetId: "budgetSaving" },
  ];

  function el(id) { return document.getElementById(id); }

  function yen(value) {
    return Number(value || 0).toLocaleString("ja-JP") + "円";
  }

  function getNumber(inputOrId) {
    const input = typeof inputOrId === "string" ? el(inputOrId) : inputOrId;
    const value = Number(input?.value || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function dispatch(input) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setMoney(input, next) {
    input.value = Math.max(0, Math.round(Number(next || 0) / 100) * 100);
    dispatch(input);
    refreshDisplays();
  }

  function setRate(input, next) {
    input.value = Math.max(0, Math.min(100, Math.round(Number(next || 0))));
    dispatch(input);
    liveApplyRates();
    refreshDisplays();
  }

  function getLabelText(label, fallback) {
    return Array.from(label.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .join("") || fallback;
  }

  function getTotals() {
    const income = ["incomeJob", "incomeAllowance", "incomeOther"].reduce((sum, id) => sum + getNumber(id), 0);
    const fixed = ["fixedPhone", "fixedSubscription", "fixedPass", "fixedOther"].reduce((sum, id) => sum + getNumber(id), 0);
    const totalRate = rateItems.reduce((sum, item) => sum + getNumber(item.rateId), 0);
    return { income, fixed, free: income - fixed, totalRate };
  }

  function liveApplyRates() {
    const totals = getTotals();
    if (totals.free <= 0 || totals.totalRate <= 0 || totals.totalRate > 100) return;
    if (typeof window.applyRatesToBudgets === "function" && typeof window.getRatesFromInputs === "function") {
      window.applyRatesToBudgets(window.getRatesFromInputs());
      if (typeof window.scheduleAutosave === "function") window.scheduleAutosave();
    }
  }

  function enhanceMoneyInput(id) {
    const input = el(id);
    if (!input || input.dataset.setupEnhanced === "true") return;

    const control = input.closest(".money-control");
    const field = input.closest(".money-field");
    const title = field?.querySelector(".field-text strong")?.textContent?.trim() || "金額";
    if (!control) return;

    input.dataset.setupEnhanced = "true";
    input.step = "100";
    input.inputMode = "numeric";

    const panel = document.createElement("div");
    panel.className = "setup-money-panel";
    panel.innerHTML = `
      <div class="setup-money-head">
        <span>${title}</span>
        <strong id="${id}SetupDisplay">0円</strong>
      </div>
      <div class="setup-chip-row">
        <button type="button" class="setup-chip secondary-chip" data-step="-1000">−1000</button>
        <button type="button" class="setup-chip secondary-chip" data-step="1000">+1000</button>
        <button type="button" class="setup-chip primary-chip" data-step="5000">+5000</button>
        <button type="button" class="setup-chip primary-chip" data-step="10000">+1万</button>
      </div>
    `;

    const manual = document.createElement("details");
    manual.className = "manual-money-details setup-manual";
    manual.innerHTML = `<summary>数字で直す</summary>`;
    const body = document.createElement("div");
    body.className = "manual-money-body";
    input.classList.add("direct-money-input");
    body.appendChild(input);
    const suffix = document.createElement("em");
    suffix.textContent = "円";
    body.appendChild(suffix);
    manual.appendChild(body);

    control.textContent = "";
    control.classList.add("setup-control-enhanced");
    control.appendChild(panel);
    control.appendChild(manual);

    panel.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => setMoney(input, getNumber(input) + Number(button.dataset.step)));
    });
  }

  function enhanceRateInput(item) {
    const input = el(item.rateId);
    const budgetInput = el(item.budgetId);
    if (!input || !budgetInput || input.dataset.rateEnhanced === "true") return;

    const label = input.closest("label");
    if (!label) return;

    const name = getLabelText(label, "カテゴリ");
    input.dataset.rateEnhanced = "true";
    input.step = "1";
    input.inputMode = "numeric";
    budgetInput.step = "100";
    budgetInput.inputMode = "numeric";
    budgetInput.classList.add("direct-money-input");

    const panel = document.createElement("div");
    panel.className = "rate-adjust-panel rate-money-panel";
    panel.innerHTML = `
      <div class="rate-adjust-head">
        <span>${name}</span>
        <strong id="${item.rateId}RateDisplay">0%</strong>
      </div>
      <div class="rate-money-line">
        <span>予算額</span>
        <strong id="${item.budgetId}BudgetDisplay">0円</strong>
      </div>
      <div class="rate-chip-row compact-rate-chip-row">
        <button type="button" class="rate-chip-button secondary-chip" data-rate-step="-5">−5</button>
        <button type="button" class="rate-chip-button secondary-chip" data-rate-step="-1">−1</button>
        <button type="button" class="rate-chip-button primary-chip" data-rate-step="1">+1</button>
        <button type="button" class="rate-chip-button primary-chip" data-rate-step="5">+5</button>
      </div>
    `;

    const manual = document.createElement("details");
    manual.className = "manual-money-details rate-manual";
    manual.innerHTML = `<summary>数字で直す</summary>`;
    const body = document.createElement("div");
    body.className = "rate-manual-grid";
    body.innerHTML = `<span>割合</span><span>金額</span>`;
    body.appendChild(input);
    body.appendChild(budgetInput);
    manual.appendChild(body);

    label.textContent = "";
    label.classList.add("rate-adjust-label");
    label.appendChild(panel);
    label.appendChild(manual);

    panel.querySelectorAll("[data-rate-step]").forEach((button) => {
      button.addEventListener("click", () => setRate(input, getNumber(input) + Number(button.dataset.rateStep)));
    });

    budgetInput.addEventListener("input", refreshDisplays);
    budgetInput.addEventListener("change", refreshDisplays);
    input.addEventListener("input", () => { liveApplyRates(); refreshDisplays(); });
    input.addEventListener("change", () => { liveApplyRates(); refreshDisplays(); });
  }

  function refreshDisplays() {
    moneyIds.forEach((id) => {
      const input = el(id);
      const display = el(`${id}SetupDisplay`);
      if (input && display) display.textContent = yen(getNumber(input));
    });

    const freeMirror = el("freeMoneySetupMirror");
    if (freeMirror) freeMirror.textContent = yen(getTotals().free).replace("円", "");

    rateItems.forEach((item) => {
      const rateInput = el(item.rateId);
      const budgetInput = el(item.budgetId);
      const rateDisplay = el(`${item.rateId}RateDisplay`);
      const budgetDisplay = el(`${item.budgetId}BudgetDisplay`);
      if (rateInput && rateDisplay) rateDisplay.textContent = `${getNumber(rateInput)}%`;
      if (budgetInput && budgetDisplay) budgetDisplay.textContent = yen(getNumber(budgetInput));
    });
  }

  function wrapUpdateScreen() {
    const original = window.updateScreen;
    if (typeof original !== "function" || original.__hanemySetupWrapped) return;

    const wrapped = function () {
      const result = original.apply(this, arguments);
      window.requestAnimationFrame(refreshDisplays);
      return result;
    };
    wrapped.__hanemySetupWrapped = true;
    window.updateScreen = wrapped;
  }

  function init() {
    moneyIds.forEach(enhanceMoneyInput);
    rateItems.forEach(enhanceRateInput);
    refreshDisplays();
    wrapUpdateScreen();

    document.querySelectorAll(".setup-control-enhanced input").forEach((input) => {
      input.addEventListener("input", () => { liveApplyRates(); refreshDisplays(); });
      input.addEventListener("change", () => { liveApplyRates(); refreshDisplays(); });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
