import 'dart:math';
import 'package:flutter/material.dart';

import '../app_colors.dart';
import '../models/campaign_map_data.dart';
import '../services/api_service.dart';

// ── Константы геометрии (соответствуют веб-версии) ──────────────────────────
const double _kSegW = 35;
const double _kSegH = 30;
const double _kSegGapV = 2;
const double _kSegGapH = 3;
const double _kBlockHeaderH = 50;

double _blockWidth(int factionsCount) {
  final m = factionsCount < 1 ? 1 : factionsCount;
  return m * _kSegW + (m - 1) * _kSegGapH;
}

double _blockHeight(int maxInfluence) {
  final n = maxInfluence < 1 ? 1 : maxInfluence;
  return 5 + _kBlockHeaderH + n * _kSegH + (n - 1) * _kSegGapV;
}

Offset _blockCenter(
    CampaignMapBlock block, int maxInfluence, int factionsCount) {
  return Offset(
    block.posX + _blockWidth(factionsCount) / 2,
    block.posY + _blockHeight(maxInfluence) / 2,
  );
}

const _kFactionColors = [
  Color(0xFFE94560), Color(0xFF4CAF50), Color(0xFF2196F3), Color(0xFFFF9800),
  Color(0xFF9C27B0), Color(0xFF00BCD4), Color(0xFFF44336), Color(0xFF8BC34A),
];

// ── Painter для стрелок-связей ───────────────────────────────────────────────
class _LinksPainter extends CustomPainter {
  final CampaignMapData mapData;

  _LinksPainter(this.mapData);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.textBlue
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final n = mapData.maxInfluence;
    final fc = mapData.factions.length;

    for (final link in mapData.links) {
      final from =
          mapData.blocks.where((b) => b.id == link.fromBlockId).firstOrNull;
      final to =
          mapData.blocks.where((b) => b.id == link.toBlockId).firstOrNull;
      if (from == null || to == null) continue;

      final p1 = _blockCenter(from, n, fc);
      final p2 = _blockCenter(to, n, fc);

      canvas.drawLine(p1, p2, paint);

      // Стрелка
      const arrowSize = 10.0;
      final angle = atan2(p2.dy - p1.dy, p2.dx - p1.dx);
      final path = Path()
        ..moveTo(p2.dx, p2.dy)
        ..lineTo(
          p2.dx - arrowSize * cos(angle - 0.4),
          p2.dy - arrowSize * sin(angle - 0.4),
        )
        ..lineTo(
          p2.dx - arrowSize * cos(angle + 0.4),
          p2.dy - arrowSize * sin(angle + 0.4),
        )
        ..close();
      canvas.drawPath(
          path, Paint()..color = AppColors.textBlue..style = PaintingStyle.fill);
    }
  }

  @override
  bool shouldRepaint(_LinksPainter old) => false;
}

// ── Экран карты кампании ─────────────────────────────────────────────────────
class CampaignMapScreen extends StatefulWidget {
  final int eventId;
  final String eventTitle;
  final String token;
  final ApiService api;

  const CampaignMapScreen({
    super.key,
    required this.eventId,
    required this.eventTitle,
    required this.token,
    required this.api,
  });

  @override
  State<CampaignMapScreen> createState() => _CampaignMapScreenState();
}

class _CampaignMapScreenState extends State<CampaignMapScreen> {
  CampaignMapData? _mapData;
  bool _loading = true;
  String? _error;
  CampaignMapBlock? _tooltip;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json = await widget.api.getCampaignMap(widget.eventId, widget.token);
      setState(() => _mapData = CampaignMapData.fromJson(json));
    } catch (e) {
      setState(() => _error = e.toString().contains('404')
          ? 'Карта кампании ещё не создана'
          : 'Ошибка загрузки карты');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.cardBg,
        leading: IconButton(
          icon: const Icon(Icons.close, color: AppColors.textSecondary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          '🗺️ Карта кампании: ${widget.eventTitle}',
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accent))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!,
                            style: const TextStyle(color: AppColors.textSecondary),
                            textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton(
                            onPressed: _load, child: const Text('Повторить')),
                      ],
                    ),
                  ),
                )
              : _buildMap(),
    );
  }

  Widget _buildMap() {
    final data = _mapData!;
    final n = data.maxInfluence;
    final fc = data.factions.length;
    final bw = _blockWidth(fc);
    final bh = _blockHeight(n);

    // Вычислим размер канваса
    double canvasW = 1200;
    double canvasH = 700;
    if (data.blocks.isNotEmpty) {
      canvasW = data.blocks
              .map((b) => b.posX + bw + 20)
              .reduce(max) +
          40;
      canvasH = data.blocks
              .map((b) => b.posY + bh + 20)
              .reduce(max) +
          40;
    }

    return GestureDetector(
      onTap: () => setState(() => _tooltip = null),
      child: Stack(
        children: [
          InteractiveViewer(
            constrained: false,
            minScale: 0.3,
            maxScale: 3.0,
            child: SizedBox(
              width: canvasW,
              height: canvasH,
              child: Stack(
                children: [
                  // Стрелки
                  Positioned.fill(
                    child: CustomPaint(painter: _LinksPainter(data)),
                  ),
                  // Блоки
                  ...data.blocks.map((block) => Positioned(
                        left: block.posX,
                        top: block.posY,
                        width: bw,
                        height: bh,
                        child: _buildBlock(block, n, fc, data.factions),
                      )),
                ],
              ),
            ),
          ),
          // Тултип
          if (_tooltip != null) _buildTooltip(_tooltip!, data),
        ],
      ),
    );
  }

  Widget _buildBlock(CampaignMapBlock block, int n, int fc,
      List<String> factionNames) {
    return GestureDetector(
      onTap: () => setState(
          () => _tooltip = _tooltip?.id == block.id ? null : block),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF0A0A1A),
          border: Border.all(color: AppColors.accentPurple, width: 2),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Column(
          children: [
            // Заголовок
            Container(
              height: _kBlockHeaderH,
              decoration: const BoxDecoration(
                color: AppColors.cardBg,
                border: Border(
                    bottom: BorderSide(color: AppColors.accentPurple)),
              ),
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                block.title.isEmpty ? '—' : block.title,
                style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary),
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                maxLines: 3,
              ),
            ),
            // Сетка влияния (N строк сверху вниз, уровень убывает)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(2),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.start,
                  children: List.generate(n, (rowIdx) {
                    final level = n - rowIdx;
                    return Padding(
                      padding: EdgeInsets.only(
                          bottom: rowIdx < n - 1 ? _kSegGapV : 0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.start,
                        children: List.generate(fc < 1 ? 1 : fc, (fi) {
                          final fd = block.factions
                              .where((f) => f.factionIndex == fi)
                              .firstOrNull;
                          final influence = fd?.influence ?? 0;
                          final color =
                              _kFactionColors[fi % _kFactionColors.length];
                          return Container(
                            width: _kSegW,
                            height: _kSegH,
                            margin: EdgeInsets.only(
                                right: fi < fc - 1 ? _kSegGapH : 0),
                            decoration: BoxDecoration(
                              color: influence >= level
                                  ? color
                                  : Colors.white.withOpacity(0.05),
                              border:
                                  Border.all(color: Colors.grey, width: 1.5),
                              borderRadius: BorderRadius.circular(3),
                            ),
                          );
                        }),
                      ),
                    );
                  }),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTooltip(CampaignMapBlock block, CampaignMapData data) {
    return Positioned(
      right: 12,
      bottom: 12,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 200),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          border: Border.all(color: AppColors.accentPurple),
          borderRadius: BorderRadius.circular(8),
          boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 8)],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              block.title.isEmpty ? '—' : block.title,
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 13),
            ),
            const SizedBox(height: 8),
            ...data.factions.asMap().entries.map((e) {
              final fi = e.key;
              final name = e.value;
              final fd = block.factions
                  .where((f) => f.factionIndex == fi)
                  .firstOrNull;
              final influence = fd?.influence ?? 0;
              final color = _kFactionColors[fi % _kFactionColors.length];
              return Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                          color: color,
                          borderRadius: BorderRadius.circular(2)),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(name,
                          style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary)),
                    ),
                    Text(
                      '$influence/${data.maxInfluence}',
                      style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.accentYellow,
                          fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
