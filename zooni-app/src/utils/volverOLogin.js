export function volverOLogin(navigation, login = 'Login') {
  if (navigation.canGoBack()) navigation.goBack();
  else navigation.reset({ index: 0, routes: [{ name: login }] });
}
