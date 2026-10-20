import React from 'react';
import { Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { PayrollButton } from './PayrollButton';

export interface StepperPickerProps {
  /** Centered value text, e.g. a date range or month. */
  value: string;
  onPrev: () => void;
  onNext: () => void;
  /** Accessibility labels for the two arrow buttons. */
  prevLabel: string;
  nextLabel: string;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** JobCore standard picker: previous arrow on the LEFT, value in the middle, next arrow on the RIGHT. */
export function StepperPicker(props: StepperPickerProps) {
  const { value, onPrev, onNext, prevLabel, nextLabel, prevDisabled, nextDisabled, testID, style } = props;
  return (
    <View
      testID={testID}
      style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, style]}
    >
      <PayrollButton
        label="◀"
        accessibilityLabel={prevLabel}
        disabled={prevDisabled}
        onPress={onPrev}
        testID={testID ? `${testID}-prev` : undefined}
      />
      <Text style={{ fontWeight: '600', flex: 1, textAlign: 'center', marginHorizontal: 8 }}>{value}</Text>
      <PayrollButton
        label="▶"
        accessibilityLabel={nextLabel}
        disabled={nextDisabled}
        onPress={onNext}
        testID={testID ? `${testID}-next` : undefined}
      />
    </View>
  );
}
