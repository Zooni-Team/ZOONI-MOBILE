export const Platform = { OS: 'web', select: (o) => o.web ?? o.default };
export const StyleSheet = { create: (s) => s, flatten: (s) => s };
export default { Platform, StyleSheet };
