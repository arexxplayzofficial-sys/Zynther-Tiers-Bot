// src/commands/queue/setup.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const cfg = require("../../../setup");
const { isStaff, successEmbed, errorEmbed } = require("../../utils/helpers");
const { buildQueuePanel } = require("../../utils/panelBuilder");
const db = require("../../db/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Post the public queue registration panel")
    .addSubcommand(sub => sub.setName("panel").setDescription("Post the queue panel in this channel")),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("No Permission", "Staff only.")], ephemeral: true });
    }

    const queueOpen = db.getConfig("queue_open") === "true";
    const panel = buildQueuePanel(queueOpen);
    await interaction.channel.send(panel);
    return interaction.reply({ embeds: [successEmbed("Panel Posted", "Queue registration panel has been posted.")], ephemeral: true });
  },
};
