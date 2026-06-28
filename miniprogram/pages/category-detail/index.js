const { CATEGORY_MAP } = require("../../utils/categories");
const {
  buildBundle,
  formatMoney,
  getCategoryHistory,
  maskBundle,
  maskHistoryGroups,
} = require("../../utils/asset");
const { fetchSnapshots, getProfile, getThemeClass, getViewingInfo } = require("../../utils/store");
const { showMetricHelp } = require("../../utils/metric-help");

const HISTORY_PAGE_SIZE = 12;

Page({
  data: {
    type: "wealth",
    category: null,
    bundle: null,
    summary: null,
    allHistoryGroups: [],
    historyGroups: [],
    historyPage: 1,
    hasMoreHistory: false,
    trendPoints: [],
    isCreditCard: false,
    isHousingFund: false,
    compareDate: "",
    compareOptions: [],
    compareIndex: 0,
    privacyMode: false,
    viewing: null,
    themeClass: "",
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

    return fetchSnapshots({ force: !!opts.force }).then((records) => {
      const rawBundle = buildBundle(records, opts.compareDate !== undefined ? opts.compareDate : this.data.compareDate);
      const privacyMode = !!((getProfile() || {}).privacyEnabled);
      const bundle = privacyMode ? maskBundle(rawBundle) : rawBundle;
      const category = CATEGORY_MAP[this.data.type] || CATEGORY_MAP.wealth;
      const summary = bundle.categories.find((item) => item.key === category.key);
      const compareOptions = bundle.compareRecords.map((record) => record.recordDate);
      const rawHistoryGroups = this.buildHistoryGroups(rawBundle, category.key);
      const allHistoryGroups = privacyMode ? maskHistoryGroups(rawHistoryGroups) : rawHistoryGroups;
      const historyGroups = allHistoryGroups.slice(0, HISTORY_PAGE_SIZE);
      this.setData({
        bundle,
        category,
        compareDate: rawBundle.previous.recordDate,
        compareOptions,
        compareIndex: Math.max(0, compareOptions.indexOf(bundle.previous.recordDate)),
        summary: {
          ...summary,
          amountDisplay: privacyMode ? "****" : formatMoney(summary.amount),
          count: `${summary.count} ${category.key === "wealth" ? "笔" : category.key === "bank" || category.key === "creditCard" ? "张" : "个"}`
        },
        allHistoryGroups,
        historyGroups,
        historyPage: 1,
        hasMoreHistory: allHistoryGroups.length > HISTORY_PAGE_SIZE,
        trendPoints: this.buildTrendPoints(rawHistoryGroups),
        isCreditCard: category.key === "creditCard",
        isHousingFund: category.key === "housingFund",
        privacyMode,
        viewing: getViewingInfo(),
        themeClass: getThemeClass(),
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

  onCompareChange(event) {
    const recordDate = event.detail.recordDate || this.data.compareOptions[Number(event.detail.value)];
    this.setData({ compareDate: recordDate });
    this.load({ compareDate });
  },

  onPullDownRefresh() {
    this.load({ silent: true, force: true }).then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.loadMoreHistory();
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
    const toggleGroup = (group) => ({
      ...group,
      expanded: group.recordDate === recordDate ? !group.expanded : group.expanded
    });
    this.setData({
      allHistoryGroups: this.data.allHistoryGroups.map(toggleGroup),
      historyGroups: this.data.historyGroups.map(toggleGroup)
    });
  },

  loadMoreHistory() {
    if (!this.data.hasMoreHistory) return;
    const nextPage = this.data.historyPage + 1;
    const nextEnd = nextPage * HISTORY_PAGE_SIZE;
    this.setData({
      historyGroups: this.data.allHistoryGroups.slice(0, nextEnd),
      historyPage: nextPage,
      hasMoreHistory: this.data.allHistoryGroups.length > nextEnd
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
