// src/utils/helpers.js
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const cfg = require("../../setup");
const db = require("../db/database");

// ── Colour palette ───────────────────────────────────────────
const COLORS = {
  GREEN:  0x57f287,
  RED:    0xed4245,
  YELLOW: 0xfee75c,
  BLUE:   0x5865f2,
  PURPLE: 0x9b59b6,
  GREY:   0x99aab5,
  ORANGE: 0xe67e22,
};

// ── Simple embed builders ────────────────────────────────────
function successEmbed(title, description) {
  return new EmbedBuilder().setColor(COLORS.GREEN).setTitle(`✅ ${title}`).setDescription(description);
}
function errorEmbed(title, description) {
  return new EmbedBuilder().setColor(COLORS.RED).setTitle(`❌ ${title}`).setDescription(description);
}
function infoEmbed(title, description) {
  return new EmbedBuilder().setColor(COLORS.BLUE).setTitle(`ℹ️ ${title}`).setDescription(description);
}
function warnEmbed(title, description) {
  return new EmbedBuilder().setColor(COLORS.YELLOW).setTitle(`⚠️ ${title}`).setDescription(description);
}

// ── Permission helpers ───────────────────────────────────────
function isTester(member) {
  return member.roles.cache.has(cfg.ROLES.TESTER) || member.roles.cache.has(cfg.ROLES.STAFF);
}
function isStaff(member) {
  return member.roles.cache.has(cfg.ROLES.STAFF) ||
         member.permissions.has(PermissionFlagsBits.Administrator);
}

// ── Tier string validator ────────────────────────────────────
const VALID_TIERS = Object.keys(cfg.ROLES.TIERS);
function isValidTier(tier) {
  return VALID_TIERS.includes(tier.toUpperCase());
}

// ── Waitlist board updater ────────────────────────────────────
async function updateWaitlistBoard(client, region) {
  const channelKey = `WAITLIST_${region}`;
  const channelId = cfg.CHANNELS[channelKey];
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const waitlistCfg = cfg.WAITLISTS[region];
  if (!waitlistCfg) return;

  const testers = db.getTesters();
  const active  = testers.filter(t => t.status === "active");
  const standby = testers.filter(t => t.status === "standby");
  const queue   = db.getWaitlist(region);

  const embed = new EmbedBuilder()
    .setTitle(`📋 ${waitlistCfg.label} Waitlist`)
    .setTimestamp()
    .setColor(active.length ? COLORS.GREEN : COLORS.GREY);

  if (!waitlistCfg.enabled) {
    embed.setDescription("🔴 **This waitlist is currently disabled.**");
  } else if (!active.length && !standby.length) {
    embed.setDescription("😴 **No testers are online right now.**\nCheck back later!");
  } else {
    const activeLine = active.length
      ? active.map(t => `<@${t.discord_id}>`).join(", ")
      : "_None_";
    const standbyLine = standby.length
      ? standby.map(t => `<@${t.discord_id}>`).join(", ")
      : "_None_";

    embed.addFields(
      { name: "🟢 Active Testers", value: activeLine, inline: true },
      { name: "🟡 Standby Testers", value: standbyLine, inline: true },
    );

    if (queue.length === 0) {
      embed.addFields({ name: "Queue", value: "✅ Queue is empty" });
    } else {
      const queueLines = queue.slice(0, 20).map((e, i) =>
        `\`${i + 1}.\` <@${e.discord_id}> — **${e.ign}**${e.pref_server ? ` *(${e.pref_server})*` : ""}`
      );
      if (queue.length > 20) queueLines.push(`…and ${queue.length - 20} more`);
      embed.addFields({ name: `Queue (${queue.length})`, value: queueLines.join("\n") });
    }
  }

  // Update or send the pinned board message
  const messages = await channel.messages.fetch({ limit: 10 });
  const existing = messages.find(m => m.author.id === client.user.id);
  if (existing) {
    await existing.edit({ embeds: [embed] }).catch(() => {});
  } else {
    await channel.send({ embeds: [embed] }).catch(() => {});
  }
}

async function updateAllBoards(client) {
  for (const region of Object.keys(cfg.WAITLISTS)) {
    await updateWaitlistBoard(client, region);
  }
}

// ── Staff logger ─────────────────────────────────────────────
async function staffLog(client, content) {
  const ch = await client.channels.fetch(cfg.CHANNELS.STAFF_LOGS).catch(() => null);
  if (ch) ch.send(content).catch(() => {});
}
async function testerLog(client, content) {
  const ch = await client.channels.fetch(cfg.CHANNELS.TESTER_LOGS).catch(() => null);
  if (ch) ch.send(content).catch(() => {});
}

// ── Format seconds as relative timestamp ────────────────────
function relativeTimestamp(unixSeconds) {
  return `<t:${unixSeconds}:R>`;
}

module.exports = {
  COLORS,
  successEmbed, errorEmbed, infoEmbed, warnEmbed,
  isTester, isStaff, isValidTier, VALID_TIERS,
  updateWaitlistBoard, updateAllBoards,
  staffLog, testerLog,
  relativeTimestamp,
};
