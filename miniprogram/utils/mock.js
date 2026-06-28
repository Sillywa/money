const snapshots = [
  {
    recordDate: "2026-05-18",
    assets: {
      bank: [
        { id: "b1", bankName: "工商银行", cardType: "储蓄卡", tailNo: "4321", amount: 61240.18, remark: "工资卡" },
        { id: "b2", bankName: "农业银行", cardType: "储蓄卡", tailNo: "8877", amount: 41220.02, remark: "备用卡" }
      ],
      wealth: [
        { id: "w1", name: "中银理财-稳富", amount: 24000, remark: "封闭式产品" },
        { id: "w2", name: "招银日日欣", amount: 18000, remark: "活期理财" },
        { id: "w3", name: "货币基金A", amount: 31800, remark: "短期备用" },
        { id: "w4", name: "债券基金B", amount: 22620, remark: "稳健配置" }
      ],
      wechat: [
        { id: "wx1", name: "微信零钱", amount: 18420.45, remark: "日常备用" },
        { id: "wx2", name: "零钱通", amount: 28900.2, remark: "现金管理" }
      ],
      alipay: [
        { id: "a1", name: "支付宝余额", amount: 23880.3, remark: "日常消费" },
        { id: "a2", name: "余额宝", amount: 7600.12, remark: "备用金" }
      ],
      housingFund: [
        { id: "h1", name: "上海市住房公积金", city: "上海", accountType: "住房公积金", amount: 55540, remark: "每月缴存" }
      ],
      creditCard: [
        { id: "c1", bankName: "招商银行信用卡", tailNo: "1234", billDay: "12日", repaymentDay: "28日", amount: 11960, remark: "本期待还" }
      ]
    }
  },
  {
    recordDate: "2026-05-26",
    assets: {}
  },
  {
    recordDate: "2026-06-03",
    assets: {}
  },
  {
    recordDate: "2026-06-12",
    assets: {}
  },
  {
    recordDate: "2026-06-20",
    assets: {
      bank: [
        { id: "b1", bankName: "工商银行", cardType: "储蓄卡", tailNo: "4321", amount: 61340.18, remark: "工资卡" },
        { id: "b2", bankName: "农业银行", cardType: "储蓄卡", tailNo: "8877", amount: 42350.02, remark: "备用卡" }
      ],
      wealth: [
        { id: "w1", name: "中银理财-稳富", amount: 24000, remark: "封闭式产品" },
        { id: "w2", name: "招银日日欣", amount: 18780, remark: "活期理财" },
        { id: "w3", name: "货币基金A", amount: 32313.5, remark: "短期备用" },
        { id: "w4", name: "债券基金B", amount: 22935.3, remark: "稳健配置" }
      ],
      wechat: [
        { id: "wx1", name: "微信零钱", amount: 18355.75, remark: "日常备用" },
        { id: "wx2", name: "零钱通", amount: 28969.9, remark: "现金管理" }
      ],
      alipay: [
        { id: "a1", name: "支付宝余额", amount: 24000.3, remark: "日常消费" },
        { id: "a2", name: "余额宝", amount: 7600.12, remark: "备用金" }
      ],
      housingFund: [
        { id: "h1", name: "上海市住房公积金", city: "上海", accountType: "住房公积金", amount: 56160, remark: "每月缴存" }
      ],
      creditCard: [
        { id: "c1", bankName: "招商银行信用卡", tailNo: "1234", billDay: "12日", repaymentDay: "28日", amount: 12300, remark: "本期待还" }
      ]
    }
  },
  {
    recordDate: "2026-06-27",
    assets: {
      bank: [
        { id: "b1", bankName: "工商银行", cardType: "储蓄卡", tailNo: "4321", amount: 62540.18, remark: "工资卡" },
        { id: "b2", bankName: "农业银行", cardType: "储蓄卡", tailNo: "8877", amount: 42350.02, remark: "备用卡" }
      ],
      wealth: [
        { id: "w1", name: "中银理财-稳富", amount: 24560, remark: "封闭式产品" },
        { id: "w2", name: "招银日日欣", amount: 18900, remark: "活期理财" },
        { id: "w3", name: "货币基金A", amount: 32400, remark: "短期备用" },
        { id: "w4", name: "债券基金B", amount: 22890, remark: "稳健配置" }
      ],
      wechat: [
        { id: "wx1", name: "微信零钱", amount: 18230.45, remark: "日常备用" },
        { id: "wx2", name: "零钱通", amount: 28969.9, remark: "现金管理" }
      ],
      alipay: [
        { id: "a1", name: "支付宝余额", amount: 23650.3, remark: "日常消费" },
        { id: "a2", name: "余额宝", amount: 7600.12, remark: "备用金" }
      ],
      housingFund: [
        { id: "h1", name: "上海市住房公积金", city: "上海", accountType: "住房公积金", amount: 56780.39, remark: "每月缴存" }
      ],
      creditCard: [
        { id: "c1", bankName: "招商银行信用卡", tailNo: "1234", billDay: "12日", repaymentDay: "28日", amount: 12600, remark: "本期待还" }
      ]
    }
  }
];

function buildSnapshots() {
  const full = [];
  let lastAssets = null;

  snapshots.forEach((snapshot) => {
    const assets = Object.keys(snapshot.assets || {}).length ? snapshot.assets : lastAssets;
    const next = {
      recordDate: snapshot.recordDate,
      assets: JSON.parse(JSON.stringify(assets || {}))
    };
    full.push(next);
    lastAssets = next.assets;
  });

  return full;
}

module.exports = {
  snapshots: buildSnapshots()
};
