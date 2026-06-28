const CATEGORY_LIST = [
  {
    key: "bank",
    name: "银行卡",
    shortName: "银",
    color: "#174EA6",
    accent: "#174EA6",
    amountLabel: "银行卡总额",
    countLabel: "银行卡",
    addText: "新增资产记录",
    trendTitle: "记录趋势",
    listTitle: "资产记录历史",
    fields: ["bankName", "cardType", "tailNo", "amount", "remark"]
  },
  {
    key: "wealth",
    name: "理财",
    shortName: "理",
    color: "#7C3AED",
    accent: "#7C3AED",
    amountLabel: "理财总额",
    countLabel: "理财",
    addText: "新增资产记录",
    trendTitle: "记录趋势",
    listTitle: "资产记录历史",
    fields: ["name", "amount", "remark"]
  },
  {
    key: "wechat",
    name: "微信",
    shortName: "微",
    color: "#16A34A",
    accent: "#16A34A",
    amountLabel: "微信资产",
    countLabel: "账户",
    addText: "新增资产记录",
    trendTitle: "记录趋势",
    listTitle: "资产记录历史",
    fields: ["name", "amount", "remark"]
  },
  {
    key: "alipay",
    name: "支付宝",
    shortName: "支",
    color: "#00A3FF",
    accent: "#00A3FF",
    amountLabel: "支付宝资产",
    countLabel: "账户",
    addText: "新增资产记录",
    trendTitle: "记录趋势",
    listTitle: "资产记录历史",
    fields: ["name", "amount", "remark"]
  },
  {
    key: "housingFund",
    name: "公积金",
    shortName: "积",
    color: "#F59E0B",
    accent: "#F59E0B",
    amountLabel: "公积金总额",
    countLabel: "账户",
    addText: "新增资产记录",
    trendTitle: "记录趋势",
    listTitle: "资产记录历史",
    fields: ["name", "city", "accountType", "amount", "remark"]
  },
  {
    key: "creditCard",
    name: "信用卡",
    shortName: "卡",
    color: "#EF4444",
    accent: "#EF4444",
    amountLabel: "信用卡欠款",
    countLabel: "信用卡",
    addText: "新增资产记录",
    trendTitle: "欠款记录趋势",
    listTitle: "资产记录历史",
    fields: ["bankName", "tailNo", "billDay", "repaymentDay", "amount", "remark"],
    liability: true
  }
];

const CATEGORY_MAP = CATEGORY_LIST.reduce((map, item) => {
  map[item.key] = item;
  return map;
}, {});

module.exports = {
  CATEGORY_LIST,
  CATEGORY_MAP
};
