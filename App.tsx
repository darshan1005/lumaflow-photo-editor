import React, { useEffect, useState } from 'react';
import { Alert, Platform, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProjectDatabase } from './src/core/database/database';
import { EditorScreen } from './src/features/editor/screens/EditorScreen';
import { useEditorStore } from './src/features/editor/state/useEditorStore';
import { LibraryScreen } from './src/features/library/screens/LibraryScreen';
import { colors } from './src/theme/colors';
import { ProjectMetadata } from './src/types';

// Conditionally import expo-image-picker (may not be available on web)
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  // Image picker not available
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'library' | 'editor'>('library');
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [db] = useState(() => new ProjectDatabase());

  const initializeSession = useEditorStore(state => state.initializeSession);

  useEffect(() => {
    // Seed initial high-res sample projects
    const initialSamples: ProjectMetadata[] = [
      {
        id: 'sample_landscape_1',
        assetId: 'asset_mountains',
        name: 'Alpine Sunset Peak',
        sourceUri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&q=80',
        thumbnailUri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80',
        originalWidth: 2400,
        originalHeight: 1600,
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 3600000
      },
      {
        id: 'sample_portrait_1',
        assetId: 'asset_portrait',
        name: 'Natural Studio Portrait',
        sourceUri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1600&q=80',
        thumbnailUri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
        originalWidth: 1600,
        originalHeight: 2400,
        createdAt: Date.now() - 172800000,
        updatedAt: Date.now() - 7200000
      },
      {
        id: 'sample_urban_1',
        assetId: 'asset_urban',
        name: 'City Night Lights',
        sourceUri: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1600&q=80',
        thumbnailUri: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&q=80',
        originalWidth: 2400,
        originalHeight: 1600,
        createdAt: Date.now() - 259200000,
        updatedAt: Date.now() - 10800000
      }
    ];
    setProjects(initialSamples);
  }, []);

  const handleSelectProject = (project: ProjectMetadata) => {
    initializeSession(project);
    setCurrentScreen('editor');
  };

  const handleImportPhoto = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web: use HTML file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUri = event.target?.result as string;
            if (!dataUri) return;

            // Get image dimensions
            const img = new (window as any).Image();
            img.onload = () => {
              const newProj: ProjectMetadata = {
                id: `proj_${Date.now()}`,
                assetId: `asset_${Date.now()}`,
                name: file.name?.replace(/\.[^.]+$/, '') || `Imported Photo ${projects.length + 1}`,
                sourceUri: dataUri,
                thumbnailUri: dataUri,
                originalWidth: img.naturalWidth || 1920,
                originalHeight: img.naturalHeight || 1080,
                createdAt: Date.now(),
                updatedAt: Date.now()
              };
              setProjects(prev => [newProj, ...prev]);
              initializeSession(newProj);
              setCurrentScreen('editor');
            };
            img.src = dataUri;
          };
          reader.readAsDataURL(file);
        };
        input.click();
      } else if (ImagePicker) {
        // Native: use expo-image-picker
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert('Permission Required', 'Please grant photo library access to import photos.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 1,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const newProj: ProjectMetadata = {
            id: `proj_${Date.now()}`,
            assetId: `asset_${Date.now()}`,
            name: asset.fileName || `Imported Photo ${projects.length + 1}`,
            sourceUri: asset.uri,
            thumbnailUri: asset.uri,
            originalWidth: asset.width || 1920,
            originalHeight: asset.height || 1080,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          setProjects(prev => [newProj, ...prev]);
          initializeSession(newProj);
          setCurrentScreen('editor');
        }
      } else {
        // Fallback: add a sample image
        const newProj: ProjectMetadata = {
          id: `proj_${Date.now()}`,
          assetId: `asset_${Date.now()}`,
          name: `Imported Photo ${projects.length + 1}`,
          sourceUri: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1600&q=80',
          thumbnailUri: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&q=80',
          originalWidth: 1920,
          originalHeight: 1080,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        setProjects(prev => [newProj, ...prev]);
        initializeSession(newProj);
        setCurrentScreen('editor');
      }
    } catch (err) {
      console.error('Import error:', err);
      Alert.alert('Import Error', 'Failed to import photo. Please try again.');
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        {currentScreen === 'library' ? (
          <LibraryScreen
            projects={projects}
            onSelectProject={handleSelectProject}
            onImportPhoto={handleImportPhoto}
          />
        ) : (
          <EditorScreen onBack={() => setCurrentScreen('library')} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  }
});
