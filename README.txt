PRIVATE ROUTER - READ-ONLY MULTI-SITE WEB PROXY

Replace the old project files with this project. Do not merge the old Worker into this one.

FILES
package.json
wrangler.jsonc
src/worker.js
src/home.js (the complete HTML interface, exported as a string)
.gitignore

CLOUDFLARE GITHUB BUILDS
Build command: leave blank (do not type "empty")
Deploy command: npx wrangler deploy --config ./wrangler.jsonc
Root directory: /
No --assets argument. No public folder needed.

PASSWORD SETUP
After the first successful deployment, open the Worker > Settings > Variables and Secrets.
Add a Secret named ACCESS_PASSWORD. Choose a long random ASCII password.
Save/deploy. Open the Worker URL. Browser HTTP authentication username: router.
Password: the secret you set. Never commit the password or include it in page source.
Until a secret is configured, the app refuses requests.
Local CLI alternative: npm install; npx wrangler login; npx wrangler deploy;
npx wrangler secret put ACCESS_PASSWORD
For local development use .dev.vars with ACCESS_PASSWORD="your-local-password".
Do not commit .dev.vars.

BLACKLIST
In wrangler.jsonc, edit vars.BLOCKED_DOMAINS, for example:
"BLOCKED_DOMAINS": ["example.com", "another.example"]
Entries are plain hostnames, not URLs. All subdomains are included.
An empty array means no user-configured domains are blocked.
Public HTTPS names only; ports other than 443, literal IPs and selected local names are rejected.
This is not complete DNS-rebinding or destination-IP validation. A blacklist is not a security boundary.
Keep private and monitor usage. External CSS references may contact original domains directly;
this is not a guarantee that every browser request passes through the proxy or blacklist.

DESIGN AND LIMITATIONS
This is intentionally a read-only viewer, not a universal authenticated browser.
No third-party script execution, form submissions, upstream cookies, or credentials forwarding.
All upstream Set-Cookie and authentication headers are discarded.
HTTP Basic authentication is checked for every request and never forwarded upstream.
HTML is sandboxed; scripts and frames are removed; downloads may be restricted by browser sandbox rules.
Do not weaken the sandbox to restore arbitrary third-party scripts on this shared origin.
Javascript-heavy sites, CSS-relative resources, complex navigation and downloads can break.
No support for game traffic, VPN, SOCKS, Wi-Fi proxy settings, or incoming CONNECT.
Uses streaming HTMLRewriter rather than buffering complete pages.
No shared caching of upstream content. Upstream fetches and resources consume Worker quota.
Do not bypass certificate checks or change HTTPS to HTTP for credentials.

SECURITY
Use a fresh Worker hostname if untrusted scripts previously ran on your existing hostname.
Alternatively clear that site's browser data including service workers before testing.
Only use where you have permission. This code is a prototype, not a security-audited proxy.
