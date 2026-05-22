/// Версия сборки приложения.
/// Значения подставляются CI в шаге «Обновление version.dart».
/// Формат полной версии: {WEB_PR_NUMBER}.{MOBILE_BUILD}
/// При локальной сборке используются значения по умолчанию.

/// Номер последнего веб-PR (берётся из clubtabletracker.client/src/version.ts)
const String _rawWebVersion = 'WEB_VERSION';

/// Порядковый номер мобильного билда (из MobileFlutter/mobile_build_number.txt)
const String _rawBuildNumber = 'BUILD_NUMBER';
const String _rawBuildDate = 'BUILD_DATE';

String get appWebVersion =>
    _rawWebVersion == 'WEB_VERSION' ? '0' : _rawWebVersion;

String get appBuildNumber =>
    _rawBuildNumber == 'BUILD_NUMBER' ? '0' : _rawBuildNumber;

/// Полная версия вида «245.3» (веб-PR . мобильный билд)
String get appVersion => '$appWebVersion.$appBuildNumber';

String get appBuildDate => _rawBuildDate == 'BUILD_DATE'
    ? DateTime.now().toLocal().toString().substring(0, 10)
    : _rawBuildDate;
