'use strict';

const dns = require('dns');

/**
 * ============================================================================
 * DNS RESOLVER OVERRIDE  —  for mongodb+srv:// on awkward networks
 * ============================================================================
 * Node does not use the OS resolver the way `nslookup` does. It reads the
 * configured nameservers and queries them itself via c-ares.
 *
 * That difference bites in one specific, common setup: when the only DNS
 * server the machine knows is an IPv6 LINK-LOCAL address (fe80::/10, typically
 * your home router). Link-local addresses are only meaningful together with an
 * interface scope, and Node generally can't supply one — so it tries to
 * connect, is refused, and you get:
 *
 *     querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net
 *
 * while `nslookup` on the same machine, on the same network, resolves it fine.
 * That contradiction is the signature of this problem, and it makes the error
 * look like an Atlas fault when nothing has left the laptop.
 *
 * mongodb+srv:// needs an SRV lookup before it connects at all, so this stops
 * the connection dead.
 *
 * Setting DNS_SERVERS in .env points Node at a resolver it can actually reach.
 * Unset by default — this only exists for machines that need it, and it's
 * never needed on a deployed host.
 * ============================================================================
 */
const configureDns = () => {
  const raw = process.env.DNS_SERVERS;
  if (!raw) return null;

  const servers = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!servers.length) return null;

  try {
    dns.setServers(servers);
    console.log(`[DNS] Using ${servers.join(', ')} instead of the system resolver`);
    return servers;
  } catch (err) {
    // A malformed address here shouldn't stop the process — the system
    // resolver may well be fine.
    console.warn(`[DNS] Ignoring invalid DNS_SERVERS (${raw}): ${err.message}`);
    return null;
  }
};

module.exports = configureDns;
