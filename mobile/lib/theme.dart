import 'package:flutter/material.dart';

/// Paper and charcoal surfaces. Gold accent. Follows the system theme.
const Color kMatteBlack = Color(0xFF12110E);
const Color kSurface = Color(0xFF1C1A16);
const Color kGold = Color(0xFFC9A227);
const Color kGoldInk = Color(0xFF1A1408);
const Color kIvory = Color(0xFFF4EFE6);
const Color kPaper = Color(0xFFF7F4EE);
const Color kInk = Color(0xFF1A1714);

ThemeData buildAppTheme() {
  const scheme = ColorScheme.dark(
    brightness: Brightness.dark,
    primary: kGold,
    onPrimary: kGoldInk,
    secondary: kGold,
    onSecondary: kGoldInk,
    surface: kSurface,
    onSurface: kIvory,
    error: Color(0xFFF0B0AA),
    onError: kMatteBlack,
  );
  return _theme(scheme, kMatteBlack);
}

ThemeData buildLightTheme() {
  const scheme = ColorScheme.light(
    brightness: Brightness.light,
    primary: kGold,
    onPrimary: kGoldInk,
    secondary: kGold,
    onSecondary: kGoldInk,
    surface: Color(0xFFFFFDF8),
    onSurface: kInk,
    error: Color(0xFF8D2A24),
    onError: Color(0xFFFFFDF8),
  );
  return _theme(scheme, kPaper);
}

ThemeData _theme(ColorScheme scheme, Color scaffold) {
  return ThemeData(
    useMaterial3: true,
    brightness: scheme.brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: scaffold,
    focusColor: kGold,
    appBarTheme: AppBarTheme(
      backgroundColor: scaffold,
      foregroundColor: scheme.onSurface,
      elevation: 0,
      centerTitle: false,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(64, 48),
        backgroundColor: kGold,
        foregroundColor: kGoldInk,
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      focusedBorder: OutlineInputBorder(
        borderSide: BorderSide(color: kGold, width: 2),
      ),
    ),
  );
}
