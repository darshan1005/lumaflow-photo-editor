import React from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';
import { ProjectMetadata } from '../../../types';

interface LibraryScreenProps {
  projects: ProjectMetadata[];
  onSelectProject: (project: ProjectMetadata) => void;
  onImportPhoto: () => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  projects,
  onSelectProject,
  onImportPhoto
}) => {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>Lumaflow</Text>
          <Text style={styles.subtitle}>Mobile Photo Studio</Text>
        </View>

        <TouchableOpacity style={styles.importBtn} onPress={onImportPhoto}>
          <Text style={styles.importBtnText}>+ Import Photo</Text>
        </TouchableOpacity>
      </View>

      {/* Grid or Empty State */}
      {projects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Photos in Library</Text>
          <Text style={styles.emptySubtitle}>
            Import your first high-resolution photo to start editing.
          </Text>
          <TouchableOpacity style={styles.bigImportBtn} onPress={onImportPhoto}>
            <Text style={styles.bigImportText}>Select Photo from Device</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={item => item.id}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => onSelectProject(item)}
            >
              {item.thumbnailUri ? (
                <Image source={{ uri: item.thumbnailUri }} style={styles.thumbnail} />
              ) : (
                <View style={styles.placeholderThumbnail}>
                  <Text style={styles.placeholderText}>RAW</Text>
                </View>
              )}
              <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  appTitle: {
    ...typography.titleLarge,
    color: '#ffffff'
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted
  },
  importBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.accentPrimary
  },
  importBtnText: {
    ...typography.labelSmall,
    color: '#ffffff',
    fontWeight: '600'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl
  },
  emptyTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs
  },
  emptySubtitle: {
    ...typography.bodyRegular,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg
  },
  bigImportBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    backgroundColor: colors.accentPrimary
  },
  bigImportText: {
    ...typography.bodyMedium,
    color: '#ffffff',
    fontWeight: '600'
  },
  gridContent: {
    padding: spacing.xs
  },
  gridItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    padding: spacing.xs
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 6
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center'
  },
  placeholderText: {
    ...typography.caption,
    color: colors.textMuted
  },
  itemTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2
  }
});
