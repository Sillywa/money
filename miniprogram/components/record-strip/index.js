Component({
  properties: {
    latestLabel: {
      type: String,
      value: "最新记录"
    },
    compareLabel: {
      type: String,
      value: "对比"
    },
    latestDate: {
      type: String,
      value: ""
    },
    compareDate: {
      type: String,
      value: ""
    },
    compareOptions: {
      type: Array,
      value: []
    },
    compareIndex: {
      type: Number,
      value: 0
    }
  },

  methods: {
    onPickerChange(event) {
      const index = Number(event.detail.value);
      this.triggerEvent("change", {
        index,
        value: index,
        recordDate: this.data.compareOptions[index] || ""
      });
    }
  }
});
