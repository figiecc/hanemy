(() => {
  "use strict";

  const SIZE = 1080;

  function yen(value) { return Number(value || 0).toLocaleString("ja-JP") + "円"; }
  function shareStatusLabel(state) {
    if (!state || state.budget <= 0) return "まだ準備中";
    if (state.statusKey === "danger") return "厳しめ";
    if (state.statusKey === "caution") return "少し注意";
    return "順調です";
  }

  function statusMessage(state) {
    if (!state || state.budget <= 0) return "まずは今月入るお金を入れるだけでOKです";
    if (state.statusKey === "danger") return "追加支出は慎重にいきたい状態です";
    if (state.statusKey === "caution") return "今日は少し控えめにすると安心です";
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
      ink: "#263238",
      muted: "#6e7f84",
      line: "#d9ece8",
      mint: "#65c7bd",
      mintDark: "#25988f",
      mintSoft: "#e9faf6",
      coral: "#f46e68",
      coralSoft: "#ffe8e4",
    };

    const shareStatus = shareStatusLabel(state);
    const statusColor = state.statusKey === "danger" ? "#bf3d31" : state.statusKey === "caution" ? "#916113" : colors.mintDark;

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#e4faf6";
    ctx.beginPath();
    ctx.arc(914, 40, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff3ef";
    ctx.beginPath();
    ctx.arc(120, 980, 230, 0, Math.PI * 2);
    ctx.fill();

    round(ctx, 58, 58, 964, 964, 78, colors.card, colors.line, 4);

    const logo = await loadImage("logo-horizontal.png");
    if (logo) {
      const ratio = logo.width / logo.height;
      const w = 240;
      ctx.drawImage(logo, 108, 96, w, w / ratio);
    } else {
      const icon = await loadImage("icon-192.png");
      if (icon) ctx.drawImage(icon, 108, 92, 120, 120);
      text(ctx, "ハネミー", 250, 150, 50, colors.ink, 950);
    }

    text(ctx, "今月の生活費、", 130, 292, 58, colors.ink, 950);
    text(ctx, "こんな感じです", 130, 368, 58, colors.ink, 950);

    const icon = await loadImage("icon-192.png");
    if (icon) ctx.drawImage(icon, 780, 250, 128, 128);

    round(ctx, 126, 430, 828, 370, 48, "#fbfffe", colors.line, 3);

    round(ctx, 176, 486, 96, 96, 48, colors.mintSoft, null, 0);
    text(ctx, "¥", 224, 548, 54, colors.mint, 950, "center");
    text(ctx, "今月あと使えるお金", 326, 522, 31, colors.ink, 900);
    text(ctx, yen(state.left), 326, 600, 68, colors.mint, 950);

    ctx.strokeStyle = colors.line;
    ctx.setLineDash([8, 10]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(176, 638);
    ctx.lineTo(904, 638);
    ctx.stroke();

    round(ctx, 176, 674, 96, 96, 48, colors.coralSoft, null, 0);
    text(ctx, "□", 224, 736, 42, colors.coral, 950, "center");
    text(ctx, "残り日数", 326, 712, 31, colors.ink, 900);
    text(ctx, state.days ? `残り${state.days}日` : "-", 326, 768, 48, colors.coral, 950);

    round(ctx, 580, 674, 96, 96, 48, colors.mintSoft, null, 0);
    text(ctx, "☺", 628, 736, 42, colors.mintDark, 900, "center");
    text(ctx, "状態", 724, 712, 31, colors.ink, 900);
    text(ctx, shareStatus, 724, 768, 46, statusColor, 950);

    round(ctx, 126, 840, 828, 88, 44, colors.coral, null, 0);
    text(ctx, statusMessage(state), 540, 895, 30, "#ffffff", 900, "center");

    text(ctx, "細かい収入・固定費・カテゴリ内訳は表示していません。", 120, 966, 24, colors.muted, 800);
    text(ctx, "Hanemy｜今月あと使えるお金を見るアプリ", 960, 1002, 22, colors.muted, 800, "right");

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
