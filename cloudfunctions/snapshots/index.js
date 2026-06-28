const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const snapshots = db.collection("asset_snapshots");
const profiles = db.collection("asset_user_profiles");
const bindings = db.collection("asset_family_bindings");
const invites = db.collection("asset_family_invites");
const reminders = db.collection("asset_reminders");
const MAX_LIMIT = 100;
const MAX_PAGES = 10;
const REMINDER_SEND_BATCH_SIZE = 20;
const SCHEMA_VERSION = 1;
const REMINDER_TEMPLATE_ID = "98bBTWPLWqXjG3Vkaxn7UlteZISy2sHdYDKiB1FcyMw";

exports.main = async (event) => {
  if (event && event.Type === "Timer") {
    return sendDueReminders(REMINDER_TEMPLATE_ID);
  }

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const action = event.action || "workspace";

  if (action === "login") {
    const profile = await ensureProfile(openid);
    return { openid, profile: stripProfile(profile) };
  }

  if (action === "workspace") {
    return buildWorkspace(openid);
  }

  if (action === "profileUpdate") {
    await updateProfile(openid, event.profile || {});
    return buildWorkspace(openid);
  }

  if (action === "list") {
    const ownerOpenid = await resolveOwnerOpenid(openid, event.ownerOpenid);
    const data = await listSnapshots(ownerOpenid);
    return {
      openid,
      ownerOpenid,
      snapshots: data.map(stripSnapshot)
    };
  }

  if (action === "get") {
    const ownerOpenid = await resolveOwnerOpenid(openid, event.ownerOpenid);
    const recordDate = event.recordDate;
    if (!recordDate) throw new Error("recordDate is required");
    const result = await snapshots.where({ ownerOpenid, recordDate }).limit(1).get();
    return {
      openid,
      ownerOpenid,
      snapshot: result.data[0] ? stripSnapshot(result.data[0]) : null
    };
  }

  if (action === "upsert") {
    const snapshot = event.snapshot || {};
    if (!snapshot.recordDate) throw new Error("recordDate is required");
    const profile = await ensureProfile(openid);
    const ownerOpenid = await resolveOwnerOpenid(openid, event.ownerOpenid);
    const editor = {
      openid,
      nickName: profile.nickName || "资产记录者",
      avatarUrl: profile.avatarUrl || ""
    };
    await upsertSnapshot(ownerOpenid, snapshot, editor);
    return buildWorkspace(openid);
  }

  if (action === "moveRecordDate") {
    const payload = event.payload || {};
    if (!payload.categoryKey) throw new Error("categoryKey is required");
    if (!payload.fromRecordDate) throw new Error("fromRecordDate is required");
    if (!payload.toRecordDate) throw new Error("toRecordDate is required");
    const profile = await ensureProfile(openid);
    const ownerOpenid = await resolveOwnerOpenid(openid, event.ownerOpenid);
    const editor = {
      openid,
      nickName: profile.nickName || "资产记录者",
      avatarUrl: profile.avatarUrl || ""
    };
    await moveRecordDate(ownerOpenid, payload, editor);
    return buildWorkspace(openid);
  }

  if (action === "deleteRecordItem") {
    const payload = event.payload || {};
    if (!payload.categoryKey) throw new Error("categoryKey is required");
    if (!payload.recordDate) throw new Error("recordDate is required");
    const profile = await ensureProfile(openid);
    const ownerOpenid = await resolveOwnerOpenid(openid, event.ownerOpenid);
    const editor = {
      openid,
      nickName: profile.nickName || "资产记录者",
      avatarUrl: profile.avatarUrl || ""
    };
    await deleteRecordItem(ownerOpenid, payload, editor);
    return buildWorkspace(openid);
  }

  if (action === "delete") {
    const ownerOpenid = await resolveOwnerOpenid(openid, event.ownerOpenid);
    const recordDate = event.recordDate;
    if (!recordDate) throw new Error("recordDate is required");
    const existed = await snapshots.where({ ownerOpenid, recordDate }).limit(1).get();
    if (existed.data.length) {
      await snapshots.doc(existed.data[0]._id).remove();
    }
    return buildWorkspace(openid);
  }

  if (action === "replaceAll") {
    const ownerOpenid = await resolveOwnerOpenid(openid, event.ownerOpenid);
    const profile = await ensureProfile(openid);
    const editor = {
      openid,
      nickName: profile.nickName || "资产记录者",
      avatarUrl: profile.avatarUrl || ""
    };
    const existed = await listSnapshots(ownerOpenid);
    await Promise.all(existed.map((item) => snapshots.doc(item._id).remove()));
    await Promise.all((Array.isArray(event.snapshots) ? event.snapshots : []).map((snapshot) => upsertSnapshot(ownerOpenid, snapshot, editor)));
    return buildWorkspace(openid);
  }

  if (action === "familyInviteCreate") {
    const profile = await ensureProfile(openid);
    const code = createInviteCode();
    await invites.add({
      data: {
        _openid: openid,
        ownerOpenid: openid,
        ownerNickName: profile.nickName || "资产记录者",
        ownerAvatarUrl: profile.avatarUrl || "",
        code,
        status: "active",
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    return {
      ...(await buildWorkspace(openid)),
      inviteCode: code
    };
  }

  if (action === "familyInviteAccept") {
    const code = String(event.code || "").trim().toUpperCase();
    if (!code) throw new Error("code is required");
    const inviteResult = await invites.where({ code, status: "active" }).limit(1).get();
    if (!inviteResult.data.length) throw new Error("invite code is invalid");
    const invite = inviteResult.data[0];
    if (invite.ownerOpenid === openid) throw new Error("cannot bind yourself");
    await ensureProfile(openid);
    await ensureFamilyBinding(openid, invite.ownerOpenid);
    await ensureFamilyBinding(invite.ownerOpenid, openid);
    await invites.doc(invite._id).update({
      data: {
        status: "accepted",
        acceptedByOpenid: openid,
        updatedAt: db.serverDate()
      }
    });
    return buildWorkspace(openid);
  }

  if (action === "setActiveOwner") {
    const profile = await ensureProfile(openid);
    const ownerOpenid = event.ownerOpenid || "";
    if (ownerOpenid && ownerOpenid !== openid) {
      await assertCanAccess(openid, ownerOpenid);
    }
    await profiles.doc(profile._id).update({
      data: {
        activeOwnerOpenid: ownerOpenid,
        updatedAt: db.serverDate()
      }
    });
    return buildWorkspace(openid);
  }

  if (action === "familyAggregate") {
    return buildFamilyAggregate(openid);
  }

  if (action === "reminderSave") {
    const dayOfMonth = clampDay(event.dayOfMonth);
    await upsertReminder(openid, dayOfMonth);
    return buildWorkspace(openid);
  }

  if (action === "reminderList") {
    const reminder = await getReminder(openid);
    return { openid, reminder };
  }

  if (action === "sendDueReminders") {
    return sendDueReminders(event.templateId || REMINDER_TEMPLATE_ID);
  }

  throw new Error(`Unknown action: ${action}`);
};

async function buildWorkspace(openid) {
  const profile = await ensureProfile(openid);
  const ownerOpenid = await resolveOwnerOpenid(openid);
  const [data, ownerProfile, familyMembers, reminder] = await Promise.all([
    listSnapshots(ownerOpenid),
    ensureProfile(ownerOpenid),
    listFamilyMembers(openid),
    getReminder(openid)
  ]);

  return {
    openid,
    profile: stripProfile(profile),
    ownerOpenid,
    viewingOwner: stripProfile(ownerProfile),
    isViewingFamily: ownerOpenid !== openid,
    familyMembers,
    reminder,
    snapshots: data.map(stripSnapshot)
  };
}

async function buildFamilyAggregate(openid) {
  const profile = await ensureProfile(openid);
  const familyMembers = await listFamilyMembers(openid);
  const owners = [stripProfile(profile), ...familyMembers];
  const members = await Promise.all(owners.map(async (owner) => {
    const data = await listSnapshots(owner.openid);
    const latest = data[data.length - 1] || null;
    const summary = latest ? summarizeSnapshot(latest) : {
      totalAssets: 0,
      totalLiabilities: 0,
      totalNet: 0,
      accountCount: 0
    };
    return {
      owner,
      latestRecordDate: latest ? latest.recordDate : "",
      ...summary
    };
  }));
  const totalAssets = members.reduce((sum, item) => sum + item.totalAssets, 0);
  const totalLiabilities = members.reduce((sum, item) => sum + item.totalLiabilities, 0);
  return {
    openid,
    members,
    totalAssets,
    totalLiabilities,
    totalNet: totalAssets - totalLiabilities,
    accountCount: members.reduce((sum, item) => sum + item.accountCount, 0)
  };
}

async function ensureProfile(openid) {
  const result = await profiles.where({ openid }).limit(1).get();
  if (result.data.length) return result.data[0];
  await profiles.add({
    data: {
      _openid: openid,
      openid,
      nickName: "资产记录者",
      avatarUrl: "",
      privacyEnabled: false,
      darkMode: false,
      assetGuideSeen: false,
      activeOwnerOpenid: "",
      dismissedCompletionReminderDates: {},
      goalNetWorth: 1000000,
      calcPrincipal: 100000,
      calcAnnualRate: 5,
      calcYears: 10,
      schemaVersion: SCHEMA_VERSION,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  const created = await profiles.where({ openid }).limit(1).get();
  return created.data[0];
}

async function updateProfile(openid, profile) {
  const current = await ensureProfile(openid);
  const data = {};
  ["nickName", "avatarUrl", "privacyEnabled", "darkMode", "assetGuideSeen", "dismissedCompletionReminderDates", "goalNetWorth", "calcPrincipal", "calcAnnualRate", "calcYears"].forEach((key) => {
    if (profile[key] !== undefined) data[key] = profile[key];
  });
  data.updatedAt = db.serverDate();
  await profiles.doc(current._id).update({ data });
}

async function resolveOwnerOpenid(openid, requestedOwnerOpenid) {
  const profile = await ensureProfile(openid);
  const ownerOpenid = requestedOwnerOpenid || profile.activeOwnerOpenid || openid;
  if (ownerOpenid !== openid) await assertCanAccess(openid, ownerOpenid);
  return ownerOpenid;
}

async function assertCanAccess(viewerOpenid, ownerOpenid) {
  const result = await bindings.where({
    viewerOpenid,
    ownerOpenid,
    status: "accepted"
  }).limit(1).get();
  if (!result.data.length) throw new Error("permission denied");
}

async function listSnapshots(ownerOpenid) {
  const all = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await snapshots
      .where({ ownerOpenid })
      .orderBy("recordDate", "asc")
      .skip(page * MAX_LIMIT)
      .limit(MAX_LIMIT)
      .get();
    all.push(...result.data);
    if (result.data.length < MAX_LIMIT) break;
  }
  return all;
}

async function upsertSnapshot(ownerOpenid, snapshot, editor) {
  const data = {
    ownerOpenid,
    recordDate: snapshot.recordDate,
    assets: normalizeAssets(snapshot.assets),
    lastEditor: editor,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: db.serverDate()
  };
  const existed = await snapshots.where({ ownerOpenid, recordDate: snapshot.recordDate }).limit(1).get();
  if (existed.data.length) {
    await snapshots.doc(existed.data[0]._id).update({ data });
    return;
  }
  await snapshots.add({
    data: {
      _openid: ownerOpenid,
      ...data,
      createdAt: db.serverDate()
    }
  });
}

async function moveRecordDate(ownerOpenid, payload, editor) {
  if (!db.runTransaction) throw new Error("transaction is required");
  const itemIndex = Number(payload.index);
  if (!Number.isInteger(itemIndex) || itemIndex < 0) throw new Error("index is invalid");

  await db.runTransaction(async (transaction) => {
    const snapshotCollection = transaction.collection("asset_snapshots");
    const sourceResult = await snapshotCollection
      .where({ ownerOpenid, recordDate: payload.fromRecordDate })
      .limit(1)
      .get();
    if (!sourceResult.data.length) throw new Error("source snapshot not found");

    const source = sourceResult.data[0];
    const sourceAssets = normalizeAssets(cloneValue(source.assets));
    const sourceList = ((sourceAssets && sourceAssets[payload.categoryKey]) || []).slice();
    const originalItem = sourceList[itemIndex];
    if (!originalItem) throw new Error("source item not found");

    const movedItem = {
      ...originalItem,
      ...(payload.item || {}),
      editorOpenid: editor && editor.openid,
      editorName: editor && editor.nickName,
      editorAvatarUrl: editor && editor.avatarUrl
    };

    sourceList.splice(itemIndex, 1);
    sourceAssets[payload.categoryKey] = sourceList;

    const targetResult = await snapshotCollection
      .where({ ownerOpenid, recordDate: payload.toRecordDate })
      .limit(1)
      .get();
    let target = targetResult.data[0] || null;

    if (!target) {
      target = {
        ownerOpenid,
        recordDate: payload.toRecordDate,
        assets: {},
        schemaVersion: SCHEMA_VERSION
      };
    }

    const targetAssets = normalizeAssets(cloneValue(target.assets));
    const targetList = ((targetAssets && targetAssets[payload.categoryKey]) || []).slice();
    targetAssets[payload.categoryKey] = movedItem.id
      ? targetList.filter((item) => item.id !== movedItem.id)
      : targetList;
    targetAssets[payload.categoryKey].push(movedItem);

    await snapshotCollection.doc(source._id).update({
      data: {
        assets: sourceAssets,
        lastEditor: editor,
        schemaVersion: SCHEMA_VERSION,
        updatedAt: db.serverDate()
      }
    });

    if (target._id) {
      await snapshotCollection.doc(target._id).update({
        data: {
          assets: targetAssets,
          lastEditor: editor,
          schemaVersion: SCHEMA_VERSION,
          updatedAt: db.serverDate()
        }
      });
      return;
    }

    await snapshotCollection.add({
      data: {
        _openid: ownerOpenid,
        ownerOpenid,
        recordDate: payload.toRecordDate,
        assets: targetAssets,
        lastEditor: editor,
        schemaVersion: SCHEMA_VERSION,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
  });
}

async function deleteRecordItem(ownerOpenid, payload, editor) {
  if (!db.runTransaction) throw new Error("transaction is required");
  const itemIndex = Number(payload.index);
  if (!Number.isInteger(itemIndex) || itemIndex < 0) throw new Error("index is invalid");

  await db.runTransaction(async (transaction) => {
    const snapshotCollection = transaction.collection("asset_snapshots");
    const result = await snapshotCollection
      .where({ ownerOpenid, recordDate: payload.recordDate })
      .limit(1)
      .get();
    if (!result.data.length) throw new Error("snapshot not found");

    const snapshot = result.data[0];
    const assets = normalizeAssets(cloneValue(snapshot.assets));
    const list = ((assets && assets[payload.categoryKey]) || []).slice();
    const targetIndex = findRecordItemIndex(list, itemIndex, payload.itemId);
    if (targetIndex < 0) throw new Error("item not found");

    list.splice(targetIndex, 1);
    assets[payload.categoryKey] = list;

    if (isAssetsEmpty(assets)) {
      await snapshotCollection.doc(snapshot._id).remove();
      return;
    }

    await snapshotCollection.doc(snapshot._id).update({
      data: {
        assets,
        lastEditor: editor,
        schemaVersion: SCHEMA_VERSION,
        updatedAt: db.serverDate()
      }
    });
  });
}

async function ensureFamilyBinding(viewerOpenid, ownerOpenid) {
  const existed = await bindings.where({ viewerOpenid, ownerOpenid }).limit(1).get();
  if (existed.data.length) {
    await bindings.doc(existed.data[0]._id).update({
      data: {
        status: "accepted",
        updatedAt: db.serverDate()
      }
    });
    return;
  }
  await bindings.add({
    data: {
      _openid: viewerOpenid,
      viewerOpenid,
      ownerOpenid,
      status: "accepted",
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
}

async function listFamilyMembers(openid) {
  const result = await bindings.where({ viewerOpenid: openid, status: "accepted" }).limit(100).get();
  return Promise.all(result.data.map(async (binding) => {
    const profile = await ensureProfile(binding.ownerOpenid);
    return stripProfile(profile);
  }));
}

async function upsertReminder(openid, dayOfMonth) {
  const existed = await reminders.where({ openid }).limit(1).get();
  const data = {
    _openid: openid,
    openid,
    enabled: true,
    dayOfMonth,
    hour: 10,
    minute: 0,
    updatedAt: db.serverDate()
  };
  if (existed.data.length) {
    await reminders.doc(existed.data[0]._id).update({ data });
    return;
  }
  await reminders.add({
    data: {
      ...data,
      createdAt: db.serverDate()
    }
  });
}

async function getReminder(openid) {
  const result = await reminders.where({ openid }).limit(1).get();
  return result.data[0] || { enabled: false, dayOfMonth: 1, hour: 10, minute: 0 };
}

async function sendDueReminders(templateId) {
  if (!templateId) return { ok: false, reason: "templateId is required" };
  const now = new Date();
  const dayOfMonth = now.getDate();
  const hour = now.getHours();
  const sent = [];
  const failed = [];
  let total = 0;

  for (let page = 0; ; page += 1) {
    const result = await reminders
      .where({ enabled: true, dayOfMonth, hour })
      .skip(page * MAX_LIMIT)
      .limit(MAX_LIMIT)
      .get();
    const dueReminders = result.data || [];
    total += dueReminders.length;

    for (let index = 0; index < dueReminders.length; index += REMINDER_SEND_BATCH_SIZE) {
      const batch = dueReminders.slice(index, index + REMINDER_SEND_BATCH_SIZE);
      const results = await Promise.all(batch.map((reminder) => sendReminderMessage(reminder, templateId, dayOfMonth)));
      results.forEach((item) => {
        if (item.ok) sent.push(item.openid);
        else failed.push(item.openid);
      });
    }

    if (dueReminders.length < MAX_LIMIT) break;
  }

  return { ok: true, total, count: sent.length, failed: failed.length };
}

async function sendReminderMessage(reminder, templateId, dayOfMonth) {
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: reminder.openid,
      templateId,
      page: "pages/dashboard/index",
      data: {
        time1: { value: `${dayOfMonth}日 10:00` },
        thing2: { value: "请记录本月资产" }
      }
    });
    return { ok: true, openid: reminder.openid };
  } catch (error) {
    return { ok: false, openid: reminder.openid };
  }
}

function normalizeAssets(assets) {
  return assets && typeof assets === "object" ? assets : {};
}

function findRecordItemIndex(list, fallbackIndex, itemId) {
  if (itemId) {
    const idIndex = list.findIndex((item) => item && item.id === itemId);
    if (idIndex >= 0) return idIndex;
  }
  return list[fallbackIndex] ? fallbackIndex : -1;
}

function isAssetsEmpty(assets) {
  return Object.keys(assets || {}).every((key) => !Array.isArray(assets[key]) || assets[key].length === 0);
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function stripSnapshot(item) {
  return {
    recordDate: item.recordDate,
    assets: item.assets || {},
    lastEditor: item.lastEditor || null
  };
}

function summarizeSnapshot(snapshot) {
  const totalAssets = sumAssets(snapshot);
  const totalLiabilities = sumLiabilities(snapshot);
  return {
    totalAssets,
    totalLiabilities,
    totalNet: totalAssets - totalLiabilities,
    accountCount: countAccounts(snapshot)
  };
}

function countAccounts(snapshot) {
  const assets = snapshot.assets || {};
  return Object.keys(assets).reduce((sum, key) => {
    const list = assets[key];
    return sum + (Array.isArray(list) ? list.length : 0);
  }, 0);
}

function sumAssets(snapshot) {
  return ["bank", "wealth", "wechat", "alipay", "housingFund"].reduce((sum, key) => sum + sumCategory(snapshot, key), 0);
}

function sumLiabilities(snapshot) {
  return sumCategory(snapshot, "creditCard");
}

function sumCategory(snapshot, key) {
  const list = (snapshot.assets && snapshot.assets[key]) || [];
  return list.reduce((sum, item) => sum + numberOrDefault(item && item.amount, 0), 0);
}

function stripProfile(profile) {
  return {
    openid: profile.openid,
    nickName: profile.nickName || "资产记录者",
    avatarUrl: profile.avatarUrl || "",
    privacyEnabled: !!profile.privacyEnabled,
    darkMode: !!profile.darkMode,
    assetGuideSeen: !!profile.assetGuideSeen,
    activeOwnerOpenid: profile.activeOwnerOpenid || "",
    dismissedCompletionReminderDates: normalizePlainObject(profile.dismissedCompletionReminderDates),
    goalNetWorth: numberOrDefault(profile.goalNetWorth, 1000000),
    calcPrincipal: numberOrDefault(profile.calcPrincipal, 100000),
    calcAnnualRate: numberOrDefault(profile.calcAnnualRate, 5),
    calcYears: numberOrDefault(profile.calcYears, 10)
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

function createInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function clampDay(value) {
  const number = Number(value || 1);
  if (number < 1) return 1;
  if (number > 28) return 28;
  return Math.floor(number);
}
