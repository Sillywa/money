const { buildBundle, getNetTrend, maskBundle } = require("../../utils/asset");
const { fetchSnapshots, getProfile, getViewingInfo } = require("../../utils/store");
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

    return fetchSnapshots().then((records) => {
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
        loading: false,
        hasLoaded: true
      });
    }).catch(() => {
      this.setData({ loading: false, hasLoaded: true });
    });
  },

  onPullDownRefresh() {
    this.load({ silent: true }).then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
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
  }
});
