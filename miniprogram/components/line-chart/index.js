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

  methods: {
    draw() {
      const points = this.data.points || [];
      const ctx = wx.createCanvasContext("lineCanvas", this);
      const width = 335;
      const height = 165;
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

      ctx.clearRect(0, 0, width, height);
      ctx.setFontSize(10);
      ctx.setTextBaseline("middle");
      ctx.setFillStyle("#7A8494");
      ctx.setStrokeStyle("#E6EBF3");
      ctx.setLineWidth(0.5);

      for (let i = 0; i < 4; i += 1) {
        const y = top + (graphH / 3) * i;
        const labelValue = max - (range / 3) * i;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(width - right, y);
        ctx.stroke();
        ctx.fillText(this.data.privacyMode ? "****" : shortNumber(labelValue), 0, y);
      }

      const mapped = points.map((point, index) => {
        const x = left + (points.length === 1 ? graphW : (graphW / (points.length - 1)) * index);
        const y = top + graphH - ((Number(point.value || 0) - min) / range) * graphH;
        return { x, y, label: point.label, value: point.value };
      });

      if (mapped.length) {
        const last = mapped[mapped.length - 1];
        ctx.beginPath();
        ctx.moveTo(mapped[0].x, graphH + top);
        mapped.forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.lineTo(last.x, graphH + top);
        ctx.closePath();
        ctx.setFillStyle(this.data.fillColor);
        ctx.fill();

        ctx.beginPath();
        mapped.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.setLineWidth(2);
        ctx.setStrokeStyle(this.data.color);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
        ctx.setFillStyle(this.data.color);
        ctx.fill();

        const tipText = `${last.label} ${this.data.privacyMode ? "****" : shortMoney(last.value)}`;
        const tipW = Math.max(76, tipText.length * 6);
        const tipX = Math.min(Math.max(last.x - tipW + 10, left), width - tipW - right);
        const tipY = Math.max(last.y - 28, 2);
        ctx.setFillStyle(this.data.color);
        roundRect(ctx, tipX, tipY, tipW, 22, 5);
        ctx.fill();
        ctx.setFillStyle("#FFFFFF");
        ctx.setFontSize(10);
        ctx.fillText(tipText, tipX + 7, tipY + 11);
      }

      ctx.setFillStyle("#7A8494");
      ctx.setFontSize(10);
      points.forEach((point, index) => {
        if (index % Math.ceil(points.length / 4) === 0 || index === points.length - 1) {
          const x = left + (points.length === 1 ? graphW : (graphW / (points.length - 1)) * index);
          ctx.fillText(point.label, x - 15, height - 10);
        }
      });

      ctx.draw();
    }
  }
});

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

function roundRect(ctx, x, y, width, height, radius) {
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
