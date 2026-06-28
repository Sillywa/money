const { createFamilyInvite, fetchWorkspace, getProfile, getViewingInfo, setActiveOwner } = require("../../utils/store");

Page({
  data: {
    inviteToken: "",
    familyMembers: [],
    profile: null,
    viewing: null,
    loading: true
  },

  onShow() {
    this.load();
  },

  load() {
    return fetchWorkspace().then((result) => {
      this.setData({
        familyMembers: result.familyMembers || [],
        profile: getProfile(),
        viewing: getViewingInfo(),
        loading: false
      });
      return this.ensureInviteToken();
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  ensureInviteToken() {
    if (this.data.inviteToken) return Promise.resolve(this.data.inviteToken);
    return createFamilyInvite().then((result) => {
      const token = result.inviteCode || "";
      this.setData({ inviteToken: token });
      return token;
    });
  },

  onShareAppMessage() {
    const token = this.data.inviteToken;
    const nickName = (this.data.profile && this.data.profile.nickName) || "亲友";
    return {
      title: `${nickName} 邀请你绑定亲友资产`,
      path: `/pages/family-invite/index?token=${token}`
    };
  },

  viewMember(event) {
    const ownerOpenid = event.currentTarget.dataset.openid;
    setActiveOwner(ownerOpenid).then(() => {
      wx.switchTab({
        url: "/pages/dashboard/index"
      });
    });
  }
});
