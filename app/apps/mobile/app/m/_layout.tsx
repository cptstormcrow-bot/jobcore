import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Slot } from 'expo-router';
import { colors } from '@jobcore/ui';

// Bottom Calendar | Jobs bar removed from every screen (Jeff 2026-10-30).
export default function ModuleLayout() {
  return (
    <View style={styles.root}>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.offWhite },
});
