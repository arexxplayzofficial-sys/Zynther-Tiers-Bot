// deploy-commands.js — run once to register slash commands
const { REST, Routes } = require("discord.js");
const cfg = require("./setup");

const { resultCmd, profileCmd, historyCmd, statsCmd } = require("./src/commands/results/result");
const { setRankUserCmd, setRankUsernameCmd, setPeakTierCmd, tierWipeCmd, tierTransferCmd } = require("./src/commands/rank/rank");
const { forceAuthCmd, cooldownResetCmd, addTesterCmd, configCmd, defaultTemplateCmd, quotaBoardCmd } = require("./src/commands/admin/admin");
const closeModule = require("./src/commands/ticket/close");

const commands = [
  // Queue
  require("./src/commands/queue/setup").data,
  require("./src/commands/queue/queue").data,
  // Tester
  require("./src/commands/tester/tester").data,
  // Ticket management
  require("./src/commands/ticket/ticket").data,
  closeModule.data,
  closeModule.skip.data,
  // Results
  resultCmd.data,
  profileCmd.data,
  historyCmd.data,
  statsCmd.data,
  // Rank management
  setRankUserCmd.data,
  setRankUsernameCmd.data,
  setPeakTierCmd.data,
  tierWipeCmd.data,
  tierTransferCmd.data,
  // Admin
  forceAuthCmd.data,
  cooldownResetCmd.data,
  addTesterCmd.data,
  configCmd.data,
  defaultTemplateCmd.data,
  quotaBoardCmd.data,
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(cfg.TOKEN);

(async () => {
  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);
    await rest.put(Routes.applicationGuildCommands(cfg.CLIENT_ID, cfg.GUILD_ID), { body: commands });
    console.log("✅ Commands registered successfully!");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
})();
