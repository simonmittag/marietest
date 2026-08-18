describe('Domain Independent Testing', () => {
  const domains = [
    'marieedith.showit.site',
    'marieedith.com',
    'www.marieedith.com',
    'dearscarlett.showit.site',
    'dearscarlett.studio',
    'www.dearscarlett.studio'
  ];
  const protocols = ['http', 'https'];
  const summary = [];

  domains.forEach((domain) => {
    protocols.forEach((protocol) => {
      const url = `${protocol}://${domain}`;

      it(`Testing ${url}`, () => {
        const testResult = {
          url: url,
          dns: null,
          logs: [],
          status: 'FAIL',
          totalTime: 0,
          error: null
        };

        // 1. DNS Resolution
        cy.task('resolveDns', domain).then((dnsInfo) => {
          testResult.dns = dnsInfo;
          const dnsMsg = `DNS Info for ${domain}: ${JSON.stringify(dnsInfo)}`;
          cy.log(dnsMsg);
          cy.task('log', dnsMsg);
        });

        // 2. HTTP Request via Task (handles redirects and errors gracefully)
        cy.task('performHttpRequest', { url, timeout: 10000 }).then((result) => {
          testResult.status = result.status;
          testResult.logs = result.logs;
          testResult.error = result.error;
          testResult.totalTime = result.logs.reduce((acc, log) => acc + (log.duration || 0), 0);

          summary.push(testResult);

          // Print detail for this test
          const detail = [];
          detail.push('--- TEST DETAIL ---');
          detail.push(`URL: ${testResult.url}`);
          detail.push(`Final Status: ${testResult.status}`);
          if (testResult.error) detail.push(`Error: ${testResult.error}`);
          detail.push(`Total Time: ${testResult.totalTime}ms`);
          detail.push('HTTP LOGS:');
          testResult.logs.forEach((log, i) => {
            const statusStr = log.status === 'ERROR' ? `ERROR: ${log.error}` : log.status;
            detail.push(`  Step ${i + 1}: ${log.url} -> ${statusStr} (${log.duration || 'N/A'}ms)`);
          });
          detail.push('-------------------');
          
          detail.forEach(line => {
            cy.log(line);
            cy.task('log', line);
          });

          // Assert to ensure Cypress reports failure in stats, but with a clean message
          expect(result.status).to.eq('PASS', `Request failed: ${result.error || 'Unknown error'}`);
        });
      });
    });
  });

  after(() => {
    const divider = '─'.repeat(120);
    const header = `${'URL'.padEnd(45)} | ${'STATUS'.padEnd(8)} | ${'CODE'.padEnd(10)} | ${'TIME'.padEnd(8)} | ${'REDIRECTS'}`;
    
    const printLine = (res) => {
      const lastLog = res.logs[res.logs.length - 1];
      const finalCode = lastLog ? (lastLog.status === 'ERROR' ? (lastLog.error || 'ERR') : lastLog.status) : 'N/A';
      const time = `${res.totalTime}ms`.padEnd(8);
      const redirects = (res.logs.length - 1).toString().padStart(9);
      return `${res.url.padEnd(45)} | ${res.status.padEnd(8)} | ${finalCode.toString().padEnd(10)} | ${time} | ${redirects}`;
    };

    cy.log(divider);
    cy.log('                TEST SUMMARY TABLE');
    cy.log(divider);
    cy.log(header);
    cy.log(divider);
    summary.forEach(res => cy.log(printLine(res)));
    cy.log(divider);
    
    const printRedirects = () => {
      const redirected = summary.filter(s => s.logs.length > 1);
      if (redirected.length > 0) {
        cy.log('\n');
        cy.log(divider);
        cy.log('                REDIRECT CHAINS');
        cy.log(divider);
        redirected.forEach(res => {
          cy.log(`SOURCE: ${res.url}`);
          res.logs.forEach((log, i) => {
            const arrow = i === 0 ? '  ' : '  -> ';
            const statusStr = log.status === 'ERROR' ? `ERROR: ${log.error}` : log.status;
            cy.log(`${arrow}${log.url} [${statusStr}]`);
          });
          cy.log('─'.repeat(60));
        });
      }
    };
    printRedirects();

    // Also print to console for terminal output using a task to ensure it shows up
    cy.task('log', '\n' + divider);
    cy.task('log', '                TEST SUMMARY TABLE');
    cy.task('log', divider);
    cy.task('log', header);
    cy.task('log', divider);
    summary.forEach(res => cy.task('log', printLine(res)));
    cy.task('log', divider);

    const taskPrintRedirects = () => {
      const redirected = summary.filter(s => s.logs.length > 1);
      if (redirected.length > 0) {
        cy.task('log', '\n');
        cy.task('log', divider);
        cy.task('log', '                REDIRECT CHAINS');
        cy.task('log', divider);
        redirected.forEach(res => {
          cy.task('log', `SOURCE: ${res.url}`);
          res.logs.forEach((log, i) => {
            const arrow = i === 0 ? '  ' : '  -> ';
            const statusStr = log.status === 'ERROR' ? `ERROR: ${log.error}` : log.status;
            cy.task('log', `${arrow}${log.url} [${statusStr}]`);
          });
          cy.task('log', '─'.repeat(60));
        });
      }
    };
    taskPrintRedirects();
    cy.task('log', '\n');
  });
});
