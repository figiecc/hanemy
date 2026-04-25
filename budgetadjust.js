(function () {
  "use strict";

  const controls = [
    { id: "budgetFood", type: "budget" }, { id: "spentFood", type: "spent" },
    { id: "budgetTransport", type: "budget" }, { id: "spentTransport", type: "spent" },
    { id: "budgetSocial", type: "budget" }, { id: "spentSocial", type: "spent" },
    { id: "budgetDate", type: "budget" }, { id: "spentDate", type: "spent" },
    { id: "budgetHobby", type: "budget" }, { id: "spentHobby", type: "spent" },
    { id: "budgetFashion", type: "budget" }, { id: "spentFashion", type: "spent" },
    { id: "budgetStudy", type: "budget" }, { id: "spentStudy", type: "spent" },
    { id: "budgetReserve", type: "budget" }, { id: "spentReserve", type: "spent" },
    { id: "budgetSaving", type: "budget" }, { id: "spentSaving", type: "spent" },
  ];

  const buttonSets = {
    budget: [
      { label: "−1000", value: -1000, tone: "secondary" },
      { label: "+1000", value: 1000, tone: "secondary" },
      { label: "+5000", value: 5000, tone: "primary" },
    ],
    spent: [
      { label: "−1000", value: -1000, tone: "secondary" },
      { label: "+500", value: 500, tone: "secondary" },
      { label: "+1000", value: 1000, tone: "primary" },
      { label: "+3000", value: 3000, tone: "primary" },
    ],
  };

  function el(id) { return document.getElementById(id); }

  function formatYen(value) {
    return Number(value || 0).toLocaleString("ja-JP") + "円";
  }

  function getNumber(input) {
    const value = Number(input.value);
    return Number.isFinite(value) ? value : 0;
  }

  function setAmount(input, nextValue) {
    input.value = Math.max(0, Math.round(Number(nextValue || 0) / 100) * 100);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    refreshAmountDisplays();
  }

  function makeButton(config, input) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "amount-chip" + (config.tone === "primary" ? " primary-chip" : " secondary-chip");
    button.textContent = config.label;
    button.addEventListener("click", () => {
      setAmount(input, getNumber(input) + config.value);
    });
    return button;
  }

  function enhanceInput(item) {
    const input = el(item.id);
    if (!input || input.dataset.amountEnhanced === "true") return;

    const label = input.closest("label");
    if (!label) return;

    const title = Array.from(label.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .join("") || (item.type === "budget" ? "予算" : "使った額");

    input.dataset.amountEnhanced = "true";
    input.step = "100";
    input.inputMode = "numeric";
    input.classList.add("direct-money-input");

    const panel = document.createElement("div");
    panel.className = `amount-control amount-control-${item.type}`;
    panel.innerHTML = `
      <div class="amount-control-head">
        <span>${title}</span>
        <strong id="${item.id}Display">0円</strong>
      </div>
      <div class="amount-chip-row"></div>
    `;

    const chipRow = panel.querySelector(".amount-chip-row");
    buttonSets[item.type].forEach((config) => chipRow.appendChild(makeButton(config, input)));

    const manual = document.createElement("details");
    manual.className = "manual-money-details";
    manual.innerHTML = `<summary>数字で直す</summary>`;
    const manualBody = document.createElement("div");
    manualBody.className = "manual-money-body";
    manualBody.appendChild(input);
    const yen = document.createElement("em");
    yen.textContent = "円";
    manualBody.appendChild(yen);
    manual.appendChild(manualBody);

    label.textContent = "";
    label.classList.add("amount-label");
    label.appendChild(panel);
    label.appendChild(manual);
  }

  function refreshAmountDisplays() {
    controls.forEach((item) => {
      const input = el(item.id);
      const display = el(`${item.id}Display`);
      if (!input || !display) return;
      display.textContent = formatYen(getNumber(input));
    });
  }

  function addPhilosophyClasses() {
    document.querySelectorAll(".budget-row").forEach((row) => {
      row.classList.add("decision-budget-row");
      const left = row.querySelector("strong");
      if (left) left.classList.add("left-amount-pill");
    });
  }

  function setupBudgetAdjustments() {
    controls.forEach(enhanceInput);
    addPhilosophyClasses();
    refreshAmountDisplays();

    document.querySelectorAll(".direct-money-input").forEach((input) => {
      input.addEventListener("input", refreshAmountDisplays);
      input.addEventListener("change", refreshAmountDisplays);
    });

    const originalUpdate = window.updateScreen;
    if (typeof originalUpdate === "function" && !originalUpdate.__hanemyAmountWrapped) {
      const wrapped = function () {
        const result = originalUpdate.apply(this, arguments);
        window.requestAnimationFrame(refreshAmountDisplays);
        return result;
      };
      wrapped.__hanemyAmountWrapped = true;
      window.updateScreen = wrapped;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupBudgetAdjustments);
  } else {
    setupBudgetAdjustments();
  }
})();
