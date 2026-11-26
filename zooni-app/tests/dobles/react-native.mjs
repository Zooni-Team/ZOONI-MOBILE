export const Platform = { OS: 'web', select: (o) => o.web ?? o.default };
export const StyleSheet = { create: (s) => s, flatten: (s) => s };
export const Alert = { alert: () => {} };
export const AppState = { currentState: 'active', addEventListener: () => ({ remove: () => {} }) };
export default { Platform, StyleSheet, Alert, AppState };
