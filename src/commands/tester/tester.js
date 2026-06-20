// src/commands/tester/tester.js
const { SlashCommandBuilder } = require("discord.js");
const cfg = require("../../../setup");
const db  = require("../../db/database");
const {
  isTester, isStaff,
  successEmbed, errorEmbed, warnEmbed, infoEmbed,
  updateAllBoards, testerLog, staffLog,
} = require("../../utils/helpers");
const { createTestTicket, closeTestChannel } = require("../../utils/ticketManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tester")
    .setDescription("Tester management commands")
    .addSubcommand(sub => sub.setName("start").setDescription("Mark yourself as an active/standby tester"))
    .addSubcommand(sub => sub.setName("stop").setDescription("Remove yourself from the tester pool"))
    .addSubcommand(sub =>
      sub.setName("stoptester")
        .setDescription("Force stop another tester")
        .addUserOption(o => o.setName("user").setDescription("Tester to stop").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("next").setDescription("Pull the next player from the queue"))
    .addSubcommand(sub => sub.setName("kill").setDescription("Emergency stop the queue and save state")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { user, member, guild, client } = interaction;

    // /start
    if (sub === "start") {
      if (!isTester(member)) {
        return interaction.reply({ embeds: [errorEmbed("No Permission", "Tester role required.")], ephemeral: true });
      }
      if (db.getTesterStatus(user.id)) {
        return interaction.reply({ embeds: [warnEmbed("Already Active", "You are already in the tester pool.")], ephemeral: true });
      }
      const activeCount = db.getActiveTesterCount();
      const status = activeCount < cfg.MAX_ACTIVE_TESTERS ? "active" : "standby";
      db.addTester(user.id, status);
      await updateAllBoards(client);
      await testerLog(client, `▶️ <@${user.id}> started as **${status}** tester.`);
      return interaction.reply({
        embeds: [successEmbed("Now Testing", `You have been marked as **${status}**.\n${status === "standby" ? "You will become active when a slot opens." : ""}`)],
      });
    }

    // /stop
    if (sub === "stop") {
      if (!db.getTesterStatus(user.id)) {
        return interaction.reply({ embeds: [errorEmbed("Not Active", "You are not currently in the tester pool.")], ephemeral: true });
      }
      db.removeTester(user.id);
      await updateAllBoards(client);
      await testerLog(client, `⏹️ <@${user.id}> stopped testing.`);
      return interaction.reply({ embeds: [successEmbed("Stopped", "You have been removed from the tester pool.")] });
    }

    // /stoptester
    if (sub === "stoptester") {
      if (!isStaff(member)) {
        return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
      }
      const target = interaction.options.getUser("user");
      if (!db.getTesterStatus(target.id)) {
        return interaction.reply({ embeds: [errorEmbed("Not Active", `<@${target.id}> is not in the tester pool.`)], ephemeral: true });
      }
      db.removeTester(target.id);
      await updateAllBoards(client);
      await staffLog(client, `⏹️ <@${user.id}> force-stopped tester <@${target.id}>.`);
      return interaction.reply({ embeds: [successEmbed("Tester Stopped", `<@${target.id}> has been removed from the tester pool.`)] });
    }

    // /next
    if (sub === "next") {
      if (!isTester(member)) {
        return interaction.reply({ embeds: [errorEmbed("No Permission", "Tester role required.")], ephemeral: true });
      }
      if (!db.getTesterStatus(user.id)) {
        return interaction.reply({ embeds: [errorEmbed("Not Active", "You must `/tester start` first.")], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });

      // Find next waiting player across enabled regions
      let nextEntry = null, chosenRegion = null;
      for (const [r, wcfg] of Object.entries(cfg.WAITLISTS)) {
        if (!wcfg.enabled) continue;
        const e = db.nextInWaitlist(r);
        if (e) { nextEntry = e; chosenRegion = r; break; }
      }

      if (!nextEntry) {
        return interaction.editReply({ embeds: [infoEmbed("Queue Empty", "No players are waiting right now.")] });
      }

      const player = db.getPlayer(nextEntry.discord_id);
      if (!player) {
        db.setWaitlistStatus(nextEntry.id, "done");
        return interaction.editReply({ embeds: [warnEmbed("Player Not Found", "Next player has no profile, entry removed.")] });
      }

      const ch = await createTestTicket(guild, player, { discord_id: user.id }, nextEntry);
      await updateAllBoards(client);
      await testerLog(client, `🎮 <@${user.id}> started test with **${player.ign}** (${chosenRegion}) → ${ch}`);
      return interaction.editReply({ embeds: [successEmbed("Ticket Created", `Test channel created: ${ch}`)] });
    }

    // /kill
    if (sub === "kill") {
      if (!isStaff(member)) {
        return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
      }
      db.setConfig("queue_open", "false");
      // Remove all testers
      const testers = db.getTesters();
      testers.forEach(t => db.removeTester(t.discord_id));
      await updateAllBoards(client);
      await staffLog(client, `🚨 **KILL** executed by <@${user.id}>. Queue closed, all testers stopped.`);
      return interaction.reply({ embeds: [{ color: 0xed4245, title: "🚨 Kill Executed", description: "Queue closed. All testers stopped. State saved." }] });
    }
  },
};
