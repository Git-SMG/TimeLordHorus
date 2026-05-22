// Revenue Engine - perpetual dime trigger + tripling compounding with guardrails
class RevenueEngine {
    constructor() {
        this.storageKey = 'timelord_revenue_engine';
        this.processedSecondKey = null;
        this.state = {
            startedAt: Date.now(),
            totalEvents: 0,
            totalRevenueCents: 0,
            growthBalanceCents: 0,
            reserveBalanceCents: 0,
            withdrawnCents: 0,
            lastCompoundedAt: Date.now(),
            lastTriggerAt: null,
            lastHealthCheckDate: null,
            volatilityBlocks: 0,
            logs: [],
            config: {
                compoundingIntervalSeconds: 60,
                reservePercent: 40,
                riskCapPercent: 60,
                volatilityLimitPercent: 250,
                autoWithdrawThresholdCents: 50000
            }
        };

        this.init();
    }

    init() {
        this.load();
        this.bindEvents();
        this.startScheduler();
        this.updateUI();
    }

    bindEvents() {
        this.bindMoreToolsMenu();

        const openBtn = document.getElementById('revenueEngineBtn');
        const closeBtn = document.getElementById('closeRevenueEngineModal');
        const modal = document.getElementById('revenueEngineModal');
        const saveBtn = document.getElementById('saveRevenueSettingsBtn');
        const simulateBtn = document.getElementById('runRevenueSimulationBtn');

        if (!openBtn || !closeBtn || !modal || !saveBtn || !simulateBtn) return;

        openBtn.addEventListener('click', () => {
            modal.classList.add('open');
            this.updateUI();
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('open');
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.remove('open');
            }
        });

        saveBtn.addEventListener('click', () => {
            this.saveConfigFromInputs();
        });

        simulateBtn.addEventListener('click', () => {
            this.runSimulation();
        });
    }

    bindMoreToolsMenu() {
        const trigger = document.getElementById('moreToolsBtn');
        const dropdown = document.getElementById('moreToolsDropdown');
        if (!trigger || !dropdown) return;

        trigger.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = dropdown.style.display === 'block';
            dropdown.style.display = isOpen ? 'none' : 'block';
        });

        dropdown.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });

        document.addEventListener('click', (event) => {
            if (!dropdown.contains(event.target) && event.target !== trigger) {
                dropdown.style.display = 'none';
            }
        });
    }

    startScheduler() {
        this.tick();
        this.intervalId = setInterval(() => this.tick(), 250);
    }

    tick() {
        const now = new Date();
        const seconds = now.getSeconds();
        const secondKey = `${now.getHours()}:${now.getMinutes()}:${seconds}`;

        // Trigger only when seconds end in 9: 9, 19, 29, 39, 49, 59 (6x per minute).
        if (seconds % 10 === 9 && this.processedSecondKey !== secondKey) {
            this.processedSecondKey = secondKey;
            this.onRevenueTrigger(now.getTime());
        }

        const elapsed = Date.now() - this.state.lastCompoundedAt;
        const intervalMs = this.state.config.compoundingIntervalSeconds * 1000;

        if (elapsed >= intervalMs) {
            this.applyCompounding();
        }

        this.dailyHealthCheck(now);
        this.updateUI();
    }

    onRevenueTrigger(timestamp) {
        const incomeCents = 10;
        const reserveFromIncome = Math.round((incomeCents * this.state.config.reservePercent) / 100);
        let growthFromIncome = incomeCents - reserveFromIncome;
        let reserveFinal = reserveFromIncome;

        const projectedTotal = this.totalBalanceCents() + incomeCents;
        const maxGrowthAllowed = Math.floor((projectedTotal * this.state.config.riskCapPercent) / 100);

        if ((this.state.growthBalanceCents + growthFromIncome) > maxGrowthAllowed) {
            const overflow = (this.state.growthBalanceCents + growthFromIncome) - maxGrowthAllowed;
            growthFromIncome = Math.max(0, growthFromIncome - overflow);
            reserveFinal += overflow;
            this.log('Risk cap guardrail redirected funds to reserve.');
        }

        this.state.totalEvents += 1;
        this.state.totalRevenueCents += incomeCents;
        this.state.growthBalanceCents += growthFromIncome;
        this.state.reserveBalanceCents += reserveFinal;
        this.state.lastTriggerAt = timestamp;

        this.checkAutoWithdraw();
        this.save();
    }

    applyCompounding() {
        this.state.lastCompoundedAt = Date.now();

        if (this.state.growthBalanceCents <= 0) {
            this.save();
            return;
        }

        const multiplier = 3;
        const growthDeltaPercent = (multiplier - 1) * 100;
        if (growthDeltaPercent > this.state.config.volatilityLimitPercent) {
            this.state.volatilityBlocks += 1;
            this.log('Compounding paused by volatility guardrail.');
            this.save();
            return;
        }

        if (this.state.growthBalanceCents > Number.MAX_SAFE_INTEGER / multiplier) {
            this.state.growthBalanceCents = Number.MAX_SAFE_INTEGER;
            this.log('Compounding capped at MAX_SAFE_INTEGER to avoid overflow.');
        } else {
            this.state.growthBalanceCents *= multiplier;
        }
        this.log('Compounding cycle executed: growth balance tripled.');
        this.checkAutoWithdraw();
        this.save();
    }

    checkAutoWithdraw() {
        const threshold = this.state.config.autoWithdrawThresholdCents;
        const total = this.totalBalanceCents();

        if (total <= threshold) return;

        let excess = total - threshold;
        const fromGrowth = Math.min(this.state.growthBalanceCents, excess);
        this.state.growthBalanceCents -= fromGrowth;
        excess -= fromGrowth;

        if (excess > 0) {
            this.state.reserveBalanceCents -= excess;
        }

        this.state.withdrawnCents += (total - threshold);
        this.log(`Auto-withdraw executed: ${this.formatCents(total - threshold)} moved out.`);
    }

    dailyHealthCheck(now) {
        const today = now.toISOString().slice(0, 10);
        if (this.state.lastHealthCheckDate === today) return;

        this.state.lastHealthCheckDate = today;
        const staleSeconds = this.state.lastTriggerAt
            ? Math.floor((Date.now() - this.state.lastTriggerAt) / 1000)
            : null;

        if (staleSeconds !== null && staleSeconds > 70) {
            this.log('Health check warning: trigger appears stale.');
        } else {
            this.log('Health check passed.');
        }

        this.save();
    }

    saveConfigFromInputs() {
        const compoundingSeconds = Number.parseInt(document.getElementById('revenueCompoundingSeconds')?.value || '60', 10);
        const reservePercent = Number.parseInt(document.getElementById('revenueReservePercent')?.value || '40', 10);
        const riskCapPercent = Number.parseInt(document.getElementById('revenueRiskCapPercent')?.value || '60', 10);
        const volatilityLimitPercent = Number.parseInt(document.getElementById('revenueVolatilityLimit')?.value || '250', 10);
        const autoWithdrawDollars = Number.parseFloat(document.getElementById('revenueAutoWithdraw')?.value || '500');

        this.state.config.compoundingIntervalSeconds = this.clamp(compoundingSeconds, 5, 86400);
        this.state.config.reservePercent = this.clamp(reservePercent, 0, 100);
        this.state.config.riskCapPercent = this.clamp(riskCapPercent, 0, 100);
        this.state.config.volatilityLimitPercent = this.clamp(volatilityLimitPercent, 10, 1000);
        this.state.config.autoWithdrawThresholdCents = Math.max(100, Math.floor(autoWithdrawDollars * 100));

        this.log('Settings updated.');
        this.save();
        this.updateUI();
        window.browser?.showToast('Revenue engine settings saved', 'success');
    }

    runSimulation() {
        const minutes = this.clamp(
            Number.parseInt(document.getElementById('revenueSimulationMinutes')?.value || '60', 10),
            1,
            525600
        );

        const events = minutes * 6; // 6 trigger events per minute (seconds ending in 9)
        const revenueCents = events * 10;
        const reservePart = Math.round((revenueCents * this.state.config.reservePercent) / 100);
        const growthPart = revenueCents - reservePart;
        const compoundingCycles = Math.floor((minutes * 60) / this.state.config.compoundingIntervalSeconds);
        let projectedGrowth = growthPart;
        if (this.state.config.volatilityLimitPercent >= 200) {
            for (let i = 0; i < compoundingCycles; i += 1) {
                projectedGrowth = Math.min(Number.MAX_SAFE_INTEGER, projectedGrowth * 3);
                if (projectedGrowth >= Number.MAX_SAFE_INTEGER) break;
            }
        }

        const projectedTotal = reservePart + projectedGrowth;
        const output = [
            `Projection window: ${minutes} minute(s)`,
            `Clock-hit events (seconds 9,19,29,39,49,59): ${events}`,
            `Raw trigger revenue: ${this.formatCents(revenueCents)}`,
            `Compounding cycles: ${compoundingCycles}`,
            `Projected growth stream: ${this.formatCents(projectedGrowth)}`,
            `Projected reserve stream: ${this.formatCents(reservePart)}`,
            `Projected total wealth: ${this.formatCents(projectedTotal)}`
        ].join('\n');

        const outputEl = document.getElementById('revenueSimulationOutput');
        if (outputEl) outputEl.textContent = output;
    }

    updateUI() {
        this.setText('revenueEngineStatus', 'Running');
        this.setText('revenueEventsCount', String(this.state.totalEvents));
        this.setText('revenueEarned', this.formatCents(this.state.totalRevenueCents));
        this.setText('revenueGrowthBalance', this.formatCents(this.state.growthBalanceCents));
        this.setText('revenueReserveBalance', this.formatCents(this.state.reserveBalanceCents));
        this.setText('revenueWithdrawn', this.formatCents(this.state.withdrawnCents));
        this.setText('revenueHealthCheck', this.state.lastHealthCheckDate || 'Never');

        this.setInput('revenueCompoundingSeconds', this.state.config.compoundingIntervalSeconds);
        this.setInput('revenueReservePercent', this.state.config.reservePercent);
        this.setInput('revenueRiskCapPercent', this.state.config.riskCapPercent);
        this.setInput('revenueVolatilityLimit', this.state.config.volatilityLimitPercent);
        this.setInput('revenueAutoWithdraw', (this.state.config.autoWithdrawThresholdCents / 100).toFixed(2));

        const logEl = document.getElementById('revenueLog');
        if (!logEl) return;

        if (!this.state.logs.length) {
            logEl.innerHTML = '<div class="empty-state-text">No log entries yet</div>';
            return;
        }

        logEl.innerHTML = this.state.logs
            .slice()
            .reverse()
            .map((entry) => `<div class="revenue-log-entry">${entry}</div>`)
            .join('');
    }

    totalBalanceCents() {
        return this.state.growthBalanceCents + this.state.reserveBalanceCents;
    }

    formatCents(cents) {
        return `$${(cents / 100).toFixed(2)}`;
    }

    clamp(value, min, max) {
        if (Number.isNaN(value)) return min;
        return Math.min(max, Math.max(min, value));
    }

    setText(id, text) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    }

    setInput(id, value) {
        const element = document.getElementById(id);
        if (element) element.value = String(value);
    }

    log(message) {
        const stamp = new Date().toLocaleString();
        this.state.logs.push(`[${stamp}] ${message}`);
        if (this.state.logs.length > 200) {
            this.state.logs = this.state.logs.slice(-200);
        }
    }

    load() {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw);
            this.state = {
                ...this.state,
                ...parsed,
                config: {
                    ...this.state.config,
                    ...(parsed.config || {})
                }
            };
        } catch (error) {
            console.error('Revenue engine load failed:', error);
        }
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.revenueEngine = new RevenueEngine();
});
