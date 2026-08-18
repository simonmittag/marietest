const { defineConfig } = require("cypress");
const dns = require("dns").promises;

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      on("task", {
        async resolveDns(domain) {
          try {
            const addresses = await dns.resolveAny(domain);
            return addresses;
          } catch (error) {
            try {
              // Fallback to lookup if resolveAny fails (some domains might not have all record types)
              const lookup = await dns.lookup(domain, { all: true });
              return lookup.map(l => ({ address: l.address, type: l.family === 4 ? 'A' : 'AAAA' }));
            } catch (innerError) {
              return { error: innerError.message };
            }
          }
        },
        async performHttpRequest({ url, maxRedirects = 10, timeout = 10000 }) {
          const logs = [];
          let currentUrl = url;
          let depth = 0;

          while (depth <= maxRedirects) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            const start = Date.now();

            try {
              const response = await fetch(currentUrl, {
                method: 'GET',
                redirect: 'manual',
                signal: controller.signal,
                headers: {
                  'User-Agent': 'Cypress/marietest'
                }
              });
              const end = Date.now();
              const duration = end - start;
              clearTimeout(id);

              const logEntry = {
                url: currentUrl,
                status: response.status,
                duration: duration,
                headers: Object.fromEntries(response.headers.entries())
              };
              logs.push(logEntry);

              if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
                let nextUrl = response.headers.get('location');
                if (!nextUrl.startsWith('http')) {
                  const urlObj = new URL(currentUrl);
                  nextUrl = new URL(nextUrl, urlObj.href).href;
                }
                currentUrl = nextUrl;
                depth++;
              } else {
                return { status: 'PASS', logs };
              }
            } catch (error) {
              clearTimeout(id);
              const end = Date.now();
              const duration = end - start;
              
              let errorCode = 'ERROR';
              if (error.name === 'AbortError') {
                errorCode = 'ETIMEDOUT';
              } else if (error.cause && error.cause.code) {
                errorCode = error.cause.code;
              } else if (error.code) {
                errorCode = error.code;
              }

              logs.push({
                url: currentUrl,
                status: 'ERROR',
                duration: duration,
                error: errorCode
              });
              return { status: 'FAIL', logs, error: errorCode };
            }
          }

          return { status: 'FAIL', logs, error: 'Max redirects exceeded' };
        },
        log(message) {
          console.log(message);
          return null;
        }
      });
    },
    video: false,
    screenshotOnRunFailure: false,
    supportFile: false,
  },
});
