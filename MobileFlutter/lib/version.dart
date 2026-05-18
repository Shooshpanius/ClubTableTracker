/// Версия сборки приложения.
/// Значения подставляются CI из clubtabletracker.client/src/version.ts
/// в шаге «Синхронизация версии из браузерной части».
/// При локальной сборке используются значения по умолчанию.

const String _rawBuildNumber = 'BUILD_NUMBER';
const String _rawBuildDate = 'BUILD_DATE';

String get appBuildNumber =>
    _rawBuildNumber == 'BUILD_NUMBER' ? 'local' : _rawBuildNumber;

String get appBuildDate => _rawBuildDate == 'BUILD_DATE'
    ? DateTime.now().toLocal().toString().substring(0, 10)
    : _rawBuildDate;
