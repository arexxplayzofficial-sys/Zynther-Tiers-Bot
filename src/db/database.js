// src/db/database.js — SQLite schema + query helpers
const Database = require("better-sqlite3");
const path = require("path");
const cfg = require("../../setup");

let db;

function getDb() {
  if (!db) {
    db = new Database(path.resolve(cfg.DB_PATH));
    db.pragma("journal_mode = WAL");
    init();
  }
  return db;
}

function init() {
  db.exec(`
    -- Player profiles
    CREATE TABLE IF NOT EXISTS players (
      discord_id   TEXT PRIMARY KEY,
      ign          TEXT UNIQUE,
      current_rank TEXT DEFAULT NULL,
      peak_tier    TEXT DEFAULT NULL,
      verified_at  INTEGER DEFAULT (strftime('%s','now'))
    );

    -- Test history
    CREATE TABLE IF NOT EXISTS test_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id   TEXT,
      ign          TEXT,
      tester_id    TEXT,
      tier         TEXT,
      prev_rank    TEXT,
      notes        TEXT,
      region       TEXT,
      result       TEXT,   -- 'pass'|'skip'|'discontinued'
      tested_at    INTEGER DEFAULT (strftime('%s','now'))
    );

    -- Cooldowns
    CREATE TABLE IF NOT EXISTS cooldowns (
      discord_id   TEXT PRIMARY KEY,
      expires_at   INTEGER
    );

    -- Active testers
    CREATE TABLE IF NOT EXISTS testers (
      discord_id   TEXT PRIMARY KEY,
      status       TEXT DEFAULT 'standby',  -- 'active'|'standby'
      started_at   INTEGER DEFAULT (strftime('%s','now'))
    );

    -- Waitlist entries
    CREATE TABLE IF NOT EXISTS waitlist (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id   TEXT,
      ign          TEXT,
      region       TEXT,
      pref_server  TEXT,
      joined_at    INTEGER DEFAULT (strftime('%s','now')),
      status       TEXT DEFAULT 'waiting'  -- 'waiting'|'in_test'
    );

    -- Active tickets
    CREATE TABLE IF NOT EXISTS tickets (
      channel_id   TEXT PRIMARY KEY,
      player_id    TEXT,
      tester_id    TEXT,
      waitlist_id  INTEGER,
      region       TEXT,
      locked       INTEGER DEFAULT 0,
      exempt       INTEGER DEFAULT 0,
      last_activity INTEGER DEFAULT (strftime('%s','now')),
      created_at   INTEGER DEFAULT (strftime('%s','now'))
    );

    -- Tester quota tracking
    CREATE TABLE IF NOT EXISTS quota (
      discord_id   TEXT,
      month        TEXT,   -- 'YYYY-MM'
      tests_done   INTEGER DEFAULT 0,
      PRIMARY KEY (discord_id, month)
    );

    -- Config / state flags
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    INSERT OR IGNORE INTO config (key, value) VALUES
      ('queue_open',    'false'),
      ('quota_target',  '20');
  `);
}

// ── Players ──────────────────────────────────────────────────
function getPlayer(discordId) {
  return getDb().prepare("SELECT * FROM players WHERE discord_id = ?").get(discordId);
}
function getPlayerByIgn(ign) {
  return getDb().prepare("SELECT * FROM players WHERE lower(ign) = lower(?)").get(ign);
}
function upsertPlayer(discordId, ign) {
  getDb().prepare(`
    INSERT INTO players (discord_id, ign) VALUES (?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET ign = excluded.ign
  `).run(discordId, ign);
}
function setRank(discordId, rank) {
  getDb().prepare("UPDATE players SET current_rank = ? WHERE discord_id = ?").run(rank, discordId);
}
function setRankByIgn(ign, rank) {
  getDb().prepare("UPDATE players SET current_rank = ? WHERE lower(ign) = lower(?)").run(rank, ign);
}
function setPeakTier(discordId, peak) {
  getDb().prepare("UPDATE players SET peak_tier = ? WHERE discord_id = ?").run(peak, discordId);
}
function unlinkPlayer(discordId) {
  getDb().prepare("DELETE FROM players WHERE discord_id = ?").run(discordId);
}
function tierWipe(discordId) {
  getDb().prepare("UPDATE players SET current_rank = NULL, peak_tier = NULL WHERE discord_id = ?").run(discordId);
}
function tierTransfer(fromId, toId) {
  const src = getPlayer(fromId);
  if (!src) return false;
  getDb().prepare("UPDATE players SET current_rank = ?, peak_tier = ? WHERE discord_id = ?")
    .run(src.current_rank, src.peak_tier, toId);
  return true;
}

// ── Cooldowns ────────────────────────────────────────────────
function getCooldown(discordId) {
  return getDb().prepare("SELECT * FROM cooldowns WHERE discord_id = ?").get(discordId);
}
function setCooldown(discordId, hours) {
  const expires = Math.floor(Date.now() / 1000) + hours * 3600;
  getDb().prepare(`
    INSERT INTO cooldowns (discord_id, expires_at) VALUES (?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET expires_at = excluded.expires_at
  `).run(discordId, expires);
}
function resetCooldown(discordId) {
  getDb().prepare("DELETE FROM cooldowns WHERE discord_id = ?").run(discordId);
}

// ── Waitlist ─────────────────────────────────────────────────
function addToWaitlist(discordId, ign, region, prefServer) {
  return getDb().prepare(
    "INSERT INTO waitlist (discord_id, ign, region, pref_server) VALUES (?, ?, ?, ?)"
  ).run(discordId, ign, region, prefServer || null);
}
function getWaitlist(region) {
  return getDb().prepare(
    "SELECT * FROM waitlist WHERE region = ? AND status = 'waiting' ORDER BY joined_at ASC"
  ).all(region);
}
function getAllWaitlists() {
  return getDb().prepare("SELECT * FROM waitlist WHERE status IN ('waiting','in_test') ORDER BY joined_at ASC").all();
}
function nextInWaitlist(region) {
  return getDb().prepare(
    "SELECT * FROM waitlist WHERE region = ? AND status = 'waiting' ORDER BY joined_at ASC LIMIT 1"
  ).get(region);
}
function setWaitlistStatus(id, status) {
  getDb().prepare("UPDATE waitlist SET status = ? WHERE id = ?").run(status, id);
}
function removeFromWaitlist(discordId) {
  getDb().prepare("DELETE FROM waitlist WHERE discord_id = ? AND status = 'waiting'").run(discordId);
}
function playerInWaitlist(discordId) {
  return getDb().prepare(
    "SELECT * FROM waitlist WHERE discord_id = ? AND status IN ('waiting','in_test')"
  ).get(discordId);
}

// ── Testers ──────────────────────────────────────────────────
function getTesters() {
  return getDb().prepare("SELECT * FROM testers").all();
}
function getActiveTesterCount() {
  return getDb().prepare("SELECT count(*) as c FROM testers WHERE status = 'active'").get().c;
}
function addTester(discordId, status) {
  getDb().prepare(`
    INSERT INTO testers (discord_id, status) VALUES (?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET status = excluded.status, started_at = strftime('%s','now')
  `).run(discordId, status);
}
function removeTester(discordId) {
  getDb().prepare("DELETE FROM testers WHERE discord_id = ?").run(discordId);
}
function getTesterStatus(discordId) {
  return getDb().prepare("SELECT * FROM testers WHERE discord_id = ?").get(discordId);
}
function setTesterStatus(discordId, status) {
  getDb().prepare("UPDATE testers SET status = ? WHERE discord_id = ?").run(status, discordId);
}

// ── Tickets ──────────────────────────────────────────────────
function createTicket(channelId, playerId, testerId, waitlistId, region) {
  getDb().prepare(`
    INSERT OR REPLACE INTO tickets (channel_id, player_id, tester_id, waitlist_id, region)
    VALUES (?, ?, ?, ?, ?)
  `).run(channelId, playerId, testerId, waitlistId, region);
}
function getTicket(channelId) {
  return getDb().prepare("SELECT * FROM tickets WHERE channel_id = ?").get(channelId);
}
function getTicketByPlayer(playerId) {
  return getDb().prepare("SELECT * FROM tickets WHERE player_id = ?").get(playerId);
}
function closeTicket(channelId) {
  getDb().prepare("DELETE FROM tickets WHERE channel_id = ?").run(channelId);
}
function updateTicketActivity(channelId) {
  getDb().prepare(
    "UPDATE tickets SET last_activity = strftime('%s','now') WHERE channel_id = ?"
  ).run(channelId);
}
function setTicketLock(channelId, locked) {
  getDb().prepare("UPDATE tickets SET locked = ? WHERE channel_id = ?").run(locked ? 1 : 0, channelId);
}
function setTicketExempt(channelId, exempt) {
  getDb().prepare("UPDATE tickets SET exempt = ? WHERE channel_id = ?").run(exempt ? 1 : 0, channelId);
}
function getStaleTickets(thresholdSeconds) {
  const cutoff = Math.floor(Date.now() / 1000) - thresholdSeconds;
  return getDb().prepare(
    "SELECT * FROM tickets WHERE exempt = 0 AND last_activity < ?"
  ).all(cutoff);
}

// ── Test History ─────────────────────────────────────────────
function addHistory(entry) {
  return getDb().prepare(`
    INSERT INTO test_history (discord_id, ign, tester_id, tier, prev_rank, notes, region, result)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(entry.discordId, entry.ign, entry.testerId, entry.tier, entry.prevRank, entry.notes, entry.region, entry.result);
}
function getHistory(discordId, limit = 10) {
  return getDb().prepare(
    "SELECT * FROM test_history WHERE discord_id = ? ORDER BY tested_at DESC LIMIT ?"
  ).all(discordId, limit);
}
function getTesterStats(testerId) {
  return getDb().prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN result='pass' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN result='skip' THEN 1 ELSE 0 END) as skipped
    FROM test_history WHERE tester_id = ?
  `).get(testerId);
}

// ── Config ───────────────────────────────────────────────────
function getConfig(key) {
  const row = getDb().prepare("SELECT value FROM config WHERE key = ?").get(key);
  return row ? row.value : null;
}
function setConfig(key, value) {
  getDb().prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(key, String(value));
}

// ── Quota ────────────────────────────────────────────────────
function incrementQuota(testerId) {
  const month = new Date().toISOString().slice(0, 7);
  getDb().prepare(`
    INSERT INTO quota (discord_id, month, tests_done) VALUES (?, ?, 1)
    ON CONFLICT(discord_id, month) DO UPDATE SET tests_done = tests_done + 1
  `).run(testerId, month);
}
function getQuota(testerId) {
  const month = new Date().toISOString().slice(0, 7);
  return getDb().prepare(
    "SELECT tests_done FROM quota WHERE discord_id = ? AND month = ?"
  ).get(testerId, month);
}
function getAllQuota() {
  const month = new Date().toISOString().slice(0, 7);
  return getDb().prepare(
    "SELECT discord_id, tests_done FROM quota WHERE month = ? ORDER BY tests_done DESC"
  ).all(month);
}

module.exports = {
  getDb,
  // Players
  getPlayer, getPlayerByIgn, upsertPlayer, setRank, setRankByIgn,
  setPeakTier, unlinkPlayer, tierWipe, tierTransfer,
  // Cooldowns
  getCooldown, setCooldown, resetCooldown,
  // Waitlist
  addToWaitlist, getWaitlist, getAllWaitlists, nextInWaitlist,
  setWaitlistStatus, removeFromWaitlist, playerInWaitlist,
  // Testers
  getTesters, getActiveTesterCount, addTester, removeTester,
  getTesterStatus, setTesterStatus,
  // Tickets
  createTicket, getTicket, getTicketByPlayer, closeTicket,
  updateTicketActivity, setTicketLock, setTicketExempt, getStaleTickets,
  // History
  addHistory, getHistory, getTesterStats,
  // Config
  getConfig, setConfig,
  // Quota
  incrementQuota, getQuota, getAllQuota,
};
