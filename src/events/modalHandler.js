// src/events/modalHandler.js
const cfg = require("../../setup");
const db = require("../db/database");
const { successEmbed, errorEmbed, warnEmbed, updateAllBoards, staffLog } = require("../utils/helpers");

module.exports = async function handleModal(interaction) {
  const { customId, user, guild, member } = interaction;

  // ── Verify Account ─────────────────────────────────────────
  if (customId === "modal_verify") {
    const rawIgn = interaction.fields.getTextInputValue("ign_input").trim();

    // Basic IGN validation
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(rawIgn)) {
      return interaction.reply({ embeds: [errorEmbed("Invalid IGN", "IGN must be 3–16 characters (letters, numbers, underscores).")], ephemeral: true });
    }

    // Check if IGN already taken by someone else
    const existing = db.getPlayerByIgn(rawIgn);
    if (existing && existing.discord_id !== user.id) {
      return interaction.reply({ embeds: [errorEmbed("IGN Taken", `**${rawIgn}** is already linked to another Discord account.`)], ephemeral: true });
    }

    db.upsertPlayer(user.id, rawIgn);

    // Assign verified role if configured
    if (cfg.ROLES.VERIFIED && cfg.ROLES.VERIFIED !== "VERIFIED_ROLE_ID") {
      await member.roles.add(cfg.ROLES.VERIFIED).catch(() => {});
    }

    await staffLog(interaction.client, `🔗 <@${user.id}> verified as **${rawIgn}**`);
    return interaction.reply({ embeds: [successEmbed("Account Verified", `Your Minecraft account **${rawIgn}** has been linked to your Discord!`)], ephemeral: true });
  }

  // ── Enter Waitlist ─────────────────────────────────────────
  if (customId === "modal_waitlist") {
    const rawRegion   = interaction.fields.getTextInputValue("region_input").trim().toUpperCase();
    const prefServer  = interaction.fields.getTextInputValue("server_input").trim() || null;

    // Validate region
    if (!["NA", "EU", "ASAU"].includes(rawRegion)) {
      return interaction.reply({ embeds: [errorEmbed("Invalid Region", "Please enter one of: `NA`, `EU`, `ASAU`")], ephemeral: true });
    }
    if (!cfg.WAITLISTS[rawRegion]?.enabled) {
      return interaction.reply({ embeds: [warnEmbed("Waitlist Disabled", `The **${cfg.WAITLISTS[rawRegion]?.label || rawRegion}** waitlist is currently disabled.`)], ephemeral: true });
    }

    const player = db.getPlayer(user.id);
    if (!player?.ign) {
      return interaction.reply({ embeds: [errorEmbed("Not Verified", "Please verify your account first.")], ephemeral: true });
    }

    // Re-check cooldown (race condition protection)
    const cd = db.getCooldown(user.id);
    if (cd && cd.expires_at > Math.floor(Date.now() / 1000)) {
      return interaction.reply({ embeds: [warnEmbed("On Cooldown", `Your cooldown expires <t:${cd.expires_at}:R>.`)], ephemeral: true });
    }

    if (db.playerInWaitlist(user.id)) {
      return interaction.reply({ embeds: [warnEmbed("Already in Queue", "You are already in a waitlist.")], ephemeral: true });
    }

    db.addToWaitlist(user.id, player.ign, rawRegion, prefServer);
    await updateAllBoards(interaction.client);

    const queue = db.getWaitlist(rawRegion);
    const pos   = queue.findIndex(e => e.discord_id === user.id) + 1;

    return interaction.reply({
      embeds: [successEmbed("Added to Waitlist",
        `You have been added to the **${cfg.WAITLISTS[rawRegion].label}** waitlist!\n\n` +
        `📍 Position: **#${pos}**\n` +
        `🖥️ Preferred Server: **${prefServer || "Any"}**\n\n` +
        `You will be pinged when a tester is ready for you.`
      )],
      ephemeral: true,
    });
  }
};
