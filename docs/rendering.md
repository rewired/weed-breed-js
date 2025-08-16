# Rendering strategy

The frontend no longer replaces the entire `#content` element on each data update. Instead, `renderContent` builds the desired markup in a temporary container and performs a minimal DOM diff against the existing nodes.

Only changed nodes or attributes are updated. This keeps scroll position and focus in interactive elements such as forms or the strain editor.

If the editor view is active (`treeMode === 'editor'`), the diffing step is skipped and the editor manages its own DOM. This preserves cursor position and unsaved form data during live updates.

## Extending

- `renderStructureContent` and other `render*` functions should continue to build a full DOM subtree based on the provided root element.
- When adding interactive components that must survive live updates, ensure they are rendered once and updated in place rather than rebuilt from strings.
- Avoid direct `innerHTML` replacements in new code. Use the diff helpers or targeted text updates (`txt`).
