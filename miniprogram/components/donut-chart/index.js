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
    }
  },

  lifetimes: {
    ready() {
      this.draw();
    }
  },

  methods: {
    draw() {
      wx.createSelectorQuery()
        .in(this)
        .select(".donut-canvas")
        .boundingClientRect((rect) => {
          const size = Math.round(Math.min(rect && rect.width ? rect.width : 110, rect && rect.height ? rect.height : 110));
          this.drawCanvas(size);
        })
        .exec();
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
