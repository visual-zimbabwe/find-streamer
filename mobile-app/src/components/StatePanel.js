import React from 'react';
import { StyleSheet, View } from 'react-native';
import { EmptyState } from './EmptyState';

export function StatePanel({ type, title, description, onRetry, actionLabel = 'Try Again' }) {
  return (
    <View style={styles.container}>
      <EmptyState
        variant={type}
        title={title}
        description={description}
        primaryAction={onRetry ? { label: actionLabel, icon: 'refresh-outline', onPress: onRetry } : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
});
