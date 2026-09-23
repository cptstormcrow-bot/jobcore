// Controlled, presentational job-details form shared by the create-mode and
// edit-mode panels in app/job/[jobId].tsx. Field names, state shape, and UI
// primitives mirror that screen's existing JobFormState/EMPTY_JOB_FORM and
// its create/edit form JSX verbatim (slice 17). No data fetching, no
// business logic -- this component only renders `value` and reports
// changes via `onChange`.
import { StyleSheet, Text, View } from 'react-native';
import { copyToClipboard } from '../../../../modules/field-tech/src/lib/clipboard';
import { Button, Checkbox, colors, Select, spacing, TextField, typography } from '@jobcore/ui';

const ROOM_OPTIONS = ['Kitchen', 'Bathroom', 'Bedroom', 'Garage', 'Basement', 'Attic', 'Other'];
const UNASSIGNED_SERVICE_AREA = '';

export type JobFormValues = {
  address: string;
  description: string;
  serviceAreaId: string | null;
  houseAgeYears: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  permitStatus: string;
  parkingAvailable: string;
  rooms: string[];
  panelInfo: string;
  considerations: string;
  ingressInstructions: string;
  evisitParking: string;
  evisitPanel: string;
  service: string;
  preferredDate: string;
  preferredTime: string;
};

export interface JobDetailsFormProps {
  mode: 'edit' | 'create';
  value: JobFormValues;
  onChange: (patch: Partial<JobFormValues>) => void;
  serviceAreas: { id: string; name: string }[];
  hasInvestigation?: boolean;
  error?: string | null;
}

const inputStyleFor = (value: string | null | undefined) =>
  value ? [styles.fieldInput, styles.fieldInputFilled] : styles.fieldInput;

export function JobDetailsForm({
  mode,
  value,
  onChange,
  serviceAreas,
  hasInvestigation,
  error,
}: JobDetailsFormProps) {
  return (
    <View>
      <View style={styles.copyRow}>
        <View style={styles.copyField}>
          <TextField
            label="Customer name"
            value={value.customerName}
            onChangeText={(text) => onChange({ customerName: text })}
            placeholder="Customer name"
            style={[styles.field, styles.fieldTight]}
            labelStyle={styles.fieldLabel}
            inputStyle={inputStyleFor(value.customerName)}
          />
        </View>
        <Button
          label="Copy"
          size="sm"
          variant="outline"
          disabled={!value.customerName}
          onPress={() => copyToClipboard(value.customerName)}
        />
      </View>
      <View style={styles.copyRow}>
        <View style={styles.copyField}>
          <TextField
            label="Address"
            value={value.address}
            onChangeText={(text) => onChange({ address: text })}
            placeholder="Street, city, zip"
            style={[styles.field, styles.fieldTight]}
            labelStyle={styles.fieldLabel}
            inputStyle={inputStyleFor(value.address)}
          />
        </View>
        <Button
          label="Copy"
          size="sm"
          variant="outline"
          disabled={!value.address}
          onPress={() => copyToClipboard(value.address)}
        />
      </View>
      <View style={styles.copyRow}>
        <View style={styles.copyField}>
          <TextField
            label="Customer phone"
            value={value.customerPhone}
            onChangeText={(text) => onChange({ customerPhone: text })}
            placeholder="Customer phone"
            style={[styles.field, styles.fieldTight]}
            labelStyle={styles.fieldLabel}
            inputStyle={inputStyleFor(value.customerPhone)}
          />
        </View>
        <Button
          label="Copy"
          size="sm"
          variant="outline"
          disabled={!value.customerPhone}
          onPress={() => copyToClipboard(value.customerPhone)}
        />
      </View>
      <TextField
        label="Customer email"
        value={value.customerEmail}
        onChangeText={(text) => onChange({ customerEmail: text })}
        placeholder="Customer email"
        style={[styles.field, styles.fieldTight]}
        labelStyle={styles.fieldLabel}
        inputStyle={inputStyleFor(value.customerEmail)}
      />
      <View style={[styles.field, styles.fieldTight]}>
        <Text style={styles.sectionLabel}>Service area</Text>
        <Select
          value={value.serviceAreaId ?? UNASSIGNED_SERVICE_AREA}
          options={[
            { label: 'Unassigned', value: UNASSIGNED_SERVICE_AREA },
            ...serviceAreas.map((area) => ({ label: area.name, value: area.id })),
          ]}
          placeholder={serviceAreas.length ? 'Select service area' : 'No service areas configured'}
          disabled={serviceAreas.length === 0}
          onChange={(selected) => onChange({ serviceAreaId: selected || null })}
        />
      </View>
      <View style={styles.copyRow}>
        <View style={styles.copyField}>
          <TextField
            label="Ingress instructions"
            value={value.ingressInstructions}
            onChangeText={(text) => onChange({ ingressInstructions: text })}
            placeholder="Gate codes, meetup spot, lockbox…"
            multiline
            style={styles.field}
            labelStyle={styles.fieldLabel}
            inputStyle={inputStyleFor(value.ingressInstructions)}
          />
        </View>
        <Button
          label="Copy"
          size="sm"
          variant="outline"
          disabled={!value.ingressInstructions}
          onPress={() => copyToClipboard(value.ingressInstructions)}
        />
      </View>
      <TextField
        label="Permit status"
        value={value.permitStatus}
        onChangeText={(text) => onChange({ permitStatus: text })}
        placeholder="e.g. Filed, pending, not required"
        style={styles.field}
        labelStyle={styles.fieldLabel}
        inputStyle={inputStyleFor(value.permitStatus)}
      />
      <TextField
        label="Parking availability"
        value={value.parkingAvailable}
        onChangeText={(text) => onChange({ parkingAvailable: text })}
        placeholder="e.g. Driveway, street only"
        style={styles.field}
        labelStyle={styles.fieldLabel}
        inputStyle={inputStyleFor(value.parkingAvailable)}
      />
      {mode === 'edit' && hasInvestigation ? (
        <TextField
          label="Parking (Prem)"
          value={value.evisitParking}
          onChangeText={(text) => onChange({ evisitParking: text })}
          placeholder="e.g. Driveway, street only"
          style={styles.field}
          labelStyle={styles.fieldLabel}
          inputStyle={inputStyleFor(value.evisitParking)}
        />
      ) : null}
      <View style={styles.field}>
        <Text style={styles.sectionLabel}>Rooms needing work</Text>
        <View style={styles.roomsGrid}>
          {ROOM_OPTIONS.map((room) => (
            <Checkbox
              key={room}
              label={room}
              checked={value.rooms.includes(room)}
              onChange={(checked) =>
                onChange({
                  rooms: checked ? [...value.rooms, room] : value.rooms.filter((r) => r !== room),
                })
              }
              style={styles.roomCheckbox}
              boxStyle={styles.roomCheckboxBox}
            />
          ))}
        </View>
      </View>
      <TextField
        label="Main panel size/style"
        value={value.panelInfo}
        onChangeText={(text) => onChange({ panelInfo: text })}
        placeholder="e.g. 200A, Square D QO"
        style={styles.field}
        labelStyle={styles.fieldLabel}
        inputStyle={inputStyleFor(value.panelInfo)}
      />
      {mode === 'edit' && hasInvestigation ? (
        <TextField
          label="Panel (Prem)"
          value={value.evisitPanel}
          onChangeText={(text) => onChange({ evisitPanel: text })}
          placeholder="e.g. 200A, Square D QO"
          style={styles.field}
          labelStyle={styles.fieldLabel}
          inputStyle={inputStyleFor(value.evisitPanel)}
        />
      ) : null}
      {mode === 'create' ? (
        <>
          <TextField
            label="Service"
            value={value.service}
            onChangeText={(text) => onChange({ service: text })}
            placeholder="Service"
            style={styles.field}
            labelStyle={styles.fieldLabel}
            inputStyle={inputStyleFor(value.service)}
          />
          <TextField
            label="Preferred date"
            value={value.preferredDate}
            onChangeText={(text) => onChange({ preferredDate: text })}
            placeholder="YYYY-MM-DD"
            style={styles.field}
            labelStyle={styles.fieldLabel}
            inputStyle={inputStyleFor(value.preferredDate)}
          />
          <TextField
            label="Preferred time"
            value={value.preferredTime}
            onChangeText={(text) => onChange({ preferredTime: text })}
            placeholder="Preferred time"
            style={styles.field}
            labelStyle={styles.fieldLabel}
            inputStyle={inputStyleFor(value.preferredTime)}
          />
        </>
      ) : null}
      <TextField
        label={mode === 'create' ? 'Project details' : 'Description'}
        value={value.description}
        onChangeText={(text) => onChange({ description: text })}
        placeholder="What needs to be done"
        multiline
        style={styles.field}
        labelStyle={styles.fieldLabel}
        inputStyle={inputStyleFor(value.description)}
      />
      <TextField
        label="Considerations"
        value={value.considerations}
        onChangeText={(text) => onChange({ considerations: text })}
        placeholder="Anything else worth noting"
        multiline
        style={styles.field}
        labelStyle={styles.fieldLabel}
        inputStyle={inputStyleFor(value.considerations)}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginHorizontal: spacing.md, marginTop: spacing.md },
  fieldTight: { marginTop: spacing.xs },
  fieldLabel: { color: colors.textMutedDark, fontSize: typography.size.detail },
  fieldInput: { fontSize: typography.size.h4, color: colors.text },
  fieldInputFilled: { fontWeight: '600' },
  sectionLabel: { fontWeight: '600', marginBottom: spacing.sm, color: colors.textMutedDark, fontSize: typography.size.detail },
  roomsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: spacing.md, marginTop: spacing.xs },
  roomCheckbox: { width: '50%', minHeight: 28, marginBottom: 0 },
  roomCheckboxBox: { borderWidth: 2, borderColor: colors.primary },
  readOnlyText: { color: colors.textMuted },
  errorText: { color: 'red', marginHorizontal: spacing.md, marginTop: spacing.sm },
  copyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  copyField: { flex: 1 },
});
