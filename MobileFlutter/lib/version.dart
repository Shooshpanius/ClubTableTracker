/// Версия сборки приложения.
/// Значения передаются через --dart-define при сборке (build_mobile.ps1).
/// Формат: 1.0.{BUILD_NUMBER} — совпадает с версией в AndroidManifest.
/// При сборке без скрипта используются значения по умолчанию.

const String _rawBuildNumber = String.fromEnvironment('BUILD_NUMBER', defaultValue: '0');
const String _rawBuildDate = String.fromEnvironment('BUILD_DATE', defaultValue: '');

String get appBuildNumber => _rawBuildNumber;

/// Полная версия вида «1.0.3» — синхронизирована с pubspec.yaml
String get appVersion => '1.0.$appBuildNumber';

String get appBuildDate => _rawBuildDate.isEmpty
    ? DateTime.now().toLocal().toString().substring(0, 10)
    : _rawBuildDate;