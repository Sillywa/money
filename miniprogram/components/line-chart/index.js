Component({
  properties: {
    points: {
      type: Array,
      value: []
    },
    color: {
      type: String,
      value: "#1769FF"
    },
    fillColor: {
      type: String,
      value: "rgba(23, 105, 255, 0.10)"
    },
    privacyMode: {
      type: Boolean,
      value: false
    }
  },

  observers: {
    "points,color,privacyMode": function () {
      this.draw();
    }
  },

  lifetimes: {
    ready() {
      this.draw();
    }
  },

  data: {
    canvasWidth: 335,
    canvasHeight: 165,
    selectedIndex: -1
  },

  methods: {
    draw() {
      wx.createSelectorQuery()
        .in(this)
        .select(".chart-canvas")
        .fields({ node: true, size: true })
        .exec((res) => {
          const rect = (res && res[0]) || {};
          const width = Math.round(rect.width || 335);
          const height = Math.round(rect.height || 165);
          this.setData({
            canvasWidth: width,
            canvasHeight: height
          });
          if (rect.node) {
            this.drawCanvas2d(rect.node, width, height);
            return;
          }
          this.drawLegacyCanvas(width, height);
        });
    },

    drawCanvas2d(canvas, width, height) {
      const dpr = getPixelRatio();
      const ctx = canvas.getContext("2d");
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      drawLineChart(ctx, {
        points: this.data.points || [],
        color: this.data.color,
        fillColor: this.data.fillColor,
        privacyMode: this.data.privacyMode,
        width,
        height,
        modern: true,
        selectedIndex: this.data.selectedIndex
      });
    },

    drawLegacyCanvas(width, height) {
      const points = this.data.points || [];
      const ctx = wx.createCanvasContext("lineCanvas", this);
      drawLineChart(ctx, {
        points,
        color: this.data.color,
        fillColor: this.data.fillColor,
        privacyMode: this.data.privacyMode,
        width,
        height,
        modern: false,
        selectedIndex: this.data.selectedIndex
      });
      ctx.draw();
    },

    onChartTouch(event) {
      const points = this.data.points || [];
      if (!points.length) return;
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      const selectedIndex = findNearestPointIndex(touch.x, points.length, this.data.canvasWidth);
      this.setData({ selectedIndex });
      this.draw();
    }
  }
});

function getPixelRatio() {
  if (wx.getWindowInfo) {
    return wx.getWindowInfo().pixelRatio || 1;
  }
  return 1;
}

function drawLineChart(ctx, options) {
  const points = options.points || [];
  const width = options.width || 335;
  const height = options.height || 165;
  const left = 36;
  const right = 10;
  const top = 14;
  const bottom = 30;
  const graphW = width - left - right;
  const graphH = height - top - bottom;
  const values = points.map((point) => Number(point.value || 0));
  const bounds = getYAxisBounds(values);
  const max = bounds.max;
  const min = bounds.min;
  const range = max - min;

  canvasCall(ctx, options.modern, "clearRect", 0, 0, width, height);
  setCanvasFontSize(ctx, options.modern, 10);
  setCanvasTextBaseline(ctx, options.modern, "middle");
  setCanvasFillStyle(ctx, options.modern, "#7A8494");
  setCanvasStrokeStyle(ctx, options.modern, "#E6EBF3");
  setCanvasLineWidth(ctx, options.modern, 0.5);

  for (let i = 0; i < 4; i += 1) {
    const y = top + (graphH / 3) * i;
    const labelValue = max - (range / 3) * i;
    canvasCall(ctx, options.modern, "beginPath");
    canvasCall(ctx, options.modern, "moveTo", left, y);
    canvasCall(ctx, options.modern, "lineTo", width - right, y);
    canvasCall(ctx, options.modern, "stroke");
    canvasCall(ctx, options.modern, "fillText", options.privacyMode ? "****" : shortNumber(labelValue), 0, y);
  }

  const mapped = points.map((point, index) => {
    const x = left + (points.length === 1 ? graphW : (graphW / (points.length - 1)) * index);
    const y = top + graphH - ((Number(point.value || 0) - min) / range) * graphH;
    return { x, y, label: point.label, value: point.value };
  });

  if (mapped.length) {
    const selectedIndex = normalizeSelectedIndex(options.selectedIndex, mapped.length);
    const selected = mapped[selectedIndex];
    canvasCall(ctx, options.modern, "beginPath");
    canvasCall(ctx, options.modern, "moveTo", selected.x, top);
    canvasCall(ctx, options.modern, "lineTo", selected.x, graphH + top);
    setCanvasStrokeStyle(ctx, options.modern, "rgba(102, 112, 133, 0.32)");
    setCanvasLineWidth(ctx, options.modern, 1);
    canvasCall(ctx, options.modern, "stroke");

    const last = mapped[mapped.length - 1];
    canvasCall(ctx, options.modern, "beginPath");
    canvasCall(ctx, options.modern, "moveTo", mapped[0].x, graphH + top);
    mapped.forEach((point) => canvasCall(ctx, options.modern, "lineTo", point.x, point.y));
    canvasCall(ctx, options.modern, "lineTo", last.x, graphH + top);
    canvasCall(ctx, options.modern, "closePath");
    setCanvasFillStyle(ctx, options.modern, options.fillColor);
    canvasCall(ctx, options.modern, "fill");

    canvasCall(ctx, options.modern, "beginPath");
    mapped.forEach((point, index) => {
      if (index === 0) canvasCall(ctx, options.modern, "moveTo", point.x, point.y);
      else canvasCall(ctx, options.modern, "lineTo", point.x, point.y);
    });
    setCanvasLineWidth(ctx, options.modern, 2);
    setCanvasStrokeStyle(ctx, options.modern, options.color);
    canvasCall(ctx, options.modern, "stroke");

    canvasCall(ctx, options.modern, "beginPath");
    canvasCall(ctx, options.modern, "arc", selected.x, selected.y, 4.5, 0, Math.PI * 2);
    setCanvasFillStyle(ctx, options.modern, options.color);
    canvasCall(ctx, options.modern, "fill");

    const tipText = `${selected.label} ${options.privacyMode ? "****" : shortMoney(selected.value)}`;
    const tipW = Math.max(76, tipText.length * 6);
    const tipX = Math.min(Math.max(selected.x - tipW + 10, left), width - tipW - right);
    const tipY = Math.max(selected.y - 28, 2);
    setCanvasFillStyle(ctx, options.modern, options.color);
    roundRect(ctx, options.modern, tipX, tipY, tipW, 22, 5);
    canvasCall(ctx, options.modern, "fill");
    setCanvasFillStyle(ctx, options.modern, "#FFFFFF");
    setCanvasFontSize(ctx, options.modern, 10);
    canvasCall(ctx, options.modern, "fillText", tipText, tipX + 7, tipY + 11);
  }

  setCanvasFillStyle(ctx, options.modern, "#7A8494");
  setCanvasFontSize(ctx, options.modern, 10);
  points.forEach((point, index) => {
    if (index % Math.ceil(points.length / 4) === 0 || index === points.length - 1) {
      const x = left + (points.length === 1 ? graphW : (graphW / (points.length - 1)) * index);
      canvasCall(ctx, options.modern, "fillText", point.label, x - 15, height - 10);
    }
  });
}

function normalizeSelectedIndex(selectedIndex, length) {
  const index = Number(selectedIndex);
  if (!Number.isFinite(index) || index < 0 || index >= length) {
    return length - 1;
  }
  return Math.round(index);
}

function findNearestPointIndex(touchX, pointCount, width) {
  if (pointCount <= 1) return 0;
  const left = 36;
  const right = 10;
  const graphW = Math.max(1, (width || 335) - left - right);
  const clampedX = Math.min(Math.max(Number(touchX || 0), left), (width || 335) - right);
  const ratio = (clampedX - left) / graphW;
  return Math.min(pointCount - 1, Math.max(0, Math.round(ratio * (pointCount - 1))));
}

function canvasCall(ctx, modern, method, ...args) {
  ctx[method](...args);
}

function setCanvasFontSize(ctx, modern, value) {
  if (modern) ctx.font = `${value}px sans-serif`;
  else ctx.setFontSize(value);
}

function setCanvasTextBaseline(ctx, modern, value) {
  if (modern) ctx.textBaseline = value;
  else ctx.setTextBaseline(value);
}

function setCanvasFillStyle(ctx, modern, value) {
  if (modern) ctx.fillStyle = value;
  else ctx.setFillStyle(value);
}

function setCanvasStrokeStyle(ctx, modern, value) {
  if (modern) ctx.strokeStyle = value;
  else ctx.setStrokeStyle(value);
}

function setCanvasLineWidth(ctx, modern, value) {
  if (modern) ctx.lineWidth = value;
  else ctx.setLineWidth(value);
}

function shortNumber(value) {
  const abs = Math.abs(Number(value || 0));
  if (abs >= 10000) return `${Math.round(value / 10000)}万`;
  return `${Math.round(value)}`;
}

function shortMoney(value) {
  const number = Number(value || 0);
  return number.toLocaleString("zh-CN", {
    maximumFractionDigits: 0
  });
}

function getYAxisBounds(values) {
  const normalized = values.filter((value) => Number.isFinite(value));

  if (!normalized.length) {
    return { min: 0, max: 1 };
  }

  const rawMax = Math.max(...normalized);
  const rawMin = Math.min(...normalized);
  const rawRange = rawMax - rawMin;

  if (rawRange === 0) {
    const base = Math.max(Math.abs(rawMax), 1);
    const padding = Math.max(base * 0.05, 1);
    return {
      min: rawMin - padding,
      max: rawMax + padding
    };
  }

  const padding = Math.max(rawRange * 0.12, Math.abs(rawMax) * 0.005, 1);
  return {
    min: rawMin - padding,
    max: rawMax + padding
  };
}

function roundRect(ctx, modern, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}
