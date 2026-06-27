import 'package:cloud_firestore/cloud_firestore.dart';

class Artist {
  const Artist({
    required this.id,
    required this.name,
    required this.group,
    required this.country,
    required this.role,
    required this.image,
    required this.banner,
    required this.bio,
    required this.slug,
    required this.followersCount,
    required this.popularityScore,
  });

  final String id;
  final String name;
  final String group;
  final String country;
  final String role;
  final String image;
  final String banner;
  final String bio;
  final String slug;
  final int followersCount;
  final int popularityScore;

  factory Artist.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    final image = _stringValue(data, [
      'image',
      'imageUrl',
      'photo',
      'photoURL',
      'foto',
    ]);
    final banner = _stringValue(data, [
      'banner',
      'bannerUrl',
      'cover',
      'coverImage',
      'portada',
    ]);
    final followersCount = _intValue(data['followersCount']);

    return Artist(
      id: doc.id,
      name: _stringValue(data, ['name']).ifEmpty('Artista'),
      group: _stringValue(data, ['group', 'fandom']),
      country: _stringValue(data, ['country']),
      role: _stringValue(data, ['role']),
      image: image,
      banner: banner.isEmpty ? image : banner,
      bio: _stringValue(data, ['bio']),
      slug: _stringValue(data, ['slug']),
      followersCount: followersCount,
      popularityScore: _intValue(data['popularityScore'], followersCount * 10),
    );
  }
}

String _stringValue(Map<String, dynamic> data, List<String> keys) {
  for (final key in keys) {
    final value = data[key];

    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }
  }

  return '';
}

int _intValue(Object? value, [int fallback = 0]) {
  if (value is int) {
    return value;
  }

  if (value is num) {
    return value.round();
  }

  return fallback;
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}
