/**
 * Re-export from EditorPreferencesContext for backward compatibility
 * This file now acts as a simple re-export to maintain existing import paths
 *
 * The actual implementation has been moved to EditorPreferencesContext
 * to enable shared state across all components via React Context.
 */
export { useEditorPreferences as default, EditorPreferencesProvider } from '../contexts/EditorPreferencesContext';