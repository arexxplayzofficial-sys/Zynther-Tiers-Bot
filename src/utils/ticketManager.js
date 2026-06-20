// src/utils/ticketManager.js
const {
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");
const cfg = require("../../setup");
const db = require("../db/database");
const { COLORS, updateAllBoards, testerLog } = require("./helpers");

async function createTestTicket(guild, player, tester, waitlistEntry) {
  const category = cfg.CHANNELS.TICKET_CATEGORY;
  const channelName = `test-${player.ign.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

  const permOverwrites = [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: player.discord_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    { id: tester.discord_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
    { id: cfg.ROLES.STAFF, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
  ];

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category || undefined,
    permissionOverwrites: permOverwrites,
  });

  db.createTicket(channel.id, player.discord_id, tester.discord_id, waitlistEntry.id, waitlistEntry.region);
  db.setWaitlistStatus(waitlistEntry.id, "in_test");

  const embed = new EmbedBuilder()
    .setColor(COLORS.PURPLE)
    .setTitle("🎮 Test Session Started")
    .addFields(
      { name: "Player", value: `<@${player.discord_id}> (${player.ign})`, inline: true },
      { name: "Tester", value: `<@${tester.discord_id}>`, inline: true },
      { name: "Region", value: waitlistEntry.region, inline: true },
      { name: "Current Rank", value: player.current_rank || "Unranked", inline: true },
      { name: "Peak Tier",    value: player.peak_tier   || "None",     inline: true },
      { name: "Pref. Server", value: waitlistEntry.pref_server || "Any", inline: true },
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("next_keep")
      .setLabel("⏭ Next (Keep Channel)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("next_delete")
      .setLabel("⏭ Next (Delete Channel)")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("cooldown_override")
      .setLabel("🔓 Cooldown Override")
      .setStyle(ButtonStyle.Danger),
  );

  await channel.send({ content: `<@${player.discord_id}> <@${tester.discord_id}>`, embeds: [embed], components: [row] });

  return channel;
}

async function closeTestChannel(client, guild, channelId, deleteChannel = false) {
  const ticket = db.getTicket(channelId);
  if (!ticket) return;

  if (ticket.waitlist_id) {
    db.setWaitlistStatus(ticket.waitlist_id, "done");
  }
  db.closeTicket(channelId);

  if (deleteChannel) {
    const ch = guild.channels.cache.get(channelId);
    if (ch) await ch.delete().catch(() => {});
  } else {
    const ch = guild.channels.cache.get(channelId);
    if (ch) {
      await ch.send("✅ This test session has been closed.").catch(() => {});
      // Deny everyone from sending more messages
      await ch.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false,
        ViewChannel: false,
      }).catch(() => {});
    }
  }

  await updateAllBoards(client);
}

module.exports = { createTestTicket, closeTestChannel };
