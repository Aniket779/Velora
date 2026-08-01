'use strict';

/**
 * ============================================================================
 * MONGO CONNECTION ERRORS, EXPLAINED
 * ============================================================================
 * Shared by the server, the seeder and sync-indexes.
 *
 * It lives in its own file because the first version of this advice was inside
 * config/db.js — which the scripts don't use. They call mongoose.connect
 * directly, so the one place a connection error is most likely to be seen (a
 * seed run, before anything else works) was the one place with no guidance.
 *
 * The driver's own messages describe the symptom accurately and say nothing
 * about the cause. All three of these look similar and have unrelated fixes.
 * ============================================================================
 */

const explainConnectionError = (message = '') => {
  // 1. DNS. mongodb+srv:// resolves an SRV record BEFORE connecting, so this
  //    fails without a single packet reaching Atlas. Checking the allowlist or
  //    the password here is wasted time.
  if (/querySrv|ECONNREFUSED\s+_mongodb|queryTxt|EAI_AGAIN/i.test(message)) {
    return (
      'This is a DNS problem, not an Atlas problem. The SRV lookup that\n' +
      'mongodb+srv:// depends on failed, so nothing reached MongoDB.\n' +
      '\n' +
      'Confirm it:\n' +
      '  nslookup -type=SRV _mongodb._tcp.<your-cluster>.mongodb.net\n' +
      '  nslookup -type=SRV _mongodb._tcp.<your-cluster>.mongodb.net 8.8.8.8\n' +
      'If only the second returns records, your ISP resolver is the cause.\n' +
      'Consumer ISPs handle SRV queries badly more often than you would think.\n' +
      '\n' +
      'Two fixes:\n' +
      '  A. Atlas -> Connect -> Drivers -> Version "2.2.12 or later".\n' +
      '     That gives a mongodb:// string with the hosts written out, which\n' +
      '     needs no SRV lookup at all. Keep /Velora in it.\n' +
      '  B. Set your DNS servers to 8.8.8.8 and 1.1.1.1.'
    );
  }

  // 2. Reachable, but refusing us.
  if (/ENOTFOUND|timed out|ServerSelection/i.test(message)) {
    return (
      'Usually one of three things:\n' +
      '  1. Atlas IP allowlist — Render uses dynamic IPs, so Network Access\n' +
      '     must include 0.0.0.0/0. This is the cause most of the time.\n' +
      '  2. A special character in the password needing URL-encoding\n' +
      '     (@ becomes %40, # becomes %23, and so on).\n' +
      '  3. The cluster is paused — free clusters pause after inactivity.'
    );
  }

  // 3. We got there and were rejected. Nothing to do with the network.
  if (/bad auth|Authentication failed|SCRAM/i.test(message)) {
    return (
      'The connection reached Atlas and the credentials were rejected.\n' +
      '  - Check the username and password in Atlas -> Database Access\n' +
      '  - The <db_password> placeholder in the copied string must be replaced\n' +
      '  - URL-encode special characters in the password'
    );
  }

  return null;
};

/** Prints the explanation, if we have one for this error. */
const printConnectionHelp = (message) => {
  const help = explainConnectionError(message);
  if (help) console.error(`\n${help}\n`);
  return Boolean(help);
};

module.exports = { explainConnectionError, printConnectionHelp };
