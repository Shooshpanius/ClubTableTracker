import 'dart:convert';

class CampaignMapFaction {
  final int id;
  final int factionIndex;
  final int influence;

  const CampaignMapFaction({
    required this.id,
    required this.factionIndex,
    required this.influence,
  });

  factory CampaignMapFaction.fromJson(Map<String, dynamic> json) =>
      CampaignMapFaction(
        id: json['id'] as int? ?? 0,
        factionIndex: json['factionIndex'] as int,
        influence: json['influence'] as int? ?? 0,
      );
}

class CampaignMapBlock {
  final int id;
  final int mapId;
  final String title;
  final double posX;
  final double posY;
  final List<CampaignMapFaction> factions;

  const CampaignMapBlock({
    required this.id,
    required this.mapId,
    required this.title,
    required this.posX,
    required this.posY,
    required this.factions,
  });

  factory CampaignMapBlock.fromJson(Map<String, dynamic> json) =>
      CampaignMapBlock(
        id: json['id'] as int,
        mapId: json['mapId'] as int? ?? 0,
        title: json['title'] as String? ?? '',
        posX: (json['posX'] as num).toDouble(),
        posY: (json['posY'] as num).toDouble(),
        factions: (json['factions'] as List<dynamic>?)
                ?.map((f) =>
                    CampaignMapFaction.fromJson(f as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class CampaignMapLink {
  final int id;
  final int fromBlockId;
  final int toBlockId;

  const CampaignMapLink({
    required this.id,
    required this.fromBlockId,
    required this.toBlockId,
  });

  factory CampaignMapLink.fromJson(Map<String, dynamic> json) =>
      CampaignMapLink(
        id: json['id'] as int? ?? 0,
        fromBlockId: json['fromBlockId'] as int,
        toBlockId: json['toBlockId'] as int,
      );
}

class CampaignMapData {
  final int id;
  final int eventId;
  final int maxInfluence;
  final List<String> factions;
  final List<CampaignMapBlock> blocks;
  final List<CampaignMapLink> links;

  const CampaignMapData({
    required this.id,
    required this.eventId,
    required this.maxInfluence,
    required this.factions,
    required this.blocks,
    required this.links,
  });

  factory CampaignMapData.fromJson(Map<String, dynamic> json) {
    final factionsRaw = json['factions'] as String? ?? '[]';
    final factionsList =
        (jsonDecode(factionsRaw) as List<dynamic>).cast<String>();
    return CampaignMapData(
      id: json['id'] as int,
      eventId: json['eventId'] as int,
      maxInfluence: json['maxInfluence'] as int? ?? 1,
      factions: factionsList,
      blocks: (json['blocks'] as List<dynamic>?)
              ?.map((b) =>
                  CampaignMapBlock.fromJson(b as Map<String, dynamic>))
              .toList() ??
          [],
      links: (json['links'] as List<dynamic>?)
              ?.map((l) =>
                  CampaignMapLink.fromJson(l as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
