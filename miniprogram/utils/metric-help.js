const METRIC_HELP = {
  netWorth: {
    title: "净资产口径",
    content: "净资产 = 总资产 - 总负债。\n\n总资产是银行卡、理财、微信、支付宝、公积金等非负债资产合计，不包含信用卡欠款。\n\n总负债是信用卡欠款合计。"
  },
  totalAssets: {
    title: "总资产口径",
    content: "总资产 = 银行卡、理财、微信、支付宝、公积金等非负债资产合计。\n\n信用卡欠款属于负债，不计入总资产。"
  },
  accountCount: {
    title: "资产账户口径",
    content: "资产账户 = 当前记录日期下各类资产记录条数合计。\n\n银行卡、理财、微信、支付宝、公积金和信用卡都会计入账户数。"
  },
  totalLiabilities: {
    title: "总负债口径",
    content: "总负债 = 所有信用卡欠款合计。\n\n页面中负债金额以负数展示，用于和资产区分；计算时取欠款金额的绝对值。"
  },
  liabilityRate: {
    title: "负债率口径",
    content: "负债率 = 总负债绝对值 / (总负债绝对值 + 总资产)。\n\n这里的总资产不包含负债，只统计银行卡、理财、微信、支付宝、公积金等资产。"
  }
};

function showMetricHelp(event) {
  const type = event.currentTarget.dataset.type;
  const help = METRIC_HELP[type];

  if (!help) return;

  wx.showModal({
    title: help.title,
    content: help.content,
    showCancel: false,
    confirmText: "知道了"
  });
}

module.exports = {
  showMetricHelp
};
