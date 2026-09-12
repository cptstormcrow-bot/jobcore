import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * TimeOff screen for the field-tech module (P4 Wave 3 slice S3.6).
 *
 * Time-off request form + read-only "my requests" list. Deliberately
 * isolated from the job state machine: this screen never imports
 * `domain/transition.ts`, never imports `Job`/`JobStatus`/`applyTransition`/
 * `canTransition` from `@jobcore/core`, and never references the `jobs`
 * table/type in any way — it only deals with the tech's own time-off
 * requests via this module's `TimeOffRepository` port
 * (`../data/ports.ts`, already-declared `TimeOffRequest` /
 * `TimeOffRequestDraft` / `TimeOffRepository`).
 *
 * ZERO financial fields.
 *
 * Mirrors the house style of `Greeting.tsx` / `DayList.tsx` /
 * `FieldJobDetail.tsx`: session/ports resolved via `lib/module-session.ts`
 * and `lib/module-ports.ts`, never constructed locally.
 *
 * Workstream G also shows the tech's own upcoming assignments above the
 * request form, via `TechJobRepository.listAssignedToTech` (already
 * exposed on `ModulePorts.jobs`, same port `DayList.tsx` reads) — so a tech
 * can see what they'd be requesting time off against before submitting.
 * This does NOT violate the "never references the `jobs` table/type" rule
 * above in spirit: that rule is about the job STATE MACHINE (transitions),
 * not a read-only listing; `Job` is imported here purely to type that list,
 * mirroring `DayList.tsx`'s own read-only use of the same type.
 */
import * as React from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { isActiveTimeOffStatus } from '../data/ports';
import { ScreenTitle, Button, colors } from '@jobcore/ui';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { DateRangeCalendar } from './DateRangeCalendar';
function todayIso() {
    const n = new Date();
    const m = String(n.getMonth() + 1).padStart(2, '0');
    const d = String(n.getDate()).padStart(2, '0');
    return `${n.getFullYear()}-${m}-${d}`;
}
function formatDate(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return value;
    return parsed.toLocaleDateString();
}
export function TimeOff({ initialSelectedId }) {
    const session = getModuleSession();
    const [requests, setRequests] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState(null);
    const [selectedId, setSelectedId] = React.useState(null);
    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');
    const [reason, setReason] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const [submitError, setSubmitError] = React.useState(null);
    const [cancellingId, setCancellingId] = React.useState(null);
    const [cancelError, setCancelError] = React.useState(null);
    const [showRequestModal, setShowRequestModal] = React.useState(false);
    const loadRequests = React.useCallback(() => {
        if (session === null) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        const { timeOff } = getModulePorts();
        timeOff
            .listForTech(session.userId)
            .then((result) => {
            if (!cancelled) {
                setRequests(result);
            }
        })
            .catch((err) => {
            if (!cancelled) {
                setLoadError(err instanceof Error ? err.message : 'Failed to load time-off requests.');
            }
        })
            .finally(() => {
            if (!cancelled) {
                setLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [session]);
    React.useEffect(() => {
        const cleanup = loadRequests();
        return cleanup;
    }, [loadRequests]);
    const activeRequests = React.useMemo(() => requests.filter((r) => r.endDate >= todayIso() && isActiveTimeOffStatus(r.status)), [requests]);
    const selectedRequest = selectedId === null ? null : requests.find((r) => r.id === selectedId) ?? null;
    const isAdminAdded = selectedRequest !== null && selectedRequest.createdByAdminId !== null;
    function select(id) {
        const r = requests.find((x) => x.id === id);
        if (!r)
            return;
        setSelectedId(id);
        setStartDate(r.startDate);
        setEndDate(r.endDate);
        setReason(r.reason ?? '');
        setSubmitError(null);
        setCancelError(null);
        setShowRequestModal(true);
    }
    function clearSelection() {
        setSelectedId(null);
        setStartDate('');
        setEndDate('');
        setReason('');
        setSubmitError(null);
        setShowRequestModal(false);
    }
    const closeModal = () => {
        if (selectedId !== null)
            clearSelection();
        else {
            setShowRequestModal(false);
            setSubmitError(null);
        }
    };
    React.useEffect(() => {
        if (initialSelectedId)
            select(initialSelectedId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialSelectedId]);
    const canSubmit = startDate.trim().length > 0 && endDate.trim().length > 0 && !submitting;
    async function handleSubmit() {
        if (!canSubmit) {
            return;
        }
        if (session === null) {
            setSubmitError('No active session — cannot submit request.');
            return;
        }
        setSubmitting(true);
        setSubmitError(null);
        try {
            const { timeOff } = getModulePorts();
            const trimmedReason = reason.trim();
            await timeOff.create(session.org.id, session.userId, {
                startDate: startDate.trim(),
                endDate: endDate.trim(),
                reason: trimmedReason.length > 0 ? trimmedReason : null,
            });
            setStartDate('');
            setEndDate('');
            setReason('');
            setShowRequestModal(false);
            loadRequests();
        }
        catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Failed to submit time-off request.');
        }
        finally {
            setSubmitting(false);
        }
    }
    async function handleCancel(requestId) {
        if (cancellingId !== null) {
            return;
        }
        setCancellingId(requestId);
        setCancelError(null);
        try {
            const { timeOff } = getModulePorts();
            await timeOff.cancel(requestId);
            loadRequests();
        }
        catch (err) {
            setCancelError(err instanceof Error ? err.message : 'Failed to cancel time-off request.');
        }
        finally {
            setCancellingId(null);
        }
    }
    async function handleSave() {
        if (selectedId === null || submitting)
            return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const { timeOff } = getModulePorts();
            const trimmedReason = reason.trim();
            await timeOff.update(selectedId, {
                startDate: startDate.trim(),
                endDate: endDate.trim(),
                reason: trimmedReason.length > 0 ? trimmedReason : null,
            });
            loadRequests();
            clearSelection();
        }
        catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Failed to save time-off request.');
        }
        finally {
            setSubmitting(false);
        }
    }
    async function handleDelete() {
        if (selectedId === null || cancellingId !== null)
            return;
        setCancellingId(selectedId);
        setCancelError(null);
        try {
            const { timeOff } = getModulePorts();
            await timeOff.cancel(selectedId);
            loadRequests();
            clearSelection();
        }
        catch (err) {
            setCancelError(err instanceof Error ? err.message : 'Failed to delete time-off request.');
        }
        finally {
            setCancellingId(null);
        }
    }
    if (session === null) {
        return (_jsx(View, { style: styles.centered, children: _jsx(Text, { style: styles.emptyText, children: "Sign in to request time off." }) }));
    }
    return (_jsxs(View, { style: styles.container, children: [_jsx(ScreenTitle, { title: "Time Off" }), _jsxs(ScrollView, { contentContainerStyle: styles.content, children: [_jsxs(View, { style: styles.section, children: [_jsx(Text, { style: styles.sectionTitle, children: "Upcoming time off" }), loading ? (_jsx(Text, { style: styles.emptyText, children: "Loading\u2026" })) : loadError !== null ? (_jsx(Text, { style: styles.errorText, children: loadError })) : activeRequests.length === 0 ? (_jsx(Text, { style: styles.emptyText, children: "No upcoming time off." })) : (activeRequests.map((item) => (_jsx(Pressable, { onPress: () => select(item.id), style: styles.upcomingRow, children: _jsxs(Text, { style: styles.upcomingText, children: ["\u2022 ", formatDate(item.startDate), " \u2013 ", formatDate(item.endDate)] }) }, item.id))))] }), _jsxs(View, { style: styles.section, children: [_jsx(Text, { style: styles.sectionTitle, children: "Request time off" }), _jsx(Text, { style: styles.label, children: "Date range" }), _jsx(DateRangeCalendar, { startDate: startDate, endDate: endDate, onChangeStartDate: setStartDate, onChangeEndDate: setEndDate, disabled: submitting || showRequestModal, onSelectMarkedDay: (id) => select(id), onDayTapped: () => { if (selectedId === null)
                                    setShowRequestModal(true); }, markedRanges: activeRequests.map((r) => ({ id: r.id, startDate: r.startDate, endDate: r.endDate })) }, selectedId ?? 'new')] }), _jsxs(View, { style: styles.section, children: [_jsx(Text, { style: styles.sectionTitle, children: "My requests" }), cancelError !== null ? _jsx(Text, { style: styles.errorText, children: cancelError }) : null, loading ? (_jsx(Text, { style: styles.emptyText, children: "Loading\u2026" })) : loadError !== null ? (_jsx(Text, { style: styles.errorText, children: loadError })) : requests.length === 0 ? (_jsx(Text, { style: styles.emptyText, children: "No time-off requests yet." })) : (requests.map((item) => {
                                const cancellable = item.status === 'pending' || item.status === 'approved';
                                const cancelling = cancellingId === item.id;
                                return (_jsxs(View, { style: styles.requestRow, children: [_jsxs(Text, { style: styles.requestDates, children: [formatDate(item.startDate), " \u2013 ", formatDate(item.endDate)] }), _jsx(Text, { style: styles.requestStatus, children: item.status }), item.reason !== null ? _jsx(Text, { style: styles.requestReason, children: item.reason }) : null, cancellable ? (_jsx(Button, { label: cancelling ? 'Cancelling…' : 'Cancel', variant: "outline", disabled: cancelling, onPress: () => handleCancel(item.id), style: styles.cancelButton })) : null] }, item.id));
                            }))] })] }), _jsx(Modal, { visible: showRequestModal, transparent: true, animationType: "fade", onRequestClose: closeModal, children: _jsx(Pressable, { style: styles.overlay, onPress: closeModal, children: _jsx(KeyboardAvoidingView, { behavior: Platform.OS === 'ios' ? 'padding' : undefined, style: styles.sheetWrap, children: _jsx(Pressable, { style: styles.sheet, onPress: () => { }, children: _jsxs(ScrollView, { keyboardShouldPersistTaps: "handled", children: [_jsx(Text, { style: styles.modalTitle, children: selectedRequest !== null ? 'Edit time off' : 'Request time off' }), isAdminAdded ? _jsx(Text, { style: styles.emptyText, children: "Added by your admin" }) : null, _jsx(Text, { style: styles.modalRange, children: startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : '' }), selectedRequest !== null ? (_jsxs(_Fragment, { children: [_jsx(Text, { style: styles.label, children: "Date range" }), _jsx(DateRangeCalendar, { startDate: startDate, endDate: endDate, onChangeStartDate: setStartDate, onChangeEndDate: setEndDate, disabled: submitting || isAdminAdded, markedRanges: [] }, `edit-${selectedRequest.id}`)] })) : null, _jsx(Text, { style: styles.label, children: "Reason (optional)" }), _jsx(TextInput, { style: [styles.input, styles.reasonInput], value: reason, onChangeText: setReason, placeholder: "Reason for time off", editable: !submitting && !isAdminAdded, multiline: true }), submitError !== null ? _jsx(Text, { style: styles.errorText, children: submitError }) : null, selectedRequest !== null && cancelError !== null ? _jsx(Text, { style: styles.errorText, children: cancelError }) : null, _jsxs(View, { style: styles.modalButtons, children: [_jsx(Button, { label: isAdminAdded && selectedRequest !== null ? 'Close' : 'Cancel', variant: "outline", onPress: closeModal, style: styles.cancelButton }), selectedRequest === null ? (_jsx(Button, { label: submitting ? 'Submitting…' : 'Submit', disabled: !canSubmit, onPress: handleSubmit, style: styles.submitButton })) : !isAdminAdded ? (_jsxs(_Fragment, { children: [_jsx(Button, { label: cancellingId === selectedId ? 'Deleting…' : 'Delete', variant: "outline", disabled: cancellingId !== null || submitting, onPress: handleDelete, style: styles.cancelButton }), _jsx(Button, { label: submitting ? 'Saving…' : 'Save', disabled: !canSubmit, onPress: handleSave, style: styles.submitButton })] })) : null] })] }) }) }) }) })] }));
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    section: {
        marginBottom: 24,
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
    input: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#ccc',
        borderRadius: 6,
        padding: 8,
        marginTop: 4,
    },
    reasonInput: {
        minHeight: 60,
        textAlignVertical: 'top',
    },
    submitButton: {
        marginTop: 12,
    },
    requestRow: {
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ddd',
    },
    requestDates: {
        fontSize: 14,
        fontWeight: '600',
    },
    requestStatus: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    requestReason: {
        fontSize: 13,
        marginTop: 2,
    },
    cancelButton: {
        marginTop: 6,
        alignSelf: 'flex-start',
    },
    upcomingRow: {
        paddingVertical: 4,
    },
    upcomingText: {
        fontSize: 13,
        color: colors.danger,
    },
    emptyText: {
        color: '#666',
    },
    errorText: {
        color: '#b00020',
        marginTop: 8,
    },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    sheetWrap: { width: '100%', maxHeight: '90%' },
    sheet: { width: '100%', flexShrink: 1, backgroundColor: '#fff', borderRadius: 8, padding: 16 },
    modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
    modalRange: { fontSize: 15, marginBottom: 8 },
    modalButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
