Component({
  properties: {
    items: {
      type: Array,
      value: []
    },
    centerLabel: {
      type: String,
      value: "净资产"
    },
    centerValue: {
      type: String,
      value: "6类"
    }
  },

  observers: {
    "items": function () {
      this.draw();
    },
    "centerValue": function (value) {
      this.updateValueSize(value);
    }
  },

  lifetimes: {
    ready() {
      this.updateValueSize(this.data.centerValue);
      this.draw();
    }
  },

  methods: {
    updateValueSize(value) {
      const length = String(value || "").length;
      let valueSizeClass = "";
      if (length > 11) {
        valueSizeClass = "tiny";
      } else if (length > 8) {
        valueSizeClass = "small";
      } else if (length > 5) {
        valueSizeClass = "medium";
      }
      this.setData({ valueSizeClass });
    },

    draw() {
      wx.createSelectorQuery()
        .in(this)
        .select(".donut-canvas")
        .fields({ node: true, size: true })
        .exec((res) => {
          const rect = (res && res[0]) || {};
          const size = Math.round(Math.min(rect.width || 110, rect.height || 110));
          if (rect.node) {
            this.drawCanvas2d(rect.node, size);
            return;
          }
          this.drawCanvas(size);
        })
    },

    drawCanvas2d(canvas, size) {
      const items = (this.data.items || []).filter((item) => Number(item.amount) > 0);
      const ctx = canvas.getContext("2d");
      const width = size || 110;
      const dpr = getPixelRatio();
      const center = width / 2;
      const lineWidth = Math.max(14, width * 0.135);
      const radius = center - lineWidth / 2;
      const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      let start = -Math.PI / 2;

      canvas.width = width * dpr;
      canvas.height = width * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, width);
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "butt";

      if (!total) {
        ctx.beginPath();
        ctx.strokeStyle = "#E6EBF3";
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }

      items.forEach((item) => {
        const percent = Number(item.amount || 0) / total;
        const end = start + percent * Math.PI * 2;
        ctx.beginPath();
        ctx.strokeStyle = item.color || "#1769FF";
        ctx.arc(center, center, radius, start, end);
        ctx.stroke();
        start = end + 0.018;
      });
    },

    drawCanvas(size) {
      const items = (this.data.items || []).filter((item) => Number(item.amount) > 0);
      const ctx = wx.createCanvasContext("donutCanvas", this);
      const width = size || 110;
      const center = width / 2;
      const lineWidth = Math.max(14, width * 0.135);
      const radius = center - lineWidth / 2;
      const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      let start = -Math.PI / 2;

      ctx.clearRect(0, 0, width, width);
      ctx.setLineWidth(lineWidth);
      ctx.setLineCap("butt");

      if (!total) {
        ctx.setStrokeStyle("#E6EBF3");
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.draw();
        return;
      }

      items.forEach((item) => {
        const percent = Number(item.amount || 0) / total;
        const end = start + percent * Math.PI * 2;
        ctx.beginPath();
        ctx.setStrokeStyle(item.color || "#1769FF");
        ctx.arc(center, center, radius, start, end);
        ctx.stroke();
        start = end + 0.018;
      });

      ctx.draw();
    }
  }
});

function getPixelRatio() {
  if (wx.getWindowInfo) {
    return wx.getWindowInfo().pixelRatio || 1;
  }
  return 1;
}
