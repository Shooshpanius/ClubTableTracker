import 'package:flutter/material.dart';

import '../app_colors.dart';
import '../constants.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class SettingsScreen extends StatefulWidget {
  final String token;
  final VoidCallback onTokenExpired;

  const SettingsScreen({
    super.key,
    required this.token,
    required this.onTokenExpired,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _api = ApiService();

  AppUser? _user;
  bool _loading = true;
  String? _error;

  // Контроллеры полей
  late TextEditingController _displayNameCtrl;
  late TextEditingController _bioCtrl;
  late TextEditingController _cityCtrl;

  // Состояния сохранения
  bool _savingName = false;
  bool _savedName = false;
  bool _savingBio = false;
  bool _savedBio = false;
  bool _savingCity = false;
  bool _savedCity = false;
  bool _savingGs = false;
  bool _savedGs = false;

  Set<String> _selectedSystems = {};

  bool _gsExpanded = false;

  @override
  void initState() {
    super.initState();
    _displayNameCtrl = TextEditingController();
    _bioCtrl = TextEditingController();
    _cityCtrl = TextEditingController();
    _loadProfile();
  }

  @override
  void dispose() {
    _displayNameCtrl.dispose();
    _bioCtrl.dispose();
    _cityCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await _api.getMe(widget.token);
      final user = AppUser.fromJson(data);
      setState(() {
        _user = user;
        _displayNameCtrl.text = user.displayName ?? '';
        _bioCtrl.text = user.bio ?? '';
        _cityCtrl.text = user.city ?? '';
        _selectedSystems = Set.from(user.enabledGameSystems);
        _loading = false;
      });
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        await AuthService.clearToken();
        widget.onTokenExpired();
        return;
      }
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _saveDisplayName() async {
    setState(() {
      _savingName = true;
      _savedName = false;
    });
    try {
      await _api.updateDisplayName(_displayNameCtrl.text.trim(), widget.token);
      setState(() => _savedName = true);
    } catch (e) {
      _showSnack(e.toString());
    } finally {
      setState(() => _savingName = false);
    }
  }

  Future<void> _saveBio() async {
    setState(() {
      _savingBio = true;
      _savedBio = false;
    });
    try {
      await _api.updateBio(_bioCtrl.text.trim(), widget.token);
      setState(() => _savedBio = true);
    } catch (e) {
      _showSnack(e.toString());
    } finally {
      setState(() => _savingBio = false);
    }
  }

  Future<void> _saveCity() async {
    setState(() {
      _savingCity = true;
      _savedCity = false;
    });
    try {
      await _api.updateCity(_cityCtrl.text.trim(), widget.token);
      setState(() => _savedCity = true);
    } catch (e) {
      _showSnack(e.toString());
    } finally {
      setState(() => _savingCity = false);
    }
  }

  Future<void> _saveGameSystems() async {
    setState(() {
      _savingGs = true;
      _savedGs = false;
    });
    try {
      await _api.updateGameSystems(
          _selectedSystems.toList(), widget.token);
      setState(() => _savedGs = true);
    } catch (e) {
      _showSnack(e.toString());
    } finally {
      setState(() => _savingGs = false);
    }
  }

  void _showSnack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.panelBg),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          '⚙️ Настройки профиля',
          style: TextStyle(color: AppColors.accent),
        ),
        backgroundColor: AppColors.background,
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accent))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!,
                          style:
                              const TextStyle(color: AppColors.accent)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                          onPressed: _loadProfile,
                          child: const Text('Повторить')),
                    ],
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildDisplayNameCard(),
                      const SizedBox(height: 12),
                      _buildBioCard(),
                      const SizedBox(height: 12),
                      _buildCityCard(),
                      const SizedBox(height: 12),
                      if (_user != null)
                        _buildPreviewCard(),
                      const SizedBox(height: 12),
                      _buildGameSystemsCard(),
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
    );
  }

  Widget _buildCard({required Widget child}) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: child,
      );

  Widget _buildDisplayNameCard() {
    return _buildCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Имя для отображения',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          if (_user?.name.isNotEmpty == true) ...[
            const Text(
              'Имя из Google-аккаунта',
              style:
                  TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 4),
            Text(
              _user!.name,
              style: const TextStyle(
                  color: AppColors.textPrimary, fontSize: 14),
            ),
            const SizedBox(height: 12),
          ],
          const Text(
            'Своё имя для отображения',
            style:
                TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _displayNameCtrl,
            maxLength: 60,
            style:
                const TextStyle(color: AppColors.textPrimary),
            decoration: _inputDecoration(
                hintText:
                    'Оставьте пустым, чтобы использовать Google имя'),
            onChanged: (_) => setState(() => _savedName = false),
          ),
          const SizedBox(height: 8),
          _saveRow(
            onSave: _saveDisplayName,
            saving: _savingName,
            saved: _savedName,
          ),
        ],
      ),
    );
  }

  Widget _buildBioCard() => _buildCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'О себе',
              style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _bioCtrl,
              maxLength: 500,
              maxLines: 4,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: _inputDecoration(
                  hintText: 'Расскажите немного о себе...'),
              onChanged: (_) => setState(() => _savedBio = false),
            ),
            const SizedBox(height: 8),
            _saveRow(
              onSave: _saveBio,
              saving: _savingBio,
              saved: _savedBio,
            ),
          ],
        ),
      );

  Widget _buildCityCard() => _buildCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Город',
              style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _cityCtrl,
              maxLength: 50,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration:
                  _inputDecoration(hintText: 'Например: Москва'),
              onChanged: (_) => setState(() => _savedCity = false),
            ),
            const SizedBox(height: 8),
            _saveRow(
              onSave: _saveCity,
              saving: _savingCity,
              saved: _savedCity,
            ),
          ],
        ),
      );

  Widget _buildPreviewCard() => _buildCard(
        child: Row(
          children: [
            const Text(
              'Как вас видят: ',
              style: TextStyle(
                  color: AppColors.textSecondary, fontSize: 13),
            ),
            Text(
              '👤 ${_user!.effectiveName}',
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold),
            ),
          ],
        ),
      );

  Widget _buildGameSystemsCard() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _gsExpanded = !_gsExpanded),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      '🎲 Игровые системы',
                      style: TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.bold),
                    ),
                  ),
                  Icon(
                    _gsExpanded
                        ? Icons.keyboard_arrow_up
                        : Icons.keyboard_arrow_down,
                    color: AppColors.textSecondary,
                  ),
                ],
              ),
            ),
          ),
          if (_gsExpanded) ...[
            const Divider(color: AppColors.border, height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Отметьте системы, для которых вас можно выбрать напарником',
                    style: TextStyle(
                        color: AppColors.textSecondary, fontSize: 12),
                  ),
                  const SizedBox(height: 12),
                  ...gameSystemsMain.map(_buildSystemCheckbox),
                  const Divider(color: AppColors.border),
                  ...gameSystemsBottom.map(_buildSystemCheckbox),
                  const SizedBox(height: 8),
                  _saveRow(
                    onSave: _saveGameSystems,
                    saving: _savingGs,
                    saved: _savedGs,
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSystemCheckbox(String system) {
    return CheckboxListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      title: Text(system,
          style: const TextStyle(
              color: AppColors.textPrimary, fontSize: 13)),
      value: _selectedSystems.contains(system),
      activeColor: AppColors.accent,
      checkColor: Colors.white,
      onChanged: (v) {
        setState(() {
          if (v == true) {
            _selectedSystems.add(system);
          } else {
            _selectedSystems.remove(system);
          }
          _savedGs = false;
        });
      },
    );
  }

  Widget _saveRow({
    required VoidCallback onSave,
    required bool saving,
    required bool saved,
  }) =>
      Row(
        children: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accent,
              foregroundColor: Colors.white,
            ),
            onPressed: saving ? null : onSave,
            child: Text(saving ? 'Сохраняем...' : 'Сохранить'),
          ),
          if (saved) ...[
            const SizedBox(width: 10),
            const Text('✓ Сохранено',
                style: TextStyle(
                    color: AppColors.statusApproved, fontSize: 13)),
          ],
        ],
      );

  InputDecoration _inputDecoration({String? hintText}) => InputDecoration(
        hintText: hintText,
        hintStyle: const TextStyle(color: AppColors.textMuted),
        filled: true,
        fillColor: AppColors.panelBg,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide:
              const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: const BorderSide(color: AppColors.accent),
        ),
        counterStyle:
            const TextStyle(color: AppColors.textMuted),
      );
}
