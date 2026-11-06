const datos = new Map();
export const getItemAsync = async (k) => datos.get(k) ?? null;
export const setItemAsync = async (k, v) => { datos.set(k, v); };
export const deleteItemAsync = async (k) => { datos.delete(k); };
