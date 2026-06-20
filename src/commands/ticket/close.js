// src/commands/ticket/close.js
const { SlashCommandBuilder } = require("discord.js");
const cfg = require("../../../setup");
const db  = require("../../db/database");
const {
  isTester, isStaff, isValidTier, VALID_TIERS,
  successEmbed, errorEmbed, warnEmbed,
  updateAllBoards, testerLog, staffLog,
} = require("../../utils/helpers");
const { closeTestChannel } = require("../../utils/ticketManager");
const { EmbedBuilder } = require("discord.js");
const { COLORS } = require("../../utils/helpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close a test ticket and award a rank")
    .addStringOption(o =>
      o.setName("ranking")
        .setDescription(`Tier to award (${VALID_TIERS.join(", ")})`)
        .setRequired(true)
    ),

  async execute(interaction) {
    const { user, member, channel, guild, client } = interaction;
    if (!isTester(member) && !isStaff(member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Testers only.")], ephemeral: true });
    }

    const ticket = db.getTicket(channel.id);
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed("Not a Ticket", "This command must be used in a test channel.")], ephemeral: true });
    }

    const ranking = interaction.options.getString("ranking").toUpperCase();
    if (!isValidTier(ranking)) {
      return interaction.reply({ embeds: [errorEmbed("Invalid Tier", `Valid tiers: ${VALID_TIERS.join(", ")}`)], ephemeral: true });
    }

    const player = db.getPlayer(ticket.player_id);
    if (!player) {
      return interaction.reply({ embeds: [errorEmbed("Player Not Found", "Could not find player profile.")], ephemeral: true });
    }

    const prevRank = player.current_rank;

    // Update rank
    db.setRank(ticket.player_id, ranking);

    // Update peak tier
    if (!player.peak_tier || compareTiers(ranking, player.peak_tier) > 0) {
      db.setPeakTier(ticket.player_id, ranking);
    }

    // Set cooldown
    db.setCooldown(ticket.player_id, cfg.COOLDOWN_HOURS);

    // Record history
    db.addHistory({
      discordId: ticket.player_id,
      ign: player.ign,
      testerId: user.id,
      tier: ranking,
      prevRank,
      notes: null,
      region: ticket.region,
      result: "pass",
    });

    // Increment quota
    db.incrementQuota(user.id);

    // Update Discord roles
    await applyTierRole(guild, ticket.player_id, ranking);

    // Post result
    await postResult(client, player, ranking, prevRank, user, ticket.region);

    await testerLog(client, `✅ <@${user.id}> tested **${player.ign}** → **${ranking}** (was ${prevRank || "Unranked"})`);

    // Close channel
    await closeTestChannel(client, guild, channel.id, true);
    await updateAllBoards(client);
  },
};

// ── /skip ────────────────────────────────────────────────────
const skipCmd = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Close ticket as discontinued (no cooldown)"),

  async execute(interaction) {
    const { user, member, channel, guild, client } = interaction;
    if (!isTester(member) && !isStaff(member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Testers only.")], ephemeral: true });
    }
    const ticket = db.getTicket(channel.id);
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed("Not a Ticket", "Must be used in a test channel.")], ephemeral: true });
    }
    const player = db.getPlayer(ticket.player_id);
    if (player) {
      db.addHistory({
        discordId: ticket.player_id,
        ign: player.ign,
        testerId: user.id,
        tier: null,
        prevRank: player.current_rank,
        notes: "Skipped",
        region: ticket.region,
        result: "skip",
      });
    }

    await testerLog(client, `⏭️ <@${user.id}> skipped test for **${player?.ign || ticket.player_id}**.`);
    await closeTestChannel(client, guild, channel.id, true);
    await updateAllBoards(client);
  },
};

module.exports.skip = skipCmd;

// ── Helpers ───────────────────────────────────────────────────
const TIER_ORDER = ["LT4","LT3","LT2","LT1","HT4","HT3","HT2","HT1","LT5","HT5"];
function compareTiers(a, b) {
  return (TIER_ORDER.indexOf(a) ?? -1) - (TIER_ORDER.indexOf(b) ?? -1);
}

async function applyTierRole(guild, discordId, tier) {
  const member = await guild.members.fetch(discordId).catch(() => null);
  if (!member) return;

  // Remove all tier roles
  const tierRoleIds = Object.values(cfg.ROLES.TIERS).filter(r => r !== "ROLE_ID");
  for (const roleId of tierRoleIds) {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId).catch(() => {});
    }
  }

  // Add new tier role
  const newRoleId = cfg.ROLES.TIERS[tier];
  if (newRoleId && newRoleId !== "ROLE_ID") {
    await member.roles.add(newRoleId).catch(() => {});
  }
}

async function postResult(client, player, tier, prevRank, tester, region) {
  const ch = await client.channels.fetch(cfg.CHANNELS.RESULTS).catch(() => null);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(COLORS.GREEN)
    .setTitle("🏆 Test Result")
    .addFields(
      { name: "Player", value: `<@${player.discord_id}> (${player.ign})`, inline: true },
      { name: "Tester", value: `<@${tester.id}>`, inline: true },
      { name: "Region", value: region, inline: true },
      { name: "Previous Rank", value: prevRank || "Unranked", inline: true },
      { name: "New Rank", value: `**${tier}**`, inline: true },
    )
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}
