// NLU Test Suite - run with: node js/nlu.test.js
// Tests the local keyword parser in nlu.js

// Mock localStorage for Node.js
globalThis.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = v; },
};

// We test the local parser (no OpenAI API calls)
// To do this, we import and test parseVoiceInput with voiceProvider != 'openai'
// so it falls back to local parsing

async function runTests() {
    // Dynamic import of ES module
    const { parseVoiceInput } = await import('./nlu.js');

    // Set provider to 'external' so it uses local parsing only
    localStorage.setItem('meboard_settings', JSON.stringify({ voiceProvider: 'external' }));

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const fmt = (d) => d.toISOString().split('T')[0];

    // Get the next occurrence of a weekday (1=Mon, 5=Fri, etc.)
    const fmtNextWeekday = (targetDay) => {
        const d = new Date(today);
        const diff = (targetDay - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        return fmt(d);
    };

    const testCases = [
        // === Chinese: date extraction ===
        {
            input: '明天提醒我开会',
            expect: { text: '开会', priority: 'P2', eta: fmt(tomorrow) },
            desc: 'Chinese: tomorrow + task',
        },
        {
            input: '后天下午去看牙医',
            expect: { text: '下午去看牙医', priority: 'P2', eta: fmt(dayAfter) },
            desc: 'Chinese: day after tomorrow',
        },
        {
            input: '下周要交报告',
            expect: { text: '要交报告', priority: 'P2', eta: fmt(nextWeek) },
            desc: 'Chinese: next week',
        },
        {
            input: '3天后提交设计稿',
            expect: { text: '提交设计稿', eta: fmt(new Date(today.getTime() + 3 * 86400000)) },
            desc: 'Chinese: N days later',
        },

        // === Chinese: priority extraction ===
        {
            input: '紧急修复线上bug',
            expect: { text: '修复线上bug', priority: 'P0' },
            desc: 'Chinese: urgent → P0',
        },
        {
            input: '比较急，需要联系客户',
            expect: { text: '需要联系客户', priority: 'P1' },
            desc: 'Chinese: fairly urgent → P1',
        },
        {
            input: '有空的时候整理一下桌面',
            expect: { text: '的时候整理一下桌面', priority: 'P3' },
            desc: 'Chinese: whenever free → P3',
        },

        // === Chinese: date + priority combined ===
        {
            input: '明天紧急处理客户投诉',
            expect: { text: '处理客户投诉', priority: 'P0', eta: fmt(tomorrow) },
            desc: 'Chinese: tomorrow + urgent',
        },

        // === English: date extraction ===
        {
            input: 'remind me tomorrow to buy groceries',
            expect: { text: 'buy groceries', eta: fmt(tomorrow) },
            desc: 'English: tomorrow',
        },
        {
            input: 'finish the report next week',
            expect: { text: 'finish the report', eta: fmt(nextWeek) },
            desc: 'English: next week',
        },
        {
            input: 'submit PR in 5 days',
            expect: { text: 'submit PR', eta: fmt(new Date(today.getTime() + 5 * 86400000)) },
            desc: 'English: in N days',
        },

        // === English: priority extraction ===
        {
            input: 'urgent fix the production server',
            expect: { text: 'fix the production server', priority: 'P0' },
            desc: 'English: urgent → P0',
        },
        {
            input: 'P1 review the design document',
            expect: { text: 'review the design document', priority: 'P1' },
            desc: 'English: explicit P1',
        },
        {
            input: 'low priority clean up the test files',
            expect: { text: 'clean up the test files', priority: 'P3' },
            desc: 'English: low priority → P3',
        },

        // === English: combined ===
        {
            input: 'tomorrow urgent deploy the hotfix',
            expect: { text: 'deploy the hotfix', priority: 'P0', eta: fmt(tomorrow) },
            desc: 'English: tomorrow + urgent',
        },

        // === Common voice prefixes stripped ===
        {
            input: '帮我记一下买牛奶',
            expect: { text: '买牛奶', priority: 'P2' },
            desc: 'Chinese: strip prefix 帮我记一下',
        },
        {
            input: 'add a task to review PRs',
            expect: { text: 'review PRs', priority: 'P2' },
            desc: 'English: strip prefix "add a task to"',
        },

        // === Plain text (no date/priority) ===
        {
            input: '写周报',
            expect: { text: '写周报', priority: 'P2', eta: null },
            desc: 'Chinese: plain text, no date/priority',
        },
        {
            input: 'update the README file',
            expect: { text: 'update the README file', priority: 'P2', eta: null },
            desc: 'English: plain text, no date/priority',
        },

        // === Long / complex Chinese sentences ===
        {
            input: '帮我记一下明天下午三点要跟产品经理开会讨论新版本的需求变更',
            expect: { text: '下午三点要跟产品经理开会讨论新版本的需求变更', eta: fmt(tomorrow) },
            desc: 'Chinese long: meeting with PM about requirements',
        },
        {
            input: '这个事情比较急，后天之前需要把前端的登录页面重构完成并提交代码审查',
            expect: { text: '之前需要把前端的登录页面重构完成并提交代码审查', priority: 'P1', eta: fmt(dayAfter) },
            desc: 'Chinese long: urgent frontend refactor with deadline',
        },
        {
            input: '下周一之前把上个季度的财务报表整理好发给王总审批',
            expect: { eta: fmtNextWeekday(1) },
            desc: 'Chinese long: financial report with weekday deadline',
        },
        {
            input: '提醒我周五晚上给爸妈打个电话问一下他们过年回不回来',
            expect: { eta: fmtNextWeekday(5) },
            desc: 'Chinese long: personal call on Friday',
        },
        {
            input: '非常紧急，线上支付接口报错了，需要马上排查日志找到根因并修复',
            expect: { priority: 'P0' },
            desc: 'Chinese long: critical production payment bug',
        },
        {
            input: '有空的时候研究一下新出的那个React Server Components看看能不能用在咱们项目里',
            expect: { priority: 'P3' },
            desc: 'Chinese long: low priority tech research',
        },
        {
            input: '5天后要做季度汇报，需要准备PPT和演示数据，把上季度的增长数据整理成图表',
            expect: { eta: fmt(new Date(today.getTime() + 5 * 86400000)) },
            desc: 'Chinese long: quarterly report prep with deadline',
        },
        {
            input: '记一下下个月要续费阿里云服务器和域名，别忘了提前一周提醒我',
            expect: { text: expect => expect.includes('续费') },
            desc: 'Chinese long: server renewal reminder next month',
        },

        // === Long / complex English sentences ===
        {
            input: 'remind me to schedule a one-on-one with the new hire tomorrow to go over the onboarding checklist and team expectations',
            expect: { eta: fmt(tomorrow) },
            desc: 'English long: onboarding meeting tomorrow',
        },
        {
            input: 'this is urgent we need to fix the authentication flow because users are getting logged out randomly after the last deployment',
            expect: { priority: 'P0' },
            desc: 'English long: urgent auth bug after deployment',
        },
        {
            input: 'next week I need to write a design document for the new microservices architecture and get it reviewed by the tech lead before the sprint planning',
            expect: { eta: fmt(nextWeek) },
            desc: 'English long: design doc with next week deadline',
        },
        {
            input: 'low priority but whenever you get a chance look into upgrading our CI pipeline from Jenkins to GitHub Actions and write up a migration plan',
            expect: { priority: 'P3' },
            desc: 'English long: low priority CI migration',
        },
        {
            input: 'in 3 days submit the final version of the quarterly budget proposal to the finance team with all the updated headcount numbers',
            expect: { eta: fmt(new Date(today.getTime() + 3 * 86400000)) },
            desc: 'English long: budget proposal in 3 days',
        },
        {
            input: 'P1 important follow up with the client about the contract renewal and make sure legal has reviewed the updated terms and conditions',
            expect: { priority: 'P1' },
            desc: 'English long: P1 contract follow-up',
        },
        {
            input: 'add a task to refactor the database connection pooling layer because we keep hitting max connections during peak traffic hours',
            expect: { text: expect => expect.includes('refactor') },
            desc: 'English long: DB connection pooling refactor',
        },

        // === Mixed language / edge cases ===
        {
            input: '明天跟team sync一下，讨论Q2的OKR和roadmap规划',
            expect: { eta: fmt(tomorrow) },
            desc: 'Mixed CN/EN: team sync about Q2 OKR',
        },
        {
            input: '这个bug很急，用户在checkout页面点击pay按钮之后页面直接crash了，需要今天搞定',
            expect: { priority: 'P0', eta: fmt(today) },
            desc: 'Mixed CN/EN: urgent checkout crash fix today',
        },
    ];

    let passed = 0;
    let failed = 0;

    for (const tc of testCases) {
        const result = await parseVoiceInput(tc.input);
        const errors = [];

        if (tc.expect.text) {
            if (typeof tc.expect.text === 'function') {
                if (!tc.expect.text(result.text)) {
                    errors.push(`text: custom check failed, got "${result.text}"`);
                }
            } else if (!result.text.includes(tc.expect.text) && tc.expect.text !== result.text) {
                errors.push(`text: expected "${tc.expect.text}", got "${result.text}"`);
            }
        }
        if (tc.expect.priority && result.priority !== tc.expect.priority) {
            errors.push(`priority: expected ${tc.expect.priority}, got ${result.priority}`);
        }
        if (tc.expect.eta !== undefined && result.eta !== tc.expect.eta) {
            errors.push(`eta: expected ${tc.expect.eta}, got ${result.eta}`);
        }

        if (errors.length === 0) {
            passed++;
            console.log(`  ✅ ${tc.desc}`);
        } else {
            failed++;
            console.log(`  ❌ ${tc.desc}`);
            errors.forEach(e => console.log(`     ${e}`));
            console.log(`     input: "${tc.input}" → ${JSON.stringify(result)}`);
        }
    }

    const correctionCases = [
        {
            input: '你前面识别的文字有拼写错误',
            context: { text: '明天提交周报', priority: 'P2', eta: null },
            expect: { text: '明天提交周报', textChanged: false },
            desc: 'Correction guidance only should not overwrite text',
        },
        {
            input: '把周报改成日报',
            context: { text: '明天提交周报', priority: 'P2', eta: null },
            expect: { text: '明天提交日报', textChanged: true },
            desc: 'Explicit replace instruction should update existing text',
        },
    ];

    for (const tc of correctionCases) {
        const result = await parseVoiceInput(tc.input, tc.context);
        const errors = [];

        if (result.text !== tc.expect.text) {
            errors.push(`text: expected "${tc.expect.text}", got "${result.text}"`);
        }
        if (result.textChanged !== tc.expect.textChanged) {
            errors.push(`textChanged: expected ${tc.expect.textChanged}, got ${result.textChanged}`);
        }

        if (errors.length === 0) {
            passed++;
            console.log(`  ✅ ${tc.desc}`);
        } else {
            failed++;
            console.log(`  ❌ ${tc.desc}`);
            errors.forEach(e => console.log(`     ${e}`));
            console.log(`     input: "${tc.input}" with context ${JSON.stringify(tc.context)} → ${JSON.stringify(result)}`);
        }
    }

    const totalCases = testCases.length + correctionCases.length;
    console.log(`\n${passed} passed, ${failed} failed out of ${totalCases} tests`);
    if (failed > 0) process.exit(1);
}

runTests().catch(e => { console.error(e); process.exit(1); });
