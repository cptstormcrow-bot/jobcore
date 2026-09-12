import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Earnings screen for the field-tech module (P4 Wave 3 slice S3.7).
 *
 * Derived hours, commissions, reimbursements, bonus, and pending-close-out
 * state for one job, plus a note-only dispute path. Ties to spec AC6, AC7,
 * AC8, VS6.
 *
 * Derived hours use `job.inProgressAt`/`job.completedAt` — these are the
 * `occurred_at`-stamped fields written by `applyTransition`'s device-clock
 * input (see `@jobcore/core`'s `JobTransitionAudit.occurredAt` doc comment),
 * NOT `synced_at`. `synced_at` only records when a transition reached the
 * server and can lag `occurred_at` by any amount under the offline queue
 * (connectivity gaps, replay on reconnect) — using it for payroll math would
 * silently shift or inflate a tech's hours. This screen never reads or
 * displays a `syncedAt`/`synced_at` value for hours.
 *
 * Bonus uses `NullBonusRule` when no rule applies, so `bonusRule.compute(...)`
 * is always safe to call and always renders a real dollar amount ($0.00),
 * never blank/undefined.
 *
 * Disputes are note-only: a dispute is written as a `job_notes` row
 * (kind='dispute') via `ports.notes.create` and NEVER calls
 * `transitionJob`/`canTransitionJob` — filing a dispute must not change job
 * status. This screen does not import `domain/transition.ts` at all.
 *
 * ZERO status-transition writes — this screen only reads `job.status` for
 * display purposes.
 *
 * Field-tech isolation: this screen reads session/ports via
 * `lib/module-session.ts` (S1.2) and `lib/module-ports.ts` (S1.3) rather
 * than importing anything from `apps/mobile`.
 */
import { useState } from 'react';
import { ScreenTitle } from '@jobcore/ui';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
function formatCurrency(amount) {
    return `$${amount.toFixed(2)}`;
}
/**
 * Derives this job's worked hours from device-clock `occurred_at` fields
 * (`inProgressAt` → `completedAt`), never from `syncedAt`/`synced_at`. If
 * either boundary is missing (job not yet started/completed), no hours are
 * derivable yet and `null` is returned.
 */
function deriveHours(job) {
    if (job.inProgressAt === null || job.completedAt === null) {
        return null;
    }
    const from = job.inProgressAt;
    const to = job.completedAt;
    const hours = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60);
    return {
        jobId: job.id,
        from,
        to,
        hours: hours > 0 ? hours : 0,
    };
}
/**
 * Earnings screen: derived hours, bonus (incl. `NullBonusRule` → $0.00),
 * commissions, reimbursements, pending-close-out state, and a note-only
 * dispute form. Never transitions job status.
 */
export function Earnings({ job, period, bonusRule, commissions, reimbursements, closeOut, }) {
    const [disputeText, setDisputeText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);
    const derivedHours = deriveHours(job);
    const bonusAmount = bonusRule.compute(job, period);
    const totalCommissions = commissions.reduce((sum, c) => sum + c.amount, 0);
    const totalReimbursements = reimbursements.reduce((sum, r) => sum + r.amount, 0);
    const trimmedDispute = disputeText.trim();
    const canSubmitDispute = trimmedDispute.length > 0 && !submitting;
    /**
     * Records a dispute as a note-only write against this job. Deliberately
     * does NOT call `transitionJob`/`canTransitionJob` — a dispute is a
     * comment, never a status change.
     */
    async function handleSubmitDispute() {
        if (!canSubmitDispute) {
            return;
        }
        const session = getModuleSession();
        if (session === null) {
            setError('No active session — cannot record dispute.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const ports = getModulePorts();
            const occurredAt = new Date().toISOString();
            await ports.notes.create(job.organizationId, session.userId, {
                jobId: job.id,
                kind: 'dispute',
                body: trimmedDispute,
                occurredAt,
            });
            setDisputeText('');
            setSubmitted(true);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to record dispute.');
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsxs("div", { children: [_jsx(ScreenTitle, { title: "Earnings" }), _jsxs("p", { children: ["Earnings for ", period.start, " \u2013 ", period.end] }), _jsxs("section", { children: [_jsx("h3", { children: "Hours" }), derivedHours === null ? (_jsx("p", { children: "Hours not yet derivable \u2014 job has not completed." })) : (_jsxs("p", { children: [derivedHours.hours.toFixed(2), " hours (", derivedHours.from, " \u2013 ", derivedHours.to, ")"] }))] }), _jsxs("section", { children: [_jsx("h3", { children: "Bonus" }), _jsx("p", { children: bonusRule.description }), _jsx("p", { children: formatCurrency(bonusAmount) })] }), _jsxs("section", { children: [_jsx("h3", { children: "Commissions" }), commissions.length === 0 ? (_jsx("p", { children: formatCurrency(0) })) : (_jsx("ul", { children: commissions.map((c, i) => (_jsx("li", { children: formatCurrency(c.amount) }, `${c.jobId}-${i}`))) })), _jsxs("p", { children: ["Total: ", formatCurrency(totalCommissions)] })] }), _jsxs("section", { children: [_jsx("h3", { children: "Reimbursements" }), reimbursements.length === 0 ? (_jsx("p", { children: formatCurrency(0) })) : (_jsx("ul", { children: reimbursements.map((r, i) => (_jsx("li", { children: formatCurrency(r.amount) }, `${r.jobId}-${i}`))) })), _jsxs("p", { children: ["Total: ", formatCurrency(totalReimbursements)] })] }), _jsxs("section", { children: [_jsx("h3", { children: "Close-out" }), closeOut.closed ? (_jsxs("p", { children: ["Closed ", closeOut.closedAt !== null ? `on ${closeOut.closedAt}` : '', closeOut.closedBy !== null ? ` by ${closeOut.closedBy}` : ''] })) : (_jsx("p", { children: "Pending \u2014 this period has not been closed out yet." }))] }), _jsxs("section", { children: [_jsx("h3", { children: "Dispute" }), _jsx("p", { children: "Filing a dispute records a note only \u2014 it does not change this job's status." }), _jsx("textarea", { value: disputeText, onChange: (e) => setDisputeText(e.target.value), placeholder: "Describe the dispute", disabled: submitting }), error !== null ? _jsx("p", { role: "alert", children: error }) : null, submitted ? _jsx("p", { children: "Dispute recorded." }) : null, _jsx("button", { type: "button", onClick: () => void handleSubmitDispute(), disabled: !canSubmitDispute, children: submitting ? 'Submitting…' : 'Submit dispute' })] })] }));
}
