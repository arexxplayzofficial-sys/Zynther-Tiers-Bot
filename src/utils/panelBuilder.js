// src/utils/panelBuilder.js — builds the public queue registration panel
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { COLORS } = require("./helpers");

function buildQueuePanel(queueOpen) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PURPLE)
    .setTitle("🎮 MCTiers — Testing Queue")
    .setDescription(
      "Welcome to the MCTiers testing queue!\n\n" +
      "**How it works:**\n" +
      "1. 🔗 Verify your Minecraft account\n" +
      "2. 📋 Enter a waitlist for your region\n" +
      "3. ⏳ Wait for a tester to become available\n" +
      "4. 🏆 Get tested and receive your tier!\n\n" +
      `**Queue Status:** ${queueOpen ? "🟢 Open" : "🔴 Closed"}`
    )
    .setFooter({ text: "MCTiers Bot • Automated Testing System" })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("verify_account")
      .setLabel("🔗 Verify Account")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("enter_waitlist")
      .setLabel("📋 Enter Waitlist")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("check_cooldown")
      .setLabel("⏳ Check Cooldown")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("leave_queue")
      .setLabel("🚪 Leave Queue")
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row1] };
}

module.exports = { buildQueuePanel };
