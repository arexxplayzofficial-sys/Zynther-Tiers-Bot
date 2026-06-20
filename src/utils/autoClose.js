// src/utils/autoClose.js — runs every minute, closes stale tickets
const cfg = require("../../setup");
const db  = require("../db/database");
const { updateAllBoards, testerLog } = require("./helpers");

function startAutoClose(client) {
  setInterval(async () => {
    try {
      const threshold = cfg.AUTO_CLOSE_MINUTES * 60;
      const stale = db.getStaleTickets(threshold);

      for (const ticket of stale) {
        const guild = client.guilds.cache.first(); // assumes single guild
        if (!guild) continue;

        const channel = guild.channels.cache.get(ticket.channel_id);
        if (!channel) {
          db.closeTicket(ticket.channel_id);
          continue;
        }

        await channel.send("⏰ This ticket has been automatically closed due to inactivity.").catch(() => {});
        await channel.delete().catch(() => {});

        if (ticket.waitlist_id) db.setWaitlistStatus(ticket.waitlist_id, "done");
        db.closeTicket(ticket.channel_id);

        await testerLog(client, `⏰ Auto-closed stale ticket for <@${ticket.player_id}> (inactive ${cfg.AUTO_CLOSE_MINUTES}m)`);
        await updateAllBoards(client);
      }
    } catch (e) {
      console.error("[AutoClose] Error:", e);
    }
  }, 60_000); // every 60 seconds
}

module.exports = { startAutoClose };
