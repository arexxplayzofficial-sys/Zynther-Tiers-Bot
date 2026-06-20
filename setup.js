// ============================================================
//  MCTiers Bot — setup.js
//  All configuration lives here. No .env file needed.
// ============================================================

module.exports = {
  // ── Bot credentials ──────────────────────────────────────
  TOKEN: "MTUxNzQxNDk5NDEwMTI3MjYxNg.GNZBhU.v5IrSEumtr0eqKxZZKLUqz26wD7FlbnGpZFuh0",
  CLIENT_ID: "1517414994101272616",

  // ── Guild (server) ID ────────────────────────────────────
  GUILD_ID: "1516791299741843546",

  // ── Role IDs ─────────────────────────────────────────────
  ROLES: {
    TESTER: "1517478259045175387",
    STAFF:  "1517478707986694245",
    VERIFIED: "1517479133263827004",

    // Tier / rank roles — map tier string → role ID
    TIERS: {
      "LT1": "1517479625767522394",
      "LT2": "1517479684525391993",
      "LT3": "1517479714682306710",
      "LT4": "1517479757476921426",
      "LT5": "1517479806306877440",
      "HT1": "1517480107864752229",
      "HT2": "1517480176827633684",
      "HT3": "1517480240304230550",
      "HT4": "1517480254648619098",
      "HT5": "1517480330536423535",
    },
  },

  // ── Channel IDs ──────────────────────────────────────────
  CHANNELS: {
    QUEUE_PANEL:   "1517482857407447162",   // public registration panel
    RESULTS:       "1517483955413061682",        // result posts
    STAFF_LOGS:    "1517484901103042751",     // staff audit log
    TESTER_LOGS:   "1517484978265395280",    // tester activity log
    QUOTA_BOARD:   "1517485374241509426",    // quota leaderboard

    // Live waitlist board channels
    WAITLIST_NA:   "1517485953403326636",
    WAITLIST_EU:   "1517486102846636102",
    WAITLIST_ASAU: "1517486245486399658",

    // Category under which test tickets are created
    TICKET_CATEGORY: "1517404773912150036",
  },

  // ── Waitlist settings ────────────────────────────────────
  WAITLISTS: {
    NA:   { enabled: true,  label: "NA/SA" },
    EU:   { enabled: true,  label: "EU"    },
    ASAU: { enabled: true,  label: "AS/AU" },
  },

  // ── Tester limits ────────────────────────────────────────
  MAX_ACTIVE_TESTERS: 5,      // testers in "active" (vs standby) pool

  // ── Cooldown (hours) ─────────────────────────────────────
  COOLDOWN_HOURS: 72,

  // ── Auto-close inactivity (minutes) ─────────────────────
  AUTO_CLOSE_MINUTES: 30,

  // ── Monthly tester quota default ─────────────────────────
  DEFAULT_MONTHLY_QUOTA: 20,

  // ── Database path ────────────────────────────────────────
  DB_PATH: "./data/mctiers.db",
};
