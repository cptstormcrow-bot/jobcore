import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * FieldJobDetail — module-local job detail screen (P4.S3.3).
 *
 * This is NOT `apps/mobile`'s shared `JobDetail.tsx`. field-tech's isolation
 * rule forbids importing anything from `apps/mobile`, so this screen is
 * self-contained: it only depends on this module's own data seam
 * (`../data/ports`) and session/port plumbing (`../lib/module-session`,
 * `../lib/module-ports`), mirroring `modules/admin-finance/src`'s layering.
 *
 * ZERO financial fields. This screen must never render anything sourced
 * from `price_sheets`, commissions, or payout data — grep-checked in S5.5.
 * If a job record happens to carry a financial field, it is simply never
 * read here.
 *
 * Ties to spec AC9.
 */
import * as React from 'react';
import { View, Text, Linking, StyleSheet } from 'react-native';
import { ScreenTitle, Button, telUrl } from '@jobcore/ui';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
function formatDateTime(value) {
    if (!value)
        return 'Not set';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return value;
    return parsed.toLocaleString();
}
/** Builds a `maps:` URL for tap-to-map — no new native deps. */
function mapsUrl(address) {
    return `maps:0,0?q=${encodeURIComponent(address)}`;
}
/**
 * Module-local job detail screen. Shows requested vs scheduled timing
 * distinctly, tap-to-call / tap-to-map actions, and read-only admin notes.
 * Renders nothing financial.
 */
export function FieldJobDetail({ jobId, customerPhone }) {
    const session = getModuleSession();
    const [job, setJob] = React.useState(null);
    const [adminNotes, setAdminNotes] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        if (!session) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const ports = getModulePorts();
                const [loadedJob, notes] = await Promise.all([
                    ports.jobs.getById(jobId, session.userId),
                    ports.notes.listForJob(jobId),
                ]);
                if (cancelled)
                    return;
                setJob(loadedJob);
                setAdminNotes(notes.filter((note) => note.kind === 'admin_correction'));
            }
            catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load job.');
                }
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [jobId, session]);
    const handleCall = React.useCallback(() => {
        if (!customerPhone)
            return;
        void Linking.openURL(telUrl(customerPhone));
    }, [customerPhone]);
    const handleMap = React.useCallback(() => {
        if (!job?.address)
            return;
        void Linking.openURL(mapsUrl(job.address));
    }, [job]);
    if (!session) {
        return (_jsx(View, { style: styles.container, children: _jsx(Text, { children: "Signing in\u2026" }) }));
    }
    if (loading) {
        return (_jsx(View, { style: styles.container, children: _jsx(Text, { children: "Loading job\u2026" }) }));
    }
    if (error) {
        return (_jsx(View, { style: styles.container, children: _jsx(Text, { style: styles.error, children: error }) }));
    }
    if (!job) {
        return (_jsx(View, { style: styles.container, children: _jsx(Text, { children: "Job not found." }) }));
    }
    return (_jsxs(View, { style: styles.container, children: [_jsx(ScreenTitle, { title: "Field Job Detail", subtitle: job.address ?? undefined }), _jsxs(Text, { style: styles.title, children: ["Job ", job.id] }), _jsx(Text, { style: styles.status, children: job.status }), job.description ? _jsx(Text, { style: styles.description, children: job.description }) : null, _jsxs(View, { style: styles.section, children: [_jsx(Text, { style: styles.sectionTitle, children: "Timing" }), _jsx(Text, { style: styles.label, children: "Requested window" }), _jsx(Text, { style: styles.value, children: job.requestedWindow ?? 'Not requested' }), _jsx(Text, { style: styles.label, children: "Scheduled start" }), _jsx(Text, { style: styles.value, children: formatDateTime(job.scheduledStart) }), _jsx(Text, { style: styles.label, children: "Scheduled end" }), _jsx(Text, { style: styles.value, children: formatDateTime(job.scheduledEnd) })] }), _jsxs(View, { style: styles.section, children: [_jsx(Text, { style: styles.sectionTitle, children: "Contact & location" }), _jsx(Button, { label: customerPhone ? `Call ${customerPhone}` : 'No phone on file', onPress: handleCall, variant: "primary", size: "sm", disabled: !customerPhone }), _jsx(Button, { label: job.address ?? 'No address on file', onPress: handleMap, variant: "primary", size: "sm", disabled: !job.address })] }), _jsxs(View, { style: styles.section, children: [_jsx(Text, { style: styles.sectionTitle, children: "Admin notes" }), adminNotes.length === 0 ? (_jsx(Text, { style: styles.value, children: "No admin notes." })) : (adminNotes.map((note) => (_jsxs(View, { style: styles.noteRow, children: [_jsx(Text, { style: styles.noteTimestamp, children: formatDateTime(note.occurredAt) }), _jsx(Text, { style: styles.value, children: note.body })] }, note.id))))] })] }));
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
    },
    status: {
        fontSize: 14,
        color: '#555',
        marginBottom: 12,
    },
    description: {
        fontSize: 14,
        marginBottom: 12,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    label: {
        fontSize: 12,
        color: '#777',
        marginTop: 6,
    },
    value: {
        fontSize: 14,
    },
    noteRow: {
        marginBottom: 8,
    },
    noteTimestamp: {
        fontSize: 11,
        color: '#999',
    },
    error: {
        color: '#b00020',
    },
});
