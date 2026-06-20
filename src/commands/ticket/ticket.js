// src/commands/ticket/ticket.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const cfg = require("../../../setup");
const db  = require("../../db/database");
const {
  isTester, isStaff,
  successEmbed, errorEmbed, warnEmbed, updateAllBoards, testerLog,
} = require("../../utils/helpers");
const { closeTestChannel } = require("../../utils/ticketManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Ticket management")
    .addSubcommand(sub => sub.setName("lock").setDescription("Toggle ticket lock"))
    .addSubcommand(sub =>
      sub.setName("rename")
        .setDescription("Rename this ticket channel")
        .addStringOption(o => o.setName("name").setDescription("New channel name").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("Add a user to this ticket")
        .addUserOption(o => o.setName("user").setDescription("User to add").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("addspec")
        .setDescription("Add a spectator (view-only) to this ticket")
        .addUserOption(o => o.setName("user").setDescription("User to add as spectator").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Remove a user from this ticket")
        .addUserOption(o => o.setName("user").setDescription("User to remove").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("leave").setDescription("Leave the current waitlist or active ticket"))
    .addSubcommand(sub => sub.setName("exempt").setDescription("Exempt this ticket from auto-close"))
    .addSubcommand(sub => sub.setName("unexempt").setDescription("Remove auto-close exemption"))
    .addSubcommand(sub =>
      sub.setName("updatename")
        .setDescription("Update the active player IGN in the database")
        .addStringOption(o => o.setName("new_name").setDescription("New IGN").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { user, member, channel, guild, client } = interaction;
    const ticket = db.getTicket(channel.id);

    // Commands that require being in a ticket channel
    const requiresTicket = ["lock","rename","add","addspec","remove","exempt","unexempt","updatename"];
    if (requiresTicket.includes(sub) && !ticket) {
      return interaction.reply({ embeds: [errorEmbed("Not a Ticket", "This command must be used in a test ticket channel.")], ephemeral: true });
    }

    // Permission check for most ticket commands
    const canManage = isTester(member) || isStaff(member) || (ticket && ticket.player_id === user.id);

    // /lock
    if (sub === "lock") {
      if (!isTester(member) && !isStaff(member)) {
        return interaction.reply({ embeds: [errorEmbed("No Permission", "Testers only.")], ephemeral: true });
      }
      const newLock = !ticket.locked;
      db.setTicketLock(channel.id, newLock);

      // Update permissions
      await channel.permissionOverwrites.edit(ticket.player_id, {
        SendMessages: !newLock,
      }).catch(() => {});

      return interaction.reply({
        embeds: [successEmbed(newLock ? "Ticket Locked" : "Ticket Unlocked",
          newLock ? "The player can no longer send messages." : "The player can now send messages again."
        )],
      });
    }

    // /rename
    if (sub === "rename") {
      if (!isTester(member) && !isStaff(member)) {
        return interaction.reply({ embeds: [errorEmbed("No Permission", "Testers only.")], ephemeral: true });
      }
      const name = interaction.options.getString("name").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      await channel.setName(name).catch(() => {});
      return interaction.reply({ embeds: [successEmbed("Channel Renamed", `Channel renamed to **${name}**.`)] });
    }

    // /add
    if (sub === "add") {
      if (!isTester(member) && !isStaff(member)) {
        return interaction.reply({ embeds: [errorEmbed("No Permission", "Testers only.")], ephemeral: true });
      }
      const target = interaction.options.getUser("user");
      await channel.permissionOverwrites.edit(target.id, {
        ViewChannel: true, SendMessages: true,
      }).catch(() => {});
      return interaction.reply({ embeds: [successEmbed("User Added", `<@${target.id}> has been added to this ticket.`)] });
    }

    // /addspec
    if (sub === "addspec") {
      if (!isTester(member) && !isStaff(member)) {
        return interaction.reply({ embeds: [errorEmbed("No Permission", "Testers only.")], ephemeral: true });
      }
      const target = interaction.options.getUser("user");
      await channel.permissionOverwrites.edit(target.id, {
        ViewChannel: true, SendMessages: false,
      }).catch(() => {});
      return interaction.reply({ embeds: [successEmbed("Spectator Added", `<@${target.id}> has been added as a spectator.`)] });
    }

    // /remove
    if (sub === "remove") {
      if (!isTester(member) && !isStaff(member)) {
        return interaction.reply({ embeds: [errorEmbed("No Permission", "Testers only.")], ephemeral: true });
      }
      const target = interaction.options.getUser("user");
      await channel.permissionOverwrites.delete(target.id).catch(() => {});
      return interaction.reply({ embeds: [successEmbed("User Removed", `<@${target.id}> has been removed from this ticket.`)] });
    }

    // /leave
    if (sub === "leave") {
      const entry = db.playerInWaitlist(user.id);
      if (!entry) {
        return interaction.reply({ embeds: [errorEmbed("Not in Queue", "You are not in any waitlist or active test.")], ephemeral: true });
      }
      if (entry.status === "in_test") {
        const t = db.getTicketByPlayer(user.id);
        if (t) {
          await closeTestChannel(client, guild, t.channel_id, false);
          await testerLog(client, `🚪 Player <@${user.id}> left their active test.`);
        }
      }
      db.removeFromWaitlist(user.id);
      await updateAllBoards(client);
      return interaction.reply({ embeds: [successEmbed("Left", "You have left the queue/test.")] });
    }

    // /exempt
    if (sub === "exempt") {
      if (!isTester(member) && !isStaff(member)) {
        return interaction.reply({ embeds: [errorEmbed("No Permission", "Testers only.")], ephemeral: true });
      }
      db.setTicketExempt(channel.id, true);
      return interaction.reply({ embeds: [successEmbed("Exempted", "This ticket is now exempt from auto-close.")] });
    }

    // /unexempt
    if (sub === "unexempt") {
      if (!isTester(member) && !isStaff(member)) {
        return interaction.reply({ embeds: [errorEmbed("No Permission", "Testers only.")], ephemeral: true });
      }
      db.setTicketExempt(channel.id, false);
      return interaction.reply({ embeds: [successEmbed("Unexempted", "Auto-close exemption removed.")] });
    }

    // /updatename
    if (sub === "updatename") {
      if (!isTester(member) && !isStaff(member)) {
        return interaction.reply({ embeds: [errorEmbed("No Permission", "Testers only.")], ephemeral: true });
      }
      const newIGN = interaction.options.getString("new_name").trim();
      if (!/^[a-zA-Z0-9_]{3,16}$/.test(newIGN)) {
        return interaction.reply({ embeds: [errorEmbed("Invalid IGN", "IGN must be 3–16 alphanumeric characters.")], ephemeral: true });
      }
      db.upsertPlayer(ticket.player_id, newIGN);
      return interaction.reply({ embeds: [successEmbed("Name Updated", `Player IGN updated to **${newIGN}**.`)] });
    }
  },
};
