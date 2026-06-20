// src/commands/rank/rank.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const cfg = require("../../../setup");
const db  = require("../../db/database");
const {
  isStaff, isValidTier, VALID_TIERS,
  successEmbed, errorEmbed,
  staffLog, COLORS,
} = require("../../utils/helpers");

// /setrank user
const setRankUserCmd = {
  data: new SlashCommandBuilder()
    .setName("setrankuser")
    .setDescription("Update a Discord user's rank")
    .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
    .addStringOption(o => o.setName("rankings").setDescription("Tier").setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
    }
    const target = interaction.options.getUser("user");
    const rank   = interaction.options.getString("rankings").toUpperCase();
    if (!isValidTier(rank)) {
      return interaction.reply({ embeds: [errorEmbed("Invalid Tier", `Valid: ${VALID_TIERS.join(", ")}`)], ephemeral: true });
    }
    db.setRank(target.id, rank);
    await staffLog(interaction.client, `✏️ <@${interaction.user.id}> set rank of <@${target.id}> to **${rank}**`);
    return interaction.reply({ embeds: [successEmbed("Rank Updated", `<@${target.id}>'s rank set to **${rank}**.`)] });
  },
};

// /setrankusername
const setRankUsernameCmd = {
  data: new SlashCommandBuilder()
    .setName("setrankusername")
    .setDescription("Update a player rank by IGN")
    .addStringOption(o => o.setName("username").setDescription("Minecraft IGN").setRequired(true))
    .addStringOption(o => o.setName("rankings").setDescription("Tier").setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
    }
    const ign  = interaction.options.getString("username");
    const rank = interaction.options.getString("rankings").toUpperCase();
    if (!isValidTier(rank)) {
      return interaction.reply({ embeds: [errorEmbed("Invalid Tier", `Valid: ${VALID_TIERS.join(", ")}`)], ephemeral: true });
    }
    db.setRankByIgn(ign, rank);
    await staffLog(interaction.client, `✏️ <@${interaction.user.id}> set rank of **${ign}** to **${rank}**`);
    return interaction.reply({ embeds: [successEmbed("Rank Updated", `**${ign}**'s rank set to **${rank}**.`)] });
  },
};

// /setpeaktier
const setPeakTierCmd = {
  data: new SlashCommandBuilder()
    .setName("setpeaktier")
    .setDescription("Update a user's peak tier")
    .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
    .addStringOption(o => o.setName("peak").setDescription("Peak tier").setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
    }
    const target = interaction.options.getUser("user");
    const peak   = interaction.options.getString("peak").toUpperCase();
    if (!isValidTier(peak)) {
      return interaction.reply({ embeds: [errorEmbed("Invalid Tier", `Valid: ${VALID_TIERS.join(", ")}`)], ephemeral: true });
    }
    db.setPeakTier(target.id, peak);
    await staffLog(interaction.client, `⭐ <@${interaction.user.id}> set peak tier of <@${target.id}> to **${peak}**`);
    return interaction.reply({ embeds: [successEmbed("Peak Tier Updated", `<@${target.id}>'s peak tier set to **${peak}**.`)] });
  },
};

// /tierwipe
const tierWipeCmd = {
  data: new SlashCommandBuilder()
    .setName("tierwipe")
    .setDescription("Remove all tiers from a player")
    .addUserOption(o => o.setName("player").setDescription("Target player").setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
    }
    const target = interaction.options.getUser("player");
    db.tierWipe(target.id);
    await staffLog(interaction.client, `🗑️ <@${interaction.user.id}> wiped all tiers from <@${target.id}>.`);
    return interaction.reply({ embeds: [successEmbed("Tiers Wiped", `All tiers removed from <@${target.id}>.`)] });
  },
};

// /tiertransfer
const tierTransferCmd = {
  data: new SlashCommandBuilder()
    .setName("tiertransfer")
    .setDescription("Transfer all tier data from one user to another")
    .addUserOption(o => o.setName("original").setDescription("Source user").setRequired(true))
    .addUserOption(o => o.setName("target").setDescription("Target user").setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
    }
    const from = interaction.options.getUser("original");
    const to   = interaction.options.getUser("target");
    const ok   = db.tierTransfer(from.id, to.id);
    if (!ok) {
      return interaction.reply({ embeds: [errorEmbed("Transfer Failed", `<@${from.id}> has no profile.`)], ephemeral: true });
    }
    await staffLog(interaction.client, `🔄 <@${interaction.user.id}> transferred tiers from <@${from.id}> → <@${to.id}>.`);
    return interaction.reply({ embeds: [successEmbed("Tiers Transferred", `Tiers transferred from <@${from.id}> to <@${to.id}>.`)] });
  },
};

module.exports = { setRankUserCmd, setRankUsernameCmd, setPeakTierCmd, tierWipeCmd, tierTransferCmd };
