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
    required this.totalVotes,
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
  final int totalVotes;

  factory Artist.fromJson(Map<String, dynamic> json) {
    final metadata = json['metadata'] is Map<String, dynamic>
        ? json['metadata'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final image = _stringValue([
      json['image'],
      json['imageUrl'],
      json['photo'],
      json['photoURL'],
      json['photoUrl'],
      json['foto'],
      metadata['image'],
      metadata['imageUrl'],
      metadata['photo'],
      metadata['photoURL'],
      metadata['foto'],
    ]);
    final banner = _stringValue([
      json['banner'],
      json['bannerUrl'],
      json['cover'],
      json['coverImage'],
      json['portada'],
      metadata['banner'],
      metadata['bannerUrl'],
      metadata['cover'],
      metadata['coverImage'],
      metadata['portada'],
    ]);
    final followersCount = _intValue(
      json['followersCount'] ?? metadata['followersCount'],
    );
    final totalVotes = _intValue(json['totalVotes'] ?? metadata['totalVotes']);
    final popularityScore = _intValue(
      json['popularityScore'] ?? metadata['popularityScore'],
      followersCount * 10 + totalVotes,
    );

    return Artist(
      id: '${json['id'] ?? ''}',
      name: _stringValue([json['name']]).ifEmpty('Artista'),
      group: _stringValue([json['group'], json['fandom'], metadata['group'], metadata['fandom']]),
      country: _stringValue([json['country'], metadata['country']]),
      role: _stringValue([json['role'], json['genre'], metadata['role'], metadata['genre']]),
      image: image,
      banner: banner.isEmpty ? image : banner,
      bio: _stringValue([json['bio'], metadata['bio']]),
      slug: _stringValue([json['slug'], metadata['slug']]),
      followersCount: followersCount,
      popularityScore: popularityScore,
      totalVotes: totalVotes,
    );
  }
}

String _stringValue(List<Object?> values) {
  for (final value in values) {
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

  return int.tryParse('$value') ?? fallback;
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}
