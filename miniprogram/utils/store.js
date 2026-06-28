function callCloud(data) {
  if (!wx.cloud) {
    return Promise.reject(new Error("cloud is required"));
  }

  return wx.cloud.callFunction({
    name: "snapshots",
    data
  }).then((res) => res.result || {});
}

function updateGlobal(result) {
  const app = getApp();
  app.globalData.openid = result.openid || app.globalData.openid || "";
  app.globalData.profile = normalizeProfile(result.profile || app.globalData.profile);
  app.globalData.viewingOwner = normalizeProfile(result.viewingOwner) || app.globalData.profile;
  app.globalData.isViewingFamily = !!result.isViewingFamily;
  app.globalData.familyMembers = result.familyMembers || app.globalData.familyMembers || [];
  app.globalData.reminder = result.reminder || app.globalData.reminder || null;
  return result;
}

function fetchWorkspace() {
  return callCloud({ action: "workspace" }).then(updateGlobal);
}

function fetchSnapshots() {
  return fetchWorkspace().then((result) => result.snapshots || []);
}

function saveSnapshot(snapshot) {
  return callCloud({
    action: "upsert",
    snapshot
  }).then(updateGlobal);
}

function updateProfile(profile) {
  return callCloud({
    action: "profileUpdate",
    profile
  }).then(updateGlobal);
}

function setPrivacyEnabled(enabled) {
  return updateProfile({ privacyEnabled: !!enabled });
}

function getCompareDate() {
  const profile = getApp().globalData.profile || {};
  return profile.compareDate || "";
}

function setCompareDate(recordDate) {
  if (!recordDate) return Promise.resolve();
  const app = getApp();
  app.globalData.profile = {
    ...(app.globalData.profile || {}),
    compareDate: recordDate
  };
  return updateProfile({ compareDate: recordDate }).catch(() => {});
}

function createFamilyInvite() {
  return callCloud({ action: "familyInviteCreate" }).then(updateGlobal);
}

function acceptFamilyInvite(code) {
  return callCloud({
    action: "familyInviteAccept",
    code
  }).then(updateGlobal);
}

function setActiveOwner(ownerOpenid) {
  return callCloud({
    action: "setActiveOwner",
    ownerOpenid
  }).then(updateGlobal);
}

function returnToSelf() {
  return setActiveOwner("");
}

function saveReminder(dayOfMonth) {
  return callCloud({
    action: "reminderSave",
    dayOfMonth
  }).then(updateGlobal);
}

function getViewingInfo() {
  const app = getApp();
  return {
    isViewingFamily: !!app.globalData.isViewingFamily,
    viewingOwner: app.globalData.viewingOwner || null
  };
}

function getProfile() {
  return normalizeProfile(getApp().globalData.profile);
}

function getEditorInfo() {
  const app = getApp();
  const profile = normalizeProfile(app.globalData.profile);
  return {
    openid: app.globalData.openid || "",
    nickName: profile.nickName || "资产记录者",
    avatarUrl: profile.avatarUrl || ""
  };
}

function normalizeProfile(profile) {
  return {
    openid: (profile && profile.openid) || "",
    nickName: (profile && profile.nickName) || "资产记录者",
    avatarUrl: (profile && profile.avatarUrl) || "",
    privacyEnabled: !!(profile && profile.privacyEnabled),
    compareDate: (profile && profile.compareDate) || "",
    activeOwnerOpenid: (profile && profile.activeOwnerOpenid) || "",
    goalNetWorth: numberOrDefault(profile && profile.goalNetWorth, 1000000),
    calcPrincipal: numberOrDefault(profile && profile.calcPrincipal, 100000),
    calcAnnualRate: numberOrDefault(profile && profile.calcAnnualRate, 5),
    calcYears: numberOrDefault(profile && profile.calcYears, 10)
  };
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

module.exports = {
  acceptFamilyInvite,
  callCloud,
  createFamilyInvite,
  fetchSnapshots,
  fetchWorkspace,
  getCompareDate,
  getEditorInfo,
  getProfile,
  getViewingInfo,
  returnToSelf,
  saveReminder,
  saveSnapshot,
  setActiveOwner,
  setCompareDate,
  setPrivacyEnabled,
  updateProfile
};
