# MCTiers Discord Bot

A fully automated MCTiers-style testing bot built with Discord.js v14 and SQLite.

---

## Quick Start

### 1. Prerequisites
- Node.js **18+**
- A Discord Application & Bot token from https://discord.com/developers/applications

### 2. Install dependencies
```bash
npm install
```

### 3. Configure the bot — `setup.js`
Open `setup.js` and fill in every value:

| Field | Description |
|---|---|
| `TOKEN` | Your bot token |
| `CLIENT_ID` | Bot application ID |
| `GUILD_ID` | Your Discord server ID |
| `ROLES.TESTER` | Tester role ID |
| `ROLES.STAFF` | Staff/admin role ID |
| `ROLES.VERIFIED` | Role given after account verification |
| `ROLES.TIERS.*` | One role ID per tier (LT1–HT5) |
| `CHANNELS.*` | All channel/category IDs |
| `WAITLISTS.*` | Enable/disable each region |
| `MAX_ACTIVE_TESTERS` | How many testers can be "active" at once |
| `COOLDOWN_HOURS` | Hours before a player can re-test |
| `AUTO_CLOSE_MINUTES` | Minutes of inactivity before a ticket auto-closes |

### 4. Invite the bot
Required permissions:
- `Manage Channels`
- `Manage Roles`
- `Send Messages`
- `Embed Links`
- `Read Message History`
- `View Channels`

Enable **Server Members Intent** and **Message Content Intent** in the Developer Portal.

### 5. Register slash commands
```bash
npm run deploy
```

### 6. Start the bot
```bash
npm start
```

### 7. First-time server setup
Run `/setup panel` in the channel you want the queue panel in, OR use
`/defaulttemplate confirm:True` to auto-create all needed channels (IDs printed to Discord for you to copy into `setup.js`).

---

## Command Reference

### Queue
| Command | Description |
|---|---|
| `/setup panel` | Posts the public queue panel |
| `/queue open` | Opens the queue |
| `/queue close` | Closes the queue |
| `/queue status` | Shows queue stats |

### Tester Activity
| Command | Description |
|---|---|
| `/tester start` | Join the active/standby pool |
| `/tester stop` | Leave the tester pool |
| `/tester stoptester @user` | Force stop another tester (Staff) |
| `/tester next` | Pull next player from queue |
| `/tester kill` | Emergency stop everything (Staff) |

### Ticket Management
| Command | Description |
|---|---|
| `/ticket lock` | Toggle send-message lock |
| `/ticket rename [name]` | Rename channel |
| `/ticket add @user` | Add user with send perms |
| `/ticket addspec @user` | Add read-only spectator |
| `/ticket remove @user` | Remove user from ticket |
| `/ticket leave` | Player leaves their test |
| `/ticket exempt` | Exempt from auto-close |
| `/ticket unexempt` | Remove auto-close exemption |
| `/ticket updatename [ign]` | Update player IGN in DB |

### Results & Profiles
| Command | Description |
|---|---|
| `/close [ranking]` | Close ticket and award rank |
| `/skip` | Close ticket, no cooldown |
| `/result @user [ign] [tier]` | Manual result submission |
| `/profile` | Look up a player profile |
| `/history @user` | View test history |
| `/stats @user` | View tester statistics |
| `/quotaboard` | Show monthly quota leaderboard |

### Rank Management (Staff)
| Command | Description |
|---|---|
| `/setrankuser @user [rank]` | Set rank by Discord user |
| `/setrankusername [ign] [rank]` | Set rank by IGN |
| `/setpeaktier @user [tier]` | Set peak tier |
| `/tierwipe @player` | Remove all tiers |
| `/tiertransfer @from @to` | Transfer tier data |

### Admin
| Command | Description |
|---|---|
| `/forceauth set @user [ign]` | Manually link account |
| `/forceauth unlink @user` | Unlink account |
| `/cooldownreset @user` | Reset cooldown |
| `/addtester @member` | Give tester role |
| `/config quota [n]` | Set monthly quota target |
| `/defaulttemplate confirm:True` | Rebuild channel structure |

---

## Player Flow
1. Click **Verify Account** → enter Minecraft IGN
2. Click **Enter Waitlist** → choose region + optional server
3. Bot checks cooldown and adds to queue
4. When tester is ready, private test channel is created
5. After test, rank is awarded, cooldown set, history saved

## Tester Flow
1. `/tester start` → marked active or standby
2. `/tester next` or click **Next** button → pulls next player
3. Manage ticket with `/ticket` commands
4. `/close [tier]` → awards rank, closes channel
5. `/tester stop` when done

---

## Database
SQLite file at `./data/mctiers.db` — created automatically on first run.

Tables: `players`, `test_history`, `cooldowns`, `testers`, `waitlist`, `tickets`, `quota`, `config`
