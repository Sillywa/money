App({
  globalData: {
    openid: "",
    latestBundle: null,
    profile: null,
    viewingOwner: null,
    isViewingFamily: false,
    familyMembers: [],
    reminder: null
  },

  onLaunch() {
    if (!wx.cloud) return;

    wx.cloud.init({
      traceUser: true
    });

    wx.cloud.callFunction({
      name: "snapshots",
      data: { action: "login" }
    }).then((res) => {
      this.globalData.openid = (res.result && res.result.openid) || "";
      this.globalData.profile = (res.result && res.result.profile) || null;
    }).catch(() => {});
  }
});
