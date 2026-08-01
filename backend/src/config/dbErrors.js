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
      'This is a DNS problem on THIS MACHINE, not an Atlas problem. Nothing\n' +
      'reached MongoDB — mongodb+srv:// resolves an SRV record before it\n' +
      'connects, and that lookup failed.\n' +
      '\n' +
      'Do NOT go and check the Atlas IP allowlist. Check whether Node can\n' +
      'resolve at all, which is a different question from whether nslookup can:\n' +
      '\n' +
      '  node -e "require(\'dns\').resolveSrv(\'_mongodb._tcp.<cluster>.mongodb.net\',\n' +
      '    (e,r)=>console.log(e?e.code:r))"\n' +
      '\n' +
      'If nslookup works but that fails, the usual cause is the machine having\n' +
      'only an IPv6 link-local nameserver (fe80::...). nslookup handles the\n' +
      'interface scope those need; Node generally cannot, so it is refused.\n' +
      '\n' +
      'Three fixes, cheapest first:\n' +
      '  A. Put DNS_SERVERS=8.8.8.8,1.1.1.1 in backend/.env. Points Node at a\n' +
      '     resolver it can reach. Local only; never needed on a deployed host.\n' +
      '  B. Atlas -> Connect -> Drivers -> Version "2.2.12 or later" for a\n' +
      '     mongodb:// string with hosts written out — no SRV lookup at all.\n' +
      '     Keep /Velora in it.\n' +
      '  C. Set your OS DNS servers to 8.8.8.8 and 1.1.1.1.'
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
