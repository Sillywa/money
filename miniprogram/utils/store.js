let pendingWorkspacePromise = null;

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
  app.globalData.ownerOpenid = result.ownerOpenid || app.globalData.ownerOpenid || "";
  app.globalData.viewingOwner = normalizeProfile(result.viewingOwner) || app.globalData.profile;
  app.globalData.isViewingFamily = !!result.isViewingFamily;
  app.globalData.familyMembers = result.familyMembers || app.globalData.familyMembers || [];
  app.globalData.reminder = result.reminder || app.globalData.reminder || null;
  if (result.snapshots !== undefined) {
    app.globalData.snapshots = Array.isArray(result.snapshots) ? result.snapshots : [];
    app.globalData.workspaceLoaded = true;
    app.globalData.workspaceUpdatedAt = Date.now();
  }
  applyTheme(app.globalData.profile.darkMode);
  return {
    ...result,
    profile: app.globalData.profile,
    ownerOpenid: app.globalData.ownerOpenid,
    viewingOwner: app.globalData.viewingOwner,
    isViewingFamily: app.globalData.isViewingFamily,
    familyMembers: app.globalData.familyMembers,
    reminder: app.globalData.reminder,
    snapshots: result.snapshots !== undefined ? app.globalData.snapshots : result.snapshots
  };
}

function fetchWorkspace(options) {
  const opts = options || {};
  const cached = opts.force ? null : getCachedWorkspace();
  if (cached) return Promise.resolve(cached);
  if (!opts.force && pendingWorkspacePromise) return pendingWorkspacePromise;

  pendingWorkspacePromise = callCloud({ action: "workspace" }).then(updateGlobal).then((result) => {
    pendingWorkspacePromise = null;
    return result;
  }, (error) => {
    pendingWorkspacePromise = null;
    throw error;
  });
  return pendingWorkspacePromise;
}

function fetchSnapshots(options) {
  return fetchWorkspace(options).then((result) => result.snapshots || []);
}

function saveSnapshot(snapshot) {
  return callCloud({
    action: "upsert",
    snapshot
  }).then(updateGlobal);
}

function moveRecordDate(payload) {
  return callCloud({
    action: "moveRecordDate",
    payload
  }).then(updateGlobal);
}

function deleteRecordItem(payload) {
  return callCloud({
    action: "deleteRecordItem",
    payload
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

function setDarkMode(enabled) {
  const previous = getProfile().darkMode;
  applyTheme(!!enabled);
  return updateProfile({ darkMode: !!enabled }).catch((error) => {
    applyTheme(previous);
    throw error;
  });
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

function fetchFamilyAggregate() {
  return callCloud({ action: "familyAggregate" });
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
    viewingOwner: app.globalData.viewingOwner || null,
    darkMode: !!((app.globalData.profile || {}).darkMode)
  };
}

function getCachedWorkspace() {
  const app = getApp();
  if (!app.globalData.workspaceLoaded || !Array.isArray(app.globalData.snapshots)) return null;
  const profile = normalizeProfile(app.globalData.profile);
  return {
    openid: app.globalData.openid || "",
    profile,
    ownerOpenid: app.globalData.ownerOpenid || (app.globalData.viewingOwner && app.globalData.viewingOwner.openid) || profile.openid || "",
    viewingOwner: normalizeProfile(app.globalData.viewingOwner) || profile,
    isViewingFamily: !!app.globalData.isViewingFamily,
    familyMembers: app.globalData.familyMembers || [],
    reminder: app.globalData.reminder || null,
    snapshots: app.globalData.snapshots || []
  };
}

function getProfile() {
  return normalizeProfile(getApp().globalData.profile);
}

function getThemeClass() {
  return getProfile().darkMode ? "dark-mode" : "";
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
    darkMode: !!(profile && profile.darkMode),
    assetGuideSeen: !!(profile && profile.assetGuideSeen),
    activeOwnerOpenid: (profile && profile.activeOwnerOpenid) || "",
    dismissedCompletionReminderDates: normalizePlainObject(profile && profile.dismissedCompletionReminderDates),
    goalNetWorth: numberOrDefault(profile && profile.goalNetWorth, 1000000),
    calcPrincipal: numberOrDefault(profile && profile.calcPrincipal, 100000),
    calcAnnualRate: numberOrDefault(profile && profile.calcAnnualRate, 5),
    calcYears: numberOrDefault(profile && profile.calcYears, 10)
  };
}

function normalizePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function applyTheme(darkMode) {
  const isDark = !!darkMode;
  if (wx.setNavigationBarColor) {
    wx.setNavigationBarColor({
      frontColor: isDark ? "#ffffff" : "#000000",
      backgroundColor: isDark ? "#0F172A" : "#F7F9FC",
      animation: { duration: 120, timingFunc: "easeIn" }
    });
  }
  if (wx.setTabBarStyle) {
    wx.setTabBarStyle({
      color: isDark ? "#94A3B8" : "#7A8494",
      selectedColor: "#1769FF",
      backgroundColor: isDark ? "#111827" : "#FFFFFF",
      borderStyle: isDark ? "black" : "white"
    });
  }
}

module.exports = {
  acceptFamilyInvite,
  callCloud,
  createFamilyInvite,
  deleteRecordItem,
  fetchSnapshots,
  fetchFamilyAggregate,
  fetchWorkspace,
  getEditorInfo,
  getProfile,
  getThemeClass,
  getViewingInfo,
  moveRecordDate,
  returnToSelf,
  saveReminder,
  saveSnapshot,
  setActiveOwner,
  setDarkMode,
  setPrivacyEnabled,
  updateProfile
};
