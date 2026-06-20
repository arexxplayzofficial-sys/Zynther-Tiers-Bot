// index.js — MCTiers Bot entry point
const {
  Client,
  GatewayIntentBits,
  Partials,
} = require("discord.js");
const Database = require("better-sqlite3");
const cfg = require("./setup");
const db = require("./src/db/database");

// Ensure DB is initialised on startup
db.getDb();

// ── Discord client ────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ── Command imports ───────────────────────────────────────────
const setupCmd  = require("./src/commands/queue/setup");
const queueCmd  = require("./src/commands/queue/queue");
const testerCmd = require("./src/commands/tester/tester");
const ticketCmd = require("./src/commands/ticket/ticket");
const closeModule = require("./src/commands/ticket/close");
const { resultCmd, profileCmd, historyCmd, statsCmd } = require("./src/commands/results/result");
const { setRankUserCmd, setRankUsernameCmd, setPeakTierCmd, tierWipeCmd, tierTransferCmd } = require("./src/commands/rank/rank");
const { forceAuthCmd, cooldownResetCmd, addTesterCmd, configCmd, defaultTemplateCmd, quotaBoardCmd } = require("./src/commands/admin/admin");

const commandMap = {
  setup:           setupCmd,
  queue:           queueCmd,
  tester:          testerCmd,
  ticket:          ticketCmd,
  close:           closeModule,
  skip:            closeModule.skip,
  result:          resultCmd,
  profile:         profileCmd,
  history:         historyCmd,
  stats:           statsCmd,
  setrankuser:     setRankUserCmd,
  setrankusername: setRankUsernameCmd,
  setpeaktier:     setPeakTierCmd,
  tierwipe:        tierWipeCmd,
  tiertransfer:    tierTransferCmd,
  forceauth:       forceAuthCmd,
  cooldownreset:   cooldownResetCmd,
  addtester:       addTesterCmd,
  config:          configCmd,
  defaulttemplate: defaultTemplateCmd,
  quotaboard:      quotaBoardCmd,
};

// ── Event handlers ────────────────────────────────────────────
const handleButton = require("./src/events/buttonHandler");
const handleModal  = require("./src/events/modalHandler");
const { updateAllBoards } = require("./src/utils/helpers");
const { startAutoClose } = require("./src/utils/autoClose");

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await updateAllBoards(client);
  startAutoClose(client);
  console.log("🤖 MCTiers Bot is ready!");
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const cmd = commandMap[interaction.commandName];
      if (cmd) {
        await cmd.execute(interaction);
      } else {
        console.warn(`Unknown command: ${interaction.commandName}`);
      }
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (err) {
    console.error(`[Interaction Error] ${err.message}`, err);
    const errMsg = { content: "❌ An error occurred. Please try again.", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errMsg).catch(() => {});
    } else {
      await interaction.reply(errMsg).catch(() => {});
    }
  }
});

client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;
  // Touch ticket activity on any message in a ticket channel
  const { updateTicketActivity } = require("./src/db/database");
  updateTicketActivity(msg.channel.id);
});

// ── Login ─────────────────────────────────────────────────────
client.login(cfg.TOKEN).catch(err => {
  console.error("❌ Failed to log in:", err.message);
  process.exit(1);
});
