const { CATEGORY_MAP } = require("../../utils/categories");
const {
  buildBundle,
  formatMoney,
  getCategoryHistory,
  maskBundle,
  maskHistoryGroups,
} = require("../../utils/asset");
const { fetchSnapshots, getCompareDate, getProfile, getViewingInfo, setCompareDate } = require("../../utils/store");
const { showMetricHelp } = require("../../utils/metric-help");

Page({
  data: {
    type: "wealth",
    category: null,
    bundle: null,
    summary: null,
    historyGroups: [],
    trendPoints: [],
    isCreditCard: false,
    isHousingFund: false,
    compareOptions: [],
    compareIndex: 0,
    privacyMode: false,
    viewing: null,
    loading: true,
    hasLoaded: false
  },

  onLoad(query) {
    const type = query.type || "wealth";
    const category = CATEGORY_MAP[type] || CATEGORY_MAP.wealth;
    this.setData({ type });
    wx.setNavigationBarTitle({
      title: `${category.name}详情`
    });
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
      const rawBundle = buildBundle(records, getCompareDate());
      setCompareDate(rawBundle.previous.recordDate);
      const privacyMode = !!((getProfile() || {}).privacyEnabled);
      const bundle = privacyMode ? maskBundle(rawBundle) : rawBundle;
      const category = CATEGORY_MAP[this.data.type] || CATEGORY_MAP.wealth;
      const summary = bundle.categories.find((item) => item.key === category.key);
      const compareOptions = bundle.compareRecords.map((record) => record.recordDate);
      const rawHistoryGroups = this.buildHistoryGroups(rawBundle, category.key);
      const historyGroups = privacyMode ? maskHistoryGroups(rawHistoryGroups) : rawHistoryGroups;
      this.setData({
        bundle,
        category,
        compareOptions,
        compareIndex: Math.max(0, compareOptions.indexOf(bundle.previous.recordDate)),
        summary: {
          ...summary,
          amountDisplay: privacyMode ? "****" : formatMoney(summary.amount),
          count: `${summary.count} ${category.key === "wealth" ? "笔" : category.key === "bank" || category.key === "creditCard" ? "张" : "个"}`
        },
        historyGroups,
        trendPoints: this.buildTrendPoints(rawHistoryGroups),
        isCreditCard: category.key === "creditCard",
        isHousingFund: category.key === "housingFund",
        privacyMode,
        viewing: getViewingInfo(),
        loading: false,
        hasLoaded: true
      });
    }).catch(() => {
      this.setData({ loading: false, hasLoaded: true });
    });
  },

  onCompareChange(event) {
    const recordDate = event.detail.recordDate || this.data.compareOptions[Number(event.detail.value)];
    setCompareDate(recordDate);
    this.load();
  },

  onPullDownRefresh() {
    this.load({ silent: true }).then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  },

  showMetricHelp,

  buildHistoryGroups(bundle, categoryKey) {
    const openedMap = this.data.historyGroups.reduce((map, group) => {
      map[group.recordDate] = group.expanded;
      return map;
    }, {});

    return getCategoryHistory(bundle.records, categoryKey).map((group, index) => ({
      ...group,
      expanded: openedMap[group.recordDate] !== undefined ? openedMap[group.recordDate] : index === 0
    }));
  },

  buildTrendPoints(historyGroups) {
    return historyGroups
      .slice()
      .sort((a, b) => a.recordDate > b.recordDate ? 1 : -1)
      .map((group) => ({
        label: group.recordDate.slice(5),
        value: group.total
      }));
  },

  toggleHistoryGroup(event) {
    const recordDate = event.currentTarget.dataset.recordDate;
    this.setData({
      historyGroups: this.data.historyGroups.map((group) => ({
        ...group,
        expanded: group.recordDate === recordDate ? !group.expanded : group.expanded
      }))
    });
  },

  goBack() {
    wx.navigateBack();
  },

  addItem() {
    wx.navigateTo({
      url: `/pages/record/index?type=${this.data.type}`
    });
  },

  editItem(event) {
    const { index, recordDate } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/record/index?type=${this.data.type}&index=${index}&recordDate=${recordDate}`
    });
  }
});
