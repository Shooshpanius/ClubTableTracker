import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_colors.dart';
import 'screens/home_screen.dart';
import 'screens/club_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/messenger_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ru', null);
  final prefs = await SharedPreferences.getInstance();
  final token = prefs.getString('token') ?? '';
  runApp(ClubTableTrackerApp(initialToken: token));
}

class ClubTableTrackerApp extends StatefulWidget {
  final String initialToken;
  const ClubTableTrackerApp({super.key, required this.initialToken});

  @override
  State<ClubTableTrackerApp> createState() => _ClubTableTrackerAppState();
}

class _ClubTableTrackerAppState extends State<ClubTableTrackerApp> {
  late String _token;

  @override
  void initState() {
    super.initState();
    _token = widget.initialToken;
  }

  void _updateToken(String token) {
    setState(() => _token = token);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Club Table Tracker',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.dark(
          primary: AppColors.accent,
          secondary: AppColors.accentBlue,
          surface: AppColors.cardBg,
          error: AppColors.accent,
        ),
        scaffoldBackgroundColor: AppColors.background,
        appBarTheme: AppBarTheme(
          backgroundColor: AppColors.background,
          foregroundColor: AppColors.textPrimary,
          elevation: 0,
        ),
        textTheme: TextTheme(
          bodyMedium: TextStyle(color: AppColors.textPrimary),
          bodySmall: TextStyle(color: AppColors.textSecondary),
        ),
        useMaterial3: true,
      ),
      onGenerateRoute: (settings) {
        switch (settings.name) {
          case '/':
            return MaterialPageRoute(
              builder: (_) => HomeScreen(
                token: _token,
                onTokenChanged: _updateToken,
              ),
            );
          case '/club':
            final args = settings.arguments as Map<String, dynamic>;
            return MaterialPageRoute(
              builder: (_) => ClubScreen(
                clubId: args['clubId'] as int,
                token: _token,
                onTokenExpired: () => _updateToken(''),
              ),
            );
          case '/settings':
            return MaterialPageRoute(
              builder: (_) => SettingsScreen(
                token: _token,
                onTokenExpired: () => _updateToken(''),
              ),
            );
          case '/messages':
            return MaterialPageRoute(
              builder: (_) => MessengerScreen(
                token: _token,
                onTokenExpired: () => _updateToken(''),
              ),
            );
          default:
            return MaterialPageRoute(
              builder: (_) => HomeScreen(
                token: _token,
                onTokenChanged: _updateToken,
              ),
            );
        }
      },
      initialRoute: '/',
    );
  }
}
