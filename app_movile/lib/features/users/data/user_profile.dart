class FollowedArtistSummary {
  const FollowedArtistSummary({
    required this.id,
    required this.artistId,
    required this.artistSlug,
    required this.artistName,
    required this.artistImage,
    required this.artistGroup,
  });

  final String id;
  final String artistId;
  final String artistSlug;
  final String artistName;
  final String artistImage;
  final String artistGroup;

  factory FollowedArtistSummary.fromJson(Map<String, dynamic> json) {
    return FollowedArtistSummary(
      id: '${json['id'] ?? ''}',
      artistId: '${json['artistId'] ?? ''}',
      artistSlug: '${json['artistSlug'] ?? ''}',
      artistName: _stringValue([json['artistName']]).ifEmpty('Artista'),
      artistImage: _stringValue([
        json['artistImage'],
        json['artistPhoto'],
      ]),
      artistGroup: _stringValue([json['artistGroup']]),
    );
  }
}

class UserProfile {
  const UserProfile({
    required this.id,
    required this.username,
    required this.displayName,
    required this.photoUrl,
    required this.bannerUrl,
    required this.bio,
    required this.country,
    required this.followedArtists,
    this.emailCampaigns = true,
  });

  final String id;
  final String username;
  final String displayName;
  final String photoUrl;
  final String bannerUrl;
  final String bio;
  final String country;
  final bool emailCampaigns;
  final List<FollowedArtistSummary> followedArtists;

  String get name {
    final value = displayName.trim();
    if (value.isNotEmpty) return value;
    return username.isNotEmpty ? username : 'Fan';
  }

  String get initial {
    final value = name.trim();
    return value.isEmpty ? 'F' : value[0].toUpperCase();
  }

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    final followed = json['followedArtists'];
    return UserProfile(
      id: '${json['id'] ?? ''}',
      username: '${json['username'] ?? ''}',
      displayName: _stringValue([
        json['name'],
        json['displayName'],
      ]),
      photoUrl: _stringValue([
        json['photoUrl'],
        json['photoURL'],
      ]),
      bannerUrl: _stringValue([
        json['banner'],
        json['bannerUrl'],
      ]),
      bio: _stringValue([json['bio']]),
      country: _stringValue([json['country']]),
      emailCampaigns: json['emailCampaigns'] != false,
      followedArtists: followed is List
          ? followed
                .whereType<Map<String, dynamic>>()
                .map(FollowedArtistSummary.fromJson)
                .toList(growable: false)
          : const [],
    );
  }
}

String _stringValue(List<dynamic> values) {
  for (final value in values) {
    final text = '$value'.trim();
    if (text.isNotEmpty && text != 'null') {
      return text;
    }
  }
  return '';
}

extension on String {
  String ifEmpty(String fallback) => trim().isEmpty ? fallback : this;
}
