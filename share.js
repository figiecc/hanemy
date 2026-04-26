(() => {
  "use strict";

  const SIZE = 1080;

  function yen(value) { return Number(value || 0).toLocaleString("ja-JP") + "円"; }
  function shareStatusLabel(state) {
    if (!state || state.budget <= 0) return "まだ準備中";
    if (state.statusKey === "danger") return "かなり厳しめ";
    if (state.statusKey === "caution") return "少し注意";
    return "大丈夫そう";
  }

  function statusMessage(state) {
    if (!state || state.budget <= 0) return "まずは今月入るお金を入れるだけでOKです";
    if (state.statusKey === "danger") return "かなり厳しめ。追加支出は控えたい状態です";
    if (state.statusKey === "caution") return "少し注意。ペースを落とすと安心です";
    return "このままなら月末まで持ちそうです";
  }

  function round(ctx, x, y, w, h, r, fill, stroke, lw = 0) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke && lw) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  function text(ctx, value, x, y, size, color, weight = 700, align = "left") {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(String(value), x, y);
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  async function drawParentCard() {
    const state = window.HANEMY_STATE || {};
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");

    const colors = {
      bg: "#f4fbf8",
      card: "#ffffff",
      ink: "#1f2d34",
      muted: "#64777d",
      line: "#d9ece8",
      gold: "#65c7bd",
      safe: "#23854d",
      caution: "#916113",
      danger: "#bf3d31",
      neutral: "#64777d",
    };
    const shareStatus = shareStatusLabel(state);
    const statusColor = colors[state.statusKey] || colors.neutral;
    const badgeBg = state.statusKey === "safe" ? "#e8f5ec" : state.statusKey === "danger" ? "#fdecea" : state.statusKey === "caution" ? "#fff4d6" : "#eeeeee";

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#e4faf6";
    ctx.beginPath();
    ctx.arc(900, 40, 260, 0, Math.PI * 2);
    ctx.fill();

    round(ctx, 58, 58, 964, 964, 72, colors.card, colors.line, 4);

    const logo = await loadImage("icon-192.png");
    if (logo) ctx.drawImage(logo, 108, 108, 132, 132);

    text(ctx, "ハネミー", 280, 150, 54, colors.ink, 950);
    text(ctx, "今月の生活費、こんな感じです", 284, 198, 28, colors.gold, 900);
    text(ctx, state.modeLabel || "配分準備中", 284, 236, 24, colors.muted, 800);

    round(ctx, 742, 124, 196, 58, 29, badgeBg, null, 0);
    text(ctx, shareStatus, 840, 162, 24, statusColor, 950, "center");

    round(ctx, 118, 320, 844, 190, 40, colors.ink, null, 0);
    text(ctx, "今月あと使えるお金", 158, 382, 32, "#ecfffc", 900);
    text(ctx, yen(state.left), 158, 470, 72, "#ffffff", 950);

    round(ctx, 118, 548, 407, 138, 32, "#e4faf6", colors.line, 3);
    text(ctx, "残り日数", 156, 606, 28, colors.muted, 900);
    text(ctx, state.days ? `残り${state.days}日` : "-", 156, 660, 42, colors.ink, 900);

    round(ctx, 555, 548, 407, 138, 32, "#e4faf6", colors.line, 3);
    text(ctx, "状態", 592, 606, 28, colors.muted, 900);
    text(ctx, shareStatus, 592, 660, 42, colors.ink, 900);

    round(ctx, 118, 724, 844, 128, 32, "#dff7f3", null, 0);
    text(ctx, "生活費ナビ", 156, 778, 28, "#916113", 900);
    text(ctx, statusMessage(state), 156, 830, 34, colors.ink, 900);

    text(ctx, "細かい収入・固定費・カテゴリ内訳は表示していません。", 120, 916, 24, colors.muted, 800);
    text(ctx, "Hanemy｜生活費が月末まで持つか分かる", 960, 980, 22, colors.muted, 800, "right");

    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function shareCanvas(canvas) {
    const blob = await canvasToBlob(canvas);
    if (!blob) throw new Error("Canvas blob creation failed");
    const file = new File([blob], "hanemy-parent-card.png", { type: "image/png" });

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({ title: "ハネミー生活費カード", text: "今月の生活費、こんな感じです", files: [file] });
        return;
      } catch (error) {
        if (error && error.name === "AbortError") return;
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hanemy-parent-card.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("shareParentButton");
    button?.addEventListener("click", async () => {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "カード作成中...";
      try {
        await shareCanvas(await drawParentCard());
      } catch (error) {
        console.error(error);
        alert("カード作成に失敗しました。ページを再読み込みしてもう一度試してください。");
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    });
  });
})();
