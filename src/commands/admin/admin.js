// src/commands/admin/admin.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const cfg = require("../../../setup");
const db  = require("../../db/database");
const {
  isStaff, successEmbed, errorEmbed, infoEmbed,
  COLORS, staffLog, updateAllBoards,
} = require("../../utils/helpers");
const { buildQueuePanel } = require("../../utils/panelBuilder");

// /forceauth
const forceAuthCmd = {
  data: new SlashCommandBuilder()
    .setName("forceauth")
    .setDescription("Manually manage account links")
    .addSubcommand(sub =>
      sub.setName("set")
        .setDescription("Link a Discord user to an IGN")
        .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true))
        .addStringOption(o => o.setName("username").setDescription("Minecraft IGN").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("unlink")
        .setDescription("Unlink a user account")
        .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true))
    ),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();

    if (sub === "set") {
      const target = interaction.options.getUser("user");
      const ign    = interaction.options.getString("username").trim();
      db.upsertPlayer(target.id, ign);
      await staffLog(interaction.client, `🔗 <@${interaction.user.id}> force-linked <@${target.id}> → **${ign}**`);
      return interaction.reply({ embeds: [successEmbed("Account Linked", `<@${target.id}> linked to **${ign}**.`)] });
    }

    if (sub === "unlink") {
      const target = interaction.options.getUser("user");
      db.unlinkPlayer(target.id);
      await staffLog(interaction.client, `🔓 <@${interaction.user.id}> unlinked <@${target.id}>`);
      return interaction.reply({ embeds: [successEmbed("Account Unlinked", `<@${target.id}>'s account link removed.`)] });
    }
  },
};

// /cooldownreset
const cooldownResetCmd = {
  data: new SlashCommandBuilder()
    .setName("cooldownreset")
    .setDescription("Reset a user's cooldown")
    .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
    }
    const target = interaction.options.getUser("user");
    db.resetCooldown(target.id);
    await staffLog(interaction.client, `🔓 <@${interaction.user.id}> reset cooldown for <@${target.id}>`);
    return interaction.reply({ embeds: [successEmbed("Cooldown Reset", `Cooldown cleared for <@${target.id}>.`)] });
  },
};

// /addtester
const addTesterCmd = {
  data: new SlashCommandBuilder()
    .setName("addtester")
    .setDescription("Give a member the tester role")
    .addUserOption(o => o.setName("member").setDescription("Member to promote").setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
    }
    const target = interaction.options.getUser("member");
    const guildMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!guildMember) {
      return interaction.reply({ embeds: [errorEmbed("Not Found", "Member not found in this server.")], ephemeral: true });
    }
    await guildMember.roles.add(cfg.ROLES.TESTER).catch(() => {});
    await staffLog(interaction.client, `➕ <@${interaction.user.id}> gave tester role to <@${target.id}>`);
    return interaction.reply({ embeds: [successEmbed("Tester Added", `<@${target.id}> has been given the tester role.`)] });
  },
};

// /config
const configCmd = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Update bot configuration")
    .addSubcommand(sub =>
      sub.setName("quota")
        .setDescription("Update the monthly quota target")
        .addIntegerOption(o => o.setName("tests").setDescription("Number of tests per month").setRequired(true).setMinValue(1))
    ),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();
    if (sub === "quota") {
      const tests = interaction.options.getInteger("tests");
      db.setConfig("quota_target", String(tests));
      await staffLog(interaction.client, `⚙️ <@${interaction.user.id}> set quota target to **${tests}**`);
      return interaction.reply({ embeds: [successEmbed("Quota Updated", `Monthly quota target set to **${tests}** tests.`)] });
    }
  },
};

// /defaulttemplate
const defaultTemplateCmd = {
  data: new SlashCommandBuilder()
    .setName("defaulttemplate")
    .setDescription("Rebuild the default server template")
    .addBooleanOption(o => o.setName("confirm").setDescription("Confirm rebuild").setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
    }
    const confirm = interaction.options.getBoolean("confirm");
    if (!confirm) {
      return interaction.reply({ embeds: [errorEmbed("Cancelled", "Pass `confirm: True` to proceed.")], ephemeral: true });
    }

    await interaction.deferReply();

    const guild = interaction.guild;
    const created = {};

    // Create categories and channels
    const structure = [
      { type: "category", name: "📋 QUEUE" },
      { type: "text", name: "queue-panel", parent: "📋 QUEUE" },
      { type: "text", name: "na-waitlist",   parent: "📋 QUEUE" },
      { type: "text", name: "eu-waitlist",   parent: "📋 QUEUE" },
      { type: "text", name: "asau-waitlist", parent: "📋 QUEUE" },
      { type: "category", name: "🎮 TESTING" },
      { type: "category", name: "📊 LOGS" },
      { type: "text", name: "results",     parent: "📊 LOGS" },
      { type: "text", name: "staff-logs",  parent: "📊 LOGS" },
      { type: "text", name: "tester-logs", parent: "📊 LOGS" },
      { type: "text", name: "quota-board", parent: "📊 LOGS" },
    ];

    const { ChannelType } = require("discord.js");
    for (const item of structure) {
      if (item.type === "category") {
        const cat = await guild.channels.create({ name: item.name, type: ChannelType.GuildCategory });
        created[item.name] = cat.id;
      } else {
        const parentId = item.parent ? created[item.parent] : undefined;
        const ch = await guild.channels.create({ name: item.name, type: ChannelType.GuildText, parent: parentId });
        created[item.name] = ch.id;
      }
    }

    const lines = [
      "**Default template created!** Copy these IDs into `setup.js`:\n",
      "```",
      ...Object.entries(created).map(([k, v]) => `${k}: ${v}`),
      "```",
    ];

    await staffLog(interaction.client, `🏗️ Default template rebuilt by <@${interaction.user.id}>`);
    return interaction.editReply(lines.join("\n"));
  },
};

// /quotaboard
const quotaBoardCmd = {
  data: new SlashCommandBuilder()
    .setName("quotaboard")
    .setDescription("Show the tester quota leaderboard"),

  async execute(interaction) {
    const quota = db.getAllQuota();
    const target = Number(db.getConfig("quota_target") || cfg.DEFAULT_MONTHLY_QUOTA);

    if (!quota.length) {
      return interaction.reply({ embeds: [infoEmbed("Quota Board", "No tests recorded this month.")], ephemeral: true });
    }

    const lines = quota.slice(0, 20).map((q, i) => {
      const bar = buildBar(q.tests_done, target);
      return `\`${String(i+1).padStart(2)}.\` <@${q.discord_id}> — **${q.tests_done}/${target}** ${bar}`;
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle("📊 Monthly Tester Quota")
      .setDescription(lines.join("\n"))
      .setTimestamp();

    // Also update the board channel
    const ch = await interaction.client.channels.fetch(cfg.CHANNELS.QUOTA_BOARD).catch(() => null);
    if (ch) {
      const msgs = await ch.messages.fetch({ limit: 5 });
      const existing = msgs.find(m => m.author.id === interaction.client.user.id);
      if (existing) {
        await existing.edit({ embeds: [embed] }).catch(() => {});
      } else {
        await ch.send({ embeds: [embed] }).catch(() => {});
      }
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

function buildBar(done, target) {
  const pct = Math.min(done / target, 1);
  const filled = Math.round(pct * 10);
  return `[${"█".repeat(filled)}${"░".repeat(10 - filled)}]`;
}

module.exports = { forceAuthCmd, cooldownResetCmd, addTesterCmd, configCmd, defaultTemplateCmd, quotaBoardCmd };
