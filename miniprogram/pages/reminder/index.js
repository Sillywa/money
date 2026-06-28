const { reminderTemplateId } = require("../../utils/config");
const { fetchWorkspace, getViewingInfo, saveReminder } = require("../../utils/store");

Page({
  data: {
    days: Array.from({ length: 28 }).map((_, index) => `${index + 1}日`),
    dayIndex: 0,
    viewing: null,
    saving: false
  },

  onLoad() {
    fetchWorkspace().then((result) => {
      const day = result.reminder && result.reminder.dayOfMonth ? result.reminder.dayOfMonth : 1;
      this.setData({ dayIndex: day - 1, viewing: getViewingInfo() });
    });
  },

  onDayChange(event) {
    this.setData({ dayIndex: Number(event.detail.value) });
  },

  save() {
    const dayOfMonth = this.data.dayIndex + 1;
    this.setData({ saving: true });
    const requestSubscribe = reminderTemplateId
      ? wx.requestSubscribeMessage({ tmplIds: [reminderTemplateId] })
      : Promise.resolve();

    requestSubscribe
      .catch(() => {})
      .then(() => saveReminder(dayOfMonth))
      .then(() => {
        wx.showToast({ title: "已保存", icon: "success" });
        setTimeout(() => wx.navigateBack(), 450);
      })
      .catch(() => {
        wx.showToast({ title: "保存失败", icon: "none" });
      })
      .then(() => {
        this.setData({ saving: false });
      });
  }
});
