// src/commands/results/result.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const cfg = require("../../../setup");
const db  = require("../../db/database");
const {
  isTester, isStaff, isValidTier, VALID_TIERS,
  successEmbed, errorEmbed, infoEmbed, COLORS,
  testerLog, relativeTimestamp,
} = require("../../utils/helpers");

// /result
const resultCmd = {
  data: new SlashCommandBuilder()
    .setName("result")
    .setDescription("Submit a player test result")
    .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true))
    .addStringOption(o => o.setName("ign").setDescription("Minecraft IGN").setRequired(true))
    .addStringOption(o => o.setName("tier").setDescription(`Tier awarded (${VALID_TIERS.join(",")})`).setRequired(true))
    .addStringOption(o => o.setName("previous_rank").setDescription("Previous rank").setRequired(false))
    .addStringOption(o => o.setName("notes").setDescription("Optional notes").setRequired(false)),

  async execute(interaction) {
    if (!isTester(interaction.member) && !isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Testers only.")], ephemeral: true });
    }
    const target   = interaction.options.getUser("user");
    const ign      = interaction.options.getString("ign");
    const tier     = interaction.options.getString("tier").toUpperCase();
    const prevRank = interaction.options.getString("previous_rank") || null;
    const notes    = interaction.options.getString("notes") || null;

    if (!isValidTier(tier)) {
      return interaction.reply({ embeds: [errorEmbed("Invalid Tier", `Valid: ${VALID_TIERS.join(", ")}`)], ephemeral: true });
    }

    db.setRank(target.id, tier);
    db.setCooldown(target.id, cfg.COOLDOWN_HOURS);
    db.addHistory({ discordId: target.id, ign, testerId: interaction.user.id, tier, prevRank, notes, region: "Manual", result: "pass" });
    db.incrementQuota(interaction.user.id);

    await testerLog(interaction.client, `📝 Manual result by <@${interaction.user.id}>: **${ign}** → **${tier}**`);

    // Post to results channel
    const resultsCh = await interaction.client.channels.fetch(cfg.CHANNELS.RESULTS).catch(() => null);
    if (resultsCh) {
      const embed = new EmbedBuilder()
        .setColor(COLORS.GREEN)
        .setTitle("🏆 Test Result (Manual)")
        .addFields(
          { name: "Player", value: `<@${target.id}> (${ign})`, inline: true },
          { name: "Tester", value: `<@${interaction.user.id}>`, inline: true },
          { name: "Tier", value: `**${tier}**`, inline: true },
          { name: "Previous Rank", value: prevRank || "Unranked", inline: true },
        );
      if (notes) embed.addFields({ name: "Notes", value: notes });
      embed.setTimestamp();
      await resultsCh.send({ embeds: [embed] }).catch(() => {});
    }

    return interaction.reply({ embeds: [successEmbed("Result Submitted", `**${ign}** has been awarded **${tier}**.`)] });
  },
};

// /profile
const profileCmd = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Look up a player profile")
    .addStringOption(o => o.setName("username").setDescription("Minecraft IGN").setRequired(false))
    .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(false)),

  async execute(interaction) {
    const ign    = interaction.options.getString("username");
    const target = interaction.options.getUser("user");

    let player;
    if (ign) {
      player = db.getPlayerByIgn(ign);
    } else if (target) {
      player = db.getPlayer(target.id);
    } else {
      player = db.getPlayer(interaction.user.id);
    }

    if (!player) {
      return interaction.reply({ embeds: [errorEmbed("Not Found", "No profile found.")], ephemeral: true });
    }

    const cd = db.getCooldown(player.discord_id);
    const cooldownStr = cd && cd.expires_at > Math.floor(Date.now() / 1000)
      ? relativeTimestamp(cd.expires_at)
      : "None";

    const history = db.getHistory(player.discord_id, 3);
    const historyStr = history.length
      ? history.map(h => `\`${h.tier || "N/A"}\` — ${new Date(h.tested_at * 1000).toLocaleDateString()}`).join("\n")
      : "No history";

    const embed = new EmbedBuilder()
      .setColor(COLORS.BLUE)
      .setTitle(`👤 Profile — ${player.ign}`)
      .addFields(
        { name: "Discord", value: `<@${player.discord_id}>`, inline: true },
        { name: "IGN", value: player.ign, inline: true },
        { name: "Current Rank", value: player.current_rank || "Unranked", inline: true },
        { name: "Peak Tier", value: player.peak_tier || "None", inline: true },
        { name: "Cooldown", value: cooldownStr, inline: true },
        { name: "Recent Tests", value: historyStr },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};

// /history
const historyCmd = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("Show recent test history for a player")
    .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser("user") || interaction.user;
    const history = db.getHistory(target.id, 10);

    if (!history.length) {
      return interaction.reply({ embeds: [infoEmbed("No History", `No test history found for <@${target.id}>.`)], ephemeral: true });
    }

    const lines = history.map((h, i) =>
      `\`${i + 1}.\` **${h.tier || "Skipped"}** — ${h.ign} — ${h.region} — <t:${h.tested_at}:d>`
    );

    const embed = new EmbedBuilder()
      .setColor(COLORS.BLUE)
      .setTitle(`📜 Test History — ${target.username}`)
      .setDescription(lines.join("\n"))
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};

// /stats
const statsCmd = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show tester stats")
    .addUserOption(o => o.setName("user").setDescription("Tester to look up").setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser("user") || interaction.user;
    const stats  = db.getTesterStats(target.id);
    const quota  = db.getQuota(target.id);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle(`📊 Tester Stats — ${target.username}`)
      .addFields(
        { name: "Total Tests", value: String(stats.total), inline: true },
        { name: "Passed", value: String(stats.passed), inline: true },
        { name: "Skipped", value: String(stats.skipped), inline: true },
        { name: "This Month", value: String(quota?.tests_done || 0), inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};

module.exports = { resultCmd, profileCmd, historyCmd, statsCmd };
