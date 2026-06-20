// src/events/buttonHandler.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const cfg = require("../../setup");
const db = require("../db/database");
const { successEmbed, errorEmbed, warnEmbed, infoEmbed,
        isTester, isStaff, updateAllBoards, staffLog } = require("../utils/helpers");
const { createTestTicket, closeTestChannel } = require("../utils/ticketManager");

module.exports = async function handleButton(interaction) {
  const { customId, member, guild, user } = interaction;

  // ── Verify Account ─────────────────────────────────────────
  if (customId === "verify_account") {
    const modal = new ModalBuilder()
      .setCustomId("modal_verify")
      .setTitle("Verify your Minecraft Account");
    const input = new TextInputBuilder()
      .setCustomId("ign_input")
      .setLabel("Your Minecraft IGN")
      .setStyle(TextInputStyle.Short)
      .setMinLength(3).setMaxLength(16).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  // ── Enter Waitlist ─────────────────────────────────────────
  if (customId === "enter_waitlist") {
    const player = db.getPlayer(user.id);
    if (!player || !player.ign) {
      return interaction.reply({ embeds: [errorEmbed("Not Verified", "Please verify your Minecraft account first.")], ephemeral: true });
    }

    if (!db.getConfig("queue_open") || db.getConfig("queue_open") === "false") {
      return interaction.reply({ embeds: [warnEmbed("Queue Closed", "The testing queue is currently closed.")], ephemeral: true });
    }

    // Cooldown check
    const cd = db.getCooldown(user.id);
    if (cd && cd.expires_at > Math.floor(Date.now() / 1000)) {
      const exp = `<t:${cd.expires_at}:R>`;
      return interaction.reply({ embeds: [warnEmbed("On Cooldown", `You are on cooldown. You can test again ${exp}.`)], ephemeral: true });
    }

    if (db.playerInWaitlist(user.id)) {
      return interaction.reply({ embeds: [warnEmbed("Already in Queue", "You are already in a waitlist or active test.")], ephemeral: true });
    }

    // Region + server modal
    const modal = new ModalBuilder()
      .setCustomId("modal_waitlist")
      .setTitle("Enter Testing Waitlist");
    const regionInput = new TextInputBuilder()
      .setCustomId("region_input")
      .setLabel("Region (NA, EU, ASAU)")
      .setStyle(TextInputStyle.Short)
      .setMinLength(2).setMaxLength(4).setRequired(true);
    const serverInput = new TextInputBuilder()
      .setCustomId("server_input")
      .setLabel("Preferred server (optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false).setMaxLength(32);
    modal.addComponents(
      new ActionRowBuilder().addComponents(regionInput),
      new ActionRowBuilder().addComponents(serverInput),
    );
    return interaction.showModal(modal);
  }

  // ── Check Cooldown ─────────────────────────────────────────
  if (customId === "check_cooldown") {
    const cd = db.getCooldown(user.id);
    if (!cd || cd.expires_at <= Math.floor(Date.now() / 1000)) {
      return interaction.reply({ embeds: [successEmbed("No Cooldown", "You have no active cooldown!")], ephemeral: true });
    }
    return interaction.reply({ embeds: [warnEmbed("Cooldown Active", `Your cooldown expires <t:${cd.expires_at}:R>.`)], ephemeral: true });
  }

  // ── Leave Queue ────────────────────────────────────────────
  if (customId === "leave_queue") {
    const entry = db.playerInWaitlist(user.id);
    if (!entry) {
      return interaction.reply({ embeds: [errorEmbed("Not in Queue", "You are not in any waitlist.")], ephemeral: true });
    }
    if (entry.status === "in_test") {
      return interaction.reply({ embeds: [warnEmbed("In Test", "You are currently in an active test. Use `/leave` in your test channel.")], ephemeral: true });
    }
    db.removeFromWaitlist(user.id);
    await updateAllBoards(interaction.client);
    return interaction.reply({ embeds: [successEmbed("Left Queue", "You have been removed from the waitlist.")], ephemeral: true });
  }

  // ── Next — Keep Channel ────────────────────────────────────
  if (customId === "next_keep") {
    if (!isTester(member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Testers only.")], ephemeral: true });
    }
    return handleNext(interaction, false);
  }

  // ── Next — Delete Channel ──────────────────────────────────
  if (customId === "next_delete") {
    if (!isTester(member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Testers only.")], ephemeral: true });
    }
    return handleNext(interaction, true);
  }

  // ── Cooldown Override ──────────────────────────────────────
  if (customId === "cooldown_override") {
    if (!isStaff(member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
    }
    const ticket = db.getTicket(interaction.channel.id);
    if (!ticket) return interaction.reply({ embeds: [errorEmbed("No Ticket", "Not in a test channel.")], ephemeral: true });
    db.resetCooldown(ticket.player_id);
    await staffLog(interaction.client, `🔓 **Cooldown Override** by <@${user.id}> for <@${ticket.player_id}> in ${interaction.channel}`);
    return interaction.reply({ embeds: [successEmbed("Cooldown Reset", `Cooldown cleared for <@${ticket.player_id}>.`)] });
  }
};

async function handleNext(interaction, deleteOld) {
  const testerStatus = db.getTesterStatus(interaction.user.id);
  if (!testerStatus) {
    return interaction.reply({ embeds: [require("../utils/helpers").errorEmbed("Not Active", "You must `/start` first.")], ephemeral: true });
  }

  // Determine region from current ticket or pick any
  const currentTicket = db.getTicket(interaction.channel.id);
  const region = currentTicket ? currentTicket.region : null;

  // Close current ticket if in a ticket channel
  if (currentTicket) {
    await closeTestChannel(interaction.client, interaction.guild, interaction.channel.id, deleteOld);
    if (deleteOld) {
      // Channel is deleted; we need a new channel for the ack — just return
      return;
    }
  }

  // Find next player
  const regions = region ? [region] : Object.keys(cfg.WAITLISTS);
  let nextEntry = null;
  let chosenRegion = null;
  for (const r of regions) {
    if (!cfg.WAITLISTS[r].enabled) continue;
    nextEntry = db.nextInWaitlist(r);
    if (nextEntry) { chosenRegion = r; break; }
  }

  if (!nextEntry) {
    return interaction.reply({ embeds: [infoEmbed("Queue Empty", "No players waiting in the queue right now.")], ephemeral: true });
  }

  const player = db.getPlayer(nextEntry.discord_id);
  if (!player) {
    db.setWaitlistStatus(nextEntry.id, "done");
    return interaction.reply({ embeds: [warnEmbed("Player Not Found", "Next player has no profile, skipping.")], ephemeral: true });
  }

  const tester = { discord_id: interaction.user.id };
  const ch = await createTestTicket(interaction.guild, player, tester, nextEntry);
  await updateAllBoards(interaction.client);

  return interaction.reply({ embeds: [successEmbed("Ticket Created", `Test channel created: ${ch}`)], ephemeral: true });
}
