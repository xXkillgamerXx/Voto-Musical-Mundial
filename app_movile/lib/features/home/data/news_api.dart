import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/cache/response_cache.dart';

class NewsItem {
  const NewsItem({
    required this.title,
    required this.tag,
    required this.time,
    required this.link,
    required this.description,
    required this.imageUrl,
    required this.gradientIndex,
    this.rawDate,
  });

  final String title;
  final String tag;
  final String time;
  final String link;
  final String description;
  final String imageUrl;
  final int gradientIndex;
  final DateTime? rawDate;

  bool matchesQuery(String query) {
    if (query.isEmpty) {
      return true;
    }

    final haystack = '$title $tag $description'.toLowerCase();
    return haystack.contains(query);
  }
}

class NewsPageResult {
  const NewsPageResult({
    required this.items,
    required this.total,
    required this.totalPages,
    required this.page,
  });

  final List<NewsItem> items;
  final int total;
  final int totalPages;
  final int page;
}

class NewsApi {
  static const _baseHost = 'www.musicmundial.com';
  static const _postsPath = '/wp-json/wp/v2/posts';
  static const _cacheTtl = Duration(minutes: 10);

  static const _gradients = [
    [0xFF4C1D95, 0xFFC026D3, 0xFF312E81],
    [0xFF312E81, 0xFF7C3AED, 0xFF701A75],
    [0xFF78350F, 0xFFC026D3, 0xFF4C1D95],
    [0xFF083344, 0xFF6D28D9, 0xFF020617],
    [0xFF881337, 0xFFC026D3, 0xFF020617],
    [0xFF020617, 0xFF1D4ED8, 0xFF4C1D95],
  ];

  Future<List<NewsItem>> getLatestNews({
    int perPage = 3,
    bool forceRefresh = false,
  }) async {
    final result = await fetchNewsPage(
      page: 1,
      perPage: perPage,
      forceRefresh: forceRefresh,
    );
    return result.items;
  }

  Future<NewsPageResult> fetchNewsPage({
    int page = 1,
    int perPage = 9,
    String search = '',
    bool forceRefresh = false,
  }) async {
    final safePage = page < 1 ? 1 : page;
    final safePerPage = perPage.clamp(1, 100);
    final cacheKey = _cacheKey(
      page: safePage,
      perPage: safePerPage,
      search: search,
    );
    final cache = ResponseCache.instanceOrNull;

    if (!forceRefresh && cache != null) {
      final fresh = cache.readFresh(cacheKey, _cacheTtl);
      if (fresh is Map<String, dynamic>) {
        return _pageResultFromCache(fresh);
      }

      final stale = cache.readAny(cacheKey);
      if (stale is Map<String, dynamic>) {
        _fetchAndCachePage(
          page: safePage,
          perPage: safePerPage,
          search: search,
          cacheKey: cacheKey,
        );
        return _pageResultFromCache(stale);
      }
    }

    return _fetchAndCachePage(
      page: safePage,
      perPage: safePerPage,
      search: search,
      cacheKey: cacheKey,
    );
  }

  Future<NewsPageResult> _fetchAndCachePage({
    required int page,
    required int perPage,
    required String search,
    required String cacheKey,
  }) async {
    final result = await _requestNewsPage(
      page: page,
      perPage: perPage,
      search: search,
    );

    await ResponseCache.instanceOrNull?.write(
      cacheKey,
      {
        'items': result.items.map(_newsItemToJson).toList(growable: false),
        'total': result.total,
        'totalPages': result.totalPages,
        'page': result.page,
      },
    );

    return result;
  }

  Future<NewsPageResult> _requestNewsPage({
    required int page,
    required int perPage,
    required String search,
  }) async {
    final safePage = page < 1 ? 1 : page;
    final safePerPage = perPage.clamp(1, 100);
    final query = <String, String>{
      'per_page': '$safePerPage',
      'page': '$safePage',
      '_embed': '1',
    };

    final trimmedSearch = search.trim();
    if (trimmedSearch.isNotEmpty) {
      query['search'] = trimmedSearch;
    }

    try {
      final response = await http.get(
        Uri.https(_baseHost, _postsPath, query),
      );

      if (response.statusCode == 400 && safePage > 1) {
        return _requestNewsPage(
          page: 1,
          perPage: safePerPage,
          search: search,
        );
      }

      if (response.statusCode != 200) {
        throw NewsApiException('No se pudieron cargar las noticias.');
      }

      final payload = jsonDecode(response.body);
      if (payload is! List) {
        throw NewsApiException('Respuesta inválida del feed de noticias.');
      }

      final items = payload
          .whereType<Map<String, dynamic>>()
          .map(_mapPost)
          .where((item) => item.title.isNotEmpty)
          .toList(growable: false);

      final total = _headerInt(response.headers, 'x-wp-total') ?? items.length;
      final totalPages =
          _headerInt(response.headers, 'x-wp-totalpages') ??
          (total == 0 ? 1 : ((total + safePerPage - 1) / safePerPage).ceil());

      return NewsPageResult(
        items: items,
        total: total,
        totalPages: totalPages < 1 ? 1 : totalPages,
        page: safePage,
      );
    } on NewsApiException {
      rethrow;
    } catch (_) {
      throw NewsApiException('No se pudieron cargar las noticias.');
    }
  }

  String _cacheKey({
    required int page,
    required int perPage,
    required String search,
  }) {
    final normalizedSearch = search.trim().toLowerCase();
    return 'news::$page::$perPage::$normalizedSearch';
  }

  NewsPageResult _pageResultFromCache(Map<String, dynamic> payload) {
    final rawItems = payload['items'];
    final items = rawItems is List
        ? rawItems
            .whereType<Map<String, dynamic>>()
            .map(_newsItemFromJson)
            .toList(growable: false)
        : const <NewsItem>[];

    return NewsPageResult(
      items: items,
      total: _toInt(payload['total']),
      totalPages: _toInt(payload['totalPages'], fallback: 1),
      page: _toInt(payload['page'], fallback: 1),
    );
  }

  Map<String, dynamic> _newsItemToJson(NewsItem item) {
    return {
      'title': item.title,
      'tag': item.tag,
      'time': item.time,
      'link': item.link,
      'description': item.description,
      'imageUrl': item.imageUrl,
      'gradientIndex': item.gradientIndex,
      'rawDate': item.rawDate?.toIso8601String(),
    };
  }

  NewsItem _newsItemFromJson(Map<String, dynamic> json) {
    return NewsItem(
      title: '${json['title'] ?? ''}',
      tag: '${json['tag'] ?? 'News'}',
      time: '${json['time'] ?? 'Reciente'}',
      link: '${json['link'] ?? ''}',
      description: '${json['description'] ?? ''}',
      imageUrl: '${json['imageUrl'] ?? ''}',
      gradientIndex: _toInt(json['gradientIndex']),
      rawDate: DateTime.tryParse('${json['rawDate'] ?? ''}'),
    );
  }

  int _toInt(Object? value, {int fallback = 0}) {
    if (value is int) return value;
    if (value is num) return value.round();
    return int.tryParse('$value') ?? fallback;
  }

  NewsItem _mapPost(Map<String, dynamic> post) {
    final embedded = post['_embedded'];
    final featuredMedia = embedded is Map<String, dynamic>
        ? (embedded['wp:featuredmedia'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .firstOrNull
        : null;
    final terms = embedded is Map<String, dynamic>
        ? (embedded['wp:term'] as List<dynamic>? ?? const [])
            .expand((entry) => entry is List ? entry : const [])
            .whereType<Map<String, dynamic>>()
            .toList(growable: false)
        : const <Map<String, dynamic>>[];

    var tag = 'News';
    for (final term in terms) {
      if (term['taxonomy'] == 'category') {
        tag = _stripHtml('${term['name'] ?? tag}');
        break;
      }
    }

    final title = _stripHtml('${post['title']?['rendered'] ?? ''}');
    final description = _stripHtml('${post['excerpt']?['rendered'] ?? ''}');
    final link = '${post['link'] ?? 'https://www.musicmundial.com/'}';
    final rawDateString = '${post['date_gmt'] ?? post['date'] ?? ''}';
    final imageUrl = '${featuredMedia?['source_url'] ?? ''}';
    final rawDate = DateTime.tryParse(rawDateString);

    return NewsItem(
      title: title.isEmpty ? 'Noticia' : title,
      tag: tag.isEmpty ? 'News' : tag,
      time: _formatDate(rawDate),
      link: link,
      description: description,
      imageUrl: imageUrl,
      gradientIndex: title.hashCode.abs() % _gradients.length,
      rawDate: rawDate,
    );
  }

  static List<int> gradientColorsFor(int index) =>
      _gradients[index % _gradients.length];

  static int? _headerInt(Map<String, String> headers, String key) {
    final value = headers[key];
    if (value == null) {
      return null;
    }

    return int.tryParse(value);
  }
}

class NewsApiException implements Exception {
  NewsApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

String _stripHtml(String value) {
  return value
      .replaceAll(RegExp(r'<[^>]+>'), ' ')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#8211;', '-')
      .replaceAll('&#8217;', "'")
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

String _formatDate(DateTime? date) {
  if (date == null) {
    return 'Reciente';
  }

  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];

  final local = date.toLocal();
  final month = months[local.month - 1];
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');

  return '${local.day} $month ${local.year}, $hour:$minute';
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final iterator = this.iterator;
    if (!iterator.moveNext()) {
      return null;
    }

    return iterator.current;
  }
}
