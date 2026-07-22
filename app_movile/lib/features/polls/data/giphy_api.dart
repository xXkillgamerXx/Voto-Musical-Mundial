import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/api/api_config.dart';

class GiphyGif {
  const GiphyGif({
    required this.id,
    required this.url,
    required this.previewUrl,
    required this.title,
  });

  final String id;
  final String url;
  final String previewUrl;
  final String title;

  Map<String, String> toCommentPayload() => {
        'url': url,
        'title': title,
        'source': 'giphy',
      };
}

class GiphyApi {
  GiphyApi._();

  static bool get isConfigured => ApiConfig.giphyApiKey.trim().isNotEmpty;

  static Future<List<GiphyGif>> search({String term = '', int limit = 12}) async {
    final key = ApiConfig.giphyApiKey.trim();
    if (key.isEmpty) {
      throw StateError('missing-giphy-key');
    }

    final endpoint = term.trim().isEmpty
        ? 'https://api.giphy.com/v1/gifs/trending'
        : 'https://api.giphy.com/v1/gifs/search';
    final params = <String, String>{
      'api_key': key,
      'limit': '$limit',
      'rating': 'pg-13',
      if (term.trim().isNotEmpty) ...{
        'q': term.trim(),
        'lang': 'es',
      },
    };

    final uri = Uri.parse(endpoint).replace(queryParameters: params);
    final response = await http.get(uri);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('giphy-http-${response.statusCode}');
    }

    final payload = jsonDecode(response.body);
    if (payload is! Map || payload['data'] is! List) {
      return const [];
    }

    return (payload['data'] as List)
        .whereType<Map>()
        .map((row) => _fromJson(Map<String, dynamic>.from(row)))
        .where((gif) => gif.url.isNotEmpty)
        .toList(growable: false);
  }

  static GiphyGif _fromJson(Map<String, dynamic> json) {
    final images = json['images'];
    final imageMap = images is Map ? Map<String, dynamic>.from(images) : const {};

    String urlOf(String key) {
      final entry = imageMap[key];
      if (entry is Map) return '${entry['url'] ?? ''}'.trim();
      return '';
    }

    final url = urlOf('fixed_height').isNotEmpty
        ? urlOf('fixed_height')
        : urlOf('original');
    final preview = urlOf('fixed_width_small_still').isNotEmpty
        ? urlOf('fixed_width_small_still')
        : (urlOf('fixed_height_small_still').isNotEmpty
            ? urlOf('fixed_height_small_still')
            : url);

    return GiphyGif(
      id: '${json['id'] ?? ''}',
      url: url,
      previewUrl: preview,
      title: '${json['title'] ?? 'GIF'}'.trim().isEmpty
          ? 'GIF'
          : '${json['title'] ?? 'GIF'}'.trim(),
    );
  }
}
