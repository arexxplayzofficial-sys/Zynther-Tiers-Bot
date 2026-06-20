// src/commands/queue/queue.js
const { SlashCommandBuilder } = require("discord.js");
const db = require("../../db/database");
const { isStaff, successEmbed, errorEmbed, infoEmbed, staffLog } = require("../../utils/helpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Manage the testing queue")
    .addSubcommand(sub => sub.setName("open").setDescription("Open the testing queue"))
    .addSubcommand(sub => sub.setName("close").setDescription("Close the testing queue"))
    .addSubcommand(sub => sub.setName("status").setDescription("Show queue status")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "status") {
      const open = db.getConfig("queue_open") === "true";
      const testers = db.getTesters();
      const allQ = db.getAllWaitlists();
      const waiting = allQ.filter(e => e.status === "waiting");
      const inTest  = allQ.filter(e => e.status === "in_test");

      return interaction.reply({
        embeds: [infoEmbed("Queue Status",
          `**Status:** ${open ? "🟢 Open" : "🔴 Closed"}\n` +
          `**Active Testers:** ${testers.filter(t => t.status === "active").length}\n` +
          `**Standby Testers:** ${testers.filter(t => t.status === "standby").length}\n` +
          `**Waiting:** ${waiting.length}\n` +
          `**In Test:** ${inTest.length}`
        )],
        ephemeral: true,
      });
    }

    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
    }

    if (sub === "open") {
      db.setConfig("queue_open", "true");
      await staffLog(interaction.client, `🟢 **Queue opened** by <@${interaction.user.id}>`);
      return interaction.reply({ embeds: [successEmbed("Queue Opened", "The testing queue is now open.")] });
    }

    if (sub === "close") {
      db.setConfig("queue_open", "false");
      await staffLog(interaction.client, `🔴 **Queue closed** by <@${interaction.user.id}>`);
      return interaction.reply({ embeds: [successEmbed("Queue Closed", "The testing queue has been closed.")] });
    }
  },
};
