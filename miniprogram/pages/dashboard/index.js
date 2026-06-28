const { buildBundle, getNetTrend, maskBundle } = require("../../utils/asset");
const { fetchSnapshots, getProfile, getThemeClass, getViewingInfo, updateProfile } = require("../../utils/store");
const { showMetricHelp } = require("../../utils/metric-help");

Page({
  data: {
    bundle: null,
    donutItems: [],
    legendItems: [],
    compositionItems: [],
    compositionView: "list",
    trendPoints: [],
    accountCount: 0,
    compareDate: "",
    compareOptions: [],
    compareIndex: 0,
    privacyMode: false,
    viewing: null,
    themeClass: "",
    showAssetGuide: false,
    guideSaving: false,
    loading: true,
    hasLoaded: false
  },

  onShow() {
    this.load();
  },

  load(options) {
    const opts = options || {};
    if (!this.data.hasLoaded && !opts.silent) {
      this.setData({ loading: true });
    }

    return fetchSnapshots({ force: !!opts.force }).then((records) => {
      const rawBundle = buildBundle(records, opts.compareDate !== undefined ? opts.compareDate : this.data.compareDate);
      getApp().globalData.latestBundle = rawBundle;
      const profile = getProfile() || {};
      const privacyMode = !!profile.privacyEnabled;
      const bundle = privacyMode ? maskBundle(rawBundle) : rawBundle;
      const accountCount = rawBundle.categories.reduce((sum, item) => sum + item.count, 0);
      const compareOptions = bundle.compareRecords.map((record) => record.recordDate);
      const donutTotal = rawBundle.categories.reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
      const compositionItems = rawBundle.categories.map((rawItem, index) => {
        const item = bundle.categories[index];
        const weight = Math.abs(Number(item.amount || 0));
        const percent = donutTotal ? weight / donutTotal * 100 : 0;
        return {
          ...item,
          donutPercent: percent,
          donutPercentText: privacyMode ? "****" : `${percent.toFixed(1)}%`
        };
      });
      const viewing = getViewingInfo();
      const showAssetGuide = !viewing.isViewingFamily && !profile.assetGuideSeen && accountCount === 0;
      this.setData({
        bundle,
        accountCount,
        compareDate: rawBundle.previous.recordDate,
        compareOptions,
        compareIndex: Math.max(0, compareOptions.indexOf(bundle.previous.recordDate)),
        donutItems: compositionItems.map((item) => ({
          amount: Math.abs(Number(item.amount || 0)),
          color: item.color
        })),
        legendItems: compositionItems.map((item) => ({
          key: item.key,
          name: item.name,
          color: item.color
        })),
        compositionItems,
        trendPoints: getNetTrend(rawBundle.records),
        privacyMode,
        viewing,
        themeClass: getThemeClass(),
        showAssetGuide,
        loading: false,
        hasLoaded: true
      });
    }).catch(() => {
      this.setData({
        themeClass: getThemeClass(),
        loading: false,
        hasLoaded: true
      });
    });
  },

  onPullDownRefresh() {
    this.load({ silent: true, force: true }).then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  },

  onCompareChange(event) {
    const recordDate = event.detail.recordDate || this.data.compareOptions[Number(event.detail.value)];
    this.setData({ compareDate: recordDate });
    this.load({ compareDate });
  },

  showMetricHelp,

  setCompositionView(event) {
    const view = event.currentTarget.dataset.view || "list";
    this.setData({ compositionView: view });
  },

  goDetail(event) {
    const type = event.currentTarget.dataset.type;
    wx.navigateTo({
      url: `/pages/category-detail/index?type=${type}`
    });
  },

  closeAssetGuide() {
    this.markAssetGuideSeen().catch(() => {});
  },

  goAddAssetFromGuide() {
    this.markAssetGuideSeen().then(() => {
      wx.switchTab({
        url: "/pages/assets/index"
      });
    }).catch(() => {});
  },

  noop() {
    return false;
  },

  markAssetGuideSeen() {
    if (this.data.guideSaving) return Promise.resolve();
    this.setData({ guideSaving: true });
    return updateProfile({ assetGuideSeen: true }).then(() => {
      this.setData({
        showAssetGuide: false,
        guideSaving: false
      });
    }).catch(() => {
      this.setData({ guideSaving: false });
      wx.showToast({
        title: "稍后再试",
        icon: "none"
      });
      return Promise.reject(new Error("asset guide save failed"));
    });
  }
});
